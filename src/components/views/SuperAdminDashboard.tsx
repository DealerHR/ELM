import { useState, useEffect } from 'react';
import { Settings, Key, Cpu, Check, AlertCircle, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', note: 'Best value — fast, cheap, high quality' },
  { id: 'gpt-4o', label: 'GPT-4o', note: 'Most capable, higher cost' },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', note: 'Fastest, lowest cost' },
];

export default function SuperAdminDashboard() {
  const { userProfile } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['openai_api_key', 'openai_model']);

      const key = data?.find(s => s.key === 'openai_api_key')?.value || '';
      const model = data?.find(s => s.key === 'openai_model')?.value || OPENAI_MODELS[0].id;
      setApiKey(key);
      setSelectedModel(model);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const updates = [
        { key: 'openai_api_key', value: apiKey },
        { key: 'openai_model', value: selectedModel },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ value: update.value, updated_by: userProfile?.id, updated_at: new Date().toISOString() })
          .eq('key', update.key);
        if (error) throw error;
      }

      setSaveStatus('success');
      setSaveMessage('Settings saved successfully.');
    } catch (err: unknown) {
      setSaveStatus('error');
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestResult({ ok: false, message: 'Please enter an API key first.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-skill-question`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            skill_name: 'Communication',
            skill_description: 'Ability to convey ideas clearly in writing and speech.',
            difficulty: 'easy',
          }),
        }
      );
      const json = await res.json();
      if (json.error) {
        setTestResult({ ok: false, message: json.error });
      } else {
        setTestResult({ ok: true, message: `Connection successful! Model responded: "${json.question?.question_text?.substring(0, 80)}..."` });
      }
    } catch (err: unknown) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Connection test failed.' });
    } finally {
      setTesting(false);
    }
  };

  const maskedKey = apiKey ? `${apiKey.substring(0, 7)}${'•'.repeat(Math.max(0, apiKey.length - 11))}${apiKey.slice(-4)}` : '';

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-blue-950 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Platform-wide configuration and AI settings</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Cpu className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">AI Configuration</h2>
              <p className="text-xs text-gray-500">Powers the AI skill question builder for all organizations</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                OpenAI API Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-950 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {apiKey && !showKey && (
                <p className="text-xs text-gray-400 mt-1 font-mono">{maskedKey}</p>
              )}
              <p className="text-xs text-gray-500 mt-1.5">
                Get your API key from{' '}
                <span className="text-blue-600 font-medium">platform.openai.com/api-keys</span>
                {' '}— a paid OpenAI account is required.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                AI Model
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-950 bg-white"
                >
                  {OPENAI_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label} — {m.note}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                GPT-4o Mini is recommended — it delivers excellent quality at very low cost.
              </p>
            </div>

            {testResult && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${testResult.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {testResult.ok ? <Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            {saveStatus !== 'idle' && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${saveStatus === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {saveStatus === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {saveMessage}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-blue-950 text-white text-sm font-semibold rounded-lg hover:bg-blue-900 transition disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                onClick={handleTestConnection}
                disabled={testing || !apiKey}
                className="px-5 py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition disabled:opacity-60"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-1">How the AI Question Builder Works</p>
              <ul className="text-xs text-amber-800 space-y-1 list-disc ml-4">
                <li>L&D users describe a skill with a title and at least 3 behaviour bullet points when creating a skill.</li>
                <li>In the Skill Question Builder, they click "AI Generate" to generate one question at a time.</li>
                <li>They can edit, accept, or discard and regenerate each question.</li>
                <li>The AI uses the skill title and description to create relevant, practical questions.</li>
                <li>Every question has 4 answer options + an automatic "Don't Know / Not Sure" option.</li>
                <li>The API key set here is shared across all organizations on the platform.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
