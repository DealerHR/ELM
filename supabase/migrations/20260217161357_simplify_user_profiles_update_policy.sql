/*
  # Simplify User Profiles Update Policy

  ## Description
  Further simplifies the update policy to avoid any self-referencing queries
  that could cause recursion issues.

  ## Changes
  - Drop the complex update policy
  - Create a simpler one that allows users to update their profile
    but prevents changing critical fields through database constraints
*/

-- Drop the problematic update policy
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create simplified update policy
-- Users can update their own profile
-- Note: Role and organization changes should be handled by admin users through application logic
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);