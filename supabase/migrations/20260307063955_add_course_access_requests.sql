/*
  # Course Access Requests

  ## Summary
  Introduces a workflow for employees to request access to optional courses. An L&D manager
  can approve (auto-enrolling the employee) or deny (triggering a personal message) each request.

  ## New Tables

  ### course_access_requests
  - `id` – UUID primary key
  - `organization_id` – scope to org
  - `employee_id` – requesting user (user_profiles.id)
  - `course_id` – the optional course requested (learning_courses.id)
  - `status` – pending | approved | denied
  - `requested_at` – timestamp of original request
  - `reviewed_by` – L&D manager who acted on it (nullable)
  - `reviewed_at` – when the decision was made (nullable)
  - `denial_reason` – optional notes shown on the denial message

  ## Security
  - RLS enabled; employees can read/insert their own requests
  - L&D managers and admins can read all org requests and update status

  ## Unique Constraint
  - One pending/approved request per employee per course to prevent duplicates
*/

CREATE TABLE IF NOT EXISTS course_access_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id      uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  course_id        uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  requested_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_by      uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  denial_reason    text,
  UNIQUE (employee_id, course_id)
);

ALTER TABLE course_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own access requests"
  ON course_access_requests FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employees can insert own access requests"
  ON course_access_requests FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "LD managers and admins can view org access requests"
  ON course_access_requests FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'org_admin', 'l_d_manager', 'platform_admin')
    )
  );

CREATE POLICY "LD managers and admins can update access requests"
  ON course_access_requests FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'org_admin', 'l_d_manager', 'platform_admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'org_admin', 'l_d_manager', 'platform_admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_course_access_requests_org ON course_access_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_course_access_requests_employee ON course_access_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_course_access_requests_status ON course_access_requests(status);
