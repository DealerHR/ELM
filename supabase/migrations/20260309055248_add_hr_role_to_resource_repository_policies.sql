/*
  # Add HR role to resource_repository RLS policies

  ## Changes
  - Updates the "Admins and L&D Managers can manage resources" ALL policy to also include 'hr' role
  - Updates the "LD and admins can update resources" UPDATE policy to also include 'hr' role
  - Updates the "Users can view accessible resources" SELECT policy so 'hr' can also view all resources

  This allows HR managers to upload, edit, delete, and view all repository content,
  consistent with their admin-level access to the repository feature.
*/

DROP POLICY IF EXISTS "Admins and L&D Managers can manage resources" ON resource_repository;
DROP POLICY IF EXISTS "LD and admins can update resources" ON resource_repository;
DROP POLICY IF EXISTS "Users can view accessible resources" ON resource_repository;

CREATE POLICY "Admins and L&D Managers can manage resources"
  ON resource_repository
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['admin', 'l_d_manager', 'hr'])
        AND user_profiles.organization_id = resource_repository.organization_id
    )
  );

CREATE POLICY "LD and admins can update resources"
  ON resource_repository
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['admin', 'l_d_manager', 'hr'])
        AND user_profiles.organization_id = resource_repository.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['admin', 'l_d_manager', 'hr'])
        AND user_profiles.organization_id = resource_repository.organization_id
    )
  );

CREATE POLICY "Users can view accessible resources"
  ON resource_repository
  FOR SELECT
  TO authenticated
  USING (
    access_level = 'all'
    OR (
      access_level = 'department'
      AND EXISTS (
        SELECT 1 FROM employees e
        JOIN user_profiles up ON e.user_id = up.id
        WHERE up.id = auth.uid()
          AND e.department_id = ANY (resource_repository.department_ids)
      )
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = ANY (ARRAY['admin', 'l_d_manager', 'hr'])
    )
  );
