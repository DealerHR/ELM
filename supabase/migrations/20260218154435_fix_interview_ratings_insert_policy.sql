/*
  # Fix Interview Ratings INSERT Policy

  The INSERT policy was checking for role names ('hr_manager', 'org_admin') that don't
  match the actual role values in user_profiles ('hr', 'admin', 'manager', 'platform_admin').

  This migration drops and recreates the INSERT policy with the correct role names.
*/

DROP POLICY IF EXISTS "HR managers and admins can insert interview ratings" ON candidate_interview_ratings;

CREATE POLICY "HR managers and admins can insert interview ratings"
  ON candidate_interview_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    rated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = candidate_interview_ratings.organization_id
      AND user_profiles.role IN ('hr', 'admin', 'manager', 'platform_admin')
    )
  );
