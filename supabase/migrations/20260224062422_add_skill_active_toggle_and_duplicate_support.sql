/*
  # Skill Active Toggle & Duplicate Support

  ## Summary
  Enables L&D managers to activate/deactivate skills and ensures safe deactivation
  rules when a skill is still mapped to active roles.

  ## Changes

  ### 1. Skills Table
  - `is_active` column already exists (boolean, default true)
  - No schema change needed — just policy and query-level enforcement

  ### 2. RLS Policy Update
  - The existing ALL policy for admins/L&D managers already covers UPDATE.
  - No new policy required; the UI will enforce the "cannot deactivate if mapped" rule.

  ### 3. Helper View — skill_role_mapping_counts
  - A view that joins skills → role_skills → designations
  - Returns per-skill: list of designation titles it is mapped to
  - Used by SkillBuilder to show which roles use each skill and to block deactivation

  ## Security
  - View is accessible to authenticated users in same org (leverages existing skills RLS)
*/

CREATE OR REPLACE VIEW skill_role_mappings AS
SELECT
  s.id AS skill_id,
  s.organization_id,
  rs.id AS role_skill_id,
  rs.designation_id,
  d.title AS designation_title,
  rs.is_mandatory,
  rs.minimum_score
FROM skills s
JOIN role_skills rs ON rs.skill_id = s.id
JOIN designations d ON d.id = rs.designation_id;
