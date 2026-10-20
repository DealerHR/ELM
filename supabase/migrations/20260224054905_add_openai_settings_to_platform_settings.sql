/*
  # Add OpenAI API settings to platform_settings

  ## Summary
  Switches the AI provider configuration from OpenRouter to OpenAI.

  ## Changes
  - Inserts `openai_api_key` setting (empty by default, admin must configure)
  - Inserts `openai_model` setting defaulting to `gpt-4o-mini`
*/

INSERT INTO platform_settings (key, value)
VALUES
  ('openai_api_key', ''),
  ('openai_model', 'gpt-4o-mini')
ON CONFLICT (key) DO NOTHING;
