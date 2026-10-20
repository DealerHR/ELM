/*
  # Add Recruitment Pipeline Fields

  ## Summary
  Extends the candidates and related tables to support the full HR recruitment pipeline workflow.

  ## Changes

  ### candidates table
  - Add `interview_date` (date) - scheduled interview date
  - Add `interview_score` (integer, 1-10) - HR/interviewer rating
  - Add `interview_notes` (text) - interviewer feedback and notes
  - Add `interviewed_by` (uuid) - FK to user_profiles
  - Add `hired_at` (timestamptz) - timestamp when candidate was marked as hired/joined
  - Add `applied_position_title` (text) - free-text position title (for cases where no designation exists)
  - Add `notes` (text) - general HR notes on the candidate

  ### assessment_invitations table
  - Add `message` (text) - custom message sent with the invitation

  ## Security
  - No new RLS policies needed; existing policies cover these new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'interview_date'
  ) THEN
    ALTER TABLE candidates ADD COLUMN interview_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'interview_score'
  ) THEN
    ALTER TABLE candidates ADD COLUMN interview_score integer CHECK (interview_score >= 1 AND interview_score <= 10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'interview_notes'
  ) THEN
    ALTER TABLE candidates ADD COLUMN interview_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'interviewed_by'
  ) THEN
    ALTER TABLE candidates ADD COLUMN interviewed_by uuid REFERENCES user_profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'hired_at'
  ) THEN
    ALTER TABLE candidates ADD COLUMN hired_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'applied_position_title'
  ) THEN
    ALTER TABLE candidates ADD COLUMN applied_position_title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'notes'
  ) THEN
    ALTER TABLE candidates ADD COLUMN notes text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_invitations' AND column_name = 'message'
  ) THEN
    ALTER TABLE assessment_invitations ADD COLUMN message text;
  END IF;
END $$;
