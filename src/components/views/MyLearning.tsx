import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Clock, CheckCircle, Target, ArrowRight, Award, BarChart2,
  RefreshCw, CheckCircle2, Circle, AlertCircle, Layers, Calendar, XCircle, Lock,
  Users, Briefcase, Monitor, HelpCircle, ClipboardList, ChevronRight, ChevronLeft
} from 'lucide-react';
import { supabase, QUIZ_PASS_MARK } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import CoursePlayerPage, { isCourseComplete } from './mylearning/CoursePlayerPage';

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

interface InductionPathItem {
  id: string;
  path_id: string;
  course_id: string;
  order_index: number;
  is_mandatory: boolean;
  prerequisite_item_id: string | null;
  prerequisite_path_id: string | null;
  learning_courses: { id: string; title: string; description: string; duration_hours: number; type: string; delivery_type?: string } | null;
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
      onComplete(score, max);
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
          <p className="text-sm text-gray-500 mb-6">{result.score} / {result.max} points</p>
          <button onClick={onClose} className="w-full py-2.5 bg-stratefix-yellow text-stratefix-black rounded-lg font-semibold text-sm hover:bg-yellow-500 transition">
            Done
          </button>
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

interface InductionSectionProps {
  employeeId: string;
  completedPathIds: Set<string>;
}

function InductionSection({ employeeId, completedPathIds }: InductionSectionProps) {
  const [journey, setJourney] = useState<InductionJourney | null>(null);
  const [pathItems, setPathItems] = useState<InductionPathItem[]>([]);
  const [inductionAssignment, setInductionAssignment] = useState<{ id: string } | null>(null);
  const [inductionProgress, setInductionProgress] = useState<Record<string, CourseProgress>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: jData } = await supabase
        .from('induction_journeys')
        .select('*, induction_templates(*, designations(title), learning_paths(id, title, description))')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!jData) { setLoading(false); return; }
      setJourney(jData as InductionJourney);

      const pathId = (jData as InductionJourney).induction_templates?.learning_path_id;
      if (!pathId) { setLoading(false); return; }

      const { data: items } = await supabase
        .from('learning_path_items')
        .select('*, learning_courses(id, title, description, duration_hours, type, delivery_type)')
        .eq('path_id', pathId)
        .order('order_index');

      setPathItems((items as InductionPathItem[]) || []);

      const { data: asgn } = await supabase
        .from('employee_learning_assignments')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('learning_path_id', pathId)
        .maybeSingle();

      setInductionAssignment(asgn);

      if (asgn) {
        const { data: prog } = await supabase
          .from('learning_progress')
          .select('*')
          .eq('assignment_id', asgn.id)
          .eq('employee_id', employeeId);

        const map: Record<string, CourseProgress> = {};
        (prog || []).forEach((p: any) => { if (p.course_id) map[p.course_id] = p; });
        setInductionProgress(map);
      }
    } catch {
      setError('Failed to load induction journey.');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const handleStart = async (courseId: string) => {
    if (!inductionAssignment) return;
    setSaving(courseId);
    try {
      const { data, error } = await supabase
        .from('learning_progress')
        .insert({
          assignment_id: inductionAssignment.id,
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
      await supabase.from('employee_learning_assignments').update({ status: 'in_progress' }).eq('id', inductionAssignment.id);
      setInductionProgress(p => ({ ...p, [courseId]: data as CourseProgress }));
    } catch (e: any) {
      setError('Could not start course: ' + e.message);
    } finally {
      setSaving(null);
    }
  };

  const handleComplete = async (courseId: string) => {
    if (!inductionAssignment || !journey) return;
    setSaving(courseId);
    try {
      const prog = inductionProgress[courseId];
      if (!prog) return;

      await supabase
        .from('learning_progress')
        .update({ status: 'completed', progress_percentage: 100, completed_at: new Date().toISOString() })
        .eq('id', prog.id);

      const updated = { ...inductionProgress, [courseId]: { ...prog, status: 'completed', progress_percentage: 100 } };
      setInductionProgress(updated);

      const done = pathItems.filter(it => updated[it.course_id]?.status === 'completed').length;
      const pct = pathItems.length > 0 ? Math.round((done / pathItems.length) * 100) : 0;
      const allDone = pct === 100;

      await supabase.from('induction_journeys').update({
        completion_percentage: pct,
        status: allDone ? 'completed' : 'in_progress',
        actual_end_date: allDone ? new Date().toISOString().split('T')[0] : null,
      }).eq('id', journey.id);

      if (allDone) {
        await supabase.from('employee_learning_assignments').update({ status: 'completed' }).eq('id', inductionAssignment.id);
      }

      setJourney(j => j ? { ...j, completion_percentage: pct, status: allDone ? 'completed' : 'in_progress' } : j);
    } catch (e: any) {
      setError('Could not mark complete: ' + e.message);
    } finally {
      setSaving(null);
    }
  };

  const isUnlocked = (item: InductionPathItem): boolean => {
    if (item.prerequisite_path_id && !completedPathIds.has(item.prerequisite_path_id)) return false;
    if (!item.prerequisite_item_id) return true;
    const prereq = pathItems.find(p => p.id === item.prerequisite_item_id);
    if (!prereq) return true;
    return inductionProgress[prereq.course_id]?.status === 'completed';
  };

  if (loading) return null;
  if (!journey) return null;

  const template = journey.induction_templates;
  const isComplete = journey.status === 'completed';
  const dayInfo = daysRemaining(journey.expected_end_date);
  const completedCount = pathItems.filter(it => inductionProgress[it.course_id]?.status === 'completed').length;

  return (
    <div className="mb-6">
      {error && (
        <div className="flex items-center gap-2 p-3 mb-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      <div className={`rounded-2xl overflow-hidden border-2 ${isComplete ? 'border-emerald-200' : 'border-blue-200'}`}>
        <div className={`p-5 ${isComplete ? 'bg-gradient-to-br from-emerald-700 to-emerald-600' : 'bg-gradient-to-br from-blue-950 to-blue-900'} text-white`}>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${isComplete ? 'bg-emerald-500/40 text-emerald-100' : 'bg-blue-800/60 text-blue-200'}`}>
                  Induction Program
                </span>
                {isComplete && <span className="flex items-center gap-1 text-xs font-bold text-emerald-300"><CheckCircle className="w-3.5 h-3.5" /> Complete</span>}
              </div>
              <h2 className="text-lg font-bold leading-tight">{template?.designations?.title || 'Your'} Onboarding</h2>
              {template?.description && <p className={`text-sm mt-0.5 ${isComplete ? 'text-emerald-200' : 'text-blue-200'}`}>{template.description}</p>}
              <div className="flex items-center gap-4 mt-3 text-xs">
                <div className={`flex items-center gap-1.5 ${isComplete ? 'text-emerald-300' : 'text-blue-300'}`}>
                  <Calendar className="w-3 h-3" />
                  Started {new Date(journey.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                {isComplete ? (
                  <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                    <CheckCircle className="w-3 h-3" />
                    Completed {journey.actual_end_date ? new Date(journey.actual_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </div>
                ) : (
                  <div className={`flex items-center gap-1.5 font-semibold ${dayInfo.cls}`}>
                    <Clock className="w-3 h-3" />{dayInfo.label}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 text-center">
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                  <circle cx="32" cy="32" r="26" fill="none" stroke={isComplete ? '#6ee7b7' : '#facc15'} strokeWidth="5" strokeDasharray={`${(journey.completion_percentage / 100) * 163.4} 163.4`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold">{journey.completion_percentage}%</span>
                </div>
              </div>
              <p className={`text-xs mt-1 ${isComplete ? 'text-emerald-300' : 'text-blue-300'}`}>{completedCount}/{pathItems.length}</p>
            </div>
          </div>
          {pathItems.length > 0 && (
            <button onClick={() => setExpanded(e => !e)} className={`mt-4 w-full flex items-center justify-between text-xs font-semibold px-3 py-2 rounded-lg transition ${isComplete ? 'bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-100' : 'bg-blue-800/50 hover:bg-blue-800/70 text-blue-200'}`}>
              <span>{expanded ? 'Hide courses' : `Show ${pathItems.length} courses`}</span>
              <ArrowRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>

        {expanded && pathItems.length > 0 && (
          <div className="divide-y divide-gray-100 bg-white">
            {pathItems.map((item, idx) => {
              const course = item.learning_courses;
              const prog = inductionProgress[item.course_id];
              const courseStatus = prog?.status || 'not_started';
              const unlocked = isUnlocked(item);
              const isSaving = saving === item.course_id;
              const certNeeded = course?.delivery_type === 'classroom' || course?.delivery_type === 'on_job';

              return (
                <div key={item.id} className={`flex items-start gap-4 px-5 py-4 transition-colors ${courseStatus === 'completed' ? 'bg-emerald-50/50' : courseStatus === 'in_progress' ? 'bg-blue-50/50' : !unlocked ? 'opacity-55 bg-gray-50/50' : 'hover:bg-gray-50/50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${courseStatus === 'completed' ? 'bg-emerald-500' : courseStatus === 'in_progress' ? 'bg-blue-600' : unlocked ? 'bg-gray-200' : 'bg-gray-100'}`}>
                    {courseStatus === 'completed' ? <CheckCircle2 className="w-4 h-4 text-white" /> : courseStatus === 'in_progress' ? <Circle className="w-4 h-4 text-white fill-white" /> : unlocked ? <span className="text-xs font-bold text-gray-500">{idx + 1}</span> : <Lock className="w-3.5 h-3.5 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">Step {idx + 1}</span>
                      {item.is_mandatory && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">Required</span>}
                      {course?.delivery_type && deliveryBadge(course.delivery_type)}
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{course?.title || 'Course'}</p>
                    {course?.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{course.description}</p>}
                    {course?.duration_hours && <div className="flex items-center gap-1 mt-1 text-xs text-gray-400"><Clock className="w-3 h-3" />{course.duration_hours}h</div>}
                    {certNeeded && courseStatus === 'in_progress' && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><Award className="w-3 h-3" />Awaiting L&D Certification</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {courseStatus === 'not_started' && unlocked && (
                      <button onClick={() => handleStart(item.course_id)} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white text-xs font-semibold rounded-lg hover:bg-blue-900 transition disabled:opacity-50">
                        {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                        Start
                      </button>
                    )}
                    {courseStatus === 'in_progress' && !certNeeded && (
                      <button onClick={() => handleComplete(item.course_id)} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
                        {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Mark Complete
                      </button>
                    )}
                    {courseStatus === 'in_progress' && certNeeded && (
                      <span className="text-xs text-amber-500 font-medium flex items-center gap-1"><Award className="w-3.5 h-3.5" />Pending</span>
                    )}
                    {courseStatus === 'completed' && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle className="w-3.5 h-3.5" /> Done</span>}
                    {!unlocked && courseStatus === 'not_started' && <span className="text-xs text-gray-400">Locked</span>}
                  </div>
                </div>
              );
            })}
            {isComplete && (
              <div className="flex items-center gap-3 px-5 py-4 bg-emerald-50 border-t border-emerald-100">
                <Award className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Induction Complete!</p>
                  <p className="text-xs text-emerald-700">You've completed your onboarding. Continue your development with the programs below.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single Course Card ───────────────────────────────────────────────────────

const CONTENT_TYPE_ICONS: Record<string, React.ElementType> = {
  video: BookOpen,
  document: BookOpen,
  presentation: BookOpen,
  quiz: HelpCircle,
  assignment: ClipboardList,
  external_link: Target,
};

interface CourseCardProps {
  assignment: LearningAssignment;
  progress: CourseProgress | undefined;
  isCertified: boolean;
  modules: CourseModule[];
  completedModuleIds: Set<string>;
  onStart: (assignmentId: string, courseId: string) => void;
  onComplete: (progressId: string, assignmentId: string) => void;
  onTakeQuiz: (assignment: LearningAssignment) => void;
  onModuleComplete: (moduleId: string, courseId: string, assignmentId: string) => void;
  onOpenCourse: (courseId: string, courseTitle: string, assignmentId: string, readOnly?: boolean) => void;
  onModuleQuiz: (module: CourseModule, assignment: LearningAssignment) => void;
  saving: string | null;
  savingModuleId: string | null;
}

function CourseCard({
  assignment, progress, isCertified, modules, completedModuleIds,
  onStart, onComplete, onTakeQuiz, onModuleComplete, onOpenCourse, onModuleQuiz, saving, savingModuleId,
}: CourseCardProps) {
  const course = assignment.learning_courses;
  if (!course) return null;

  const courseStatus = isCertified ? 'completed' : (progress?.status || assignment.status);
  const isSaving = saving === assignment.id;
  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date() && courseStatus !== 'completed';
  const certRequired = needsLDCert(course);
  const isAssessment = course.is_assessment;

  const hasModules = modules.length > 0;
  const nonQuizModules = modules.filter(m => m.content_type !== 'quiz');
  const mandatoryModules = modules.filter(m => m.is_mandatory);
  const allMandatoryDone = mandatoryModules.length > 0 && mandatoryModules.every(m => completedModuleIds.has(m.id));
  const doneCount = modules.filter(m => completedModuleIds.has(m.id)).length;
  const progressPct = hasModules ? Math.round((doneCount / modules.length) * 100) : (progress?.progress_percentage || 0);
  const canMarkComplete = !hasModules || allMandatoryDone;
  const hasViewableContent = nonQuizModules.some(m => m.content_file_path || m.content_url || true);

  return (
    <div className={`bg-white border-2 rounded-xl overflow-hidden transition-all hover:shadow-md flex flex-col ${courseStatus === 'completed' ? 'border-emerald-200' : isOverdue ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="p-4 flex-1">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${courseStatus === 'completed' ? 'bg-emerald-100' : isAssessment ? 'bg-violet-100' : 'bg-blue-50'}`}>
            {isAssessment
              ? <ClipboardList className={`w-5 h-5 ${courseStatus === 'completed' ? 'text-emerald-600' : 'text-violet-600'}`} />
              : <BookOpen className={`w-5 h-5 ${courseStatus === 'completed' ? 'text-emerald-600' : 'text-blue-700'}`} />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{course.title}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {course.delivery_type && deliveryBadge(course.delivery_type)}
              {isAssessment && <span className="text-xs px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded font-medium flex items-center gap-1"><HelpCircle className="w-3 h-3" />Assessment</span>}
              {isOverdue && <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700">Overdue</span>}
            </div>
          </div>
        </div>

        {course.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{course.description}</p>}

        <div className="flex items-center gap-3 text-xs text-gray-400 mb-3 flex-wrap">
          {course.duration_hours && <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration_hours}h</div>}
          {hasModules && courseStatus !== 'assigned' && (
            <div className="flex items-center gap-1 text-gray-500 font-medium">
              <CheckCircle2 className="w-3 h-3" />{doneCount}/{modules.length} modules
            </div>
          )}
          {assignment.due_date && (
            <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
              <Calendar className="w-3 h-3" />Due {new Date(assignment.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>

        {courseStatus === 'in_progress' && (
          <div className="mb-3">
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{progressPct}% complete</p>
          </div>
        )}

        {certRequired && courseStatus === 'in_progress' && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-2">
            <Award className="w-3.5 h-3.5" />Awaiting L&D Certification
          </div>
        )}
      </div>

      <div className="px-4 pb-4 space-y-2">
        {courseStatus === 'assigned' && (
          <button
            onClick={() => isAssessment ? onTakeQuiz(assignment) : onStart(assignment.id, course.id)}
            disabled={isSaving}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 ${isAssessment ? 'bg-violet-700 text-white' : 'bg-blue-950 text-white hover:bg-blue-900'}`}
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : isAssessment ? <HelpCircle className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            {isAssessment ? 'Take Assessment' : 'Start Course'}
          </button>
        )}

        {courseStatus === 'in_progress' && !certRequired && !isAssessment && hasModules && hasViewableContent && (
          <button
            onClick={() => onOpenCourse(course.id, course.title, assignment.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-950 text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition"
          >
            <ArrowRight className="w-4 h-4" />
            Continue Learning
          </button>
        )}

        {courseStatus === 'in_progress' && !certRequired && !isAssessment && progress && canMarkComplete && !hasModules && (
          <button
            onClick={() => onComplete(progress.id, assignment.id)}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Mark Complete
          </button>
        )}

        {courseStatus === 'in_progress' && !certRequired && !isAssessment && hasModules && allMandatoryDone && progress && (
          <button
            onClick={() => onComplete(progress.id, assignment.id)}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Complete Course
          </button>
        )}

        {courseStatus === 'in_progress' && isAssessment && (
          <button
            onClick={() => onTakeQuiz(assignment)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-700 text-white rounded-xl text-sm font-semibold hover:bg-violet-800 transition"
          >
            <HelpCircle className="w-4 h-4" /> Retake Assessment
          </button>
        )}

        {courseStatus === 'completed' && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle className="w-3.5 h-3.5" />
              Completed {progress?.completed_at ? new Date(progress.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
            </div>
            {hasModules && !isAssessment && (
              <button
                onClick={() => onOpenCourse(course.id, course.title, assignment.id, true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition"
              >
                <BookOpen className="w-3 h-3" />
                View Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Learning Path Accordion ──────────────────────────────────────────────────

interface PathProps {
  assignment: LearningAssignment;
  pathItems: LearningPathItem[];
  progress: Record<string, CourseProgress>;
  certifiedCourseIds: Set<string>;
  completedPathIds: Set<string>;
  onStartCourse: (assignmentId: string, courseId: string) => void;
  onCompleteCourse: (progressId: string, assignmentId: string) => void;
  saving: string | null;
  courseModulesMap: Record<string, CourseModule[]>;
  onOpenCourse: (courseId: string, courseTitle: string, assignmentId: string, readOnly?: boolean) => void;
}

function LearningPathCard({ assignment, pathItems, progress, certifiedCourseIds, completedPathIds, onStartCourse, onCompleteCourse, saving, courseModulesMap, onOpenCourse }: PathProps) {
  const [expanded, setExpanded] = useState(false);
  const path = assignment.learning_paths;
  if (!path) return null;

  const completed = pathItems.filter(it => progress[it.course_id]?.status === 'completed' || certifiedCourseIds.has(it.course_id)).length;
  const total = pathItems.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const isUnlocked = (item: LearningPathItem) => {
    if (item.prerequisite_path_id && !completedPathIds.has(item.prerequisite_path_id)) return false;
    if (!item.prerequisite_item_id) return true;
    const prereq = pathItems.find(p => p.id === item.prerequisite_item_id);
    if (!prereq) return true;
    return progress[prereq.course_id]?.status === 'completed' || certifiedCourseIds.has(prereq.course_id);
  };

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left">
        <div className="flex items-center gap-3 p-3 sm:p-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-blue-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate">{path.title}</h3>
              <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded font-medium flex-shrink-0">Path</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{completed}/{total} courses · {pct}%</p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <div className="w-16 bg-gray-100 rounded-full h-1.5 mb-1">
                <div className="bg-blue-950 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className={`text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor(assignment.status)}`}>
              {assignment.status.replace('_', ' ')}
            </span>
            <div className={`w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {pathItems.map((item, idx) => {
            const course = item.learning_courses;
            if (!course) return null;
            const prog = progress[item.course_id];
            const isCertified = certifiedCourseIds.has(item.course_id);
            const courseStatus = isCertified ? 'completed' : (prog?.status || 'not_started');
            const unlocked = isUnlocked(item);
            const isSaving = saving === assignment.id + item.course_id;
            const certRequired = needsLDCert(course);

            const courseModules = courseModulesMap[item.course_id] || [];
            const hasModules = courseModules.length > 0;

            return (
              <div key={item.id} className="border-b border-gray-50 last:border-b-0">
                <div className={`flex items-center gap-3 px-4 py-3 ${!unlocked ? 'opacity-50' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${courseStatus === 'completed' ? 'bg-emerald-500' : courseStatus === 'in_progress' ? 'bg-blue-600' : unlocked ? 'bg-gray-200' : 'bg-gray-100'}`}>
                    {courseStatus === 'completed' ? <CheckCircle2 className="w-4 h-4 text-white" />
                      : courseStatus === 'in_progress' ? <Circle className="w-4 h-4 text-white" />
                      : unlocked ? <span className="text-xs font-bold text-gray-500">{idx + 1}</span>
                      : <Lock className="w-3 h-3 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{course.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                      {course.duration_hours && <span>{course.duration_hours}h</span>}
                      {item.is_mandatory && <span className="text-red-500 font-medium">Required</span>}
                      {course.delivery_type && DELIVERY_META[course.delivery_type] && (
                        <span className={`px-1 py-0.5 rounded text-xs ${DELIVERY_META[course.delivery_type].color}`}>
                          {DELIVERY_META[course.delivery_type].label}
                        </span>
                      )}
                      {certRequired && courseStatus === 'in_progress' && (
                        <span className="text-amber-600 font-medium">Awaiting Certification</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {unlocked && courseStatus === 'not_started' && (
                      <button onClick={() => onStartCourse(assignment.id, course.id)}
                        className="text-xs px-2.5 py-1 bg-blue-950 text-white rounded-lg font-semibold hover:bg-blue-900 transition">Start</button>
                    )}
                    {courseStatus === 'in_progress' && prog && !certRequired && (
                      <button onClick={() => onCompleteCourse(prog.id, assignment.id)}
                        className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition">Done</button>
                    )}
                    {courseStatus === 'in_progress' && certRequired && (
                      <span className="text-xs text-amber-500 font-medium">Pending</span>
                    )}
                    {courseStatus === 'completed' && !hasModules && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    {courseStatus === 'completed' && hasModules && (
                      <button
                        onClick={() => onOpenCourse(item.course_id, course.title, assignment.id, true)}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition"
                      >
                        <BookOpen className="w-3 h-3" />
                        View Again
                      </button>
                    )}
                    {courseStatus === 'in_progress' && prog && !certRequired && hasModules && (
                      <button
                        onClick={() => onOpenCourse(item.course_id, course.title, assignment.id)}
                        className="flex items-center gap-1 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 px-2 py-1 rounded-lg transition"
                      >
                        <ArrowRight className="w-3 h-3" />
                        Open
                      </button>
                    )}
                    {!unlocked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
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
    } catch {
      setError('Failed to load your learning assignments.');
    } finally {
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
      if (error) throw error;
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

  const handleModuleComplete = async (moduleId: string, courseId: string, assignmentId: string) => {
    if (!employeeId) return;
    setSavingModuleId(moduleId);
    try {
      await supabase.from('learning_progress').insert({
        assignment_id: assignmentId,
        employee_id: employeeId,
        course_id: courseId,
        module_id: moduleId,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        progress_percentage: 100,
        status: 'completed',
        attempts: 1,
      });

      const updatedMM = { ...moduleProgressMap };
      if (!updatedMM[courseId]) updatedMM[courseId] = new Set();
      updatedMM[courseId] = new Set([...updatedMM[courseId], moduleId]);
      setModuleProgressMap(updatedMM);

      const mods = courseModulesMap[courseId] || [];
      // Complete when every mandatory module is done, or every module if none is marked mandatory.
      const allRequiredDone = isCourseComplete(mods, updatedMM[courseId] || new Set());
      const totalDone = updatedMM[courseId]?.size || 0;
      const pct = allRequiredDone ? 100 : (mods.length > 0 ? Math.round((totalDone / mods.length) * 100) : 0);
      const now = new Date().toISOString();

      // The course-level progress row may not exist if the learner opened the
      // player without pressing Start first. Create it so progress is recorded.
      let courseProg = progressMap[courseId];
      if (!courseProg) {
        const { data: created } = await supabase.from('learning_progress').insert({
          assignment_id: assignmentId,
          employee_id: employeeId,
          course_id: courseId,
          module_id: null,
          started_at: now,
          progress_percentage: pct,
          status: allRequiredDone ? 'completed' : 'in_progress',
          completed_at: allRequiredDone ? now : null,
          attempts: 1,
        }).select().single();
        if (created) {
          courseProg = created;
          setProgressMap(prev => ({ ...prev, [courseId]: created }));
        }
      } else {
        setProgressMap(prev => ({
          ...prev,
          [courseId]: { ...prev[courseId], status: allRequiredDone ? 'completed' : 'in_progress', progress_percentage: pct },
        }));
        await supabase.from('learning_progress')
          .update(allRequiredDone
            ? { status: 'completed', progress_percentage: 100, completed_at: now }
            : { status: 'in_progress', progress_percentage: pct })
          .eq('id', courseProg.id);
      }

      if (allRequiredDone) {
        const asgn = assignments.find(a => a.id === assignmentId);
        if (asgn?.learning_path_id) {
          // A path assignment completes only when every course in the path is done.
          const items = pathItemsMap[asgn.learning_path_id] || [];
          const otherDone = items
            .filter(it => it.course_id !== courseId)
            .every(it => progressMap[it.course_id]?.status === 'completed' || certifiedCourseIds.has(it.course_id));
          if (otherDone) {
            await supabase.from('employee_learning_assignments').update({ status: 'completed' }).eq('id', assignmentId);
          }
        } else {
          await supabase.from('employee_learning_assignments').update({ status: 'completed' }).eq('id', assignmentId);
        }
        await load();
      }
    } catch (e: any) {
      setError('Failed to mark module complete: ' + e.message);
    } finally {
      setSavingModuleId(null);
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
    setActiveModuleQuiz(null);
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

  const filtered = (list: LearningAssignment[]) => {
    if (filter === 'all') return list;
    return list.filter(a => a.status === filter);
  };

  const completedCount = assignments.filter(a => a.status === 'completed' || certifiedAssignmentIds.has(a.id)).length;
  const inProgressCount = assignments.filter(a => a.status === 'in_progress').length;
  const totalHours = assignments.reduce((s, a) => s + (a.learning_courses?.duration_hours || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Learning</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your onboarding, courses, assessments and learning paths</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {employeeId && <InductionSection employeeId={employeeId} completedPathIds={completedPathIds} />}

      {assignments.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
            {[
              { icon: BarChart2, label: 'In Progress', value: inProgressCount, color: 'text-blue-700 bg-blue-50' },
              { icon: CheckCircle, label: 'Completed', value: completedCount, color: 'text-emerald-700 bg-emerald-50' },
              { icon: Clock, label: 'Total Hours', value: `${totalHours}h`, color: 'text-gray-700 bg-gray-50' },
            ].map(s => (
              <div key={s.label} className={`flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 p-3 sm:p-4 rounded-xl border border-gray-200 ${s.color}`}>
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <div>
                  <p className="text-lg sm:text-xl font-bold leading-tight">{s.value}</p>
                  <p className="text-[10px] sm:text-xs font-medium opacity-70 leading-tight">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-5 overflow-x-auto max-w-full">
            {(['all', 'in_progress', 'assigned', 'completed'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === f ? 'bg-white text-blue-950 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {f === 'all' ? 'All' : f.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}
              </button>
            ))}
          </div>
        </>
      )}

      {assignments.length === 0 && !employeeId && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No learning assignments yet</h3>
          <p className="text-sm text-gray-500 max-w-xs">Your learning journey will appear here once assigned.</p>
        </div>
      )}

      {assignments.length === 0 && employeeId && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <Target className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">No additional courses assigned</h3>
          <p className="text-xs text-gray-400 max-w-xs">Further learning programs will appear here as they are assigned to you.</p>
        </div>
      )}

      {assignments.length > 0 && (
        <div className="space-y-6">
          {filtered(pathAssignments).length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Learning Paths
              </h2>
              <div className="space-y-3">
                {filtered(pathAssignments).map(a => (
                  <LearningPathCard
                    key={a.id}
                    assignment={a}
                    pathItems={a.learning_path_id ? (pathItemsMap[a.learning_path_id] || []) : []}
                    progress={progressMap}
                    certifiedCourseIds={certifiedCourseIds}
                    completedPathIds={completedPathIds}
                    onStartCourse={handleStart}
                    onCompleteCourse={handleComplete}
                    saving={saving}
                    courseModulesMap={courseModulesMap}
                    onOpenCourse={handleOpenCourse}
                  />
                ))}
              </div>
            </div>
          )}

          {filtered(courseAssignments).length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Individual Courses & Assessments
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered(courseAssignments).map(a => (
                  <CourseCard
                    key={a.id}
                    assignment={a}
                    progress={a.course_id ? progressMap[a.course_id] : undefined}
                    isCertified={certifiedAssignmentIds.has(a.id)}
                    modules={a.course_id ? (courseModulesMap[a.course_id] || []) : []}
                    completedModuleIds={a.course_id ? (moduleProgressMap[a.course_id] || new Set()) : new Set()}
                    onStart={handleStart}
                    onComplete={handleComplete}
                    onTakeQuiz={handleTakeQuiz}
                    onModuleComplete={handleModuleComplete}
                    onOpenCourse={handleOpenCourse}
                    onModuleQuiz={handleModuleQuiz}
                    saving={saving}
                    savingModuleId={savingModuleId}
                  />
                ))}
              </div>
            </div>
          )}

          {filtered(courseAssignments).length === 0 && filtered(pathAssignments).length === 0 && (
            <div className="text-center py-10 text-sm text-gray-500">No assignments match the selected filter.</div>
          )}
        </div>
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
