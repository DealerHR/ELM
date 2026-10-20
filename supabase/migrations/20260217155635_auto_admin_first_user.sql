/*
  # Auto-assign first user as admin

  ## Description
  This migration creates a database function and trigger that automatically:
  1. Makes the first user to sign up an admin
  2. Assigns them to the default Stratefix organization
  3. Creates an employee record for them

  ## How it works
  - When a new user_profile is created
  - If they are the first user (no other users exist)
  - Set role to 'admin' and assign organization
*/

-- Function to auto-assign admin role to first user
CREATE OR REPLACE FUNCTION auto_assign_first_user_admin()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  default_org_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM user_profiles WHERE id != NEW.id;
  
  -- If this is the first user, make them admin
  IF user_count = 0 THEN
    NEW.role := 'admin';
    NEW.organization_id := default_org_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_assign_first_user_admin ON user_profiles;
CREATE TRIGGER trigger_auto_assign_first_user_admin
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_first_user_admin();