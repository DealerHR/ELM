/*
  # Growth Profile Assessment System

  1. New Tables
    - `growth_profile_questions`
      - Stores the 50 standardized Growth Profile questions
      - Maps to dimensions and sub-dimensions
      - Includes reverse scoring flags
      - Platform-admin controlled (cannot be edited by organizations)
    
    - `growth_profile_templates`
      - Three level-specific templates (Entry, Mid, Senior)
      - Defines dimension weightings for each level
      - System-level templates maintained by platform
    
    - `candidate_growth_assessments`
      - Tracks Growth Profile assessment instances sent to candidates
      - Links candidate, level, and invitation
      - Stores completion status and timing
    
    - `candidate_growth_responses`
      - Individual question responses from candidates
      - Maps to questions and assessment instances
      - Stores raw answer values
    
    - `growth_profile_scores`
      - Calculated scores at all levels
      - Overall score, dimension scores, sub-dimension scores
      - Percentile rankings
      - Score explainer data
    
    - `candidate_domain_assessments`
      - Organization-specific domain knowledge assessments
      - Created by HR managers
      - Custom questions per organization
    
    - `assessment_invitations`
      - Unified invitation system
      - Can include Growth Profile, Domain, or both
      - Tracks invitation status and completion

  2. Security
    - Enable RLS on all tables
    - Platform admins can manage Growth Profile questions
    - HR managers can create domain assessments
    - Candidates can only access their own assessments
    - Scores visible to HR and platform admins
*/

-- Growth Profile Questions (Platform-level, standardized)
CREATE TABLE IF NOT EXISTS growth_profile_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_number integer NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('adaptability_learning', 'initiative_ownership', 'collaboration_team', 'resilience_stress', 'growth_curiosity')),
  sub_dimension text NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('situational', 'behavioral_frequency', 'attitudinal')),
  answer_scale text NOT NULL CHECK (answer_scale IN ('likert_5', 'frequency_5', 'choice_best_worst')),
  option_1 text NOT NULL,
  option_2 text NOT NULL,
  option_3 text NOT NULL,
  option_4 text NOT NULL,
  option_5 text NOT NULL,
  is_reverse_scored boolean DEFAULT false,
  sub_dimension_weight real NOT NULL DEFAULT 0.25,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(question_number)
);

-- Growth Profile Templates (Level-specific weightings)
CREATE TABLE IF NOT EXISTS growth_profile_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('entry', 'mid', 'senior')),
  display_name text NOT NULL,
  description text NOT NULL,
  adaptability_learning_weight real NOT NULL,
  initiative_ownership_weight real NOT NULL,
  collaboration_team_weight real NOT NULL,
  resilience_stress_weight real NOT NULL,
  growth_curiosity_weight real NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(level)
);

-- Candidate Growth Profile Assessments
CREATE TABLE IF NOT EXISTS candidate_growth_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES growth_profile_templates(id),
  level text NOT NULL,
  invitation_token text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Candidate Growth Profile Responses
CREATE TABLE IF NOT EXISTS candidate_growth_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES candidate_growth_assessments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES growth_profile_questions(id),
  answer_value integer NOT NULL CHECK (answer_value BETWEEN 1 AND 5),
  responded_at timestamptz DEFAULT now(),
  UNIQUE(assessment_id, question_id)
);

-- Growth Profile Scores
CREATE TABLE IF NOT EXISTS growth_profile_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES candidate_growth_assessments(id) ON DELETE CASCADE UNIQUE,
  candidate_id uuid NOT NULL REFERENCES candidates(id),
  
  -- Overall Score
  overall_score real NOT NULL,
  overall_percentile integer,
  fit_level text NOT NULL CHECK (fit_level IN ('limited', 'developing', 'good', 'strong', 'exceptional')),
  
  -- Dimension Scores
  adaptability_learning_score real NOT NULL,
  adaptability_learning_percentile integer,
  
  initiative_ownership_score real NOT NULL,
  initiative_ownership_percentile integer,
  
  collaboration_team_score real NOT NULL,
  collaboration_team_percentile integer,
  
  resilience_stress_score real NOT NULL,
  resilience_stress_percentile integer,
  
  growth_curiosity_score real NOT NULL,
  growth_curiosity_percentile integer,
  
  -- Sub-dimension Scores (JSON for flexibility)
  sub_dimension_scores jsonb NOT NULL,
  
  -- Score Explainer
  calculation_details jsonb NOT NULL,
  
  -- Behavioral Indicators
  strengths text[],
  development_areas text[],
  
  calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Domain Knowledge Assessments (Organization-specific)
