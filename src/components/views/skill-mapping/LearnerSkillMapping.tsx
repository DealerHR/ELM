import { useState, useEffect, useCallback } from 'react';
import {
  Target, CheckCircle, ChevronRight, ChevronLeft, AlertCircle,
  Award, BarChart2, BookOpen, RefreshCw, XCircle, FileText,
  TrendingUp, Calendar, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface RoleSkill {
  id: string;
  skill_id: string;
  is_mandatory: boolean;
  minimum_score: number;
  skills: Skill;
}

interface SkillQuestion {
  id: string;
  skill_id: string;
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string;
  correct_option: number;
  difficulty: string;
  order_index: number;
}

interface SkillAssessment {
  id: string;
  skill_id: string;
  assessment_date: string;
  percentage: number;
  status: string;
  skills?: { name: string };
}

interface RelatedCourse {
  id: string;
  title: string;
  category?: string;
  duration_hours?: number;
  type: string;
}

interface RelatedResource {
  id: string;
  title: string;
  description?: string;
  file_type: string;
  file_url: string;
  category?: string;
}

interface AssessmentResult {
  skill_id: string;
  skill_name: string;
  score: number;
  max_score: number;
  percentage: number;
  minimum_score: number;
  passed: boolean;
}

function isCurrentQuarter(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const dYear = date.getFullYear();
  const dQ = Math.floor(date.getMonth() / 3);
  const nYear = now.getFullYear();
  const nQ = Math.floor(now.getMonth() / 3);
  return dYear === nYear && dQ === nQ;
}

function getQuarterLabel(): string {
  const q = Math.floor(new Date().getMonth() / 3) + 1;
  return `Q${q} ${new Date().getFullYear()}`;
}

function ScoreBadge({ pct, min }: { pct: number; min: number }) {
  const passed = pct >= min;
  return (
    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-xs ${passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
      {passed ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {pct}%
    </div>
  );
}

interface QuestionReview {
  question: SkillQuestion;
  selectedOption: number | null;
  isCorrect: boolean;
}

function ReviewScreen({
  skillName,
  reviews,
  score,
  maxScore,
  percentage,
  minimumScore,
  onDone,
}: {
  skillName: string;
  reviews: QuestionReview[];
  score: number;
  maxScore: number;
  percentage: number;
  minimumScore: number;
  onDone: () => void;
}) {
  const passed = percentage >= minimumScore;
  const optionLabels = ['A', 'B', 'C', 'D', 'E'];
  const getOptionText = (q: SkillQuestion, num: number) => {
    const map: Record<number, string> = { 1: q.option_1, 2: q.option_2, 3: q.option_3, 4: q.option_4, 5: q.option_5 };
    return map[num] ?? '';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className={`rounded-2xl p-6 text-center ${passed ? 'bg-gradient-to-br from-emerald-700 to-emerald-600' : 'bg-gradient-to-br from-blue-950 to-blue-900'} text-white`}>
        {passed
          ? <CheckCircle className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
          : <XCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
        }
        <h2 className="text-xl font-bold">{skillName}</h2>
        <p className={`text-sm mt-1 ${passed ? 'text-emerald-200' : 'text-blue-200'}`}>
          {passed ? 'Passed — well done!' : `Not passed — target is ${minimumScore}%`}
        </p>
        <div className="flex items-center justify-center gap-10 mt-5">
          <div>
            <p className="text-3xl font-bold">{score}/{maxScore}</p>
            <p className={`text-xs mt-0.5 ${passed ? 'text-emerald-300' : 'text-blue-300'}`}>Correct</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{percentage}%</p>
            <p className={`text-xs mt-0.5 ${passed ? 'text-emerald-300' : 'text-blue-300'}`}>Score</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 px-1">Question Review ({reviews.length} questions)</h3>
        {reviews.map((r, idx) => {
          const q = r.question;
          const options = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5];
          return (
            <div key={q.id} className={`bg-white rounded-xl border-2 p-4 ${r.isCorrect ? 'border-emerald-200' : 'border-red-200'}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${r.isCorrect ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  {r.isCorrect
                    ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                    : <XCircle className="w-4 h-4 text-red-500" />
                  }
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Q{idx + 1} · {q.difficulty}</p>
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{q.question_text}</p>
                </div>
              </div>
              <div className="space-y-1.5 ml-9">
                {options.map((opt, i) => {
                  const optNum = i + 1;
                  const isCorrectOpt = optNum === q.correct_option;
                  const isSelected = r.selectedOption === optNum;
                  let rowClass = 'border-gray-100 text-gray-500';
                  if (isCorrectOpt) rowClass = 'border-emerald-300 bg-emerald-50 text-emerald-900';
                  else if (isSelected && !isCorrectOpt) rowClass = 'border-red-300 bg-red-50 text-red-800 line-through';
                  return (
                    <div key={i} className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border ${rowClass}`}>
                      <span className="text-xs font-bold w-4 flex-shrink-0">{optionLabels[i]}.</span>
                      <span className="text-xs flex-1">{opt}</span>
                      {isCorrectOpt && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                      {isSelected && !isCorrectOpt && <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
              {!r.isCorrect && (
                <p className="text-xs text-gray-400 mt-2 ml-9">
                  Correct answer: <span className="font-semibold text-emerald-700">{optionLabels[q.correct_option - 1]}. {getOptionText(q, q.correct_option)}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onDone}
        className="w-full py-3 bg-blue-950 text-white rounded-xl font-semibold text-sm hover:bg-blue-900 transition"
      >
        Done — Back to Skills
      </button>
    </div>
  );
}

function AssessmentRunner({
  roleSkill, employeeId, onComplete, onCancel,
}: {
  roleSkill: RoleSkill;
  employeeId: string;
  onComplete: (r: AssessmentResult, reviews: QuestionReview[]) => void;
  onCancel: () => void;
}) {
  const skill = roleSkill.skills;
  const [questions, setQuestions] = useState<SkillQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('skill_questions')
        .select('*')
        .eq('skill_id', skill.id)
        .order('order_index');
      setQuestions(data || []);
      setLoading(false);
    })();
  }, [skill.id]);

  const q = questions[current];
  const options = q ? [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5] : [];
  const totalAnswered = Object.keys(answers).length;
  const progress = questions.length > 0 ? Math.round((totalAnswered / questions.length) * 100) : 0;

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      let correct = 0;
      questions.forEach(qn => { if (answers[qn.id] === qn.correct_option) correct++; });
      const total = questions.length;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

      const { data: assessment, error: aErr } = await supabase
        .from('skill_assessments')
        .insert({
          employee_id: employeeId,
          skill_id: skill.id,
          assessment_date: new Date().toISOString().split('T')[0],
          assessment_type: 'reassessment',
          score: correct,
          max_score: total,
          percentage: pct,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (aErr) throw aErr;

      const results = questions.map(qn => ({
        assessment_id: assessment.id,
        question_id: qn.id,
        selected_option: answers[qn.id] ?? null,
        is_correct: answers[qn.id] === qn.correct_option,
      }));
      const { error: rErr } = await supabase.from('skill_assessment_results').insert(results);
      if (rErr) throw rErr;

      const reviews: QuestionReview[] = questions.map(qn => ({
        question: qn,
        selectedOption: answers[qn.id] ?? null,
        isCorrect: answers[qn.id] === qn.correct_option,
      }));

      onComplete({
        skill_id: skill.id,
        skill_name: skill.name,
        score: correct,
        max_score: total,
        percentage: pct,
        minimum_score: roleSkill.minimum_score,
        passed: pct >= roleSkill.minimum_score,
      }, reviews);
    } catch (e: any) {
      setError('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200 p-6">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-900">No questions available yet</p>
        <p className="text-xs text-gray-500 mt-1">Ask your L&D manager to add questions in Skill Builder.</p>
        <button onClick={onCancel} className="mt-4 text-sm text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{skill.category}</p>
          <h3 className="text-base font-bold text-gray-900">{skill.name} — Skill Assessment</h3>
        </div>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">Exit</button>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Question {current + 1} of {questions.length}</span>
          <span>{totalAnswered} answered · {progress}% complete</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="bg-blue-950 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-900 mb-3 leading-relaxed">{q.question_text}</p>
        <div className="space-y-1.5">
          {options.map((opt, i) => {
            const optNum = i + 1;
            const selected = answers[q.id] === optNum;
            return (
              <button key={i} onClick={() => setAnswers(a => ({ ...a, [q.id]: optNum }))}
                className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all ${
                  selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  selected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{String.fromCharCode(65 + i)}</div>
                <span className={`text-sm ${selected ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
          className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent(c => c + 1)} disabled={answers[q.id] === undefined}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-950 text-white rounded-xl text-sm font-semibold hover:bg-blue-900 disabled:opacity-40">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={saving || totalAnswered < questions.length}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40">
            {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> Submit</>}
          </button>
        )}
      </div>
      {current === questions.length - 1 && totalAnswered < questions.length && (
        <p className="text-xs text-center text-amber-600">{questions.length - totalAnswered} question(s) unanswered</p>
      )}
    </div>
  );
}

function SkillCard({
  rs, latestAssessment, onStartAssessment, orgId,
}: {
  rs: RoleSkill;
  latestAssessment: SkillAssessment | undefined;
  onStartAssessment: (rs: RoleSkill) => void;
  orgId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [courses, setCourses] = useState<RelatedCourse[]>([]);
  const [resources, setResources] = useState<RelatedResource[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  const doneThisQuarter = latestAssessment && isCurrentQuarter(latestAssessment.assessment_date);
  const pct = latestAssessment?.percentage;
  const passed = pct !== undefined && pct >= rs.minimum_score;

  const loadRelatedContent = async () => {
    if (courses.length > 0 || resources.length > 0) return;
    setLoadingContent(true);
    try {
      const [cRes, rRes] = await Promise.all([
        supabase
          .from('learning_courses')
          .select('id, title, category, duration_hours, type')
          .eq('organization_id', orgId)
          .eq('status', 'published')
          .contains('skill_ids', [rs.skill_id]),
        supabase
          .from('resource_repository')
          .select('id, title, description, file_type, file_url, category')
          .eq('organization_id', orgId)
          .contains('skill_ids', [rs.skill_id]),
      ]);
      setCourses(cRes.data || []);
      setResources(rRes.data || []);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadRelatedContent();
  };

  return (
    <div className={`bg-white rounded-xl border-2 transition-all ${
      doneThisQuarter
        ? passed ? 'border-emerald-200' : 'border-amber-200'
        : 'border-gray-200'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="text-sm font-bold text-gray-900">{rs.skills.name}</h3>
              {rs.is_mandatory && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">Required</span>}
              {doneThisQuarter && (
                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                  {getQuarterLabel()} done
                </span>
              )}
              {!doneThisQuarter && latestAssessment && (
                <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                  Due this quarter
                </span>
              )}
              {!latestAssessment && (
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
                  Not assessed yet
                </span>
              )}
            </div>
            {rs.skills.category && <p className="text-xs text-gray-400">{rs.skills.category}</p>}
            {rs.skills.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{rs.skills.description}</p>}
          </div>
          <div className="flex-shrink-0">
            {pct !== undefined ? (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                passed ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}>{pct}%</div>
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 border-2 border-gray-200">
                <Target className="w-5 h-5 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {pct !== undefined && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Score</span>
              <span>Target: {rs.minimum_score}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${passed ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {latestAssessment && (
              <p className="text-xs text-gray-400 mt-1">
                Last assessed: {new Date(latestAssessment.assessment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => onStartAssessment(rs)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              doneThisQuarter
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-blue-950 text-white hover:bg-blue-900'
            }`}
          >
            {doneThisQuarter ? <><RefreshCw className="w-3 h-3" /> Retake</> : <><ChevronRight className="w-3 h-3" /> Take Assessment</>}
          </button>
          <button
            onClick={handleExpand}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
          >
            <BookOpen className="w-3 h-3" />
            Resources
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {loadingContent ? (
            <div className="text-xs text-gray-400 text-center py-2">Loading related content...</div>
          ) : (
            <>
              {courses.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Related Courses
                  </p>
                  <div className="space-y-1.5">
                    {courses.map(c => (
                      <div key={c.id} className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{c.title}</p>
                          {c.category && <p className="text-xs text-gray-400">{c.category}</p>}
                        </div>
                        {c.duration_hours && (
                          <span className="text-xs text-gray-400 flex-shrink-0">{c.duration_hours}h</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resources.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Related Resources
                  </p>
                  <div className="space-y-1.5">
                    {resources.map(r => (
                      <a
                        key={r.id}
                        href={r.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{r.title}</p>
                          {r.category && <p className="text-xs text-gray-400">{r.category}</p>}
                        </div>
                        <span className="text-xs text-blue-600 flex-shrink-0">Open</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {courses.length === 0 && resources.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No related learning content linked to this skill yet.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface ReviewState {
  skillName: string;
  reviews: QuestionReview[];
  score: number;
  maxScore: number;
  percentage: number;
  minimumScore: number;
}

interface HistoryReview {
  assessmentId: string;
  skillName: string;
  percentage: number;
  date: string;
}

export default function LearnerSkillMapping({ onNavigateToLearning }: { onNavigateToLearning?: () => void }) {
  const { userProfile } = useAuth();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [designationId, setDesignationId] = useState<string | null>(null);
  const [roleSkills, setRoleSkills] = useState<RoleSkill[]>([]);
  const [pastAssessments, setPastAssessments] = useState<SkillAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSkill, setActiveSkill] = useState<RoleSkill | null>(null);
  const [sessionResults, setSessionResults] = useState<AssessmentResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [historyReview, setHistoryReview] = useState<HistoryReview | null>(null);
  const [historyReviewData, setHistoryReviewData] = useState<QuestionReview[] | null>(null);
  const [loadingHistoryReview, setLoadingHistoryReview] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: emp } = await supabase
        .from('employees')
        .select('id, designation_id')
        .eq('user_id', userProfile!.id)
        .maybeSingle();

      if (!emp) { setLoading(false); return; }
      setEmployeeId(emp.id);
      setDesignationId(emp.designation_id);

      if (!emp.designation_id) { setLoading(false); return; }

      const [rsRes, paRes] = await Promise.all([
        supabase
          .from('role_skills')
          .select('*, skills(id, name, description, category)')
          .eq('designation_id', emp.designation_id)
          .order('is_mandatory', { ascending: false }),
        supabase
          .from('skill_assessments')
          .select('id, skill_id, assessment_date, percentage, status, skills(name)')
          .eq('employee_id', emp.id)
          .eq('status', 'completed')
          .order('assessment_date', { ascending: false }),
      ]);

      setRoleSkills((rsRes.data as any) || []);
      setPastAssessments((paRes.data as any) || []);
    } catch {
      setError('Failed to load skill data.');
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => { load(); }, [load]);

  const getLatestAssessment = (skillId: string) =>
    pastAssessments.find(a => a.skill_id === skillId);

  const dueThisQuarter = roleSkills.filter(rs => {
    const latest = getLatestAssessment(rs.skill_id);
    return !latest || !isCurrentQuarter(latest.assessment_date);
  });

  const avgScore = pastAssessments.length > 0
    ? Math.round(pastAssessments.reduce((s, a) => s + a.percentage, 0) / pastAssessments.length)
    : null;

  const handleComplete = (result: AssessmentResult, reviews: QuestionReview[]) => {
    setSessionResults(r => [...r, result]);
    setActiveSkill(null);
    setReviewState({
      skillName: result.skill_name,
      reviews,
      score: result.score,
      maxScore: result.max_score,
      percentage: result.percentage,
      minimumScore: result.minimum_score,
    });
    load();
  };

  const openHistoryReview = async (pa: SkillAssessment) => {
    setHistoryReview({
      assessmentId: pa.id,
      skillName: (pa.skills as any)?.name || 'Skill',
      percentage: pa.percentage,
      date: pa.assessment_date,
    });
    setHistoryReviewData(null);
    setLoadingHistoryReview(true);
    try {
      const { data } = await supabase
        .from('skill_assessment_results')
        .select('*, skill_questions(*)')
        .eq('assessment_id', pa.id);

      if (data) {
        setHistoryReviewData(data.map((row: any) => ({
          question: row.skill_questions as SkillQuestion,
          selectedOption: row.selected_option,
          isCorrect: row.is_correct,
        })));
      }
    } catch {
      setHistoryReviewData([]);
    } finally {
      setLoadingHistoryReview(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (activeSkill && employeeId) {
    return (
      <div className="p-3">
        <AssessmentRunner
          roleSkill={activeSkill}
          employeeId={employeeId}
          onComplete={handleComplete}
          onCancel={() => setActiveSkill(null)}
        />
      </div>
    );
  }

  if (reviewState) {
    return (
      <div className="p-3">
        <ReviewScreen
          skillName={reviewState.skillName}
          reviews={reviewState.reviews}
          score={reviewState.score}
          maxScore={reviewState.maxScore}
          percentage={reviewState.percentage}
          minimumScore={reviewState.minimumScore}
          onDone={() => setReviewState(null)}
        />
      </div>
    );
  }

  if (showResults && sessionResults.length > 0) {
    const passed = sessionResults.filter(r => r.passed).length;
    const avg = Math.round(sessionResults.reduce((s, r) => s + r.percentage, 0) / sessionResults.length);
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <div className="bg-gradient-to-br from-blue-950 to-blue-900 rounded-2xl p-6 text-white text-center">
          <Award className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold">Assessments Complete</h2>
          <p className="text-blue-200 text-sm mt-1">{getQuarterLabel()} results recorded</p>
          <div className="flex items-center justify-center gap-8 mt-5">
            <div><p className="text-3xl font-bold">{passed}/{sessionResults.length}</p><p className="text-blue-300 text-xs mt-0.5">Skills Passed</p></div>
            <div><p className="text-3xl font-bold">{avg}%</p><p className="text-blue-300 text-xs mt-0.5">Avg Score</p></div>
          </div>
        </div>
        <div className="space-y-2">
          {sessionResults.map(r => (
            <div key={r.skill_id} className={`flex items-center gap-4 p-4 rounded-xl border-2 ${r.passed ? 'border-emerald-200 bg-emerald-50' : 'border-red-100 bg-red-50'}`}>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{r.skill_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 max-w-32 bg-white/70 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${r.passed ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${r.percentage}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{r.score}/{r.max_score}</span>
                  <span className={`text-xs font-bold ${r.passed ? 'text-emerald-700' : 'text-red-600'}`}>{r.percentage}%</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Target: {r.minimum_score}%</p>
              </div>
              <ScoreBadge pct={r.percentage} min={r.minimum_score} />
            </div>
          ))}
        </div>
        {sessionResults.some(r => !r.passed) && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
            <BookOpen className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Skill gaps identified</p>
              <p className="text-xs text-amber-700 mt-0.5">Check the related resources on each skill card for targeted learning materials.</p>
            </div>
          </div>
        )}
        <button onClick={() => { setShowResults(false); onNavigateToLearning?.(); }}
          className="w-full py-3 bg-blue-950 text-white rounded-xl font-semibold text-sm hover:bg-blue-900 transition">
          Continue to My Learning
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Skill Mapping</h1>
        <p className="text-sm text-gray-500 mt-1">Your role-based skill assessments and performance scores</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {!employeeId ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">No employee profile found</p>
          <p className="text-xs text-gray-500 mt-1">Contact your HR manager to set up your employee profile.</p>
        </div>
      ) : !designationId ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">No role (designation) assigned yet</p>
          <p className="text-xs text-gray-500 mt-1">Your HR manager needs to assign you a designation before skill assessments become available.</p>
          <p className="text-xs text-gray-400 mt-3 max-w-xs mx-auto">Once assigned, you'll be able to take quarterly skill assessments and track your performance scores here.</p>
        </div>
      ) : roleSkills.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">No skills mapped to your role yet</p>
          <p className="text-xs text-gray-500 mt-1">Your L&D manager will assign skills to your role soon.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Award className="w-5 h-5 text-blue-700" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{roleSkills.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Skills Mapped</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-700" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{avgScore !== null ? `${avgScore}%` : '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Avg Skill Score</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 ${dueThisQuarter.length > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                <Calendar className={`w-5 h-5 ${dueThisQuarter.length > 0 ? 'text-amber-600' : 'text-green-600'}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{dueThisQuarter.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Due {getQuarterLabel()}</p>
            </div>
          </div>

          {dueThisQuarter.length > 0 && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900">Quarterly assessments due</p>
                <p className="text-xs text-amber-700 mt-0.5">{dueThisQuarter.length} skill{dueThisQuarter.length !== 1 ? 's' : ''} need{dueThisQuarter.length === 1 ? 's' : ''} to be assessed in {getQuarterLabel()}.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roleSkills.map(rs => (
              <SkillCard
                key={rs.id}
                rs={rs}
                latestAssessment={getLatestAssessment(rs.skill_id)}
                onStartAssessment={setActiveSkill}
                orgId={userProfile!.organization_id!}
              />
            ))}
          </div>

          {pastAssessments.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                <BarChart2 className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700">Assessment History</h3>
                <span className="text-xs text-gray-400 ml-auto">Click any row to review answers</span>
              </div>
              <div className="divide-y divide-gray-100">
                {pastAssessments.slice(0, 10).map(pa => (
                  <button
                    key={pa.id}
                    onClick={() => openHistoryReview(pa)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition text-left"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{(pa.skills as any)?.name || 'Skill'}</p>
                      <p className="text-xs text-gray-400">{new Date(pa.assessment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${pa.percentage >= 60 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${pa.percentage}%` }} />
                      </div>
                      <span className={`text-xs font-bold ${pa.percentage >= 60 ? 'text-emerald-700' : 'text-amber-600'}`}>{pa.percentage}%</span>
                      <FileText className="w-3.5 h-3.5 text-gray-300 ml-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {historyReview && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-50 rounded-2xl w-full max-w-2xl my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-white rounded-t-2xl border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-400 font-medium">Assessment Review</p>
                <p className="text-sm font-bold text-gray-900">{historyReview.skillName}</p>
                <p className="text-xs text-gray-400">{new Date(historyReview.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {historyReview.percentage}%</p>
              </div>
              <button onClick={() => { setHistoryReview(null); setHistoryReviewData(null); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {loadingHistoryReview ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : historyReviewData && historyReviewData.length > 0 ? (
                historyReviewData.map((r, idx) => {
                  if (!r.question) return null;
                  const q = r.question;
                  const optionLabels = ['A', 'B', 'C', 'D', 'E'];
                  const options = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5];
                  return (
                    <div key={q.id} className={`bg-white rounded-xl border-2 p-4 ${r.isCorrect ? 'border-emerald-200' : 'border-red-200'}`}>
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${r.isCorrect ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          {r.isCorrect
                            ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                            : <XCircle className="w-4 h-4 text-red-500" />
                          }
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-400 font-medium mb-0.5">Q{idx + 1} · {q.difficulty}</p>
                          <p className="text-sm font-semibold text-gray-900 leading-snug">{q.question_text}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 ml-9">
                        {options.map((opt, i) => {
                          const optNum = i + 1;
                          const isCorrectOpt = optNum === q.correct_option;
                          const isSelected = r.selectedOption === optNum;
                          let rowClass = 'border-gray-100 text-gray-500';
                          if (isCorrectOpt) rowClass = 'border-emerald-300 bg-emerald-50 text-emerald-900';
                          else if (isSelected && !isCorrectOpt) rowClass = 'border-red-300 bg-red-50 text-red-800 line-through';
                          return (
                            <div key={i} className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border ${rowClass}`}>
                              <span className="text-xs font-bold w-4 flex-shrink-0">{optionLabels[i]}.</span>
                              <span className="text-xs flex-1">{opt}</span>
                              {isCorrectOpt && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                              {isSelected && !isCorrectOpt && <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No detailed review data available for this attempt.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
