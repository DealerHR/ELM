/*
  # Add Message Types and Recipients

  ## Overview
  Extends the org_messages system to support two distinct message types:
  - **Public Announcements**: Visible to all members of the organization (existing behavior)
  - **Targeted Messages**: Personal messages sent to one or many selected users

  ## Changes

  ### 1. New `message_recipients` table
  - Tracks individual recipients of targeted messages
  - Columns: id, message_id, recipient_id
  - RLS: Only recipients, the sender, and admins can see recipient lists

  ### 2. `org_messages` table
  - New column `message_type` (text, 'public' | 'targeted', default 'public')
  - The SELECT policy is replaced to enforce targeted message visibility
    (created AFTER message_recipients so the policy can reference it)

  ## Security
  - Public messages remain visible to all org members
  - Targeted messages are only visible to: the sender, the recipient(s), and org admins
  - Only Admin and L&D Manager roles can insert recipients
*/

-- 1. Create message_recipients table first (so the policy below can reference it)
CREATE TABLE IF NOT EXISTS message_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES org_messages(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  UNIQUE(message_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_message_recipients_message ON message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_recipient ON message_recipients(recipient_id);

ALTER TABLE message_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients and admins can view message recipients"
  ON message_recipients FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM org_messages
      WHERE org_messages.id = message_id
        AND org_messages.sender_id = auth.uid()
    )
  );

CREATE POLICY "Admin and LD can add message recipients"
  ON message_recipients FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('admin', 'l_d_manager')
  );

CREATE POLICY "Admin and LD can delete message recipients"
  ON message_recipients FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('admin', 'l_d_manager')
  );

-- 2. Add message_type to org_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE org_messages ADD COLUMN message_type text NOT NULL DEFAULT 'public'
      CHECK (message_type IN ('public', 'targeted'));
  END IF;
END $$;

-- 3. Drop old SELECT policy and recreate with type-aware visibility
DROP POLICY IF EXISTS "Org members can view org messages" ON org_messages;

CREATE POLICY "Org members can view org messages"
  ON org_messages FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    AND (
      message_type = 'public'
      OR sender_id = auth.uid()
      OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
      OR EXISTS (
        SELECT 1 FROM message_recipients
        WHERE message_recipients.message_id = org_messages.id
          AND message_recipients.recipient_id = auth.uid()
      )
    )
  );
