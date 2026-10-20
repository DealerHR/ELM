import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Building2, Loader2, CheckCircle, ChevronRight } from 'lucide-react';
import GrowthProfileTest from './GrowthProfileTest';
import DomainTest from './DomainTest';

interface Invitation {
  id: string;
  candidate_id: string;
  candidate_name: string | null;
  organization_name: string | null;
  access_code: string;
  status: string;
  include_growth_profile: boolean;
  include_domain_assessment: boolean;
  growth_profile_level: string | null;
  growth_assessment_id: string | null;
  domain_assessment_id: string | null;
  expires_at: string;
}

interface AssessmentRunnerProps {
  invitation: Invitation;
  onComplete: () => void;
}

type ActiveTest = 'overview' | 'growth' | 'domain';

export default function AssessmentRunner({ invitation, onComplete }: AssessmentRunnerProps) {
  const [activeTest, setActiveTest] = useState<ActiveTest>('overview');
  const [growthDone, setGrowthDone] = useState(false);
  const [domainDone, setDomainDone] = useState(false);
  const [checkingProgress, setCheckingProgress] = useState(true);

  useEffect(() => {
    checkExistingProgress();
  }, []);

  async function checkExistingProgress() {
    let gDone = false;
    let dDone = false;

    if (invitation.include_growth_profile && invitation.growth_assessment_id) {
      const { data } = await supabase
        .from('candidate_growth_assessments')
        .select('status')
        .eq('id', invitation.growth_assessment_id)
        .maybeSingle();
      if (data?.status === 'completed') gDone = true;
    }

    if (invitation.include_domain_assessment && invitation.domain_assessment_id) {
      const { data } = await supabase
        .from('candidate_domain_attempts')
        .select('status')
        .eq('invitation_token', invitation.id)
        .maybeSingle();
      if (data?.status === 'completed') dDone = true;
    }

    setGrowthDone(gDone);
    setDomainDone(dDone);
    setCheckingProgress(false);
  }

  async function handleGrowthComplete() {
    setGrowthDone(true);
    setActiveTest('overview');
    await checkAllDone(true, domainDone);
  }

  async function handleDomainComplete() {
    setDomainDone(true);
    setActiveTest('overview');
    await checkAllDone(growthDone, true);
  }

  async function checkAllDone(gDone: boolean, dDone: boolean) {
    const needGrowth = invitation.include_growth_profile;
    const needDomain = invitation.include_domain_assessment;
    const allDone = (!needGrowth || gDone) && (!needDomain || dDone);
    if (allDone) {
      await supabase.from('assessment_invitations').update({ status: 'completed' }).eq('id', invitation.id);
      await supabase.from('candidates').update({ status: 'assessment_completed' }).eq('id', invitation.candidate_id);
      onComplete();
    }
  }

  if (checkingProgress) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-950" />
      </div>
    );
  }

  if (activeTest === 'growth') {
    return (
      <GrowthProfileTest
        invitation={invitation}
        onComplete={handleGrowthComplete}
        onBack={() => setActiveTest('overview')}
      />
    );
  }

  if (activeTest === 'domain') {
    return (
      <DomainTest
        invitation={invitation}
        onComplete={handleDomainComplete}
        onBack={() => setActiveTest('overview')}
      />
    );
  }

  const tests = [];
  if (invitation.include_growth_profile) {
    tests.push({
      key: 'growth',
      label: 'Growth Profile Assessment',
      description: 'Personality and culture-fit evaluation across 5 dimensions',
      duration: '25–30 min',
      done: growthDone,
      action: () => setActiveTest('growth'),
    });
  }
  if (invitation.include_domain_assessment) {
    tests.push({
      key: 'domain',
      label: 'Knowledge Assessment',
      description: 'Role-specific knowledge and skills test',
      duration: '15–20 min',
      done: domainDone,
      action: () => setActiveTest('domain'),
    });
  }

  const completedCount = tests.filter(t => t.done).length;
  const totalCount = tests.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-blue-950 px-6 py-5">
            <div className="flex items-center gap-3 mb-3">
              <Building2 className="w-5 h-5 text-blue-300" />
              <span className="text-blue-200 text-sm font-medium">{invitation.organization_name}</span>
            </div>
            {invitation.candidate_name && (
              <h1 className="text-xl font-bold text-white">Hello, {invitation.candidate_name.split(' ')[0]}</h1>
            )}
            <p className="text-blue-200 text-sm mt-1">Welcome to your assessment. Please complete all sections below.</p>
            <div className="mt-4 bg-blue-900/50 rounded-lg px-4 py-2 flex items-center justify-between">
              <span className="text-blue-200 text-xs font-medium">Progress</span>
              <span className="text-white text-sm font-bold">{completedCount} / {totalCount} completed</span>
            </div>
          </div>

          <div className="p-6 space-y-3">
            {tests.map(test => (
              <div
                key={test.key}
                className={`border rounded-xl p-4 transition ${test.done ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">{test.label}</h3>
                      {test.done && (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Completed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{test.description}</p>
                    <p className="text-xs text-gray-400 mt-1">Estimated time: {test.duration}</p>
                  </div>
                  {!test.done && (
                    <button
                      onClick={test.action}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-950 text-white rounded-lg text-xs font-semibold hover:bg-blue-900 transition flex-shrink-0 mt-1"
                    >
                      Begin <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 pb-6">
            <p className="text-xs text-gray-400 text-center">
              You can close this window and return later using the same access code: <span className="font-mono font-semibold text-blue-950">{invitation.access_code}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
