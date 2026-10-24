/*
  # Onboarding: induction checklists and the one-step hand-off (Phase 2)

  Additive. Existing induction_templates and induction_journeys rows keep
  working; they simply gain tasks.

  1. induction_templates: optional `title`, designation becomes optional so an
     organisation can have one general template. Existing rows get a title
     from their designation.
  2. induction_template_tasks: the checklist a template hands to every joiner
     (owner, due day offset, required or not).
  3. induction_journeys: `probation_end_date`, `buddy_employee_id`, `notes`.
  4. induction_tasks: the joiner's own copy of the checklist, with status.
     Journey completion % is recomputed from required tasks whenever one
     changes; when every required task is done and the induction learning
     path (if any) is completed, the journey closes and the employee moves
     to the Active stage (via the Phase 1 trigger).
  5. start_induction(employee, template, start_date): creates the journey,
     copies the tasks with real due dates and assigns the template's learning
     path — one call from People or Candidates.
  6. RLS tightened to the organisation (the old policies let any staff role
     read every organisation's journeys) and HR can now manage templates.
*/

-- 1. templates -----------------------------------------------------------------

ALTER TABLE induction_templates ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE induction_templates ALTER COLUMN designation_id DROP NOT NULL;

UPDATE induction_templates t
SET title = COALESCE(t.title, d.title || ' induction', 'Induction')
FROM designations d
WHERE d.id = t.designation_id AND t.title IS NULL;
UPDATE induction_templates SET title = 'Induction' WHERE title IS NULL;

ALTER TABLE induction_templates ALTER COLUMN title SET NOT NULL;

-- 2. template tasks ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS induction_template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES induction_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  owner text NOT NULL DEFAULT 'employee' CHECK (owner IN ('employee', 'manager', 'hr')),
  due_day integer NOT NULL DEFAULT 7 CHECK (due_day >= 0),
  is_required boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_induction_template_tasks_template ON induction_template_tasks(template_id, order_index);
ALTER TABLE induction_template_tasks ENABLE ROW LEVEL SECURITY;

-- 3. journeys ------------------------------------------------------------------

ALTER TABLE induction_journeys ADD COLUMN IF NOT EXISTS probation_end_date date;
ALTER TABLE induction_journeys ADD COLUMN IF NOT EXISTS buddy_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE induction_journeys ADD COLUMN IF NOT EXISTS notes text;
CREATE INDEX IF NOT EXISTS idx_induction_journeys_employee ON induction_journeys(employee_id, status);

-- 4. journey tasks -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS induction_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES induction_journeys(id) ON DELETE CASCADE,
  template_task_id uuid REFERENCES induction_template_tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  owner text NOT NULL DEFAULT 'employee' CHECK (owner IN ('employee', 'manager', 'hr')),
  due_date date,
  is_required boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  completed_at timestamptz,
  completed_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_induction_tasks_journey ON induction_tasks(journey_id, order_index);
ALTER TABLE induction_tasks ENABLE ROW LEVEL SECURITY;

-- updated_at housekeeping (set_updated_at() exists from the Oct 23 migration)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_induction_template_tasks_updated ON induction_template_tasks;
    CREATE TRIGGER trg_induction_template_tasks_updated BEFORE UPDATE ON induction_template_tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    DROP TRIGGER IF EXISTS trg_induction_tasks_updated ON induction_tasks;
    CREATE TRIGGER trg_induction_tasks_updated BEFORE UPDATE ON induction_tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Completion % and auto-close -------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_induction_journey(p_journey uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_required integer;
  v_done integer;
  v_pct integer;
  v_path uuid;
  v_emp uuid;
  v_status text;
  v_path_done boolean := true;
BEGIN
  SELECT j.employee_id, j.status, t.learning_path_id
    INTO v_emp, v_status, v_path
  FROM induction_journeys j LEFT JOIN induction_templates t ON t.id = j.template_id
  WHERE j.id = p_journey;
  IF v_emp IS NULL THEN RETURN; END IF;

  SELECT count(*) FILTER (WHERE is_required),
         count(*) FILTER (WHERE is_required AND status IN ('done', 'skipped'))
    INTO v_required, v_done
  FROM induction_tasks WHERE journey_id = p_journey;

  IF v_path IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM employee_learning_assignments a
      WHERE a.employee_id = v_emp AND a.learning_path_id = v_path AND a.status = 'completed'
    ) INTO v_path_done;
  END IF;

  -- Tasks make up the whole bar when there is no learning path; otherwise the path is one more "task".
  IF v_path IS NULL THEN
    v_pct := CASE WHEN v_required = 0 THEN 0 ELSE round(100.0 * v_done / v_required) END;
  ELSE
    v_pct := round(100.0 * (v_done + CASE WHEN v_path_done THEN 1 ELSE 0 END) / (v_required + 1));
  END IF;

  UPDATE induction_journeys
  SET completion_percentage = v_pct,
      status = CASE
        WHEN status IN ('not_started', 'in_progress', 'extended')
             AND (v_required > 0 OR v_path IS NOT NULL)
             AND v_done = v_required AND v_path_done THEN 'completed'
        WHEN status = 'not_started' AND v_done > 0 THEN 'in_progress'
        ELSE status END,
      actual_end_date = CASE
        WHEN status IN ('not_started', 'in_progress', 'extended')
             AND (v_required > 0 OR v_path IS NOT NULL)
             AND v_done = v_required AND v_path_done THEN CURRENT_DATE
        ELSE actual_end_date END
  WHERE id = p_journey;
