/*
  # Fix learning_paths RLS policies

  ## Problem
  The learning_paths table has no INSERT/UPDATE/DELETE policies, causing 403 errors when
  admins or L&D managers try to create or modify learning paths.

  ## Changes
  1. Add SELECT policy for org members to view learning paths
  2. Add INSERT policy for admins and L&D managers
  3. Add UPDATE policy for admins and L&D managers
  4. Add DELETE policy for admins and L&D managers
*/

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view learning paths"
  ON learning_paths FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and LD managers can insert learning paths"
  ON learning_paths FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'hr', 'l_d_manager')
        AND organization_id = learning_paths.organization_id
    )
  );

CREATE POLICY "Admins and LD managers can update learning paths"
  ON learning_paths FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'hr', 'l_d_manager')
        AND organization_id = learning_paths.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'hr', 'l_d_manager')
        AND organization_id = learning_paths.organization_id
    )
  );

CREATE POLICY "Admins and LD managers can delete learning paths"
  ON learning_paths FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'l_d_manager')
        AND organization_id = learning_paths.organization_id
    )
  );
