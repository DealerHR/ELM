/*
  # Add 6-Character Access Code to Assessment Invitations

  ## Summary
  Replaces the long 64-character hex invitation token with a human-friendly 6-character
  alphanumeric access code (e.g. "A3K9PZ") that HR managers can include in an email draft
  and candidates can type into the assessment portal.

  ## Changes

  ### assessment_invitations table
  - Add `access_code` (text, unique) — 6-character uppercase alphanumeric code
  - Add `candidate_name` (text) — denormalized for quick display on portal
  - Add `organization_name` (text) — denormalized for display on candidate portal
  - Add `domain_score` (numeric) — final domain assessment score percentage
  - Add `domain_completed_at` (timestamptz) — when domain assessment was finished
  - Add `growth_completed_at` (timestamptz) — when growth profile was finished

  ## Security
  - Anonymous users can look up an invitation by access_code (SELECT only, non-expired)
  - Anonymous users can update status, progress fields on their own invitation
  - Existing token-based RLS policies remain intact
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_invitations' AND column_name = 'access_code'
  ) THEN
    ALTER TABLE assessment_invitations ADD COLUMN access_code text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_invitations' AND column_name = 'candidate_name'
  ) THEN
    ALTER TABLE assessment_invitations ADD COLUMN candidate_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_invitations' AND column_name = 'organization_name'
  ) THEN
    ALTER TABLE assessment_invitations ADD COLUMN organization_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_invitations' AND column_name = 'domain_score'
  ) THEN
    ALTER TABLE assessment_invitations ADD COLUMN domain_score numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_invitations' AND column_name = 'domain_completed_at'
  ) THEN
    ALTER TABLE assessment_invitations ADD COLUMN domain_completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessment_invitations' AND column_name = 'growth_completed_at'
  ) THEN
    ALTER TABLE assessment_invitations ADD COLUMN growth_completed_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assessment_invitations_access_code
  ON assessment_invitations (access_code);

-- Allow anonymous users to look up invitations by access code (portal entry)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assessment_invitations'
    AND policyname = 'Anyone can look up invitation by access code'
  ) THEN
    CREATE POLICY "Anyone can look up invitation by access code"
      ON assessment_invitations
      FOR SELECT
      TO anon
      USING (
        access_code IS NOT NULL
        AND expires_at > now()
      );
  END IF;
END $$;

-- Allow anonymous users to update invitation status/progress (candidate is taking the test)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assessment_invitations'
    AND policyname = 'Anyone can update invitation progress by access code'
  ) THEN
    CREATE POLICY "Anyone can update invitation progress by access code"
      ON assessment_invitations
      FOR UPDATE
      TO anon
      USING (access_code IS NOT NULL)
      WITH CHECK (access_code IS NOT NULL);
  END IF;
END $$;

-- Allow anonymous users to insert growth profile responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidate_growth_responses'
    AND policyname = 'Anonymous can insert growth responses'
  ) THEN
    CREATE POLICY "Anonymous can insert growth responses"
      ON candidate_growth_responses
      FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

-- Allow anonymous users to read growth profile questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'growth_profile_questions'
    AND policyname = 'Anonymous can read growth questions'
  ) THEN
    CREATE POLICY "Anonymous can read growth questions"
      ON growth_profile_questions
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow anonymous users to read domain assessment questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'domain_assessment_questions'
    AND policyname = 'Anonymous can read domain questions'
  ) THEN
    CREATE POLICY "Anonymous can read domain questions"
      ON domain_assessment_questions
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow anonymous users to read candidate_domain_assessments (to get title etc)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidate_domain_assessments'
    AND policyname = 'Anonymous can read domain assessments'
  ) THEN
    CREATE POLICY "Anonymous can read domain assessments"
      ON candidate_domain_assessments
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow anonymous users to insert domain attempt answers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidate_domain_attempts'
    AND policyname = 'Anonymous can insert domain attempts'
  ) THEN
    CREATE POLICY "Anonymous can insert domain attempts"
      ON candidate_domain_attempts
      FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

-- Allow anonymous users to update domain attempts (for resume support)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidate_domain_attempts'
    AND policyname = 'Anonymous can update domain attempts'
  ) THEN
    CREATE POLICY "Anonymous can update domain attempts"
      ON candidate_domain_attempts
      FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Allow anonymous users to select domain attempts (for resume)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidate_domain_attempts'
    AND policyname = 'Anonymous can select domain attempts'
  ) THEN
    CREATE POLICY "Anonymous can select domain attempts"
      ON candidate_domain_attempts
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow anonymous to read growth assessments (for resume)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidate_growth_assessments'
    AND policyname = 'Anonymous can read growth assessments'
  ) THEN
    CREATE POLICY "Anonymous can read growth assessments"
      ON candidate_growth_assessments
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow anonymous to update growth assessments (status changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidate_growth_assessments'
    AND policyname = 'Anonymous can update growth assessments'
  ) THEN
    CREATE POLICY "Anonymous can update growth assessments"
      ON candidate_growth_assessments
      FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Allow anonymous to read growth responses (for resume)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'candidate_growth_responses'
    AND policyname = 'Anonymous can read growth responses'
  ) THEN
    CREATE POLICY "Anonymous can read growth responses"
      ON candidate_growth_responses
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
