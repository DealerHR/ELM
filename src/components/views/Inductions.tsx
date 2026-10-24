import { useState, useEffect, useMemo } from 'react';
import {
  Plus, ChevronRight, ChevronLeft, ClipboardList, CheckCircle, Circle, MinusCircle, Trash2, ArrowUp, ArrowDown,
  Network, Calendar, User, Pencil, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

/*
 * Onboard → Inductions. Two tabs:
 *  - Joiners: everyone with an induction (in progress first), their checklist and learning path.
 *  - Templates: per designation (or general), a checklist of tasks plus an optional learning path.
 * Starting an induction happens here, from People, or automatically from Candidates.
 */

type Owner = 'employee' | 'manager' | 'hr';

interface Template {
  id: string; title: string; designation_id: string | null; duration_days: number; learning_path_id: string | null;
  description: string | null; is_active: boolean;
  designations?: { title: string } | null; learning_paths?: { title: string } | null;
}
interface TemplateTask { id: string; template_id: string; title: string; description: string | null; owner: Owner; due_day: number; is_required: boolean; order_index: number; }

interface Journey {
  id: string; employee_id: string; template_id: string | null; start_date: string; expected_end_date: string; actual_end_date: string | null;
  status: string; completion_percentage: number; probation_end_date: string | null; notes: string | null;
  employees?: { id: string; user_id: string; employee_code: string; designations?: { title: string } | null; departments?: { name: string } | null } | null;
  induction_templates?: { title: string; learning_path_id: string | null; learning_paths?: { title: string } | null } | null;
  full_name?: string;
}
interface Task { id: string; journey_id: string; title: string; description: string | null; owner: Owner; due_date: string | null; is_required: boolean; order_index: number; status: 'pending' | 'done' | 'skipped'; completed_at: string | null; notes: string | null; }

interface Lookup { id: string; name: string; }

const OWNER_LABEL: Record<Owner, string> = { employee: 'Joiner', manager: 'Manager', hr: 'HR' };
const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
const inputCls = 'w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent bg-white';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';
const chip = (cls: string, text: string) => <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{text}</span>;

const STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  not_started: { cls: 'bg-blue-50 text-blue-800', label: 'Starts soon' },
  in_progress: { cls: 'bg-violet-50 text-violet-800', label: 'In progress' },
  extended: { cls: 'bg-amber-50 text-amber-800', label: 'Extended' },
  completed: { cls: 'bg-emerald-50 text-emerald-700', label: 'Completed' },
};

