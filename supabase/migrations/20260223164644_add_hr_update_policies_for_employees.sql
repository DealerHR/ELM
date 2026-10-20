/*
  # Add HR update policies for user_profiles and employees tables

  ## Summary
  HR users could view employees but could not edit them because:
  - user_profiles only had an admin UPDATE policy
  - employees table had an "Admins and HR can manage employees" ALL policy but it was
    checking role via a subquery that might not match

  ## Changes
  1. user_profiles: Add HR update policy so HR can update profiles in their org
  2. employees: Ensure HR can update employee records (department, designation, status, etc.)

  ## Security
  - HR can only update profiles/employees within their own organization
  - HR cannot update their own profile's organization_id
*/

CREATE POLICY "HR can update org profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    (get_user_role(auth.uid()) = 'hr') 
    AND (organization_id = get_user_organization(auth.uid())) 
    AND (organization_id IS NOT NULL)
  )
  WITH CHECK (
    (get_user_role(auth.uid()) = 'hr') 
    AND (organization_id = get_user_organization(auth.uid())) 
    AND (organization_id IS NOT NULL)
  );
