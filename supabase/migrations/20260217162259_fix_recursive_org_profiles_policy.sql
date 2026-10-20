/*
  # Fix Recursive Organization Profiles Policy

  ## Description
  Removes the recursive policy that queries user_profiles within user_profiles.
  Keeps only the essential non-recursive policies.

  ## Changes
  - Drop the problematic "Users can view org profiles" policy
  - This policy was causing infinite recursion by querying user_profiles within a user_profiles policy
  - Users can still view their own profile with the existing policy
  - Organization-wide viewing can be implemented at the application layer if needed
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view org profiles" ON user_profiles;

-- The remaining policies are sufficient and non-recursive:
-- 1. "Users can view own profile" - allows users to see their own profile
-- 2. "Users can update own profile" - allows users to update their profile
-- 3. "Authenticated users can insert profile" - allows signup