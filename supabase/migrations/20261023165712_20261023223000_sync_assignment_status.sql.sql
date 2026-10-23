/*
  # Keep employee_learning_assignments.status in step with real progress

  The dashboards count assignments by status, but nothing moved an assignment
  from 'assigned' to 'in_progress' when a learner started a course or a module.
  Learners with real progress therefore showed as 0 in progress everywhere.

  This trigger flips the assignment to 'in_progress' as soon as any progress
  row is written for it, and never touches assignments that are already
  completed. A one-off backfill fixes existing data.
*/

CREATE OR REPLACE FUNCTION public.sync_assignment_status_from_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignment_id IS NOT NULL THEN
    UPDATE employee_learning_assignments
    SET status = 'in_progress'
    WHERE id = NEW.assignment_id
      AND status = 'assigned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_assignment_status ON learning_progress;
CREATE TRIGGER sync_assignment_status
  AFTER INSERT OR UPDATE ON learning_progress
  FOR EACH ROW EXECUTE FUNCTION public.sync_assignment_status_from_progress();

-- Quiz answers also mean the learner has started.
DROP TRIGGER IF EXISTS sync_assignment_status_quiz ON module_quiz_responses;
CREATE TRIGGER sync_assignment_status_quiz
  AFTER INSERT ON module_quiz_responses
  FOR EACH ROW EXECUTE FUNCTION public.sync_assignment_status_from_progress();

-- Backfill: anything with progress recorded but still marked 'assigned'.
UPDATE employee_learning_assignments a
SET status = 'in_progress'
WHERE a.status = 'assigned'
  AND (
    EXISTS (SELECT 1 FROM learning_progress p WHERE p.assignment_id = a.id)
    OR EXISTS (SELECT 1 FROM module_quiz_responses q WHERE q.assignment_id = a.id)
  );
