import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { KeyRound, Loader2, AlertCircle, ChevronRight, Building2 } from 'lucide-react';
import AssessmentRunner from './AssessmentRunner';

interface InvitationData {
  id: string;
  candidate_id: string;
  candidate_name: string | null;
  organization_name: string | null;
  organization_id: string | null;
  access_code: string;
  status: string;
  include_growth_profile: boolean;
  include_domain_assessment: boolean;
  growth_profile_level: string | null;
  growth_assessment_id: string | null;
  domain_assessment_id: string | null;
  expires_at: string;
}

export default function CandidatePortal() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<InvitationData | null>(null);

  async function handleEnterCode() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) { setError('Please enter your 6-character access code.'); return; }
    setLoading(true); setError('');

    const { data, error: err } = await supabase
      .from('assessment_invitations')
      .select('id, candidate_id, candidate_name, organization_name, organization_id, access_code, status, include_growth_profile, include_domain_assessment, growth_profile_level, growth_assessment_id, domain_assessment_id, expires_at')
      .eq('access_code', trimmed)
      .maybeSingle();

    setLoading(false);

    if (err || !data) {
      setError('Access code not found. Please check your code and try again.');
      return;
    }

    if (!data.organization_name && data.organization_id) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', data.organization_id)
        .maybeSingle();
      if (orgData?.name) data.organization_name = orgData.name;
    }

    if (new Date(data.expires_at) < new Date()) {
      setError('This access code has expired. Please contact the organisation for a new invitation.');
      return;
    }

    if (data.status === 'completed') {
      setInvitation({ ...data, status: 'completed' });
      return;
    }

    if (data.status === 'sent') {
      await supabase.from('assessment_invitations').update({ status: 'opened' }).eq('id', data.id);
      data.status = 'opened';
    }

    setInvitation(data);
  }

  if (invitation?.status === 'completed') {
    return <CompletedScreen orgName={invitation.organization_name} candidateName={invitation.candidate_name} />;
  }

  if (invitation) {
    return (
      <AssessmentRunner
        invitation={invitation}
        onComplete={() => setInvitation({ ...invitation, status: 'completed' })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-950 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Assessment Portal</h1>
          <p className="text-gray-500 mt-2 text-sm">Enter your unique access code to begin</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Access Code</label>
              <input
                type="text"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleEnterCode()}
                placeholder="e.g. A3K9PZ"
                maxLength={6}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest text-blue-950 focus:outline-none focus:border-blue-950 transition uppercase placeholder:text-gray-300 placeholder:text-lg placeholder:font-normal placeholder:tracking-normal"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
              />
              <p className="text-xs text-gray-400 mt-2 text-center">The 6-character code was provided in your invitation email</p>
            </div>

            <button
              onClick={handleEnterCode}
              disabled={loading || code.trim().length === 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-950 text-white py-3 rounded-xl font-semibold hover:bg-blue-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {loading ? 'Verifying...' : 'Continue'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          If you have already started your assessment, enter the same code to continue.
        </p>
      </div>
    </div>
  );
}

function CompletedScreen({ orgName, candidateName }: { orgName: string | null; candidateName: string | null }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Assessment Complete</h1>
        {candidateName && <p className="text-gray-500 text-sm mb-1">Thank you, {candidateName}.</p>}
        <p className="text-gray-500 text-sm mb-6">
          You have successfully completed all assessments
          {orgName ? ` for ${orgName}` : ''}.
          No further action is required from your side.
        </p>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-left space-y-3">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Organisation</p>
              <p className="text-sm font-semibold text-gray-900">{orgName || '—'}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              The recruitment team will review your results and be in touch with next steps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