export default function Inductions() {
  const { userProfile } = useAuth();
  const org = userProfile?.organization_id;
  const [tab, setTab] = useState<'joiners' | 'templates'>('joiners');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [designations, setDesignations] = useState<Lookup[]>([]);
  const [paths, setPaths] = useState<Lookup[]>([]);
  const [people, setPeople] = useState<{ employee_id: string; full_name: string; designation_id: string | null; lifecycle_stage: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJourney, setSelectedJourney] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => { if (org) load(); }, [org]);

  const load = async () => {
    if (!org) return;
    const [tplRes, jRes, desRes, pathRes, empRes] = await Promise.all([
      supabase.from('induction_templates').select('*, designations(title), learning_paths(title)').eq('organization_id', org).order('title'),
      supabase.from('induction_journeys').select('*, employees!inner(id, user_id, employee_code, organization_id, designations:designation_id(title), departments:department_id(name)), induction_templates(title, learning_path_id, learning_paths(title))').eq('employees.organization_id', org).order('start_date', { ascending: false }),
      supabase.from('designations').select('id, title').eq('organization_id', org).order('title'),
      supabase.from('learning_paths').select('id, title').eq('organization_id', org).order('title'),
      supabase.from('employees').select('id, user_id, designation_id, lifecycle_stage').eq('organization_id', org),
    ]);
    const emps = (empRes.data || []) as any[];
    const userIds = [...new Set([...emps.map(e => e.user_id), ...((jRes.data || []) as any[]).map(j => j.employees?.user_id)].filter(Boolean))];
    const { data: profiles } = userIds.length ? await supabase.from('user_profiles').select('id, full_name').in('id', userIds) : { data: [] as any[] };
    const nameOf = (uid?: string) => (profiles || []).find((p: any) => p.id === uid)?.full_name || 'Unknown';

    setTemplates((tplRes.data || []) as Template[]);
    setJourneys(((jRes.data || []) as any[]).map(j => ({ ...j, full_name: nameOf(j.employees?.user_id) })));
    setDesignations(((desRes.data || []) as any[]).map(d => ({ id: d.id, name: d.title })));
    setPaths(((pathRes.data || []) as any[]).map(p => ({ id: p.id, name: p.title })));
    setPeople(emps.map(e => ({ employee_id: e.id, full_name: nameOf(e.user_id), designation_id: e.designation_id, lifecycle_stage: e.lifecycle_stage })).sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setLoading(false);
  };

  const openJourneys = useMemo(() => journeys.filter(j => j.status !== 'completed'), [journeys]);
  const doneJourneys = useMemo(() => journeys.filter(j => j.status === 'completed'), [journeys]);
  const journey = journeys.find(j => j.id === selectedJourney) || null;
  const template = templates.find(t => t.id === selectedTemplate) || null;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-stratefix-yellow border-t-transparent rounded-full animate-spin" /></div>;

  const listItems = tab === 'joiners' ? (showDone ? journeys : openJourneys) : templates;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 lg:px-6 h-11 flex items-center gap-3">
        <div className="flex items-stretch gap-5 h-full">
          {([{ id: 'joiners', label: 'Joiners', count: openJourneys.length }, { id: 'templates', label: 'Templates', count: templates.length }] as const).map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setMobileDetail(false); }} className={`flex items-center gap-1.5 text-sm border-b-2 transition ${tab === t.id ? 'border-stratefix-yellow text-gray-900 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {t.label}<span className="text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-px">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {tab === 'joiners' ? (
          <button onClick={() => setShowStart(true)} className="inline-flex items-center gap-1.5 h-8 px-3 bg-stratefix-yellow text-brand-on-primary rounded-lg hover:bg-stratefix-yellow/90 transition text-sm font-semibold"><Plus className="w-3.5 h-3.5" /> Start induction</button>
        ) : (
          <button onClick={() => setShowNewTemplate(true)} className="inline-flex items-center gap-1.5 h-8 px-3 bg-stratefix-yellow text-brand-on-primary rounded-lg hover:bg-stratefix-yellow/90 transition text-sm font-semibold"><Plus className="w-3.5 h-3.5" /> New template</button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <section className={`w-full lg:w-[320px] lg:flex-shrink-0 flex-col bg-white lg:border-r border-gray-200 min-h-0 ${mobileDetail ? 'hidden lg:flex' : 'flex'}`}>
          {tab === 'joiners' && doneJourneys.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-100">
              <button onClick={() => setShowDone(s => !s)} className={`h-7 px-2.5 rounded-full text-xs font-medium transition ${showDone ? 'bg-stratefix-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Show completed ({doneJourneys.length})</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {listItems.length === 0 && (
              <div className="text-center py-12 px-6">
                <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">{tab === 'joiners' ? 'No one is in induction' : 'No templates yet'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tab === 'joiners' ? 'Start one for a new joiner, or convert a candidate.' : 'A template is the checklist every joiner in a role gets.'}</p>
              </div>
            )}
            {tab === 'joiners' ? (listItems as Journey[]).map(j => {
              const isSel = j.id === selectedJourney;
              const day = Math.max(0, daysBetween(j.start_date, new Date().toISOString().slice(0, 10)));
              const total = daysBetween(j.start_date, j.expected_end_date);
              return (
                <button key={j.id} onClick={() => { setSelectedJourney(j.id); setMobileDetail(true); }} aria-current={isSel ? 'true' : undefined} className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border-l-[3px] transition ${isSel ? 'bg-stratefix-yellow/10 border-stratefix-yellow' : 'border-transparent hover:bg-gray-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{j.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{j.employees?.designations?.title || j.induction_templates?.title || 'Induction'} · {j.status === 'completed' ? `Done ${fmt(j.actual_end_date)}` : j.status === 'not_started' ? `Starts ${fmt(j.start_date)}` : `Day ${day} of ${total}`}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="h-1.5 w-12 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${j.status === 'completed' ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${j.completion_percentage}%` }} /></div>
                    <span className="text-xs text-gray-600 w-8 text-right">{j.completion_percentage}%</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 lg:hidden" />
                </button>
              );
            }) : (listItems as Template[]).map(t => {
              const isSel = t.id === selectedTemplate;
              return (
                <button key={t.id} onClick={() => { setSelectedTemplate(t.id); setMobileDetail(true); }} aria-current={isSel ? 'true' : undefined} className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border-l-[3px] transition ${isSel ? 'bg-stratefix-yellow/10 border-stratefix-yellow' : 'border-transparent hover:bg-gray-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${t.is_active ? 'text-gray-900' : 'text-gray-400'}`}>{t.title}</p>
                    <p className="text-xs text-gray-500 truncate">{t.designations?.title || 'All designations'} · {t.duration_days} days{t.learning_paths?.title ? ` · ${t.learning_paths.title}` : ''}</p>
                  </div>
                  {!t.is_active && chip('bg-gray-100 text-gray-500', 'Inactive')}
                  <ChevronRight className="w-4 h-4 text-gray-300 lg:hidden" />
                </button>
              );
            })}
          </div>
        </section>

        <section className={`flex-1 min-w-0 flex-col min-h-0 overflow-y-auto ${mobileDetail ? 'flex' : 'hidden lg:flex'}`}>
          {tab === 'joiners' ? (
            journey ? <JourneyDetail key={journey.id} journey={journey} onBack={() => setMobileDetail(false)} onChanged={load} /> : <EmptyDetail text="Select a joiner to see their checklist and progress." />
          ) : (
            template ? <TemplateDetail key={template.id} template={template} designations={designations} paths={paths} onBack={() => setMobileDetail(false)} onChanged={load} onDeleted={() => { setSelectedTemplate(null); load(); }} /> : <EmptyDetail text="Select a template to edit its checklist." />
          )}
        </section>
      </div>

      {showStart && (
        <StartInductionModal
          people={people.filter(p => p.lifecycle_stage !== 'exited' && !openJourneys.some(j => j.employee_id === p.employee_id))}
          templates={templates.filter(t => t.is_active)}
          onClose={() => setShowStart(false)}
          onStarted={(id) => { setShowStart(false); load().then(() => { setSelectedJourney(id); setTab('joiners'); setMobileDetail(true); }); }}
        />
      )}
      {showNewTemplate && org && (
        <TemplateFormModal organizationId={org} designations={designations} paths={paths} onClose={() => setShowNewTemplate(false)} onSaved={(id) => { setShowNewTemplate(false); load().then(() => { setSelectedTemplate(id); setMobileDetail(true); }); }} />
      )}
    </div>
  );
}