END $$;

CREATE OR REPLACE FUNCTION trg_refresh_induction_from_task()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_induction_journey(COALESCE(NEW.journey_id, OLD.journey_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_induction_tasks_refresh ON induction_tasks;
CREATE TRIGGER trg_induction_tasks_refresh
  AFTER INSERT OR UPDATE OF status, is_required OR DELETE ON induction_tasks
  FOR EACH ROW EXECUTE FUNCTION trg_refresh_induction_from_task();

-- A learning-path assignment finishing can also close the induction.
CREATE OR REPLACE FUNCTION trg_refresh_induction_from_assignment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j record;
BEGIN
  IF NEW.learning_path_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  FOR j IN
    SELECT ij.id FROM induction_journeys ij
    JOIN induction_templates t ON t.id = ij.template_id
    WHERE ij.employee_id = NEW.employee_id AND t.learning_path_id = NEW.learning_path_id
      AND ij.status IN ('not_started', 'in_progress', 'extended')
  LOOP
    PERFORM refresh_induction_journey(j.id);
  END LOOP;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_assignment_refresh_induction ON employee_learning_assignments;
CREATE TRIGGER trg_assignment_refresh_induction
  AFTER UPDATE OF status ON employee_learning_assignments
  FOR EACH ROW EXECUTE FUNCTION trg_refresh_induction_from_assignment();

-- 5. one-step start ----------------------------------------------------------

CREATE OR REPLACE FUNCTION start_induction(p_employee uuid, p_template uuid, p_start date DEFAULT CURRENT_DATE)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller record;
  v_emp record;
  v_tpl record;
  v_journey uuid;
  v_assignment uuid;
BEGIN
  SELECT role, organization_id INTO v_caller FROM user_profiles WHERE id = auth.uid();
  IF v_caller IS NULL OR v_caller.role NOT IN ('platform_admin', 'admin', 'hr', 'l_d_manager') THEN
    RAISE EXCEPTION 'Not allowed to start an induction';
  END IF;

  SELECT id, organization_id INTO v_emp FROM employees WHERE id = p_employee;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Employee not found'; END IF;
  IF v_caller.role <> 'platform_admin' AND v_emp.organization_id <> v_caller.organization_id THEN
    RAISE EXCEPTION 'Employee is in another organisation';
  END IF;

  IF p_template IS NOT NULL THEN
    SELECT * INTO v_tpl FROM induction_templates WHERE id = p_template AND organization_id = v_emp.organization_id;
    IF v_tpl IS NULL THEN RAISE EXCEPTION 'Template not found'; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM induction_journeys WHERE employee_id = p_employee AND status IN ('not_started', 'in_progress', 'extended')) THEN
    RAISE EXCEPTION 'This person already has an induction in progress';
  END IF;

  INSERT INTO induction_journeys (employee_id, template_id, start_date, expected_end_date, status, completion_percentage, probation_end_date)
  VALUES (
    p_employee, p_template, p_start,
    p_start + COALESCE(v_tpl.duration_days, 90),
    CASE WHEN p_start > CURRENT_DATE THEN 'not_started' ELSE 'in_progress' END,
    0,
    p_start + COALESCE(v_tpl.duration_days, 90)
  )
  RETURNING id INTO v_journey;

  IF p_template IS NOT NULL THEN
    INSERT INTO induction_tasks (journey_id, template_task_id, title, description, owner, due_date, is_required, order_index)
    SELECT v_journey, tt.id, tt.title, tt.description, tt.owner, p_start + tt.due_day, tt.is_required, tt.order_index
    FROM induction_template_tasks tt WHERE tt.template_id = p_template ORDER BY tt.order_index;

    IF v_tpl.learning_path_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM employee_learning_assignments WHERE employee_id = p_employee AND learning_path_id = v_tpl.learning_path_id
    ) THEN
      INSERT INTO employee_learning_assignments (employee_id, learning_path_id, assigned_by, assigned_date, due_date, status)
      VALUES (p_employee, v_tpl.learning_path_id, auth.uid(), p_start, p_start + COALESCE(v_tpl.duration_days, 90), 'assigned')
      RETURNING id INTO v_assignment;
    END IF;
  END IF;

  PERFORM refresh_induction_journey(v_journey);
  RETURN v_journey;
