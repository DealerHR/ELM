/*
  # Add Platform Admin Role and Update RLS Policies

  ## Changes
  1. **Role Enhancement**
    - Update user_profiles role constraint to include 'platform_admin'
    - Platform admin can manage organizations across the platform
    - Organizational admin (role='admin') manages only their organization
  
  2. **Update Existing Platform Admin**
    - Change info@learntechconsulting.in to platform_admin role
  
  3. **RLS Policy Updates**
    - Platform admins can see all organizations
    - Organizational admins restricted to their organization
  
  ## Security
  - Existing RLS policies updated to differentiate platform_admin from admin
  - Platform admin has cross-organization visibility
  - Organizational admin scoped to their organization only
*/

-- Drop existing role constraint and add platform_admin
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles 
  ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('platform_admin', 'admin', 'hr', 'l_d_manager', 'manager', 'employee'));

-- Update existing platform admin user
UPDATE user_profiles 
SET role = 'platform_admin'
WHERE email = 'info@learntechconsulting.in';

-- Update RLS policies to handle platform_admin

-- Drop and recreate organizations policies
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Admins can manage organizations" ON organizations;

CREATE POLICY "Platform admins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Platform admins can manage all organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Update user profiles policy to allow platform admins
DROP POLICY IF EXISTS "Admins can manage all user profiles in their organization" ON user_profiles;

CREATE POLICY "Admins can manage user profiles in their organization"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    -- Platform admin can manage all
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'platform_admin'
    )
    OR
    -- Organizational admin can manage users in their org
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() 
      AND up.role = 'admin'
      AND up.organization_id = user_profiles.organization_id
    )
  );

-- Allow users in same organization to view each other's profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;

CREATE POLICY "Users can view profiles in their organization"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    -- User can view their own profile
    id = auth.uid()
    OR
    -- Platform admin can view all
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'platform_admin'
    )
    OR
    -- Users in same organization can view each other
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own profile only"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
