/*
  # Fix learning_modules RLS policies and storage role names

  ## Issues Fixed

  ### 1. learning_modules — Missing INSERT/UPDATE/DELETE policies
  The table only had a SELECT policy. L&D managers and admins were blocked from
  inserting or updating modules (causing 403 errors in the Course Builder).

  ### 2. course-content storage — Wrong role names
  The storage bucket policies referenced `ld_manager` and `hr_manager` which do
  not exist in user_profiles.role. The correct values are `l_d_manager` and `hr`.
  These are dropped and recreated with the correct names.

  ## Changes
  - Add INSERT policy for learning_modules (admin, l_d_manager)
  - Add UPDATE policy for learning_modules (admin, l_d_manager)
  - Add DELETE policy for learning_modules (admin, l_d_manager)
  - Drop & recreate "LD managers can upload course content" with correct roles
  - Drop & recreate "LD managers can delete course content" with correct roles
*/

-- ── learning_modules: add missing write policies ──────────────────────────────

CREATE POLICY "LD managers can insert learning modules"
  ON learning_modules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'platform_admin', 'l_d_manager', 'org_admin')
    )
  );

CREATE POLICY "LD managers can update learning modules"
  ON learning_modules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'platform_admin', 'l_d_manager', 'org_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'platform_admin', 'l_d_manager', 'org_admin')
    )
  );

CREATE POLICY "LD managers can delete learning modules"
  ON learning_modules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'platform_admin', 'l_d_manager', 'org_admin')
    )
  );

-- ── storage.objects: fix wrong role names on course-content bucket ────────────

DROP POLICY IF EXISTS "LD managers can upload course content" ON storage.objects;
DROP POLICY IF EXISTS "LD managers can delete course content" ON storage.objects;

CREATE POLICY "LD managers can upload course content"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'course-content'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'platform_admin', 'l_d_manager', 'org_admin', 'hr')
    )
  );

CREATE POLICY "LD managers can delete course content"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'course-content'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'platform_admin', 'l_d_manager', 'org_admin', 'hr')
    )
  );
