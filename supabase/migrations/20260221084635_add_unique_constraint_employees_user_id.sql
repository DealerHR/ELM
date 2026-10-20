/*
  # Add unique constraint on employees.user_id

  ## Summary
  Adds a unique constraint on the user_id column of the employees table so that
  upsert operations (onConflict: 'user_id') work correctly during candidate
  induction. Without this constraint, upsert silently fails and no employee
  record is created.

  ## Changes
  - employees: add UNIQUE constraint on user_id column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'employees'::regclass AND conname = 'employees_user_id_key'
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_user_id_key UNIQUE (user_id);
  END IF;
END $$;
