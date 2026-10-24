import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Users, Search, ChevronRight, ChevronLeft, Mail, Phone, BookOpen, Network, Target,
  Download, CheckCircle, X, Copy, Check, ClipboardList,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { callEdgeFunction, generateTemporaryPassword } from '../../lib/edgeFunctions';
import { StartInductionModal } from './Inductions';

/*
 * People: one list of everyone in the organisation, and one page per person
 * that shows their whole lifecycle — profile and account, induction, training
 * record, OKRs. Replaces the old Employees table and the separate User
 * Management screen (role and active flag now live on the person's page).
 */

type Stage = 'joining' | 'induction' | 'active' | 'exiting' | 'exited';

interface Person {
  // user_profiles
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: string;
  is_active: boolean;
  avatar_url?: string | null;
  // employees (may be missing for admin-only accounts)
  employee_id?: string;
  employee_code?: string;
  department_id?: string | null;
  designation_id?: string | null;
  reporting_manager_id?: string | null;
  employment_status?: string;
  employment_type?: string | null;
  date_of_joining?: string | null;
  date_of_leaving?: string | null;
  lifecycle_stage?: Stage;
  department?: string;
  designation?: string;
}

interface Lookup { id: string; name: string; }

interface Induction { id: string; start_date: string; expected_end_date: string; actual_end_date: string | null; status: string; completion_percentage: number; probation_end_date?: string | null; induction_templates?: { title: string } | null; }
interface InductionTask { id: string; title: string; owner: string; due_date: string | null; is_required: boolean; status: string; }
interface TrainingRow { id: string; title: string; kind: 'course' | 'path'; status: string; assigned_date: string; due_date: string | null; completed_at: string | null; }
interface OkrRow { id: string; title: string; period: string; status: string; overall_progress: number; start_date: string; end_date: string; }

const STAGES: { id: Stage; label: string; dot: string }[] = [
  { id: 'joining', label: 'Joining', dot: 'bg-blue-400' },
  { id: 'induction', label: 'In induction', dot: 'bg-violet-500' },
  { id: 'active', label: 'Active', dot: 'bg-emerald-500' },
  { id: 'exiting', label: 'Leaving', dot: 'bg-amber-400' },
  { id: 'exited', label: 'Left', dot: 'bg-gray-300' },
];
const stageMeta = (s?: Stage) => STAGES.find(x => x.id === s) || STAGES[2];

const ROLES = [
  { id: 'employee', label: 'Employee' },
  { id: 'manager', label: 'Manager' },
  { id: 'hr', label: 'HR' },
  { id: 'l_d_manager', label: 'L&D manager' },
  { id: 'admin', label: 'Admin' },
];
const roleLabel = (r: string) => ROLES.find(x => x.id === r)?.label || r.replace(/_/g, ' ');

const EMPLOYMENT_TYPES = [
  { id: 'full_time', label: 'Full-time' }, { id: 'part_time', label: 'Part-time' },
  { id: 'contract', label: 'Contract' }, { id: 'intern', label: 'Intern' },
];

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const inputCls = 'w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent bg-white';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

function chip(cls: string, text: string) {
  return <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{text}</span>;
}

