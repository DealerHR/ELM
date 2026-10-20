/*
  # OKR Workflow: Approval, Review Comments, and Locking

  ## Summary
  Extends the OKR system to support a full lifecycle workflow:
  - Employee drafts OKR and submits to supervisor for review
  - Supervisor can edit and approve (locks OKR content for employee edits)
  - Supervisor adds periodic review comments against the agreed OKR
  - After the period ends, supervisor locks the review (fully locked)
  - HR can view all OKRs and comments (read-only)

  ## Changes to okrs table
  - New status values: 'draft' | 'submitted' | 'approved' | 'review_locked'
    - draft: Employee is working on it (editable by employee)
    - submitted: Employee submitted for supervisor review (editable by supervisor)
    - approved: Supervisor approved; content locked for employee; supervisor can add review comments
    - review_locked: Period is over, everything is fully locked
  - Add `approved_by` (uuid) - employee id of the approving supervisor
  - Add `approved_at` (timestamptz) - when approved
  - Add `review_locked_at` (timestamptz) - when fully locked
  - Add `supervisor_notes` (text) - supervisor notes added during approval

  ## New Table: okr_review_comments
  - Supervisor posts periodic review comments on approved OKRs
  - Each comment tracks reviewer, timestamp, and comment text
  - Comments are immutable once posted

  ## New Table: okr_key_results (replaces key_results for per-okr tracking)
  - Already exists as key_results; we add the supervisor progress update capability

  ## Security
  - RLS enabled on okr_review_comments
  - Employee can read their own OKR's review comments
  - Supervisor can read/insert review comments for their direct reports' OKRs
  - HR and admin can read all
*/

-- Step 1: Update okrs status check to include new workflow states
ALTER TABLE okrs DROP CONSTRAINT IF EXISTS okrs_status_check;
ALTER TABLE okrs ADD CONSTRAINT okrs_status_check
  CHECK (status IN ('draft', 'submitted', 'approved', 'review_locked', 'cancelled'));

-- Step 2: Add workflow columns to okrs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'okrs' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE okrs ADD COLUMN approved_by uuid REFERENCES employees(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'okrs' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE okrs ADD COLUMN approved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'okrs' AND column_name = 'review_locked_at'
  ) THEN
    ALTER TABLE okrs ADD COLUMN review_locked_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'okrs' AND column_name = 'supervisor_notes'
  ) THEN
    ALTER TABLE okrs ADD COLUMN supervisor_notes text;
  END IF;
END $$;

-- Step 3: Create okr_review_comments table
CREATE TABLE IF NOT EXISTS okr_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id uuid REFERENCES okrs(id) ON DELETE CASCADE NOT NULL,
  reviewer_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  comment text NOT NULL,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  overall_rating integer CHECK (overall_rating >= 1 AND overall_rating <= 5),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE okr_review_comments ENABLE ROW LEVEL SECURITY;

-- Step 4: Update OKR RLS policies to reflect new workflow

-- Drop existing OKR policies
DROP POLICY IF EXISTS "Employees can view their own OKRs" ON okrs;
DROP POLICY IF EXISTS "Employees can create OKRs" ON okrs;
DROP POLICY IF EXISTS "Employees can update their own OKRs" ON okrs;
DROP POLICY IF EXISTS "Managers can view their team OKRs" ON okrs;
DROP POLICY IF EXISTS "HR and Admin can view all OKRs" ON okrs;
DROP POLICY IF EXISTS "Managers can update team OKRs" ON okrs;

-- Employee: can view own OKRs
CREATE POLICY "Employees view own OKRs"
  ON okrs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e WHERE e.id = okrs.employee_id AND e.user_id = auth.uid()
    )
  );

-- Employee: can insert OKRs (starts as draft)
CREATE POLICY "Employees create OKRs"
  ON okrs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e WHERE e.id = employee_id AND e.user_id = auth.uid()
    )
  );

-- Employee: can update own OKRs only when in draft status
CREATE POLICY "Employees update own draft OKRs"
  ON okrs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e WHERE e.id = okrs.employee_id AND e.user_id = auth.uid()
    )
    AND okrs.status = 'draft'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e WHERE e.id = employee_id AND e.user_id = auth.uid()
    )
    AND status IN ('draft', 'submitted')
  );

-- Supervisor: view OKRs of direct reports
CREATE POLICY "Supervisors view direct report OKRs"
  ON okrs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees emp
      JOIN employees mgr ON emp.reporting_manager_id = mgr.id
      WHERE emp.id = okrs.employee_id AND mgr.user_id = auth.uid()
    )
  );

