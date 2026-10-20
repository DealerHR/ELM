/*
  # Create Demo User Profiles Setup

  ## Changes
  1. **Setup Stratefix Organization**
    - Ensure Stratefix organization exists
    - Create demo department and designation
  
  2. **Prepare for Demo Users**
    - Creates function to setup user profile after auth user creation
    - Demo users will need to be created via Supabase Auth Dashboard
  
  ## Demo Users to Create (via Supabase Dashboard)
  - demo_admin@stratefix.com - Password: Demo@123
  - demo_hr@stratefix.com - Password: Demo@123
  - demo_ld@stratefix.com - Password: Demo@123
  - demo_manager@stratefix.com - Password: Demo@123
  - demo_employee@stratefix.com - Password: Demo@123
*/

-- Ensure Stratefix organization exists
INSERT INTO organizations (name, industry, size)
VALUES ('Stratefix', 'Consulting', 'Medium')
ON CONFLICT DO NOTHING;

-- Get organization ID and create department/designation
DO $$
DECLARE
  v_org_id uuid;
  v_dept_id uuid;
  v_designation_id uuid;
BEGIN
  -- Get Stratefix org
  SELECT id INTO v_org_id FROM organizations WHERE name = 'Stratefix' LIMIT 1;

  -- Create department if not exists
  INSERT INTO departments (organization_id, name, description)
  VALUES (v_org_id, 'General', 'General department for demo users')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_dept_id;

  -- If department already exists, get its ID
  IF v_dept_id IS NULL THEN
    SELECT id INTO v_dept_id FROM departments WHERE organization_id = v_org_id LIMIT 1;
  END IF;

  -- Create designation if not exists
  INSERT INTO designations (organization_id, title, level, department_id)
  VALUES (v_org_id, 'Staff', 'L1', v_dept_id)
  ON CONFLICT DO NOTHING;

END $$;

-- Create a function to handle demo user setup
CREATE OR REPLACE FUNCTION public.setup_demo_user_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_role text,
  p_employee_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_dept_id uuid;
  v_designation_id uuid;
BEGIN
  -- Get Stratefix organization
  SELECT id INTO v_org_id FROM organizations WHERE name = 'Stratefix' LIMIT 1;
  
  -- Get department
  SELECT id INTO v_dept_id FROM departments WHERE organization_id = v_org_id LIMIT 1;
  
  -- Get designation
  SELECT id INTO v_designation_id FROM designations WHERE organization_id = v_org_id LIMIT 1;

  -- Insert or update user profile
  INSERT INTO user_profiles (id, organization_id, email, full_name, role, is_active)
  VALUES (p_user_id, v_org_id, p_email, p_full_name, p_role, true)
  ON CONFLICT (id) DO UPDATE
  SET organization_id = v_org_id,
      role = p_role,
      full_name = p_full_name,
      is_active = true;

  -- Insert or update employee record
  INSERT INTO employees (user_id, organization_id, employee_code, department_id, designation_id, date_of_joining, employment_type, status)
  VALUES (p_user_id, v_org_id, p_employee_code, v_dept_id, v_designation_id, '2024-01-01', 'full_time', 'active')
  ON CONFLICT (employee_code) DO UPDATE
  SET user_id = p_user_id,
      organization_id = v_org_id,
      department_id = v_dept_id,
      designation_id = v_designation_id,
      status = 'active';

END;
$$;

-- Instructions output
DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Demo User Setup Ready';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Please create the following users via Supabase Auth Dashboard:';
  RAISE NOTICE '';
  RAISE NOTICE '1. demo_admin@stratefix.com (Password: Demo@123)';
  RAISE NOTICE '2. demo_hr@stratefix.com (Password: Demo@123)';
  RAISE NOTICE '3. demo_ld@stratefix.com (Password: Demo@123)';
  RAISE NOTICE '4. demo_manager@stratefix.com (Password: Demo@123)';
  RAISE NOTICE '5. demo_employee@stratefix.com (Password: Demo@123)';
  RAISE NOTICE '';
  RAISE NOTICE 'After creating users, run the profile setup SQL in the next migration.';
  RAISE NOTICE '================================================';
END;
$$;
