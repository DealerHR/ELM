import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { callEdgeFunction, generateTemporaryPassword } from '../../lib/edgeFunctions';
import { useRoute } from '../../lib/router';
import {
  UserPlus, Search, Clock, CheckCircle,
  XCircle, Mail, Phone, Briefcase, Calendar, Star,
  AlertCircle, Send, Eye, ArrowRight, Users, Award,
  FileText, MessageSquare, UserCheck, MoreVertical,
  Loader2, Copy, Check, KeyRound, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, BookOpen, BarChart2, Trash2,
  MessageCircle, Lightbulb, HeartHandshake, ClipboardList,
  LayoutList, LayoutGrid
} from 'lucide-react';

type CandidateStatus =
  | 'applied'
  | 'assessment_pending'
  | 'assessment_completed'
  | 'interview_scheduled'
  | 'interviewed'
  | 'shortlisted'
  | 'offer_extended'
  | 'offer_accepted'
  | 'offer_declined'
  | 'joined'
  | 'rejected';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  applied_position: string | null;
  applied_position_title: string | null;
  status: CandidateStatus;
  source: string | null;
  interview_date: string | null;
  interview_score: number | null;
  interview_notes: string | null;
  interviewed_by: string | null;
  hired_at: string | null;
  notes: string | null;
  created_at: string;
  designation?: { title: string } | null;
}

interface DomainAssessment {
  id: string;
  title: string;
  designation_id: string | null;
  department_id: string | null;
}

interface Invitation {
  id: string;
  candidate_id: string;
  status: string;
  include_growth_profile: boolean;
  include_domain_assessment: boolean;
  sent_at: string;
  expires_at: string;
  access_code?: string | null;
  domain_assessment?: { title: string } | null;
  growth_assessment_id?: string | null;
  domain_attempt_id?: string | null;
  domain_score?: number | null;
  growth_completed_at?: string | null;
  domain_completed_at?: string | null;
}

interface GrowthScores {
  overall_score: number;
  overall_percentile: number;
  fit_level: string;
  adaptability_learning_score: number;
  initiative_ownership_score: number;
  collaboration_team_score: number;
  resilience_stress_score: number;
  growth_curiosity_score: number;
  strengths: string[] | null;
  development_areas: string[] | null;
  social_desirability_index: number | null;
  response_validity: string | null;
  calculated_at: string;
}

interface GrowthResponseItem {
  question_number: number;
  dimension: string;
  question_text: string;
  question_type: string;
  answer_scale: string;
  is_reverse_scored: boolean;
  option_1: string | null;
  option_2: string | null;
  option_3: string | null;
  option_4: string | null;
  option_5: string | null;
  answer_value: number;
}

interface DomainResponseItem {
  question_number: number;
  question_text: string;
  question_type: string;
  options: Record<string, string> | null;
  correct_answer: string | null;
  points: number;
  answer_text: string;
  is_correct: boolean | null;
  points_awarded: number | null;
}

interface DetailedResponses {
  growthResponses: GrowthResponseItem[];
  domainResponses: DomainResponseItem[];
  domainTitle: string;
  domainScore: number | null;
  domainMaxScore: number | null;
  domainPercentage: number | null;
}

interface InterviewRating {
  id: string;
  candidate_id: string;
  comm_articulation_score: number;
  comm_listening_score: number;
  role_experience_score: number;
  role_readiness_score: number;
  ps_structure_score: number;
  ps_initiative_score: number;
  culture_teamwork_score: number;
  culture_growth_score: number;
  total_score: number;
  overall_notes: string;
  rated_at: string;
  interview_date: string | null;
}

type StatementKey = 'comm_articulation_score' | 'comm_listening_score' | 'role_experience_score' | 'role_readiness_score' | 'ps_structure_score' | 'ps_initiative_score' | 'culture_teamwork_score' | 'culture_growth_score';

interface RatingArea {
  icon: React.ElementType;
  label: string;
  statements: { key: StatementKey; text: string }[];
}

const RATING_AREAS: RatingArea[] = [
  {
    icon: MessageCircle,
    label: 'Communication & Clarity',
    statements: [
      { key: 'comm_articulation_score', text: 'Articulates ideas and responses clearly and concisely' },
      { key: 'comm_listening_score', text: 'Listens actively and responds to questions directly' },
    ],
  },
  {
    icon: ClipboardList,
    label: 'Role Fit & Experience',
    statements: [
      { key: 'role_experience_score', text: 'Demonstrates relevant skills and prior experience for the role' },
      { key: 'role_readiness_score', text: 'Shows readiness to step into the role with minimal ramp-up' },
    ],
  },
  {
    icon: Lightbulb,
    label: 'Problem Solving & Thinking',
    statements: [
      { key: 'ps_structure_score', text: 'Breaks down complex problems in a logical, structured way' },
      { key: 'ps_initiative_score', text: 'Shows independent thinking and brings forward solutions proactively' },
    ],
  },
  {
    icon: HeartHandshake,
    label: 'Culture & Values Alignment',
    statements: [
      { key: 'culture_teamwork_score', text: 'Demonstrates genuine team orientation and collaborative mindset' },
      { key: 'culture_growth_score', text: 'Shows openness to feedback and a visible growth orientation' },
    ],
  },
];