CREATE TABLE IF NOT EXISTS candidate_domain_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  designation_id uuid REFERENCES designations(id),
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Domain Assessment Questions
CREATE TABLE IF NOT EXISTS domain_assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES candidate_domain_assessments(id) ON DELETE CASCADE,
  question_number integer NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay')),
  options jsonb,
  correct_answer text,
  points integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Candidate Domain Assessment Attempts
CREATE TABLE IF NOT EXISTS candidate_domain_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES candidate_domain_assessments(id) ON DELETE CASCADE,
  invitation_token text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  score real,
  max_score real,
  percentage real,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Domain Assessment Responses
CREATE TABLE IF NOT EXISTS candidate_domain_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES candidate_domain_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES domain_assessment_questions(id),
  answer_text text NOT NULL,
  is_correct boolean,
  points_awarded integer,
  responded_at timestamptz DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

-- Unified Assessment Invitations
CREATE TABLE IF NOT EXISTS assessment_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  designation_id uuid REFERENCES designations(id),
  
  -- What's included
  include_growth_profile boolean DEFAULT false,
  growth_profile_level text CHECK (growth_profile_level IN ('entry', 'mid', 'senior')),
  include_domain_assessment boolean DEFAULT false,
  domain_assessment_id uuid REFERENCES candidate_domain_assessments(id),
  
  -- Tracking
  growth_assessment_id uuid REFERENCES candidate_growth_assessments(id),
  domain_attempt_id uuid REFERENCES candidate_domain_attempts(id),
  
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'in_progress', 'completed', 'expired')),
  invitation_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  
  sent_by uuid REFERENCES user_profiles(id),
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_growth_questions_dimension ON growth_profile_questions(dimension);
CREATE INDEX IF NOT EXISTS idx_growth_assessments_candidate ON candidate_growth_assessments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_growth_assessments_status ON candidate_growth_assessments(status);
CREATE INDEX IF NOT EXISTS idx_growth_responses_assessment ON candidate_growth_responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_growth_scores_candidate ON growth_profile_scores(candidate_id);
CREATE INDEX IF NOT EXISTS idx_domain_assessments_org ON candidate_domain_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_domain_attempts_candidate ON candidate_domain_attempts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_invitations_candidate ON assessment_invitations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON assessment_invitations(invitation_token);

-- Row Level Security

ALTER TABLE growth_profile_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_profile_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_growth_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_growth_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_profile_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_domain_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_domain_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_domain_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_invitations ENABLE ROW LEVEL SECURITY;

-- Growth Profile Questions: Read-only for all, managed by platform admins
CREATE POLICY "Platform admins manage growth profile questions"
  ON growth_profile_questions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'platform_admin'
    )
  );

CREATE POLICY "All authenticated users can view growth profile questions"
  ON growth_profile_questions FOR SELECT
  TO authenticated
  USING (true);

-- Growth Profile Templates: Read by all, managed by platform
CREATE POLICY "All authenticated users can view templates"
  ON growth_profile_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Platform admins manage templates"
  ON growth_profile_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'platform_admin'
    )
  );

-- Candidate Growth Assessments: HR and admins manage, candidates view own
CREATE POLICY "HR creates growth assessments"
  ON candidate_growth_assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('hr', 'admin')
    )
  );

CREATE POLICY "HR and admins view growth assessments"
  ON candidate_growth_assessments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN candidates c ON c.organization_id = up.organization_id
      WHERE up.id = auth.uid()
      AND c.id = candidate_growth_assessments.candidate_id
      AND up.role IN ('hr', 'admin')
    )
  );

CREATE POLICY "HR updates growth assessments"
  ON candidate_growth_assessments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN candidates c ON c.organization_id = up.organization_id
      WHERE up.id = auth.uid()
      AND c.id = candidate_growth_assessments.candidate_id
      AND up.role IN ('hr', 'admin')
    )
  );

