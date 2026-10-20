/*
  # Add Job Description and Difficulty to Domain Assessments

  ## Summary
  Extends the assessment builder with AI-generation support fields.

  ## Changes

  ### Modified Tables
  - `candidate_domain_assessments`
    - `job_description` (text, nullable): Stores the raw JD/job profile text uploaded by HR for AI question generation
    - `ai_generated` (boolean, default false): Tracks whether this assessment was built with AI assistance

  ### Modified Tables
  - `domain_assessment_questions`
    - `difficulty` (text, nullable): Stores difficulty level (easy/medium/hard) for each question
    - `explanation` (text, nullable): Stores the AI-generated explanation for the correct answer

  ## Notes
  - All new columns are nullable or have safe defaults so existing data is unaffected
  - No data is lost; this is a purely additive migration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_domain_assessments' AND column_name = 'job_description'
  ) THEN
    ALTER TABLE candidate_domain_assessments ADD COLUMN job_description text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_domain_assessments' AND column_name = 'ai_generated'
  ) THEN
    ALTER TABLE candidate_domain_assessments ADD COLUMN ai_generated boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_assessment_questions' AND column_name = 'difficulty'
  ) THEN
    ALTER TABLE domain_assessment_questions ADD COLUMN difficulty text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'domain_assessment_questions' AND column_name = 'explanation'
  ) THEN
    ALTER TABLE domain_assessment_questions ADD COLUMN explanation text;
  END IF;
END $$;