export default function Employees() {
  const { userProfile } = useAuth();
  const myRole = userProfile?.role;
  const canEdit = myRole === 'admin' || myRole === 'hr';
  const canEditAccount = myRole === 'admin';
  const isManager = myRole === 'manager';

  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [designations, setDesignations] = useState<Lookup[]>([]);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');
  const [teamOnly, setTeamOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; password: string } | null>(null);

  useEffect(() => { if (userProfile?.organization_id) loadData(); }, [userProfile?.organization_id]);

  const loadData = async () => {
    if (!userProfile?.organization_id) return;
    const org = userProfile.organization_id;
    try {
      if (isManager) {
        const { data: me } = await supabase.from('employees').select('id').eq('user_id', userProfile.id).maybeSingle();
        setMyEmployeeId(me?.id || null);
      }
      const [profilesRes, empRes, deptRes, desigRes] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name, email, phone, role, is_active, avatar_url').eq('organization_id', org).order('full_name'),
        supabase.from('employees').select('id, user_id, employee_code, department_id, designation_id, reporting_manager_id, status, employment_type, date_of_joining, date_of_leaving, lifecycle_stage, departments:department_id(name), designations:designation_id(title)').eq('organization_id', org),
        supabase.from('departments').select('id, name').eq('organization_id', org).order('name'),
        supabase.from('designations').select('id, title').eq('organization_id', org).order('title'),
      ]);
      const emps = (empRes.data || []) as any[];
      const merged: Person[] = (profilesRes.data || []).map((p: any) => {
        const e = emps.find(r => r.user_id === p.id);
        return {
          ...p,
          employee_id: e?.id,
          employee_code: e?.employee_code,
          department_id: e?.department_id,
          designation_id: e?.designation_id,
          reporting_manager_id: e?.reporting_manager_id,
          employment_status: e?.status,
          employment_type: e?.employment_type,
          date_of_joining: e?.date_of_joining,
          date_of_leaving: e?.date_of_leaving,
          lifecycle_stage: e?.lifecycle_stage || (e ? 'active' : undefined),
          department: e?.departments?.name,
          designation: e?.designations?.title,
        };
      });
      setPeople(merged);
      setDepartments((deptRes.data || []) as Lookup[]);
      setDesignations(((desigRes.data || []) as any[]).map(d => ({ id: d.id, name: d.title })));
    } catch (err) {
      console.error('Error loading people:', err);
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const p of people) { if (!p.employee_id) continue; c.all++; c[p.lifecycle_stage || 'active'] = (c[p.lifecycle_stage || 'active'] || 0) + 1; }
    return c;
  }, [people]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter(p => {
      if (stageFilter !== 'all' && p.lifecycle_stage !== stageFilter) return false;
      if (stageFilter === 'all' && (p.lifecycle_stage === 'exited') && !q) return false; // people who have left are one tap away, not in the default list
      if (teamOnly && myEmployeeId && p.reporting_manager_id !== myEmployeeId) return false;
      if (q && !(p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.employee_code || '').toLowerCase().includes(q) || (p.department || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [people, search, stageFilter, teamOnly, myEmployeeId]);

  const selected = people.find(p => p.id === selectedId) || null;
  const select = (id: string) => { setSelectedId(id); setMobileDetail(true); };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-stratefix-yellow border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 lg:px-6 h-11 flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900 hidden sm:inline">{counts.all} {counts.all === 1 ? 'person' : 'people'}</span>
        <div className="flex-1" />
        {canEdit && (
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 h-8 px-3 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-400 transition text-sm font-semibold">
            <Plus className="w-3.5 h-3.5" /> Add person
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* List */}
        <section aria-label="People" className={`w-full lg:w-[320px] lg:flex-shrink-0 flex-col bg-white lg:border-r border-gray-200 min-h-0 ${mobileDetail ? 'hidden lg:flex' : 'flex'}`}>
          <div className="px-3 pt-2.5 pb-2 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, code, department"
                className="w-full h-8 pl-8 pr-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setStageFilter('all')} className={`h-7 px-2.5 rounded-full text-xs font-medium transition ${stageFilter === 'all' ? 'bg-stratefix-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>All</button>
              {STAGES.filter(s => counts[s.id]).map(s => (
                <button key={s.id} onClick={() => setStageFilter(s.id)} className={`h-7 px-2.5 rounded-full text-xs font-medium transition inline-flex items-center gap-1.5 ${stageFilter === s.id ? 'bg-stratefix-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label} <span className="opacity-60">{counts[s.id]}</span>
                </button>
              ))}
              {isManager && myEmployeeId && (
                <button onClick={() => setTeamOnly(t => !t)} className={`h-7 px-2.5 rounded-full text-xs font-medium transition ${teamOnly ? 'bg-blue-800 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>My team</button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No one matches</div>}
            {filtered.map(p => {
              const isSel = p.id === selectedId;
              const st = stageMeta(p.lifecycle_stage);
              return (
                <button key={p.id} onClick={() => select(p.id)} aria-current={isSel ? 'true' : undefined} className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border-l-[3px] transition ${isSel ? 'bg-yellow-50 border-stratefix-yellow' : 'border-transparent hover:bg-gray-50'}`}>
                  <Avatar person={p} size={8} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${p.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{p.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{[p.designation, p.department].filter(Boolean).join(' · ') || roleLabel(p.role)}</p>
                  </div>
                  {p.employee_id ? <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} title={st.label} /> : <span className="text-[11px] text-gray-400">account</span>}
                  <ChevronRight className="w-4 h-4 text-gray-300 lg:hidden" />
                </button>
              );
            })}
          </div>
        </section>

        {/* Detail */}
        <section aria-label="Person" className={`flex-1 min-w-0 flex-col min-h-0 overflow-y-auto ${mobileDetail ? 'flex' : 'hidden lg:flex'}`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Select a person</h3>
                <p className="text-xs text-gray-500">Their profile, induction, training record and OKRs show here.</p>
              </div>
            </div>
          ) : (
            <PersonPage
              key={selected.id}
              person={selected}
              people={people}
              departments={departments}
              designations={designations}
              canEdit={canEdit}
              canEditAccount={canEditAccount}
              isSelf={selected.id === userProfile?.id}
              onBack={() => setMobileDetail(false)}
              onChanged={loadData}
            />
          )}
        </section>
      </div>

      {showAdd && (
        <AddPersonModal
          departments={departments}
          designations={designations}
          managers={people.filter(p => p.employee_id && p.lifecycle_stage !== 'exited')}
          organizationId={userProfile!.organization_id}
          onClose={() => setShowAdd(false)}
          onCreated={(c) => { setShowAdd(false); setCreatedCredentials(c); loadData(); }}
        />
      )}

      {createdCredentials && <CredentialsModal {...createdCredentials} onClose={() => setCreatedCredentials(null)} />}
    </div>
  );
}

/* ---------- person page ---------- */

function Avatar({ person, size }: { person: Person; size: 8 | 12 }) {
  const initials = person.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const dim = size === 12 ? 'w-12 h-12 text-sm' : 'w-8 h-8 text-xs';
  return person.avatar_url
    ? <img src={person.avatar_url} alt="" className={`${dim} rounded-full object-cover flex-shrink-0`} />
    : <span className={`${dim} rounded-full bg-stratefix-black text-stratefix-yellow font-bold flex items-center justify-center flex-shrink-0`}>{initials}</span>;
}

type Tab = 'profile' | 'induction' | 'training' | 'okrs';

interface PersonPageProps {
  person: Person; people: Person[]; departments: Lookup[]; designations: Lookup[];
  canEdit: boolean; canEditAccount: boolean; isSelf: boolean; onBack: () => void; onChanged: () => void;
}

function PersonPage({ person, people, departments, designations, canEdit, canEditAccount, isSelf, onBack, onChanged }: PersonPageProps) {
  const [tab, setTab] = useState<Tab>('profile');
  const [induction, setInduction] = useState<Induction[] | null>(null);
  const [training, setTraining] = useState<TrainingRow[] | null>(null);
  const [okrs, setOkrs] = useState<OkrRow[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const st = stageMeta(person.lifecycle_stage);
  const manager = people.find(p => p.employee_id && p.employee_id === person.reporting_manager_id);

  useEffect(() => {
    if (!person.employee_id) return;
    const empId = person.employee_id;
    (async () => {
      const [ind, asg, prog, okr] = await Promise.all([
        supabase.from('induction_journeys').select('id, start_date, expected_end_date, actual_end_date, status, completion_percentage, probation_end_date, induction_templates(title)').eq('employee_id', empId).order('start_date', { ascending: false }),
        supabase.from('employee_learning_assignments').select('id, status, assigned_date, due_date, course_id, learning_path_id, learning_courses(title), learning_paths(title)').eq('employee_id', empId).order('assigned_date', { ascending: false }),
        supabase.from('learning_progress').select('course_id, assignment_id, completed_at').eq('employee_id', empId).is('module_id', null).eq('status', 'completed'),
        supabase.from('okrs').select('id, title, period, status, overall_progress, start_date, end_date').eq('employee_id', empId).order('start_date', { ascending: false }),
      ]);
      setInduction((ind.data || []) as unknown as Induction[]);
      const done = (prog.data || []) as { course_id: string; assignment_id: string; completed_at: string | null }[];
      setTraining(((asg.data || []) as any[]).map(a => ({
        id: a.id,
        title: a.learning_courses?.title || a.learning_paths?.title || 'Untitled',
        kind: a.learning_path_id ? 'path' : 'course',
        status: a.status,
        assigned_date: a.assigned_date,
        due_date: a.due_date,
        completed_at: done.find(d => d.assignment_id === a.id || (a.course_id && d.course_id === a.course_id))?.completed_at || null,
      })));
      setOkrs((okr.data || []) as OkrRow[]);
    })();
  }, [person.employee_id, reloadKey]);

  const trainingDone = training?.filter(t => t.status === 'completed').length ?? 0;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'induction', label: 'Induction', count: induction?.length },
    { id: 'training', label: 'Training record', count: training?.length },
    { id: 'okrs', label: 'OKRs', count: okrs?.length },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1 text-sm text-gray-600 -mt-1"><ChevronLeft className="w-4 h-4" /> All people</button>

      <div className="flex items-start gap-3">
        <Avatar person={person} size={12} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">{person.full_name}</h2>
            {person.employee_id && chip('bg-gray-100 text-gray-700', st.label)}
            {!person.is_active && chip('bg-red-50 text-red-700', 'Account disabled')}
            {person.role !== 'employee' && chip('bg-blue-50 text-blue-800', roleLabel(person.role))}
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {[person.designation, person.department, person.employee_code, person.date_of_joining ? `Joined ${fmtDate(person.date_of_joining)}` : null].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
            <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1 hover:text-gray-900"><Mail className="w-3 h-3" />{person.email}</a>
            {person.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{person.phone}</span>}
          </p>
        </div>
      </div>

      {person.employee_id && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-2 sm:flex -mt-px -ml-px">
            {[
              { label: 'Manager', value: manager?.full_name || '—' },
              { label: 'Training', value: training ? `${trainingDone} of ${training.length} done` : '…' },
              { label: 'Induction', value: induction ? (induction[0] ? ({ not_started: 'Not started', in_progress: 'In progress', completed: 'Completed', extended: 'Extended' } as Record<string, string>)[induction[0].status] || induction[0].status : 'None') : '…' },
              { label: 'OKRs', value: okrs ? `${okrs.length}` : '…' },
            ].map(s => (
              <div key={s.label} className="px-4 py-2.5 min-w-0 sm:flex-1 sm:basis-0 border-t border-l border-gray-100">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-stretch gap-5 border-b border-gray-200 h-9 overflow-x-auto">
        {tabs.filter(t => t.id === 'profile' || person.employee_id).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 text-sm border-b-2 whitespace-nowrap transition ${tab === t.id ? 'border-stratefix-yellow text-gray-900 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}{t.count !== undefined && <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-px">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab person={person} people={people} departments={departments} designations={designations} canEdit={canEdit} canEditAccount={canEditAccount} isSelf={isSelf} onChanged={onChanged} />}
      {tab === 'induction' && <InductionTab rows={induction} person={person} canEdit={canEdit} onChanged={() => { onChanged(); setInduction(null); setTraining(null); setOkrs(null); setReloadKey(k => k + 1); }} />}
      {tab === 'training' && <TrainingTab rows={training} person={person} />}
      {tab === 'okrs' && <OkrTab rows={okrs} />}
    </div>
  );
}

/* ---------- profile tab ---------- */

function ProfileTab({ person, people, departments, designations, canEdit, canEditAccount, isSelf, onChanged }: Omit<PersonPageProps, 'onBack'>) {
  const [form, setForm] = useState({
    full_name: person.full_name,
    phone: person.phone || '',
    department_id: person.department_id || '',
    designation_id: person.designation_id || '',
    reporting_manager_id: person.reporting_manager_id || '',
    employment_type: person.employment_type || '',
    date_of_joining: person.date_of_joining || '',
    role: person.role,
    is_active: person.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState<null | { status: 'resigned' | 'terminated' | 'notice_period'; date: string }>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify({
    full_name: person.full_name, phone: person.phone || '', department_id: person.department_id || '', designation_id: person.designation_id || '',
    reporting_manager_id: person.reporting_manager_id || '', employment_type: person.employment_type || '', date_of_joining: person.date_of_joining || '',
    role: person.role, is_active: person.is_active,
  });

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const profileUpdate: Record<string, unknown> = { full_name: form.full_name.trim(), phone: form.phone.trim() || null };
      if (canEditAccount && !isSelf) { profileUpdate.role = form.role; profileUpdate.is_active = form.is_active; }
      const { error: pe } = await supabase.from('user_profiles').update(profileUpdate).eq('id', person.id);
      if (pe) throw pe;
      if (person.employee_id) {
        const { error: ee } = await supabase.from('employees').update({
          department_id: form.department_id || null,
          designation_id: form.designation_id || null,
          reporting_manager_id: form.reporting_manager_id || null,
          employment_type: form.employment_type || null,
          ...(form.date_of_joining ? { date_of_joining: form.date_of_joining } : {}),
        }).eq('id', person.employee_id);
        if (ee) throw ee;
      }
      setSaved(true); onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally { setSaving(false); }
  };

  const markLeft = async () => {
    if (!leaving || !person.employee_id) return;
    setSaving(true); setError('');
    try {
      const { error: ee } = await supabase.from('employees').update({ status: leaving.status, date_of_leaving: leaving.status === 'notice_period' ? null : leaving.date }).eq('id', person.employee_id);
      if (ee) throw ee;
      if (leaving.status !== 'notice_period') {
        const { error: pe } = await supabase.from('user_profiles').update({ is_active: false }).eq('id', person.id);
        if (pe) throw pe;
      }
      setLeaving(null); onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update.');
    } finally { setSaving(false); }
  };

  const reactivate = async () => {
    if (!person.employee_id) return;
    setSaving(true); setError('');
    try {
      const { error: ee } = await supabase.from('employees').update({ status: 'active', date_of_leaving: null }).eq('id', person.employee_id);
      if (ee) throw ee;
      const { error: pe } = await supabase.from('user_profiles').update({ is_active: true }).eq('id', person.id);
      if (pe) throw pe;
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update.');
    } finally { setSaving(false); }
  };

  const ro = !canEdit;
  const managers = people.filter(p => p.employee_id && p.employee_id !== person.employee_id && p.lifecycle_stage !== 'exited');

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-white border border-gray-200 rounded-lg p-4 grid sm:grid-cols-2 gap-3">
        <div><label className={labelCls}>Full name</label><input className={inputCls} value={form.full_name} disabled={ro} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
        <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone} disabled={ro} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
        {person.employee_id && (
          <>
            <div><label className={labelCls}>Department</label>
              <select className={inputCls} value={form.department_id} disabled={ro} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                <option value="">—</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
            <div><label className={labelCls}>Designation</label>
              <select className={inputCls} value={form.designation_id} disabled={ro} onChange={e => setForm(f => ({ ...f, designation_id: e.target.value }))}>
                <option value="">—</option>{designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
            <div><label className={labelCls}>Reports to</label>
              <select className={inputCls} value={form.reporting_manager_id} disabled={ro} onChange={e => setForm(f => ({ ...f, reporting_manager_id: e.target.value }))}>
                <option value="">—</option>{managers.map(m => <option key={m.employee_id} value={m.employee_id}>{m.full_name}</option>)}
              </select></div>
            <div><label className={labelCls}>Employment type</label>
              <select className={inputCls} value={form.employment_type} disabled={ro} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}>
                <option value="">—</option>{EMPLOYMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select></div>
            <div><label className={labelCls}>Date of joining</label><input type="date" className={inputCls} value={form.date_of_joining} disabled={ro} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} /></div>
            <div><label className={labelCls}>Employee code</label><input className={`${inputCls} bg-gray-50`} value={person.employee_code || ''} disabled /></div>
          </>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Account</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>Email (sign-in)</label><input className={`${inputCls} bg-gray-50`} value={person.email} disabled /></div>
          <div><label className={labelCls}>Role on the platform</label>
            <select className={inputCls} value={form.role} disabled={!canEditAccount || isSelf} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            {isSelf && <p className="text-xs text-gray-500 mt-1">You cannot change your own role.</p>}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-800 sm:col-span-2">
            <input type="checkbox" className="w-4 h-4 rounded border-gray-300" checked={form.is_active} disabled={!canEditAccount || isSelf} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Can sign in
          </label>
        </div>
      </div>

      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {canEdit && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={save} disabled={!dirty || saving} className="h-9 px-4 bg-stratefix-yellow text-stratefix-black rounded-lg text-sm font-semibold hover:bg-yellow-400 disabled:opacity-50 transition">{saving ? 'Saving…' : 'Save changes'}</button>
          {saved && !dirty && <span className="text-xs text-emerald-700 inline-flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Saved</span>}
          <div className="flex-1" />
          {person.employee_id && person.lifecycle_stage !== 'exited' && !leaving && (
            <button onClick={() => setLeaving({ status: 'resigned', date: new Date().toISOString().slice(0, 10) })} className="h-9 px-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Mark as leaving / left</button>
          )}
          {person.employee_id && person.lifecycle_stage === 'exited' && (
            <button onClick={reactivate} disabled={saving} className="h-9 px-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Reactivate</button>
          )}
        </div>
      )}

      {leaving && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-900">Leaving the organisation</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>What is happening</label>
              <select className={inputCls} value={leaving.status} onChange={e => setLeaving(l => l && ({ ...l, status: e.target.value as any }))}>
                <option value="notice_period">Serving notice (still has access)</option>
                <option value="resigned">Resigned — has left</option>
                <option value="terminated">Terminated — has left</option>
              </select></div>
            {leaving.status !== 'notice_period' && <div><label className={labelCls}>Last working day</label><input type="date" className={inputCls} value={leaving.date} onChange={e => setLeaving(l => l && ({ ...l, date: e.target.value }))} /></div>}
          </div>
          <p className="text-xs text-amber-800">{leaving.status === 'notice_period' ? 'They keep their access until you mark them as left.' : 'Their sign-in is disabled. Their training record and OKRs are kept.'}</p>
          <div className="flex gap-2">
            <button onClick={markLeft} disabled={saving} className="h-9 px-4 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition">Confirm</button>
            <button onClick={() => setLeaving(null)} className="h-9 px-3 text-gray-700 text-sm font-medium hover:bg-amber-100 rounded-lg transition">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- other tabs ---------- */

function EmptyTab({ icon: Icon, text }: { icon: typeof BookOpen; text: string }) {
  return <div className="bg-white border border-gray-200 rounded-lg px-4 py-10 text-center"><Icon className="w-6 h-6 text-gray-300 mx-auto mb-1.5" /><p className="text-xs text-gray-500">{text}</p></div>;
}

function InductionTab({ rows, person, canEdit, onChanged }: { rows: Induction[] | null; person: Person; canEdit: boolean; onChanged: () => void }) {
  const [tasks, setTasks] = useState<InductionTask[] | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showStart, setShowStart] = useState(false);
  const { userProfile } = useAuth();
  const open = rows?.find(j => j.status !== 'completed') || null;

  useEffect(() => {
    if (!open) { setTasks(null); return; }
    supabase.from('induction_tasks').select('id, title, owner, due_date, is_required, status').eq('journey_id', open.id).order('order_index').then(({ data }) => setTasks((data || []) as InductionTask[]));
  }, [open?.id]);
  useEffect(() => {
    if (!canEdit || !userProfile?.organization_id) return;
    supabase.from('induction_templates').select('*, designations(title)').eq('organization_id', userProfile.organization_id).eq('is_active', true).then(({ data }) => setTemplates(data || []));
  }, [canEdit, userProfile?.organization_id]);

  if (!rows) return <p className="text-xs text-gray-500">Loading…</p>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-3">
      {!open && canEdit && person.employee_id && person.lifecycle_stage !== 'exited' && (
        <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-600">{rows.length ? 'No induction in progress.' : 'No induction has been started for this person.'}</p>
          <button onClick={() => setShowStart(true)} className="h-8 px-3 bg-stratefix-yellow text-stratefix-black rounded-lg text-sm font-semibold hover:bg-yellow-400 transition whitespace-nowrap">Start induction</button>
        </div>
      )}
      {rows.length === 0 && !canEdit && <EmptyTab icon={ClipboardList} text="No induction has been started for this person." />}
      {rows.map(j => (
        <div key={j.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-4 border-b border-gray-100">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{j.induction_templates?.title || 'Induction'} · <span className="capitalize">{j.status.replace('_', ' ')}</span></p>
              <p className="text-xs text-gray-500">{fmtDate(j.start_date)} → {fmtDate(j.actual_end_date || j.expected_end_date)}{j.actual_end_date ? '' : ' (expected)'}{j.probation_end_date ? ` · Probation ends ${fmtDate(j.probation_end_date)}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-28 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${j.status === 'completed' ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${j.completion_percentage}%` }} /></div>
              <span className="text-xs text-gray-600 w-9 text-right">{j.completion_percentage}%</span>
            </div>
          </div>
          {j.id === open?.id && tasks && (
            <ul className="divide-y divide-gray-100">
              {tasks.length === 0 && <li className="px-4 py-3 text-xs text-gray-500">No checklist tasks.</li>}
              {tasks.map(t => {
                const late = t.status === 'pending' && t.due_date && t.due_date < today;
                return (
                  <li key={t.id} className="px-4 py-2 flex items-center gap-3">
                    {t.status === 'pending' ? <span className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                    <span className={`text-sm flex-1 min-w-0 truncate ${t.status === 'pending' ? 'text-gray-900' : 'text-gray-500 line-through'}`}>{t.title}</span>
                    <span className={`text-xs ${late ? 'text-red-700 font-medium' : 'text-gray-500'}`}>{t.owner === 'employee' ? 'Joiner' : t.owner === 'hr' ? 'HR' : 'Manager'}{t.due_date ? ` · ${fmtDate(t.due_date)}` : ''}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
      {rows.length > 0 && <p className="text-xs text-gray-500">Tick tasks and add notes under Onboard → Inductions.</p>}
      {showStart && person.employee_id && (
        <StartInductionModal
          people={[{ employee_id: person.employee_id, full_name: person.full_name, designation_id: person.designation_id || null }]}
          defaultEmployeeId={person.employee_id}
          templates={templates}
          onClose={() => setShowStart(false)}
          onStarted={() => { setShowStart(false); onChanged(); }}
        />
      )}
    </div>
  );
}

function TrainingTab({ rows, person }: { rows: TrainingRow[] | null; person: Person }) {
  if (!rows) return <p className="text-xs text-gray-500">Loading…</p>;
  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Name', 'Employee code', 'Item', 'Type', 'Status', 'Assigned', 'Due', 'Completed'].join(','),
      ...rows.map(r => [person.full_name, person.employee_code, r.title, r.kind === 'path' ? 'Learning path' : 'Course', r.status, r.assigned_date, r.due_date || '', r.completed_at ? r.completed_at.slice(0, 10) : ''].map(esc).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `training-record-${(person.employee_code || person.full_name).replace(/\s+/g, '-')}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  if (rows.length === 0) return <EmptyTab icon={BookOpen} text="Nothing has been assigned to this person yet." />;
  const statusChip = (s: string) => s === 'completed' ? chip('bg-emerald-50 text-emerald-700', 'Completed') : s === 'in_progress' ? chip('bg-blue-50 text-blue-800', 'In progress') : s === 'overdue' ? chip('bg-red-50 text-red-700', 'Overdue') : chip('bg-gray-100 text-gray-600', 'Assigned');
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center px-3.5 h-10 border-b border-gray-100">
        <span className="text-xs text-gray-500">{rows.filter(r => r.status === 'completed').length} completed of {rows.length}</span>
        <div className="flex-1" />
        <button onClick={exportCsv} className="inline-flex items-center gap-1 text-xs font-medium text-blue-800 hover:underline"><Download className="w-3.5 h-3.5" /> Export CSV</button>
      </div>
      <table className="w-full text-sm hidden sm:table">
        <thead><tr className="text-xs text-gray-500 text-left"><th className="font-medium px-3.5 py-2">Item</th><th className="font-medium px-3.5 py-2 w-28">Status</th><th className="font-medium px-3.5 py-2 w-28">Assigned</th><th className="font-medium px-3.5 py-2 w-28">Due</th><th className="font-medium px-3.5 py-2 w-28">Completed</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t border-gray-100">
              <td className="px-3.5 py-2"><span className="inline-flex items-center gap-2">{r.kind === 'path' ? <Network className="w-3.5 h-3.5 text-gray-400" /> : <BookOpen className="w-3.5 h-3.5 text-gray-400" />}<span className="text-gray-900">{r.title}</span></span></td>
              <td className="px-3.5 py-2">{statusChip(r.status)}</td>
              <td className="px-3.5 py-2 text-gray-600">{fmtDate(r.assigned_date)}</td>
              <td className="px-3.5 py-2 text-gray-600">{fmtDate(r.due_date)}</td>
              <td className="px-3.5 py-2 text-gray-600">{fmtDate(r.completed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="sm:hidden divide-y divide-gray-100">
        {rows.map(r => (
          <li key={r.id} className="px-3.5 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0"><p className="text-sm text-gray-900 truncate">{r.title}</p><p className="text-xs text-gray-500">{r.completed_at ? `Completed ${fmtDate(r.completed_at)}` : r.due_date ? `Due ${fmtDate(r.due_date)}` : `Assigned ${fmtDate(r.assigned_date)}`}</p></div>
            {statusChip(r.status)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OkrTab({ rows }: { rows: OkrRow[] | null }) {
  if (!rows) return <p className="text-xs text-gray-500">Loading…</p>;
  if (rows.length === 0) return <EmptyTab icon={Target} text="No OKRs set for this person." />;
  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
      {rows.map(o => (
        <div key={o.id} className="px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{o.title}</p>
            <p className="text-xs text-gray-500 capitalize">{o.period} · {fmtDate(o.start_date)} → {fmtDate(o.end_date)} · {o.status.replace(/_/g, ' ')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-28 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${o.overall_progress}%` }} /></div>
            <span className="text-xs text-gray-600 w-9 text-right">{o.overall_progress}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- add person ---------- */

function AddPersonModal({ departments, designations, managers, organizationId, onClose, onCreated }: {
  departments: Lookup[]; designations: Lookup[]; managers: Person[]; organizationId: string;
  onClose: () => void; onCreated: (c: { name: string; email: string; password: string }) => void;
}) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'employee', department_id: '', designation_id: '', reporting_manager_id: '', employment_type: 'full_time', date_of_joining: new Date().toISOString().slice(0, 10), employee_code: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    const password = generateTemporaryPassword();
    try {
      const result = await callEdgeFunction<{ success: boolean; error?: string }>('create-org-employee', {
        organization_id: organizationId,
        full_name: form.full_name.trim(), email: form.email.trim(), password, phone: form.phone.trim() || null, role: form.role,
        department_id: form.department_id || null, designation_id: form.designation_id || null, reporting_manager_id: form.reporting_manager_id || null,
        employment_type: form.employment_type, date_of_joining: form.date_of_joining, employee_code: form.employee_code.trim() || undefined, employment_status: 'active',
      });
      if (!result.success) { setError(result.error || 'Could not create the account.'); setSaving(false); return; }
      onCreated({ name: form.full_name.trim(), email: form.email.trim(), password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.'); setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-sm font-semibold text-gray-900">Add a person</h3>
          <button type="button" onClick={onClose} className="w-9 h-9 -mr-2 flex items-center justify-center text-gray-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className={labelCls}>Full name</label><input required className={inputCls} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
          <div><label className={labelCls}>Work email (sign-in)</label><input required type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div><label className={labelCls}>Department</label><select className={inputCls} value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}><option value="">—</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className={labelCls}>Designation</label><select className={inputCls} value={form.designation_id} onChange={e => setForm(f => ({ ...f, designation_id: e.target.value }))}><option value="">—</option>{designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className={labelCls}>Reports to</label><select className={inputCls} value={form.reporting_manager_id} onChange={e => setForm(f => ({ ...f, reporting_manager_id: e.target.value }))}><option value="">—</option>{managers.map(m => <option key={m.employee_id} value={m.employee_id}>{m.full_name}</option>)}</select></div>
          <div><label className={labelCls}>Employment type</label><select className={inputCls} value={form.employment_type} onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}>{EMPLOYMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          <div><label className={labelCls}>Date of joining</label><input type="date" required className={inputCls} value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} /></div>
          <div><label className={labelCls}>Employee code <span className="text-gray-400">(optional)</span></label><input className={inputCls} placeholder="Generated if blank" value={form.employee_code} onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Role on the platform</label><select className={inputCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>{ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
            <p className="text-xs text-gray-500 mt-1">A future joining date puts them in the Joining stage until that day.</p></div>
          {error && <p className="sm:col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="px-4 pb-4 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="h-9 px-3 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
          <button type="submit" disabled={saving} className="h-9 px-4 bg-stratefix-yellow text-stratefix-black rounded-lg text-sm font-semibold hover:bg-yellow-400 disabled:opacity-50 transition">{saving ? 'Creating…' : 'Create account'}</button>
        </div>
      </form>
    </div>
  );
}

function CredentialsModal({ name, email, password, onClose }: { name: string; email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Sign-in for ${name}\nEmail: ${email}\nTemporary password: ${password}\nYou will be asked to set a new password on first sign-in.`;
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Account created for {name}</h3>
        <p className="text-xs text-gray-600">Share these once. The password is not stored and will not be shown again; they must change it when they first sign in.</p>
        <pre className="text-sm bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap break-all">{text}</pre>
        <div className="flex gap-2 justify-end">
          <button onClick={copy} className="inline-flex items-center gap-1.5 h-9 px-3 border border-gray-300 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-50 transition">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
          <button onClick={onClose} className="h-9 px-4 bg-stratefix-yellow text-stratefix-black rounded-lg text-sm font-semibold hover:bg-yellow-400 transition">Done</button>
        </div>
      </div>
    </div>
  );
}
