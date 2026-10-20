/*
  # Resource Repository Enhancements

  ## Changes
  1. New Columns on resource_repository
     - `designation_ids` (uuid[]) — IDs of designations when access_level = 'designation'
     - `access_user_ids` (uuid[]) — IDs of specific user_profiles when access_level = 'specific'
     - `file_path` (text) — Storage path for files uploaded to Supabase Storage

  2. Storage
     - Creates the `resources` storage bucket (private by default)
     - Adds RLS policies so org members can upload/read resources
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resource_repository' AND column_name = 'designation_ids'
  ) THEN
    ALTER TABLE resource_repository ADD COLUMN designation_ids uuid[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resource_repository' AND column_name = 'access_user_ids'
  ) THEN
    ALTER TABLE resource_repository ADD COLUMN access_user_ids uuid[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resource_repository' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE resource_repository ADD COLUMN file_path text;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resources',
  'resources',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4',
    'video/webm',
    'image/png',
    'image/jpeg',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated org members can upload resources'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated org members can upload resources" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''resources'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can view resources'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can view resources" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''resources'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can delete resources'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can delete resources" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''resources'')';
  END IF;
END $$;
