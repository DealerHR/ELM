/*
  # First-login password change

  Adds `must_change_password` to user_profiles. The create-org-employee
  function sets it to true for every account it creates with a temporary
  password. The app shows a change-password screen before anything else
  while the flag is set, and clears it once the password is changed.
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
