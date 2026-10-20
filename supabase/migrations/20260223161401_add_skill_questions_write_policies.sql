/*
  # Add write policies for skill_questions table

  ## Problem
  The skill_questions table only had a SELECT policy. INSERT and UPDATE operations
  were blocked by RLS, causing question saves to fail silently.

  ## Changes
  - Add INSERT policy: allows authenticated users to insert questions for skills
    belonging to their organization
  - Add UPDATE policy: allows authenticated users to update questions for skills
    belonging to their organization
  - Add DELETE policy: allows authenticated users to delete questions for skills
    belonging to their organization
*/

CREATE POLICY "Org members can insert skill questions"
  ON skill_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM skills
      JOIN user_profiles ON user_profiles.organization_id = skills.organization_id
      WHERE skills.id = skill_questions.skill_id
        AND user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Org members can update skill questions"
  ON skill_questions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skills
      JOIN user_profiles ON user_profiles.organization_id = skills.organization_id
      WHERE skills.id = skill_questions.skill_id
        AND user_profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM skills
      JOIN user_profiles ON user_profiles.organization_id = skills.organization_id
      WHERE skills.id = skill_questions.skill_id
        AND user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete skill questions"
  ON skill_questions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skills
      JOIN user_profiles ON user_profiles.organization_id = skills.organization_id
      WHERE skills.id = skill_questions.skill_id
        AND user_profiles.id = auth.uid()
    )
  );
