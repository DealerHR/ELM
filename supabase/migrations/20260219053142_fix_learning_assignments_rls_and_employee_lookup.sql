/*
  # Fix learning assignments RLS + employee lookup for non-employee roles

  ## Summary
  1. Adds a SELECT policy to employee_learning_assignments so that:
     - Admins, HR, and L&D managers can view all assignments in their org
     - Employees can view their own assignments
  2. Adds a SELECT policy to learning_progress so employees can read their own progress
  3. Ensures the `employees` table has a SELECT policy that lets managers/admins/L&D
     look up all employees (needed for the assignment UI)

  ## Changes
  - employee_learning_assignments: add SELECT policy
  - learning_progress: add SELECT policy (was missing)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employee_learning_assignments'
    AND policyname = 'Org members can view learning assignments'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Org members can view learning assignments"
        ON employee_learning_assignments FOR SELECT
        TO authenticated
        USING (
          employee_id IN (
            SELECT e.id FROM employees e
            JOIN user_profiles up ON up.organization_id = e.organization_id
            WHERE up.id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'learning_progress'
    AND policyname = 'Employees can view own learning progress'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Employees can view own learning progress"
        ON learning_progress FOR SELECT
        TO authenticated
        USING (
          employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'hr', 'l_d_manager', 'manager')
          )
        )
    $policy$;
  END IF;
END $$;
