/*
  # Backfill domain_attempt_id on assessment_invitations

  ## Problem
  When candidates complete domain (knowledge) assessments, the `domain_attempt_id`
  column on `assessment_invitations` is sometimes left null even though an attempt
  record exists in `candidate_domain_attempts`. This prevents the admin portal from
  loading the question-wise breakdown for those candidates.

  ## Fix
  For completed invitations where `domain_attempt_id` is null but a matching
  candidate domain attempt exists, link the attempt to the invitation by setting
  `domain_attempt_id`.

  The match is done on `candidate_id` — taking the most recent attempt per candidate
  to avoid ambiguity.
*/

UPDATE assessment_invitations ai
SET domain_attempt_id = latest.id
FROM (
  SELECT DISTINCT ON (candidate_id) id, candidate_id
  FROM candidate_domain_attempts
  ORDER BY candidate_id, created_at DESC
) latest
WHERE ai.candidate_id = latest.candidate_id
  AND ai.domain_attempt_id IS NULL
  AND ai.include_domain_assessment = true
  AND ai.status = 'completed';
