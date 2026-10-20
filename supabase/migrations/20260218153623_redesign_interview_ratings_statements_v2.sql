/*
  # Redesign Interview Ratings — Statement-Based Scoring (v2)

  Drops and recreates the table with the correct statement-based schema.
  The previous table had a computed total_score that prevents column drops,
  so we recreate cleanly. No data loss risk as this feature was just introduced.

  ## New Schema

  Each of the 4 assessment areas has 2 behavioral statements rated 1–10.
  Total score = sum of all 8 statements (max 80).

  ### Areas and Statements

  **Communication & Clarity**
  - comm_articulation_score: "Articulates ideas and responses clearly and concisely"
  - comm_listening_score: "Listens actively and responds to questions directly"

  **Role Fit & Experience**
  - role_experience_score: "Demonstrates relevant skills and prior experience for the role"
  - role_readiness_score: "Shows readiness to step into the role with minimal ramp-up"

  **Problem Solving & Thinking**
  - ps_structure_score: "Breaks down complex problems in a logical, structured way"
  - ps_initiative_score: "Shows independent thinking and brings forward solutions proactively"

  **Culture & Values Alignment**
  - culture_teamwork_score: "Demonstrates genuine team orientation and collaborative mindset"
  - culture_growth_score: "Shows openness to feedback and a visible growth orientation"
*/

DROP TABLE IF EXISTS candidate_interview_ratings;

CREATE TABLE candidate_interview_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rated_by uuid NOT NULL REFERENCES user_profiles(id),
  rated_at timestamptz DEFAULT now(),
  interview_date date,

  comm_articulation_score smallint NOT NULL DEFAULT 5 CHECK (comm_articulation_score BETWEEN 1 AND 10),
  comm_listening_score smallint NOT NULL DEFAULT 5 CHECK (comm_listening_score BETWEEN 1 AND 10),

  role_experience_score smallint NOT NULL DEFAULT 5 CHECK (role_experience_score BETWEEN 1 AND 10),
  role_readiness_score smallint NOT NULL DEFAULT 5 CHECK (role_readiness_score BETWEEN 1 AND 10),

  ps_structure_score smallint NOT NULL DEFAULT 5 CHECK (ps_structure_score BETWEEN 1 AND 10),
  ps_initiative_score smallint NOT NULL DEFAULT 5 CHECK (ps_initiative_score BETWEEN 1 AND 10),

  culture_teamwork_score smallint NOT NULL DEFAULT 5 CHECK (culture_teamwork_score BETWEEN 1 AND 10),
  culture_growth_score smallint NOT NULL DEFAULT 5 CHECK (culture_growth_score BETWEEN 1 AND 10),

  total_score smallint GENERATED ALWAYS AS (
    comm_articulation_score + comm_listening_score +
    role_experience_score + role_readiness_score +
    ps_structure_score + ps_initiative_score +
    culture_teamwork_score + culture_growth_score
  ) STORED,

  overall_notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_interview_ratings_candidate ON candidate_interview_ratings(candidate_id);
CREATE INDEX idx_interview_ratings_org ON candidate_interview_ratings(organization_id);

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
