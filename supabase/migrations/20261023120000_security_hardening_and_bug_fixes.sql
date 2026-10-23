/*
  # Security hardening and bug fixes (23 Oct 2026)

  This migration closes the security holes found in the code review and fixes
  the schema-level bugs. It is written to be safe to re-run (IF EXISTS / OR REPLACE).

  ## 1. Roles and profiles
  - Users can no longer change their own `role` or `organization_id`.
  - Self-signup always creates an `employee` with no organisation
    (the first-user-becomes-admin trigger still applies).
  - Admins cannot grant `platform_admin`; HR cannot grant `admin` or `platform_admin`.
  - `setup_demo_user_profile` can no longer be called by ordinary users.

  ## 2. API keys
  - `platform_settings` is readable by platform admins only.
  - `ai_is_configured()` tells the UI whether a key is set without exposing it.

  ## 3. Candidate portal
  - All anonymous table policies are removed.
  - The portal now works through `portal_*` functions that require the exact,
    unexpired access code. The knowledge test is scored on the server and the
    answer key never leaves the database.

  ## 4. Row-level security clean-up
  - Policies that named roles which do not exist (`org_admin`, `ld_manager`,
    `hr_manager`) are rewritten so L&D managers and HR can actually use them.
  - Learning, skills and OKR policies are scoped to the user's organisation.
  - The old "manage OKRs" policy that bypassed the approval workflow is dropped.
  - `skill_questions` writes require an L&D or admin role.
  - `skill_role_mappings` view now respects RLS.
  - `resources` bucket writes are limited to admin / L&D / HR; `avatars` bucket is created.

  ## 5. Bugs
  - `okrs.status` default is now `draft` (the old default `active` failed the CHECK).
  - `updated_at` is maintained by a trigger on every table that has the column.
*/

-- ============================================================================
-- 0. Shared helpers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role(p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role = ANY(p_roles) FROM user_profiles WHERE id = auth.uid()), false);
$$;

-- ============================================================================
-- 1. Roles and profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_profile_role_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_is_first_user boolean;
BEGIN
  -- Service role, migrations and edge functions have no auth.uid(); let them through.
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role FROM user_profiles WHERE id = v_caller;

  IF TG_OP = 'INSERT' THEN
    IF NEW.id = v_caller THEN
      -- Self sign-up. The first-user trigger (which runs before this one) may
      -- have already made this person admin of the seed org; keep that only
      -- when the table was empty.
      SELECT NOT EXISTS (SELECT 1 FROM user_profiles) INTO v_is_first_user;
      IF NOT v_is_first_user THEN
        NEW.role := 'employee';
        NEW.organization_id := NULL;
      END IF;
      RETURN NEW;
    END IF;

    -- Someone creating another person's profile.
    IF NEW.role = 'platform_admin' AND v_caller_role IS DISTINCT FROM 'platform_admin' THEN
      RAISE EXCEPTION 'Only a platform admin can create a platform admin';
    END IF;
    IF v_caller_role = 'hr' AND NEW.role IN ('admin', 'platform_admin') THEN
      RAISE EXCEPTION 'HR cannot create admin accounts';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.id = v_caller AND v_caller_role IS DISTINCT FROM 'platform_admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role';
    END IF;
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'You cannot change your own organisation';
    END IF;
    RETURN NEW;
  END IF;

  IF v_caller_role IS DISTINCT FROM 'platform_admin' THEN
    IF NEW.role = 'platform_admin' OR OLD.role = 'platform_admin' THEN
      RAISE EXCEPTION 'Only a platform admin can grant or remove platform admin';
    END IF;
    IF v_caller_role = 'hr' AND NEW.role IN ('admin', 'platform_admin') AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'HR cannot grant admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Name starts with "zz_" so it runs after trigger_auto_assign_first_user_admin
-- (triggers on the same event fire in alphabetical order).
DROP TRIGGER IF EXISTS zz_enforce_profile_role_rules ON user_profiles;
CREATE TRIGGER zz_enforce_profile_role_rules
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_role_rules();

