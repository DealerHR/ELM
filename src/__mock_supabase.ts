// Preview-only stand-in for src/lib/supabase.ts, wired in by vite.preview.config.ts.
// Returns fixture rows per table so screens can be rendered without a backend.
export type UserRole = 'platform_admin' | 'admin' | 'hr' | 'l_d_manager' | 'manager' | 'employee';
export interface UserProfile { id: string; organization_id: string; email: string; full_name: string; phone?: string; avatar_url?: string; role: UserRole; is_active: boolean; must_change_password?: boolean; created_at: string; updated_at: string; }
export const QUIZ_PASS_MARK = 70;

const ORG = 'org-1';
const ROLE = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('role')) || 'employee';
const EMP = 'emp-1';
const LONG = 'Listening is the most under-trained skill on a sales floor. This course walks through why customers stop talking, how to notice it, and the three habits that keep a conversation open. It is built for showroom executives and team leads and is best taken before the final assessment. Each part ends with a short quiz; all three must be passed to finish.';
const course = (id: string, title: string, hours: number, extra: Record<string, unknown> = {}) => ({ id, title, description: id === 'c1' ? LONG : null, skill_ids: id === 'c1' ? ['s1', 's2'] : [], category: 'Soft skills', type: 'role_specific', delivery_type: 'self_paced', is_assessment: false, duration_hours: hours, organization_id: ORG, status: 'published', ...extra });

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
  user_profiles: [
    { id: 'user-1', organization_id: ORG, email: 'yash@example.com', full_name: 'Yash Joshi', role: ROLE, is_active: true, created_at: '', updated_at: '' },
    { id: 'user-2', organization_id: ORG, email: 'a@example.com', full_name: 'Anita Rao', role: 'employee', is_active: true, created_at: '', updated_at: '' },
    { id: 'user-3', organization_id: ORG, email: 'r@example.com', full_name: 'Rahul Mehta', role: 'employee', is_active: true, created_at: '', updated_at: '' },
    { id: 'user-4', organization_id: ORG, email: 'p@example.com', full_name: 'Priya Nair', role: 'employee', is_active: true, created_at: '', updated_at: '' },
    { id: 'user-5', organization_id: ORG, email: 's@example.com', full_name: 'Sunil Verma', role: 'employee', is_active: false, created_at: '', updated_at: '' },
    { id: 'user-6', organization_id: ORG, email: 'admin@example.com', full_name: 'Org Admin', role: 'admin', is_active: true, created_at: '', updated_at: '' },
  ],
  employees: [
    { id: EMP, user_id: 'user-1', organization_id: ORG, employee_code: 'E1', designation_id: 'd1', status: 'active', lifecycle_stage: 'active', date_of_joining: '2024-03-01', employment_type: 'full_time', designations: { title: 'Showroom Manager' }, departments: { name: 'Sales' } },
    { id: 'emp-2', user_id: 'user-2', organization_id: ORG, employee_code: 'E2', status: 'active', lifecycle_stage: 'active', date_of_joining: '2025-06-10', employment_type: 'full_time', department_id: 'd1', reporting_manager_id: EMP, departments: { name: 'Sales' }, designations: { title: 'Sales Executive' } },
    { id: 'emp-3', user_id: 'user-3', organization_id: ORG, employee_code: 'E3', status: 'active', lifecycle_stage: 'induction', date_of_joining: '2026-10-13', employment_type: 'full_time', department_id: 'd1', reporting_manager_id: EMP, departments: { name: 'Sales' }, designations: { title: 'Team Lead' } },
    { id: 'emp-4', user_id: 'user-4', organization_id: ORG, employee_code: 'E4', status: 'active', lifecycle_stage: 'joining', date_of_joining: '2026-11-03', employment_type: 'full_time', department_id: 'd2', reporting_manager_id: EMP, departments: { name: 'Service' }, designations: { title: 'Service Advisor' } },
    { id: 'emp-5', user_id: 'user-5', organization_id: ORG, employee_code: 'E5', status: 'resigned', lifecycle_stage: 'exited', date_of_joining: '2023-01-09', date_of_leaving: '2026-09-30', employment_type: 'full_time', department_id: 'd1', departments: { name: 'Sales' }, designations: { title: 'Sales Executive' } },
  ],
  employee_learning_assignments: [
    { id: 'a1', employee_id: EMP, course_id: null, learning_path_id: 'p1', status: 'in_progress', due_date: in20, assigned_date: '2026-10-10', learning_courses: null, learning_paths: { id: 'p1', title: 'Professional Listening', description: null } },
    { id: 'a2', employee_id: EMP, course_id: 'c7', learning_path_id: null, status: 'assigned', due_date: null, assigned_date: '2026-10-12', learning_courses: COURSES.c7, learning_paths: null },
    { id: 'a4', employee_id: 'emp-2', course_id: 'c1', learning_path_id: null, status: 'completed', due_date: '2026-10-01', assigned_date: '2026-09-12', learning_courses: COURSES.c1, learning_paths: null },
    { id: 'a5', employee_id: 'emp-2', course_id: 'c7', learning_path_id: null, status: 'assigned', due_date: '2026-10-01', assigned_date: '2026-09-12', learning_courses: COURSES.c7, learning_paths: null },
    { id: 'a6', employee_id: 'emp-3', course_id: 'c6', learning_path_id: null, status: 'in_progress', due_date: in20, assigned_date: '2026-10-12', learning_courses: COURSES.c6, learning_paths: null },
    { id: 'a3', employee_id: EMP, course_id: 'c6', learning_path_id: null, status: 'assigned', due_date: in3, assigned_date: '2026-10-12', learning_courses: COURSES.c6, learning_paths: null },
  ],
  learning_path_items: ['c1', 'c2', 'c3', 'c4', 'c5'].map((cid, i) => ({ id: `pi${i + 1}`, path_id: 'p1', course_id: cid, order_index: i + 1, is_mandatory: true, prerequisite_item_id: i === 0 ? null : `pi${i}`, prerequisite_path_id: null, learning_courses: COURSES[cid], learning_paths: { title: 'Professional Listening' } })),
  learning_progress: [
    { id: 'pr1', assignment_id: 'a1', employee_id: EMP, course_id: 'c1', module_id: null, status: 'completed', progress_percentage: 100, completed_at: '2026-10-22T10:00:00Z', started_at: '2026-10-21' },
    { id: 'pr2', assignment_id: 'a1', employee_id: EMP, course_id: 'c2', module_id: null, status: 'completed', progress_percentage: 100, completed_at: '2026-10-22T12:00:00Z', started_at: '2026-10-22' },
    { id: 'pr3', assignment_id: 'a1', employee_id: EMP, course_id: 'c3', module_id: null, status: 'in_progress', progress_percentage: 33, completed_at: null, started_at: '2026-10-23' },
    { id: 'pr5', assignment_id: 'a9', employee_id: 'emp-2', course_id: 'c1', module_id: null, status: 'completed', progress_percentage: 100, completed_at: '2026-10-20', started_at: '2026-10-19' },
    { id: 'pr4', assignment_id: 'a1', employee_id: EMP, course_id: 'c3', module_id: 'm31', status: 'completed', progress_percentage: 100, completed_at: '2026-10-23', started_at: '2026-10-23' },
  ],
  ld_certifications: [],
  learning_paths: [{ id: 'p1', title: 'Professional Listening', organization_id: ORG }],
  departments: [{ id: 'd1', organization_id: ORG, name: 'Sales' }, { id: 'd2', organization_id: ORG, name: 'Service' }],
  designations: [{ id: 'd1', organization_id: ORG, title: 'Showroom Manager' }, { id: 'd2', organization_id: ORG, title: 'Sales Executive' }],
  candidates: [{ status: 'applied', organization_id: ORG }, { status: 'interviewed', organization_id: ORG }, { status: 'offer_extended', organization_id: ORG }, { status: 'joined', organization_id: ORG }, { status: 'rejected', organization_id: ORG }],
  okrs: [{ id: 'o1', employee_id: 'emp-2', title: 'Grow test-drive conversions to 35%', period: 'Q3 FY27', overall_progress: 60, status: 'submitted' }],
  learning_courses: [...Object.values(COURSES), course('c8', 'Showroom etiquette (draft)', 1, { status: 'draft' }), course('c9', 'Old CRM walkthrough', 1, { status: 'archived' })],
  skills: [{ id: 's1', name: 'Active listening', organization_id: ORG }, { id: 's2', name: 'Questioning', organization_id: ORG }],
  learning_modules: [
    ...['c1', 'c2', 'c3', 'c4', 'c5'].flatMap(cid => [1, 2, 3].map(n => ({ id: `m${cid.slice(1)}${n}`, course_id: cid, title: n === 1 ? 'Watch: the scenario' : n === 2 ? 'Read: key ideas' : 'Quick check', content_type: n === 3 ? 'quiz' : n === 1 ? 'video' : 'document', description: n === 2 ? 'Three-page summary of the key ideas' : null, is_mandatory: n !== 2, order_index: n, duration_minutes: n === 3 ? 5 : 8, content_url: n === 1 ? 'https://youtu.be/abc123' : null, content_file_path: null, content_file_name: n === 2 ? 'key-ideas.pptx' : null }))),
    ...[1, 2, 3, 4, 5].map(n => ({ id: `m7${n}`, course_id: 'c7', title: `Session ${n}`, content_type: 'presentation', is_mandatory: true, order_index: n, duration_minutes: 24, content_url: null, content_file_path: null, content_file_name: null })),
  ],
  induction_journeys: [
    { id: 'ij1', employee_id: 'emp-3', template_id: 'it1', start_date: '2026-10-13', expected_end_date: '2027-01-11', actual_end_date: null, status: 'in_progress', completion_percentage: 35, probation_end_date: '2027-01-11', notes: null, employees: { id: 'emp-3', user_id: 'user-3', employee_code: 'E3', organization_id: ORG, designations: { title: 'Team Lead' }, departments: { name: 'Sales' } }, induction_templates: { title: 'Sales floor induction', learning_path_id: 'p1', learning_paths: { title: 'Professional Listening' }, description: 'Your first 90 days on the showroom floor: documents, systems, shadowing, then your first solo customers.', designations: { title: 'Sales Executive' } } },
    { id: 'ij2', employee_id: 'emp-4', template_id: 'it1', start_date: '2026-11-03', expected_end_date: '2027-02-01', actual_end_date: null, status: 'not_started', completion_percentage: 0, probation_end_date: '2027-02-01', notes: null, employees: { id: 'emp-4', user_id: 'user-4', employee_code: 'E4', organization_id: ORG, designations: { title: 'Service Advisor' }, departments: { name: 'Service' } }, induction_templates: { title: 'Sales floor induction', learning_path_id: 'p1', learning_paths: { title: 'Professional Listening' } } },
  ],
  induction_templates: [
    { id: 'it1', organization_id: ORG, title: 'Sales floor induction', designation_id: 'd2', duration_days: 90, learning_path_id: 'p1', description: 'Your first 90 days on the showroom floor.', is_active: true, designations: { title: 'Sales Executive' }, learning_paths: { title: 'Professional Listening' } },
    { id: 'it2', organization_id: ORG, title: 'General induction', designation_id: null, duration_days: 30, learning_path_id: null, description: null, is_active: true, designations: null, learning_paths: null },
  ],
  induction_template_tasks: [
    { id: 'tt1', template_id: 'it1', title: 'Submit ID and bank documents', description: null, owner: 'employee', due_day: 2, is_required: true, order_index: 1 },
    { id: 'tt2', template_id: 'it1', title: 'Meet your manager', description: null, owner: 'manager', due_day: 1, is_required: true, order_index: 2 },
    { id: 'tt3', template_id: 'it1', title: 'Shadow a senior executive for a day', description: null, owner: 'employee', due_day: 5, is_required: true, order_index: 3 },
    { id: 'tt4', template_id: 'it1', title: 'DMS and CRM access set up', description: null, owner: 'hr', due_day: 1, is_required: true, order_index: 4 },
    { id: 'tt5', template_id: 'it1', title: 'Team lunch', description: null, owner: 'hr', due_day: 14, is_required: false, order_index: 5 },
  ],
  induction_tasks: [
    { id: 'k1', journey_id: 'ij1', title: 'Submit ID and bank documents', description: 'Aadhaar, PAN, cancelled cheque', owner: 'employee', due_date: '2026-10-15', is_required: true, order_index: 1, status: 'done', completed_at: '2026-10-14', notes: null },
    { id: 'k2', journey_id: 'ij1', title: 'Meet your manager', description: null, owner: 'manager', due_date: '2026-10-14', is_required: true, order_index: 2, status: 'done', completed_at: '2026-10-13', notes: null },
    { id: 'k3', journey_id: 'ij1', title: 'Shadow a senior executive for a day', description: 'Ask Anita; pick a weekday', owner: 'employee', due_date: '2026-10-18', is_required: true, order_index: 3, status: 'pending', completed_at: null, notes: null },
    { id: 'k4', journey_id: 'ij1', title: 'DMS and CRM access set up', description: null, owner: 'hr', due_date: '2026-10-14', is_required: true, order_index: 4, status: 'pending', completed_at: null, notes: null },
    { id: 'k5', journey_id: 'ij1', title: 'Team lunch', description: null, owner: 'hr', due_date: '2026-10-27', is_required: false, order_index: 5, status: 'pending', completed_at: null, notes: null },
    { id: 'k6', journey_id: 'ij1', title: 'Complete your first solo customer handover', description: null, owner: 'employee', due_date: '2026-11-30', is_required: true, order_index: 6, status: 'pending', completed_at: null, notes: null },
  ],
  org_messages: [
    { id: 'msg1', title: 'Aeris launch training: 28 Oct, 9 am', body: 'All showroom staff to attend. Session at the Andheri training room.', priority: 'high', expires_at: null, created_at: '2026-10-22T09:00:00Z', sender_id: 'user-1', organization_id: ORG },
    { id: 'msg2', title: 'New quick links added', body: 'Product brochures and the price list are now pinned on your dashboard.', priority: 'normal', expires_at: null, created_at: '2026-10-20T09:00:00Z', sender_id: 'user-1', organization_id: ORG },
  ],
  message_reads: [],
  pinned_resources: [{ id: 'pr1', title: 'Aeris brochure', url: 'https://example.com', description: 'PDF, 12 pages', icon: 'book', organization_id: ORG, sort_order: 1 }, { id: 'pr2', title: 'Price list Oct 2026', url: 'https://example.com', icon: 'link', organization_id: ORG, sort_order: 2 }],
};

if (ROLE === 'employee') { FIXTURES.induction_journeys[0] = { ...FIXTURES.induction_journeys[0], employee_id: EMP }; }

const PROFILE: UserProfile = { id: 'user-1', organization_id: ORG, email: 'yash@example.com', full_name: 'Yash Joshi', role: ROLE as UserRole, is_active: true, created_at: '', updated_at: '' };

function builder(table: string) {
  let rows = [...(FIXTURES[table] || [])];
  let single = false;
  const b: any = {
    select() { return b; },
    eq(col: string, val: unknown) { rows = rows.filter(r => r[col] === val || col.includes('.')); return b; },
    in(col: string, vals: unknown[]) { rows = rows.filter(r => vals.includes(r[col])); return b; },
    is(col: string, val: unknown) { rows = rows.filter(r => (r[col] ?? null) === val); return b; },
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
