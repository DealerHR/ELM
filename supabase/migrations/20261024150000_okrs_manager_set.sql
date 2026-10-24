/*
  # OKRs: the manager sets them, the employee comments, the manager locks (Phase 3)

  Flow becomes   draft  →  set  →  locked        (+ cancelled)
  - draft:  the manager is still writing; the employee does not see it yet.
  - set:    shared with the employee. They can read it and add comments; the
            manager updates key-result progress and can still edit.
  - locked: the manager has signed off. Read-only for everyone.

  Existing rows are mapped, not deleted:
    submitted → draft (still being worked out), approved → set,
    review_locked → locked. Rows created under the old employee-drafted flow
    (no set_by) stay visible to the employee so nothing disappears.

  Additive: new columns and a comments table; old columns and the
  okr_review_comments table are kept for the history they hold.
*/

-- 1. statuses ------------------------------------------------------------------

ALTER TABLE okrs DROP CONSTRAINT IF EXISTS okrs_status_check;
ALTER TABLE okrs ADD CONSTRAINT okrs_status_check
  CHECK (status IN ('draft', 'set', 'locked', 'cancelled', 'submitted', 'approved', 'review_locked'));

UPDATE okrs SET status = 'draft'  WHERE status = 'submitted';
UPDATE okrs SET status = 'set'    WHERE status = 'approved';
UPDATE okrs SET status = 'locked' WHERE status = 'review_locked';

ALTER TABLE okrs DROP CONSTRAINT IF EXISTS okrs_status_check;
ALTER TABLE okrs ADD CONSTRAINT okrs_status_check
  CHECK (status IN ('draft', 'set', 'locked', 'cancelled'));
ALTER TABLE okrs ALTER COLUMN status SET DEFAULT 'draft';

-- 2. who set it, who locked it ----------------------------------------------------

ALTER TABLE okrs ADD COLUMN IF NOT EXISTS set_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE okrs ADD COLUMN IF NOT EXISTS set_at timestamptz;
ALTER TABLE okrs ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE okrs ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE okrs ADD COLUMN IF NOT EXISTS manager_summary text;
ALTER TABLE okrs ADD COLUMN IF NOT EXISTS final_rating integer CHECK (final_rating BETWEEN 1 AND 5);

-- Carry old sign-off data across where it exists.
UPDATE okrs SET locked_at = review_locked_at WHERE locked_at IS NULL AND review_locked_at IS NOT NULL;
UPDATE okrs SET set_at = approved_at WHERE set_at IS NULL AND approved_at IS NOT NULL;
UPDATE okrs SET manager_summary = supervisor_notes WHERE manager_summary IS NULL AND supervisor_notes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_okrs_employee_status ON okrs(employee_id, status);

-- 3. comments -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS okr_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id uuid NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_okr_comments_okr ON okr_comments(okr_id, created_at);
ALTER TABLE okr_comments ENABLE ROW LEVEL SECURITY;

-- 4. progress is computed, not typed ----------------------------------------------

