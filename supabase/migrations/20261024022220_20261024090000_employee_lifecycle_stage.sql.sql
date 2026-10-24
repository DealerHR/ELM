/*
  # Employee lifecycle stage (Phase 1 of the product plan)

  Purely additive. Nothing is dropped or renamed; existing columns keep their
  values and the app keeps working with or without this migration applied.

  1. employees.lifecycle_stage
     joining → induction → active → exiting → exited
     - Backfilled from the old `status` column, date_of_joining and any open
       induction journey. `status` stays as it is.
     - Kept in step automatically: an induction journey that completes moves
       the employee from `induction` to `active`; a new journey moves an
       `active`/`joining` employee into `induction`.

  2. employees.candidate_id — which hire this employee came from. Backfilled by
     matching the candidate's email in the same organisation.

  3. organizations.settings jsonb — per-tenant options (default '{}').

  4. RPC employees_lifecycle_counts(org) for the People screen's stage filter.
*/

-- 1. lifecycle_stage ----------------------------------------------------------

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS lifecycle_stage text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_lifecycle_stage_check') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_lifecycle_stage_check
      CHECK (lifecycle_stage IN ('joining', 'induction', 'active', 'exiting', 'exited'));
  END IF;
END $$;

-- Backfill from what we already know about each employee.
UPDATE employees e
SET lifecycle_stage = CASE
  WHEN e.status IN ('resigned', 'terminated') THEN 'exited'
  WHEN e.status = 'notice_period' THEN 'exiting'
  WHEN EXISTS (SELECT 1 FROM induction_journeys j WHERE j.employee_id = e.id AND j.status IN ('not_started', 'in_progress', 'extended')) THEN 'induction'
  WHEN e.date_of_joining > CURRENT_DATE THEN 'joining'
  ELSE 'active'
END
WHERE e.lifecycle_stage IS NULL;

-- No column default on purpose: the BEFORE INSERT trigger below works the stage
-- out from status and date_of_joining whenever a row arrives without one.
ALTER TABLE employees ALTER COLUMN lifecycle_stage SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_org_stage ON employees(organization_id, lifecycle_stage);

-- Keep the old status column and the new stage from contradicting each other
-- when either is written by the existing screens.
CREATE OR REPLACE FUNCTION sync_employee_lifecycle_from_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('resigned', 'terminated') THEN NEW.lifecycle_stage := 'exited';
    ELSIF NEW.status = 'notice_period' THEN NEW.lifecycle_stage := 'exiting';
    ELSIF NEW.status IN ('active', 'on_leave') AND OLD.lifecycle_stage IN ('exiting', 'exited') THEN NEW.lifecycle_stage := 'active';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.lifecycle_stage IS NULL THEN
    NEW.lifecycle_stage := CASE
      WHEN NEW.status IN ('resigned', 'terminated') THEN 'exited'
      WHEN NEW.status = 'notice_period' THEN 'exiting'
      WHEN NEW.date_of_joining > CURRENT_DATE THEN 'joining'
      ELSE 'active' END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_employee_lifecycle_from_status ON employees;
CREATE TRIGGER trg_sync_employee_lifecycle_from_status
  BEFORE INSERT OR UPDATE OF status ON employees
  FOR EACH ROW EXECUTE FUNCTION sync_employee_lifecycle_from_status();

-- An induction journey opening or closing moves the employee between stages.
CREATE OR REPLACE FUNCTION sync_employee_lifecycle_from_induction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('not_started', 'in_progress', 'extended') THEN
    UPDATE employees SET lifecycle_stage = 'induction'
      WHERE id = NEW.employee_id AND lifecycle_stage IN ('joining', 'active');
  ELSIF NEW.status = 'completed' THEN
    UPDATE employees SET lifecycle_stage = 'active'
      WHERE id = NEW.employee_id AND lifecycle_stage = 'induction';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_employee_lifecycle_from_induction ON induction_journeys;
CREATE TRIGGER trg_sync_employee_lifecycle_from_induction
  AFTER INSERT OR UPDATE OF status ON induction_journeys
  FOR EACH ROW EXECUTE FUNCTION sync_employee_lifecycle_from_induction();

-- 2. candidate_id --------------------------------------------------------------

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES candidates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_candidate ON employees(candidate_id);

UPDATE employees e
SET candidate_id = c.id
FROM user_profiles p, candidates c
WHERE e.candidate_id IS NULL
  AND p.id = e.user_id
  AND c.organization_id = e.organization_id
  AND lower(c.email) = lower(p.email)
  AND c.status IN ('joined', 'offer_accepted');

-- 3. organisation settings -----------------------------------------------------

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. stage counts for the People screen ---------------------------------------

CREATE OR REPLACE FUNCTION employees_lifecycle_counts(p_org uuid)
RETURNS TABLE (lifecycle_stage text, n bigint)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT lifecycle_stage, count(*) FROM employees
  WHERE organization_id = p_org
  GROUP BY lifecycle_stage;
$$;

GRANT EXECUTE ON FUNCTION employees_lifecycle_counts(uuid) TO authenticated;