-- Demo-setup RPC: only callable with the service role from now on.
REVOKE EXECUTE ON FUNCTION public.setup_demo_user_profile(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 2. API keys
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read settings" ON platform_settings;

CREATE POLICY "Platform admin can read settings"
  ON platform_settings FOR SELECT
  TO authenticated
  USING (current_user_has_role(ARRAY['platform_admin']));

CREATE OR REPLACE FUNCTION public.ai_is_configured()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'openai_api_key' AND value IS NOT NULL AND value <> ''
  );
$$;
REVOKE EXECUTE ON FUNCTION public.ai_is_configured() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_is_configured() TO authenticated;

-- ============================================================================
-- 3. Candidate portal: remove anonymous table access
-- ============================================================================

-- Current assessment system
DROP POLICY IF EXISTS "Anyone can look up invitation by access code" ON assessment_invitations;
DROP POLICY IF EXISTS "Anyone can update invitation progress by access code" ON assessment_invitations;
DROP POLICY IF EXISTS "Anonymous can insert growth responses" ON candidate_growth_responses;
DROP POLICY IF EXISTS "Anonymous can read growth responses" ON candidate_growth_responses;
DROP POLICY IF EXISTS "Anonymous can read growth questions" ON growth_profile_questions;
DROP POLICY IF EXISTS "Anonymous can read domain questions" ON domain_assessment_questions;
DROP POLICY IF EXISTS "Anonymous can read domain assessments" ON candidate_domain_assessments;
DROP POLICY IF EXISTS "Anonymous can insert domain attempts" ON candidate_domain_attempts;
DROP POLICY IF EXISTS "Anonymous can update domain attempts" ON candidate_domain_attempts;
DROP POLICY IF EXISTS "Anonymous can select domain attempts" ON candidate_domain_attempts;
DROP POLICY IF EXISTS "Anonymous can read growth assessments" ON candidate_growth_assessments;
DROP POLICY IF EXISTS "Anonymous can update growth assessments" ON candidate_growth_assessments;
DROP POLICY IF EXISTS "Anonymous can insert domain responses" ON candidate_domain_responses;
DROP POLICY IF EXISTS "Anonymous can read own domain responses" ON candidate_domain_responses;

-- Legacy assessment system (unused by the UI)
DROP POLICY IF EXISTS "Public can view assessment via valid token" ON candidate_assessments;
DROP POLICY IF EXISTS "Public can update via valid token" ON candidate_assessments;
DROP POLICY IF EXISTS "Public can submit answers" ON candidate_assessment_answers;
DROP POLICY IF EXISTS "Public can view own answers" ON candidate_assessment_answers;
DROP POLICY IF EXISTS "Public can view questions" ON assessment_questions;

-- "System creates ..." policies let any signed-in user write scores/responses.
-- The portal functions below and the edge function (service role) do not need them.
DROP POLICY IF EXISTS "System creates growth responses" ON candidate_growth_responses;
DROP POLICY IF EXISTS "System creates growth scores" ON growth_profile_scores;
DROP POLICY IF EXISTS "System creates domain responses" ON candidate_domain_responses;

-- Belt and braces: anon gets no direct table access to these at all.
REVOKE ALL ON
  assessment_invitations, candidate_growth_assessments, candidate_growth_responses,
  growth_profile_questions, growth_profile_scores, candidate_domain_assessments,
  domain_assessment_questions, candidate_domain_attempts, candidate_domain_responses,
  candidates, organizations
FROM anon;

-- ============================================================================
-- 3b. Candidate portal: secure functions keyed by access code
-- ============================================================================

-- Internal: fetch a live invitation for a code, or raise.
CREATE OR REPLACE FUNCTION public.portal_invitation_for_code(p_code text)
RETURNS assessment_invitations LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv assessment_invitations;
BEGIN
  SELECT * INTO v_inv
  FROM assessment_invitations
  WHERE access_code = upper(trim(p_code))
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CODE' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'EXPIRED' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_inv;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.portal_invitation_for_code(text) FROM PUBLIC, anon, authenticated;

