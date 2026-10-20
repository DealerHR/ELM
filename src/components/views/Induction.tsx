import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, Plus, BookOpen, Clock, CheckCircle2, Circle, Lock,
  Calendar, ChevronRight, Users, ArrowRight, AlertCircle, RefreshCw,
  BarChart2, Award, Layers, FileText, CheckCircle, XCircle, Search
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  user_id: string;
  employee_code: string;
  designation_id: string | null;
  date_of_joining: string;
  user_profiles: { full_name: string; email: string };
  designations: { title: string } | null;
}

interface InductionTemplate {
  id: string;
  organization_id: string;
  designation_id: string;
  duration_days: number;
  learning_path_id: string | null;
  description: string;
  is_active: boolean;
  designations: { title: string } | null;
  learning_paths: { id: string; title: string; description: string } | null;
}

interface InductionJourney {
  id: string;
  employee_id: string;
  template_id: string;
  start_date: string;
  expected_end_date: string;
  actual_end_date: string | null;
  status: string;
  completion_percentage: number;
  induction_templates: InductionTemplate | null;
  employees?: { user_profiles: { full_name: string } };
}

interface PathItem {
  id: string;
  path_id: string;
  course_id: string;
  order_index: number;
  is_mandatory: boolean;
  prerequisite_item_id: string | null;
  learning_courses: { id: string; title: string; description: string; duration_hours: number; type: string } | null;
}

interface CourseProgress {
  id: string;
  assignment_id: string;
  module_id: string | null;
  employee_id: string;
  course_id: string;
  started_at: string | null;
  completed_at: string | null;
  progress_percentage: number;
  status: string;
}

interface LearningAssignment {
  id: string;
  employee_id: string;
  course_id: string | null;
  learning_path_id: string | null;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    extended: 'bg-amber-100 text-amber-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

function daysRemaining(expected: string) {
  const diff = Math.ceil((new Date(expected).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, cls: 'text-red-600' };
  if (diff === 0) return { label: 'Due today', cls: 'text-amber-600' };
  return { label: `${diff}d left`, cls: 'text-gray-500' };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e3a5f" strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        className="rotate-90" style={{ transform: `rotate(90deg) translate(0, -${size / 2 * 0}px)` }}
        fill="#1e293b" fontSize={size / 4} fontWeight="700">
      </text>
    </svg>
  );
}

// ─── Employee Journey View ────────────────────────────────────────────────────

function EmployeeJourneyView() {
  const { userProfile } = useAuth();
  const [journey, setJourney] = useState<InductionJourney | null>(null);
  const [pathItems, setPathItems] = useState<PathItem[]>([]);
  const [assignment, setAssignment] = useState<LearningAssignment | null>(null);
  const [progress, setProgress] = useState<Record<string, CourseProgress>>({});
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userProfile!.id)
        .maybeSingle();

      if (!emp) { setLoading(false); return; }
      setEmployeeId(emp.id);

      const { data: jData } = await supabase
        .from('induction_journeys')
        .select(`*, induction_templates(*, designations(title), learning_paths(id, title, description))`)
        .eq('employee_id', emp.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!jData) { setLoading(false); return; }
      setJourney(jData as InductionJourney);

      const pathId = (jData as InductionJourney).induction_templates?.learning_path_id;
      if (!pathId) { setLoading(false); return; }

      const { data: items } = await supabase
        .from('learning_path_items')
        .select('*, learning_courses(id, title, description, duration_hours, type)')
        .eq('path_id', pathId)
        .order('order_index');

      setPathItems((items as PathItem[]) || []);

      const { data: asgn } = await supabase
        .from('employee_learning_assignments')
        .select('*')
        .eq('employee_id', emp.id)
        .eq('learning_path_id', pathId)
        .maybeSingle();

      setAssignment(asgn as LearningAssignment | null);