CREATE OR REPLACE FUNCTION recompute_okr_progress(p_okr uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE okrs o SET overall_progress = COALESCE((
    SELECT round(sum(kr.progress_percentage * GREATEST(kr.weight, 0))::numeric / NULLIF(sum(GREATEST(kr.weight, 0)), 0))
    FROM key_results kr WHERE kr.okr_id = p_okr
  ), 0)
  WHERE o.id = p_okr;
$$;

CREATE OR REPLACE FUNCTION trg_key_result_progress()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'DELETE' THEN
    IF NEW.target_value IS NOT NULL AND NEW.target_value <> 0 THEN
      NEW.progress_percentage := LEAST(100, GREATEST(0, round(100 * COALESCE(NEW.current_value, 0) / NEW.target_value)));
    END IF;
    NEW.status := CASE
      WHEN NEW.progress_percentage >= 100 THEN 'completed'
      WHEN NEW.progress_percentage = 0 THEN 'not_started'
      WHEN NEW.status = 'at_risk' THEN 'at_risk'
      ELSE 'on_track' END;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_key_results_progress ON key_results;
CREATE TRIGGER trg_key_results_progress
  BEFORE INSERT OR UPDATE OF current_value, target_value, progress_percentage, weight ON key_results
  FOR EACH ROW EXECUTE FUNCTION trg_key_result_progress();

CREATE OR REPLACE FUNCTION trg_key_result_rollup()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM recompute_okr_progress(COALESCE(NEW.okr_id, OLD.okr_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_key_results_rollup ON key_results;
CREATE TRIGGER trg_key_results_rollup
  AFTER INSERT OR UPDATE OR DELETE ON key_results
  FOR EACH ROW EXECUTE FUNCTION trg_key_result_rollup();

-- 5. who may manage whose OKRs -----------------------------------------------------

-- The employee's reporting manager, or HR / admin in the same organisation.
CREATE OR REPLACE FUNCTION can_manage_okrs_for(p_employee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees emp JOIN employees mgr ON mgr.id = emp.reporting_manager_id
    WHERE emp.id = p_employee AND mgr.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM employees emp JOIN user_profiles p ON p.organization_id = emp.organization_id
    WHERE emp.id = p_employee AND p.id = auth.uid() AND p.role IN ('admin', 'hr', 'platform_admin')
  );
$$;
GRANT EXECUTE ON FUNCTION can_manage_okrs_for(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION is_own_employee(p_employee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM employees e WHERE e.id = p_employee AND e.user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION is_own_employee(uuid) TO authenticated;

-- 6. policies ----------------------------------------------------------------

DROP POLICY IF EXISTS "Employees view own OKRs" ON okrs;
DROP POLICY IF EXISTS "Employees create OKRs" ON okrs;
DROP POLICY IF EXISTS "Employees update own draft OKRs" ON okrs;
DROP POLICY IF EXISTS "Employees delete own draft OKRs" ON okrs;
DROP POLICY IF EXISTS "Supervisors view direct report OKRs" ON okrs;
DROP POLICY IF EXISTS "Supervisors update direct report OKRs" ON okrs;
DROP POLICY IF EXISTS "HR and Admin view all OKRs" ON okrs;
DROP POLICY IF EXISTS "Employees and managers can manage OKRs" ON okrs;
DROP POLICY IF EXISTS "Employees can view their own OKRs" ON okrs;

-- Employee: sees own OKRs once set (or legacy rows they wrote themselves).
CREATE POLICY okrs_employee_select ON okrs FOR SELECT TO authenticated
  USING (is_own_employee(employee_id) AND (status <> 'draft' OR set_by IS NULL));

-- Manager / HR / admin: full control over their people's OKRs, except that a locked OKR
-- can only have its lock undone by HR/admin (handled in the app; data stays writable to them).
CREATE POLICY okrs_manager_all ON okrs FOR ALL TO authenticated
  USING (can_manage_okrs_for(employee_id))
  WITH CHECK (can_manage_okrs_for(employee_id));

-- Key results follow the OKR.
DROP POLICY IF EXISTS "View key results for accessible OKRs" ON key_results;
DROP POLICY IF EXISTS "Employees insert key results on draft OKRs" ON key_results;
DROP POLICY IF EXISTS "Employees update key results on draft OKRs" ON key_results;
DROP POLICY IF EXISTS "Employees delete key results on draft OKRs" ON key_results;
DROP POLICY IF EXISTS "Supervisors update key results on submitted approved OKRs" ON key_results;
DROP POLICY IF EXISTS "Users can view their own key results" ON key_results;
DROP POLICY IF EXISTS "Users can manage their own key results" ON key_results;

CREATE POLICY key_results_select ON key_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM okrs o WHERE o.id = key_results.okr_id)); -- okrs policy decides
CREATE POLICY key_results_manager_all ON key_results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM okrs o WHERE o.id = key_results.okr_id AND can_manage_okrs_for(o.employee_id) AND o.status <> 'locked'))
  WITH CHECK (EXISTS (SELECT 1 FROM okrs o WHERE o.id = key_results.okr_id AND can_manage_okrs_for(o.employee_id) AND o.status <> 'locked'));

-- Comments: anyone who can see the OKR can read them; the employee and the managers
-- can add them while the OKR is set (not draft, not locked).
CREATE POLICY okr_comments_select ON okr_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM okrs o WHERE o.id = okr_comments.okr_id));
CREATE POLICY okr_comments_insert ON okr_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM okrs o WHERE o.id = okr_comments.okr_id AND o.status = 'set'
                AND (is_own_employee(o.employee_id) OR can_manage_okrs_for(o.employee_id)))
  );
CREATE POLICY okr_comments_delete_own ON okr_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON okr_comments TO authenticated;

-- Legacy review comments stay readable through the same rule.
DROP POLICY IF EXISTS "Employees view review comments on own OKRs" ON okr_review_comments;
DROP POLICY IF EXISTS "Supervisors view review comments for direct reports" ON okr_review_comments;
DROP POLICY IF EXISTS "Supervisors insert review comments for direct reports" ON okr_review_comments;
DROP POLICY IF EXISTS "HR and Admin view all review comments" ON okr_review_comments;
CREATE POLICY okr_review_comments_select ON okr_review_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM okrs o WHERE o.id = okr_review_comments.okr_id));
