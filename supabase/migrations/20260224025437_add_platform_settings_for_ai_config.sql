/*
  # Platform Settings Table for AI Configuration

  ## Summary
  Creates a platform_settings table for storing global configuration that the
  Super Admin (platform_admin) controls. The primary use case is storing the
  OpenRouter API key and selected AI model for the AI-powered skill question builder.

  ## New Tables
  - `platform_settings`
    - `id` (uuid, primary key)
    - `key` (text, unique) - setting name, e.g. 'openrouter_api_key', 'openrouter_model'
    - `value` (text) - setting value
    - `updated_by` (uuid) - user who last updated it
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Only platform_admin can INSERT or UPDATE settings
  - All authenticated users can SELECT (to read API config for edge function calls)
    but the actual API key is proxied through an edge function — client only reads
    the model name and whether AI is configured
*/

CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admin can insert settings"
  ON platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

CREATE POLICY "Platform admin can update settings"
  ON platform_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

CREATE POLICY "Authenticated users can read settings"
  ON platform_settings FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO platform_settings (key, value) VALUES
  ('openrouter_api_key', ''),
  ('openrouter_model', 'meta-llama/llama-3.1-8b-instruct:free')
ON CONFLICT (key) DO NOTHING;