      if (asgn) {
        const { data: prog } = await supabase
          .from('learning_progress')
          .select('*')
          .eq('assignment_id', asgn.id)
          .eq('employee_id', emp.id);

        const map: Record<string, CourseProgress> = {};
        (prog || []).forEach((p: any) => { if (p.course_id) map[p.course_id] = p; });
        setProgress(map);
      }
    } catch (e: any) {
      setError('Failed to load your induction journey. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => { load(); }, [load]);

  const handleStart = async (courseId: string) => {
    if (!employeeId || !assignment) return;
    setSaving(courseId);
    try {
      const { data, error } = await supabase
        .from('learning_progress')
        .insert({
          assignment_id: assignment.id,
          employee_id: employeeId,
          course_id: courseId,
          module_id: null,
          started_at: new Date().toISOString(),
          progress_percentage: 0,
          status: 'in_progress',
          attempts: 1,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('employee_learning_assignments')
        .update({ status: 'in_progress' })
        .eq('id', assignment.id);

      setProgress(p => ({ ...p, [courseId]: data as CourseProgress }));
    } catch (e: any) {
      setError('Could not start course: ' + e.message);
    } finally {
      setSaving(null);
    }
  };

  const handleComplete = async (courseId: string) => {
    if (!employeeId || !assignment) return;
    setSaving(courseId);
    try {
      const prog = progress[courseId];
      if (!prog) return;

      await supabase
        .from('learning_progress')
        .update({ status: 'completed', progress_percentage: 100, completed_at: new Date().toISOString() })
        .eq('id', prog.id);

      const updated = { ...progress, [courseId]: { ...prog, status: 'completed', progress_percentage: 100 } };
      setProgress(updated);

      const total = pathItems.length;
      const done = pathItems.filter(it => updated[it.course_id]?.status === 'completed').length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const allDone = pct === 100;

      await supabase
        .from('induction_journeys')
        .update({
          completion_percentage: pct,
          status: allDone ? 'completed' : 'in_progress',
          actual_end_date: allDone ? new Date().toISOString().split('T')[0] : null,
        })
        .eq('id', journey!.id);

      if (allDone) {
        await supabase
          .from('employee_learning_assignments')
          .update({ status: 'completed' })
          .eq('id', assignment.id);
      }

      setJourney(j => j ? { ...j, completion_percentage: pct, status: allDone ? 'completed' : 'in_progress' } : j);
    } catch (e: any) {
      setError('Could not mark course complete: ' + e.message);
    } finally {
      setSaving(null);
    }
  };

  const isUnlocked = (item: PathItem): boolean => {
    if (!item.prerequisite_item_id) return true;
    const prereq = pathItems.find(p => p.id === item.prerequisite_item_id);
    if (!prereq) return true;
    return progress[prereq.course_id]?.status === 'completed';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <GraduationCap className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No induction journey assigned</h3>
        <p className="text-sm text-gray-500 max-w-xs">Your HR team will assign your onboarding journey. Check back soon.</p>
      </div>
    );
  }

  const template = journey.induction_templates;
  const dayInfo = daysRemaining(journey.expected_end_date);
  const completedCount = pathItems.filter(it => progress[it.course_id]?.status === 'completed').length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {/* Journey Header */}
      <div className="bg-gradient-to-br from-blue-950 to-blue-900 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-1">Your Induction</p>
            <h2 className="text-xl font-bold mb-1">{template?.designations?.title} Onboarding</h2>
            {template?.description && <p className="text-blue-200 text-sm">{template.description}</p>}
            <div className="flex items-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-1.5 text-blue-200">
                <Calendar className="w-3.5 h-3.5" />
                <span>Started {new Date(journey.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className={`flex items-center gap-1.5 font-medium ${journey.status === 'completed' ? 'text-emerald-300' : dayInfo.cls.replace('text-', 'text-')}`}>
                <Clock className="w-3.5 h-3.5" />
                {journey.status === 'completed' ? 'Completed' : dayInfo.label}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 text-center">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="#facc15" strokeWidth="6"
                  strokeDasharray={`${(journey.completion_percentage / 100) * 213.6} 213.6`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{journey.completion_percentage}%</span>
              </div>
            </div>
            <p className="text-blue-300 text-xs mt-1">{completedCount}/{pathItems.length} courses</p>
          </div>
        </div>
      </div>

      {/* Learning Path */}
      {template?.learning_paths && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-blue-950" />
            <h3 className="text-sm font-bold text-gray-900">{template.learning_paths.title}</h3>
          </div>

          {pathItems.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
              <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No courses in this learning path yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pathItems.map((item, idx) => {
                const course = item.learning_courses;
                const prog = progress[item.course_id];
                const courseStatus = prog?.status || 'not_started';
                const unlocked = isUnlocked(item);
                const isSaving = saving === item.course_id;

                return (
                  <div key={item.id}
                    className={`rounded-xl border-2 transition-all ${
                      courseStatus === 'completed' ? 'border-emerald-200 bg-emerald-50'
                      : courseStatus === 'in_progress' ? 'border-blue-200 bg-blue-50'
                      : unlocked ? 'border-gray-200 bg-white hover:border-gray-300'
                      : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-4 p-4">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        courseStatus === 'completed' ? 'bg-emerald-500' : courseStatus === 'in_progress' ? 'bg-blue-600' : unlocked ? 'bg-gray-200' : 'bg-gray-200'
                      }`}>
                        {courseStatus === 'completed' ? <CheckCircle2 className="w-5 h-5 text-white" />
                          : courseStatus === 'in_progress' ? <Circle className="w-5 h-5 text-white fill-white" />
                          : unlocked ? <span className="text-xs font-bold text-gray-500">{idx + 1}</span>
                          : <Lock className="w-4 h-4 text-gray-400" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-gray-400 font-medium">Step {idx + 1}</span>
                          {item.is_mandatory && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">Required</span>
                          )}
                          {course?.type && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded capitalize">{course.type.replace(/_/g, ' ')}</span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900">{course?.title || 'Course'}</h4>
                        {course?.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{course.description}</p>}
                        {course?.duration_hours && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {course.duration_hours}h
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        {courseStatus === 'not_started' && unlocked && (
                          <button onClick={() => handleStart(item.course_id)} disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white text-xs font-semibold rounded-lg hover:bg-blue-900 transition disabled:opacity-50">
                            {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                            Start
                          </button>
                        )}
                        {courseStatus === 'in_progress' && (
                          <button onClick={() => handleComplete(item.course_id)} disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
                            {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Mark Complete
                          </button>
                        )}
                        {courseStatus === 'completed' && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle className="w-3.5 h-3.5" /> Done
                          </span>
                        )}
                        {!unlocked && courseStatus === 'not_started' && (
                          <span className="text-xs text-gray-400 text-right max-w-24">Complete previous course first</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {journey.status === 'completed' && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <Award className="w-8 h-8 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-900">Induction Complete!</p>
            <p className="text-xs text-emerald-700 mt-0.5">You've completed your onboarding journey. Head to My Learning to continue your development.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HR: Assign Induction to Employee ────────────────────────────────────────

function AssignInductionView() {
  const { userProfile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<InductionTemplate[]>([]);
  const [journeys, setJourneys] = useState<InductionJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState({ template_id: '', start_date: new Date().toISOString().split('T')[0] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, tplRes, jRes] = await Promise.all([
        supabase.from('employees').select('id, user_id, employee_code, designation_id, date_of_joining, user_profiles(full_name, email), designations(title)')
          .eq('organization_id', userProfile!.organization_id).eq('status', 'active').order('date_of_joining', { ascending: false }),
        supabase.from('induction_templates').select('*, designations(title), learning_paths(id, title, description)')
          .eq('organization_id', userProfile!.organization_id).eq('is_active', true),
        supabase.from('induction_journeys').select('*, induction_templates(*, designations(title)), employees(user_profiles(full_name))')
          .eq('induction_templates.organization_id' as any, userProfile!.organization_id),
      ]);
      setEmployees((empRes.data as any) || []);
      setTemplates((tplRes.data as any) || []);
      setJourneys((jRes.data as any) || []);
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => { load(); }, [load]);

  const getJourneyForEmployee = (empId: string) => journeys.find(j => j.employee_id === empId);

  const openAssign = (emp: Employee) => {
    const matching = templates.filter(t => t.designation_id === emp.designation_id);
    setSelectedEmployee(emp);
    setForm({ template_id: matching[0]?.id || '', start_date: new Date().toISOString().split('T')[0] });
    setShowAssignModal(true);
    setError('');
  };

  const handleAssign = async () => {
    if (!selectedEmployee || !form.template_id) { setError('Please select a template.'); return; }
    setSaving(true);
    setError('');
    try {
      const template = templates.find(t => t.id === form.template_id)!;
      const start = new Date(form.start_date);
      const end = new Date(start);
      end.setDate(end.getDate() + template.duration_days);

      const { data: journey, error: jErr } = await supabase
        .from('induction_journeys')
        .insert({
          employee_id: selectedEmployee.id,
          template_id: form.template_id,
          start_date: form.start_date,
          expected_end_date: end.toISOString().split('T')[0],
          status: 'in_progress',
          completion_percentage: 0,
        })
        .select()
        .single();

      if (jErr) throw jErr;

      if (template.learning_path_id) {
        await supabase.from('employee_learning_assignments').insert({
          employee_id: selectedEmployee.id,
          learning_path_id: template.learning_path_id,
          assigned_by: userProfile!.id,
          assigned_date: form.start_date,
          due_date: end.toISOString().split('T')[0],
          status: 'assigned',
        });
      }

      setSuccess(`Induction assigned to ${selectedEmployee.user_profiles.full_name}.`);
      setShowAssignModal(false);
      load();
    } catch (e: any) {
      setError('Failed to assign: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = employees.filter(e =>
    e.user_profiles.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_code.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      {success && <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700"><CheckCircle className="w-4 h-4 flex-shrink-0" />{success}<button onClick={() => setSuccess('')} className="ml-auto"><XCircle className="w-4 h-4" /></button></div>}

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-950/20" />
      </div>

      <div className="space-y-2">
        {filtered.map(emp => {
          const journey = getJourneyForEmployee(emp.id);
          return (
            <div key={emp.id} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition">
              <div className="w-10 h-10 rounded-full bg-blue-950 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {emp.user_profiles.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{emp.user_profiles.full_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">{emp.employee_code}</span>
                  {emp.designations && <span className="text-xs text-gray-500">· {emp.designations.title}</span>}
                  <span className="text-xs text-gray-400">· Joined {new Date(emp.date_of_joining).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {journey ? (
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadge(journey.status)}`}>
                      {journey.status.replace('_', ' ')}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">{journey.completion_percentage}% complete</p>
                  </div>
                ) : (
                  <button onClick={() => openAssign(emp)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white text-xs font-semibold rounded-lg hover:bg-blue-900 transition">
                    <Plus className="w-3 h-3" /> Assign Induction
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-500">No employees found.</div>
        )}
      </div>

      {showAssignModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Assign Induction</h3>
            <p className="text-sm text-gray-500 mb-5">
              Assigning to <span className="font-semibold text-gray-800">{selectedEmployee.user_profiles.full_name}</span>
              {selectedEmployee.designations && ` · ${selectedEmployee.designations.title}`}
            </p>

            {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg mb-4">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Induction Template</label>
                <select value={form.template_id} onChange={e => setForm(f => ({ ...f, template_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-950/20">
                  <option value="">Select template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.designations?.title} — {t.duration_days}d {t.learning_paths ? `(${t.learning_paths.title})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-950/20" />
              </div>
              {form.template_id && (() => {
                const t = templates.find(t => t.id === form.template_id);
                return t ? (
                  <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-800 space-y-1">
                    <p className="font-semibold">{t.duration_days}-day induction</p>
                    {t.description && <p>{t.description}</p>}
                    {t.learning_paths && <p className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{t.learning_paths.title}</p>}
                  </div>
                ) : null;
              })()}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleAssign} disabled={saving || !form.template_id}
                className="flex-1 px-4 py-2.5 bg-blue-950 text-white rounded-xl text-sm font-semibold hover:bg-blue-900 transition disabled:opacity-50">
                {saving ? 'Assigning...' : 'Assign Induction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── L&D: Manage Templates ────────────────────────────────────────────────────

function TemplatesView() {
  const { userProfile } = useAuth();
  const [templates, setTemplates] = useState<InductionTemplate[]>([]);
  const [designations, setDesignations] = useState<{ id: string; title: string }[]>([]);
  const [learningPaths, setLearningPaths] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InductionTemplate | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ designation_id: '', duration_days: 90, learning_path_id: '', description: '', is_active: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, dRes, lRes] = await Promise.all([
        supabase.from('induction_templates').select('*, designations(title), learning_paths(id, title, description)')
          .eq('organization_id', userProfile!.organization_id).order('created_at', { ascending: false }),
        supabase.from('designations').select('id, title').eq('organization_id', userProfile!.organization_id).order('title'),
        supabase.from('learning_paths').select('id, title').eq('organization_id', userProfile!.organization_id).eq('is_active', true).order('title'),
      ]);
      setTemplates((tRes.data as any) || []);
      setDesignations(dRes.data || []);
      setLearningPaths(lRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ designation_id: '', duration_days: 90, learning_path_id: '', description: '', is_active: true });
    setError('');
    setShowModal(true);
  };

  const openEdit = (t: InductionTemplate) => {
    setEditing(t);
    setForm({ designation_id: t.designation_id, duration_days: t.duration_days, learning_path_id: t.learning_path_id || '', description: t.description || '', is_active: t.is_active });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.designation_id) { setError('Please select a designation.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        organization_id: userProfile!.organization_id,
        designation_id: form.designation_id,
        duration_days: form.duration_days,
        learning_path_id: form.learning_path_id || null,
        description: form.description,
        is_active: form.is_active,
        created_by: userProfile!.id,
      };
      if (editing) {
        const { error } = await supabase.from('induction_templates').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('induction_templates').insert(payload);
        if (error) throw error;
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 truncate">{t.designations?.title || 'Unknown Role'}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {t.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <button onClick={() => openEdit(t)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50 transition text-xs font-medium">Edit</button>
            </div>
            {t.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{t.description}</p>}
            <div className="space-y-1.5 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{t.duration_days} days</div>
              {t.learning_paths && <div className="flex items-center gap-1.5"><BookOpen className="w-3 h-3" />{t.learning_paths.title}</div>}
            </div>
          </div>
        ))}

        <button onClick={openCreate} className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-600 transition min-h-32">
          <Plus className="w-6 h-6" />
          <span className="text-sm font-medium">New Template</span>
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-gray-900 mb-5">{editing ? 'Edit Template' : 'New Induction Template'}</h3>
            {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg mb-4">{error}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Designation / Role</label>
                <select value={form.designation_id} onChange={e => setForm(f => ({ ...f, designation_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-950/20">
                  <option value="">Select role...</option>
                  {designations.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Duration (days)</label>
                <input type="number" min={1} value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: +e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-950/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Learning Path (optional)</label>
                <select value={form.learning_path_id} onChange={e => setForm(f => ({ ...f, learning_path_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-950/20">
                  <option value="">None</option>
                  {learningPaths.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What does this induction cover?" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-950/20 resize-none" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-700">Active template</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-950 text-white rounded-xl text-sm font-semibold hover:bg-blue-900 transition disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Team Overview (Manager / HR) ────────────────────────────────────────────

function TeamInductionView() {
  const { userProfile } = useAuth();
  const [journeys, setJourneys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('induction_journeys')
        .select('*, employees(employee_code, user_profiles(full_name), designations(title)), induction_templates(description, duration_days, designations(title))')
        .order('created_at', { ascending: false });
      setJourneys(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" /></div>;

  if (journeys.length === 0) {
    return <div className="text-center py-16 text-sm text-gray-500">No induction journeys have been assigned yet.</div>;
  }

  const byStatus = { in_progress: 0, completed: 0, not_started: 0, extended: 0 };
  journeys.forEach(j => { if (j.status in byStatus) byStatus[j.status as keyof typeof byStatus]++; });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'In Progress', count: byStatus.in_progress, color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: 'Completed', count: byStatus.completed, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          { label: 'Not Started', count: byStatus.not_started, color: 'text-gray-600 bg-gray-50 border-gray-200' },
          { label: 'Total', count: journeys.length, color: 'text-blue-950 bg-white border-gray-200' },
        ].map(s => (
          <div key={s.label} className={`p-3 rounded-xl border ${s.color}`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {journeys.map(j => {
          const emp = j.employees;
          const dayInfo = daysRemaining(j.expected_end_date);
          return (
            <div key={j.id} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-blue-950 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {emp?.user_profiles?.full_name?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{emp?.user_profiles?.full_name || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{emp?.designations?.title || emp?.employee_code}</p>
              </div>
              <div className="flex items-center gap-6 flex-shrink-0 text-right">
                <div>
                  <div className="w-24 bg-gray-100 rounded-full h-1.5 mb-1">
                    <div className="bg-blue-950 h-1.5 rounded-full" style={{ width: `${j.completion_percentage}%` }} />
                  </div>
                  <p className="text-xs text-gray-500">{j.completion_percentage}% done</p>
                </div>
                <div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadge(j.status)}`}>
                    {j.status.replace('_', ' ')}
                  </span>
                  {j.status !== 'completed' && (
                    <p className={`text-xs mt-0.5 ${dayInfo.cls}`}>{dayInfo.label}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Induction() {
  const { userProfile } = useAuth();

  const role = userProfile?.role || 'employee';
  const isEmployee = role === 'employee';
  const isHR = role === 'hr' || role === 'admin';
  const isLD = role === 'l_d_manager' || role === 'admin';
  const isManager = role === 'manager';

  type Tab = 'my-journey' | 'assign' | 'templates' | 'team';
  const tabs: { id: Tab; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: 'my-journey', label: 'My Journey', icon: GraduationCap, show: true },
    { id: 'assign', label: 'Assign Induction', icon: Users, show: isHR },
    { id: 'templates', label: 'Templates', icon: FileText, show: isLD },
    { id: 'team', label: 'Team Overview', icon: BarChart2, show: isHR || isLD || isManager },
  ];

  const visibleTabs = tabs.filter(t => t.show);
  const [activeTab, setActiveTab] = useState<Tab>('my-journey');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Induction</h1>
          <p className="text-sm text-gray-500 mt-0.5">Onboarding journeys, templates, and progress tracking</p>
        </div>
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === tab.id ? 'bg-white text-blue-950 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'my-journey' && <EmployeeJourneyView />}
      {activeTab === 'assign' && <AssignInductionView />}
      {activeTab === 'templates' && <TemplatesView />}
      {activeTab === 'team' && <TeamInductionView />}
    </div>
  );
}
