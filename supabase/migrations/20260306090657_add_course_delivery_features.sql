/*
  # Course Delivery Features: Types, Quizzes, Certifications, Path Prerequisites

  ## Summary
  This migration adds comprehensive learning management features including:

  ## 1. New Columns on Existing Tables
  - `learning_courses.delivery_type`: Replaces the old abstract "type" with concrete delivery modes:
    self_paced | classroom | on_job
  - `learning_courses.is_assessment`: Flag for standalone assessment-only courses
  - `learning_modules.content_file_path`: Storage path for uploaded documents
  - `learning_modules.content_file_name`: Original filename for display
  - `learning_path_items.prerequisite_path_id`: An entire learning path can now be a prerequisite

  ## 2. New Tables
  ### module_quiz_questions
  Stores individual questions for quiz-type modules (and assessments).
  Each question belongs to a learning_module with content_type='quiz'.
  Supports MCQ, True/False, and Short Answer formats.

  ### module_quiz_responses
  Records learner answers for quiz questions per assignment attempt.
  Tracks correct/incorrect answers and points awarded.

  ### ld_certifications
  Used for Classroom and On-Job training courses where an L&D manager must
  certify that the session was conducted and the learner completed it.
  Only after certification is the course marked complete for the learner.

  ## 3. Storage
  Creates a 'course-content' storage bucket for document uploads (PDFs, presentations, etc.).
  Max file size: 50MB. Only authenticated L&D managers can upload; all org members can read.

  ## 4. Security
  All new tables have Row Level Security enabled with appropriate policies.
*/

-- ─── learning_courses: add delivery_type and is_assessment ───────────────────

ALTER TABLE learning_courses
  ADD COLUMN IF NOT EXISTS delivery_type text CHECK (delivery_type IN ('self_paced', 'classroom', 'on_job')) DEFAULT 'self_paced',
  ADD COLUMN IF NOT EXISTS is_assessment boolean DEFAULT false NOT NULL;

-- ─── learning_modules: add file upload support ────────────────────────────────

ALTER TABLE learning_modules
  ADD COLUMN IF NOT EXISTS content_file_path text,
  ADD COLUMN IF NOT EXISTS content_file_name text;

-- ─── learning_path_items: add path-level prerequisite ────────────────────────

ALTER TABLE learning_path_items
  ADD COLUMN IF NOT EXISTS prerequisite_path_id uuid REFERENCES learning_paths(id) ON DELETE SET NULL;

-- ─── module_quiz_questions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS module_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('mcq', 'true_false', 'short_answer')) DEFAULT 'mcq',
  options jsonb,
  correct_answer text,
  points integer DEFAULT 1 NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE module_quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "LD and admins can insert quiz questions"
  ON module_quiz_questions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'platform_admin', 'ld_manager', 'hr_manager')
    )
  );

CREATE POLICY "LD and admins can update quiz questions"
  ON module_quiz_questions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'platform_admin', 'ld_manager', 'hr_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'platform_admin', 'ld_manager', 'hr_manager')
    )
  );

CREATE POLICY "LD and admins can delete quiz questions"
  ON module_quiz_questions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'platform_admin', 'ld_manager', 'hr_manager')
    )
  );

CREATE POLICY "Org members can read quiz questions"
  ON module_quiz_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_modules lm
      JOIN learning_courses lc ON lc.id = lm.course_id
      JOIN user_profiles up ON up.organization_id = lc.organization_id
      WHERE lm.id = module_quiz_questions.module_id
      AND up.id = auth.uid()
    )
  );

-- ─── module_quiz_responses ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS module_quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES employee_learning_assignments(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES module_quiz_questions(id) ON DELETE CASCADE,
  answer_text text,
  is_correct boolean,
  points_awarded integer DEFAULT 0 NOT NULL,
  attempt_number integer DEFAULT 1 NOT NULL,
  responded_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE module_quiz_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can insert own quiz responses"
  ON module_quiz_responses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = module_quiz_responses.employee_id
      AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can read own quiz responses"
  ON module_quiz_responses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = module_quiz_responses.employee_id
      AND e.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'platform_admin', 'ld_manager', 'hr_manager')
    )
  );

-- ─── ld_certifications ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ld_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES employee_learning_assignments(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  certified_by uuid NOT NULL REFERENCES user_profiles(id),
  certified_at timestamptz DEFAULT now() NOT NULL,
  session_date date,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE ld_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "LD and admins can insert certifications"
  ON ld_certifications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'platform_admin', 'ld_manager', 'hr_manager')
    )
    AND certified_by = auth.uid()
  );

CREATE POLICY "LD and admins can view all certifications"
  ON ld_certifications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'platform_admin', 'ld_manager', 'hr_manager')
    )
    OR
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = ld_certifications.employee_id
      AND e.user_id = auth.uid()
    )
  );

-- ─── Storage bucket for course content ───────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-content',
  'course-content',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "LD managers can upload course content"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-content'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'platform_admin', 'ld_manager', 'hr_manager')
    )
  );

CREATE POLICY "Org members can read course content"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-content');

CREATE POLICY "LD managers can delete course content"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-content'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'platform_admin', 'ld_manager', 'hr_manager')
    )
  );
