/*
  # Add Anti-Faking Columns to Growth Profile Questions

  ## Summary
  Adds support for forced-choice question format and social desirability detection
  to the growth profile assessment system.

  ## Changes
  - Adds `question_format` column to distinguish standard (rating scale) vs
    forced_choice (pick A or B) question types
  - Adds `is_social_desirability_trap` boolean to flag items used for
    over-claiming / social desirability detection
  - Adds `scoring_key` jsonb to store hidden answer-to-score mapping
    (allows correct answer to be any option, not always option 5)
  - Adds `question_category` for display grouping without revealing scoring direction
  - Adds `display_randomize` boolean to allow per-dimension question order shuffling

  ## Anti-Faking Notes
  - forced_choice questions show only option_1 and option_2; answer_value 1 = A, 2 = B
  - social_desirability_trap items feed into a separate suspicion_index calculation
  - scoring_key overrides the default 1-5 linear scoring; e.g., {"3": 5, "1": 3}
    means selecting option 3 scores 5 points
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'growth_profile_questions' AND column_name = 'question_format'
  ) THEN
    ALTER TABLE growth_profile_questions
      ADD COLUMN question_format text NOT NULL DEFAULT 'rating_scale'
        CHECK (question_format IN ('rating_scale', 'forced_choice'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'growth_profile_questions' AND column_name = 'is_social_desirability_trap'
  ) THEN
    ALTER TABLE growth_profile_questions
      ADD COLUMN is_social_desirability_trap boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'growth_profile_questions' AND column_name = 'scoring_key'
  ) THEN
    ALTER TABLE growth_profile_questions
      ADD COLUMN scoring_key jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_growth_assessments' AND column_name = 'social_desirability_index'
  ) THEN
    ALTER TABLE candidate_growth_assessments
      ADD COLUMN social_desirability_index real;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'growth_profile_scores' AND column_name = 'social_desirability_index'
  ) THEN
    ALTER TABLE growth_profile_scores
      ADD COLUMN social_desirability_index real;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'growth_profile_scores' AND column_name = 'response_validity'
  ) THEN
    ALTER TABLE growth_profile_scores
      ADD COLUMN response_validity text DEFAULT 'valid'
        CHECK (response_validity IN ('valid', 'caution', 'suspect'));
  END IF;
END $$;
