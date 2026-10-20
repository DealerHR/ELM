-- SQL Script to create demo user profiles
-- Note: Auth users must be created through Supabase Auth Admin API or dashboard first
-- This script creates the user_profiles and employee records

DO $$
DECLARE
  v_org_id uuid;
  v_dept_id uuid;
  v_designation_id uuid;
BEGIN
  -- Get or create Stratefix organization
  SELECT id INTO v_org_id
  FROM organizations
  WHERE name = 'Stratefix'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name, industry, size)
    VALUES ('Stratefix', 'Consulting', 'Medium')
    RETURNING id INTO v_org_id;
  END IF;

  -- Create a demo department if needed
  SELECT id INTO v_dept_id FROM departments WHERE organization_id = v_org_id LIMIT 1;
  IF v_dept_id IS NULL THEN
    INSERT INTO departments (organization_id, name, description)
    VALUES (v_org_id, 'General', 'General department for demo users')
    RETURNING id INTO v_dept_id;
  END IF;

  -- Create a demo designation if needed
  SELECT id INTO v_designation_id FROM designations WHERE organization_id = v_org_id LIMIT 1;
  IF v_designation_id IS NULL THEN
    INSERT INTO designations (organization_id, title, level, department_id)
    VALUES (v_org_id, 'Staff', 'L1', v_dept_id)
    RETURNING id INTO v_designation_id;
  END IF;

  RAISE NOTICE 'Organization ID: %', v_org_id;
  RAISE NOTICE 'Department ID: %', v_dept_id;
  RAISE NOTICE 'Designation ID: %', v_designation_id;
  RAISE NOTICE 'Demo users need to be created through Supabase Auth with emails:';
  RAISE NOTICE '- demo_admin@stratefix.com';
  RAISE NOTICE '- demo_hr@stratefix.com';
  RAISE NOTICE '- demo_ld@stratefix.com';
  RAISE NOTICE '- demo_manager@stratefix.com';
  RAISE NOTICE '- demo_employee@stratefix.com';
END $$;
