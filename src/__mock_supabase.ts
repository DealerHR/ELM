// Preview-only stand-in for src/lib/supabase.ts, wired in by vite.preview.config.ts.
// Returns fixture rows per table so screens can be rendered without a backend.
export type UserRole = 'platform_admin' | 'admin' | 'hr' | 'l_d_manager' | 'manager' | 'employee';
export interface UserProfile { id: string; organization_id: string; email: string; full_name: string; phone?: string; avatar_url?: string; role: UserRole; is_active: boolean; must_change_password?: boolean; created_at: string; updated_at: string; }
export const QUIZ_PASS_MARK = 70;

const ORG = 'org-1';
const EMP = 'emp-1';
const course = (id: string, title: string, hours: number, extra: Record<string, unknown> = {}) => ({ id, title, description: null, category: 'Soft skills', type: 'role_specific', delivery_type: 'self_paced', is_assessment: false, duration_hours: hours, organization_id: ORG, status: 'published', ...extra });

const COURSES: Record<string, any> = {
  c1: course('c1', 'Part 1: Why listening matters', 0.5),
  c2: course('c2', 'Part 2: Barriers to listening', 0.5),
  c3: course('c3', 'Part 3: Listening for what is not said', 0.5),
  c4: course('c4', 'Part 4: Asking better questions', 0.5),
  c5: course('c5', 'Part 5: From hearing to professional listening', 0.5),
  c6: course('c6', 'Professional Listening: Final Assessment', 0.5, { is_assessment: true }),
  c7: course('c7', 'Aeris launch: product walkthrough', 2, { delivery_type: 'classroom' }),
};

const in3 = new Date(Date.now() + 3 * 86400000).toISOString();
const in20 = new Date(Date.now() + 20 * 86400000).toISOString();

const FIXTURES: Record<string, any[]> = {
  user_profiles: [{ id: 'user-1', organization_id: ORG, email: 'yash@example.com', full_name: 'Yash Joshi', role: 'employee', is_active: true, created_at: '', updated_at: '' }],
  employees: [{ id: EMP, user_id: 'user-1', organization_id: ORG, employee_code: 'E1', designation_id: 'd1' }],
  employee_learning_assignments: [
    { id: 'a1', employee_id: EMP, course_id: null, learning_path_id: 'p1', status: 'in_progress', due_date: in20, assigned_date: '2026-10-10', learning_courses: null, learning_paths: { id: 'p1', title: 'Professional Listening', description: null } },
    { id: 'a2', employee_id: EMP, course_id: 'c7', learning_path_id: null, status: 'assigned', due_date: null, assigned_date: '2026-10-12', learning_courses: COURSES.c7, learning_paths: null },
    { id: 'a3', employee_id: EMP, course_id: 'c6', learning_path_id: null, status: 'assigned', due_date: in3, assigned_date: '2026-10-12', learning_courses: COURSES.c6, learning_paths: null },
  ],
  learning_path_items: ['c1', 'c2', 'c3', 'c4', 'c5'].map((cid, i) => ({ id: `pi${i + 1}`, path_id: 'p1', course_id: cid, order_index: i + 1, is_mandatory: true, prerequisite_item_id: i === 0 ? null : `pi${i}`, prerequisite_path_id: null, learning_courses: COURSES[cid] })),
  learning_progress: [
    { id: 'pr1', assignment_id: 'a1', employee_id: EMP, course_id: 'c1', module_id: null, status: 'completed', progress_percentage: 100, completed_at: '2026-10-22T10:00:00Z', started_at: '2026-10-21' },
    { id: 'pr2', assignment_id: 'a1', employee_id: EMP, course_id: 'c2', module_id: null, status: 'completed', progress_percentage: 100, completed_at: '2026-10-22T12:00:00Z', started_at: '2026-10-22' },
    { id: 'pr3', assignment_id: 'a1', employee_id: EMP, course_id: 'c3', module_id: null, status: 'in_progress', progress_percentage: 33, completed_at: null, started_at: '2026-10-23' },
    { id: 'pr4', assignment_id: 'a1', employee_id: EMP, course_id: 'c3', module_id: 'm31', status: 'completed', progress_percentage: 100, completed_at: '2026-10-23', started_at: '2026-10-23' },
  ],
  ld_certifications: [],
  learning_modules: [
    ...['c1', 'c2', 'c3', 'c4', 'c5'].flatMap(cid => [1, 2, 3].map(n => ({ id: `m${cid.slice(1)}${n}`, course_id: cid, title: n === 1 ? 'Watch: the scenario' : n === 2 ? 'Read: key ideas' : 'Quick check', content_type: n === 3 ? 'quiz' : n === 1 ? 'video' : 'document', is_mandatory: true, order_index: n, duration_minutes: n === 3 ? 5 : 8, content_url: null, content_file_path: null, content_file_name: null }))),
    ...[1, 2, 3, 4, 5].map(n => ({ id: `m7${n}`, course_id: 'c7', title: `Session ${n}`, content_type: 'presentation', is_mandatory: true, order_index: n, duration_minutes: 24, content_url: null, content_file_path: null, content_file_name: null })),
  ],
  induction_journeys: [],
  org_messages: [],
  message_reads: [],
  pinned_resources: [],
};

const PROFILE: UserProfile = { id: 'user-1', organization_id: ORG, email: 'yash@example.com', full_name: 'Yash Joshi', role: 'employee', is_active: true, created_at: '', updated_at: '' };

function builder(table: string) {
  let rows = [...(FIXTURES[table] || [])];
  let single = false;
  const b: any = {
    select() { return b; },
    eq(col: string, val: unknown) { rows = rows.filter(r => r[col] === val || col.includes('.')); return b; },
    in(col: string, vals: unknown[]) { rows = rows.filter(r => vals.includes(r[col])); return b; },
    or() { return b; }, not() { return b; }, order() { return b; }, limit() { return b; }, gte() { return b; }, lte() { return b; },
    maybeSingle() { single = true; return b; },
    single() { single = true; return b; },
    insert() { rows = []; return b; }, update() { rows = []; return b; }, upsert() { rows = []; return b; }, delete() { rows = []; return b; },
    then(res: (v: any) => void) { res({ data: single ? (rows[0] ?? null) : rows, error: null }); },
  };
  return b;
}

export const supabase: any = {
  from: builder,
  rpc: async () => ({ data: true, error: null }),
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'user-1', email: PROFILE.email } } } }),
    getUser: async () => ({ data: { user: { id: 'user-1', email: PROFILE.email } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
};

export const __mockProfile = PROFILE;
