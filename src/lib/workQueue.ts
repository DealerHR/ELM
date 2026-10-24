import { supabase, type UserProfile } from './supabase';

/**
 * The work queue: what is waiting for this person, computed from the data
 * that is already there. Each item names the screen that deals with it.
 * Kept in one place so every dashboard shows the same kind of row.
 */

export type QueueTone = 'danger' | 'warn' | 'info';

export interface QueueItem {
  id: string;
  /** What is waiting, e.g. "Approve course request" */
  title: string;
  /** Who / what it is about, e.g. "Anita Rao · Professional Listening" */
  detail: string;
  /** Short age or due text, e.g. "3 days overdue" */
  when?: string;
  tone: QueueTone;
  /** Button label, the view it opens, and the record to land on */
  action: { label: string; view: string; id?: string; params?: Record<string, string> };
  /** Lower sorts first */
  priority: number;
}

const DAY = 86400000;
const today = () => new Date(new Date().setHours(0, 0, 0, 0));
const daysFrom = (d: string) => Math.round((new Date(d).getTime() - today().getTime()) / DAY);
const ago = (iso: string) => {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const dueText = (d: string | null) => {
  if (!d) return undefined;
  const n = daysFrom(d);
  return n < 0 ? `${plural(-n, 'day')} overdue` : n === 0 ? 'due today' : `due in ${plural(n, 'day')}`;
};

interface Ctx {
  profile: UserProfile;
  learnerMode: boolean;
  /** This user's employees.id, if they have one */
  employeeId: string | null;
}

export async function loadWorkQueue(ctx: Ctx): Promise<QueueItem[]> {
  const role = ctx.profile.role;
  const staff = !ctx.learnerMode && role !== 'employee';
  const jobs: Promise<QueueItem[]>[] = [];

  if (staff && (role === 'admin' || role === 'hr')) jobs.push(hiringItems(ctx), onboardingItems(ctx, 'hr'));
  if (staff && (role === 'admin' || role === 'l_d_manager')) jobs.push(learningAdminItems(ctx));
  if (staff && (role === 'admin' || role === 'hr' || role === 'manager')) jobs.push(okrManagerItems(ctx));
  if (staff && role === 'manager') jobs.push(onboardingItems(ctx, 'manager'), teamLearningItems(ctx));
  if (ctx.employeeId) jobs.push(myItems(ctx));

  const lists = await Promise.all(jobs.map(j => j.catch(() => [] as QueueItem[])));
  return lists.flat().sort((a, b) => a.priority - b.priority);
}

/* ---------- Hire ---------- */

async function hiringItems({ profile }: Ctx): Promise<QueueItem[]> {
  const { data } = await supabase
    .from('candidates')
    .select('id, full_name, status, updated_at, interview_date, applied_position_title')
    .eq('organization_id', profile.organization_id)
    .in('status', ['assessment_completed', 'interviewed', 'shortlisted', 'offer_extended', 'offer_accepted', 'interview_scheduled']);
  const out: QueueItem[] = [];
  for (const c of (data || []) as any[]) {
    const who = [c.full_name, c.applied_position_title].filter(Boolean).join(' · ');
    switch (c.status) {
      case 'assessment_completed':
        out.push({ id: `cand-${c.id}`, title: 'Review assessment result', detail: who, when: c.updated_at ? ago(c.updated_at) : undefined, tone: 'info', action: { label: 'Open', view: 'candidates', id: c.id }, priority: 30 });
        break;
      case 'interview_scheduled':
        if (c.interview_date && daysFrom(c.interview_date) <= 0)
          out.push({ id: `cand-${c.id}`, title: 'Record interview outcome', detail: who, when: daysFrom(c.interview_date) === 0 ? 'interview today' : `interview was ${ago(c.interview_date)}`, tone: 'warn', action: { label: 'Open', view: 'candidates', id: c.id }, priority: 25 });
        break;
      case 'interviewed':
      case 'shortlisted':
        out.push({ id: `cand-${c.id}`, title: 'Decide: offer or close', detail: who, when: c.updated_at ? ago(c.updated_at) : undefined, tone: 'info', action: { label: 'Open', view: 'candidates', id: c.id }, priority: 35 });
        break;
      case 'offer_extended':
        out.push({ id: `cand-${c.id}`, title: 'Offer out — waiting for reply', detail: who, when: c.updated_at ? `sent ${ago(c.updated_at)}` : undefined, tone: 'info', action: { label: 'Open', view: 'candidates', id: c.id }, priority: 40 });
        break;
      case 'offer_accepted':
        out.push({ id: `cand-${c.id}`, title: 'Convert to employee and start induction', detail: who, when: c.updated_at ? `accepted ${ago(c.updated_at)}` : undefined, tone: 'warn', action: { label: 'Convert', view: 'candidates', id: c.id }, priority: 15 });
        break;
    }
  }
  return out;
}

/* ---------- Onboard ---------- */

async function onboardingItems(ctx: Ctx, as: 'hr' | 'manager'): Promise<QueueItem[]> {
  const { profile, employeeId } = ctx;
  const out: QueueItem[] = [];
  const in7 = new Date(today().getTime() + 7 * DAY).toISOString().slice(0, 10);
  const in14 = new Date(today().getTime() + 14 * DAY).toISOString().slice(0, 10);

  // Employees scoped to what this person looks after.
  let empQ = supabase.from('employees').select('id, user_id, date_of_joining, lifecycle_stage').eq('organization_id', profile.organization_id).neq('lifecycle_stage', 'exited');
  if (as === 'manager') { if (!employeeId) return []; empQ = empQ.eq('reporting_manager_id', employeeId); }
  const { data: emps } = await empQ;
  const empList = (emps || []) as { id: string; user_id: string; date_of_joining: string; lifecycle_stage: string }[];
  if (empList.length === 0) return [];
  const ids = empList.map(e => e.id);

  const [{ data: profiles }, { data: journeys }] = await Promise.all([
    supabase.from('user_profiles').select('id, full_name').in('id', empList.map(e => e.user_id)),
    supabase.from('induction_journeys').select('id, employee_id, status, probation_end_date, expected_end_date').in('employee_id', ids).in('status', ['not_started', 'in_progress', 'extended']),
  ]);
  const nameOf = (empId: string) => { const e = empList.find(x => x.id === empId); return (profiles || []).find((p: any) => p.id === e?.user_id)?.full_name || 'Someone'; };
  const jList = (journeys || []) as any[];

  if (as === 'hr') {
    // Joining soon (or already joined) with no induction started.
    for (const e of empList) {
      const hasJourney = jList.some(j => j.employee_id === e.id);
      if (!hasJourney && (e.lifecycle_stage === 'joining' || (e.lifecycle_stage === 'active' && daysFrom(e.date_of_joining) >= -14 && daysFrom(e.date_of_joining) <= 0))) {
        const n = daysFrom(e.date_of_joining);
        out.push({ id: `join-${e.id}`, title: 'Start induction', detail: nameOf(e.id), when: n > 0 ? `joins in ${plural(n, 'day')}` : n === 0 ? 'joins today' : `joined ${plural(-n, 'day')} ago`, tone: n <= 0 ? 'warn' : 'info', action: { label: 'Start', view: 'employees', id: e.id }, priority: n <= 0 ? 12 : 45 });
      }
    }
    // Probation ending soon.
    for (const j of jList) {
      if (j.probation_end_date && j.probation_end_date <= in14 && daysFrom(j.probation_end_date) >= -7) {
        out.push({ id: `prob-${j.id}`, title: 'Probation review due', detail: nameOf(j.employee_id), when: dueText(j.probation_end_date), tone: daysFrom(j.probation_end_date) <= 0 ? 'danger' : 'warn', action: { label: 'Open', view: 'inductions', id: j.id }, priority: 20 });
      }
    }
  }

  // Induction tasks owned by this role that are overdue or due this week.
  if (jList.length) {
    const { data: tasks } = await supabase.from('induction_tasks').select('id, journey_id, title, due_date, owner').in('journey_id', jList.map(j => j.id)).eq('status', 'pending').eq('owner', as).lte('due_date', in7);
    for (const t of (tasks || []) as any[]) {
      const j = jList.find(x => x.id === t.journey_id);
      const n = t.due_date ? daysFrom(t.due_date) : 0;
      out.push({ id: `itask-${t.id}`, title: t.title, detail: `Induction · ${j ? nameOf(j.employee_id) : ''}`, when: dueText(t.due_date), tone: n < 0 ? 'danger' : 'warn', action: { label: 'Open', view: as === 'hr' ? 'inductions' : 'employees', id: as === 'hr' ? t.journey_id : j?.employee_id }, priority: n < 0 ? 10 : 22 });
    }
  }
  return out;
}

/* ---------- Learn (L&D) ---------- */

async function learningAdminItems({ profile }: Ctx): Promise<QueueItem[]> {
  const out: QueueItem[] = [];
  const [reqRes, empRes] = await Promise.all([
    supabase.from('course_access_requests').select('id, employee_id, requested_at, learning_courses(title)').eq('organization_id', profile.organization_id).eq('status', 'pending'),
    supabase.from('employees').select('id, user_id').eq('organization_id', profile.organization_id).eq('status', 'active'),
  ]);
  const reqs = (reqRes.data || []) as any[];
  if (reqs.length) {
    const { data: ppl } = await supabase.from('user_profiles').select('id, full_name').in('id', reqs.map(r => r.employee_id));
    for (const r of reqs) {
      out.push({ id: `req-${r.id}`, title: 'Approve course request', detail: `${(ppl || []).find((p: any) => p.id === r.employee_id)?.full_name || 'Someone'} · ${r.learning_courses?.title || 'a course'}`, when: ago(r.requested_at), tone: 'info', action: { label: 'Review', view: 'course-builder', params: { tab: 'requests' } }, priority: 28 });
    }
  }

  const emps = (empRes.data || []) as { id: string; user_id: string }[];
  if (emps.length) {
    const { data: asg } = await supabase
      .from('employee_learning_assignments')
      .select('id, employee_id, status, due_date, learning_courses(title, delivery_type), learning_paths(title)')
      .in('employee_id', emps.map(e => e.id))
      .neq('status', 'completed');
    const list = (asg || []) as any[];
    const overdue = list.filter(a => a.due_date && daysFrom(a.due_date) < 0);
    if (overdue.length) {
      const people = new Set(overdue.map(a => a.employee_id)).size;
      out.push({ id: 'overdue-all', title: `${plural(overdue.length, 'overdue assignment')}`, detail: `across ${plural(people, 'learner')} — nudge or extend`, tone: 'danger', action: { label: 'Open', view: 'assign-learning' }, priority: 18 });
    }
    const toCertify = list.filter(a => a.learning_courses && ['classroom', 'on_job'].includes(a.learning_courses.delivery_type) && a.due_date && daysFrom(a.due_date) <= 0);
    if (toCertify.length) {
      out.push({ id: 'certify', title: `${plural(toCertify.length, 'classroom / on-job completion')} to sign off`, detail: 'Sessions whose date has passed and are not yet certified', tone: 'warn', action: { label: 'Certify', view: 'course-builder', params: { tab: 'certifications' } }, priority: 26 });
    }
  }
  return out;
}

/* ---------- Perform (manager / HR / admin) ---------- */

async function okrManagerItems({ profile, employeeId }: Ctx): Promise<QueueItem[]> {
  const out: QueueItem[] = [];
  let empQ = supabase.from('employees').select('id, user_id').eq('organization_id', profile.organization_id).neq('lifecycle_stage', 'exited');
  if (profile.role === 'manager') { if (!employeeId) return []; empQ = empQ.eq('reporting_manager_id', employeeId); }
  const { data: emps } = await empQ;
  const empList = ((emps || []) as { id: string; user_id: string }[]).filter(e => e.id !== employeeId);
  if (!empList.length) return [];
  const [{ data: profiles }, { data: okrs }] = await Promise.all([
    supabase.from('user_profiles').select('id, full_name').in('id', empList.map(e => e.user_id)),
    supabase.from('okrs').select('id, employee_id, title, status, end_date, okr_comments(author_id, created_at)').in('employee_id', empList.map(e => e.id)).in('status', ['draft', 'set']),
  ]);
  const nameOf = (empId: string) => (profiles || []).find((p: any) => p.id === empList.find(e => e.id === empId)?.user_id)?.full_name || 'Someone';
  const list = (okrs || []) as any[];

  // Managers see per-person gaps; HR/admin would drown in them, so they only see the drafts they own.
  if (profile.role === 'manager') {
    for (const e of empList) {
      if (!list.some(o => o.employee_id === e.id)) out.push({ id: `okr-none-${e.id}`, title: 'Set OKRs', detail: nameOf(e.id), when: 'none this period', tone: 'warn', action: { label: 'Set', view: 'okrs', id: e.id }, priority: 32 });
    }
  }
  for (const o of list) {
    if (o.status === 'draft') out.push({ id: `okr-draft-${o.id}`, title: 'Share OKR draft', detail: `${nameOf(o.employee_id)} · ${o.title}`, tone: 'info', action: { label: 'Open', view: 'okrs', id: o.employee_id }, priority: 34 });
    if (o.status === 'set') {
      const comments = (o.okr_comments || []).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
      const last = comments[comments.length - 1];
      const empUser = empList.find(e => e.id === o.employee_id)?.user_id;
      if (last && last.author_id === empUser) out.push({ id: `okr-reply-${o.id}`, title: 'Reply to comment', detail: `${nameOf(o.employee_id)} · ${o.title}`, when: ago(last.created_at), tone: 'info', action: { label: 'Reply', view: 'okrs', id: o.employee_id }, priority: 27 });
      if (daysFrom(o.end_date) < 0) out.push({ id: `okr-lock-${o.id}`, title: 'Period ended — lock OKR', detail: `${nameOf(o.employee_id)} · ${o.title}`, when: `${plural(-daysFrom(o.end_date), 'day')} ago`, tone: 'warn', action: { label: 'Lock', view: 'okrs', id: o.employee_id }, priority: 24 });
    }
  }
  return out;
}

/* ---------- Manager: team learning ---------- */

async function teamLearningItems({ employeeId }: Ctx): Promise<QueueItem[]> {
  if (!employeeId) return [];
  const { data: reports } = await supabase.from('employees').select('id, user_id').eq('reporting_manager_id', employeeId).neq('lifecycle_stage', 'exited');
  const reps = (reports || []) as { id: string; user_id: string }[];
  if (!reps.length) return [];
  const [{ data: profiles }, { data: asg }] = await Promise.all([
    supabase.from('user_profiles').select('id, full_name').in('id', reps.map(r => r.user_id)),
    supabase.from('employee_learning_assignments').select('employee_id, due_date, status').in('employee_id', reps.map(r => r.id)).neq('status', 'completed').not('due_date', 'is', null),
  ]);
  const out: QueueItem[] = [];
  for (const r of reps) {
    const over = ((asg || []) as any[]).filter(a => a.employee_id === r.id && daysFrom(a.due_date) < 0).length;
    if (over) out.push({ id: `team-overdue-${r.id}`, title: `${plural(over, 'overdue course')}`, detail: (profiles || []).find((p: any) => p.id === r.user_id)?.full_name || 'Someone', tone: 'danger', action: { label: 'See', view: 'employees', id: r.id }, priority: 21 });
  }
  return out;
}

/* ---------- Me (everyone with an employee record) ---------- */

async function myItems({ profile, employeeId }: Ctx): Promise<QueueItem[]> {
  if (!employeeId) return [];
  const out: QueueItem[] = [];
  const in7 = new Date(today().getTime() + 7 * DAY).toISOString().slice(0, 10);
  const [asgRes, journeyRes, okrRes] = await Promise.all([
    supabase.from('employee_learning_assignments').select('id, due_date, status, learning_courses(title), learning_paths(title)').eq('employee_id', employeeId).neq('status', 'completed'),
    supabase.from('induction_journeys').select('id').eq('employee_id', employeeId).in('status', ['not_started', 'in_progress', 'extended']),
    supabase.from('okrs').select('id, title, status, set_at, okr_comments(author_id, created_at)').eq('employee_id', employeeId).eq('status', 'set'),
  ]);
  for (const a of (asgRes.data || []) as any[]) {
    if (!a.due_date) continue;
    const n = daysFrom(a.due_date);
    if (n <= 7) out.push({ id: `my-asg-${a.id}`, title: n < 0 ? 'Overdue learning' : 'Learning due soon', detail: a.learning_courses?.title || a.learning_paths?.title || 'Assignment', when: dueText(a.due_date), tone: n < 0 ? 'danger' : 'warn', action: { label: 'Continue', view: 'my-learning', id: a.id }, priority: n < 0 ? 5 : 14 });
  }
  const jIds = ((journeyRes.data || []) as any[]).map(j => j.id);
  if (jIds.length) {
    const { data: tasks } = await supabase.from('induction_tasks').select('id, title, due_date').in('journey_id', jIds).eq('owner', 'employee').eq('status', 'pending').lte('due_date', in7);
    for (const t of (tasks || []) as any[]) {
      const n = t.due_date ? daysFrom(t.due_date) : 0;
      out.push({ id: `my-itask-${t.id}`, title: t.title, detail: 'Your first days', when: dueText(t.due_date), tone: n < 0 ? 'danger' : 'warn', action: { label: 'Open', view: 'my-learning' }, priority: n < 0 ? 6 : 16 });
    }
  }
  for (const o of (okrRes.data || []) as any[]) {
    const comments = (o.okr_comments || []).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
    const last = comments[comments.length - 1];
    if (last && last.author_id !== profile.id) out.push({ id: `my-okr-c-${o.id}`, title: 'New comment on your OKR', detail: o.title, when: ago(last.created_at), tone: 'info', action: { label: 'Read', view: 'okrs' }, priority: 29 });
    else if (!comments.length && o.set_at && Date.now() - new Date(o.set_at).getTime() < 7 * DAY) out.push({ id: `my-okr-new-${o.id}`, title: 'Your OKR has been set', detail: o.title, when: ago(o.set_at), tone: 'info', action: { label: 'Read', view: 'okrs' }, priority: 31 });
  }
  return out;
}