-- Supervisor: update submitted/approved OKRs of direct reports
CREATE POLICY "Supervisors update direct report OKRs"
  ON okrs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees emp
      JOIN employees mgr ON emp.reporting_manager_id = mgr.id
      WHERE emp.id = okrs.employee_id AND mgr.user_id = auth.uid()
    )
    AND okrs.status IN ('submitted', 'approved')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees emp
      JOIN employees mgr ON emp.reporting_manager_id = mgr.id
      WHERE emp.id = employee_id AND mgr.user_id = auth.uid()
    )
  );

-- HR and Admin: view all OKRs
CREATE POLICY "HR and Admin view all OKRs"
  ON okrs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('hr', 'admin', 'platform_admin')
      AND up.organization_id = (
        SELECT organization_id FROM employees e WHERE e.id = okrs.employee_id
      )
    )
  );

-- Step 5: RLS policies for okr_review_comments

-- Employee: can view review comments on their own OKRs
CREATE POLICY "Employees view review comments on own OKRs"
  ON okr_review_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN employees e ON o.employee_id = e.id
      WHERE o.id = okr_review_comments.okr_id AND e.user_id = auth.uid()
    )
  );

-- Supervisor: can view and insert review comments for direct reports' OKRs
CREATE POLICY "Supervisors view review comments for direct reports"
  ON okr_review_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN employees emp ON o.employee_id = emp.id
      JOIN employees mgr ON emp.reporting_manager_id = mgr.id
      WHERE o.id = okr_review_comments.okr_id AND mgr.user_id = auth.uid()
    )
  );

CREATE POLICY "Supervisors insert review comments for direct reports"
  ON okr_review_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN employees emp ON o.employee_id = emp.id
      JOIN employees mgr ON emp.reporting_manager_id = mgr.id
      WHERE o.id = okr_id AND mgr.user_id = auth.uid()
      AND o.status = 'approved'
    )
  );

-- HR and Admin: view all review comments
CREATE POLICY "HR and Admin view all review comments"
  ON okr_review_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN employees e ON o.employee_id = e.id
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE o.id = okr_review_comments.okr_id
      AND up.role IN ('hr', 'admin', 'platform_admin')
      AND up.organization_id = e.organization_id
    )
  );

-- Step 6: Update key_results RLS to match supervisor access pattern
DROP POLICY IF EXISTS "Users can view their own key results" ON key_results;
DROP POLICY IF EXISTS "Users can manage their own key results" ON key_results;

CREATE POLICY "View key results for accessible OKRs"
  ON key_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN employees e ON o.employee_id = e.id
      WHERE o.id = key_results.okr_id
      AND (
        e.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM employees mgr
          WHERE mgr.id = e.reporting_manager_id AND mgr.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid() AND up.role IN ('hr', 'admin', 'platform_admin')
          AND up.organization_id = e.organization_id
        )
      )
    )
  );

CREATE POLICY "Employees insert key results on draft OKRs"
  ON key_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN employees e ON o.employee_id = e.id
      WHERE o.id = okr_id AND e.user_id = auth.uid() AND o.status = 'draft'
    )
  );

CREATE POLICY "Employees update key results on draft OKRs"
  ON key_results FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN employees e ON o.employee_id = e.id
      WHERE o.id = key_results.okr_id AND e.user_id = auth.uid() AND o.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN employees e ON o.employee_id = e.id
      WHERE o.id = okr_id AND e.user_id = auth.uid() AND o.status = 'draft'
    )
  );

CREATE POLICY "Employees delete key results on draft OKRs"
  ON key_results FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN employees e ON o.employee_id = e.id
      WHERE o.id = key_results.okr_id AND e.user_id = auth.uid() AND o.status = 'draft'
    )
  );

CREATE POLICY "Supervisors update key results on submitted approved OKRs"
  ON key_results FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN employees emp ON o.employee_id = emp.id
      JOIN employees mgr ON emp.reporting_manager_id = mgr.id
      WHERE o.id = key_results.okr_id AND mgr.user_id = auth.uid()
      AND o.status IN ('submitted', 'approved')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM okrs o
      JOIN employees emp ON o.employee_id = emp.id
      JOIN employees mgr ON emp.reporting_manager_id = mgr.id
      WHERE o.id = okr_id AND mgr.user_id = auth.uid()
    )
  );

-- Step 7: Index for review comments
CREATE INDEX IF NOT EXISTS idx_okr_review_comments_okr_id ON okr_review_comments(okr_id);
CREATE INDEX IF NOT EXISTS idx_okr_review_comments_reviewer ON okr_review_comments(reviewer_employee_id);
