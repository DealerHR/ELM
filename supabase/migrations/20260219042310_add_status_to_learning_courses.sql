/*
  # Add status field to learning_courses

  ## Summary
  Adds a `status` column to `learning_courses` to support a proper course lifecycle:
  draft → published → archived.

  ## Changes
  - `learning_courses`: New `status` column with CHECK constraint
    - Allowed values: 'draft', 'published', 'archived'
    - Default: 'draft' — new courses are always created as drafts
  - All existing courses are migrated to 'published' status to preserve existing behaviour

  ## Notes
  - The old `is_active` boolean is kept for backwards compatibility but `status` is now the
    canonical lifecycle indicator
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learning_courses' AND column_name = 'status'
  ) THEN
    ALTER TABLE learning_courses
      ADD COLUMN status text NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'published', 'archived'));

    UPDATE learning_courses SET status = 'published' WHERE is_active = true;
    UPDATE learning_courses SET status = 'archived' WHERE is_active = false;
  END IF;
END $$;