-- Growth Responses: Only assessment system creates
CREATE POLICY "System creates growth responses"
  ON candidate_growth_responses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "HR views growth responses"
  ON candidate_growth_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidate_growth_assessments cga
      JOIN candidates c ON c.id = cga.candidate_id
      JOIN user_profiles up ON up.organization_id = c.organization_id
      WHERE cga.id = candidate_growth_responses.assessment_id
      AND up.id = auth.uid()
      AND up.role IN ('hr', 'admin')
    )
  );

-- Growth Scores: HR and admins view
CREATE POLICY "System creates growth scores"
  ON growth_profile_scores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "HR views growth scores"
  ON growth_profile_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN user_profiles up ON up.organization_id = c.organization_id
      WHERE c.id = growth_profile_scores.candidate_id
      AND up.id = auth.uid()
      AND up.role IN ('hr', 'admin')
    )
  );

-- Domain Assessments: Organization-specific
CREATE POLICY "HR creates domain assessments"
  ON candidate_domain_assessments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = candidate_domain_assessments.organization_id
      AND user_profiles.role IN ('hr', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = candidate_domain_assessments.organization_id
      AND user_profiles.role IN ('hr', 'admin')
    )
  );

-- Domain Questions: Organization HR manages
CREATE POLICY "HR manages domain questions"
  ON domain_assessment_questions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidate_domain_assessments cda
      JOIN user_profiles up ON up.organization_id = cda.organization_id
      WHERE cda.id = domain_assessment_questions.assessment_id
      AND up.id = auth.uid()
      AND up.role IN ('hr', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidate_domain_assessments cda
      JOIN user_profiles up ON up.organization_id = cda.organization_id
      WHERE cda.id = domain_assessment_questions.assessment_id
      AND up.id = auth.uid()
      AND up.role IN ('hr', 'admin')
    )
  );

-- Domain Attempts: HR views
CREATE POLICY "HR manages domain attempts"
  ON candidate_domain_attempts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN user_profiles up ON up.organization_id = c.organization_id
      WHERE c.id = candidate_domain_attempts.candidate_id
      AND up.id = auth.uid()
      AND up.role IN ('hr', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN user_profiles up ON up.organization_id = c.organization_id
      WHERE c.id = candidate_domain_attempts.candidate_id
      AND up.id = auth.uid()
      AND up.role IN ('hr', 'admin')
    )
  );

-- Domain Responses: HR views
CREATE POLICY "System creates domain responses"
  ON candidate_domain_responses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "HR views domain responses"
  ON candidate_domain_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidate_domain_attempts cda
      JOIN candidates c ON c.id = cda.candidate_id
      JOIN user_profiles up ON up.organization_id = c.organization_id
      WHERE cda.id = candidate_domain_responses.attempt_id
      AND up.id = auth.uid()
      AND up.role IN ('hr', 'admin')
    )
  );

-- Assessment Invitations: HR manages
CREATE POLICY "HR manages invitations"
  ON assessment_invitations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = assessment_invitations.organization_id
      AND user_profiles.role IN ('hr', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = assessment_invitations.organization_id
      AND user_profiles.role IN ('hr', 'admin')
    )
  );

-- Insert Growth Profile Templates
INSERT INTO growth_profile_templates (level, display_name, description, adaptability_learning_weight, initiative_ownership_weight, collaboration_team_weight, resilience_stress_weight, growth_curiosity_weight) VALUES
('entry', 'Entry Level', 'For candidates with 0-2 years of experience. Emphasizes learning ability, teamwork, and growth potential.', 0.25, 0.15, 0.25, 0.15, 0.20),
('mid', 'Mid Level', 'For candidates with 3-7 years of experience. Balanced competencies with emphasis on ownership and resilience.', 0.20, 0.25, 0.20, 0.20, 0.15),
('senior', 'Senior Level', 'For candidates with 8+ years of experience. Requires high ownership, stress management, and proven adaptability.', 0.20, 0.30, 0.15, 0.25, 0.10)
ON CONFLICT (level) DO NOTHING;
