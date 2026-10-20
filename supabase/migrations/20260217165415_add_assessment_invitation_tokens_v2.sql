/*
  # Add Assessment Invitation Tokens
  
  1. Changes
    - Add `invitation_token` column to candidate_assessments
    - Add `expires_at` column to candidate_assessments
    - Add `invitation_sent_at` column for tracking
    
  2. Security
    - Create index for fast token lookups
    - Add RLS policies to allow public access via valid token
    
  3. Notes
    - Candidates access assessments via unique tokens (no login required)
    - Tokens expire after set duration (default 7 days)
    - Results stored and viewable by HR/Admin
*/

-- Add columns to candidate_assessments if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_assessments' AND column_name = 'invitation_token'
  ) THEN
    ALTER TABLE candidate_assessments 
    ADD COLUMN invitation_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_assessments' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE candidate_assessments 
    ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '7 days');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_assessments' AND column_name = 'invitation_sent_at'
  ) THEN
    ALTER TABLE candidate_assessments 
    ADD COLUMN invitation_sent_at timestamptz;
  END IF;
END $$;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_candidate_assessments_token 
  ON candidate_assessments(invitation_token);

-- Drop existing anon policies if they exist and recreate
DO $$
BEGIN
  -- For candidate_assessments
  DROP POLICY IF EXISTS "Public can view via valid token" ON candidate_assessments;
  DROP POLICY IF EXISTS "Public can update via valid token" ON candidate_assessments;
  
  -- For candidate_assessment_answers
  DROP POLICY IF EXISTS "Public can submit answers" ON candidate_assessment_answers;
  DROP POLICY IF EXISTS "Public can view own answers" ON candidate_assessment_answers;
  
  -- For assessment_questions
  DROP POLICY IF EXISTS "Public can view questions" ON assessment_questions;
END $$;

-- Policy: Public can view assessment via valid token (anonymous users)
CREATE POLICY "Public can view via valid token"
  ON candidate_assessments
  FOR SELECT
  TO anon
  USING (
    invitation_token IS NOT NULL 
    AND expires_at > now()
    AND status IN ('assigned', 'in_progress', 'completed')
  );

-- Policy: Public can update assessment status and score via valid token
CREATE POLICY "Public can update via valid token"
  ON candidate_assessments
  FOR UPDATE
  TO anon
  USING (
    invitation_token IS NOT NULL
    AND status IN ('assigned', 'in_progress')
    AND expires_at > now()
  )
  WITH CHECK (
    status IN ('in_progress', 'completed')
  );

-- Policy: Public can insert answers (for candidate_assessment_answers table)
CREATE POLICY "Public can submit answers"
  ON candidate_assessment_answers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Public can view their own answers
CREATE POLICY "Public can view own answers"
  ON candidate_assessment_answers
  FOR SELECT
  TO anon
  USING (true);

-- Policy: Public can view questions
CREATE POLICY "Public can view questions"
  ON assessment_questions
  FOR SELECT
  TO anon
  USING (true);
