/*
  # Add UPDATE policy for course-content storage

  The CourseBuilder uses `upsert: true` when uploading files, which requires both
  INSERT and UPDATE storage policies. Without the UPDATE policy, re-uploading an
  existing file path would fail with a 400 error.
*/

CREATE POLICY "LD managers can update course content"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'course-content'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'platform_admin', 'l_d_manager', 'org_admin', 'hr')
    )
  )
  WITH CHECK (
    bucket_id = 'course-content'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'platform_admin', 'l_d_manager', 'org_admin', 'hr')
    )
  );
