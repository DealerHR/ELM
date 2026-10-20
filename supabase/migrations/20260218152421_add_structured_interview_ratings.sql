/*
  # Add Structured Interview Ratings

  Replaces the single interview_score field with a structured 4-bucket rating framework.
  Each bucket is scored 1-2, giving a maximum total of 8 points.

  ## New Table: candidate_interview_ratings

  Stores one rating record per interview per candidate.

  ### Columns
  - `id` — UUID primary key
  - `candidate_id` — FK to candidates
  - `organization_id` — FK to organizations (for RLS)
  - `rated_by` — FK to user_profiles (the HR manager who filled this in)
  - `rated_at` — timestamp of when the rating was submitted

  ### The 4 Rating Buckets (each scored 1 or 2)
  - `communication_score` — Communication & Clarity (1=Needs Improvement, 2=Meets Expectation)
  - `role_fit_score` — Role Fit & Experience (1=Partial Fit, 2=Strong Fit)
  - `problem_solving_score` — Problem Solving & Thinking (1=Basic, 2=Structured)
  - `culture_add_score` — Culture & Values Alignment (1=Some Alignment, 2=Strong Alignment)

  ### Derived
  - `total_score` — computed column (sum of the 4 buckets, range 4-8)
  - `overall_notes` — free-form notes for the interview

  ## Security
  - RLS enabled
  - HR managers and admins of the same org can insert/view
  - Rated_by user can update their own rating
*/

CREATE TABLE IF NOT EXISTS candidate_interview_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rated_by uuid NOT NULL REFERENCES user_profiles(id),
  rated_at timestamptz DEFAULT now(),

  communication_score smallint NOT NULL DEFAULT 1 CHECK (communication_score IN (1, 2)),
  role_fit_score smallint NOT NULL DEFAULT 1 CHECK (role_fit_score IN (1, 2)),
  problem_solving_score smallint NOT NULL DEFAULT 1 CHECK (problem_solving_score IN (1, 2)),
  culture_add_score smallint NOT NULL DEFAULT 1 CHECK (culture_add_score IN (1, 2)),

  total_score smallint GENERATED ALWAYS AS (communication_score + role_fit_score + problem_solving_score + culture_add_score) STORED,

  overall_notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_ratings_candidate ON candidate_interview_ratings(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_ratings_org ON candidate_interview_ratings(organization_id);

ALTER TABLE candidate_interview_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view interview ratings"
  ON candidate_interview_ratings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = candidate_interview_ratings.organization_id
    )
  );

CREATE POLICY "HR managers and admins can insert interview ratings"
  ON candidate_interview_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    rated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = candidate_interview_ratings.organization_id
      AND user_profiles.role IN ('hr_manager', 'org_admin', 'platform_admin')
    )
  );

CREATE POLICY "Rater can update own rating"
  ON candidate_interview_ratings FOR UPDATE
  TO authenticated
  USING (rated_by = auth.uid())
  WITH CHECK (rated_by = auth.uid());

CREATE POLICY "Rater can delete own rating"
  ON candidate_interview_ratings FOR DELETE
  TO authenticated
  USING (rated_by = auth.uid());
