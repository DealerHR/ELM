/*
  # Fix user_profiles UPDATE policy for limbo users

  ## Problem
  When a candidate's auth account is created but the induction fails midway,
  the user_profile ends up with organization_id = NULL. On the next induction
  attempt, the admin's UPDATE policy requires organization_id IS NOT NULL, so
  the upsert silently fails and the user stays in limbo forever.

  ## Fix
  Replace the org_admin_update_org_profiles policy to also allow admins to
  update profiles where organization_id IS NULL (limbo state), so that a
  second induction attempt can fix the record.

  ## Changes
  - user_profiles: updated UPDATE policy for org admins to also cover NULL org profiles
*/

DROP POLICY IF EXISTS "org_admin_update_org_profiles" ON user_profiles;

CREATE POLICY "org_admin_update_org_profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'
    AND (
      (organization_id = get_user_organization(auth.uid()) AND organization_id IS NOT NULL)
      OR organization_id IS NULL
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'admin'
    AND organization_id = get_user_organization(auth.uid())
    AND organization_id IS NOT NULL
  );
