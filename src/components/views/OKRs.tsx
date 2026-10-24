import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Target, ChevronRight, ChevronLeft, Lock, Send, Trash2, Pencil, X, MessageSquare, Search, CheckCircle, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRoute, replaceRoute } from '../../lib/router';

/*
 * OKRs. The manager sets them (draft → set), the employee reads and comments,
 * the manager updates progress and finally locks them (set → locked).
 *
 * Staff view (manager / HR / admin): people on the left, one person's OKRs on the right.
 * Employee view (and learner view for staff): just their own OKRs, read-only plus comments.
 */

interface KeyResult { id: string; okr_id: string; title: string; description?: string | null; target_value: number; current_value: number; unit?: string | null; weight: number; progress_percentage: number; status: string; }
interface Comment { id: string; okr_id: string; author_id: string; body: string; created_at: string; author_name?: string; }
interface LegacyReview { id: string; comment: string; review_date: string; overall_rating?: number | null; }
interface OKR {
  id: string; employee_id: string; title: string; description?: string | null; okr_type: string; period: string;
  start_date: string; end_date: string; status: 'draft' | 'set' | 'locked' | 'cancelled'; overall_progress: number;
  set_by?: string | null; set_at?: string | null; locked_by?: string | null; locked_at?: string | null; manager_summary?: string | null; final_rating?: number | null;
  key_results?: KeyResult[]; okr_comments?: Comment[]; okr_review_comments?: LegacyReview[];
}
interface Person { employee_id: string; user_id: string; full_name: string; designation?: string; department?: string; reporting_manager_id?: string | null; lifecycle_stage?: string; }

