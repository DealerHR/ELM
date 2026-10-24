import { supabase } from './supabase';

export interface QueueItem {
  id: string;
  title: string;
  detail: string;
  when?: string;
  tone: 'danger' | 'warn' | 'ok';
  action: { label: string; view: string };
}

interface UserProfile {
  id: string;
  role: string;
  organization_id: string | null;
  full_name?: string;
}

interface LoadParams {
  profile: UserProfile;
  learnerMode: boolean;
  employeeId: string | null;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
}

function dueText(due: string | null): string | undefined {
  if (!due) return undefined;
  const d = daysUntil(due);
  if (d < 0) return `${-d}d overdue`;
  if (d === 0) return 'today';
  if (d <= 7) return `in ${d}d`;
  return new Date(due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export async function loadWorkQueue({ profile, learnerMode, employeeId }: LoadParams): Promise<QueueItem[]> {
  const role = profile.role;
  const items: QueueItem[] = [];

  if (employeeId) {
    const { data: assigns } = await supabase
      .from('employee_learning_assignments')
      .select('id, due_date, status, learning_courses(title), learning_paths(title)')
      .eq('employee_id', employeeId)
      .neq('status', 'completed');

    for (const a of (assigns || []) as any[]) {
      const title = a.learning_courses?.title || a.learning_paths?.title || 'Assignment';
      const due = a.due_date as string | null;
      const d = due ? daysUntil(due) : null;
      if (d !== null && d < 0) {
        items.push({
          id: `overdue-${a.id}`,
          title,
          detail: 'Overdue assignment',
          when: dueText(due),
          tone: 'danger',
          action: { label: 'Open', view: 'my-learning' },
        });
      } else if (d !== null && d <= 3) {
        items.push({
          id: `due-${a.id}`,
          title,
          detail: 'Due soon',
          when: dueText(due),
          tone: 'warn',
          action: { label: 'Open', view: 'my-learning' },
        });
      }
    }
  }

  if (!learnerMode && employeeId && (role === 'manager' || role === 'admin' || role === 'hr' || role === 'l_d_manager' || role === 'platform_admin')) {
    const { data: reports } = await supabase
      .from('employees')
      .select('id')
      .eq('reporting_manager_id', employeeId);

    if (reports?.length) {
      const reportIds = reports.map(r => r.id);
      const { data: draftOkrs } = await supabase
        .from('okrs')
        .select('id, employee_id, title')
        .in('employee_id', reportIds)
        .eq('status', 'draft');

      for (const o of (draftOkrs || []) as any[]) {
        items.push({
          id: `okr-draft-${o.id}`,
          title: o.title || 'Draft OKR',
          detail: 'Waiting for you to set',
          tone: 'warn',
          action: { label: 'Open', view: 'okrs' },
        });
      }
    }
  }

  if (!learnerMode && (role === 'l_d_manager' || role === 'admin' || role === 'platform_admin') && profile.organization_id) {
    const { data: reqs } = await supabase
      .from('course_access_requests')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'pending');

    if (reqs?.length) {
      items.push({
        id: 'access-requests',
        title: `${reqs.length} course access request${reqs.length === 1 ? '' : 's'}`,
        detail: 'Awaiting approval',
        tone: 'warn',
        action: { label: 'Review', view: 'course-access-requests' },
      });
    }
  }

  if (!learnerMode && role === 'hr' && profile.organization_id) {
    const { data: cands } = await supabase
      .from('candidates')
      .select('id, status, full_name')
      .eq('organization_id', profile.organization_id)
      .in('status', ['interview_scheduled', 'offer_extended']);

    for (const c of (cands || []) as any[]) {
      if (c.status === 'offer_extended') {
        items.push({
          id: `cand-offer-${c.id}`,
          title: c.full_name || 'Candidate',
          detail: 'Offer extended — awaiting response',
          tone: 'warn',
          action: { label: 'Open', view: 'candidates' },
        });
      } else if (c.status === 'interview_scheduled') {
        items.push({
          id: `cand-interview-${c.id}`,
          title: c.full_name || 'Candidate',
          detail: 'Interview scheduled',
          tone: 'ok',
          action: { label: 'Open', view: 'candidates' },
        });
      }
    }
  }

  return items.sort((a, b) => {
    const order = { danger: 0, warn: 1, ok: 2 };
    return order[a.tone] - order[b.tone];
  });
}