-- Internal: mark the invitation complete once every included test is done.
CREATE OR REPLACE FUNCTION public.portal_finalize_if_done(p_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv assessment_invitations;
  v_growth_done boolean := true;
  v_domain_done boolean := true;
BEGIN
  SELECT * INTO v_inv FROM assessment_invitations WHERE id = p_invitation_id;
  IF v_inv.id IS NULL OR v_inv.status = 'completed' THEN RETURN; END IF;

  IF v_inv.include_growth_profile THEN
    SELECT COALESCE(status = 'completed', false) INTO v_growth_done
    FROM candidate_growth_assessments WHERE id = v_inv.growth_assessment_id;
  END IF;
  IF v_inv.include_domain_assessment THEN
    SELECT COALESCE(status = 'completed', false) INTO v_domain_done
    FROM candidate_domain_attempts WHERE invitation_token = v_inv.id::text;
  END IF;

  IF v_growth_done AND v_domain_done THEN
    UPDATE assessment_invitations SET status = 'completed' WHERE id = p_invitation_id;
    UPDATE candidates SET status = 'assessment_completed' WHERE id = v_inv.candidate_id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.portal_finalize_if_done(uuid) FROM PUBLIC, anon, authenticated;

-- Public: look up an invitation by code. Returns what the portal needs and
-- nothing else. Marks a fresh invitation as opened.
CREATE OR REPLACE FUNCTION public.portal_get_invitation(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv assessment_invitations;
  v_org_name text;
  v_growth_status text;
  v_domain_status text;
BEGIN
  v_inv := portal_invitation_for_code(p_code);

  IF v_inv.status = 'sent' THEN
    UPDATE assessment_invitations SET status = 'opened' WHERE id = v_inv.id;
    v_inv.status := 'opened';
  END IF;

  v_org_name := v_inv.organization_name;
  IF v_org_name IS NULL THEN
    SELECT name INTO v_org_name FROM organizations WHERE id = v_inv.organization_id;
  END IF;

  IF v_inv.growth_assessment_id IS NOT NULL THEN
    SELECT status INTO v_growth_status FROM candidate_growth_assessments WHERE id = v_inv.growth_assessment_id;
  END IF;
  SELECT status INTO v_domain_status FROM candidate_domain_attempts WHERE invitation_token = v_inv.id::text;

  RETURN jsonb_build_object(
    'id', v_inv.id,
    'candidate_name', v_inv.candidate_name,
    'organization_name', v_org_name,
    'access_code', v_inv.access_code,
    'status', v_inv.status,
    'include_growth_profile', COALESCE(v_inv.include_growth_profile, false),
    'include_domain_assessment', COALESCE(v_inv.include_domain_assessment, false),
    'growth_profile_level', v_inv.growth_profile_level,
    'has_growth_assessment', v_inv.growth_assessment_id IS NOT NULL,
    'has_domain_assessment', v_inv.domain_assessment_id IS NOT NULL,
    'growth_status', v_growth_status,
    'domain_status', v_domain_status,
    'expires_at', v_inv.expires_at
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_get_invitation(text) TO anon, authenticated;

-- Public: growth profile questions (no scoring key).
CREATE OR REPLACE FUNCTION public.portal_get_growth_questions(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv assessment_invitations;
BEGIN
  v_inv := portal_invitation_for_code(p_code);
  IF NOT COALESCE(v_inv.include_growth_profile, false) THEN
    RAISE EXCEPTION 'NOT_INCLUDED';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', q.id,
      'question_number', q.question_number,
      'dimension', q.dimension,
      'question_text', q.question_text,
      'question_text_simple', q.question_text_simple,
      'question_text_hi', q.question_text_hi,
      'question_type', q.question_type,
      'answer_scale', q.answer_scale,
      'question_format', q.question_format,
      'option_1', q.option_1, 'option_2', q.option_2, 'option_3', q.option_3, 'option_4', q.option_4, 'option_5', q.option_5,
      'option_1_simple', q.option_1_simple, 'option_2_simple', q.option_2_simple, 'option_3_simple', q.option_3_simple, 'option_4_simple', q.option_4_simple, 'option_5_simple', q.option_5_simple,
      'option_1_hi', q.option_1_hi, 'option_2_hi', q.option_2_hi, 'option_3_hi', q.option_3_hi, 'option_4_hi', q.option_4_hi, 'option_5_hi', q.option_5_hi
    ) ORDER BY q.question_number)
    FROM growth_profile_questions q
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_get_growth_questions(text) TO anon, authenticated;

-- Public: saved growth answers for resume.
CREATE OR REPLACE FUNCTION public.portal_get_growth_responses(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv assessment_invitations;
BEGIN
  v_inv := portal_invitation_for_code(p_code);
  IF v_inv.growth_assessment_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('question_id', r.question_id, 'answer_value', r.answer_value))
    FROM candidate_growth_responses r
    WHERE r.assessment_id = v_inv.growth_assessment_id
  ), '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_get_growth_responses(text) TO anon, authenticated;

-- Public: save (upsert) a batch of growth answers. p_responses = [{question_id, answer_value}, ...]
CREATE OR REPLACE FUNCTION public.portal_save_growth_responses(p_code text, p_responses jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv assessment_invitations;
  v_status text;
BEGIN
  v_inv := portal_invitation_for_code(p_code);
  IF v_inv.growth_assessment_id IS NULL THEN RAISE EXCEPTION 'NOT_INCLUDED'; END IF;

  SELECT status INTO v_status FROM candidate_growth_assessments WHERE id = v_inv.growth_assessment_id;
  IF v_status = 'completed' THEN RAISE EXCEPTION 'ALREADY_COMPLETED'; END IF;

  INSERT INTO candidate_growth_responses (assessment_id, question_id, answer_value, responded_at)
  SELECT v_inv.growth_assessment_id,
         (r->>'question_id')::uuid,
         (r->>'answer_value')::int,
         now()
  FROM jsonb_array_elements(p_responses) r
  WHERE (r->>'answer_value')::int BETWEEN 1 AND 5
  ON CONFLICT (assessment_id, question_id)
  DO UPDATE SET answer_value = EXCLUDED.answer_value, responded_at = now();

  UPDATE candidate_growth_assessments
  SET status = 'in_progress', started_at = COALESCE(started_at, now())
  WHERE id = v_inv.growth_assessment_id AND status = 'pending';

  UPDATE assessment_invitations SET status = 'in_progress'
  WHERE id = v_inv.id AND status IN ('sent', 'opened');
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_save_growth_responses(text, jsonb) TO anon, authenticated;

-- Public: finish the growth test. Requires every question answered.
-- Returns the assessment id so the client can ask the edge function to score it.
CREATE OR REPLACE FUNCTION public.portal_complete_growth(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv assessment_invitations;
  v_answered int;
  v_total int;
BEGIN
  v_inv := portal_invitation_for_code(p_code);
  IF v_inv.growth_assessment_id IS NULL THEN RAISE EXCEPTION 'NOT_INCLUDED'; END IF;

  SELECT count(*) INTO v_total FROM growth_profile_questions;
  SELECT count(*) INTO v_answered FROM candidate_growth_responses WHERE assessment_id = v_inv.growth_assessment_id;
  IF v_answered < v_total THEN
    RAISE EXCEPTION 'INCOMPLETE: % of % answered', v_answered, v_total;
  END IF;

  UPDATE candidate_growth_assessments
  SET status = 'completed', completed_at = COALESCE(completed_at, now())
  WHERE id = v_inv.growth_assessment_id;

  UPDATE assessment_invitations
  SET growth_completed_at = COALESCE(growth_completed_at, now())
  WHERE id = v_inv.id;

  PERFORM portal_finalize_if_done(v_inv.id);

  RETURN jsonb_build_object('assessment_id', v_inv.growth_assessment_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_complete_growth(text) TO anon, authenticated;

-- Public: domain test metadata + questions WITHOUT answers. Creates the attempt.
CREATE OR REPLACE FUNCTION public.portal_get_domain_test(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv assessment_invitations;
  v_attempt candidate_domain_attempts;
  v_meta jsonb;
  v_questions jsonb;
BEGIN
  v_inv := portal_invitation_for_code(p_code);
  IF NOT COALESCE(v_inv.include_domain_assessment, false) OR v_inv.domain_assessment_id IS NULL THEN
    RAISE EXCEPTION 'NOT_INCLUDED';
  END IF;

  SELECT * INTO v_attempt FROM candidate_domain_attempts WHERE invitation_token = v_inv.id::text;
  IF v_attempt.id IS NULL THEN
    INSERT INTO candidate_domain_attempts (candidate_id, assessment_id, invitation_token, status, started_at)
    VALUES (v_inv.candidate_id, v_inv.domain_assessment_id, v_inv.id::text, 'in_progress', now())
    RETURNING * INTO v_attempt;
    UPDATE assessment_invitations SET domain_attempt_id = v_attempt.id, status = 'in_progress'
    WHERE id = v_inv.id AND status IN ('sent', 'opened');
  END IF;

  SELECT jsonb_build_object('id', a.id, 'title', a.title, 'description', a.description)
  INTO v_meta FROM candidate_domain_assessments a WHERE a.id = v_inv.domain_assessment_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'question_number', q.question_number,
    'question_text', q.question_text,
    'question_type', q.question_type,
    'options', q.options,
    'points', q.points
  ) ORDER BY q.question_number), '[]'::jsonb)
  INTO v_questions FROM domain_assessment_questions q WHERE q.assessment_id = v_inv.domain_assessment_id;

  RETURN jsonb_build_object(
    'assessment', v_meta,
    'questions', v_questions,
    'attempt_id', v_attempt.id,
    'attempt_status', v_attempt.status
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_get_domain_test(text) TO anon, authenticated;

-- Public: submit domain answers. Scored here; the answer key never leaves the DB.
-- p_answers = {"<question_id>": "<answer text>", ...}
CREATE OR REPLACE FUNCTION public.portal_submit_domain(p_code text, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv assessment_invitations;
  v_attempt candidate_domain_attempts;
  v_score numeric := 0;
  v_max numeric := 0;
  v_pct int;
  v_missing int;
BEGIN
  v_inv := portal_invitation_for_code(p_code);
  IF v_inv.domain_assessment_id IS NULL THEN RAISE EXCEPTION 'NOT_INCLUDED'; END IF;

  SELECT * INTO v_attempt FROM candidate_domain_attempts WHERE invitation_token = v_inv.id::text;
  IF v_attempt.id IS NULL THEN RAISE EXCEPTION 'NO_ATTEMPT'; END IF;
  IF v_attempt.status = 'completed' THEN RAISE EXCEPTION 'ALREADY_COMPLETED'; END IF;

  SELECT count(*) INTO v_missing
  FROM domain_assessment_questions q
  WHERE q.assessment_id = v_inv.domain_assessment_id
    AND COALESCE(p_answers->>(q.id::text), '') = '';
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'INCOMPLETE: % unanswered', v_missing;
  END IF;

  INSERT INTO candidate_domain_responses (attempt_id, question_id, answer_text, is_correct, points_awarded, responded_at)
  SELECT v_attempt.id,
         q.id,
         p_answers->>(q.id::text),
         CASE WHEN q.correct_answer IS NULL THEN NULL
              ELSE lower(trim(p_answers->>(q.id::text))) = lower(trim(q.correct_answer)) END,
         CASE WHEN q.correct_answer IS NULL THEN NULL
              WHEN lower(trim(p_answers->>(q.id::text))) = lower(trim(q.correct_answer)) THEN COALESCE(q.points, 1)
              ELSE 0 END,
         now()
  FROM domain_assessment_questions q
  WHERE q.assessment_id = v_inv.domain_assessment_id
  ON CONFLICT (attempt_id, question_id)
  DO UPDATE SET answer_text = EXCLUDED.answer_text,
                is_correct = EXCLUDED.is_correct,
                points_awarded = EXCLUDED.points_awarded,
                responded_at = now();

  SELECT COALESCE(sum(COALESCE(q.points, 1)), 0),
         COALESCE(sum(COALESCE(r.points_awarded, 0)), 0)
  INTO v_max, v_score
  FROM domain_assessment_questions q
  LEFT JOIN candidate_domain_responses r ON r.question_id = q.id AND r.attempt_id = v_attempt.id
  WHERE q.assessment_id = v_inv.domain_assessment_id;

  v_pct := CASE WHEN v_max > 0 THEN round(v_score / v_max * 100) ELSE 0 END;

  UPDATE candidate_domain_attempts
  SET status = 'completed', score = v_score, max_score = v_max, percentage = v_pct, completed_at = now()
  WHERE id = v_attempt.id;

  UPDATE assessment_invitations
  SET domain_score = v_pct, domain_attempt_id = v_attempt.id, domain_completed_at = now(),
      status = CASE WHEN status = 'completed' THEN status ELSE 'in_progress' END
  WHERE id = v_inv.id;

  PERFORM portal_finalize_if_done(v_inv.id);

  RETURN jsonb_build_object('score', v_score, 'max_score', v_max, 'percentage', v_pct);
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_submit_domain(text, jsonb) TO anon, authenticated;

-- ============================================================================
-- 4. RLS clean-up
-- ============================================================================

-- 4a. Course delivery tables: real role names + organisation scope ------------

DROP POLICY IF EXISTS "LD and admins can insert quiz questions" ON module_quiz_questions;
DROP POLICY IF EXISTS "LD and admins can update quiz questions" ON module_quiz_questions;
DROP POLICY IF EXISTS "LD and admins can delete quiz questions" ON module_quiz_questions;

CREATE POLICY "LD and admins manage quiz questions"
  ON module_quiz_questions FOR ALL TO authenticated
  USING (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr'])
    AND EXISTS (
      SELECT 1 FROM learning_modules lm JOIN learning_courses lc ON lc.id = lm.course_id
      WHERE lm.id = module_quiz_questions.module_id AND lc.organization_id = current_user_org()
    )
  )
  WITH CHECK (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr'])
    AND EXISTS (
      SELECT 1 FROM learning_modules lm JOIN learning_courses lc ON lc.id = lm.course_id
      WHERE lm.id = module_quiz_questions.module_id AND lc.organization_id = current_user_org()
    )
  );

DROP POLICY IF EXISTS "Employees can read own quiz responses" ON module_quiz_responses;
CREATE POLICY "Employees can read own quiz responses"
  ON module_quiz_responses FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees e WHERE e.id = module_quiz_responses.employee_id AND e.user_id = auth.uid())
    OR (
      current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr', 'manager'])
      AND EXISTS (SELECT 1 FROM employees e WHERE e.id = module_quiz_responses.employee_id AND e.organization_id = current_user_org())
    )
  );

DROP POLICY IF EXISTS "LD and admins can insert certifications" ON ld_certifications;
DROP POLICY IF EXISTS "LD and admins can view all certifications" ON ld_certifications;

CREATE POLICY "LD and admins can insert certifications"
  ON ld_certifications FOR INSERT TO authenticated
  WITH CHECK (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr'])
    AND certified_by = auth.uid()
    AND EXISTS (SELECT 1 FROM employees e WHERE e.id = ld_certifications.employee_id AND e.organization_id = current_user_org())
  );

CREATE POLICY "LD and admins can view all certifications"
  ON ld_certifications FOR SELECT TO authenticated
  USING (
    (
      current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr', 'manager'])
      AND EXISTS (SELECT 1 FROM employees e WHERE e.id = ld_certifications.employee_id AND e.organization_id = current_user_org())
    )
    OR EXISTS (SELECT 1 FROM employees e WHERE e.id = ld_certifications.employee_id AND e.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "LD managers and admins can view org access requests" ON course_access_requests;
DROP POLICY IF EXISTS "LD managers and admins can update access requests" ON course_access_requests;

CREATE POLICY "LD managers and admins can view org access requests"
  ON course_access_requests FOR SELECT TO authenticated
  USING (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr'])
    AND organization_id = current_user_org()
  );

CREATE POLICY "LD managers and admins can update access requests"
  ON course_access_requests FOR UPDATE TO authenticated
  USING (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr'])
    AND organization_id = current_user_org()
  )
  WITH CHECK (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr'])
    AND organization_id = current_user_org()
  );

-- 4b. Learning tables: organisation scope -----------------------------------

DROP POLICY IF EXISTS "Authenticated users can view learning modules" ON learning_modules;
DROP POLICY IF EXISTS "LD managers can insert learning modules" ON learning_modules;
DROP POLICY IF EXISTS "LD managers can update learning modules" ON learning_modules;
DROP POLICY IF EXISTS "LD managers can delete learning modules" ON learning_modules;

CREATE POLICY "Org members can view learning modules"
  ON learning_modules FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM learning_courses lc WHERE lc.id = learning_modules.course_id AND lc.organization_id = current_user_org()
  ));

CREATE POLICY "LD and admins manage learning modules"
  ON learning_modules FOR ALL TO authenticated
  USING (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager'])
    AND EXISTS (SELECT 1 FROM learning_courses lc WHERE lc.id = learning_modules.course_id AND lc.organization_id = current_user_org())
  )
  WITH CHECK (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager'])
    AND EXISTS (SELECT 1 FROM learning_courses lc WHERE lc.id = learning_modules.course_id AND lc.organization_id = current_user_org())
  );

DROP POLICY IF EXISTS "LD and admins can manage learning path items" ON learning_path_items;
DROP POLICY IF EXISTS "LD and admins can update learning path items" ON learning_path_items;
DROP POLICY IF EXISTS "LD and admins can delete learning path items" ON learning_path_items;

CREATE POLICY "LD and admins manage learning path items"
  ON learning_path_items FOR ALL TO authenticated
  USING (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr'])
    AND EXISTS (SELECT 1 FROM learning_paths lp WHERE lp.id = learning_path_items.path_id AND lp.organization_id = current_user_org())
  )
  WITH CHECK (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr'])
    AND EXISTS (SELECT 1 FROM learning_paths lp WHERE lp.id = learning_path_items.path_id AND lp.organization_id = current_user_org())
  );

DROP POLICY IF EXISTS "LD and admins can manage role skills" ON role_skills;
DROP POLICY IF EXISTS "LD and admins can update role skills" ON role_skills;
DROP POLICY IF EXISTS "LD and admins can delete role skills" ON role_skills;

CREATE POLICY "LD and admins manage role skills"
  ON role_skills FOR ALL TO authenticated
  USING (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager'])
    AND EXISTS (SELECT 1 FROM designations d WHERE d.id = role_skills.designation_id AND d.organization_id = current_user_org())
  )
  WITH CHECK (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager'])
    AND EXISTS (SELECT 1 FROM designations d WHERE d.id = role_skills.designation_id AND d.organization_id = current_user_org())
  );

DROP POLICY IF EXISTS "Employees can view their own assignments" ON employee_learning_assignments;
DROP POLICY IF EXISTS "Admins and LD can insert learning assignments" ON employee_learning_assignments;
DROP POLICY IF EXISTS "Admins and LD can update learning assignments" ON employee_learning_assignments;

CREATE POLICY "Employees can view their own assignments"
  ON employee_learning_assignments FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Managers can view direct report assignments"
  ON employee_learning_assignments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM employees emp JOIN employees mgr ON emp.reporting_manager_id = mgr.id
    WHERE emp.id = employee_learning_assignments.employee_id AND mgr.user_id = auth.uid()
  ));

CREATE POLICY "LD and admins manage learning assignments"
  ON employee_learning_assignments FOR ALL TO authenticated
  USING (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr'])
    AND EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_learning_assignments.employee_id AND e.organization_id = current_user_org())
  )
  WITH CHECK (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr'])
    AND EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_learning_assignments.employee_id AND e.organization_id = current_user_org())
  );

-- 4c. Skills: writes need a role ---------------------------------------------

DROP POLICY IF EXISTS "Org members can insert skill questions" ON skill_questions;
DROP POLICY IF EXISTS "Org members can update skill questions" ON skill_questions;
DROP POLICY IF EXISTS "Org members can delete skill questions" ON skill_questions;
DROP POLICY IF EXISTS "Authenticated users can view skill questions" ON skill_questions;

CREATE POLICY "Org members can view skill questions"
  ON skill_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM skills s WHERE s.id = skill_questions.skill_id AND s.organization_id = current_user_org()));

CREATE POLICY "LD and admins manage skill questions"
  ON skill_questions FOR ALL TO authenticated
  USING (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager'])
    AND EXISTS (SELECT 1 FROM skills s WHERE s.id = skill_questions.skill_id AND s.organization_id = current_user_org())
  )
  WITH CHECK (
    current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager'])
    AND EXISTS (SELECT 1 FROM skills s WHERE s.id = skill_questions.skill_id AND s.organization_id = current_user_org())
  );

ALTER VIEW IF EXISTS skill_role_mappings SET (security_invoker = true);

-- 4d. OKRs: drop the old catch-all policy; add draft delete ------------------

DROP POLICY IF EXISTS "Employees and managers can manage OKRs" ON okrs;

CREATE POLICY "Employees delete own draft OKRs"
  ON okrs FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees e WHERE e.id = okrs.employee_id AND e.user_id = auth.uid())
    AND okrs.status = 'draft'
  );

ALTER TABLE okrs ALTER COLUMN status SET DEFAULT 'draft';

-- 4e. Resources: SELECT role clause scoped to org; storage bucket writes -----

DROP POLICY IF EXISTS "Users can view accessible resources" ON resource_repository;
CREATE POLICY "Users can view accessible resources"
  ON resource_repository FOR SELECT TO authenticated
  USING (
    organization_id = current_user_org()
    AND (
      access_level = 'all'
      OR (access_level = 'department' AND EXISTS (
        SELECT 1 FROM employees e WHERE e.user_id = auth.uid() AND e.department_id = ANY(resource_repository.department_ids)
      ))
      OR (access_level = 'designation' AND EXISTS (
        SELECT 1 FROM employees e WHERE e.user_id = auth.uid() AND e.designation_id = ANY(resource_repository.designation_ids)
      ))
      OR (access_level = 'specific' AND auth.uid() = ANY(resource_repository.access_user_ids))
      OR current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr'])
    )
  );

DROP POLICY IF EXISTS "Authenticated org members can upload resources" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete resources" ON storage.objects;

CREATE POLICY "Staff can upload resources"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resources' AND current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr']));

CREATE POLICY "Staff can update resources"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resources' AND current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr']));

CREATE POLICY "Staff can delete resources"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resources' AND current_user_has_role(ARRAY['admin', 'platform_admin', 'l_d_manager', 'hr']));

-- Avatars bucket (the UI already uses it; it was never created).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users manage own avatar" ON storage.objects;

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users manage own avatar"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- 5. updated_at maintenance
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', r.table_name);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', r.table_name);
  END LOOP;
END $$;
