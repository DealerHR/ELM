/*
  # Fix User Profiles RLS Infinite Recursion - Complete Rebuild

  ## Problem
  - Multiple RLS policies on user_profiles were checking user_profiles table
  - This created infinite recursion when trying to access user profiles
  
  ## Solution
  - Drop ALL existing policies
  - Create helper functions with SECURITY DEFINER to bypass RLS
  - Create new simplified policies without recursion
  
  ## Changes
  1. Drop all existing user_profiles policies
  2. Create helper functions to get user role and organization
  3. Create new policies that use helper functions
*/

-- Drop ALL existing user_profiles policies
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile only" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage user profiles in their organization" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profile" ON user_profiles;

-- Create helper functions with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM user_profiles WHERE id = user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id FROM user_profiles WHERE id = user_id LIMIT 1;
$$;

-- Policy 1: Users can view their own profile
CREATE POLICY "view_own_profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Platform admins can view all profiles
CREATE POLICY "platform_admin_view_all"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'platform_admin');

-- Policy 3: Users can view profiles in same organization
CREATE POLICY "view_same_org_profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization(auth.uid())
    AND organization_id IS NOT NULL
  );

-- Policy 4: Users can update their own profile
CREATE POLICY "update_own_profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 5: New users can insert their profile on signup
CREATE POLICY "insert_own_profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Policy 6: Platform admins can manage all profiles
CREATE POLICY "platform_admin_manage_all"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'platform_admin');

CREATE POLICY "platform_admin_update_all"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'platform_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'platform_admin');

CREATE POLICY "platform_admin_delete_all"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'platform_admin');

-- Policy 7: Org admins can manage profiles in their organization
CREATE POLICY "org_admin_manage_org_profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = 'admin'
    AND organization_id = get_user_organization(auth.uid())
    AND organization_id IS NOT NULL
  );

CREATE POLICY "org_admin_update_org_profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'
    AND organization_id = get_user_organization(auth.uid())
    AND organization_id IS NOT NULL
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'admin'
    AND organization_id = get_user_organization(auth.uid())
    AND organization_id IS NOT NULL
  );

CREATE POLICY "org_admin_delete_org_profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'
    AND organization_id = get_user_organization(auth.uid())
    AND organization_id IS NOT NULL
  );