const STATUS: Record<OKR['status'], { label: string; cls: string }> = {
  draft: { label: 'Draft — not shared yet', cls: 'bg-gray-100 text-gray-700' },
  set: { label: 'Set', cls: 'bg-blue-50 text-blue-800' },
  locked: { label: 'Locked', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
};
const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtShort = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
const inputCls = 'w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent bg-white';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';
const chip = (cls: string, text: string) => <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{text}</span>;

const OKR_SELECT = '*, key_results(*), okr_comments(*), okr_review_comments(id, comment, review_date, overall_rating)';

async function loadOkrsFor(employeeIds: string[]): Promise<OKR[]> {
  if (employeeIds.length === 0) return [];
  const { data } = await supabase.from('okrs').select(OKR_SELECT).in('employee_id', employeeIds).order('start_date', { ascending: false });
  const okrs = (data || []) as OKR[];
  const authorIds = [...new Set(okrs.flatMap(o => (o.okr_comments || []).map(c => c.author_id)))];
  const { data: authors } = authorIds.length ? await supabase.from('user_profiles').select('id, full_name').in('id', authorIds) : { data: [] as any[] };
  for (const o of okrs) {
    o.key_results = (o.key_results || []).sort((a, b) => a.title.localeCompare(b.title));
    o.okr_comments = (o.okr_comments || []).map(c => ({ ...c, author_name: (authors || []).find((a: any) => a.id === c.author_id)?.full_name || 'Someone' })).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return okrs;
}

export default function OKRs({ learnerMode = false }: { learnerMode?: boolean }) {
  const { userProfile } = useAuth();
  const role = userProfile?.role;
  const staff = !learnerMode && (role === 'manager' || role === 'hr' || role === 'admin' || role === 'platform_admin');
  return staff ? <TeamOkrs /> : <MyOkrs />;
}

/* ---------- employee view ---------- */

function MyOkrs() {
  const { userProfile } = useAuth();
  const [okrs, setOkrs] = useState<OKR[] | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const load = async () => {
    if (!userProfile) return;
    const { data: me } = await supabase.from('employees').select('id').eq('user_id', userProfile.id).maybeSingle();
    if (!me) { setOkrs([]); return; }
    setEmployeeId(me.id);
    // RLS already hides unshared drafts; filter again so a cached row never shows.
    setOkrs((await loadOkrsFor([me.id])).filter(o => o.status !== 'draft'));
  };
  useEffect(() => { load(); }, [userProfile?.id]);

  if (!okrs) return <Spinner />;
  const current = okrs.filter(o => o.status === 'set');
  const past = okrs.filter(o => o.status !== 'set');

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
      <p className="text-xs text-gray-500">Your manager sets your objectives here and updates progress with you. You can add comments on anything that is set; once an OKR is locked it is final.</p>
      {okrs.length === 0 && <EmptyBox text="No OKRs have been set for you yet." />}
      {current.length > 0 && <Group title="Current" count={current.length}>{current.map(o => <OkrCard key={o.id} okr={o} canManage={false} onChanged={load} />)}</Group>}
      {past.length > 0 && <Group title="Locked and past" count={past.length}>{past.map(o => <OkrCard key={o.id} okr={o} canManage={false} onChanged={load} collapsed />)}</Group>}
      {employeeId && null}
    </div>
  );
}

/* ---------- staff view ---------- */

function TeamOkrs() {
  const { userProfile } = useAuth();
  const org = userProfile?.organization_id;
  const isManagerOnly = userProfile?.role === 'manager';
  const [people, setPeople] = useState<Person[]>([]);
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [teamOnly, setTeamOnly] = useState(isManagerOnly);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const route = useRoute();

  // Deep link: #/okrs/<employee id>
  useEffect(() => {
    if (route.view !== 'okrs' || !route.id || people.length === 0) return;
    if (people.some(p => p.employee_id === route.id)) { setSelected(route.id); setMobileDetail(true); }
  }, [route.id, people.length]);

  const load = async () => {
    if (!org || !userProfile) return;
    const [{ data: me }, empRes] = await Promise.all([
      supabase.from('employees').select('id').eq('user_id', userProfile.id).maybeSingle(),
      supabase.from('employees').select('id, user_id, reporting_manager_id, lifecycle_stage, designations:designation_id(title), departments:department_id(name)').eq('organization_id', org),
    ]);
    setMyEmployeeId(me?.id || null);
    const emps = (empRes.data || []) as any[];
    const { data: profiles } = emps.length ? await supabase.from('user_profiles').select('id, full_name').in('id', emps.map(e => e.user_id)) : { data: [] as any[] };
    const ppl: Person[] = emps
      .filter(e => e.id !== me?.id && e.lifecycle_stage !== 'exited')
      .map(e => ({ employee_id: e.id, user_id: e.user_id, full_name: (profiles || []).find((p: any) => p.id === e.user_id)?.full_name || 'Unknown', designation: e.designations?.title, department: e.departments?.name, reporting_manager_id: e.reporting_manager_id, lifecycle_stage: e.lifecycle_stage }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    // Managers only manage their direct reports; RLS enforces it, this keeps the list honest.
    const visible = isManagerOnly ? ppl.filter(p => p.reporting_manager_id === me?.id) : ppl;
    setPeople(visible);
    setOkrs(await loadOkrsFor(visible.map(p => p.employee_id)));
    setLoading(false);
  };
  useEffect(() => { load(); }, [org, userProfile?.id]);

  const byPerson = useMemo(() => {
    const m = new Map<string, OKR[]>();
    for (const o of okrs) m.set(o.employee_id, [...(m.get(o.employee_id) || []), o]);
    return m;
  }, [okrs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter(p => (!teamOnly || !myEmployeeId || p.reporting_manager_id === myEmployeeId) && (!q || p.full_name.toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q) || (p.department || '').toLowerCase().includes(q)));
  }, [people, search, teamOnly, myEmployeeId]);

  const person = people.find(p => p.employee_id === selected) || null;
  const personOkrs = person ? (byPerson.get(person.employee_id) || []) : [];
  const canManageSelected = !!person && (!isManagerOnly || person.reporting_manager_id === myEmployeeId);

  if (loading) return <Spinner />;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 lg:px-6 h-11 flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900 hidden sm:inline">{isManagerOnly ? 'Your team' : 'Team OKRs'}</span>
        <span className="text-xs text-gray-500 hidden sm:inline">{okrs.filter(o => o.status === 'set').length} set · {okrs.filter(o => o.status === 'draft').length} draft</span>
        <div className="flex-1" />
        {person && canManageSelected && (
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 h-8 px-3 bg-stratefix-yellow text-brand-on-primary rounded-lg hover:bg-stratefix-yellow/90 transition text-sm font-semibold"><Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">New OKR for {person.full_name.split(' ')[0]}</span><span className="sm:hidden">New OKR</span></button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <section className={`w-full lg:w-[300px] lg:flex-shrink-0 flex-col bg-white lg:border-r border-gray-200 min-h-0 ${mobileDetail ? 'hidden lg:flex' : 'flex'}`}>
          <div className="px-3 pt-2.5 pb-2 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people" className="w-full h-8 pl-8 pr-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent" />
            </div>
            {!isManagerOnly && myEmployeeId && people.some(p => p.reporting_manager_id === myEmployeeId) && (
              <button onClick={() => setTeamOnly(t => !t)} className={`h-7 px-2.5 rounded-full text-xs font-medium transition ${teamOnly ? 'bg-stratefix-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>My direct reports</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && <div className="text-center py-12 px-6 text-xs text-gray-500">{isManagerOnly ? 'No one reports to you yet. Ask HR to set you as their manager under People.' : 'No one matches.'}</div>}
            {filtered.map(p => {
              const list = byPerson.get(p.employee_id) || [];
              const set = list.filter(o => o.status === 'set');
              const drafts = list.filter(o => o.status === 'draft').length;
              const avg = set.length ? Math.round(set.reduce((n, o) => n + o.overall_progress, 0) / set.length) : null;
              const isSel = p.employee_id === selected;
              return (
                <button key={p.employee_id} onClick={() => { setSelected(p.employee_id); setMobileDetail(true); replaceRoute('okrs', p.employee_id); }} aria-current={isSel ? 'true' : undefined} className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border-l-[3px] transition ${isSel ? 'bg-stratefix-yellow/10 border-stratefix-yellow' : 'border-transparent hover:bg-gray-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{list.length === 0 ? 'No OKRs' : `${set.length} set${drafts ? ` · ${drafts} draft` : ''}${list.length - set.length - drafts ? ` · ${list.length - set.length - drafts} locked` : ''}`}</p>
                  </div>
                  {avg !== null && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="h-1.5 w-10 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${avg}%` }} /></div>
                      <span className="text-xs text-gray-600 w-8 text-right">{avg}%</span>
                    </div>
                  )}
                  {list.length === 0 && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="No OKRs set" />}
                  <ChevronRight className="w-4 h-4 text-gray-300 lg:hidden" />
                </button>
              );
            })}
          </div>
        </section>

        <section className={`flex-1 min-w-0 flex-col min-h-0 overflow-y-auto ${mobileDetail ? 'flex' : 'hidden lg:flex'}`}>
          {!person ? (
            <div className="flex-1 flex items-center justify-center p-8"><div className="text-center"><Target className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-xs text-gray-500">Pick a person to see or set their OKRs.</p></div></div>
          ) : (
            <div className="p-4 lg:p-6 space-y-4">
              <button onClick={() => setMobileDetail(false)} className="lg:hidden inline-flex items-center gap-1 text-sm text-gray-600 -mt-1"><ChevronLeft className="w-4 h-4" /> Everyone</button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 leading-tight">{person.full_name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{[person.designation, person.department].filter(Boolean).join(' · ')}</p>
              </div>
              {personOkrs.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-8 text-center">
                  <Target className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                  <p className="text-sm font-medium text-gray-700">No OKRs yet</p>
                  <p className="text-xs text-gray-500 mt-0.5 mb-3">Write the objective and two to four measurable key results. It stays a draft until you share it.</p>
                  {canManageSelected && <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 h-8 px-3 bg-stratefix-yellow text-brand-on-primary rounded-lg hover:bg-stratefix-yellow/90 transition text-sm font-semibold"><Plus className="w-3.5 h-3.5" /> New OKR</button>}
                </div>
              )}
              {(['draft', 'set', 'locked', 'cancelled'] as const).map(st => {
                const list = personOkrs.filter(o => o.status === st);
                if (!list.length) return null;
                return <Group key={st} title={st === 'draft' ? 'Drafts (only you see these)' : st === 'set' ? 'Set' : st === 'locked' ? 'Locked' : 'Cancelled'} count={list.length}>{list.map(o => <OkrCard key={o.id} okr={o} canManage={canManageSelected} onChanged={load} collapsed={st !== 'set' && st !== 'draft'} />)}</Group>;
              })}
            </div>
          )}
        </section>
      </div>

      {showNew && person && <OkrFormModal employeeId={person.employee_id} personName={person.full_name} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

/* ---------- pieces ---------- */

function Spinner() { return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-stratefix-yellow border-t-transparent rounded-full animate-spin" /></div>; }
function EmptyBox({ text }: { text: string }) { return <div className="bg-white border border-gray-200 rounded-lg px-4 py-10 text-center"><Target className="w-6 h-6 text-gray-300 mx-auto mb-1.5" /><p className="text-xs text-gray-500">{text}</p></div>; }
function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">{title}<span className="text-gray-400 normal-case tracking-normal">{count}</span></h3>
      {children}
    </div>
  );
}

