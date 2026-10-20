/*
  # Fix recursive RLS on user_profiles

  ## Problem
  get_user_role() queries user_profiles, but user_profiles has RLS policies
  that call get_user_role(). This creates infinite recursion causing the app
  to hang indefinitely on load.

  ## Fix
  Recreate get_user_role() and get_user_organization() as SECURITY DEFINER
  functions so they bypass RLS when reading the role/org, breaking the cycle.
*/

CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_user_organization(user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM user_profiles WHERE id = user_id LIMIT 1;
$$;
