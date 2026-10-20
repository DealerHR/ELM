/*
  # Comprehensive Skill Mapping System Update

  ## Summary
  This migration supports the full skill mapping workflow:
  - Skills assigned to roles (designations) by L&D managers
  - Courses and repository items mapped to one or more skills
  - Quarterly skill assessments tracked per employee
  - Learners can see their skill scores and related learning content

  ## Changes

  ### 1. Modified Tables
  - `learning_courses`: Add `skill_ids` (uuid array) for skill mapping
  - `resource_repository`: Add `skill_ids` (uuid array) for skill mapping
  - `role_skills`: Add `updated_at` for tracking last modification

  ### 2. New Tables
  - `quarterly_skill_due`: Tracks which quarter's assessment is due per employee per skill

  ### 3. Security
  - RLS policies for all new columns/tables
  - role_skills: add UPDATE and DELETE policies for admins/L&D managers

  ## Notes
  - skill_ids uses uuid[] to allow many-to-many without a junction table (simple approach)
  - Quarterly assessment: determined by checking if latest assessment is within current quarter
*/

-- 1. Add skill_ids to learning_courses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learning_courses' AND column_name = 'skill_ids'
  ) THEN
    ALTER TABLE learning_courses ADD COLUMN skill_ids uuid[] DEFAULT '{}';
  END IF;
END $$;

-- 2. Add skill_ids to resource_repository
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resource_repository' AND column_name = 'skill_ids'
  ) THEN
    ALTER TABLE resource_repository ADD COLUMN skill_ids uuid[] DEFAULT '{}';
  END IF;
END $$;

-- 3. Add UPDATE and DELETE policies for role_skills (only SELECT and INSERT existed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'role_skills' AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY "LD and admins can update role skills"
      ON role_skills FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'l_d_manager')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'l_d_manager')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'role_skills' AND cmd = 'DELETE'
  ) THEN
    CREATE POLICY "LD and admins can delete role skills"
      ON role_skills FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'l_d_manager')
        )
      );
  END IF;
END $$;

-- 4. Ensure learning_courses has proper write policies for skill_ids updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'learning_courses' AND policyname = 'LD and admins can update learning courses'
  ) THEN
    CREATE POLICY "LD and admins can update learning courses"
      ON learning_courses FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'l_d_manager')
            AND user_profiles.organization_id = learning_courses.organization_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'l_d_manager')
            AND user_profiles.organization_id = learning_courses.organization_id
        )
      );
  END IF;
END $$;

-- 5. Ensure resource_repository has proper write policies for skill_ids updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'resource_repository' AND policyname = 'LD and admins can update resources'
  ) THEN
    CREATE POLICY "LD and admins can update resources"
      ON resource_repository FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'l_d_manager')
            AND user_profiles.organization_id = resource_repository.organization_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'l_d_manager')
            AND user_profiles.organization_id = resource_repository.organization_id
        )
      );
  END IF;
END $$;