function EmptyDetail({ text }: { text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center"><ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-xs text-gray-500">{text}</p></div>
    </div>
  );
}

/* ---------- joiner detail ---------- */

function JourneyDetail({ journey, onBack, onChanged }: { journey: Journey; onBack: () => void; onChanged: () => void }) {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [pathProgress, setPathProgress] = useState<{ status: string; done: number; total: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', owner: 'employee' as Owner, due_date: '', is_required: true });
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(journey.notes || '');
  const sc = STATUS_CHIP[journey.status] || STATUS_CHIP.in_progress;
  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    const { data } = await supabase.from('induction_tasks').select('*').eq('journey_id', journey.id).order('order_index');
    setTasks((data || []) as Task[]);
    const pathId = journey.induction_templates?.learning_path_id;
    if (pathId) {
      const [asg, items, prog] = await Promise.all([
        supabase.from('employee_learning_assignments').select('status').eq('employee_id', journey.employee_id).eq('learning_path_id', pathId).maybeSingle(),
        supabase.from('learning_path_items').select('course_id').eq('path_id', pathId),
        supabase.from('learning_progress').select('course_id').eq('employee_id', journey.employee_id).is('module_id', null).eq('status', 'completed'),
      ]);
      const courseIds = new Set(((items.data || []) as any[]).map(i => i.course_id));
      const done = ((prog.data || []) as any[]).filter(p => courseIds.has(p.course_id)).length;
      setPathProgress({ status: asg.data?.status || 'not assigned', done, total: courseIds.size });
    } else setPathProgress(null);
  };
  useEffect(() => { load(); }, [journey.id]);

  const setStatus = async (t: Task, status: Task['status']) => {
    setBusy(true);
    await supabase.from('induction_tasks').update({ status, completed_at: status === 'pending' ? null : new Date().toISOString(), completed_by: status === 'pending' ? null : userProfile?.id }).eq('id', t.id);
    await load(); onChanged(); setBusy(false);
  };
  const removeTask = async (t: Task) => { setBusy(true); await supabase.from('induction_tasks').delete().eq('id', t.id); await load(); onChanged(); setBusy(false); };
  const addTask = async () => {
    if (!newTask.title.trim()) return;
    setBusy(true);
    await supabase.from('induction_tasks').insert({ journey_id: journey.id, title: newTask.title.trim(), owner: newTask.owner, due_date: newTask.due_date || null, is_required: newTask.is_required, order_index: (tasks?.length || 0) + 1 });
    setNewTask({ title: '', owner: 'employee', due_date: '', is_required: true }); setAdding(false);
    await load(); onChanged(); setBusy(false);
  };
  const updateJourney = async (patch: Record<string, unknown>) => { setBusy(true); await supabase.from('induction_journeys').update(patch).eq('id', journey.id); onChanged(); setBusy(false); };

  const required = tasks?.filter(t => t.is_required) || [];
  const doneCount = required.filter(t => t.status !== 'pending').length;
  const overdue = (tasks || []).filter(t => t.status === 'pending' && t.due_date && t.due_date < today).length;
  const day = Math.max(0, daysBetween(journey.start_date, today));
  const total = daysBetween(journey.start_date, journey.expected_end_date);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1 text-sm text-gray-600 -mt-1"><ChevronLeft className="w-4 h-4" /> All joiners</button>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">{journey.full_name}</h2>
            {chip(sc.cls, sc.label)}
          </div>
          <p className="text-xs text-gray-500 mt-1">{[journey.employees?.designations?.title, journey.employees?.departments?.name, journey.induction_templates?.title].filter(Boolean).join(' · ')}</p>
        </div>
        {journey.status !== 'completed' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => updateJourney({ expected_end_date: new Date(new Date(journey.expected_end_date).getTime() + 30 * 86400000).toISOString().slice(0, 10), status: 'extended' })} disabled={busy} className="h-8 px-3 rounded-lg border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-50 transition">Extend 30 days</button>
            <button onClick={() => { if (confirm('Mark this induction as complete? Any open tasks will stay as they are.')) updateJourney({ status: 'completed', actual_end_date: today, completion_percentage: 100 }); }} disabled={busy} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">Mark complete</button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-2 sm:flex -mt-px -ml-px">
          {[
            { label: 'Progress', value: `${journey.completion_percentage}%` },
            { label: 'Timeline', value: journey.status === 'not_started' ? `Starts ${fmt(journey.start_date)}` : `Day ${day} of ${total}`, hint: `${fmt(journey.start_date)} → ${fmt(journey.expected_end_date)}` },
            { label: 'Tasks', value: tasks ? `${doneCount} of ${required.length} required` : '…', hint: overdue ? `${overdue} overdue` : undefined, warn: overdue > 0 },
            { label: 'Learning path', value: pathProgress ? `${pathProgress.done} of ${pathProgress.total} courses` : (journey.induction_templates?.learning_path_id ? '…' : 'None'), hint: journey.induction_templates?.learning_paths?.title },
            { label: 'Probation ends', value: fmt(journey.probation_end_date) },
          ].map(s => (
            <div key={s.label} className="px-4 py-2.5 min-w-0 sm:flex-1 sm:basis-0 border-t border-l border-gray-100">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{s.value}</p>
              {s.hint && <p className={`text-xs truncate ${s.warn ? 'text-red-700' : 'text-gray-500'}`}>{s.hint}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3.5 h-10 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Checklist</h3>
          <span className="text-xs text-gray-500">{tasks?.length ?? 0}</span>
          <div className="flex-1" />
          {journey.status !== 'completed' && <button onClick={() => setAdding(a => !a)} className="text-xs font-medium text-blue-800 hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add task</button>}
        </div>
        {adding && (
          <div className="px-3.5 py-3 border-b border-gray-100 bg-gray-50 grid sm:grid-cols-[1fr_130px_140px_auto] gap-2 items-end">
            <div><label className={labelCls}>Task</label><input autoFocus className={inputCls} value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTask()} /></div>
            <div><label className={labelCls}>Who does it</label><select className={inputCls} value={newTask.owner} onChange={e => setNewTask(t => ({ ...t, owner: e.target.value as Owner }))}>{(Object.keys(OWNER_LABEL) as Owner[]).map(o => <option key={o} value={o}>{OWNER_LABEL[o]}</option>)}</select></div>
            <div><label className={labelCls}>Due</label><input type="date" className={inputCls} value={newTask.due_date} onChange={e => setNewTask(t => ({ ...t, due_date: e.target.value }))} /></div>
            <div className="flex items-center gap-2 h-9">
              <label className="text-xs text-gray-700 inline-flex items-center gap-1.5"><input type="checkbox" checked={newTask.is_required} onChange={e => setNewTask(t => ({ ...t, is_required: e.target.checked }))} /> Required</label>
              <button onClick={addTask} disabled={busy || !newTask.title.trim()} className="h-8 px-3 bg-stratefix-yellow text-brand-on-primary rounded-lg text-xs font-semibold disabled:opacity-50">Add</button>
            </div>
          </div>
        )}
        {!tasks ? <p className="px-4 py-6 text-xs text-gray-500">Loading…</p> : tasks.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-gray-500">No tasks. Add some, or pick a template with a checklist next time.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tasks.map(t => {
              const late = t.status === 'pending' && t.due_date && t.due_date < today;
              return (
                <li key={t.id} className="px-3.5 py-2.5 flex items-center gap-3 group">
                  <button onClick={() => setStatus(t, t.status === 'pending' ? 'done' : 'pending')} disabled={busy || journey.status === 'completed'} className="flex-shrink-0" title={t.status === 'pending' ? 'Mark done' : 'Mark not done'}>
                    {t.status === 'done' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : t.status === 'skipped' ? <MinusCircle className="w-5 h-5 text-gray-400" /> : <Circle className="w-5 h-5 text-gray-300 hover:text-gray-500" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${t.status === 'pending' ? 'text-gray-900' : 'text-gray-500 line-through'}`}>{t.title}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{OWNER_LABEL[t.owner]}</span>
                      {t.due_date && <span className={`inline-flex items-center gap-1 ${late ? 'text-red-700 font-medium' : ''}`}><Calendar className="w-3 h-3" />{late ? 'Overdue · ' : ''}{fmt(t.due_date)}</span>}
                      {!t.is_required && <span>Optional</span>}
                      {t.completed_at && <span>Done {fmt(t.completed_at)}</span>}
                    </p>
                  </div>
                  {journey.status !== 'completed' && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      {t.status === 'pending' && <button onClick={() => setStatus(t, 'skipped')} className="h-7 px-2 rounded-md text-xs text-gray-600 hover:bg-gray-100">Skip</button>}
                      <button onClick={() => removeTask(t)} className="h-7 w-7 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3.5">
        <label className={labelCls}>Notes (visible to HR, L&D and admins)</label>
        <textarea className="w-full min-h-[72px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent" value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => notes !== (journey.notes || '') && updateJourney({ notes })} placeholder="How are they settling in?" />
      </div>
    </div>
  );
}

/* ---------- template detail ---------- */

function TemplateDetail({ template, designations, paths, onBack, onChanged, onDeleted }: { template: Template; designations: Lookup[]; paths: Lookup[]; onBack: () => void; onChanged: () => void; onDeleted: () => void }) {
  const [tasks, setTasks] = useState<TemplateTask[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', owner: 'employee' as Owner, due_day: 7, is_required: true });
  const [busy, setBusy] = useState(false);

  const load = async () => { const { data } = await supabase.from('induction_template_tasks').select('*').eq('template_id', template.id).order('order_index'); setTasks((data || []) as TemplateTask[]); };
  useEffect(() => { load(); }, [template.id]);

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    setBusy(true);
    await supabase.from('induction_template_tasks').insert({ template_id: template.id, title: newTask.title.trim(), owner: newTask.owner, due_day: Math.max(0, Number(newTask.due_day) || 0), is_required: newTask.is_required, order_index: (tasks?.length || 0) + 1 });
    setNewTask(t => ({ ...t, title: '' })); await load(); setBusy(false);
  };
  const removeTask = async (t: TemplateTask) => { setBusy(true); await supabase.from('induction_template_tasks').delete().eq('id', t.id); await load(); setBusy(false); };
  const move = async (idx: number, dir: -1 | 1) => {
    if (!tasks) return; const j = idx + dir; if (j < 0 || j >= tasks.length) return;
    setBusy(true);
    await Promise.all([
      supabase.from('induction_template_tasks').update({ order_index: j + 1 }).eq('id', tasks[idx].id),
      supabase.from('induction_template_tasks').update({ order_index: idx + 1 }).eq('id', tasks[j].id),
    ]);
    await load(); setBusy(false);
  };
  const toggleActive = async () => { setBusy(true); await supabase.from('induction_templates').update({ is_active: !template.is_active }).eq('id', template.id); onChanged(); setBusy(false); };
  const remove = async () => {
    if (!confirm('Delete this template? Inductions already started keep their tasks.')) return;
    setBusy(true); await supabase.from('induction_templates').delete().eq('id', template.id); onDeleted();
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1 text-sm text-gray-600 -mt-1"><ChevronLeft className="w-4 h-4" /> All templates</button>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">{template.title}</h2>
            {!template.is_active && chip('bg-gray-100 text-gray-500', 'Inactive')}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {template.designations?.title || 'All designations'} · {template.duration_days} days
            {template.learning_paths?.title && <> · <Network className="w-3 h-3 inline -mt-0.5" /> {template.learning_paths.title}</>}
          </p>
          {template.description && <p className="text-sm text-gray-700 mt-2 max-w-2xl">{template.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="h-8 px-3 rounded-lg border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-50 transition inline-flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> Edit</button>
          <button onClick={toggleActive} disabled={busy} className="h-8 px-3 rounded-lg border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-50 transition">{template.is_active ? 'Deactivate' : 'Activate'}</button>
          <button onClick={remove} disabled={busy} title="Delete" className="h-8 w-8 rounded-lg border border-gray-300 text-red-600 hover:bg-red-50 transition flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3.5 h-10 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Checklist</h3>
          <span className="text-xs text-gray-500">{tasks?.length ?? 0}</span>
          <div className="flex-1" />
          <button onClick={() => setAdding(a => !a)} className="text-xs font-medium text-blue-800 hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add task</button>
        </div>
        {adding && (
          <div className="px-3.5 py-3 border-b border-gray-100 bg-gray-50 grid sm:grid-cols-[1fr_130px_110px_auto] gap-2 items-end">
            <div><label className={labelCls}>Task</label><input autoFocus className={inputCls} placeholder="e.g. Submit ID and bank documents" value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTask()} /></div>
            <div><label className={labelCls}>Who does it</label><select className={inputCls} value={newTask.owner} onChange={e => setNewTask(t => ({ ...t, owner: e.target.value as Owner }))}>{(Object.keys(OWNER_LABEL) as Owner[]).map(o => <option key={o} value={o}>{OWNER_LABEL[o]}</option>)}</select></div>
            <div><label className={labelCls}>Due by day</label><input type="number" min={0} className={inputCls} value={newTask.due_day} onChange={e => setNewTask(t => ({ ...t, due_day: Number(e.target.value) }))} /></div>
            <div className="flex items-center gap-2 h-9">
              <label className="text-xs text-gray-700 inline-flex items-center gap-1.5"><input type="checkbox" checked={newTask.is_required} onChange={e => setNewTask(t => ({ ...t, is_required: e.target.checked }))} /> Required</label>
              <button onClick={addTask} disabled={busy || !newTask.title.trim()} className="h-8 px-3 bg-stratefix-yellow text-brand-on-primary rounded-lg text-xs font-semibold disabled:opacity-50">Add</button>
            </div>
          </div>
        )}
        {!tasks ? <p className="px-4 py-6 text-xs text-gray-500">Loading…</p> : tasks.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-gray-500">No tasks yet. Typical ones: submit documents, set up accounts, meet the manager, shadow a senior for a day, first-week review.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tasks.map((t, i) => (
              <li key={t.id} className="px-3.5 py-2.5 flex items-center gap-3 group">
                <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-500">{OWNER_LABEL[t.owner]} · by day {t.due_day}{!t.is_required ? ' · Optional' : ''}</p>
                </div>
                <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
                  <button onClick={() => move(i, -1)} disabled={busy || i === 0} className="h-7 w-7 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => move(i, 1)} disabled={busy || i === tasks.length - 1} className="h-7 w-7 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeTask(t)} disabled={busy} className="h-7 w-7 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && <TemplateFormModal organizationId={''} template={template} designations={designations} paths={paths} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />}
    </div>
  );
}

/* ---------- modals ---------- */

function TemplateFormModal({ organizationId, template, designations, paths, onClose, onSaved }: { organizationId: string; template?: Template; designations: Lookup[]; paths: Lookup[]; onClose: () => void; onSaved: (id: string) => void }) {
  const { userProfile, organization } = useAuth();
  const [form, setForm] = useState({ title: template?.title || '', designation_id: template?.designation_id || '', duration_days: template?.duration_days || Number(organization?.settings?.induction_days) || 90, learning_path_id: template?.learning_path_id || '', description: template?.description || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    const payload = { title: form.title.trim(), designation_id: form.designation_id || null, duration_days: Math.max(1, Number(form.duration_days) || 90), learning_path_id: form.learning_path_id || null, description: form.description.trim() || null };
    const res = template
      ? await supabase.from('induction_templates').update(payload).eq('id', template.id).select('id').single()
      : await supabase.from('induction_templates').insert({ ...payload, organization_id: organizationId || userProfile?.organization_id, created_by: userProfile?.id, is_active: true }).select('id').single();
    if (res.error) { setError(res.error.message); setSaving(false); return; }
    onSaved(res.data.id);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">{template ? 'Edit template' : 'New induction template'}</h3><button type="button" onClick={onClose} className="w-9 h-9 -mr-2 flex items-center justify-center text-gray-500"><X className="w-4 h-4" /></button></div>
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className={labelCls}>Name</label><input required className={inputCls} placeholder="e.g. Sales Executive induction" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label className={labelCls}>For designation</label><select className={inputCls} value={form.designation_id} onChange={e => setForm(f => ({ ...f, designation_id: e.target.value }))}><option value="">All designations (general)</option>{designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className={labelCls}>Length (days)</label><input type="number" min={1} className={inputCls} value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: Number(e.target.value) }))} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Learning path assigned on day 1</label><select className={inputCls} value={form.learning_path_id} onChange={e => setForm(f => ({ ...f, learning_path_id: e.target.value }))}><option value="">None</option>{paths.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="sm:col-span-2"><label className={labelCls}>Description (shown to the joiner)</label><textarea className="w-full min-h-[64px] px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          {error && <p className="sm:col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="px-4 pb-4 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="h-9 px-3 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
          <button type="submit" disabled={saving} className="h-9 px-4 bg-stratefix-yellow text-brand-on-primary rounded-lg text-sm font-semibold hover:bg-stratefix-yellow/90 disabled:opacity-50 transition">{saving ? 'Saving…' : template ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

export function StartInductionModal({ people, templates, defaultEmployeeId, onClose, onStarted }: {
  people: { employee_id: string; full_name: string; designation_id: string | null }[]; templates: Template[]; defaultEmployeeId?: string;
  onClose: () => void; onStarted: (journeyId: string) => void;
}) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId || people[0]?.employee_id || '');
  const person = people.find(p => p.employee_id === employeeId);
  const suggested = templates.find(t => t.designation_id && t.designation_id === person?.designation_id) || templates.find(t => !t.designation_id);
  const [templateId, setTemplateId] = useState(suggested?.id || '');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setTemplateId(suggested?.id || ''); }, [employeeId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    const { data, error: err } = await supabase.rpc('start_induction', { p_employee: employeeId, p_template: templateId || null, p_start: start });
    if (err) { setError(err.message); setSaving(false); return; }
    onStarted(data as string);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl">
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Start an induction</h3><button type="button" onClick={onClose} className="w-9 h-9 -mr-2 flex items-center justify-center text-gray-500"><X className="w-4 h-4" /></button></div>
        <div className="p-4 space-y-3">
          <div><label className={labelCls}>Who</label><select className={inputCls} value={employeeId} disabled={!!defaultEmployeeId} onChange={e => setEmployeeId(e.target.value)}>{people.map(p => <option key={p.employee_id} value={p.employee_id}>{p.full_name}</option>)}</select></div>
          <div><label className={labelCls}>Template</label><select className={inputCls} value={templateId} onChange={e => setTemplateId(e.target.value)}><option value="">No template (blank checklist)</option>{templates.map(t => <option key={t.id} value={t.id}>{t.title}{t.designations?.title ? ` — ${t.designations.title}` : ''}</option>)}</select>
            {templates.length === 0 && <p className="text-xs text-gray-500 mt-1">No templates yet — create one under Templates so every joiner gets the same checklist.</p>}</div>
          <div><label className={labelCls}>Start date</label><input type="date" required className={inputCls} value={start} onChange={e => setStart(e.target.value)} /><p className="text-xs text-gray-500 mt-1">Task due dates and the learning path are set from this date.</p></div>
          {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="px-4 pb-4 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="h-9 px-3 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
          <button type="submit" disabled={saving || !employeeId} className="h-9 px-4 bg-stratefix-yellow text-brand-on-primary rounded-lg text-sm font-semibold hover:bg-stratefix-yellow/90 disabled:opacity-50 transition">{saving ? 'Starting…' : 'Start'}</button>
        </div>
      </form>
    </div>
  );
}
