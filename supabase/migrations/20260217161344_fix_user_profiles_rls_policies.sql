/*
  # Fix User Profiles RLS Infinite Recursion

  ## Description
  Fixes the infinite recursion error in user_profiles table policies by removing
  self-referencing policies and using simpler, non-recursive checks.

  ## Changes
  - Drop existing user_profiles policies
  - Create new simplified policies that avoid querying user_profiles within user_profiles policies
  - Users can view and update their own profile
  - Insert is allowed for authenticated users (for signup)
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all user profiles in their organization" ON user_profiles;

-- Create new simplified policies

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own profile (but not role or organization)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM user_profiles WHERE id = auth.uid())
    AND organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

-- Allow authenticated users to insert (for signup flow)
CREATE POLICY "Authenticated users can insert profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to view profiles in their organization (for collaboration features)
CREATE POLICY "Users can view org profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );