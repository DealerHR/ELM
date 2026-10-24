/*
  # Tenants: status, branding, and organisation-scoped storage (Phase 6)

  1. organizations.status  — active | suspended. A suspended organisation's
     people can still sign in but every tenant table is hidden from them
     (see org_is_active()), so the data is intact and nothing is reachable.
  2. organizations.plan    — a label for the flat per-tenant plan.
  3. organizations.settings.brand — four colours and the logo are read by the
     app at sign-in: primary, text on primary, navigation, accent. Defaults are
     the Stratefix yellow / black. Validated by a CHECK so a bad value cannot
     break every screen.
  4. Storage: files already live under <organization_id>/..., but the bucket
     policies only checked the role. Now the first folder must be the caller's
     organisation (platform admins excepted), for reading as well as writing.
  5. New public bucket org-assets for logos, same folder rule.
  6. RPC organization_setup_status(org) for the first-run checklist.
*/

-- 1–2. status and plan --------------------------------------------------------

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_status_check') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_status_check CHECK (status IN ('active', 'suspended'));
  END IF;
END $$;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'standard';

-- 3. brand -----------------------------------------------------------------------

-- settings.brand = { "primary": "#FDB913", "on_primary": "#000000", "nav": "#000000", "accent": "#1E40AF" }
CREATE OR REPLACE FUNCTION brand_is_valid(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NULL OR p->'brand' IS NULL OR (
    jsonb_typeof(p->'brand') = 'object'
    AND (SELECT bool_and(v ~ '^#[0-9A-Fa-f]{6}$') FROM jsonb_each_text(p->'brand') AS t(k, v) WHERE k IN ('primary','on_primary','nav','accent'))
  );
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_settings_brand_check') THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_settings_brand_check CHECK (brand_is_valid(settings));
  END IF;
END $$;

-- Org admins may edit their own organisation's name, logo and settings (not status or plan).
DROP POLICY IF EXISTS organizations_admin_update_own ON organizations;
CREATE POLICY organizations_admin_update_own ON organizations FOR UPDATE TO authenticated
  USING (id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- status/plan stay platform-admin only: a trigger reverts them if anyone else changes them.
CREATE OR REPLACE FUNCTION protect_org_platform_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.plan IS DISTINCT FROM OLD.plan)
     AND NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'platform_admin')
     AND auth.uid() IS NOT NULL THEN
    NEW.status := OLD.status; NEW.plan := OLD.plan;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_org_platform_fields ON organizations;
CREATE TRIGGER trg_protect_org_platform_fields BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION protect_org_platform_fields();

-- Suspension: hide tenant data from a suspended organisation's users.
CREATE OR REPLACE FUNCTION org_is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT o.status = 'active' FROM user_profiles p JOIN organizations o ON o.id = p.organization_id WHERE p.id = auth.uid()
  ), true); -- platform admins (no organisation) and service calls are never blocked
$$;
GRANT EXECUTE ON FUNCTION org_is_active() TO authenticated;

-- Applied as an extra restrictive policy on the main tenant tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['employees','candidates','learning_courses','learning_modules','learning_paths','employee_learning_assignments','learning_progress','okrs','induction_journeys','org_messages','resource_repository','skills','departments','designations']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS org_active_gate ON %I', t);
    EXECUTE format('CREATE POLICY org_active_gate ON %I AS RESTRICTIVE FOR ALL TO authenticated USING (org_is_active()) WITH CHECK (org_is_active())', t);
  END LOOP;
END $$;

-- 4. storage scoped to the organisation folder -------------------------------------

CREATE OR REPLACE FUNCTION storage_folder_is_mine(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles p WHERE p.id = auth.uid()
      AND (p.role = 'platform_admin' OR p.organization_id::text = (storage.foldername(p_name))[1])
  );
$$;
GRANT EXECUTE ON FUNCTION storage_folder_is_mine(text) TO authenticated;

DROP POLICY IF EXISTS "Org members can read course content" ON storage.objects;
DROP POLICY IF EXISTS "LD managers can upload course content" ON storage.objects;
DROP POLICY IF EXISTS "LD managers can update course content" ON storage.objects;
DROP POLICY IF EXISTS "LD managers can delete course content" ON storage.objects;
CREATE POLICY course_content_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-content' AND storage_folder_is_mine(name));
CREATE POLICY course_content_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-content' AND storage_folder_is_mine(name) AND current_user_has_role(ARRAY['admin','platform_admin','l_d_manager','hr']));
CREATE POLICY course_content_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'course-content' AND storage_folder_is_mine(name) AND current_user_has_role(ARRAY['admin','platform_admin','l_d_manager','hr']));
CREATE POLICY course_content_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-content' AND storage_folder_is_mine(name) AND current_user_has_role(ARRAY['admin','platform_admin','l_d_manager','hr']));

DROP POLICY IF EXISTS "Authenticated users can view resources" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload resources" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update resources" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete resources" ON storage.objects;
CREATE POLICY resources_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resources' AND storage_folder_is_mine(name));
CREATE POLICY resources_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resources' AND storage_folder_is_mine(name) AND current_user_has_role(ARRAY['admin','platform_admin','l_d_manager','hr']));
CREATE POLICY resources_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resources' AND storage_folder_is_mine(name) AND current_user_has_role(ARRAY['admin','platform_admin','l_d_manager','hr']));
CREATE POLICY resources_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resources' AND storage_folder_is_mine(name) AND current_user_has_role(ARRAY['admin','platform_admin','l_d_manager','hr']));

-- 5. logos ------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('org-assets', 'org-assets', true, 2097152, ARRAY['image/png','image/jpeg','image/svg+xml','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS org_assets_read ON storage.objects;
DROP POLICY IF EXISTS org_assets_write ON storage.objects;
CREATE POLICY org_assets_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'org-assets');
CREATE POLICY org_assets_write ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'org-assets' AND storage_folder_is_mine(name) AND current_user_has_role(ARRAY['admin','platform_admin']))
  WITH CHECK (bucket_id = 'org-assets' AND storage_folder_is_mine(name) AND current_user_has_role(ARRAY['admin','platform_admin']));

-- 6. setup checklist --------------------------------------------------------------

CREATE OR REPLACE FUNCTION organization_setup_status(p_org uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_build_object(
    'brand',        (SELECT settings ? 'brand' OR logo_url IS NOT NULL FROM organizations WHERE id = p_org),
    'departments',  (SELECT count(*) FROM departments WHERE organization_id = p_org),
    'designations', (SELECT count(*) FROM designations WHERE organization_id = p_org),
    'people',       (SELECT count(*) FROM employees WHERE organization_id = p_org),
    'courses',      (SELECT count(*) FROM learning_courses WHERE organization_id = p_org AND status = 'published'),
    'inductions',   (SELECT count(*) FROM induction_templates WHERE organization_id = p_org AND is_active)
  );
$$;
GRANT EXECUTE ON FUNCTION organization_setup_status(uuid) TO authenticated;