const PIPELINE_STAGES: { status: CandidateStatus; label: string; color: string; bg: string }[] = [
  { status: 'applied', label: 'Applied', color: 'text-gray-600', bg: 'bg-gray-100' },
  { status: 'assessment_pending', label: 'Assessment Sent', color: 'text-amber-700', bg: 'bg-amber-100' },
  { status: 'assessment_completed', label: 'Assessment Done', color: 'text-blue-700', bg: 'bg-blue-100' },
  { status: 'interview_scheduled', label: 'Interview Scheduled', color: 'text-cyan-700', bg: 'bg-cyan-100' },
  { status: 'interviewed', label: 'Interviewed', color: 'text-slate-700', bg: 'bg-slate-100' },
  { status: 'shortlisted', label: 'Shortlisted', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  { status: 'offer_extended', label: 'Offer Extended', color: 'text-orange-700', bg: 'bg-orange-100' },
  { status: 'offer_accepted', label: 'Offer Accepted', color: 'text-green-700', bg: 'bg-green-100' },
  { status: 'joined', label: 'Joined', color: 'text-green-800', bg: 'bg-green-200' },
  { status: 'rejected', label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
];

function getStage(status: CandidateStatus) {
  return PIPELINE_STAGES.find(s => s.status === status) || PIPELINE_STAGES[0];
}

function getEffectiveStatus(candidate: Candidate, invitations: Invitation[]): CandidateStatus {
  const beyondAssessment: CandidateStatus[] = [
    'interview_scheduled', 'interviewed', 'shortlisted',
    'offer_extended', 'offer_accepted', 'joined', 'rejected',
  ];
  if (beyondAssessment.includes(candidate.status)) return candidate.status;
  const hasCompletedInvitation = invitations.some(
    i => i.candidate_id === candidate.id && i.status === 'completed'
  );
  if (hasCompletedInvitation && candidate.status === 'assessment_pending') {
    return 'assessment_completed';
  }
  return candidate.status;
}

type ModalType = 'add' | 'detail' | 'send_assessment' | 'interview' | 'email_draft' | 'growth_results' | 'detail_responses' | 'delete_assessment' | 'move_to_induction' | 'induction_success' | null;

interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  title: string;
  department_id: string | null;
}

export default function Candidates() {
  const { userProfile } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const route = useRoute();
  const [openedFromLink, setOpenedFromLink] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [growthScoreMap, setGrowthScoreMap] = useState<Record<string, { fit_level: string; overall_score: number }>>({});
  const [domainAssessments, setDomainAssessments] = useState<DomainAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [growthScores, setGrowthScores] = useState<GrowthScores | null>(null);
  const [growthScoresLoading, setGrowthScoresLoading] = useState(false);
  const [detailResponses, setDetailResponses] = useState<DetailedResponses | null>(null);
  const [detailResponsesLoading, setDetailResponsesLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: '', email: '', phone: '', department_id: '', designation_id: '', source: '', notes: ''
  });
  const [sendForm, setSendForm] = useState({
    include_growth_profile: false,
    growth_profile_level: 'mid',
    include_domain_assessment: false,
    domain_assessment_id: '',
    message: ''
  });
  const [interviewForm, setInterviewForm] = useState({
    interview_date: '',
    overall_notes: '',
    next_status: 'interviewed' as CandidateStatus,
    comm_articulation_score: 5,
    comm_listening_score: 5,
    role_experience_score: 5,
    role_readiness_score: 5,
    ps_structure_score: 5,
    ps_initiative_score: 5,
    culture_teamwork_score: 5,
    culture_growth_score: 5,
  });
  const [existingRating, setExistingRating] = useState<InterviewRating | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showAllAssessments, setShowAllAssessments] = useState(false);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [inductionPassword, setInductionPassword] = useState('');
  const [inductionStarted, setInductionStarted] = useState<string | null>(null);
  const [inductionForm, setInductionForm] = useState({
    employee_code: '',
    department_id: '',
    designation_id: '',
    date_of_joining: new Date().toISOString().split('T')[0],
    employment_type: 'full_time',
  });

  useEffect(() => { loadData(); }, [userProfile]);

  // Deep link: #/candidates/<candidate id>
  useEffect(() => {
    if (route.view !== 'candidates' || !route.id || route.id === openedFromLink) return;
    const c = candidates.find(x => x.id === route.id);
    if (c) { setOpenedFromLink(route.id); openDetail(c); }
  }, [route.id, candidates.length]);

  async function loadData() {
    if (!userProfile?.organization_id) return;
    setLoading(true);
    await Promise.all([loadCandidates(), loadInvitations(), loadDomainAssessments(), loadDepartments(), loadDesignations()]);
    setLoading(false);
  }

  async function loadDepartments() {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', userProfile!.organization_id)
      .order('name');
    if (data) setDepartments(data);
  }

  async function loadDesignations() {
    const { data } = await supabase
      .from('designations')
      .select('id, title, department_id')
      .eq('organization_id', userProfile!.organization_id)
      .order('title');
    if (data) setDesignations(data as Designation[]);
  }

  async function loadCandidates() {
    const { data } = await supabase
      .from('candidates')
      .select('*, designation:designations(title)')
      .eq('organization_id', userProfile!.organization_id)
      .order('created_at', { ascending: false });
    if (data) setCandidates(data as Candidate[]);
  }

  async function loadInvitations() {
    const { data } = await supabase
      .from('assessment_invitations')
      .select('*, domain_assessment:candidate_domain_assessments(title)')
      .eq('organization_id', userProfile!.organization_id)
      .order('sent_at', { ascending: false });
    if (!data) return;
    setInvitations(data as unknown as Invitation[]);

    const growthIds = (data as unknown as Invitation[])
      .filter(i => i.status === 'completed' && i.growth_assessment_id)
      .map(i => i.growth_assessment_id as string);

    if (growthIds.length > 0) {
      const { data: scores } = await supabase
        .from('growth_profile_scores')
        .select('assessment_id, fit_level, overall_score')
        .in('assessment_id', growthIds);
      if (scores) {
        const map: Record<string, { fit_level: string; overall_score: number }> = {};
        (scores as { assessment_id: string; fit_level: string; overall_score: number }[])
          .forEach(s => { map[s.assessment_id] = { fit_level: s.fit_level, overall_score: s.overall_score }; });
        setGrowthScoreMap(map);
      }
    }
  }

  async function loadDomainAssessments() {
    const { data } = await supabase
      .from('candidate_domain_assessments')
      .select('id, title, designation_id, department_id')
      .eq('organization_id', userProfile!.organization_id)
      .eq('is_active', true);
    if (data) setDomainAssessments(data as DomainAssessment[]);
  }

  async function handleAddCandidate() {
    if (!addForm.full_name.trim() || !addForm.email.trim()) { setError('Name and email are required.'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('candidates').insert({
      organization_id: userProfile!.organization_id,
      full_name: addForm.full_name.trim(),
      email: addForm.email.trim(),
      phone: addForm.phone.trim() || null,
      applied_position: addForm.designation_id || null,
      source: addForm.source.trim() || null,
      notes: addForm.notes.trim() || null,
      created_by: userProfile!.id,
      status: 'applied'
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setModal(null);
    setAddForm({ full_name: '', email: '', phone: '', department_id: '', designation_id: '', source: '', notes: '' });
    await loadCandidates();
  }

  const [generatedCode, setGeneratedCode] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  function generateAccessCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => chars[b % chars.length]).join('');
  }

  async function handleSendAssessment() {
    if (!selectedCandidate) return;
    if (!sendForm.include_growth_profile && !sendForm.include_domain_assessment) {
      setError('Select at least one assessment to send.'); return;
    }
    if (sendForm.include_domain_assessment && !sendForm.domain_assessment_id) {
      setError('Select a knowledge assessment.'); return;
    }
    setSaving(true); setError('');

    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const accessCode = generateAccessCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', userProfile!.organization_id)
      .maybeSingle();
    const orgName = orgData?.name || 'the organisation';

    let selectedAssessmentTitle = '';
    if (sendForm.include_domain_assessment && sendForm.domain_assessment_id) {
      const found = domainAssessments.find(a => a.id === sendForm.domain_assessment_id);
      if (found) selectedAssessmentTitle = found.title;
    }

    const invitationData: Record<string, unknown> = {
      candidate_id: selectedCandidate.id,
      organization_id: userProfile!.organization_id,
      include_growth_profile: sendForm.include_growth_profile,
      growth_profile_level: sendForm.include_growth_profile ? sendForm.growth_profile_level : null,
      include_domain_assessment: sendForm.include_domain_assessment,
      domain_assessment_id: sendForm.include_domain_assessment ? sendForm.domain_assessment_id : null,
      invitation_token: token,
      access_code: accessCode,
      candidate_name: selectedCandidate.full_name,
      organization_name: orgName,
      expires_at: expiresAt.toISOString(),
      sent_by: userProfile!.id,
      status: 'sent',
      message: sendForm.message.trim() || null
    };

    if (sendForm.include_growth_profile) {
      const { data: tmplData } = await supabase
        .from('growth_profile_templates')
        .select('id')
        .eq('level', sendForm.growth_profile_level)
        .maybeSingle();
      if (tmplData) {
        const { data: gaData } = await supabase.from('candidate_growth_assessments').insert({
          candidate_id: selectedCandidate.id,
          template_id: tmplData.id,
          level: sendForm.growth_profile_level,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
          created_by: userProfile!.id
        }).select('id').maybeSingle();
        if (gaData) invitationData.growth_assessment_id = gaData.id;
      }
    }

    const { error: invErr } = await supabase.from('assessment_invitations').insert(invitationData);
    if (invErr) { setSaving(false); setError(invErr.message); return; }

    await supabase.from('candidates').update({ status: 'assessment_pending' }).eq('id', selectedCandidate.id);

    const assessmentList = [
      sendForm.include_growth_profile ? 'Growth Profile Assessment (approx. 25-30 min)' : null,
      sendForm.include_domain_assessment && selectedAssessmentTitle ? `${selectedAssessmentTitle} (Knowledge Test)` : null,
    ].filter(Boolean).join('\n  - ');

    const draft = `Subject: Assessment Invitation — ${selectedCandidate.applied_position_title || 'Open Position'} at ${orgName}

Dear ${selectedCandidate.full_name},

${sendForm.message.trim() ? sendForm.message.trim() + '\n\n' : ''}We would like you to complete the following assessment(s) as part of your application process for ${orgName}:

  - ${assessmentList}

To begin, please visit the assessment portal and enter your unique access code:

  Access Code: ${accessCode}

  Portal: ${window.location.origin}/#/assess

Your code is valid until ${expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. If you are unable to complete the assessment in one sitting, you may return and continue from where you left off using the same code.

Once you have completed all assessments, no further action is required from your side.

If you have any questions, please do not hesitate to reach out.

Best regards,
${orgName} Recruitment Team`;

    setSaving(false);
    setGeneratedCode(accessCode);
    setEmailDraft(draft);
    setCodeCopied(false);
    setEmailCopied(false);
    setModal('email_draft');
    setSendForm({ include_growth_profile: false, growth_profile_level: 'mid', include_domain_assessment: false, domain_assessment_id: '', message: '' });
    await loadData();
  }

  async function copyToClipboard(text: string, type: 'code' | 'email') {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }
      else { setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000); }
    } catch { /* ignore */ }
  }

  async function handleSaveInterview() {
    if (!selectedCandidate) return;
    setSaving(true); setError('');

    const ratingPayload = {
      candidate_id: selectedCandidate.id,
      organization_id: userProfile!.organization_id,
      rated_by: userProfile!.id,
      interview_date: interviewForm.interview_date || null,
      comm_articulation_score: interviewForm.comm_articulation_score,
      comm_listening_score: interviewForm.comm_listening_score,
      role_experience_score: interviewForm.role_experience_score,
      role_readiness_score: interviewForm.role_readiness_score,
      ps_structure_score: interviewForm.ps_structure_score,
      ps_initiative_score: interviewForm.ps_initiative_score,
      culture_teamwork_score: interviewForm.culture_teamwork_score,
      culture_growth_score: interviewForm.culture_growth_score,
      overall_notes: interviewForm.overall_notes.trim(),
      rated_at: new Date().toISOString(),
    };

    if (existingRating) {
      const { error: rErr } = await supabase.from('candidate_interview_ratings').update(ratingPayload).eq('id', existingRating.id);
      if (rErr) { setSaving(false); setError(rErr.message); return; }
    } else {
      const { error: rErr } = await supabase.from('candidate_interview_ratings').insert(ratingPayload);
      if (rErr) { setSaving(false); setError(rErr.message); return; }
    }

    const candidateUpdates: Record<string, unknown> = {
      status: interviewForm.next_status,
      interview_date: interviewForm.interview_date || null,
      interview_notes: interviewForm.overall_notes.trim() || null,
      interviewed_by: userProfile!.id,
    };
    if (interviewForm.next_status === 'joined') candidateUpdates.hired_at = new Date().toISOString();
    const { error: err } = await supabase.from('candidates').update(candidateUpdates).eq('id', selectedCandidate.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setModal(null);
    await loadCandidates();
  }

  async function handleStatusChange(candidateId: string, newStatus: CandidateStatus) {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'joined') updates.hired_at = new Date().toISOString();
    await supabase.from('candidates').update(updates).eq('id', candidateId);
    await loadCandidates();
  }

  function handleMoveToInduction(candidate: Candidate) {
    setSelectedCandidate(candidate);
    setError('');
    setInductionForm({
      employee_code: '',
      department_id: '',
      designation_id: '',
      date_of_joining: new Date().toISOString().split('T')[0],
      employment_type: 'full_time',
    });
    setModal('move_to_induction');
  }

  async function handleConfirmInduction() {
    if (!selectedCandidate || !userProfile?.organization_id) return;
    if (!inductionForm.employee_code.trim()) { setError('Employee code is required'); return; }
    if (!inductionForm.date_of_joining) { setError('Date of joining is required'); return; }

    setSaving(true);
    setError('');

    // Account creation runs in an edge function so HR's own session is never
    // replaced and the password is a one-off value shown once.
    const temporaryPassword = generateTemporaryPassword();
    let newEmployeeId: string | null = null;
    try {
      const result = await callEdgeFunction<{ success: boolean; error?: string; employee?: { id: string } }>('create-org-employee', {
        organization_id: userProfile.organization_id,
        candidate_id: selectedCandidate.id,
        full_name: selectedCandidate.full_name,
        email: selectedCandidate.email,
        password: temporaryPassword,
        phone: selectedCandidate.phone || null,
        role: 'employee',
        employee_code: inductionForm.employee_code.trim(),
        department_id: inductionForm.department_id || null,
        designation_id: inductionForm.designation_id || null,
        date_of_joining: inductionForm.date_of_joining,
        employment_type: inductionForm.employment_type,
        employment_status: 'active',
      });
      if (!result.success) {
        setError(result.error || 'Failed to create the employee account.');
        setSaving(false);
        return;
      }
      newEmployeeId = result.employee?.id || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the employee account.');
      setSaving(false);
      return;
    }
    setInductionPassword(temporaryPassword);

    // Start the induction straight away when a template exists for the designation
    // (or a general one with no designation). The account exists either way.
    setInductionStarted(null);
    if (newEmployeeId) {
      const { data: templates } = await supabase
        .from('induction_templates')
        .select('id, title, designation_id')
        .eq('organization_id', userProfile.organization_id)
        .eq('is_active', true);
      const tpl = (templates || []).find(t => t.designation_id && t.designation_id === inductionForm.designation_id)
        || (templates || []).find(t => !t.designation_id);
      if (tpl) {
        const { error: startErr } = await supabase.rpc('start_induction', { p_employee: newEmployeeId, p_template: tpl.id, p_start: inductionForm.date_of_joining });
        setInductionStarted(startErr ? null : tpl.title);
      }
    }

    const { error: candidateError } = await supabase
      .from('candidates')
      .update({ status: 'joined', hired_at: new Date().toISOString() })
      .eq('id', selectedCandidate.id);

    if (candidateError) {
      setError(candidateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    await loadCandidates();
    setModal('induction_success');
  }

  function openDeleteAssessment(inv: Invitation, candidate: Candidate) {
    setSelectedInvitation(inv);
    setSelectedCandidate(candidate);
    setError('');
    setModal('delete_assessment');
  }

  async function handleDeleteAssessment() {
    if (!selectedInvitation) return;
    setSaving(true); setError('');
    const inv = selectedInvitation;

    if (inv.growth_assessment_id) {
      await supabase.from('growth_profile_scores').delete().eq('assessment_id', inv.growth_assessment_id);
      await supabase.from('candidate_growth_responses').delete().eq('assessment_id', inv.growth_assessment_id);
      await supabase.from('candidate_growth_assessments').delete().eq('id', inv.growth_assessment_id);
    }

    if (inv.domain_attempt_id) {
      await supabase.from('candidate_domain_responses').delete().eq('attempt_id', inv.domain_attempt_id);
      await supabase.from('candidate_domain_attempts').delete().eq('id', inv.domain_attempt_id);
    }

    const { error: err } = await supabase.from('assessment_invitations').delete().eq('id', inv.id);
    setSaving(false);
    if (err) { setError(err.message); return; }

    if (selectedCandidate && ['assessment_pending', 'assessment_completed'].includes(selectedCandidate.status)) {
      await supabase.from('candidates').update({ status: 'applied' }).eq('id', selectedCandidate.id);
    }

    setModal(null);
    await loadData();
  }

  const filtered = candidates.filter(c => {
    const matchesSearch = !searchQuery ||
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase());
    const effectiveStatus = getEffectiveStatus(c, invitations);
    const matchesStatus = filterStatus === 'all' || effectiveStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pipelineCounts = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.status] = candidates.filter(c => getEffectiveStatus(c, invitations) === stage.status).length;
    return acc;
  }, {} as Record<string, number>);

  async function openSendAssessment(c: Candidate) {
    setSelectedCandidate(c);
    setError('');
    setShowAllAssessments(false);

    const existingInv = invitations
      .filter(i => i.candidate_id === c.id && ['sent', 'opened', 'in_progress'].includes(i.status) && i.access_code)
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];

    if (existingInv?.access_code) {
      const { data: orgData } = await supabase
        .from('organizations').select('name').eq('id', userProfile!.organization_id).maybeSingle();
      const orgName = orgData?.name || 'the organisation';
      const expiresAt = new Date(existingInv.expires_at);

      const assessmentParts = [
        existingInv.include_growth_profile ? 'Growth Profile Assessment (approx. 25-30 min)' : null,
        existingInv.include_domain_assessment && existingInv.domain_assessment ? `${existingInv.domain_assessment.title} (Knowledge Test)` : null,
      ].filter(Boolean).join('\n  - ');

      const draft = `Subject: Assessment Invitation — ${c.applied_position_title || 'Open Position'} at ${orgName}

Dear ${c.full_name},

We would like you to complete the following assessment(s) as part of your application process for ${orgName}:

  - ${assessmentParts}

To begin, please visit the assessment portal and enter your unique access code:

  Access Code: ${existingInv.access_code}

  Portal: ${window.location.origin}/#/assess

Your code is valid until ${expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. If you are unable to complete the assessment in one sitting, you may return and continue from where you left off using the same code.

Once you have completed all assessments, no further action is required from your side.

If you have any questions, please do not hesitate to reach out.

Best regards,
${orgName} Recruitment Team`;

      setGeneratedCode(existingInv.access_code);
      setEmailDraft(draft);
      setCodeCopied(false);
      setEmailCopied(false);
      setModal('email_draft');
      return;
    }

    setSendForm({ include_growth_profile: false, growth_profile_level: 'mid', include_domain_assessment: false, domain_assessment_id: '', message: '' });
    setModal('send_assessment');
  }

  async function openInterview(c: Candidate) {
    setSelectedCandidate(c);
    setExistingRating(null);
    const defaultForm = {
      interview_date: c.interview_date || '',
      overall_notes: c.interview_notes || '',
      next_status: (['interview_scheduled', 'assessment_completed'].includes(c.status) ? 'interviewed' : 'shortlisted') as CandidateStatus,
      comm_articulation_score: 5,
      comm_listening_score: 5,
      role_experience_score: 5,
      role_readiness_score: 5,
      ps_structure_score: 5,
      ps_initiative_score: 5,
      culture_teamwork_score: 5,
      culture_growth_score: 5,
    };
    const { data: existing } = await supabase
      .from('candidate_interview_ratings')
      .select('*')
      .eq('candidate_id', c.id)
      .order('rated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      setExistingRating(existing as InterviewRating);
      defaultForm.comm_articulation_score = existing.comm_articulation_score;
      defaultForm.comm_listening_score = existing.comm_listening_score;
      defaultForm.role_experience_score = existing.role_experience_score;
      defaultForm.role_readiness_score = existing.role_readiness_score;
      defaultForm.ps_structure_score = existing.ps_structure_score;
      defaultForm.ps_initiative_score = existing.ps_initiative_score;
      defaultForm.culture_teamwork_score = existing.culture_teamwork_score;
      defaultForm.culture_growth_score = existing.culture_growth_score;
      defaultForm.overall_notes = existing.overall_notes || c.interview_notes || '';
      defaultForm.interview_date = existing.interview_date || c.interview_date || '';
    }
    setInterviewForm(defaultForm);
    setError('');
    setModal('interview');
  }

  const [detailRating, setDetailRating] = useState<InterviewRating | null>(null);
  const [detailGrowthScores, setDetailGrowthScores] = useState<GrowthScores | null>(null);
  const [detailDomainScore, setDetailDomainScore] = useState<{ title: string; score: number; maxScore: number; percentage: number } | null>(null);
  const [detailDetailedResponses, setDetailDetailedResponses] = useState<DetailedResponses | null>(null);

  async function openDetail(c: Candidate) {
    setSelectedCandidate(c);
    setDetailRating(null);
    setDetailGrowthScores(null);
    setDetailDomainScore(null);
    setDetailDetailedResponses(null);

    const { data: completedInv } = await supabase
      .from('assessment_invitations')
      .select('id, growth_assessment_id, domain_attempt_id, include_growth_profile, include_domain_assessment, status')
      .eq('candidate_id', c.id)
      .eq('status', 'completed')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: anyInv } = !completedInv
      ? await supabase
          .from('assessment_invitations')
          .select('id, growth_assessment_id, domain_attempt_id, include_growth_profile, include_domain_assessment, status')
          .eq('candidate_id', c.id)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const latestInv = completedInv || anyInv;

    const growthAssessmentId = latestInv?.growth_assessment_id || null;
    let domainAttemptId = latestInv?.domain_attempt_id || null;

    if (!domainAttemptId && latestInv?.include_domain_assessment) {
      const { data: fallbackAttempt } = await supabase
        .from('candidate_domain_attempts')
        .select('id')
        .eq('candidate_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      domainAttemptId = fallbackAttempt?.id || null;
    }

    const [ratingResult, growthScoreResult, domainResult] = await Promise.all([
      supabase
        .from('candidate_interview_ratings')
        .select('*')
        .eq('candidate_id', c.id)
        .order('rated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      growthAssessmentId
        ? supabase
            .from('growth_profile_scores')
            .select('overall_score, overall_percentile, fit_level, adaptability_learning_score, initiative_ownership_score, collaboration_team_score, resilience_stress_score, growth_curiosity_score, strengths, development_areas, social_desirability_index, response_validity, calculated_at, assessment_id')
            .eq('assessment_id', growthAssessmentId)
            .maybeSingle()
        : supabase
            .from('growth_profile_scores')
            .select('overall_score, overall_percentile, fit_level, adaptability_learning_score, initiative_ownership_score, collaboration_team_score, resilience_stress_score, growth_curiosity_score, strengths, development_areas, social_desirability_index, response_validity, calculated_at, assessment_id')
            .eq('candidate_id', c.id)
            .order('calculated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
      domainAttemptId
        ? supabase
            .from('candidate_domain_attempts')
            .select('score, max_score, percentage, assessment_id')
            .eq('id', domainAttemptId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setDetailRating(ratingResult.data as InterviewRating | null);
    setDetailGrowthScores(growthScoreResult.data as GrowthScores | null);

    const resolvedGrowthAssessmentId = (growthScoreResult.data as { assessment_id?: string } | null)?.assessment_id || null;

    if (domainResult.data) {
      const attempt = domainResult.data as { score: number; max_score: number; percentage: number; assessment_id: string };
      const { data: assessmentData } = await supabase
        .from('candidate_domain_assessments')
        .select('title')
        .eq('id', attempt.assessment_id)
        .maybeSingle();
      setDetailDomainScore({
        title: assessmentData?.title || 'Knowledge Assessment',
        score: attempt.score,
        maxScore: attempt.max_score,
        percentage: attempt.percentage,
      });
    }

    const responses: DetailedResponses = {
      growthResponses: [],
      domainResponses: [],
      domainTitle: '',
      domainScore: null,
      domainMaxScore: null,
      domainPercentage: null,
    };

    if (resolvedGrowthAssessmentId) {
      const { data: gResponses } = await supabase
        .from('candidate_growth_responses')
        .select('answer_value, question_id')
        .eq('assessment_id', resolvedGrowthAssessmentId);

      if (gResponses && gResponses.length > 0) {
        const questionIds = gResponses.map((r: { question_id: string }) => r.question_id);
        const { data: questions } = await supabase
          .from('growth_profile_questions')
          .select('id, question_number, dimension, question_text, question_type, answer_scale, is_reverse_scored, option_1, option_2, option_3, option_4, option_5')
          .in('id', questionIds)
          .order('question_number');

        if (questions) {
          responses.growthResponses = questions.map((q: Record<string, unknown>) => ({
            ...(q as object),
            answer_value: gResponses.find((r: { question_id: string }) => r.question_id === q.id)?.answer_value ?? 0,
          })) as GrowthResponseItem[];
        }
      }
    }

    if (domainAttemptId && domainResult.data) {
      const attempt = domainResult.data as { score: number; max_score: number; percentage: number; assessment_id: string };
      responses.domainScore = attempt.score;
      responses.domainMaxScore = attempt.max_score;
      responses.domainPercentage = attempt.percentage;

      const { data: assessment } = await supabase
        .from('candidate_domain_assessments')
        .select('title')
        .eq('id', attempt.assessment_id)
        .maybeSingle();
      responses.domainTitle = (assessment as { title: string } | null)?.title || '';

      const { data: dResponses } = await supabase
        .from('candidate_domain_responses')
        .select('question_id, answer_text, is_correct, points_awarded')
        .eq('attempt_id', domainAttemptId);

      if (dResponses && dResponses.length > 0) {
        const qIds = dResponses.map((r: { question_id: string }) => r.question_id);
        const { data: dQuestions } = await supabase
          .from('domain_assessment_questions')
          .select('id, question_number, question_text, question_type, options, correct_answer, points')
          .in('id', qIds)
          .order('question_number');

        if (dQuestions) {
          responses.domainResponses = dQuestions.map((q: Record<string, unknown>) => ({
            ...(q as object),
            answer_text: dResponses.find((r: { question_id: string }) => r.question_id === q.id)?.answer_text ?? '',
            is_correct: dResponses.find((r: { question_id: string }) => r.question_id === q.id)?.is_correct ?? null,
            points_awarded: dResponses.find((r: { question_id: string }) => r.question_id === q.id)?.points_awarded ?? null,
          })) as DomainResponseItem[];
        }
      }
    }

    setDetailDetailedResponses(responses);
    setModal('detail');
  }

  async function openGrowthResults(inv: Invitation, candidate: Candidate) {
    setSelectedCandidate(candidate);
    setSelectedInvitation(inv);
    setGrowthScores(null);
    setModal('growth_results');
    if (!inv.growth_assessment_id) return;
    setGrowthScoresLoading(true);
    const { data } = await supabase
      .from('growth_profile_scores')
      .select('overall_score, overall_percentile, fit_level, adaptability_learning_score, initiative_ownership_score, collaboration_team_score, resilience_stress_score, growth_curiosity_score, strengths, development_areas, social_desirability_index, response_validity, calculated_at')
      .eq('assessment_id', inv.growth_assessment_id)
      .maybeSingle();
    setGrowthScores(data as GrowthScores | null);
    setGrowthScoresLoading(false);
  }

  async function openDetailResponses(inv: Invitation, candidate: Candidate) {
    setSelectedCandidate(candidate);
    setSelectedInvitation(inv);
    setDetailResponses(null);
    setModal('detail_responses');
    setDetailResponsesLoading(true);

    const result: DetailedResponses = {
      growthResponses: [],
      domainResponses: [],
      domainTitle: '',
      domainScore: null,
      domainMaxScore: null,
      domainPercentage: null,
    };

    if (inv.include_growth_profile && inv.growth_assessment_id) {
      const { data: gResponses } = await supabase
        .from('candidate_growth_responses')
        .select('answer_value, question_id')
        .eq('assessment_id', inv.growth_assessment_id);

      if (gResponses && gResponses.length > 0) {
        const questionIds = gResponses.map((r: { question_id: string }) => r.question_id);
        const { data: questions } = await supabase
          .from('growth_profile_questions')
          .select('id, question_number, dimension, question_text, question_type, answer_scale, is_reverse_scored, option_1, option_2, option_3, option_4, option_5')
          .in('id', questionIds)
          .order('question_number');

        if (questions) {
          result.growthResponses = questions.map((q: Record<string, unknown>) => ({
            ...(q as object),
            answer_value: gResponses.find((r: { question_id: string }) => r.question_id === q.id)?.answer_value ?? 0,
          })) as GrowthResponseItem[];
        }
      }
    }

    if (inv.include_domain_assessment) {
      let resolvedAttemptId = inv.domain_attempt_id || null;

      if (!resolvedAttemptId) {
        const { data: fallback } = await supabase
          .from('candidate_domain_attempts')
          .select('id')
          .eq('candidate_id', candidate.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        resolvedAttemptId = fallback?.id || null;
      }

      if (resolvedAttemptId) {
        const { data: attempt } = await supabase
          .from('candidate_domain_attempts')
          .select('score, max_score, percentage, assessment_id')
          .eq('id', resolvedAttemptId)
          .maybeSingle();

      if (attempt) {
        result.domainScore = attempt.score;
        result.domainMaxScore = attempt.max_score;
        result.domainPercentage = attempt.percentage;

        const { data: assessment } = await supabase
          .from('candidate_domain_assessments')
          .select('title')
          .eq('id', attempt.assessment_id)
          .maybeSingle();
        result.domainTitle = assessment?.title || '';

        const { data: dResponses } = await supabase
          .from('candidate_domain_responses')
          .select('question_id, answer_text, is_correct, points_awarded')
          .eq('attempt_id', resolvedAttemptId);

        if (dResponses && dResponses.length > 0) {
          const qIds = dResponses.map(r => r.question_id);
          const { data: dQuestions } = await supabase
            .from('domain_assessment_questions')
            .select('id, question_number, question_text, question_type, options, correct_answer, points')
            .in('id', qIds)
            .order('question_number');

          if (dQuestions) {
            result.domainResponses = dQuestions.map(q => ({
              ...q,
              answer_text: dResponses.find(r => r.question_id === q.id)?.answer_text ?? '',
              is_correct: dResponses.find(r => r.question_id === q.id)?.is_correct ?? null,
              points_awarded: dResponses.find(r => r.question_id === q.id)?.points_awarded ?? null,
            }));
          }
        }
      }
      }
    }

    setDetailResponses(result);
    setDetailResponsesLoading(false);
  }

  const getCandidateInvitations = (id: string) => invitations.filter(i => i.candidate_id === id);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            {/* page name is in the header */}
            <p className="text-sm text-gray-500 mt-0.5">Manage your full recruitment pipeline</p>
          </div>
          <button
            onClick={() => { setModal('add'); setError(''); setAddForm({ full_name: '', email: '', phone: '', department_id: '', designation_id: '', source: '', notes: '' }); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-950 text-white rounded-lg hover:bg-blue-900 transition text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            Add Candidate
          </button>
        </div>

        <p className="text-xs text-gray-500 font-medium">{candidates.length} candidate{candidates.length !== 1 ? 's' : ''} in pipeline</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <PipelineView
            candidates={filtered}
            invitations={invitations}
            growthScoreMap={growthScoreMap}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            pipelineCounts={pipelineCounts}
            onDetail={openDetail}
            onSendAssessment={openSendAssessment}
            onInterview={openInterview}
            onStatusChange={handleStatusChange}
            onMoveToInduction={handleMoveToInduction}
            onGrowthClick={openGrowthResults}
            onKnowledgeClick={openDetailResponses}
          />
        )}
      </div>

      {modal === 'add' && (
        <Modal title="Add New Candidate" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <ErrorAlert message={error} />}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <FieldLabel>Full Name *</FieldLabel>
                <input className={inputCls} value={addForm.full_name} onChange={e => setAddForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Jane Smith" />
              </div>
              <div>
                <FieldLabel>Email *</FieldLabel>
                <input type="email" className={inputCls} value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <input className={inputCls} value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 0000" />
              </div>
              <div>
                <FieldLabel>Department</FieldLabel>
                <select
                  className={inputCls}
                  value={addForm.department_id}
                  onChange={e => setAddForm(p => ({ ...p, department_id: e.target.value, designation_id: '' }))}
                >
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Applying For</FieldLabel>
                <select
                  className={inputCls}
                  value={addForm.designation_id}
                  onChange={e => setAddForm(p => ({ ...p, designation_id: e.target.value }))}
                  disabled={!addForm.department_id}
                >
                  <option value="">Select role</option>
                  {designations
                    .filter(d => !addForm.department_id || d.department_id === addForm.department_id)
                    .map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Source</FieldLabel>
                <select className={inputCls} value={addForm.source} onChange={e => setAddForm(p => ({ ...p, source: e.target.value }))}>
                  <option value="">Select source</option>
                  {['LinkedIn', 'Referral', 'Job Portal', 'Direct Application', 'Campus Recruitment', 'Other'].map(s => (
                    <option key={s} value={s.toLowerCase().replace(' ', '_')}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <FieldLabel>Notes</FieldLabel>
                <textarea rows={2} className={inputCls} value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any initial notes..." />
              </div>
            </div>
            <ModalActions onCancel={() => setModal(null)} onConfirm={handleAddCandidate} saving={saving} confirmLabel="Add Candidate" />
          </div>
        </Modal>
      )}

      {modal === 'detail' && selectedCandidate && (
        <Modal title="Candidate Profile" onClose={() => setModal(null)} wide>
          <CandidateDetailView
            candidate={selectedCandidate}
            invitations={getCandidateInvitations(selectedCandidate.id)}
            interviewRating={detailRating}
            growthScores={detailGrowthScores}
            domainScore={detailDomainScore}
            detailedResponses={detailDetailedResponses}
            onSendAssessment={() => { setModal(null); setTimeout(() => openSendAssessment(selectedCandidate), 50); }}
            onInterview={() => { setModal(null); setTimeout(() => openInterview(selectedCandidate), 50); }}
            onMoveToInduction={() => { setModal(null); setTimeout(() => handleMoveToInduction(selectedCandidate), 50); }}
          />
        </Modal>
      )}

      {modal === 'send_assessment' && selectedCandidate && (
        <Modal title={`Send Assessment — ${selectedCandidate.full_name}`} onClose={() => setModal(null)}>
          <div className="space-y-5">
            {error && <ErrorAlert message={error} />}
            <p className="text-sm text-gray-600">Select which assessments to include. The candidate will receive a single invitation link.</p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                <input type="checkbox" className="mt-0.5" checked={sendForm.include_growth_profile} onChange={e => setSendForm(p => ({ ...p, include_growth_profile: e.target.checked }))} />
                <div>
                  <p className="text-sm font-medium text-gray-900">Growth Profile Assessment</p>
                  <p className="text-xs text-gray-500 mt-0.5">25–30 min personality and culture-fit evaluation across 5 dimensions</p>
                </div>
              </label>

              {sendForm.include_growth_profile && (
                <div className="ml-6">
                  <FieldLabel>Experience Level</FieldLabel>
                  <select className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={sendForm.growth_profile_level} onChange={e => setSendForm(p => ({ ...p, growth_profile_level: e.target.value }))}>
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid Level</option>
                    <option value="senior">Senior Level</option>
                  </select>
                </div>
              )}

              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                <input type="checkbox" className="mt-0.5" checked={sendForm.include_domain_assessment} onChange={e => setSendForm(p => ({ ...p, include_domain_assessment: e.target.checked }))} />
                <div>
                  <p className="text-sm font-medium text-gray-900">Knowledge Assessment</p>
                  <p className="text-xs text-gray-500 mt-0.5">Role-specific knowledge test built in the Assessment Builder</p>
                </div>
              </label>

              {sendForm.include_domain_assessment && selectedCandidate && (() => {
                const candidateDesigId = selectedCandidate.applied_position;
                const matched = candidateDesigId
                  ? domainAssessments.filter(a => !a.designation_id || a.designation_id === candidateDesigId)
                  : domainAssessments;
                const canFilter = !!candidateDesigId && matched.length < domainAssessments.length;
                const displayList = (canFilter && !showAllAssessments) ? matched : domainAssessments;
                return (
                  <div className="ml-6 space-y-2">
                    {domainAssessments.length === 0 ? (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">No knowledge assessments found. Create one in Assessment Builder first.</p>
                    ) : (
                      <div>
                        {canFilter && !showAllAssessments && (
                          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded px-2.5 py-1.5 mb-2">
                            <p className="text-xs text-blue-700">
                              {matched.length} assessment{matched.length !== 1 ? 's' : ''} matched to candidate's role
                            </p>
                            <button type="button" onClick={() => setShowAllAssessments(true)} className="text-xs text-blue-600 hover:underline font-medium ml-2">
                              Show all
                            </button>
                          </div>
                        )}
                        {showAllAssessments && canFilter && (
                          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 mb-2">
                            <p className="text-xs text-gray-500">Showing all {domainAssessments.length} assessments</p>
                            <button type="button" onClick={() => setShowAllAssessments(false)} className="text-xs text-blue-600 hover:underline font-medium ml-2">
                              Show matched only
                            </button>
                          </div>
                        )}
                        <FieldLabel>Select Assessment</FieldLabel>
                        <select className={`${inputCls} w-full`} value={sendForm.domain_assessment_id} onChange={e => setSendForm(p => ({ ...p, domain_assessment_id: e.target.value }))}>
                          <option value="">Choose...</option>
                          {displayList.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div>
              <FieldLabel>Message to Candidate (optional)</FieldLabel>
              <textarea rows={3} className={inputCls} value={sendForm.message} onChange={e => setSendForm(p => ({ ...p, message: e.target.value }))} placeholder="Hi, please complete the assessments at your earliest convenience..." />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              A unique 6-character access code will be generated. You will see a ready-to-send email draft with the code that you can copy and send to the candidate. The code is valid for 7 days.
            </div>

            <ModalActions onCancel={() => setModal(null)} onConfirm={handleSendAssessment} saving={saving} confirmLabel="Send Invitation" confirmIcon={<Send className="w-3.5 h-3.5" />} />
          </div>
        </Modal>
      )}

      {modal === 'email_draft' && (
        <Modal title="Assessment Invitation Ready" onClose={() => setModal(null)} wide>
          <div className="space-y-5">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Assessment invitation created successfully</p>
                <p className="text-xs text-green-700 mt-0.5">Copy the email draft below and send it to the candidate. They will use the access code to begin their assessment.</p>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-950" />
                  <span className="text-sm font-semibold text-gray-900">Access Code</span>
                </div>
                <button
                  onClick={() => copyToClipboard(generatedCode, 'code')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {codeCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {codeCopied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3 font-mono text-2xl font-bold tracking-widest text-blue-950 text-center">
                {generatedCode}
              </div>
              <p className="text-xs text-gray-500 text-center">Candidate visits <span className="font-medium">{window.location.origin}/#/assess</span> and enters this code</p>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Mail className="w-4 h-4" />Email Draft</span>
                <button
                  onClick={() => copyToClipboard(emailDraft, 'email')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 bg-white transition"
                >
                  {emailCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {emailCopied ? 'Copied!' : 'Copy Email'}
                </button>
              </div>
              <textarea
                readOnly
                value={emailDraft}
                rows={18}
                className="w-full px-4 py-3 text-xs text-gray-700 font-mono bg-white resize-none focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button onClick={() => setModal(null)} className="px-5 py-2 text-sm bg-blue-950 text-white rounded-lg hover:bg-blue-900 transition font-medium">Done</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'growth_results' && selectedCandidate && (
        <Modal title={`Growth Profile Results — ${selectedCandidate.full_name}`} onClose={() => setModal(null)} wide>
          <GrowthResultsView scores={growthScores} loading={growthScoresLoading} invitation={selectedInvitation} />
        </Modal>
      )}

      {modal === 'detail_responses' && selectedCandidate && (
        <Modal title={`Assessment Responses — ${selectedCandidate.full_name}`} onClose={() => setModal(null)} wide>
          <DetailedResponsesView data={detailResponses} loading={detailResponsesLoading} />
        </Modal>
      )}

      {modal === 'delete_assessment' && selectedInvitation && selectedCandidate && (
        <Modal title="Delete Assessment" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <ErrorAlert message={error} />}
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <Trash2 className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">This action cannot be undone</p>
                <p className="text-sm text-red-700 mt-1">
                  All assessment data for <span className="font-semibold">{selectedCandidate.full_name}</span> will be permanently deleted — including responses, scores, and the invitation. The candidate's record will remain.
                </p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {selectedInvitation.include_growth_profile && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Growth Profile</span>
                  )}
                  {selectedInvitation.include_domain_assessment && selectedInvitation.domain_assessment && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">{selectedInvitation.domain_assessment.title}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${selectedInvitation.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {selectedInvitation.status.charAt(0).toUpperCase() + selectedInvitation.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">After deletion, you can send a fresh assessment invitation to this candidate.</p>
            <ModalActions onCancel={() => setModal(null)} onConfirm={handleDeleteAssessment} saving={saving} confirmLabel="Delete Assessment" confirmDanger />
          </div>
        </Modal>
      )}

      {modal === 'move_to_induction' && selectedCandidate && (
        <Modal title="Register as Employee" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <ErrorAlert message={error} />}
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <UserCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">{selectedCandidate.full_name}</p>
                <p className="text-sm text-emerald-700 mt-0.5">
                  Fill in the details below to create an employee record and move this candidate to Onboarding.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <FieldLabel>Employee Code *</FieldLabel>
                <input
                  className={inputCls}
                  value={inductionForm.employee_code}
                  onChange={e => setInductionForm(p => ({ ...p, employee_code: e.target.value }))}
                  placeholder="e.g. EMP-001"
                />
              </div>
              <div>
                <FieldLabel>Date of Joining *</FieldLabel>
                <input
                  type="date"
                  className={inputCls}
                  value={inductionForm.date_of_joining}
                  onChange={e => setInductionForm(p => ({ ...p, date_of_joining: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel>Employment Type</FieldLabel>
                <select className={inputCls} value={inductionForm.employment_type} onChange={e => setInductionForm(p => ({ ...p, employment_type: e.target.value }))}>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
              <div>
                <FieldLabel>Department</FieldLabel>
                <select className={inputCls} value={inductionForm.department_id} onChange={e => setInductionForm(p => ({ ...p, department_id: e.target.value }))}>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Designation</FieldLabel>
                <select className={inputCls} value={inductionForm.designation_id} onChange={e => setInductionForm(p => ({ ...p, designation_id: e.target.value }))}>
                  <option value="">Select designation</option>
                  {designations.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
            </div>

            <ModalActions
              onCancel={() => setModal(null)}
              onConfirm={handleConfirmInduction}
              saving={saving}
              confirmLabel="Register as Employee"
              confirmIcon={<ArrowRight className="w-3.5 h-3.5" />}
            />
          </div>
        </Modal>
      )}

      {modal === 'induction_success' && selectedCandidate && (
        <Modal title="Employee Registered" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">{selectedCandidate.full_name} has been registered as an employee</p>
                <p className="text-sm text-emerald-700 mt-0.5">
                  {inductionStarted
                    ? `Their "${inductionStarted}" induction has started from their joining date. You can follow it under Onboard → Inductions.`
                    : 'An employee record has been created. No induction template matches their designation, so start one from Onboard → Inductions when ready.'}
                </p>
              </div>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <p className="text-sm font-semibold text-amber-800">First-time Login Credentials</p>
              </div>
              <p className="text-sm text-amber-700">
                Share these credentials with <span className="font-semibold">{selectedCandidate.full_name}</span> to sign in for the first time:
              </p>
              <div className="mt-1 space-y-1 text-sm font-mono bg-white border border-amber-200 rounded-lg p-3">
                <p><span className="text-slate-500">Email:</span> <span className="font-semibold text-slate-800">{selectedCandidate.email}</span></p>
                <p><span className="text-slate-500">Temporary password:</span> <span className="font-semibold text-slate-800 font-mono">{inductionPassword}</span></p>
              </div>
              <p className="text-xs text-amber-600 mt-1">The password is shown once only. The employee should change it after first login.</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setModal(null)}
                className="px-5 py-2 text-sm bg-blue-950 text-white rounded-lg hover:bg-blue-900 transition font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'interview' && selectedCandidate && (() => {
        const totalScore = interviewForm.comm_articulation_score + interviewForm.comm_listening_score + interviewForm.role_experience_score + interviewForm.role_readiness_score + interviewForm.ps_structure_score + interviewForm.ps_initiative_score + interviewForm.culture_teamwork_score + interviewForm.culture_growth_score;
        const pct = Math.round((totalScore / 80) * 100);
        return (
          <Modal title={`Interview Rating — ${selectedCandidate.full_name}`} onClose={() => setModal(null)} wide>
            <div className="space-y-5">
              {error && <ErrorAlert message={error} />}

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div>
                  <FieldLabel>Interview Date</FieldLabel>
                  <input type="date" className={inputCls} value={interviewForm.interview_date} onChange={e => setInterviewForm(p => ({ ...p, interview_date: e.target.value }))} />
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-500 mb-0.5">Total Score</p>
                  <p className="text-3xl font-bold text-blue-950">{totalScore}<span className="text-base font-normal text-gray-400">/80</span></p>
                  <p className="text-xs text-gray-400 mt-0.5">{pct}%</p>
                </div>
              </div>

              <div className="space-y-4">
                {RATING_AREAS.map(area => {
                  const Icon = area.icon;
                  const areaTotal = area.statements.reduce((sum, s) => sum + (interviewForm[s.key as keyof typeof interviewForm] as number), 0);
                  return (
                    <div key={area.label} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3.5 h-3.5 text-blue-700" />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 flex-1">{area.label}</p>
                        <span className="text-xs font-bold text-blue-950">{areaTotal}/20</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {area.statements.map((stmt, idx) => {
                          const val = interviewForm[stmt.key as keyof typeof interviewForm] as number;
                          const scoreColor = val >= 8 ? 'text-emerald-600' : val >= 5 ? 'text-amber-600' : 'text-red-500';
                          return (
                            <div key={stmt.key} className="px-4 py-3">
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <p className="text-xs text-gray-700 flex-1">
                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold mr-1.5 flex-shrink-0">{idx + 1}</span>
                                  {stmt.text}
                                </p>
                                <span className={`text-lg font-bold flex-shrink-0 ${scoreColor}`}>{val}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-8">Poor</span>
                                <div className="flex-1 flex gap-1">
                                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => setInterviewForm(p => ({ ...p, [stmt.key]: n }))}
                                      className={`flex-1 h-6 rounded text-xs font-semibold transition-all ${val === n ? (n >= 8 ? 'bg-emerald-500 text-white' : n >= 5 ? 'bg-amber-400 text-white' : 'bg-red-400 text-white') : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                    >
                                      {n}
                                    </button>
                                  ))}
                                </div>
                                <span className="text-xs text-gray-400 w-12 text-right">Excellent</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <FieldLabel>Overall Notes</FieldLabel>
                <textarea rows={3} className={inputCls} value={interviewForm.overall_notes} onChange={e => setInterviewForm(p => ({ ...p, overall_notes: e.target.value }))} placeholder="Key observations from the interview..." />
              </div>

              <div>
                <FieldLabel>Move Candidate To</FieldLabel>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(['interviewed', 'shortlisted', 'offer_extended', 'rejected'] as CandidateStatus[]).map(s => {
                    const stage = getStage(s);
                    return (
                      <label key={s} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition ${interviewForm.next_status === s ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name="next_status" value={s} checked={interviewForm.next_status === s} onChange={() => setInterviewForm(p => ({ ...p, next_status: s }))} className="sr-only" />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>{stage.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <ModalActions onCancel={() => setModal(null)} onConfirm={handleSaveInterview} saving={saving} confirmLabel="Save & Update" />
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>;
}

function ModalActions({ onCancel, onConfirm, saving, confirmLabel, confirmIcon, confirmDanger }: {
  onCancel: () => void; onConfirm: () => void; saving: boolean; confirmLabel: string; confirmIcon?: React.ReactNode; confirmDanger?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
      <button onClick={onConfirm} disabled={saving} className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ${confirmDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-950 hover:bg-blue-900'}`}>
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : confirmIcon}
        {confirmLabel}
      </button>
    </div>
  );
}

function PipelineView({ candidates, invitations, growthScoreMap, searchQuery, setSearchQuery, filterStatus, setFilterStatus, pipelineCounts, onDetail, onSendAssessment, onInterview, onStatusChange, onMoveToInduction, onGrowthClick, onKnowledgeClick }: {
  candidates: Candidate[];
  invitations: Invitation[];
  growthScoreMap: Record<string, { fit_level: string; overall_score: number }>;
  searchQuery: string; setSearchQuery: (v: string) => void;
  filterStatus: string; setFilterStatus: (v: string) => void;
  pipelineCounts: Record<string, number>;
  onDetail: (c: Candidate) => void;
  onSendAssessment: (c: Candidate) => void;
  onInterview: (c: Candidate) => void;
  onStatusChange: (id: string, s: CandidateStatus) => void;
  onMoveToInduction: (c: Candidate) => void;
  onGrowthClick: (inv: Invitation, c: Candidate) => void;
  onKnowledgeClick: (inv: Invitation, c: Candidate) => void;
}) {
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    try { return (localStorage.getItem('candidates_view') as 'card' | 'table') || 'card'; } catch { return 'card'; }
  });
  const totalCount = Object.values(pipelineCounts).reduce((a, b) => a + b, 0);

  const toggleView = (mode: 'card' | 'table') => {
    setViewMode(mode);
    try { localStorage.setItem('candidates_view', mode); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap flex-1">
          <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${filterStatus === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
            All ({totalCount})
          </button>
          {PIPELINE_STAGES.map(stage => pipelineCounts[stage.status] > 0 && (
            <button key={stage.status} onClick={() => setFilterStatus(stage.status)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${filterStatus === stage.status ? `${stage.bg} ${stage.color} border-current` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
              {stage.label} ({pipelineCounts[stage.status]})
            </button>
          ))}
        </div>
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white flex-shrink-0">
          <button
            onClick={() => toggleView('card')}
            title="Card view"
            className={`p-2 transition ${viewMode === 'card' ? 'bg-blue-950 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleView('table')}
            title="Table view"
            className={`p-2 transition ${viewMode === 'table' ? 'bg-blue-950 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" placeholder="Search candidates..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>

      {candidates.length === 0 ? (
        <EmptyState icon={<Users className="w-10 h-10 text-gray-300" />} title="No candidates found" description="Add your first candidate or adjust filters" />
      ) : viewMode === 'card' ? (
        <div className="grid gap-3">
          {candidates.map(c => (
            <CandidateCard key={c.id} candidate={c} invitations={invitations} growthScoreMap={growthScoreMap} onDetail={onDetail} onSendAssessment={onSendAssessment} onInterview={onInterview} onStatusChange={onStatusChange} onMoveToInduction={onMoveToInduction} onGrowthClick={onGrowthClick} onKnowledgeClick={onKnowledgeClick} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Candidate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Position</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assessments</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Applied</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {candidates.map(c => (
                <CandidateRow key={c.id} candidate={c} invitations={invitations} growthScoreMap={growthScoreMap} onDetail={onDetail} onSendAssessment={onSendAssessment} onInterview={onInterview} onStatusChange={onStatusChange} onMoveToInduction={onMoveToInduction} onGrowthClick={onGrowthClick} onKnowledgeClick={onKnowledgeClick} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CandidateRow({ candidate, invitations, growthScoreMap, onDetail, onSendAssessment, onInterview, onStatusChange, onMoveToInduction, onGrowthClick, onKnowledgeClick }: {
  candidate: Candidate;
  invitations: Invitation[];
  growthScoreMap: Record<string, { fit_level: string; overall_score: number }>;
  onDetail: (c: Candidate) => void;
  onSendAssessment: (c: Candidate) => void;
  onInterview: (c: Candidate) => void;
  onStatusChange: (id: string, s: CandidateStatus) => void;
  onMoveToInduction: (c: Candidate) => void;
  onGrowthClick: (inv: Invitation, c: Candidate) => void;
  onKnowledgeClick: (inv: Invitation, c: Candidate) => void;
}) {
  const effectiveStatus = getEffectiveStatus(candidate, invitations);
  const stage = getStage(effectiveStatus);
  const [showMenu, setShowMenu] = useState(false);

  const completedInv = invitations
    .filter(i => i.candidate_id === candidate.id && i.status === 'completed')
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];

  const knowledgeScore = completedInv?.include_domain_assessment && completedInv?.domain_score != null
    ? Math.round(Number(completedInv.domain_score)) : null;
  const growthScore = completedInv?.growth_assessment_id ? growthScoreMap[completedInv.growth_assessment_id] ?? null : null;
  const fitCfg = growthScore ? (FIT_LEVEL_CONFIG[growthScore.fit_level] || { label: growthScore.fit_level, color: 'text-gray-700', bg: 'bg-gray-100' }) : null;

  const getPrimaryAction = () => {
    switch (effectiveStatus) {
      case 'applied': return { label: 'Send Assessment', action: () => onSendAssessment(candidate) };
      case 'assessment_pending': return { label: 'Resend', action: () => onSendAssessment(candidate) };
      case 'assessment_completed': return { label: 'Interview', action: () => onInterview(candidate) };
      case 'interview_scheduled': return { label: 'Rate', action: () => onInterview(candidate) };
      case 'interviewed': return { label: 'Update', action: () => onInterview(candidate) };
      case 'shortlisted': return { label: 'Offer', action: () => onStatusChange(candidate.id, 'offer_extended') };
      case 'offer_extended': return { label: 'Accept', action: () => onStatusChange(candidate.id, 'offer_accepted') };
      case 'offer_accepted': return { label: 'Register', action: () => onMoveToInduction(candidate) };
      default: return null;
    }
  };
  const action = getPrimaryAction();

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-950 text-white flex items-center justify-center flex-shrink-0 font-semibold text-xs">
            {candidate.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{candidate.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{candidate.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>{stage.label}</span>
      </td>
      <td className="px-4 py-3">
        <p className="text-xs text-gray-600 truncate max-w-[140px]">
          {candidate.applied_position_title || candidate.designation?.title || <span className="text-gray-400">—</span>}
        </p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {completedInv?.include_growth_profile && fitCfg && (
            <button onClick={() => onGrowthClick(completedInv, candidate)} className={`text-xs px-2 py-0.5 rounded-full font-medium border cursor-pointer hover:opacity-80 ${fitCfg.bg} ${fitCfg.color} border-current`}>
              {fitCfg.label}
            </button>
          )}
          {knowledgeScore !== null && (
            <button onClick={() => onKnowledgeClick(completedInv!, candidate)} className={`text-xs px-2 py-0.5 rounded-full font-medium border cursor-pointer hover:opacity-80 ${knowledgeScore >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : knowledgeScore >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
              {knowledgeScore}%
            </button>
          )}
          {!completedInv && <span className="text-xs text-gray-400">—</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-xs text-gray-400">{new Date(candidate.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          {completedInv && (
            <button onClick={() => onDetail(candidate)} className="p-1.5 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition" title="View results">
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          )}
          {action && (
            <button onClick={action.action} className="px-2.5 py-1.5 bg-blue-950 text-white rounded-lg text-xs font-medium hover:bg-blue-900 transition whitespace-nowrap">
              {action.label}
            </button>
          )}
          {!['joined', 'rejected'].includes(effectiveStatus) && (
            <div className="relative">
              <button onClick={() => setShowMenu(v => !v)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 w-44" onMouseLeave={() => setShowMenu(false)}>
                  <button onClick={() => { onStatusChange(candidate.id, 'rejected'); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function CandidateCard({ candidate, invitations, growthScoreMap, onDetail, onSendAssessment, onInterview, onStatusChange, onMoveToInduction, onGrowthClick, onKnowledgeClick }: {
  candidate: Candidate;
  invitations: Invitation[];
  growthScoreMap: Record<string, { fit_level: string; overall_score: number }>;
  onDetail: (c: Candidate) => void;
  onSendAssessment: (c: Candidate) => void;
  onInterview: (c: Candidate) => void;
  onStatusChange: (id: string, s: CandidateStatus) => void;
  onMoveToInduction: (c: Candidate) => void;
  onGrowthClick: (inv: Invitation, c: Candidate) => void;
  onKnowledgeClick: (inv: Invitation, c: Candidate) => void;
}) {
  const effectiveStatus = getEffectiveStatus(candidate, invitations);
  const stage = getStage(effectiveStatus);
  const [showMenu, setShowMenu] = useState(false);

  const completedInv = invitations
    .filter(i => i.candidate_id === candidate.id && i.status === 'completed')
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];

  const knowledgeScore = completedInv?.include_domain_assessment && completedInv?.domain_score != null
    ? Math.round(Number(completedInv.domain_score))
    : null;
  const hasGrowthProfile = completedInv?.include_growth_profile ?? false;
  const growthScore = completedInv?.growth_assessment_id
    ? growthScoreMap[completedInv.growth_assessment_id] ?? null
    : null;
  const fitCfg = growthScore
    ? (FIT_LEVEL_CONFIG[growthScore.fit_level] || { label: growthScore.fit_level, color: 'text-gray-700', bg: 'bg-gray-100' })
    : null;

  const getPrimaryAction = () => {
    switch (effectiveStatus) {
      case 'applied': return { label: 'Send Assessment', icon: Send, action: () => onSendAssessment(candidate) };
      case 'assessment_pending': return { label: 'Resend / Update', icon: Send, action: () => onSendAssessment(candidate) };
      case 'assessment_completed': return { label: 'Schedule Interview', icon: Calendar, action: () => onInterview(candidate) };
      case 'interview_scheduled': return { label: 'Add Interview Score', icon: Star, action: () => onInterview(candidate) };
      case 'interviewed': return { label: 'Update / Shortlist', icon: UserCheck, action: () => onInterview(candidate) };
      case 'shortlisted': return { label: 'Extend Offer', icon: FileText, action: () => onStatusChange(candidate.id, 'offer_extended') };
      case 'offer_extended': return { label: 'Mark Accepted', icon: CheckCircle, action: () => onStatusChange(candidate.id, 'offer_accepted') };
      case 'offer_accepted': return { label: 'Register as Employee', icon: ArrowRight, action: () => onMoveToInduction(candidate) };
      default: return null;
    }
  };

  const action = getPrimaryAction();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-blue-950 text-white flex items-center justify-center flex-shrink-0 font-semibold text-sm">
            {candidate.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">{candidate.full_name}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>{stage.label}</span>
              {effectiveStatus === 'joined' && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Onboarding</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{candidate.email}</span>
              {candidate.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{candidate.phone}</span>}
              {(candidate.applied_position_title || candidate.designation?.title) && (
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{candidate.applied_position_title || candidate.designation?.title}</span>
              )}
              {candidate.interview_date && (
                <span className="flex items-center gap-1 text-amber-600 font-medium"><Star className="w-3 h-3 fill-current" />Rated</span>
              )}
            </div>
            {completedInv && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {hasGrowthProfile && (
                  <button
                    onClick={() => onGrowthClick(completedInv, candidate)}
                    className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition hover:opacity-80 cursor-pointer ${
                      fitCfg ? `${fitCfg.bg} ${fitCfg.color} border-current` : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    }`}
                    title="Click to view Growth Profile scores"
                  >
                    <CheckCircle className="w-3 h-3" />
                    {fitCfg ? `Growth: ${fitCfg.label}` : 'Growth Profile'}
                    {growthScore && <span className="opacity-70 ml-0.5">({growthScore.overall_score}%)</span>}
                  </button>
                )}
                {knowledgeScore !== null && (
                  <button
                    onClick={() => onKnowledgeClick(completedInv, candidate)}
                    className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition hover:opacity-80 cursor-pointer ${
                      knowledgeScore >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' :
                      knowledgeScore >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
                      'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    }`}
                    title="Click to view question-wise knowledge scores"
                  >
                    <BarChart2 className="w-3 h-3" /> Knowledge: {knowledgeScore}%
                  </button>
                )}
                {completedInv.include_domain_assessment && knowledgeScore === null && (
                  <button
                    onClick={() => onKnowledgeClick(completedInv, candidate)}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition cursor-pointer"
                    title="Click to view knowledge test responses"
                  >
                    <BarChart2 className="w-3 h-3" /> Knowledge test taken
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {completedInv && (
            <button
              onClick={() => onDetail(candidate)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 hover:border-gray-400 transition"
            >
              <BarChart2 className="w-3 h-3" />
              View Results
            </button>
          )}
          {action && (
            <button onClick={action.action} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white rounded-lg text-xs font-medium hover:bg-blue-900 transition">
              <action.icon className="w-3 h-3" />
              {action.label}
            </button>
          )}
          {!completedInv && (
            <button onClick={() => onDetail(candidate)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition" title="View details">
              <Eye className="w-4 h-4" />
            </button>
          )}
          {!['joined', 'rejected'].includes(effectiveStatus) && (
            <div className="relative">
              <button onClick={() => setShowMenu(v => !v)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <MoreVertical className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 w-44" onMouseLeave={() => setShowMenu(false)}>
                  {effectiveStatus === 'applied' && (
                    <button onClick={() => { onStatusChange(candidate.id, 'interview_scheduled'); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" /> Schedule Interview (Skip Assessment)
                    </button>
                  )}
                  <button onClick={() => { onStatusChange(candidate.id, 'rejected'); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <XCircle className="w-3.5 h-3.5" /> Reject Candidate
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CandidateDetailView({ candidate, invitations, interviewRating, growthScores, domainScore, detailedResponses, onSendAssessment, onInterview, onMoveToInduction }: {
  candidate: Candidate;
  invitations: Invitation[];
  interviewRating: InterviewRating | null;
  growthScores: GrowthScores | null;
  domainScore: { title: string; score: number; maxScore: number; percentage: number } | null;
  detailedResponses: DetailedResponses | null;
  onSendAssessment: () => void;
  onInterview: () => void;
  onMoveToInduction: () => void;
}) {
  const stage = getStage(candidate.status);
  const [showResponses, setShowResponses] = useState(true);

  const completedInvitations = invitations.filter(i => i.status === 'completed');
  const hasAssessmentData = growthScores || domainScore;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
        <div className="w-14 h-14 rounded-full bg-blue-950 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
          {candidate.full_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{candidate.full_name}</h3>
          <p className="text-sm text-gray-600">{candidate.email}{candidate.phone && ` · ${candidate.phone}`}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>{stage.label}</span>
            {(candidate.applied_position_title || candidate.designation?.title) && (
              <span className="text-xs text-gray-500 flex items-center gap-1"><Briefcase className="w-3 h-3" />{candidate.applied_position_title || candidate.designation?.title}</span>
            )}
            {candidate.source && <span className="text-xs text-gray-500">via {candidate.source.replace('_', ' ')}</span>}
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['applied', 'assessment_pending'].includes(candidate.status) && (
          <button onClick={onSendAssessment} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white rounded-lg text-xs font-medium hover:bg-blue-900 transition">
            <Send className="w-3 h-3" /> Send Assessment
          </button>
        )}
        {['assessment_completed', 'interview_scheduled', 'interviewed', 'shortlisted'].includes(candidate.status) && (
          <button onClick={onInterview} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white rounded-lg text-xs font-medium hover:bg-blue-900 transition">
            <Calendar className="w-3 h-3" /> {interviewRating ? 'Update Rating' : 'Add Interview Rating'}
          </button>
        )}
        {candidate.status === 'offer_accepted' && (
          <button onClick={onMoveToInduction} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition">
            <ArrowRight className="w-3 h-3" /> Register as Employee
          </button>
        )}
      </div>

      {hasAssessmentData && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Award className="w-4 h-4" />Assessment Results</h4>
          </div>
          <div className="p-4 space-y-4">
            {growthScores && (() => {
              const fitCfg = FIT_LEVEL_CONFIG[growthScores.fit_level] || { label: growthScores.fit_level, color: 'text-gray-700', bg: 'bg-gray-100' };
              const dimensions = [
                { key: 'adaptability_learning', score: growthScores.adaptability_learning_score },
                { key: 'initiative_ownership', score: growthScores.initiative_ownership_score },
                { key: 'collaboration_team', score: growthScores.collaboration_team_score },
                { key: 'resilience_stress', score: growthScores.resilience_stress_score },
                { key: 'growth_curiosity', score: growthScores.growth_curiosity_score },
              ];
              return (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Growth Profile Scorecard</p>
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Overall Score</p>
                      <p className="text-2xl font-bold text-gray-900">{growthScores.overall_score}<span className="text-sm font-normal text-gray-400">/100</span></p>
                      {growthScores.overall_percentile > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">Percentile: {growthScores.overall_percentile}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${fitCfg.bg} ${fitCfg.color}`}>
                      {fitCfg.label}
                    </span>
                  </div>

                  {growthScores.response_validity && growthScores.response_validity !== 'valid' && (
                    <div className={`p-3 rounded-xl border flex items-start gap-2 ${growthScores.response_validity === 'suspect' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                      <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${growthScores.response_validity === 'suspect' ? 'text-red-500' : 'text-amber-500'}`} />
                      <p className={`text-xs ${growthScores.response_validity === 'suspect' ? 'text-red-700' : 'text-amber-700'}`}>
                        Response Validity: <span className="font-semibold capitalize">{growthScores.response_validity}</span>
                        {growthScores.social_desirability_index != null && ` · SDI: ${growthScores.social_desirability_index}/100`}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {dimensions.map(d => {
                      const pct = d.score;
                      const barColor = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
                      return (
                        <div key={d.key} className="flex items-center gap-3">
                          <p className="text-xs text-gray-600 w-44 flex-shrink-0">{DIMENSION_LABELS[d.key]}</p>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs font-semibold w-10 text-right ${pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{d.score}</span>
                        </div>
                      );
                    })}
                  </div>

                  {(growthScores.strengths?.length || growthScores.development_areas?.length) ? (
                    <div className="grid grid-cols-2 gap-3">
                      {growthScores.strengths && growthScores.strengths.length > 0 && (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-2">
                            <TrendingUp className="w-3 h-3 text-emerald-600" />
                            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Strengths</p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {growthScores.strengths.map((s, i) => (
                              <span key={i} className="text-xs bg-white text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {growthScores.development_areas && growthScores.development_areas.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-2">
                            <TrendingDown className="w-3 h-3 text-amber-600" />
                            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Development Areas</p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {growthScores.development_areas.map((s, i) => (
                              <span key={i} className="text-xs bg-white text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {domainScore && (
              <div className="space-y-2">
                {growthScores && <div className="border-t border-gray-100 pt-4" />}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Knowledge Assessment</p>
                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{domainScore.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{domainScore.score}<span className="text-sm font-normal text-gray-400">/{domainScore.maxScore}</span></p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${domainScore.percentage >= 70 ? 'text-emerald-600' : domainScore.percentage >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {domainScore.percentage}%
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {domainScore.percentage >= 70 ? 'Strong' : domainScore.percentage >= 50 ? 'Moderate' : 'Needs Review'}
                    </p>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${domainScore.percentage >= 70 ? 'bg-emerald-500' : domainScore.percentage >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${domainScore.percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {interviewRating && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><UserCheck className="w-4 h-4" />Interview Rating</h4>
            <div className="flex items-center gap-3">
              {interviewRating.interview_date && <span className="text-xs text-gray-500">{new Date(interviewRating.interview_date).toLocaleDateString()}</span>}
              <div className="flex items-center gap-1.5 bg-blue-950 text-white px-3 py-1 rounded-full">
                <Star className="w-3 h-3 fill-current" />
                <span className="text-sm font-bold">{interviewRating.total_score}<span className="text-xs font-normal opacity-70">/80</span></span>
                <span className="text-xs opacity-60">({Math.round((interviewRating.total_score / 80) * 100)}%)</span>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {RATING_AREAS.map(area => {
              const Icon = area.icon;
              const areaTotal = area.statements.reduce((sum, s) => sum + (interviewRating[s.key as keyof InterviewRating] as number), 0);
              const areaPct = Math.round((areaTotal / 20) * 100);
              return (
                <div key={area.label} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                    <p className="text-xs font-semibold text-gray-700 flex-1">{area.label}</p>
                    <span className="text-xs font-bold text-blue-950">{areaTotal}/20</span>
                    <span className="text-xs text-gray-400">{areaPct}%</span>
                  </div>
                  <div className="space-y-1.5 pl-5">
                    {area.statements.map(stmt => {
                      const score = interviewRating[stmt.key as keyof InterviewRating] as number;
                      const scoreColor = score >= 8 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : score >= 5 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-500 bg-red-50 border-red-200';
                      return (
                        <div key={stmt.key} className="flex items-center gap-3">
                          <p className="text-xs text-gray-500 flex-1">{stmt.text}</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${scoreColor}`}>{score}/10</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {interviewRating.overall_notes && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{interviewRating.overall_notes}</p>
            </div>
          )}
        </div>
      )}

      {detailedResponses && (detailedResponses.growthResponses.length > 0 || detailedResponses.domainResponses.length > 0) && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
            onClick={() => setShowResponses(v => !v)}
          >
            <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gray-600" />
              Question-wise Responses
              <span className="text-xs font-normal text-gray-500">
                ({[
                  detailedResponses.growthResponses.length > 0 && `${detailedResponses.growthResponses.length} growth`,
                  detailedResponses.domainResponses.length > 0 && `${detailedResponses.domainResponses.length} knowledge`,
                ].filter(Boolean).join(', ')})
              </span>
            </span>
            {showResponses ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
          {showResponses && (
            <div className="p-4">
              <DetailedResponsesView data={detailedResponses} loading={false} />
            </div>
          )}
        </div>
      )}

      {completedInvitations.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4" />Assessment History</h4>
          {invitations.map(inv => {
            const isCompleted = inv.status === 'completed';
            return (
              <div key={inv.id} className={`flex items-center justify-between p-3 rounded-lg border ${isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                    {inv.include_growth_profile && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Growth Profile</span>}
                    {inv.include_domain_assessment && inv.domain_assessment && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{inv.domain_assessment.title}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Sent {new Date(inv.sent_at).toLocaleDateString()} · Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${isCompleted ? 'text-green-700' : 'text-amber-600'}`}>
                  {isCompleted ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {isCompleted ? 'Completed' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {candidate.notes && (
        <div className="border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4" />Notes</h4>
          <p className="text-sm text-gray-700">{candidate.notes}</p>
        </div>
      )}
    </div>
  );
}

function PendingAssessmentsView({ invitations, candidates, onDelete }: {
  invitations: Invitation[];
  candidates: Candidate[];
  onDelete: (inv: Invitation, c: Candidate) => void;
}) {
  if (invitations.length === 0) {
    return <EmptyState icon={<Clock className="w-10 h-10 text-gray-300" />} title="No pending assessments" description="All sent assessments have been completed or there are none yet" />;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{invitations.length} assessment{invitations.length !== 1 ? 's' : ''} awaiting completion</p>
      {invitations.map(inv => {
        const candidate = candidates.find(c => c.id === inv.candidate_id);
        const isExpired = new Date(inv.expires_at) < new Date();
        return (
          <div key={inv.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-900">{candidate?.full_name || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{candidate?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {inv.include_growth_profile && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Growth Profile</span>}
                  {inv.include_domain_assessment && inv.domain_assessment && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">{inv.domain_assessment.title}</span>}
                </div>
              </div>
              <div className="text-right space-y-1.5">
                {inv.access_code && (
                  <div className="font-mono text-base font-bold tracking-widest text-blue-950 bg-blue-50 border border-blue-200 rounded px-3 py-1">
                    {inv.access_code}
                  </div>
                )}
                <div className={`flex items-center gap-1.5 text-xs font-medium justify-end ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>
                  {isExpired ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {isExpired ? 'Expired' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                </div>
                <p className="text-xs text-gray-500">{isExpired ? 'Expired' : 'Expires'} {new Date(inv.expires_at).toLocaleDateString()}</p>
                <p className="text-xs text-gray-400">Sent {new Date(inv.sent_at).toLocaleDateString()}</p>
                {candidate && (
                  <button
                    onClick={() => onDelete(inv, candidate)}
                    className="flex items-center gap-1.5 px-2.5 py-1 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition ml-auto"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompletedAssessmentsView({ invitations, candidates, onInterview, onViewResults, onDetailResponses, onDelete }: {
  invitations: Invitation[];
  candidates: Candidate[];
  onInterview: (c: Candidate) => void;
  onViewResults: (inv: Invitation, c: Candidate) => void;
  onDetailResponses: (inv: Invitation, c: Candidate) => void;
  onDelete: (inv: Invitation, c: Candidate) => void;
}) {
  if (invitations.length === 0) {
    return <EmptyState icon={<CheckCircle className="w-10 h-10 text-gray-300" />} title="No completed assessments yet" description="Completed assessments will appear here" />;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{invitations.length} assessment{invitations.length !== 1 ? 's' : ''} completed</p>
      {invitations.map(inv => {
        const candidate = candidates.find(c => c.id === inv.candidate_id);
        const hasResults = inv.include_growth_profile || (inv.include_domain_assessment && inv.domain_attempt_id);
        return (
          <div key={inv.id} className="bg-white rounded-xl border border-green-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900">{candidate?.full_name || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{candidate?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {inv.include_growth_profile && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Growth Profile</span>
                  )}
                  {inv.include_domain_assessment && inv.domain_assessment && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">{inv.domain_assessment.title}</span>
                  )}
                  {inv.domain_score != null && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium">Knowledge Score: {inv.domain_score}%</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                  <CheckCircle className="w-3.5 h-3.5" /> Completed
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  {inv.include_growth_profile && candidate && (
                    <button
                      onClick={() => onViewResults(inv, candidate)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-300 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-50 transition"
                    >
                      <Award className="w-3 h-3" /> Growth Profile
                    </button>
                  )}
                  {hasResults && candidate && (
                    <button
                      onClick={() => onDetailResponses(inv, candidate)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition"
                    >
                      <BookOpen className="w-3 h-3" /> Detailed Responses
                    </button>
                  )}
                  {candidate && !['joined', 'rejected', 'interviewed', 'shortlisted'].includes(candidate.status) && (
                    <button onClick={() => onInterview(candidate)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white rounded-lg text-xs font-medium hover:bg-blue-900 transition">
                      <Calendar className="w-3 h-3" /> Schedule Interview
                    </button>
                  )}
                  {candidate && (
                    <button
                      onClick={() => onDelete(inv, candidate)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const DIMENSION_LABELS: Record<string, string> = {
  adaptability_learning: 'Adaptability & Learning',
  initiative_ownership: 'Initiative & Ownership',
  collaboration_team: 'Collaboration & Teamwork',
  resilience_stress: 'Resilience & Stress Management',
  growth_curiosity: 'Growth Orientation & Curiosity',
};

const FIT_LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  exceptional: { label: 'Exceptional Fit', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  strong: { label: 'Strong Fit', color: 'text-teal-700', bg: 'bg-teal-100' },
  good: { label: 'Good Fit', color: 'text-blue-700', bg: 'bg-blue-100' },
  developing: { label: 'Developing', color: 'text-amber-700', bg: 'bg-amber-100' },
  limited: { label: 'Limited Fit', color: 'text-red-700', bg: 'bg-red-100' },
  high_fit: { label: 'High Fit', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  moderate_fit: { label: 'Moderate Fit', color: 'text-amber-700', bg: 'bg-amber-100' },
  low_fit: { label: 'Low Fit', color: 'text-red-700', bg: 'bg-red-100' },
};

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{score}</span>
    </div>
  );
}


function getOverallNarrative(scores: GrowthScores): string {
  const { overall_score, fit_level, adaptability_learning_score, initiative_ownership_score, collaboration_team_score, resilience_stress_score, growth_curiosity_score } = scores;
  const dimScores = [adaptability_learning_score, initiative_ownership_score, collaboration_team_score, resilience_stress_score, growth_curiosity_score];
  const highest = Math.max(...dimScores);
  const lowest = Math.min(...dimScores);
  const highestDim = ['adaptability_learning', 'initiative_ownership', 'collaboration_team', 'resilience_stress', 'growth_curiosity'][dimScores.indexOf(highest)];
  const lowestDim = ['adaptability_learning', 'initiative_ownership', 'collaboration_team', 'resilience_stress', 'growth_curiosity'][dimScores.indexOf(lowest)];

  const fitDescriptions: Record<string, string> = {
    exceptional: 'This candidate presents an exceptional growth profile. Their responses reflect a well-rounded, high-growth mindset that is rarely seen at this level.',
    strong: 'This candidate demonstrates a strong growth profile. They show consistent strengths across multiple dimensions and are likely to thrive in a growth-oriented environment.',
    good: 'This candidate shows a good growth profile with solid performance across most dimensions. They are likely to be effective contributors who will continue to develop.',
    developing: 'This candidate is in a developing phase. They show potential but have clear areas where further coaching and structured growth opportunities would accelerate their effectiveness.',
    limited: 'This candidate\'s growth profile indicates limited readiness at this stage. Their current mindset and behavioral patterns may require significant investment to develop.',
    high_fit: 'This candidate presents a strong overall fit based on their growth profile responses.',
    moderate_fit: 'This candidate shows moderate readiness. There are areas of strength alongside areas that would benefit from development.',
    low_fit: 'This candidate\'s growth profile suggests limited readiness for high-growth expectations at this time.',
  };

  const base = fitDescriptions[fit_level] || `Overall score of ${overall_score}/100.`;
  const highNote = `Their strongest dimension is ${DIMENSION_LABELS[highestDim] || highestDim} (${highest}/100), suggesting this is a natural strength to build on.`;
  const lowNote = `The primary development area is ${DIMENSION_LABELS[lowestDim] || lowestDim} (${lowest}/100), which warrants attention during onboarding or early performance conversations.`;

  return `${base} ${highNote} ${lowNote}`;
}

function GrowthResultsView({ scores, loading, invitation }: { scores: GrowthScores | null; loading: boolean; invitation: Invitation | null }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!scores) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Award className="w-10 h-10 text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-700">Results Not Yet Computed</p>
        <p className="text-xs text-gray-500 mt-1">
          {invitation?.growth_completed_at
            ? 'The growth profile scoring is being processed. Please check back shortly.'
            : 'The candidate has not yet completed the growth profile assessment.'}
        </p>
      </div>
    );
  }

  const fitCfg = FIT_LEVEL_CONFIG[scores.fit_level] || { label: scores.fit_level, color: 'text-gray-700', bg: 'bg-gray-100' };
  const dimensions = [
    { key: 'adaptability_learning', score: scores.adaptability_learning_score },
    { key: 'initiative_ownership', score: scores.initiative_ownership_score },
    { key: 'collaboration_team', score: scores.collaboration_team_score },
    { key: 'resilience_stress', score: scores.resilience_stress_score },
    { key: 'growth_curiosity', score: scores.growth_curiosity_score },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Overall Score</p>
          <p className="text-3xl font-bold text-gray-900">{scores.overall_score}<span className="text-lg font-normal text-gray-400">/100</span></p>
          {scores.overall_percentile > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">Percentile rank: {scores.overall_percentile}</p>
          )}
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${fitCfg.bg} ${fitCfg.color}`}>
          {fitCfg.label}
        </span>
      </div>

      {scores.response_validity && scores.response_validity !== 'valid' && (
        <div className={`p-3 rounded-xl border flex items-start gap-3 ${
          scores.response_validity === 'suspect'
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${scores.response_validity === 'suspect' ? 'text-red-500' : 'text-amber-500'}`} />
          <div>
            <p className={`text-xs font-semibold ${scores.response_validity === 'suspect' ? 'text-red-700' : 'text-amber-700'}`}>
              {scores.response_validity === 'suspect' ? 'Response Validity: Suspect' : 'Response Validity: Caution'}
            </p>
            <p className={`text-xs mt-0.5 ${scores.response_validity === 'suspect' ? 'text-red-600' : 'text-amber-600'}`}>
              {scores.response_validity === 'suspect'
                ? 'The response pattern on self-awareness items suggests possible over-claiming. Scores should be interpreted cautiously and validated through interview.'
                : 'Some self-awareness items received unexpectedly high scores. Results are likely valid but worth probing in the interview.'}
            </p>
            {scores.social_desirability_index != null && (
              <p className={`text-xs mt-1 font-medium ${scores.response_validity === 'suspect' ? 'text-red-500' : 'text-amber-500'}`}>
                Social Desirability Index: {scores.social_desirability_index}/100
              </p>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">Recruiter Summary</p>
        <p className="text-sm text-blue-900 leading-relaxed">{getOverallNarrative(scores)}</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dimension Scores</p>
        <div className="space-y-4">
          {dimensions.map(d => (
            <div key={d.key} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-800">{DIMENSION_LABELS[d.key]}</span>
                <span className={`text-xs font-bold ${d.score >= 65 ? 'text-emerald-600' : d.score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{d.score}/100</span>
              </div>
              <ScoreBar score={d.score} />
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {d.score >= 80 ? 'Exceptional strength — consistently demonstrated across responses.'
                  : d.score >= 65 ? 'Strong performance — reliable competency with minor gaps.'
                  : d.score >= 50 ? 'Developing — shows foundational ability, benefits from coaching.'
                  : d.score >= 35 ? 'Needs attention — limited confidence shown in this area.'
                  : 'Significant gap — targeted development or careful role alignment required.'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {(scores.strengths?.length || scores.development_areas?.length) ? (
        <div className="grid grid-cols-2 gap-4">
          {scores.strengths && scores.strengths.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Strengths</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {scores.strengths.map((s, i) => (
                  <span key={i} className="text-xs bg-white text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5">{s}</span>
                ))}
              </div>
            </div>
          )}
          {scores.development_areas && scores.development_areas.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Development Areas</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {scores.development_areas.map((s, i) => (
                  <span key={i} className="text-xs bg-white text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <p className="text-xs text-gray-400 text-right border-t border-gray-100 pt-3">Calculated: {new Date(scores.calculated_at).toLocaleString()}</p>
    </div>
  );
}

function DetailedResponsesView({ data, loading }: { data: DetailedResponses | null; loading: boolean }) {
  const [growthExpanded, setGrowthExpanded] = useState(true);
  const [domainExpanded, setDomainExpanded] = useState(true);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const hasScore = data?.domainScore != null;
  const hasResponses = (data?.growthResponses.length ?? 0) > 0 || (data?.domainResponses.length ?? 0) > 0;

  if (!data || (!hasScore && !hasResponses)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen className="w-10 h-10 text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-700">No responses found</p>
        <p className="text-xs text-gray-500 mt-1">No detailed response data is available for this assessment.</p>
      </div>
    );
  }

  const growthDimensions = [...new Set(data.growthResponses.map(r => r.dimension))];
  const scoreColor = (data.domainPercentage ?? 0) >= 70 ? 'text-emerald-700' : (data.domainPercentage ?? 0) >= 50 ? 'text-amber-700' : 'text-red-600';
  const scoreBg = (data.domainPercentage ?? 0) >= 70 ? 'bg-emerald-50 border-emerald-200' : (data.domainPercentage ?? 0) >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  const getAnswerLabel = (q: GrowthResponseItem): string => {
    const val = q.answer_value;
    const opts = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5];
    const customOpts = opts.filter(Boolean) as string[];
    if (customOpts.length >= 3 && q.question_type !== 'attitudinal') {
      return customOpts[val - 1] || `Option ${val}`;
    }
    const scale = q.answer_scale === 'frequency_5'
      ? ['Never', 'Rarely', 'Sometimes', 'Often', 'Always']
      : ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
    return scale[val - 1] || `${val}`;
  };

  const getEffectiveScore = (q: GrowthResponseItem): number => q.is_reverse_scored ? 6 - q.answer_value : q.answer_value;

  return (
    <div className="space-y-4">
      {hasScore && data.domainResponses.length === 0 && (
        <div className={`rounded-xl border p-5 ${scoreBg}`}>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 text-center">
              <div className={`text-4xl font-bold ${scoreColor}`}>{data.domainPercentage}%</div>
              <div className="text-xs text-gray-500 mt-0.5">Overall Score</div>
            </div>
            <div className="h-12 w-px bg-gray-200" />
            <div>
              <div className={`text-lg font-semibold ${scoreColor}`}>{data.domainScore} / {data.domainMaxScore} points</div>
              <div className="text-sm text-gray-600 mt-0.5">{data.domainTitle || 'Knowledge Assessment'}</div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 p-3 bg-white/70 border border-gray-200 rounded-lg">
            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500">Question-level responses were not recorded for this attempt. Only the final score was saved.</p>
          </div>
        </div>
      )}

      {data.growthResponses.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition"
            onClick={() => setGrowthExpanded(v => !v)}
          >
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-700" />
              <span className="text-sm font-semibold text-blue-900">Growth Profile Responses ({data.growthResponses.length} questions)</span>
            </div>
            {growthExpanded ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
          </button>

          {growthExpanded && (
            <div className="divide-y divide-gray-100">
              {growthDimensions.map(dim => {
                const dimQuestions = data.growthResponses.filter(q => q.dimension === dim);
                return (
                  <div key={dim}>
                    <div className="px-4 py-2 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{DIMENSION_LABELS[dim] || dim}</p>
                    </div>
                    {dimQuestions.map((q, i) => {
                      const effective = getEffectiveScore(q);
                      const answerLabel = getAnswerLabel(q);
                      return (
                        <div key={i} className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center mt-0.5">{q.question_number}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-700 leading-relaxed mb-2">{q.question_text}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium px-2.5 py-1 rounded-lg border bg-white text-gray-800 border-gray-200">
                                  {answerLabel}
                                </span>
                                {q.is_reverse_scored && (
                                  <span className="text-xs text-gray-400 italic">(reverse scored)</span>
                                )}
                                <div className="flex items-center gap-1 ml-auto">
                                  {[1,2,3,4,5].map(n => (
                                    <div key={n} className={`w-4 h-4 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                      effective === n
                                        ? n >= 4 ? 'bg-emerald-500 text-white' : n === 3 ? 'bg-amber-400 text-white' : 'bg-red-400 text-white'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}>{n}</div>
                                  ))}
                                  <span className="text-xs text-gray-400 ml-1">effective</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {data.domainResponses.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition"
            onClick={() => setDomainExpanded(v => !v)}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-700" />
              <span className="text-sm font-semibold text-amber-900">
                {data.domainTitle || 'Knowledge Assessment'} ({data.domainResponses.length} questions)
              </span>
              {data.domainPercentage != null && (
                <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                  {data.domainPercentage}% · {data.domainScore}/{data.domainMaxScore} pts
                </span>
              )}
            </div>
            {domainExpanded ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
          </button>

          {domainExpanded && (
            <div className="divide-y divide-gray-100">
              {data.domainResponses.map((q, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center mt-0.5">{q.question_number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-relaxed mb-2">{q.question_text}</p>
                      <div className="flex items-start gap-2 flex-wrap">
                        <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${
                          q.is_correct === true ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : q.is_correct === false ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-gray-50 border-gray-200 text-gray-700'
                        }`}>
                          {q.is_correct === true ? <CheckCircle className="w-3 h-3" /> : q.is_correct === false ? <XCircle className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {q.answer_text || '(No answer)'}
                        </div>
                        {q.is_correct === false && q.correct_answer && (
                          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                            Correct: {q.correct_answer}
                          </span>
                        )}
                        {q.points_awarded != null && (
                          <span className="text-xs text-gray-500 ml-auto">{q.points_awarded}/{q.points} pts</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />{message}
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3">{icon}</div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
