/*
  # Fix L&D RLS Policies and Induction Workflow

  ## Problems Fixed
  1. learning_progress had no INSERT policy — employees couldn't record progress
  2. employee_learning_assignments had no INSERT policy — HR/L&D couldn't assign courses
  3. induction_journeys had no policies at all — employees couldn't see or update their journey
  4. induction_templates had no policies — L&D couldn't create templates
  5. skill_assessments and skill_assessment_results had no policies
  6. role_skills had no policies
  7. learning_path_items needed policies for authenticated users

  ## New / Fixed Policies
  - Employees can INSERT and UPDATE their own learning_progress
  - HR/admin/l_d_manager can INSERT employee_learning_assignments
  - Employees can view their own induction_journeys
  - HR/admin can INSERT induction_journeys (assign induction to employees)
  - Employees can update their own induction_journeys (progress updates)
  - L&D/admin can manage induction_templates
  - Employees can INSERT skill_assessments and skill_assessment_results for themselves
  - Everyone in org can view role_skills and learning_path_items
*/

-- ── learning_progress ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their learning progress" ON learning_progress;

CREATE POLICY "Employees can insert their own learning progress"
  ON learning_progress FOR INSERT
  TO authenticated
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can update their own learning progress"
  ON learning_progress FOR UPDATE
  TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- ── employee_learning_assignments ──────────────────────────────────────────
CREATE POLICY "Admins and LD can insert learning assignments"
  ON employee_learning_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr', 'l_d_manager')
    )
  );

CREATE POLICY "Admins and LD can update learning assignments"
  ON employee_learning_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr', 'l_d_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr', 'l_d_manager')
    )
  );

-- ── induction_journeys ─────────────────────────────────────────────────────
CREATE POLICY "Employees can view their own induction journeys"
  ON induction_journeys FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr', 'l_d_manager', 'manager')
    )
  );

CREATE POLICY "HR and admins can insert induction journeys"
  ON induction_journeys FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr', 'l_d_manager')
    )
  );

CREATE POLICY "Employees and HR can update induction journeys"
  ON induction_journeys FOR UPDATE
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr', 'l_d_manager')
    )
  )
  WITH CHECK (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr', 'l_d_manager')
    )
  );

-- ── induction_templates ────────────────────────────────────────────────────
CREATE POLICY "All org members can view induction templates"
  ON induction_templates FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "LD and admins can manage induction templates"
  ON induction_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'l_d_manager')
      AND organization_id = induction_templates.organization_id
    )
  );

CREATE POLICY "LD and admins can update induction templates"
  ON induction_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'l_d_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'l_d_manager')
    )
  );

-- ── skill_assessments ──────────────────────────────────────────────────────
CREATE POLICY "Employees can view their own skill assessments"
  ON skill_assessments FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr', 'l_d_manager', 'manager')
    )
  );

CREATE POLICY "Employees can insert their own skill assessments"
  ON skill_assessments FOR INSERT
  TO authenticated
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Employees can update their own skill assessments"
  ON skill_assessments FOR UPDATE
  TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- ── skill_assessment_results ───────────────────────────────────────────────
CREATE POLICY "Employees can view their own skill assessment results"
  ON skill_assessment_results FOR SELECT
  TO authenticated
  USING (
    assessment_id IN (
      SELECT id FROM skill_assessments
      WHERE employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Employees can insert their own skill assessment results"
  ON skill_assessment_results FOR INSERT
  TO authenticated
  WITH CHECK (
    assessment_id IN (
      SELECT id FROM skill_assessments
      WHERE employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    )
  );

-- ── role_skills ────────────────────────────────────────────────────────────
CREATE POLICY "All org members can view role skills"
  ON role_skills FOR SELECT
  TO authenticated
  USING (
    designation_id IN (
      SELECT id FROM designations
      WHERE organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "LD and admins can manage role skills"
  ON role_skills FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'l_d_manager')
    )
  );

-- ── learning_path_items ────────────────────────────────────────────────────
CREATE POLICY "All org members can view learning path items"
  ON learning_path_items FOR SELECT
  TO authenticated
  USING (
    path_id IN (
      SELECT id FROM learning_paths
      WHERE organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "LD and admins can manage learning path items"
  ON learning_path_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'l_d_manager')
    )
  );

CREATE POLICY "LD and admins can update learning path items"
  ON learning_path_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'l_d_manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'l_d_manager'))
  );

CREATE POLICY "LD and admins can delete learning path items"
  ON learning_path_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'l_d_manager'))
  );

-- ── one_on_one_sessions ────────────────────────────────────────────────────
CREATE POLICY "Participants can view their sessions"
  ON one_on_one_sessions FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR mentor_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'hr', 'l_d_manager')
    )
  );

CREATE POLICY "Managers and HR can create sessions"
  ON one_on_one_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr', 'l_d_manager', 'manager')
    )
  );
