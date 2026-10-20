/*
  # Allow NULL options for forced-choice questions
  Forced-choice questions only use option_1 and option_2, so option_3-5 must be nullable.
*/

ALTER TABLE growth_profile_questions
  ALTER COLUMN option_3 DROP NOT NULL,
  ALTER COLUMN option_4 DROP NOT NULL,
  ALTER COLUMN option_5 DROP NOT NULL;