function OkrCard({ okr, canManage, onChanged, collapsed = false }: { okr: OKR; canManage: boolean; onChanged: () => void; collapsed?: boolean }) {
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(!collapsed);
  const [editing, setEditing] = useState(false);
  const [addingKr, setAddingKr] = useState(false);
  const [locking, setLocking] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const st = STATUS[okr.status];
  const editable = canManage && okr.status !== 'locked' && okr.status !== 'cancelled';
  const canComment = okr.status === 'set';

  const act = async (fn: () => PromiseLike<{ error: any } | any>) => {
    setBusy(true); setErr('');
    const res = await fn();
    if (res?.error) setErr(res.error.message || 'Something went wrong.');
    else onChanged();
    setBusy(false);
  };
  const share = () => act(() => supabase.from('okrs').update({ status: 'set', set_by: userProfile?.id, set_at: new Date().toISOString() }).eq('id', okr.id));
  const unshare = () => act(() => supabase.from('okrs').update({ status: 'draft' }).eq('id', okr.id));
  const remove = () => { if (confirm('Delete this draft OKR?')) act(() => supabase.from('okrs').delete().eq('id', okr.id)); };
  const cancel = () => { if (confirm('Cancel this OKR? It stays visible as cancelled.')) act(() => supabase.from('okrs').update({ status: 'cancelled' }).eq('id', okr.id)); };
  const unlock = () => { if (confirm('Unlock this OKR? It goes back to Set so progress can change again.')) act(() => supabase.from('okrs').update({ status: 'set', locked_by: null, locked_at: null }).eq('id', okr.id)); };
  const postComment = () => { if (!comment.trim()) return; act(async () => { const r = await supabase.from('okr_comments').insert({ okr_id: okr.id, author_id: userProfile?.id, body: comment.trim() }); if (!r.error) setComment(''); return r; }); };
  const updateKr = (kr: KeyResult, patch: Partial<KeyResult>) => act(() => supabase.from('key_results').update(patch).eq('id', kr.id));
  const removeKr = (kr: KeyResult) => { if (confirm('Remove this key result?')) act(() => supabase.from('key_results').delete().eq('id', kr.id)); };

  const daysLeft = Math.ceil((new Date(okr.end_date).getTime() - Date.now()) / 86400000);

  return (
    <article className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-900">{okr.title}</h4>
            {chip(st.cls, st.label)}
            {okr.status === 'set' && daysLeft < 0 && chip('bg-red-50 text-red-700', 'Period ended')}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="capitalize">{okr.period}</span> · {fmtShort(okr.start_date)} → {fmtShort(okr.end_date)}
            {okr.status === 'set' && daysLeft >= 0 ? ` · ${daysLeft} days left` : ''}
            {okr.key_results?.length ? ` · ${okr.key_results.length} key result${okr.key_results.length === 1 ? '' : 's'}` : ''}
            {okr.okr_comments?.length ? ` · ${okr.okr_comments.length} comment${okr.okr_comments.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden hidden sm:block"><div className={`h-full ${okr.status === 'locked' ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${okr.overall_progress}%` }} /></div>
          <span className="text-sm font-semibold text-gray-900 w-10 text-right">{okr.overall_progress}%</span>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {okr.description && <p className="px-4 pt-3 text-sm text-gray-700">{okr.description}</p>}

          {/* Key results */}
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 mb-1.5">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Key results</h5>
              <div className="flex-1" />
              {editable && <button onClick={() => setAddingKr(a => !a)} className="text-xs font-medium text-blue-800 hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>}
            </div>
            {(okr.key_results || []).length === 0 && !addingKr && <p className="text-xs text-gray-500 pb-1">{editable ? 'Add two to four measurable results — each needs a target.' : 'No key results.'}</p>}
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden empty:hidden">
              {(okr.key_results || []).map(kr => <KeyResultRow key={kr.id} kr={kr} editable={editable} busy={busy} onUpdate={patch => updateKr(kr, patch)} onRemove={() => removeKr(kr)} />)}
            </ul>
            {addingKr && <KeyResultForm okrId={okr.id} onDone={() => { setAddingKr(false); onChanged(); }} onCancel={() => setAddingKr(false)} />}
          </div>

          {/* Sign-off */}
          {okr.status === 'locked' && (okr.manager_summary || okr.final_rating) && (
            <div className="mx-4 mt-3 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Signed off {fmt(okr.locked_at)}{okr.final_rating ? ` · ${okr.final_rating}/5` : ''}</p>
              {okr.manager_summary && <p className="text-sm text-emerald-900 mt-1">{okr.manager_summary}</p>}
            </div>
          )}

          {/* Comments */}
          <div className="px-4 pt-3 pb-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Comments</h5>
            {(okr.okr_review_comments || []).map(r => (
              <div key={r.id} className="text-xs text-gray-600 py-1.5"><span className="font-medium text-gray-800">Review note</span> · {fmtShort(r.review_date)}{r.overall_rating ? ` · ${r.overall_rating}/5` : ''}<p className="text-sm text-gray-700">{r.comment}</p></div>
            ))}
            {(okr.okr_comments || []).length === 0 && (okr.okr_review_comments || []).length === 0 && <p className="text-xs text-gray-500">{canComment ? 'No comments yet.' : okr.status === 'draft' ? 'Comments open once the OKR is shared.' : 'No comments.'}</p>}
            <ul className="space-y-2">
              {(okr.okr_comments || []).map(c => (
                <li key={c.id} className={`text-sm ${c.author_id === userProfile?.id ? 'pl-6' : ''}`}>
                  <p className="text-xs text-gray-500"><span className="font-medium text-gray-800">{c.author_id === userProfile?.id ? 'You' : c.author_name}</span> · {fmtShort(c.created_at)}</p>
                  <p className="text-gray-800">{c.body}</p>
                </li>
              ))}
            </ul>
            {canComment && (
              <div className="mt-2 flex gap-2">
                <input className={inputCls} placeholder={canManage ? 'Reply or add a note…' : 'Add a comment for your manager…'} value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && postComment()} />
                <button onClick={postComment} disabled={busy || !comment.trim()} className="h-9 px-3 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-40 flex-shrink-0">Post</button>
              </div>
            )}
          </div>

          {err && <p className="mx-4 mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

          {/* Actions */}
          {canManage && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
              {okr.status === 'draft' && <>
                <button onClick={share} disabled={busy || !(okr.key_results || []).length} title={!(okr.key_results || []).length ? 'Add at least one key result first' : ''} className="inline-flex items-center gap-1.5 h-8 px-3 bg-stratefix-yellow text-brand-on-primary rounded-lg text-sm font-semibold hover:bg-stratefix-yellow/90 disabled:opacity-50 transition"><Send className="w-3.5 h-3.5" /> Share with employee</button>
                <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 h-8 px-3 border border-gray-300 text-gray-800 rounded-lg text-sm font-medium hover:bg-white transition"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                <div className="flex-1" />
                <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 h-8 px-3 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              </>}
              {okr.status === 'set' && <>
                <button onClick={() => setLocking(true)} disabled={busy} className="inline-flex items-center gap-1.5 h-8 px-3 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"><Lock className="w-3.5 h-3.5" /> Lock</button>
                <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 h-8 px-3 border border-gray-300 text-gray-800 rounded-lg text-sm font-medium hover:bg-white transition"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={unshare} disabled={busy} className="h-8 px-3 text-gray-600 rounded-lg text-sm font-medium hover:bg-white transition">Back to draft</button>
                <div className="flex-1" />
                <button onClick={cancel} disabled={busy} className="h-8 px-3 text-gray-600 rounded-lg text-sm font-medium hover:bg-white transition">Cancel OKR</button>
              </>}
              {okr.status === 'locked' && (userProfile?.role === 'hr' || userProfile?.role === 'admin') && (
                <button onClick={unlock} disabled={busy} className="h-8 px-3 text-gray-600 rounded-lg text-sm font-medium hover:bg-white transition">Unlock (HR/admin)</button>
              )}
            </div>
          )}
        </div>
      )}

      {editing && <OkrFormModal okr={okr} employeeId={okr.employee_id} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />}
      {locking && <LockModal okr={okr} onClose={() => setLocking(false)} onLocked={() => { setLocking(false); onChanged(); }} />}
    </article>
  );
}

function KeyResultRow({ kr, editable, busy, onUpdate, onRemove }: { kr: KeyResult; editable: boolean; busy: boolean; onUpdate: (p: Partial<KeyResult>) => void; onRemove: () => void }) {
  const [val, setVal] = useState(String(kr.current_value ?? 0));
  useEffect(() => setVal(String(kr.current_value ?? 0)), [kr.current_value]);
  const commit = () => { const n = Number(val); if (!Number.isNaN(n) && n !== kr.current_value) onUpdate({ current_value: n }); };
  const tone = kr.status === 'completed' ? 'bg-emerald-500' : kr.status === 'at_risk' ? 'bg-amber-500' : 'bg-blue-600';
  return (
    <li className="px-3 py-2 flex items-center gap-3 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">{kr.title}</p>
        <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
          {editable ? (
            <span className="inline-flex items-center gap-1">
              <input type="number" className="h-7 w-20 px-2 border border-gray-300 rounded-md text-xs" value={val} onChange={e => setVal(e.target.value)} onBlur={commit} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} disabled={busy} />
              <span>of {kr.target_value}{kr.unit ? ` ${kr.unit}` : ''}</span>
            </span>
          ) : <span>{kr.current_value} of {kr.target_value}{kr.unit ? ` ${kr.unit}` : ''}</span>}
          {kr.weight !== 100 && <span>· weight {kr.weight}</span>}
          {kr.status === 'at_risk' && <span className="text-amber-700 font-medium inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> At risk</span>}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${kr.progress_percentage}%` }} /></div>
        <span className="text-xs text-gray-700 w-9 text-right">{kr.progress_percentage}%</span>
        {editable && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            <button onClick={() => onUpdate({ status: kr.status === 'at_risk' ? 'on_track' : 'at_risk' })} title={kr.status === 'at_risk' ? 'Clear at-risk flag' : 'Flag as at risk'} className={`h-7 w-7 rounded-md flex items-center justify-center ${kr.status === 'at_risk' ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:bg-gray-100'}`}><AlertTriangle className="w-3.5 h-3.5" /></button>
            <button onClick={onRemove} className="h-7 w-7 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
    </li>
  );
}

function KeyResultForm({ okrId, onDone, onCancel }: { okrId: string; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ title: '', target_value: '', current_value: '0', unit: '', weight: '100' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!f.title.trim() || !f.target_value) { setErr('A title and a target are needed.'); return; }
    setSaving(true); setErr('');
    const { error } = await supabase.from('key_results').insert({ okr_id: okrId, title: f.title.trim(), target_value: Number(f.target_value), current_value: Number(f.current_value) || 0, unit: f.unit.trim() || null, weight: Math.max(1, Number(f.weight) || 100) });
    if (error) { setErr(error.message); setSaving(false); return; }
    onDone();
  };
  return (
    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg grid sm:grid-cols-[1fr_90px_90px_90px_80px] gap-2 items-end">
      <div className="sm:col-span-1"><label className={labelCls}>Key result</label><input autoFocus className={inputCls} placeholder="e.g. Test drives per month" value={f.title} onChange={e => setF(x => ({ ...x, title: e.target.value }))} /></div>
      <div><label className={labelCls}>Target</label><input type="number" className={inputCls} value={f.target_value} onChange={e => setF(x => ({ ...x, target_value: e.target.value }))} /></div>
      <div><label className={labelCls}>Now</label><input type="number" className={inputCls} value={f.current_value} onChange={e => setF(x => ({ ...x, current_value: e.target.value }))} /></div>
      <div><label className={labelCls}>Unit</label><input className={inputCls} placeholder="%, nos" value={f.unit} onChange={e => setF(x => ({ ...x, unit: e.target.value }))} /></div>
      <div><label className={labelCls}>Weight</label><input type="number" className={inputCls} value={f.weight} onChange={e => setF(x => ({ ...x, weight: e.target.value }))} /></div>
      {err && <p className="sm:col-span-5 text-xs text-red-700">{err}</p>}
      <div className="sm:col-span-5 flex gap-2 justify-end">
        <button onClick={onCancel} className="h-8 px-3 text-gray-700 text-xs font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
        <button onClick={save} disabled={saving} className="h-8 px-3 bg-stratefix-yellow text-brand-on-primary rounded-lg text-xs font-semibold disabled:opacity-50">{saving ? 'Adding…' : 'Add key result'}</button>
      </div>
    </div>
  );
}

