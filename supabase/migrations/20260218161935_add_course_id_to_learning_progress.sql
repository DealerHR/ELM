/*
  # Add course_id and status to learning_progress

  The learning_progress table was designed for module-level tracking but the
  induction workflow needs to track progress at the course level too.

  ## Changes
  - Add course_id column (nullable FK to learning_courses)
  - Add status column with check constraint (mirrors assignment status values)
  - Add index on course_id for fast lookups
*/

ALTER TABLE learning_progress
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES learning_courses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_progress' CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue'));

CREATE INDEX IF NOT EXISTS idx_learning_progress_course ON learning_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_assignment ON learning_progress(assignment_id);
