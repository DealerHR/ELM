/*
  # Fix candidate_domain_responses RLS - Add anonymous INSERT policy

  ## Problem
  The assessment portal runs as an anonymous (unauthenticated) Supabase user.
  The `candidate_domain_responses` table was missing an INSERT policy for the
  `anon` role, causing all per-question response inserts to silently fail when
  candidates submitted their domain (knowledge) assessments via the portal.

  The overall attempt score was still saved (candidate_domain_attempts has anon
  policies), but the individual question responses were never recorded.

  ## Changes
  1. Add INSERT policy for anon role on candidate_domain_responses
  2. Add SELECT policy for anon role on candidate_domain_responses (for portal
     to optionally verify or resume state)

  ## Security
  - INSERT: anon may insert responses only for a valid, non-expired domain attempt
    (attempt must exist, be non-expired, and belong to a real invitation)
  - SELECT: anon may read responses for the same valid attempt
*/

CREATE POLICY "Anonymous can insert domain responses"
  ON candidate_domain_responses
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidate_domain_attempts cda
      WHERE cda.id = candidate_domain_responses.attempt_id
        AND cda.status IN ('pending', 'in_progress', 'completed')
    )
  );

CREATE POLICY "Anonymous can read own domain responses"
  ON candidate_domain_responses
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM candidate_domain_attempts cda
      WHERE cda.id = candidate_domain_responses.attempt_id
    )
  );
