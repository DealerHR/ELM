import { useState, useEffect, type ReactNode } from 'react';
import {
  BookOpen, CheckCircle, Target, Award, ExternalLink, Link2, Megaphone,
  ChevronRight, TrendingUp, Play, Users, ClipboardList, UserCheck, BookMarked, Network,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useMessages, type OrgMessage } from '../../hooks/useMessages';

/*
 * One dashboard file, four variants: learner, manager, L&D/admin, HR.
 * Everything is built from the same small set of pieces (Strip, Panel, Row) so the
 * variants look alike and stay light: no banners, no gradients, rows instead of cards.
 */

interface Assignment {
  id: string;
  due_date: string | null;
  status: string;
  learning_courses: { title: string; duration_hours?: number } | null;
  learning_paths: { title: string } | null;
}

interface PinnedResource { id: string; title: string; url: string; description?: string; icon: string; }

interface DirectReport {
  id: string; full_name: string; department?: string; designation?: string;
  pendingOKR: number; totalLearning: number; completedLearning: number; overdue: number;
}

interface PendingOKR { id: string; employee_id: string; employee_name: string; title: string; period: string; overall_progress: number; }

interface OrgStats { total: number; completed: number; pending: number; overdue: number; learners: number; }
interface CourseStats { published: number; draft: number; paths: number; }
interface HrStats { employees: number; departments: number; candidates: number; inProcess: number; offers: number; joined: number; }

interface DashboardProps { onNavigate?: (view: string) => void; learnerMode?: boolean; }

const iconMap: Record<string, typeof Link2> = { link: Link2, book: BookOpen, target: Target, award: Award };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
}