function quarterDefaults() {
  const now = new Date(); const q = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), q * 3, 1); const end = new Date(now.getFullYear(), q * 3 + 3, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function OkrFormModal({ okr, employeeId, personName, onClose, onSaved }: { okr?: OKR; employeeId: string; personName?: string; onClose: () => void; onSaved: () => void }) {
  const { userProfile } = useAuth();
  const qd = quarterDefaults();
  const [f, setF] = useState({ title: okr?.title || '', description: okr?.description || '', okr_type: okr?.okr_type || 'individual', period: okr?.period || 'quarterly', start_date: okr?.start_date || qd.start, end_date: okr?.end_date || qd.end });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setErr('');
    if (f.end_date < f.start_date) { setErr('The end date is before the start date.'); setSaving(false); return; }
    const payload = { title: f.title.trim(), description: f.description.trim() || null, okr_type: f.okr_type, period: f.period, start_date: f.start_date, end_date: f.end_date };
    const res = okr
      ? await supabase.from('okrs').update(payload).eq('id', okr.id)
      : await supabase.from('okrs').insert({ ...payload, employee_id: employeeId, status: 'draft', set_by: userProfile?.id, overall_progress: 0 });
    if (res.error) { setErr(res.error.message); setSaving(false); return; }
    onSaved();
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">{okr ? 'Edit OKR' : `New OKR${personName ? ` for ${personName}` : ''}`}</h3><button type="button" onClick={onClose} className="w-9 h-9 -mr-2 flex items-center justify-center text-gray-500"><X className="w-4 h-4" /></button></div>
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className={labelCls}>Objective</label><input required autoFocus className={inputCls} placeholder="e.g. Grow test-drive conversions this quarter" value={f.title} onChange={e => setF(x => ({ ...x, title: e.target.value }))} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Why it matters (optional)</label><textarea className="w-full min-h-[64px] px-3 py-2 border border-gray-300 rounded-lg text-sm" value={f.description} onChange={e => setF(x => ({ ...x, description: e.target.value }))} /></div>
          <div><label className={labelCls}>Period</label><select className={inputCls} value={f.period} onChange={e => setF(x => ({ ...x, period: e.target.value }))}><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select></div>
          <div><label className={labelCls}>Type</label><select className={inputCls} value={f.okr_type} onChange={e => setF(x => ({ ...x, okr_type: e.target.value }))}><option value="individual">Individual</option><option value="team">Team</option><option value="company">Company</option></select></div>
          <div><label className={labelCls}>Start</label><input type="date" required className={inputCls} value={f.start_date} onChange={e => setF(x => ({ ...x, start_date: e.target.value }))} /></div>
          <div><label className={labelCls}>End</label><input type="date" required className={inputCls} value={f.end_date} onChange={e => setF(x => ({ ...x, end_date: e.target.value }))} /></div>
          {!okr && <p className="sm:col-span-2 text-xs text-gray-500">Saved as a draft. Add key results, then share it — the employee sees it only after that.</p>}
          {err && <p className="sm:col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="px-4 pb-4 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="h-9 px-3 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
          <button type="submit" disabled={saving} className="h-9 px-4 bg-stratefix-yellow text-brand-on-primary rounded-lg text-sm font-semibold hover:bg-stratefix-yellow/90 disabled:opacity-50 transition">{saving ? 'Saving…' : okr ? 'Save' : 'Create draft'}</button>
        </div>
      </form>
    </div>
  );
}

function LockModal({ okr, onClose, onLocked }: { okr: OKR; onClose: () => void; onLocked: () => void }) {
  const { userProfile } = useAuth();
  const [summary, setSummary] = useState(okr.manager_summary || '');
  const [rating, setRating] = useState<number | null>(okr.final_rating || null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const lock = async () => {
    setSaving(true); setErr('');
    const { error } = await supabase.from('okrs').update({ status: 'locked', locked_by: userProfile?.id, locked_at: new Date().toISOString(), manager_summary: summary.trim() || null, final_rating: rating }).eq('id', okr.id);
    if (error) { setErr(error.message); setSaving(false); return; }
    onLocked();
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl">
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Lock "{okr.title}"</h3><button onClick={onClose} className="w-9 h-9 -mr-2 flex items-center justify-center text-gray-500"><X className="w-4 h-4" /></button></div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-600">Locking is your sign-off at {okr.overall_progress}%. Progress and key results freeze and comments close. HR or an admin can unlock it later if needed.</p>
          <div><label className={labelCls}>Rating (optional)</label>
            <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setRating(r => r === n ? null : n)} className={`h-9 w-9 rounded-lg border text-sm font-semibold transition ${rating === n ? 'bg-stratefix-black text-white border-stratefix-black' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{n}</button>)}</div></div>
          <div><label className={labelCls}>Summary for the employee (optional)</label><textarea className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="What went well, what to carry forward…" value={summary} onChange={e => setSummary(e.target.value)} /></div>
          {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="px-4 pb-4 flex gap-2 justify-end">
          <button onClick={onClose} className="h-9 px-3 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
          <button onClick={lock} disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-4 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"><Lock className="w-3.5 h-3.5" /> {saving ? 'Locking…' : 'Lock'}</button>
        </div>
      </div>
    </div>
  );
}
