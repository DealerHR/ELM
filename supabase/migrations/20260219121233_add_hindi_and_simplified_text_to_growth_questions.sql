/*
  # Add Hindi translations and simplified English to growth_profile_questions

  ## Summary
  Adds two sets of new columns:
  1. Simplified English versions of question text and options (question_text_simple, option_1_simple ... option_5_simple)
  2. Hindi translations of the simplified text (question_text_hi, option_1_hi ... option_5_hi)

  The default display remains the original (or simplified) English.
  A per-question toggle in the UI allows test takers to view the question in Hindi.

  ## New Columns
  - question_text_simple: Simplified plain-language English version of the question
  - option_1_simple ... option_5_simple: Simplified English options
  - question_text_hi: Hindi translation of the simplified question
  - option_1_hi ... option_5_hi: Hindi translations of the simplified options
*/

ALTER TABLE growth_profile_questions
  ADD COLUMN IF NOT EXISTS question_text_simple text,
  ADD COLUMN IF NOT EXISTS option_1_simple text,
  ADD COLUMN IF NOT EXISTS option_2_simple text,
  ADD COLUMN IF NOT EXISTS option_3_simple text,
  ADD COLUMN IF NOT EXISTS option_4_simple text,
  ADD COLUMN IF NOT EXISTS option_5_simple text,
  ADD COLUMN IF NOT EXISTS question_text_hi text,
  ADD COLUMN IF NOT EXISTS option_1_hi text,
  ADD COLUMN IF NOT EXISTS option_2_hi text,
  ADD COLUMN IF NOT EXISTS option_3_hi text,
  ADD COLUMN IF NOT EXISTS option_4_hi text,
  ADD COLUMN IF NOT EXISTS option_5_hi text;
