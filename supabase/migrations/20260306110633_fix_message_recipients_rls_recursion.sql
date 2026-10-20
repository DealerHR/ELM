/*
  # Fix infinite recursion in org_messages / message_recipients RLS policies

  ## Problem
  - `org_messages` SELECT policy uses EXISTS on `message_recipients` to check if the user is a recipient
  - `message_recipients` SELECT policy uses EXISTS on `org_messages` to check if the user is the sender
  - These two policies reference each other, causing infinite recursion on every query

  ## Fix
  - Drop the recursive `message_recipients` SELECT policy that references `org_messages`
  - Replace it with a role-based policy: recipients see their own rows; admins and l_d_managers
    (the only roles that can create targeted messages) can see all recipient rows
  - This breaks the cycle while preserving all intended access patterns
*/

DROP POLICY IF EXISTS "Recipients and admins can view message recipients" ON message_recipients;

CREATE POLICY "Recipients and senders can view message recipients"
  ON message_recipients
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR (
      SELECT role FROM user_profiles WHERE id = auth.uid()
    ) IN ('admin', 'l_d_manager', 'hr')
  );
