import { useState } from 'react';
import { Loader2, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ChangePasswordFormProps {
  /** Shown as a full-screen gate on first login or after a reset link. */
  fullScreen?: boolean;
  title?: string;
  description?: string;
  onDone?: () => void;
}

const MIN_LENGTH = 8;

export default function ChangePasswordForm({ fullScreen = false, title, description, onDone }: ChangePasswordFormProps) {
  const { userProfile, setUserProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < MIN_LENGTH) { setError(`Password must be at least ${MIN_LENGTH} characters.`); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }

    setSaving(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      setError(authError.message.includes('different from the old')
        ? 'Please choose a password different from your current one.'
        : authError.message);
      setSaving(false);
      return;
    }

    if (userProfile?.must_change_password) {
      await supabase.from('user_profiles').update({ must_change_password: false }).eq('id', userProfile.id);
      setUserProfile(p => (p ? { ...p, must_change_password: false } : p));
    }

    setSaving(false);
    setDone(true);
    setPassword('');
    setConfirm('');
    onDone?.();
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {done && !fullScreen && (
        <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Your password has been changed.
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
          required
        />
        <p className="text-xs text-gray-500 mt-1">At least {MIN_LENGTH} characters.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
          required
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-blue-950 text-white py-2.5 text-sm font-semibold rounded-lg hover:bg-blue-900 transition disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );

  if (!fullScreen) return form;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-950 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{title || 'Set your password'}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {description || 'You signed in with a temporary password. Choose a new one to continue.'}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {form}
        </div>
      </div>
    </div>
  );
}
