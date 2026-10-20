/*
  # Add Messages, Pinned Resources, and Avatar Support

  ## Overview
  This migration adds three major features to support the enhanced employee experience:

  ## 1. Avatar URL on User Profiles
  - Adds `avatar_url` (text, nullable) to `user_profiles` for profile photo storage

  ## 2. Org Messages Table (`org_messages`)
  - Allows Admins and L&D Managers to broadcast messages to all employees in their org
  - Columns: id, organization_id, title, body, sender_id, priority, expires_at, created_at
  - RLS: Org members can read; Admin/L&D can insert/update/delete

  ## 3. Message Reads Table (`message_reads`)
  - Tracks which messages each user has read (for unread count and badge)
  - Columns: id, message_id, user_id, read_at
  - RLS: Users can only insert/read their own read records

  ## 4. Pinned Resources Table (`pinned_resources`)
  - Quick links pinned by Admin/L&D visible to all org members on the dashboard
  - Columns: id, organization_id, title, url, description, icon, sort_order, pinned_by, created_at
  - RLS: Org members can read; Admin/L&D can insert/update/delete

  ## Security
  - All tables have RLS enabled
  - Policies are scoped to organization membership
  - Message reads are private per user
*/

-- 1. Add avatar_url to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN avatar_url text;
  END IF;
END $$;

-- 2. Org Messages
CREATE TABLE IF NOT EXISTS org_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  sender_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_messages_org_id ON org_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_messages_created_at ON org_messages(created_at DESC);

ALTER TABLE org_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view org messages"
  ON org_messages FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin and LD can create messages"
  ON org_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('admin', 'l_d_manager')
    AND organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin and LD can update own messages"
  ON org_messages FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    sender_id = auth.uid()
    OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admin and LD can delete messages"
  ON org_messages FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );

-- 3. Message Reads
CREATE TABLE IF NOT EXISTS message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES org_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id);

ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own read records"
  ON message_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own read records"
  ON message_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. Pinned Resources
CREATE TABLE IF NOT EXISTS pinned_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  description text,
  icon text DEFAULT 'link',
  sort_order integer DEFAULT 0,
  pinned_by uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pinned_resources_org ON pinned_resources(organization_id);

ALTER TABLE pinned_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view pinned resources"
  ON pinned_resources FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin and LD can create pinned resources"
  ON pinned_resources FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('admin', 'l_d_manager')
    AND organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin and LD can update pinned resources"
  ON pinned_resources FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('admin', 'l_d_manager')
    AND organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('admin', 'l_d_manager')
    AND organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin and LD can delete pinned resources"
  ON pinned_resources FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('admin', 'l_d_manager')
    AND organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );
