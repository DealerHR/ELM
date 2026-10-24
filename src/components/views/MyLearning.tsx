import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronDown,
  BookOpen, Clock, CheckCircle, Target, ArrowRight, Award, BarChart2,
  RefreshCw, CheckCircle2, Circle, AlertCircle, Layers, Calendar, XCircle, Lock,
  Users, Briefcase, Monitor, HelpCircle, ClipboardList, ChevronRight, ChevronLeft
} from 'lucide-react';
import { supabase, QUIZ_PASS_MARK } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import CoursePlayerPage, { isCourseComplete } from './mylearning/CoursePlayerPage';
import { useRoute, replaceRoute } from '../../lib/router';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LearningCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  delivery_type: string;
  is_assessment: boolean;
  duration_hours: number;
}

interface LearningPathItem {
  id: string;
  course_id: string;
  order_index: number;
  is_mandatory: boolean;
  prerequisite_item_id: string | null;
  prerequisite_path_id: string | null;
  learning_courses: LearningCourse | null;
}

interface LearningAssignment {
  id: string;
  course_id: string | null;
  learning_path_id: string | null;
  assigned_date: string;
  due_date: string | null;
  status: string;
  learning_courses: LearningCourse | null;
  learning_paths: { id: string; title: string; description: string } | null;
}

interface CourseProgress {
  id: string;
  assignment_id: string;
  course_id: string;
  employee_id: string;
  started_at: string | null;
  completed_at: string | null;
  progress_percentage: number;
  status: string;
}

interface InductionTemplate {
  id: string;
  title?: string;
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
}

interface QuizQuestion {
  id: string;
  module_id: string;
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'short_answer';
  options: string[] | null;
  correct_answer: string | null;
  points: number;
  order_index: number;
}

interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  content_type: string;
  is_mandatory: boolean;
  order_index: number;
  duration_minutes: number;
  content_url: string | null;
  content_file_path: string | null;
  content_file_name: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DELIVERY_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  self_paced: { label: 'Self-Paced', color: 'bg-blue-100 text-blue-700', icon: Monitor },
  classroom: { label: 'Classroom', color: 'bg-teal-100 text-teal-700', icon: Users },
  on_job: { label: 'On-the-Job', color: 'bg-orange-100 text-orange-700', icon: Briefcase },
};

function deliveryBadge(deliveryType: string) {
  const m = DELIVERY_META[deliveryType];
  if (!m) return null;
  return <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${m.color}`}><m.icon className="w-3 h-3" />{m.label}</span>;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    assigned: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    overdue: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

function daysRemaining(expected: string) {
  const diff = Math.ceil((new Date(expected).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, cls: 'text-red-500' };
  if (diff === 0) return { label: 'Due today', cls: 'text-amber-500' };
  return { label: `${diff}d left`, cls: 'text-blue-300' };
}

function needsLDCert(course: LearningCourse | null) {
  return course?.delivery_type === 'classroom' || course?.delivery_type === 'on_job';
}

// ─── Quiz Modal ───────────────────────────────────────────────────────────────

interface QuizModalProps {
  courseId: string;
  courseTitle: string;
  assignmentId: string;
  employeeId: string;
  moduleId?: string;
  moduleTitle?: string;
  onComplete: (score: number, max: number) => void;
  onClose: () => void;
}

function QuizModal({ courseId, courseTitle, assignmentId, employeeId, moduleId, moduleTitle, onComplete, onClose }: QuizModalProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; max: number; percentage: number } | null>(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    let moduleIds: string[];

    if (moduleId) {
      moduleIds = [moduleId];
    } else {
      const { data: modules } = await supabase
        .from('learning_modules')
        .select('id')
        .eq('course_id', courseId)
        .eq('content_type', 'quiz');
      if (!modules || modules.length === 0) { setLoading(false); return; }
      moduleIds = modules.map(m => m.id);
    }

    const { data: qs } = await supabase
      .from('module_quiz_questions')
      .select('*')
      .in('module_id', moduleIds)
      .order('order_index');

    setQuestions((qs || []).map(q => ({
      ...q,
      options: q.options ? (Array.isArray(q.options) ? q.options : JSON.parse(q.options)) : null,
    })));
    setLoading(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let score = 0;
      let max = 0;
      const responses = questions.map(q => {
        const answered = answers[q.id] ?? '';
        let isCorrect: boolean | null = null;
        let pointsAwarded = 0;
        max += q.points;
        if (q.question_type === 'short_answer') {
          isCorrect = answered.trim().length > 0;
          pointsAwarded = isCorrect ? q.points : 0;
        } else if (q.correct_answer) {
          isCorrect = answered === q.correct_answer;
          pointsAwarded = isCorrect ? q.points : 0;
        }
        score += pointsAwarded;
        return {
          employee_id: employeeId,
          assignment_id: assignmentId,
          module_id: q.module_id,
          question_id: q.id,
          answer_text: answered,
          is_correct: isCorrect,
          points_awarded: pointsAwarded,
          attempt_number: 1,
        };
      });

      if (responses.length > 0) {
        await supabase.from('module_quiz_responses').insert(responses);
      }

      const percentage = max > 0 ? Math.round((score / max) * 100) : 100;
      setResult({ score, max, percentage });
      // Only a pass completes the module.
      if (percentage >= QUIZ_PASS_MARK) onComplete(score, max);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-8 h-8 border-4 border-blue-950 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-600">Loading quiz...</p>
      </div>
    </div>
  );

  if (questions.length === 0) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
        <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-gray-900 mb-2">No quiz questions yet</h3>
        <p className="text-xs text-gray-500 mb-4">The L&D team hasn't added questions to this assessment yet. Check back soon.</p>
        <button onClick={onClose} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">Close</button>
      </div>
    </div>
  );

  if (result) {
    const passed = result.percentage >= QUIZ_PASS_MARK;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${passed ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {passed ? <Award className="w-8 h-8 text-emerald-600" /> : <ClipboardList className="w-8 h-8 text-red-500" />}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">{passed ? 'Well done!' : 'Keep Learning'}</h3>
          <p className="text-sm text-gray-500 mb-4">{moduleTitle || courseTitle}</p>
          <div className={`text-4xl font-bold mb-1 ${passed ? 'text-emerald-700' : 'text-red-600'}`}>{result.percentage}%</div>
          <p className="text-sm text-gray-500 mb-6">{result.score} / {result.max} points{passed ? '' : ` · ${QUIZ_PASS_MARK}% needed to pass`}</p>
          {passed ? (
            <button onClick={onClose} className="w-full py-2.5 bg-stratefix-yellow text-stratefix-black rounded-lg font-semibold text-sm hover:bg-yellow-500 transition">Done</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition">Later</button>
              <button onClick={() => { setResult(null); setAnswers({}); setCurrent(0); }} className="flex-1 py-2.5 bg-stratefix-yellow text-stratefix-black rounded-lg font-semibold text-sm hover:bg-yellow-500 transition">Try again</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const q = questions[current];
  const totalQuestions = questions.length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{courseTitle}</p>
            <span className="text-xs text-gray-400">{current + 1} / {totalQuestions}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-blue-950 h-1.5 rounded-full transition-all" style={{ width: `${((current + 1) / totalQuestions) * 100}%` }} />
          </div>
        </div>
        <div className="p-6">
          <div className="mb-1 text-xs text-gray-400 font-medium">{q.points} pt{q.points !== 1 ? 's' : ''}</div>
          <p className="text-base font-semibold text-gray-900 mb-5 leading-relaxed">{q.question_text}</p>

          {q.question_type === 'short_answer' ? (
            <textarea
              value={answers[q.id] ?? ''}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              rows={4}
              placeholder="Type your answer here..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none resize-none"
            />
          ) : (
            <div className="space-y-2">
              {(q.options || []).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: option }))}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition ${
                    answers[q.id] === option
                      ? 'border-stratefix-yellow bg-yellow-50 text-gray-900'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 pb-5 flex items-center gap-3">
          <button
            onClick={() => setCurrent(c => c - 1)}
            disabled={current === 0}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          {current < totalQuestions - 1 ? (
            <button
              onClick={() => setCurrent(c => c + 1)}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-950 text-white rounded-lg text-sm font-semibold hover:bg-blue-900 transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Induction Section ────────────────────────────────────────────────────────

interface FirstDaysTask { id: string; title: string; description: string | null; owner: string; due_date: string | null; is_required: boolean; status: string; }

/**
 * "Your first days": a light panel for a joiner whose induction is running.
 * Their checklist (they tick their own items), the overall bar and the dates.
 * The induction learning path itself is an ordinary assignment, so it shows in
 * the list below like any other path.
 */
function FirstDaysPanel({ employeeId }: { employeeId: string }) {
  const [journey, setJourney] = useState<InductionJourney | null>(null);
  const [tasks, setTasks] = useState<FirstDaysTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const { data: j } = await supabase
      .from('induction_journeys')
      .select('*, induction_templates(*, designations(title), learning_paths(id, title, description))')
      .eq('employee_id', employeeId)
      .in('status', ['not_started', 'in_progress', 'extended'])
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    setJourney((j as InductionJourney) || null);
    if (j) {
      const { data: t } = await supabase.from('induction_tasks').select('id, title, description, owner, due_date, is_required, status').eq('journey_id', j.id).order('order_index');
      setTasks((t || []) as FirstDaysTask[]);
    }
    setLoaded(true);
  }, [employeeId]);
  useEffect(() => { load(); }, [load]);

  if (!loaded || !journey) return null;

  const today = new Date().toISOString().slice(0, 10);
  const dayNo = Math.max(0, Math.round((new Date(today).getTime() - new Date(journey.start_date).getTime()) / 86400000));
  const total = Math.max(1, Math.round((new Date(journey.expected_end_date).getTime() - new Date(journey.start_date).getTime()) / 86400000));
  const mine = tasks.filter(t => t.owner === 'employee');
  const open = mine.filter(t => t.status === 'pending');
  const shown = showAll ? mine : open.slice(0, 4);
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

  const toggle = async (t: FirstDaysTask) => {
    setBusy(t.id);
    const done = t.status === 'pending';
    await supabase.from('induction_tasks').update({ status: done ? 'done' : 'pending', completed_at: done ? new Date().toISOString() : null }).eq('id', t.id);
    await load();
    setBusy(null);
  };

  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Your first {total} days</h2>
          <p className="text-xs text-gray-500 truncate">
            {journey.status === 'not_started' ? `Starts ${fmt(journey.start_date)}` : `Day ${Math.min(dayNo, total)} of ${total}`}
            {journey.induction_templates?.title ? ` · ${journey.induction_templates.title}` : ''}
            {open.length ? ` · ${open.length} thing${open.length === 1 ? '' : 's'} for you to do` : mine.length ? ' · your tasks are done' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-violet-500" style={{ width: `${journey.completion_percentage}%` }} /></div>
          <span className="text-xs text-gray-600 w-8 text-right">{journey.completion_percentage}%</span>
        </div>
      </div>
      {journey.induction_templates?.description && <p className="px-4 pt-3 text-sm text-gray-700">{journey.induction_templates.description}</p>}
      {mine.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {shown.map(t => {
            const late = t.status === 'pending' && t.due_date && t.due_date < today;
            return (
              <li key={t.id}>
                <button onClick={() => toggle(t)} disabled={busy === t.id} className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition">
                  {t.status === 'pending' ? <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm ${t.status === 'pending' ? 'text-gray-900' : 'text-gray-500 line-through'}`}>{t.title}</span>
                    {t.description && t.status === 'pending' && <span className="block text-xs text-gray-500 truncate">{t.description}</span>}
                  </span>
                  {t.due_date && <span className={`text-xs flex-shrink-0 ${late ? 'text-red-700 font-medium' : 'text-gray-500'}`}>{late ? 'Overdue · ' : 'By '}{fmt(t.due_date)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {(mine.length > shown.length || showAll) && (
        <button onClick={() => setShowAll(s => !s)} className="w-full px-4 py-2 text-xs font-medium text-blue-800 hover:bg-gray-50 border-t border-gray-100 text-left">
          {showAll ? 'Show fewer' : `Show all ${mine.length} tasks`}
        </button>
      )}
    </section>
  );
}

// ─── Shared row pieces ────────────────────────────────────────────────────────

type RowStatus = 'not_started' | 'in_progress' | 'completed' | 'locked' | 'awaiting_cert';

