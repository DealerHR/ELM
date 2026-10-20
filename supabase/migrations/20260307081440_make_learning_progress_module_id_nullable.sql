/*
  # Make learning_progress.module_id nullable

  ## Summary
  The module_id column was NOT NULL, but course-level progress records (tracking
  overall course start/completion) need module_id = null. Module-level records
  use a non-null module_id. This migration drops the NOT NULL constraint.

  ## Changes
  - `learning_progress.module_id`: Remove NOT NULL constraint (allow null)
*/

ALTER TABLE learning_progress ALTER COLUMN module_id DROP NOT NULL;