END $$;

GRANT EXECUTE ON FUNCTION start_induction(uuid, uuid, date) TO authenticated;

-- 6. RLS -----------------------------------------------------------------------

-- Helpers kept inline so this migration does not depend on others' helper names.

DROP POLICY IF EXISTS "Employees can view their own induction journeys" ON induction_journeys;
DROP POLICY IF EXISTS "HR and admins can insert induction journeys" ON induction_journeys;
DROP POLICY IF EXISTS "Employees and HR can update induction journeys" ON induction_journeys;
DROP POLICY IF EXISTS "All org members can view induction templates" ON induction_templates;
DROP POLICY IF EXISTS "LD and admins can manage induction templates" ON induction_templates;
DROP POLICY IF EXISTS "LD and admins can update induction templates" ON induction_templates;
DROP POLICY IF EXISTS "LD and admins can delete induction templates" ON induction_templates;

-- Templates: everyone in the organisation can read; admin, hr and L&D manage.
CREATE POLICY induction_templates_select ON induction_templates FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY induction_templates_write ON induction_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'hr', 'l_d_manager') AND p.organization_id = induction_templates.organization_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'hr', 'l_d_manager') AND p.organization_id = induction_templates.organization_id));

CREATE POLICY induction_template_tasks_select ON induction_template_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM induction_templates t JOIN user_profiles p ON p.organization_id = t.organization_id WHERE t.id = induction_template_tasks.template_id AND p.id = auth.uid()));
CREATE POLICY induction_template_tasks_write ON induction_template_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM induction_templates t JOIN user_profiles p ON p.organization_id = t.organization_id WHERE t.id = induction_template_tasks.template_id AND p.id = auth.uid() AND p.role IN ('admin', 'hr', 'l_d_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM induction_templates t JOIN user_profiles p ON p.organization_id = t.organization_id WHERE t.id = induction_template_tasks.template_id AND p.id = auth.uid() AND p.role IN ('admin', 'hr', 'l_d_manager')));

-- Journeys: the joiner, their manager, and staff roles in the same organisation.
CREATE POLICY induction_journeys_select ON induction_journeys FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR employee_id IN (SELECT e.id FROM employees e JOIN employees m ON m.id = e.reporting_manager_id WHERE m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM employees e JOIN user_profiles p ON p.organization_id = e.organization_id
               WHERE e.id = induction_journeys.employee_id AND p.id = auth.uid() AND p.role IN ('admin', 'hr', 'l_d_manager', 'platform_admin'))
  );
CREATE POLICY induction_journeys_write ON induction_journeys FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM employees e JOIN user_profiles p ON p.organization_id = e.organization_id
                 WHERE e.id = induction_journeys.employee_id AND p.id = auth.uid() AND p.role IN ('admin', 'hr', 'l_d_manager', 'platform_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM employees e JOIN user_profiles p ON p.organization_id = e.organization_id
                      WHERE e.id = induction_journeys.employee_id AND p.id = auth.uid() AND p.role IN ('admin', 'hr', 'l_d_manager', 'platform_admin')));

-- Tasks: read like the journey; the joiner may tick their own tasks, the manager theirs, staff anything.
CREATE POLICY induction_tasks_select ON induction_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM induction_journeys j WHERE j.id = induction_tasks.journey_id)); -- journey policy decides
CREATE POLICY induction_tasks_update_own ON induction_tasks FOR UPDATE TO authenticated
  USING (
    (owner = 'employee' AND EXISTS (SELECT 1 FROM induction_journeys j JOIN employees e ON e.id = j.employee_id WHERE j.id = induction_tasks.journey_id AND e.user_id = auth.uid()))
    OR (owner = 'manager' AND EXISTS (SELECT 1 FROM induction_journeys j JOIN employees e ON e.id = j.employee_id JOIN employees m ON m.id = e.reporting_manager_id WHERE j.id = induction_tasks.journey_id AND m.user_id = auth.uid()))
  )
  WITH CHECK (true);
CREATE POLICY induction_tasks_staff ON induction_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM induction_journeys j JOIN employees e ON e.id = j.employee_id JOIN user_profiles p ON p.organization_id = e.organization_id
                 WHERE j.id = induction_tasks.journey_id AND p.id = auth.uid() AND p.role IN ('admin', 'hr', 'l_d_manager', 'platform_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM induction_journeys j JOIN employees e ON e.id = j.employee_id JOIN user_profiles p ON p.organization_id = e.organization_id
                      WHERE j.id = induction_tasks.journey_id AND p.id = auth.uid() AND p.role IN ('admin', 'hr', 'l_d_manager', 'platform_admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON induction_template_tasks, induction_tasks TO authenticated;
