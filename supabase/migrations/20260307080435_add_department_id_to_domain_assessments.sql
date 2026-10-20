/*
  # Add department_id to candidate_domain_assessments

  ## Summary
  Adds a department reference to knowledge assessments so they can be linked to a department
  (in addition to the existing designation link). This enables filtering assessments by both
  department and designation when selecting which assessment to send to a candidate.

  ## Changes
  - `candidate_domain_assessments`: Add `department_id` (uuid, nullable FK to departments)

  ## Notes
  - Existing rows are unaffected (column is nullable)
  - No RLS changes needed; existing policies cover this table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_domain_assessments'
    AND column_name = 'department_id'
  ) THEN
    ALTER TABLE candidate_domain_assessments
      ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;