const STATUS_CHIP: Record<RowStatus, { label: string; cls: string }> = {
  not_started: { label: 'Not started', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In progress', cls: 'bg-blue-50 text-blue-700' },
  completed: { label: 'Done', cls: 'bg-emerald-50 text-emerald-700' },
  locked: { label: 'Locked', cls: 'bg-gray-100 text-gray-400' },
  awaiting_cert: { label: 'Awaiting sign-off', cls: 'bg-amber-50 text-amber-700' },
};

function StatusChip({ status }: { status: RowStatus }) {
  const c = STATUS_CHIP[status];
  return <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${c.cls}`}>{c.label}</span>;
}

function ProgressBar({ pct, className = '' }: { pct: number; className?: string }) {
  return (
    <div className={`h-1 bg-gray-200 rounded-full overflow-hidden ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-stratefix-yellow'}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function ActionButton({ kind, children, onClick, disabled }: { kind: 'primary' | 'secondary' | 'link'; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 whitespace-nowrap';
  const cls = kind === 'primary'
    ? 'bg-stratefix-yellow text-stratefix-black hover:bg-yellow-400'
    : kind === 'secondary'
      ? 'border border-gray-300 text-gray-800 hover:bg-gray-50'
      : 'text-blue-800 hover:underline px-1';
  return <button onClick={onClick} disabled={disabled} className={`${base} ${cls}`}>{children}</button>;
}

/** Decide what a learner can do with one course and how far along they are. */
function courseState(args: {
  course: LearningCourse;
  prog: CourseProgress | undefined;
  certified: boolean;
  modules: CourseModule[];
  completedModuleIds: Set<string>;
  assignmentStatus?: string;
  unlocked?: boolean;
}) {
  const { course, prog, certified, modules, completedModuleIds, assignmentStatus, unlocked = true } = args;
  const hasModules = modules.length > 0;
  const doneCount = modules.filter(m => completedModuleIds.has(m.id)).length;
  const requiredDone = hasModules && isCourseComplete(modules, completedModuleIds);
  const certRequired = needsLDCert(course);
  const completed = certified || prog?.status === 'completed' || assignmentStatus === 'completed';
  const started = !!prog || doneCount > 0 || assignmentStatus === 'in_progress';

  let status: RowStatus = 'not_started';
  if (!unlocked) status = 'locked';
  else if (completed) status = 'completed';
  else if (started && certRequired && (requiredDone || !hasModules)) status = 'awaiting_cert';
  else if (started) status = 'in_progress';

  const pct = completed ? 100 : hasModules ? Math.round((doneCount / modules.length) * 100) : (prog?.progress_percentage || 0);
  return { status, pct, hasModules, doneCount, requiredDone, certRequired };
}

// ─── Course row ───────────────────────────────────────────────────────────────

interface CourseRowProps {
  assignment: LearningAssignment;
  progress?: CourseProgress;
  isCertified: boolean;
  modules: CourseModule[];
  completedModuleIds: Set<string>;
  onStart: (assignmentId: string, courseId: string, courseTitle: string, modules: CourseModule[]) => void;
  onComplete: (progressId: string, assignmentId: string) => void;
  onTakeQuiz: (assignment: LearningAssignment) => void;
  onOpenCourse: (courseId: string, courseTitle: string, assignmentId: string, readOnly?: boolean) => void;
  saving: string | null;
}

function CourseRow({ assignment, progress, isCertified, modules, completedModuleIds, onStart, onComplete, onTakeQuiz, onOpenCourse, saving }: CourseRowProps) {
  const course = assignment.learning_courses;
  if (!course) return null;
  const st = courseState({ course, prog: progress, certified: isCertified, modules, completedModuleIds, assignmentStatus: assignment.status });
  const isSaving = saving === assignment.id;
  const overdue = assignment.due_date && new Date(assignment.due_date) < new Date() && st.status !== 'completed';
  const isAssessment = course.is_assessment;
  const delivery = course.delivery_type ? DELIVERY_META[course.delivery_type]?.label : null;

  const meta = [
    isAssessment ? 'Assessment' : delivery,
    course.duration_hours ? `${course.duration_hours} h` : null,
    st.hasModules ? `${st.doneCount}/${modules.length} modules` : null,
    assignment.due_date ? `${overdue ? 'Overdue' : 'Due'} ${new Date(assignment.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : null,
  ].filter(Boolean).join(' · ');

  const action = (() => {
    if (st.status === 'completed') {
      return st.hasModules
        ? <ActionButton kind="link" onClick={() => onOpenCourse(course.id, course.title, assignment.id, true)}>Review</ActionButton>
        : null;
    }
    if (st.status === 'awaiting_cert') return null;
    if (isAssessment && !st.hasModules) {
      return <ActionButton kind="primary" onClick={() => onTakeQuiz(assignment)}>Take assessment</ActionButton>;
    }
    if (st.status === 'not_started') {
      return <ActionButton kind="primary" onClick={() => onStart(assignment.id, course.id, course.title, modules)} disabled={isSaving}>{isSaving ? 'Starting…' : 'Start'}</ActionButton>;
    }
    if (st.hasModules) {
      return <ActionButton kind="primary" onClick={() => onOpenCourse(course.id, course.title, assignment.id)}>Continue</ActionButton>;
    }
    if (progress && !st.certRequired) {
      return <ActionButton kind="secondary" onClick={() => onComplete(progress.id, assignment.id)} disabled={isSaving}>Mark done</ActionButton>;
    }
    return null;
  })();

  return (
    <li className="flex items-center gap-3 px-3 py-3 sm:px-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${st.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : isAssessment ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-700'}`}>
        {isAssessment ? <ClipboardList className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm sm:text-sm font-semibold text-gray-900 leading-tight">{course.title}</p>
          <StatusChip status={st.status} />
        </div>
        <p className={`text-xs mt-0.5 ${overdue ? 'text-red-600' : 'text-gray-500'}`}>{meta}</p>
        {st.status === 'in_progress' && st.hasModules && <ProgressBar pct={st.pct} className="mt-2 max-w-[200px]" />}
        {st.status === 'awaiting_cert' && <p className="text-xs text-amber-700 mt-0.5">Completion is signed off by L&amp;D after the session.</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </li>
  );
}

// ─── Learning path row ────────────────────────────────────────────────────────

interface PathRowProps {
  assignment: LearningAssignment;
  pathItems: LearningPathItem[];
  progress: Record<string, CourseProgress>;
  certifiedCourseIds: Set<string>;
  completedPathIds: Set<string>;
  courseModulesMap: Record<string, CourseModule[]>;
  moduleProgressMap: Record<string, Set<string>>;
  onStartCourse: (assignmentId: string, courseId: string, courseTitle: string, modules: CourseModule[]) => void;
  onCompleteCourse: (progressId: string, assignmentId: string) => void;
  onOpenCourse: (courseId: string, courseTitle: string, assignmentId: string, readOnly?: boolean) => void;
  saving: string | null;
}

function PathRow({ assignment, pathItems, progress, certifiedCourseIds, completedPathIds, courseModulesMap, moduleProgressMap, onStartCourse, onCompleteCourse, onOpenCourse, saving }: PathRowProps) {
  const path = assignment.learning_paths;
  const total = pathItems.length;
  const completedCount = pathItems.filter(it => progress[it.course_id]?.status === 'completed' || certifiedCourseIds.has(it.course_id)).length;
  const started = completedCount > 0 || pathItems.some(it => progress[it.course_id] || (moduleProgressMap[it.course_id]?.size || 0) > 0);
  const pathStatus: RowStatus = assignment.status === 'completed' || (total > 0 && completedCount === total) ? 'completed' : started ? 'in_progress' : 'not_started';
  const [expanded, setExpanded] = useState(pathStatus !== 'completed');
  if (!path) return null;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const hours = pathItems.reduce((s, it) => s + (it.learning_courses?.duration_hours || 0), 0);
  const overdue = assignment.due_date && new Date(assignment.due_date) < new Date() && pathStatus !== 'completed';

  const isUnlocked = (item: LearningPathItem) => {
    if (item.prerequisite_path_id && !completedPathIds.has(item.prerequisite_path_id)) return false;
    if (!item.prerequisite_item_id) return true;
    const prereq = pathItems.find(p => p.id === item.prerequisite_item_id);
    if (!prereq) return true;
    return progress[prereq.course_id]?.status === 'completed' || certifiedCourseIds.has(prereq.course_id);
  };

  return (
    <li className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-3 py-3 sm:px-4 text-left hover:bg-gray-50/60 transition"
      >
        <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0"><Layers className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm sm:text-sm font-semibold text-gray-900 leading-tight">{path.title}</p>
            <span className="text-xs text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5">Path</span>
            <StatusChip status={pathStatus} />
          </div>
          <p className={`text-xs mt-0.5 ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
            {completedCount} of {total} courses done{hours ? ` · ${hours} h` : ''}
            {assignment.due_date ? ` · ${overdue ? 'Overdue' : 'Due'} ${new Date(assignment.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <ProgressBar pct={pct} className="w-28" />
          <span className="text-xs text-gray-500 w-9 text-right">{pct}%</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <div className="sm:hidden px-3 pb-2 -mt-1"><ProgressBar pct={pct} /></div>

      {expanded && (
        <ol className="border-t border-gray-100">
          {pathItems.map((item, idx) => {
            const course = item.learning_courses;
            if (!course) return null;
            const mods = courseModulesMap[item.course_id] || [];
            const doneIds = moduleProgressMap[item.course_id] || new Set<string>();
            const prog = progress[item.course_id];
            const unlocked = isUnlocked(item);
            const st = courseState({ course, prog, certified: certifiedCourseIds.has(item.course_id), modules: mods, completedModuleIds: doneIds, unlocked });
            const isSaving = saving === assignment.id;
            const current = st.status === 'in_progress';

            const marker = st.status === 'completed'
              ? <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center"><CheckCircle2 className="w-3 h-3" /></span>
              : current
                ? <span className="w-5 h-5 rounded-full border-2 border-stratefix-yellow bg-white" />
                : st.status === 'locked'
                  ? <span className="w-5 h-5 rounded-full border border-gray-200 bg-gray-50 text-gray-400 flex items-center justify-center"><Lock className="w-2.5 h-2.5" /></span>
                  : <span className="w-5 h-5 rounded-full border border-gray-300 text-gray-500 text-[11px] font-semibold flex items-center justify-center">{idx + 1}</span>;

            const action = (() => {
              if (st.status === 'locked') {
                const prereq = pathItems.find(p => p.id === item.prerequisite_item_id);
                return <span className="text-xs text-gray-400">{prereq ? `After ${prereq.learning_courses?.title?.split(':')[0] || 'previous'}` : 'Locked'}</span>;
              }
              if (st.status === 'completed') {
                return st.hasModules ? <ActionButton kind="link" onClick={() => onOpenCourse(item.course_id, course.title, assignment.id, true)}>Review</ActionButton> : null;
              }
              if (st.status === 'awaiting_cert') return <span className="text-xs text-amber-700">L&amp;D sign-off</span>;
              if (st.status === 'not_started') {
                return <ActionButton kind={idx === pathItems.findIndex(p => isUnlocked(p) && !(progress[p.course_id]?.status === 'completed' || certifiedCourseIds.has(p.course_id))) ? 'primary' : 'secondary'} onClick={() => onStartCourse(assignment.id, course.id, course.title, mods)} disabled={isSaving}>Start</ActionButton>;
              }
              if (st.hasModules) return <ActionButton kind="primary" onClick={() => onOpenCourse(item.course_id, course.title, assignment.id)}>Continue</ActionButton>;
              if (prog && !st.certRequired) return <ActionButton kind="secondary" onClick={() => onCompleteCourse(prog.id, assignment.id)} disabled={isSaving}>Mark done</ActionButton>;
              return null;
            })();

            return (
              <li key={item.id} className={`flex items-center gap-3 pl-5 pr-3 sm:pl-[52px] sm:pr-4 py-2.5 border-t border-gray-50 first:border-t-0 ${current ? 'bg-yellow-50/60' : ''} ${st.status === 'locked' ? 'opacity-70' : ''}`}>
                <div className="flex-shrink-0">{marker}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-tight ${st.status === 'completed' ? 'text-gray-500' : current ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>{course.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[
                      st.status === 'completed' && prog?.completed_at ? `Done · ${new Date(prog.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : null,
                      current && st.hasModules ? `Module ${Math.min(st.doneCount + 1, mods.length)} of ${mods.length}` : null,
                      !current && st.status !== 'completed' && course.duration_hours ? `${course.duration_hours} h` : null,
                      course.delivery_type && course.delivery_type !== 'self_paced' ? DELIVERY_META[course.delivery_type]?.label : null,
                      item.is_mandatory && st.status !== 'completed' ? 'Required' : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {action && <div className="flex-shrink-0">{action}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

// ─── Continue card ────────────────────────────────────────────────────────────

interface ContinueTarget {
  courseId: string;
  courseTitle: string;
  assignmentId: string;
  context: string;
  modules: CourseModule[];
  doneCount: number;
  pct: number;
  started: boolean;
}

function ContinueCard({ target, onOpen, onStart }: { target: ContinueTarget; onOpen: () => void; onStart: () => void }) {
  const remaining = target.modules.slice(target.doneCount).reduce((s, m) => s + (m.duration_minutes || 0), 0);
  return (
    <button
      onClick={target.started ? onOpen : onStart}
      aria-label={target.started ? 'Continue learning' : 'Start learning'}
      className="w-full text-left bg-white border border-gray-200 border-l-4 border-l-stratefix-yellow rounded-lg px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition"
    >
      <span className="w-9 h-9 rounded-lg bg-stratefix-yellow text-stratefix-black flex items-center justify-center flex-shrink-0"><ArrowRight className="w-4 h-4" /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs text-gray-500">{target.started ? 'Continue where you left off' : 'Start here'}</span>
        <span className="block text-sm font-semibold text-gray-900 truncate">{target.courseTitle}</span>
        <span className="block text-xs text-gray-500 truncate">
          {target.context}
          {target.modules.length > 0 ? ` · module ${Math.min(target.doneCount + 1, target.modules.length)} of ${target.modules.length}` : ''}
          {remaining > 0 ? ` · about ${remaining} min left` : ''}
        </span>
      </span>
      {target.started && target.modules.length > 0 && (
        <span className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <span className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden"><span className="block h-full bg-stratefix-yellow" style={{ width: `${target.pct}%` }} /></span>
          <span className="text-xs text-gray-600 w-8 text-right">{target.pct}%</span>
        </span>
      )}
      <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{target.started ? 'Resume' : 'Start'}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MyLearning() {
  const { userProfile } = useAuth();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<LearningAssignment[]>([]);
  const [pathItemsMap, setPathItemsMap] = useState<Record<string, LearningPathItem[]>>({});
  const [progressMap, setProgressMap] = useState<Record<string, CourseProgress>>({});
  const [courseModulesMap, setCourseModulesMap] = useState<Record<string, CourseModule[]>>({});
  const [moduleProgressMap, setModuleProgressMap] = useState<Record<string, Set<string>>>({}); // courseId -> Set<moduleId>
  const [certifiedAssignmentIds, setCertifiedAssignmentIds] = useState<Set<string>>(new Set());
  const [certifiedCourseIds, setCertifiedCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savingModuleId, setSavingModuleId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'assigned' | 'completed'>('all');
  const [activeQuizAssignment, setActiveQuizAssignment] = useState<LearningAssignment | null>(null);
  const [activeModuleQuiz, setActiveModuleQuiz] = useState<{ module: CourseModule; assignment: LearningAssignment } | null>(null);
  const [activeCoursePlayer, setActiveCoursePlayer] = useState<{
    courseId: string; courseTitle: string; assignmentId: string;
    modules: CourseModule[]; completedModuleIds: Set<string>; readOnly?: boolean;
  } | null>(null);

  // Only the very first load shows the spinner. Later refreshes (after a module is
  // marked done, a quiz passed, the player closed) happen in place, otherwise the
  // open course player would be unmounted and reopen at module 1.
  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!userProfile) return;
    if (!hasLoadedRef.current) setLoading(true);
    setError('');
    try {
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userProfile.id)
        .maybeSingle();

      if (!emp) { setLoading(false); return; }
      setEmployeeId(emp.id);

      const { data: asgns } = await supabase
        .from('employee_learning_assignments')
        .select('*, learning_courses(id, title, description, category, type, delivery_type, is_assessment, duration_hours), learning_paths(id, title, description)')
        .eq('employee_id', emp.id)
        .order('assigned_date', { ascending: false });

      const list = (asgns as LearningAssignment[]) || [];
      setAssignments(list);

      let pathItemCourseIds: string[] = [];
      const pathIds = list.filter(a => a.learning_path_id).map(a => a.learning_path_id!);
      if (pathIds.length > 0) {
        const { data: items } = await supabase
          .from('learning_path_items')
          .select('*, learning_courses(id, title, description, category, type, delivery_type, is_assessment, duration_hours)')
          .in('path_id', pathIds)
          .order('order_index');

        const map: Record<string, LearningPathItem[]> = {};
        (items || []).forEach((it: any) => {
          if (!map[it.path_id]) map[it.path_id] = [];
          map[it.path_id].push(it as LearningPathItem);
          if (it.course_id) pathItemCourseIds.push(it.course_id);
        });
        setPathItemsMap(map);
      }

      const aIds = list.map(a => a.id);
      if (aIds.length > 0) {
        const { data: progs } = await supabase
          .from('learning_progress')
          .select('*')
          .in('assignment_id', aIds)
          .eq('employee_id', emp.id);

        const pm: Record<string, CourseProgress> = {};
        const mm: Record<string, Set<string>> = {};
        (progs || []).forEach((p: any) => {
          if (!p.module_id && p.course_id) {
            pm[p.course_id] = p as CourseProgress;
          } else if (p.module_id && p.course_id) {
            if (!mm[p.course_id]) mm[p.course_id] = new Set();
            if (p.status === 'completed') mm[p.course_id].add(p.module_id);
          }
        });
        setProgressMap(pm);
        setModuleProgressMap(mm);

        const { data: certs } = await supabase
          .from('ld_certifications')
          .select('assignment_id, course_id')
          .in('assignment_id', aIds);

        const certAIds = new Set<string>((certs || []).map((c: any) => c.assignment_id));
        const certCIds = new Set<string>((certs || []).map((c: any) => c.course_id));
        setCertifiedAssignmentIds(certAIds);
        setCertifiedCourseIds(certCIds);
      }

      const courseIds = [...new Set([
        ...list.filter(a => a.course_id).map(a => a.course_id!),
        ...pathItemCourseIds,
      ])];
      if (courseIds.length > 0) {
        const { data: mods } = await supabase
          .from('learning_modules')
          .select('id, course_id, title, description, content_type, is_mandatory, order_index, duration_minutes, content_url, content_file_path, content_file_name')
          .in('course_id', courseIds)
          .order('order_index');
        const cm: Record<string, CourseModule[]> = {};
        (mods || []).forEach((m: any) => {
          if (!cm[m.course_id]) cm[m.course_id] = [];
          cm[m.course_id].push(m as CourseModule);
        });
        setCourseModulesMap(cm);
      }
    } catch (e) {
      console.error('Could not load learning assignments', e);
      setError('Failed to load your learning assignments.');
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => { load(); }, [load]);

  const handleStart = async (assignmentId: string, courseId: string) => {
    if (!employeeId) return;
    setSaving(assignmentId);
    try {
      const { error } = await supabase.from('learning_progress').insert({
        assignment_id: assignmentId,
        employee_id: employeeId,
        course_id: courseId,
        module_id: null,
        started_at: new Date().toISOString(),
        progress_percentage: 0,
        status: 'in_progress',
        attempts: 1,
      });
      // A course row may already exist (opened before, or created by a module); that is fine.
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
      await supabase.from('employee_learning_assignments').update({ status: 'in_progress' }).eq('id', assignmentId);
      await load();
    } catch (e: any) {
      setError('Failed to start course: ' + e.message);
    } finally {
      setSaving(null);
    }
  };

  const handleComplete = async (progressId: string, assignmentId: string) => {
    setSaving(assignmentId);
    try {
      await supabase.from('learning_progress')
        .update({ status: 'completed', progress_percentage: 100, completed_at: new Date().toISOString() })
        .eq('id', progressId);

      const asgn = assignments.find(a => a.id === assignmentId);
      if (asgn?.learning_path_id) {
        const items = pathItemsMap[asgn.learning_path_id] || [];
        const updatedProgress = { ...progressMap };
        const prog = Object.values(updatedProgress).find(p => p.id === progressId);
        if (prog) updatedProgress[prog.course_id] = { ...prog, status: 'completed' };
        const allDone = items.every(it => updatedProgress[it.course_id]?.status === 'completed');
        if (allDone) await supabase.from('employee_learning_assignments').update({ status: 'completed' }).eq('id', assignmentId);
      } else {
        await supabase.from('employee_learning_assignments').update({ status: 'completed' }).eq('id', assignmentId);
      }
      await load();
    } catch (e: any) {
      setError('Failed to mark complete: ' + e.message);
    } finally {
      setSaving(null);
    }
  };

  // Records a module as done. The database works out the course row, the
  // course percentage and the assignment status from module rows (see the
  // course_progress_server_side migration), so this only writes one row and
  // reloads.
  const handleModuleComplete = async (moduleId: string, courseId: string, assignmentId: string) => {
    if (!employeeId) return;
    setSavingModuleId(moduleId);
    try {
      const now = new Date().toISOString();
      const { error: insErr } = await supabase.from('learning_progress').insert({
        assignment_id: assignmentId,
        employee_id: employeeId,
        course_id: courseId,
        module_id: moduleId,
        started_at: now,
        completed_at: now,
        progress_percentage: 100,
        status: 'completed',
        attempts: 1,
      });
      // 23505 = this module is already recorded for this assignment; anything else is a real failure.
      if (insErr && insErr.code !== '23505') throw insErr;

      setModuleProgressMap(prev => ({ ...prev, [courseId]: new Set([...(prev[courseId] || []), moduleId]) }));
      await load();
    } catch (e: any) {
      setError('Failed to mark module complete: ' + e.message);
    } finally {
      setSavingModuleId(null);
    }
  };

  // Start a course and, if it has modules, open the player immediately.
  const handleStartAndOpen = async (assignmentId: string, courseId: string, courseTitle: string, modules: CourseModule[]) => {
    await handleStart(assignmentId, courseId);
    if (modules.length > 0) {
      setActiveCoursePlayer({ courseId, courseTitle, assignmentId, modules, completedModuleIds: moduleProgressMap[courseId] || new Set<string>(), readOnly: false });
    }
  };

  const handleOpenCourse = (courseId: string, courseTitle: string, assignmentId: string, readOnly = false) => {
    const modules = courseModulesMap[courseId] || [];
    const completedIds = moduleProgressMap[courseId] || new Set<string>();
    setActiveCoursePlayer({ courseId, courseTitle, assignmentId, modules, completedModuleIds: completedIds, readOnly });
  };

  const handleModuleQuiz = (module: CourseModule, assignment: LearningAssignment) => {
    setActiveModuleQuiz({ module, assignment });
  };

  const handleModuleQuizComplete = async (score: number, max: number) => {
    if (!activeModuleQuiz || !employeeId) return;
    const { module, assignment } = activeModuleQuiz;
    const course = assignment.learning_courses;
    if (!course) return;

    await handleModuleComplete(module.id, course.id, assignment.id);
    // The modal shows the result itself and closes on its own.
  };

  const handleTakeQuiz = (assignment: LearningAssignment) => {
    setActiveQuizAssignment(assignment);
  };

  const handleQuizComplete = async (score: number, max: number) => {
    if (!activeQuizAssignment || !employeeId) return;
    const course = activeQuizAssignment.learning_courses;
    if (!course) return;

    const assignmentId = activeQuizAssignment.id;
    const courseId = course.id;

    const existingProg = progressMap[courseId];
    if (existingProg) {
      await supabase.from('learning_progress').update({
        status: 'completed', progress_percentage: max > 0 ? Math.round((score / max) * 100) : 100, completed_at: new Date().toISOString(),
      }).eq('id', existingProg.id);
    } else {
      await supabase.from('learning_progress').insert({
        assignment_id: assignmentId, employee_id: employeeId, course_id: courseId,
        started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
        progress_percentage: max > 0 ? Math.round((score / max) * 100) : 100,
        status: 'completed', attempts: 1,
      });
    }
    await supabase.from('employee_learning_assignments').update({ status: 'completed' }).eq('id', assignmentId);
    await load();
  };

  const completedPathIds = new Set(
    assignments.filter(a => a.learning_path_id && a.status === 'completed').map(a => a.learning_path_id!)
  );

  const courseAssignments = assignments.filter(a => a.course_id && !a.learning_path_id);
  const pathAssignments = assignments.filter(a => a.learning_path_id);

  // What the learner has actually done, regardless of the stored assignment status.
  // A path counts as in progress as soon as any of its courses has progress.
  // One definition of "this course is done", used by every list and the continue card:
  // the course row says completed, L&D certified it, or every required module is done.
  const courseDone = (courseId: string): boolean => {
    const p = progressMap[courseId];
    if (p?.status === 'completed' || certifiedCourseIds.has(courseId)) return true;
    const mods = courseModulesMap[courseId] || [];
    return mods.length > 0 && isCourseComplete(mods, moduleProgressMap[courseId] || new Set<string>());
  };
  const courseStarted = (courseId: string): boolean => {
    const p = progressMap[courseId];
    return !!p || (moduleProgressMap[courseId]?.size || 0) > 0;
  };

  const effectiveStatus = (a: LearningAssignment): 'assigned' | 'in_progress' | 'completed' => {
    if (a.status === 'completed' || certifiedAssignmentIds.has(a.id)) return 'completed';
    if (a.learning_path_id) {
      const items = pathItemsMap[a.learning_path_id] || [];
      if (items.length > 0 && items.every(it => courseDone(it.course_id))) return 'completed';
      if (items.some(it => courseStarted(it.course_id))) return 'in_progress';
    } else if (a.course_id) {
      if (courseDone(a.course_id)) return 'completed';
      if (a.status === 'in_progress' || courseStarted(a.course_id)) return 'in_progress';
    }
    return a.status === 'in_progress' ? 'in_progress' : 'assigned';
  };

  const filtered = (list: LearningAssignment[]) => {
    if (filter === 'all') return list;
    return list.filter(a => effectiveStatus(a) === filter);
  };

  const completedCount = assignments.filter(a => effectiveStatus(a) === 'completed').length;
  const inProgressCount = assignments.filter(a => effectiveStatus(a) === 'in_progress').length;
  // Hours include the courses inside assigned learning paths.
  const totalHours = assignments.reduce((s, a) => {
    if (a.learning_path_id) {
      return s + (pathItemsMap[a.learning_path_id] || []).reduce((t, it) => t + (it.learning_courses?.duration_hours || 0), 0);
    }
    return s + (a.learning_courses?.duration_hours || 0);
  }, 0);

  // Deep link: #/my-learning/<assignment id> opens that course straight away (paths just land on the list).
  const route = useRoute();
  useEffect(() => {
    if (route.view !== 'my-learning' || !route.id || loading || assignments.length === 0) return;
    const a = assignments.find(x => x.id === route.id);
    if (a?.course_id && a.learning_courses && !activeCoursePlayer) {
      replaceRoute('my-learning');
      if (courseStarted(a.course_id) || courseDone(a.course_id)) handleOpenCourse(a.course_id, a.learning_courses.title, a.id, courseDone(a.course_id));
      else handleStartAndOpen(a.id, a.course_id, a.learning_courses.title, courseModulesMap[a.course_id] || []);
    }
  }, [route.id, loading, assignments.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // What to put in the "continue" card: the course the learner is in the middle
  // of, otherwise the first course they can start.
  const continueTarget: ContinueTarget | null = (() => {
    const candidates: ContinueTarget[] = [];
    for (const a of assignments) {
      if (effectiveStatus(a) === 'completed') continue;
      if (a.course_id && a.learning_courses) {
        if (courseDone(a.course_id)) continue;
        const mods = courseModulesMap[a.course_id] || [];
        const done = moduleProgressMap[a.course_id] || new Set<string>();
        const prog = progressMap[a.course_id];
        const started = !!prog || done.size > 0;
        if (needsLDCert(a.learning_courses) && started) continue;
        candidates.push({
          courseId: a.course_id, courseTitle: a.learning_courses.title, assignmentId: a.id,
          context: a.learning_courses.is_assessment ? 'Assessment' : 'Course',
          modules: mods, doneCount: mods.filter(m => done.has(m.id)).length,
          pct: mods.length ? Math.round((mods.filter(m => done.has(m.id)).length / mods.length) * 100) : (prog?.progress_percentage || 0),
          started,
        });
      } else if (a.learning_path_id && a.learning_paths) {
        const items = pathItemsMap[a.learning_path_id] || [];
        for (const it of items) {
          const c = it.learning_courses; if (!c) continue;
          const prog = progressMap[it.course_id];
          if (courseDone(it.course_id)) continue;
          if (it.prerequisite_item_id) {
            const pre = items.find(p => p.id === it.prerequisite_item_id);
            if (pre && !courseDone(pre.course_id)) continue;
          }
          const mods = courseModulesMap[it.course_id] || [];
          const done = moduleProgressMap[it.course_id] || new Set<string>();
          const started = !!prog || done.size > 0;
          if (needsLDCert(c) && started) continue;
          candidates.push({
            courseId: it.course_id, courseTitle: c.title, assignmentId: a.id, context: a.learning_paths.title,
            modules: mods, doneCount: mods.filter(m => done.has(m.id)).length,
            pct: mods.length ? Math.round((mods.filter(m => done.has(m.id)).length / mods.length) * 100) : (prog?.progress_percentage || 0),
            started,
          });
          break; // one per path: the next course in order
        }
      }
    }
    return candidates.find(c => c.started) || candidates[0] || null;
  })();

  const soon = new Date(); soon.setDate(soon.getDate() + 7);
  const dueSoon = assignments
    .filter(a => a.due_date && effectiveStatus(a) !== 'completed' && new Date(a.due_date) <= soon)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 2);

  const counts = {
    all: assignments.length,
    in_progress: inProgressCount,
    assigned: assignments.filter(a => effectiveStatus(a) === 'assigned').length,
    completed: completedCount,
  };

  const visiblePaths = filtered(pathAssignments);
  const visibleCourses = filtered(courseAssignments);

  return (
    <>
    <div className="px-4 py-4 lg:px-6 lg:py-5 max-w-4xl mx-auto space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto" aria-label="Dismiss"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {continueTarget && (
        <ContinueCard
          target={continueTarget}
          onOpen={() => handleOpenCourse(continueTarget.courseId, continueTarget.courseTitle, continueTarget.assignmentId)}
          onStart={() => handleStartAndOpen(continueTarget.assignmentId, continueTarget.courseId, continueTarget.courseTitle, continueTarget.modules)}
        />
      )}

      {dueSoon.length > 0 && (() => {
        const overdue = dueSoon.filter(a => new Date(a.due_date!) < new Date());
        const soon = dueSoon.filter(a => new Date(a.due_date!) >= new Date());
        const name = (a: LearningAssignment) => a.learning_courses?.title || a.learning_paths?.title || 'an assignment';
        return (
          <p className="flex items-start gap-2 text-sm text-gray-700 px-1" aria-label="Due soon">
            <Clock className={`w-4 h-4 flex-shrink-0 mt-0.5 ${overdue.length ? 'text-red-600' : 'text-amber-600'}`} />
            <span className="min-w-0">
              {overdue.length > 0 && <><span className="font-semibold text-red-700">Overdue:</span> {overdue.map(name).join(', ')}{soon.length ? '. ' : ''}</>}
              {soon.length > 0 && <><span className="font-semibold text-amber-800">Due soon:</span> {soon.map(a => `${name(a)} (${Math.ceil((new Date(a.due_date!).getTime() - Date.now()) / 86400000)} d)`).join(', ')}</>}
            </span>
          </p>
        );
      })()}

      {employeeId && <FirstDaysPanel employeeId={employeeId} />}

      {assignments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <BookOpen className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Nothing assigned yet</h3>
          <p className="text-xs text-gray-500 max-w-xs">Courses and learning paths will appear here when they are assigned to you.</p>
        </div>
      )}

      {assignments.length > 0 && (
        <>
          {/* Filters only earn their place once there is more than one state to filter by. */}
          {assignments.length > 3 && [counts.in_progress, counts.assigned, counts.completed].filter(n => n > 0).length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 [scrollbar-width:none]" role="tablist" aria-label="Filter">
            {([['all', 'All'], ['in_progress', 'In progress'], ['assigned', 'Not started'], ['completed', 'Completed']] as const).filter(([f]) => f === 'all' || counts[f] > 0).map(([f, label]) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition ${filter === f ? 'bg-stratefix-black text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {label} · {counts[f]}
              </button>
            ))}
            <span className="hidden sm:inline ml-auto text-xs text-gray-500 whitespace-nowrap">{totalHours} h assigned</span>
          </div>
          )}

          {visiblePaths.length > 0 && (
            <section aria-label="Learning paths">
              <ul className="space-y-3">
                {visiblePaths.map(a => (
                  <PathRow
                    key={a.id}
                    assignment={a}
                    pathItems={a.learning_path_id ? (pathItemsMap[a.learning_path_id] || []) : []}
                    progress={progressMap}
                    certifiedCourseIds={certifiedCourseIds}
                    completedPathIds={completedPathIds}
                    courseModulesMap={courseModulesMap}
                    moduleProgressMap={moduleProgressMap}
                    onStartCourse={handleStartAndOpen}
                    onCompleteCourse={handleComplete}
                    onOpenCourse={handleOpenCourse}
                    saving={saving}
                  />
                ))}
              </ul>
            </section>
          )}

          {visibleCourses.length > 0 && (
            <section aria-label="Courses and assessments" className="bg-white border border-gray-200 rounded-lg">
              <ul className="divide-y divide-gray-100">
                {visibleCourses.map(a => (
                  <CourseRow
                    key={a.id}
                    assignment={a}
                    progress={a.course_id ? progressMap[a.course_id] : undefined}
                    isCertified={certifiedAssignmentIds.has(a.id)}
                    modules={a.course_id ? (courseModulesMap[a.course_id] || []) : []}
                    completedModuleIds={a.course_id ? (moduleProgressMap[a.course_id] || new Set()) : new Set()}
                    onStart={handleStartAndOpen}
                    onComplete={handleComplete}
                    onTakeQuiz={handleTakeQuiz}
                    onOpenCourse={handleOpenCourse}
                    saving={saving}
                  />
                ))}
              </ul>
            </section>
          )}

          {visibleCourses.length === 0 && visiblePaths.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-500">Nothing matches this filter.</div>
          )}
        </>
      )}

      {activeQuizAssignment && activeQuizAssignment.course_id && employeeId && (
        <QuizModal
          courseId={activeQuizAssignment.course_id}
          courseTitle={activeQuizAssignment.learning_courses?.title || 'Assessment'}
          assignmentId={activeQuizAssignment.id}
          employeeId={employeeId}
          onComplete={handleQuizComplete}
          onClose={() => setActiveQuizAssignment(null)}
        />
      )}

      {activeModuleQuiz && activeModuleQuiz.assignment.course_id && employeeId && (
        <QuizModal
          courseId={activeModuleQuiz.assignment.course_id}
          courseTitle={activeModuleQuiz.assignment.learning_courses?.title || 'Course'}
          moduleId={activeModuleQuiz.module.id}
          moduleTitle={activeModuleQuiz.module.title}
          assignmentId={activeModuleQuiz.assignment.id}
          employeeId={employeeId}
          onComplete={handleModuleQuizComplete}
          onClose={() => setActiveModuleQuiz(null)}
        />
      )}

    </div>

    {activeCoursePlayer && (
      <CoursePlayerPage
        courseId={activeCoursePlayer.courseId}
        courseTitle={activeCoursePlayer.courseTitle}
        assignmentId={activeCoursePlayer.assignmentId}
        employeeId={employeeId}
        modules={activeCoursePlayer.modules}
        completedModuleIds={activeCoursePlayer.completedModuleIds}
        readOnly={activeCoursePlayer.readOnly}
        returnLabel={assignments.find(a => a.id === activeCoursePlayer.assignmentId)?.learning_path_id ? 'Back to learning path' : 'Back to My Learning'}
        onBack={() => { setActiveCoursePlayer(null); load(); }}
        onModuleComplete={handleModuleComplete}
      />
    )}
    </>
  );
}