function dueLabel(due: string | null) {
  if (!due) return { text: 'No due date', tone: 'text-gray-500' };
  const d = daysUntil(due);
  if (d < 0) return { text: `${-d} day${d === -1 ? '' : 's'} overdue`, tone: 'text-red-700 font-medium' };
  if (d === 0) return { text: 'Due today', tone: 'text-amber-800 font-medium' };
  if (d <= 7) return { text: `Due in ${d} day${d === 1 ? '' : 's'}`, tone: 'text-amber-800' };
  return { text: `Due ${new Date(due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, tone: 'text-gray-500' };
}

/* ---------- shared pieces ---------- */

function Page({ children }: { children: ReactNode }) {
  return <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">{children}</div>;
}

function Greeting({ name, sub }: { name?: string; sub: string }) {
  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 leading-tight">{greeting()}, {name?.split(' ')[0]}</h1>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </div>
  );
}

interface Stat { label: string; value: string | number; hint?: string; tone?: 'danger' | 'warn' | 'ok'; onClick?: () => void; }

/** A row of numbers in one bordered box. Two per row on phones, one row on larger screens. */
function Strip({ stats }: { stats: Stat[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="grid grid-cols-2 sm:flex -mt-px -ml-px">
        {stats.map(s => {
          const tone = s.tone === 'danger' && Number(s.value) > 0 ? 'text-red-700' : s.tone === 'warn' && Number(s.value) > 0 ? 'text-amber-800' : s.tone === 'ok' ? 'text-emerald-700' : 'text-gray-900';
          const cls = 'px-4 py-3 text-left min-w-0 sm:flex-1 sm:basis-0 border-t border-l border-gray-100';
          const inner = (
            <>
              <p className="text-[11px] text-gray-500 truncate">{s.label}</p>
              <p className={`text-xl font-semibold leading-tight mt-0.5 ${tone}`}>{s.value}</p>
              {s.hint && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{s.hint}</p>}
            </>
          );
          return s.onClick ? (
            <button key={s.label} onClick={s.onClick} className={`${cls} hover:bg-gray-50 transition`}>{inner}</button>
          ) : (
            <div key={s.label} className={cls}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ title, count, action, children }: { title: string; count?: number; action?: { label: string; onClick: () => void }; children: ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 h-10 border-b border-gray-100">
        <h2 className="text-[13px] font-semibold text-gray-900">{title}</h2>
        {count !== undefined && <span className="text-xs text-gray-500">{count}</span>}
        <div className="flex-1" />
        {action && (
          <button onClick={action.onClick} className="text-xs font-medium text-blue-800 hover:underline inline-flex items-center gap-0.5">
            {action.label} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof BookOpen; text: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <Icon className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
      <p className="text-xs text-gray-500">{text}</p>
    </div>
  );
}

function Shortcuts({ items, onNavigate }: { items: { label: string; sub: string; view: string; icon: typeof BookOpen }[]; onNavigate?: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map(a => (
        <button
          key={a.view}
          onClick={() => onNavigate?.(a.view)}
          className="flex items-center gap-3 px-3 h-12 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-left"
        >
          <a.icon className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.8} />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-gray-900 truncate">{a.label}</span>
            <span className="block text-[11px] text-gray-500 truncate">{a.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Announcements({ messages, unreadCount, markAsRead, onNavigate, limit = 4 }: { messages: OrgMessage[]; unreadCount: number; markAsRead: (id: string) => void; onNavigate?: (v: string) => void; limit?: number }) {
  const shown = messages.slice(0, limit);
  return (
    <Panel title="Announcements" count={unreadCount > 0 ? unreadCount : undefined} action={{ label: 'All', onClick: () => onNavigate?.('messages') }}>
      {shown.length === 0 ? (
        <Empty icon={Megaphone} text="No announcements" />
      ) : (
        <ul className="divide-y divide-gray-100">
          {shown.map(m => (
            <li key={m.id}>
              <button onClick={() => !m.isRead && markAsRead(m.id)} className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 transition">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.isRead ? 'bg-transparent' : m.priority === 'urgent' ? 'bg-red-500' : m.priority === 'high' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13px] truncate ${m.isRead ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>{m.title}</span>
                  <span className="block text-xs text-gray-500 truncate">{m.body}</span>
                </span>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function QuickLinks({ resources, canManage, onNavigate }: { resources: PinnedResource[]; canManage: boolean; onNavigate?: (v: string) => void }) {
  if (resources.length === 0 && !canManage) return null;
  return (
    <Panel title="Quick links" action={canManage ? { label: 'Manage', onClick: () => onNavigate?.('pinned-resources') } : undefined}>
      {resources.length === 0 ? (
        <Empty icon={Link2} text="No links pinned yet" />
      ) : (
        <ul className="divide-y divide-gray-100">
          {resources.map(r => {
            const Icon = iconMap[r.icon] || Link2;
            return (
              <li key={r.id}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-gray-50 transition">
                  <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.8} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-gray-900 truncate">{r.title}</span>
                    {r.description && <span className="block text-xs text-gray-500 truncate">{r.description}</span>}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function AssignmentList({ items, onNavigate, emptyText }: { items: Assignment[]; onNavigate?: (v: string) => void; emptyText: string }) {
  if (items.length === 0) return <Empty icon={CheckCircle} text={emptyText} />;
  return (
    <ul className="divide-y divide-gray-100">
      {items.map(a => {
        const due = dueLabel(a.due_date);
        const isPath = !!a.learning_paths;
        return (
          <li key={a.id}>
            <button onClick={() => onNavigate?.('my-learning')} className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition">
              {isPath ? <Network className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.8} /> : <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.8} />}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-gray-900 truncate">{a.learning_courses?.title || a.learning_paths?.title}</span>
                <span className="block text-xs text-gray-500">{isPath ? 'Learning path' : 'Course'}{a.status === 'in_progress' ? ' · In progress' : ''}</span>
              </span>
              <span className={`text-xs flex-shrink-0 ${due.tone}`}>{due.text}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- data + dispatch ---------- */

export default function Dashboard({ onNavigate, learnerMode = false }: DashboardProps) {
  const { userProfile } = useAuth();
  const role = userProfile?.role;
  const staff = !learnerMode && role !== 'employee';
  const isLdOrAdmin = staff && (role === 'l_d_manager' || role === 'admin');
  const isManager = staff && role === 'manager';
  const isHr = staff && role === 'hr';

  const { messages, unreadCount, markAsRead, markAllAsRead } = useMessages();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pinned, setPinned] = useState<PinnedResource[]>([]);
  const [orgStats, setOrgStats] = useState<OrgStats>({ total: 0, completed: 0, pending: 0, overdue: 0, learners: 0 });
  const [courseStats, setCourseStats] = useState<CourseStats>({ published: 0, draft: 0, paths: 0 });
  const [hrStats, setHrStats] = useState<HrStats>({ employees: 0, departments: 0, candidates: 0, inProcess: 0, offers: 0, joined: 0 });
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);
  const [pendingOKRs, setPendingOKRs] = useState<PendingOKR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, [userProfile?.id, learnerMode]);

  const loadAll = async () => {
    if (!userProfile) { setLoading(false); return; }
    await Promise.all([
      loadMyLearning(),
      loadPinned(),
      isLdOrAdmin || isHr ? loadOrgStats() : Promise.resolve(),
      isLdOrAdmin ? loadCourseStats() : Promise.resolve(),
      isHr ? loadHrStats() : Promise.resolve(),
      isManager ? loadTeam() : Promise.resolve(),
    ]);
    setLoading(false);
  };

  const loadMyLearning = async () => {
    if (!userProfile) return;
    const { data: emp } = await supabase.from('employees').select('id').eq('user_id', userProfile.id).maybeSingle();
    if (!emp) return;
    const { data } = await supabase
      .from('employee_learning_assignments')
      .select('id, due_date, status, learning_courses(title, duration_hours), learning_paths(title)')
      .eq('employee_id', emp.id)
      .order('due_date', { ascending: true, nullsFirst: false });
    setAssignments((data as unknown as Assignment[]) || []);
  };

  const loadPinned = async () => {
    if (!userProfile?.organization_id) return;
    const { data } = await supabase.from('pinned_resources').select('*').eq('organization_id', userProfile.organization_id).order('sort_order', { ascending: true });
    setPinned(data || []);
  };

  const loadOrgStats = async () => {
    if (!userProfile?.organization_id) return;
    const { data: emps } = await supabase.from('employees').select('id').eq('organization_id', userProfile.organization_id).eq('status', 'active');
    if (!emps?.length) return;
    const { data } = await supabase.from('employee_learning_assignments').select('id, employee_id, status, due_date').in('employee_id', emps.map((e: any) => e.id));
    const list = (data || []) as { id: string; employee_id: string; status: string; due_date: string | null }[];
    const now = new Date();
    setOrgStats({
      total: list.length,
      completed: list.filter(a => a.status === 'completed').length,
      pending: list.filter(a => ['assigned', 'in_progress'].includes(a.status)).length,
      overdue: list.filter(a => a.due_date && new Date(a.due_date) < now && a.status !== 'completed').length,
      learners: new Set(list.map(a => a.employee_id)).size,
    });
  };

  const loadCourseStats = async () => {
    if (!userProfile?.organization_id) return;
    const [courses, paths] = await Promise.all([
      supabase.from('learning_courses').select('status').eq('organization_id', userProfile.organization_id),
      supabase.from('learning_paths').select('id').eq('organization_id', userProfile.organization_id),
    ]);
    const cs = (courses.data || []) as { status: string }[];
    setCourseStats({ published: cs.filter(c => c.status === 'published').length, draft: cs.filter(c => c.status === 'draft').length, paths: (paths.data || []).length });
  };

  const loadHrStats = async () => {
    if (!userProfile?.organization_id) return;
    const org = userProfile.organization_id;
    const [emps, depts, cands] = await Promise.all([
      supabase.from('employees').select('id').eq('organization_id', org).eq('status', 'active'),
      supabase.from('departments').select('id').eq('organization_id', org),
      supabase.from('candidates').select('status').eq('organization_id', org),
    ]);
    const cs = (cands.data || []) as { status: string }[];
    const inProcess = ['applied', 'assessment_pending', 'assessment_completed', 'interview_scheduled', 'interviewed', 'shortlisted'];
    setHrStats({
      employees: (emps.data || []).length,
      departments: (depts.data || []).length,
      candidates: cs.length,
      inProcess: cs.filter(c => inProcess.includes(c.status)).length,
      offers: cs.filter(c => c.status === 'offer_extended').length,
      joined: cs.filter(c => c.status === 'joined' || c.status === 'offer_accepted').length,
    });
  };

  const loadTeam = async () => {
    if (!userProfile) return;
    const { data: me } = await supabase.from('employees').select('id').eq('user_id', userProfile.id).maybeSingle();
    if (!me) return;
    const { data: reports } = await supabase
      .from('employees')
      .select('id, user_id, departments:department_id(name), designations:designation_id(title)')
      .eq('reporting_manager_id', me.id)
      .eq('organization_id', userProfile.organization_id!);
    if (!reports?.length) { setDirectReports([]); setPendingOKRs([]); return; }

    const reportIds = reports.map(r => r.id);
    const userIds = reports.map(r => r.user_id).filter(Boolean);
    const [profilesRes, okrRes, assignRes] = await Promise.all([
      supabase.from('user_profiles').select('id, full_name').in('id', userIds),
      supabase.from('okrs').select('id, employee_id, title, period, overall_progress').in('employee_id', reportIds).eq('status', 'submitted'),
      supabase.from('employee_learning_assignments').select('employee_id, status, due_date').in('employee_id', reportIds),
    ]);
    const profiles = profilesRes.data || [];
    const okrs = okrRes.data || [];
    const asg = (assignRes.data || []) as { employee_id: string; status: string; due_date: string | null }[];
    const now = new Date();

    setPendingOKRs(okrs.map(o => {
      const rep = reports.find(r => r.id === o.employee_id);
      return { ...o, employee_name: profiles.find(p => p.id === rep?.user_id)?.full_name || 'Unknown' };
    }));
    setDirectReports(reports.map(r => {
      const mine = asg.filter(a => a.employee_id === r.id);
      return {
        id: r.id,
        full_name: profiles.find(p => p.id === r.user_id)?.full_name || 'Unknown',
        department: (r.departments as any)?.name,
        designation: (r.designations as any)?.title,
        pendingOKR: okrs.filter(o => o.employee_id === r.id).length,
        totalLearning: mine.length,
        completedLearning: mine.filter(a => a.status === 'completed').length,
        overdue: mine.filter(a => a.due_date && new Date(a.due_date) < now && a.status !== 'completed').length,
      };
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-stratefix-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const shared = { messages, unreadCount, markAsRead, markAllAsRead, pinned, onNavigate, name: userProfile?.full_name };

  if (isLdOrAdmin) return <LdDashboard {...shared} orgStats={orgStats} courseStats={courseStats} isAdmin={role === 'admin'} />;
  if (isHr) return <HrDashboard {...shared} orgStats={orgStats} hrStats={hrStats} />;
  if (isManager) return <ManagerDashboard {...shared} assignments={assignments} directReports={directReports} pendingOKRs={pendingOKRs} />;
  return <LearnerDashboard {...shared} assignments={assignments} />;
}

/* ---------- variants ---------- */

interface SharedProps {
  messages: OrgMessage[]; unreadCount: number; markAsRead: (id: string) => void; markAllAsRead: () => void;
  pinned: PinnedResource[]; onNavigate?: (v: string) => void; name?: string;
}

function learningSummary(assignments: Assignment[]) {
  const now = new Date();
  const pending = assignments.filter(a => a.status !== 'completed');
  const completed = assignments.length - pending.length;
  const overdue = pending.filter(a => a.due_date && new Date(a.due_date) < now);
  const inProgress = pending.find(a => a.status === 'in_progress') || null;
  const pct = assignments.length ? Math.round((completed / assignments.length) * 100) : 0;
  return { pending, completed, overdue, inProgress, pct };
}

function ContinueCard({ item, onNavigate }: { item: Assignment; onNavigate?: (v: string) => void }) {
  const due = dueLabel(item.due_date);
  return (
    <button onClick={() => onNavigate?.('my-learning')} className="w-full text-left bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition">
      <span className="w-9 h-9 rounded-lg bg-stratefix-yellow text-stratefix-black flex items-center justify-center flex-shrink-0"><Play className="w-4 h-4 ml-0.5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-gray-500">Continue where you left off</span>
        <span className="block text-[13px] font-medium text-gray-900 truncate">{item.learning_courses?.title || item.learning_paths?.title}</span>
      </span>
      <span className={`text-xs hidden sm:block ${due.tone}`}>{due.text}</span>
      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
    </button>
  );
}

function LearnerDashboard({ assignments, messages, unreadCount, markAsRead, pinned, onNavigate, name }: SharedProps & { assignments: Assignment[] }) {
  const s = learningSummary(assignments);
  const sub = s.pending.length === 0
    ? (assignments.length ? 'Everything assigned to you is done.' : 'Nothing is assigned to you yet.')
    : `${s.pending.length} item${s.pending.length === 1 ? '' : 's'} to finish${s.overdue.length ? `, ${s.overdue.length} overdue` : ''}.`;

  return (
    <Page>
      <Greeting name={name} sub={sub} />
      {s.inProgress && <ContinueCard item={s.inProgress} onNavigate={onNavigate} />}
      <Strip stats={[
        { label: 'Assigned', value: assignments.length, onClick: () => onNavigate?.('my-learning') },
        { label: 'Completed', value: s.completed, hint: `${s.pct}% of assigned`, tone: 'ok', onClick: () => onNavigate?.('my-learning') },
        { label: 'To do', value: s.pending.length, onClick: () => onNavigate?.('my-learning') },
        { label: 'Overdue', value: s.overdue.length, tone: 'danger', onClick: () => onNavigate?.('my-learning') },
      ]} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <Panel title="Up next" count={s.pending.length} action={{ label: 'My Learning', onClick: () => onNavigate?.('my-learning') }}>
            <AssignmentList items={s.pending.slice(0, 6)} onNavigate={onNavigate} emptyText="Nothing waiting for you" />
          </Panel>
          <Shortcuts onNavigate={onNavigate} items={[
            { label: 'Course Catalog', sub: 'Browse courses', view: 'courses', icon: BookMarked },
            { label: 'Skill Mapping', sub: 'Your skill levels', view: 'skill-mapping', icon: Target },
            { label: 'OKRs', sub: 'Goals this period', view: 'okrs', icon: TrendingUp },
            { label: 'Repository', sub: 'Shared documents', view: 'repository', icon: ClipboardList },
          ]} />
        </div>
        <div className="space-y-4 min-w-0">
          <Announcements messages={messages} unreadCount={unreadCount} markAsRead={markAsRead} onNavigate={onNavigate} />
          <QuickLinks resources={pinned} canManage={false} onNavigate={onNavigate} />
        </div>
      </div>
    </Page>
  );
}

function ManagerDashboard({ assignments, directReports, pendingOKRs, messages, unreadCount, markAsRead, pinned, onNavigate, name }: SharedProps & { assignments: Assignment[]; directReports: DirectReport[]; pendingOKRs: PendingOKR[] }) {
  const s = learningSummary(assignments);
  const teamTotal = directReports.reduce((n, r) => n + r.totalLearning, 0);
  const teamDone = directReports.reduce((n, r) => n + r.completedLearning, 0);
  const teamOverdue = directReports.reduce((n, r) => n + r.overdue, 0);
  const teamPct = teamTotal ? Math.round((teamDone / teamTotal) * 100) : 0;
  const sub = pendingOKRs.length
    ? `${pendingOKRs.length} OKR${pendingOKRs.length === 1 ? '' : 's'} waiting for your review.`
    : `${directReports.length} direct report${directReports.length === 1 ? '' : 's'}, nothing waiting for review.`;

  return (
    <Page>
      <Greeting name={name} sub={sub} />
      <Strip stats={[
        { label: 'Direct reports', value: directReports.length, onClick: () => onNavigate?.('employees') },
        { label: 'OKRs to review', value: pendingOKRs.length, tone: 'warn', onClick: () => onNavigate?.('okrs') },
        { label: 'Team completion', value: `${teamPct}%`, hint: `${teamDone} of ${teamTotal}` },
        { label: 'Team overdue', value: teamOverdue, tone: 'danger' },
        { label: 'My learning', value: s.pending.length, hint: s.pending.length ? 'to finish' : 'all done', onClick: () => onNavigate?.('my-learning') },
      ]} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <Panel title="Team" count={directReports.length} action={{ label: 'Employees', onClick: () => onNavigate?.('employees') }}>
            {directReports.length === 0 ? (
              <Empty icon={Users} text="No one reports to you yet" />
            ) : (
              <>
                <table className="w-full text-[13px] hidden sm:table">
                  <thead>
                    <tr className="text-[11px] text-gray-500 text-left">
                      <th className="font-medium px-3.5 py-1.5">Name</th>
                      <th className="font-medium px-3.5 py-1.5">Learning</th>
                      <th className="font-medium px-3.5 py-1.5 w-20">Overdue</th>
                      <th className="font-medium px-3.5 py-1.5 w-28">OKRs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directReports.map(r => {
                      const pct = r.totalLearning ? Math.round((r.completedLearning / r.totalLearning) * 100) : 0;
                      return (
                        <tr key={r.id} className="border-t border-gray-100">
                          <td className="px-3.5 py-2">
                            <p className="font-medium text-gray-900">{r.full_name}</p>
                            <p className="text-xs text-gray-500">{[r.designation, r.department].filter(Boolean).join(' · ')}</p>
                          </td>
                          <td className="px-3.5 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                              <span className="text-xs text-gray-600">{r.completedLearning}/{r.totalLearning}</span>
                            </div>
                          </td>
                          <td className={`px-3.5 py-2 ${r.overdue ? 'text-red-700 font-medium' : 'text-gray-500'}`}>{r.overdue}</td>
                          <td className="px-3.5 py-2">{r.pendingOKR ? <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">{r.pendingOKR} to review</span> : <span className="text-gray-500">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <ul className="sm:hidden divide-y divide-gray-100">
                  {directReports.map(r => (
                    <li key={r.id} className="px-3.5 py-2.5">
                      <p className="text-[13px] font-medium text-gray-900">{r.full_name}</p>
                      <p className="text-xs text-gray-500">{r.completedLearning}/{r.totalLearning} done{r.overdue ? ` · ${r.overdue} overdue` : ''}{r.pendingOKR ? ` · ${r.pendingOKR} OKR to review` : ''}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title="OKRs waiting for review" count={pendingOKRs.length} action={{ label: 'Team OKRs', onClick: () => onNavigate?.('okrs') }}>
            {pendingOKRs.length === 0 ? (
              <Empty icon={Target} text="Nothing submitted for review" />
            ) : (
              <ul className="divide-y divide-gray-100">
                {pendingOKRs.slice(0, 5).map(o => (
                  <li key={o.id}>
                    <button onClick={() => onNavigate?.('okrs')} className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-gray-900 truncate">{o.title}</span>
                        <span className="block text-xs text-gray-500">{o.employee_name} · {o.period}</span>
                      </span>
                      <span className="text-xs text-gray-600">{o.overall_progress}%</span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="space-y-4 min-w-0">
          {s.inProgress && <ContinueCard item={s.inProgress} onNavigate={onNavigate} />}
          <Panel title="My learning" count={s.pending.length} action={{ label: 'Open', onClick: () => onNavigate?.('my-learning') }}>
            <AssignmentList items={s.pending.slice(0, 4)} onNavigate={onNavigate} emptyText="Nothing waiting for you" />
          </Panel>
          <Announcements messages={messages} unreadCount={unreadCount} markAsRead={markAsRead} onNavigate={onNavigate} limit={3} />
          <QuickLinks resources={pinned} canManage={false} onNavigate={onNavigate} />
        </div>
      </div>
    </Page>
  );
}

function LdDashboard({ orgStats, courseStats, isAdmin, messages, unreadCount, markAsRead, pinned, onNavigate, name }: SharedProps & { orgStats: OrgStats; courseStats: CourseStats; isAdmin: boolean }) {
  const pct = orgStats.total ? Math.round((orgStats.completed / orgStats.total) * 100) : 0;
  const sub = orgStats.total
    ? `${orgStats.learners} learner${orgStats.learners === 1 ? '' : 's'} with assignments · ${pct}% completed${orgStats.overdue ? ` · ${orgStats.overdue} overdue` : ''}.`
    : 'No learning has been assigned yet.';

  return (
    <Page>
      <Greeting name={name} sub={sub} />
      <Strip stats={[
        { label: 'Assignments', value: orgStats.total, hint: `${orgStats.learners} learners`, onClick: () => onNavigate?.('assign-learning') },
        { label: 'Completed', value: orgStats.completed, hint: `${pct}%`, tone: 'ok' },
        { label: 'In progress', value: orgStats.pending },
        { label: 'Overdue', value: orgStats.overdue, tone: 'danger' },
        { label: 'Courses live', value: courseStats.published, hint: courseStats.draft ? `${courseStats.draft} in draft` : undefined, onClick: () => onNavigate?.('course-builder') },
        { label: 'Learning paths', value: courseStats.paths, onClick: () => onNavigate?.('learning-path-builder') },
      ]} />
      <Shortcuts onNavigate={onNavigate} items={[
        { label: 'Course Builder', sub: 'Create and edit content', view: 'course-builder', icon: BookOpen },
        { label: 'Assign Learning', sub: 'To people or roles', view: 'assign-learning', icon: BookMarked },
        { label: 'Access Requests', sub: 'Approve course requests', view: 'course-access-requests', icon: UserCheck },
        { label: 'Announcement', sub: 'Message everyone', view: 'messages', icon: Megaphone },
      ]} />
      <div className="grid lg:grid-cols-2 gap-4 [&>*]:min-w-0">
        <Announcements messages={messages} unreadCount={unreadCount} markAsRead={markAsRead} onNavigate={onNavigate} limit={5} />
        <div className="space-y-4 min-w-0">
          <QuickLinks resources={pinned} canManage onNavigate={onNavigate} />
          {isAdmin && (
            <Shortcuts onNavigate={onNavigate} items={[
              { label: 'Employees', sub: 'Master data', view: 'employees', icon: Users },
              { label: 'User Management', sub: 'Accounts and roles', view: 'user-management', icon: UserCheck },
            ]} />
          )}
        </div>
      </div>
    </Page>
  );
}

function HrDashboard({ orgStats, hrStats, messages, unreadCount, markAsRead, pinned, onNavigate, name }: SharedProps & { orgStats: OrgStats; hrStats: HrStats }) {
  const pct = orgStats.total ? Math.round((orgStats.completed / orgStats.total) * 100) : 0;
  const sub = hrStats.inProcess
    ? `${hrStats.inProcess} candidate${hrStats.inProcess === 1 ? '' : 's'} in process${hrStats.offers ? `, ${hrStats.offers} offer${hrStats.offers === 1 ? '' : 's'} out` : ''}.`
    : `${hrStats.employees} active employee${hrStats.employees === 1 ? '' : 's'} across ${hrStats.departments} department${hrStats.departments === 1 ? '' : 's'}.`;

  return (
    <Page>
      <Greeting name={name} sub={sub} />
      <Strip stats={[
        { label: 'Active employees', value: hrStats.employees, hint: `${hrStats.departments} departments`, onClick: () => onNavigate?.('employees') },
        { label: 'Candidates in process', value: hrStats.inProcess, onClick: () => onNavigate?.('candidates') },
        { label: 'Offers out', value: hrStats.offers, tone: 'warn', onClick: () => onNavigate?.('candidates') },
        { label: 'Joined / accepted', value: hrStats.joined, tone: 'ok', onClick: () => onNavigate?.('candidates') },
        { label: 'Learning completed', value: `${pct}%`, hint: `${orgStats.completed} of ${orgStats.total}` },
        { label: 'Learning overdue', value: orgStats.overdue, tone: 'danger' },
      ]} />
      <Shortcuts onNavigate={onNavigate} items={[
        { label: 'Candidates', sub: 'Recruitment pipeline', view: 'candidates', icon: UserCheck },
        { label: 'Employees', sub: 'Master data', view: 'employees', icon: Users },
        { label: 'Assessment Builder', sub: 'Hiring assessments', view: 'assessments', icon: Award },
        { label: 'Announcement', sub: 'Message everyone', view: 'messages', icon: Megaphone },
      ]} />
      <div className="grid lg:grid-cols-2 gap-4 [&>*]:min-w-0">
        <Announcements messages={messages} unreadCount={unreadCount} markAsRead={markAsRead} onNavigate={onNavigate} limit={5} />
        <QuickLinks resources={pinned} canManage={false} onNavigate={onNavigate} />
      </div>
    </Page>
  );
}

