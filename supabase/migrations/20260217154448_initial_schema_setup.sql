/*
  # Employee Lifecycle Management Platform - Complete Database Schema

  ## Overview
  Comprehensive schema for recruitment, induction, learning, skill assessment, 
  and performance management platform.

  ## Master Data Tables
  1. **organizations** - Company/organization master data
  2. **departments** - Department structure within organizations
  3. **designations** - Job roles and positions
  4. **user_profiles** - Extended user information linked to auth.users
  5. **employees** - Employee master with reporting hierarchy

  ## Recruitment Module Tables
  6. **candidates** - Candidate information during recruitment
  7. **assessment_templates** - Reusable assessment templates (personality, knowledge)
  8. **assessment_questions** - Questions for assessments
  9. **candidate_assessments** - Assessments assigned to candidates
  10. **candidate_assessment_answers** - Candidate responses to assessments
  11. **interview_feedback** - Recruiter feedback from interviews
  12. **job_offers** - Offer management

  ## Skills Module Tables
  13. **skills** - Master skill inventory
  14. **skill_questions** - 20 questions per skill with 5 options each
  15. **role_skills** - Skills mapped to designations/roles
  16. **skill_assessments** - Individual skill assessment sessions
  17. **skill_assessment_results** - Results of skill assessments

  ## Learning Module Tables
  18. **learning_courses** - Course catalog
  19. **learning_modules** - Individual learning modules/content
  20. **learning_paths** - Structured learning journeys
  21. **learning_path_items** - Courses in a learning path
  22. **employee_learning_assignments** - Assigned learning to employees
  23. **learning_progress** - Track completion and progress

  ## Induction Module Tables
  24. **induction_templates** - Default induction pathways per role
  25. **induction_journeys** - Active induction instances for employees
  26. **one_on_one_sessions** - Scheduled 1-on-1 meetings

  ## Performance Module Tables
  27. **okrs** - Objectives and Key Results
  28. **key_results** - Individual key results for objectives
  29. **performance_reviews** - Quarterly and annual reviews
  30. **performance_ratings** - Rating records

  ## Repository Module Tables
  31. **resource_repository** - Document and resource library
  32. **resource_access_log** - Track resource access

  ## Security
  - RLS enabled on all tables
  - Policies based on user roles and organizational hierarchy
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- MASTER DATA TABLES
-- ============================================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  website text,
  industry text,
  size text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  parent_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  head_employee_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Designations/Roles table
CREATE TABLE IF NOT EXISTS designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  level text,
  description text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE designations ENABLE ROW LEVEL SECURITY;

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  avatar_url text,
  role text NOT NULL CHECK (role IN ('admin', 'hr', 'l_d_manager', 'manager', 'employee')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Employees table (active employees with organizational structure)
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  employee_code text UNIQUE NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  designation_id uuid REFERENCES designations(id) ON DELETE SET NULL,
  reporting_manager_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  date_of_joining date NOT NULL,
  date_of_leaving date,
  employment_type text CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'notice_period', 'terminated', 'resigned')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RECRUITMENT MODULE TABLES
-- ============================================================================

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  applied_position uuid REFERENCES designations(id) ON DELETE SET NULL,
  resume_url text,
  status text DEFAULT 'applied' CHECK (status IN ('applied', 'assessment_pending', 'assessment_completed', 'interview_scheduled', 'interviewed', 'shortlisted', 'offer_extended', 'offer_accepted', 'offer_declined', 'joined', 'rejected')),
  source text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Assessment templates (personality, knowledge, etc.)
CREATE TABLE IF NOT EXISTS assessment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('personality', 'knowledge', 'aptitude', 'technical')),
  is_active boolean DEFAULT true,
  is_library_template boolean DEFAULT false,
  duration_minutes integer,
  passing_score integer,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE assessment_templates ENABLE ROW LEVEL SECURITY;

-- Assessment questions
CREATE TABLE IF NOT EXISTS assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES assessment_templates(id) ON DELETE CASCADE NOT NULL,
  question_text text NOT NULL,
  question_type text DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  options jsonb,
  correct_answer text,
  points integer DEFAULT 1,
  order_index integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;

-- Candidate assessments
CREATE TABLE IF NOT EXISTS candidate_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES assessment_templates(id) ON DELETE CASCADE NOT NULL,
  assigned_by uuid REFERENCES user_profiles(id),
  assigned_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  score integer,
  max_score integer,
  percentage real,
  status text DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'expired')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE candidate_assessments ENABLE ROW LEVEL SECURITY;

-- Candidate assessment answers
CREATE TABLE IF NOT EXISTS candidate_assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES candidate_assessments(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES assessment_questions(id) ON DELETE CASCADE NOT NULL,
  answer text,
  is_correct boolean,
  points_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE candidate_assessment_answers ENABLE ROW LEVEL SECURITY;

-- Interview feedback
CREATE TABLE IF NOT EXISTS interview_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  interviewer_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  interview_date date NOT NULL,
  interview_type text CHECK (interview_type IN ('phone_screen', 'technical', 'behavioral', 'hr', 'final')),
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comments text,
  recommendation text CHECK (recommendation IN ('strong_hire', 'hire', 'maybe', 'no_hire')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE interview_feedback ENABLE ROW LEVEL SECURITY;

-- Job offers
CREATE TABLE IF NOT EXISTS job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  designation_id uuid REFERENCES designations(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  salary_offered numeric,
  currency text DEFAULT 'USD',
  offer_date date NOT NULL,
  expiry_date date,
  joining_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  offer_letter_url text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE job_offers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SKILLS MODULE TABLES
-- ============================================================================

-- Skills master
CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

-- Skill questions (20 per skill, 5 options each)
CREATE TABLE IF NOT EXISTS skill_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid REFERENCES skills(id) ON DELETE CASCADE NOT NULL,
  question_text text NOT NULL,
  option_1 text NOT NULL,
  option_2 text NOT NULL,
  option_3 text NOT NULL,
  option_4 text NOT NULL,
  option_5 text DEFAULT 'Don''t Know / Not Sure',
  correct_option integer CHECK (correct_option >= 1 AND correct_option <= 4),
  difficulty text CHECK (difficulty IN ('easy', 'medium', 'hard')),
  order_index integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skill_questions ENABLE ROW LEVEL SECURITY;

-- Role skills mapping (4-6 skills per role)
CREATE TABLE IF NOT EXISTS role_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designation_id uuid REFERENCES designations(id) ON DELETE CASCADE NOT NULL,
  skill_id uuid REFERENCES skills(id) ON DELETE CASCADE NOT NULL,
  is_mandatory boolean DEFAULT true,
  minimum_score integer DEFAULT 60,
  created_at timestamptz DEFAULT now(),
  UNIQUE(designation_id, skill_id)
);

ALTER TABLE role_skills ENABLE ROW LEVEL SECURITY;

-- Skill assessments
CREATE TABLE IF NOT EXISTS skill_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  skill_id uuid REFERENCES skills(id) ON DELETE CASCADE NOT NULL,
  assessment_date date NOT NULL,
  assessment_type text CHECK (assessment_type IN ('initial', '6_month', 'annual', 'reassessment')),
  score integer,
  max_score integer DEFAULT 20,
  percentage real,
  status text DEFAULT 'in_progress' CHECK (status IN ('assigned', 'in_progress', 'completed')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skill_assessments ENABLE ROW LEVEL SECURITY;

-- Skill assessment results (detailed answers)
CREATE TABLE IF NOT EXISTS skill_assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES skill_assessments(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES skill_questions(id) ON DELETE CASCADE NOT NULL,
  selected_option integer,
  is_correct boolean,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skill_assessment_results ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- LEARNING MODULE TABLES
-- ============================================================================

-- Learning courses
CREATE TABLE IF NOT EXISTS learning_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  type text CHECK (type IN ('mandatory_company', 'mandatory_skill', 'role_specific', 'optional')),
  duration_hours real,
  thumbnail_url text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE learning_courses ENABLE ROW LEVEL SECURITY;

-- Learning modules/content
CREATE TABLE IF NOT EXISTS learning_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES learning_courses(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  content_type text CHECK (content_type IN ('video', 'document', 'presentation', 'quiz', 'assignment', 'external_link')),
  content_url text,
  content_data jsonb,
  duration_minutes integer,
  order_index integer,
  is_mandatory boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE learning_modules ENABLE ROW LEVEL SECURITY;

-- Learning paths (structured journeys)
CREATE TABLE IF NOT EXISTS learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  path_type text CHECK (path_type IN ('induction', 'skill_development', 'role_specific', 'custom')),
  target_role uuid REFERENCES designations(id),
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;

-- Learning path items
CREATE TABLE IF NOT EXISTS learning_path_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid REFERENCES learning_paths(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES learning_courses(id) ON DELETE CASCADE NOT NULL,
  order_index integer NOT NULL,
  is_mandatory boolean DEFAULT true,
  prerequisite_item_id uuid REFERENCES learning_path_items(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE learning_path_items ENABLE ROW LEVEL SECURITY;

-- Employee learning assignments
CREATE TABLE IF NOT EXISTS employee_learning_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES learning_courses(id) ON DELETE CASCADE,
  learning_path_id uuid REFERENCES learning_paths(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES user_profiles(id),
  assigned_date date DEFAULT CURRENT_DATE,
  due_date date,
  status text DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employee_learning_assignments ENABLE ROW LEVEL SECURITY;

-- Learning progress tracking
CREATE TABLE IF NOT EXISTS learning_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES employee_learning_assignments(id) ON DELETE CASCADE NOT NULL,
  module_id uuid REFERENCES learning_modules(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  progress_percentage integer DEFAULT 0,
  score integer,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INDUCTION MODULE TABLES
-- ============================================================================

-- Induction templates (default pathways per role)
CREATE TABLE IF NOT EXISTS induction_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  designation_id uuid REFERENCES designations(id) ON DELETE CASCADE NOT NULL,
  duration_days integer DEFAULT 90,
  learning_path_id uuid REFERENCES learning_paths(id),
  description text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE induction_templates ENABLE ROW LEVEL SECURITY;

-- Induction journeys (active instances)
CREATE TABLE IF NOT EXISTS induction_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES induction_templates(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  expected_end_date date NOT NULL,
  actual_end_date date,
  status text DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed', 'extended')),
  completion_percentage integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE induction_journeys ENABLE ROW LEVEL SECURITY;

-- One-on-one sessions
CREATE TABLE IF NOT EXISTS one_on_one_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  mentor_id uuid REFERENCES employees(id) ON DELETE SET NULL NOT NULL,
  scheduled_date timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  agenda text,
  notes text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  meeting_link text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE one_on_one_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PERFORMANCE MODULE TABLES (OKR-based)
-- ============================================================================

-- OKRs (Objectives and Key Results)
CREATE TABLE IF NOT EXISTS okrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  okr_type text CHECK (okr_type IN ('individual', 'team', 'company')),
  period text CHECK (period IN ('quarterly', 'annual')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  overall_progress integer DEFAULT 0,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE okrs ENABLE ROW LEVEL SECURITY;

-- Key Results
CREATE TABLE IF NOT EXISTS key_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id uuid REFERENCES okrs(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  target_value numeric NOT NULL,
  current_value numeric DEFAULT 0,
  unit text,
  weight integer DEFAULT 100,
  progress_percentage integer DEFAULT 0,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'on_track', 'at_risk', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;

-- Performance reviews
CREATE TABLE IF NOT EXISTS performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES employees(id) ON DELETE SET NULL NOT NULL,
  review_period text CHECK (review_period IN ('quarterly', 'annual')),
  review_date date NOT NULL,
  start_period_date date NOT NULL,
  end_period_date date NOT NULL,
  overall_rating integer CHECK (overall_rating >= 1 AND overall_rating <= 5),
  strengths text,
  areas_for_improvement text,
  comments text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;

-- Performance ratings (granular metrics)
CREATE TABLE IF NOT EXISTS performance_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES performance_reviews(id) ON DELETE CASCADE NOT NULL,
  metric_name text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comments text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE performance_ratings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- REPOSITORY MODULE TABLES
-- ============================================================================

-- Resource repository
CREATE TABLE IF NOT EXISTS resource_repository (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  file_type text CHECK (file_type IN ('video', 'pdf', 'document', 'spreadsheet', 'presentation', 'other')),
  file_url text NOT NULL,
  file_size bigint,
  category text,
  tags text[],
  access_level text DEFAULT 'department' CHECK (access_level IN ('all', 'department', 'designation', 'specific')),
  department_ids uuid[],
  uploaded_by uuid REFERENCES user_profiles(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE resource_repository ENABLE ROW LEVEL SECURITY;

-- Resource access log
CREATE TABLE IF NOT EXISTS resource_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid REFERENCES resource_repository(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  accessed_at timestamptz DEFAULT now()
);

ALTER TABLE resource_access_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Organizations policies
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Departments policies
CREATE POLICY "Users can view departments in their organization"
  ON departments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins and HR can manage departments"
  ON departments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'hr')
      AND organization_id = departments.organization_id
    )
  );

-- Designations policies
CREATE POLICY "Users can view designations in their organization"
  ON designations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins and HR can manage designations"
  ON designations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'hr')
      AND organization_id = designations.organization_id
    )
  );

-- User profiles policies
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can manage all user profiles in their organization"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() 
      AND up.role = 'admin'
      AND up.organization_id = user_profiles.organization_id
    )
  );

-- Employees policies
CREATE POLICY "Users can view employees in their organization"
  ON employees FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins and HR can manage employees"
  ON employees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'hr')
      AND organization_id = employees.organization_id
    )
  );

-- Candidates policies (HR and Admin only)
CREATE POLICY "HR and Admins can view candidates"
  ON candidates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'hr')
      AND organization_id = candidates.organization_id
    )
  );

CREATE POLICY "HR and Admins can manage candidates"
  ON candidates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'hr')
      AND organization_id = candidates.organization_id
    )
  );

-- Skills policies
CREATE POLICY "Users can view skills in their organization"
  ON skills FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins and L&D Managers can manage skills"
  ON skills FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'l_d_manager')
      AND organization_id = skills.organization_id
    )
  );

-- Learning courses policies
CREATE POLICY "Users can view learning courses in their organization"
  ON learning_courses FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins and L&D Managers can manage courses"
  ON learning_courses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'l_d_manager')
      AND organization_id = learning_courses.organization_id
    )
  );

-- Employee learning assignments policies
CREATE POLICY "Employees can view their own assignments"
  ON employee_learning_assignments FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'l_d_manager', 'manager')
    )
  );

-- OKRs policies
CREATE POLICY "Employees can view their own OKRs"
  ON okrs FOR SELECT
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM employees e1
      JOIN employees e2 ON e1.reporting_manager_id = e2.id
      WHERE e2.user_id = auth.uid() AND e1.id = okrs.employee_id
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

CREATE POLICY "Employees and managers can manage OKRs"
  ON okrs FOR ALL
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM employees e1
      JOIN employees e2 ON e1.reporting_manager_id = e2.id
      WHERE e2.user_id = auth.uid() AND e1.id = okrs.employee_id
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Resource repository policies
CREATE POLICY "Users can view accessible resources"
  ON resource_repository FOR SELECT
  TO authenticated
  USING (
    access_level = 'all'
    OR
    (access_level = 'department' AND EXISTS (
      SELECT 1 FROM employees e
      JOIN user_profiles up ON e.user_id = up.id
      WHERE up.id = auth.uid() AND e.department_id = ANY(resource_repository.department_ids)
    ))
    OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'l_d_manager')
    )
  );

CREATE POLICY "Admins and L&D Managers can manage resources"
  ON resource_repository FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'l_d_manager')
      AND organization_id = resource_repository.organization_id
    )
  );

-- Additional policies for other tables (simplified for brevity)
CREATE POLICY "Authenticated users can view assessment templates"
  ON assessment_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view skill questions"
  ON skill_questions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view learning modules"
  ON learning_modules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view their learning progress"
  ON learning_progress FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their learning progress"
  ON learning_progress FOR ALL TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_organization_id ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_reporting_manager ON employees(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_candidates_organization_id ON candidates(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_skill_assessments_employee ON skill_assessments(employee_id);
CREATE INDEX IF NOT EXISTS idx_learning_assignments_employee ON employee_learning_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_okrs_employee ON okrs(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee ON performance_reviews(employee_id);