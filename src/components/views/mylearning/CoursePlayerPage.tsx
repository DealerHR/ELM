import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2,
  FileText, Link2, ExternalLink, RefreshCw, AlertCircle, BookOpen,
  List, X, Play, Clock, Lock, Video, Presentation,
  ClipboardList, AlignLeft, CheckCircle, Award,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';

export interface CourseModule {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  is_mandatory: boolean;
  duration_minutes: number;
  content_url: string | null;
  content_file_path: string | null;
  content_file_name: string | null;
  order_index: number;
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

interface CoursePlayerPageProps {
  courseTitle: string;
  courseId: string;
  assignmentId: string;
  employeeId: string | null;
  modules: CourseModule[];
  completedModuleIds: Set<string>;
  readOnly?: boolean;
  onBack: () => void;
  onModuleComplete: (moduleId: string, courseId: string, assignmentId: string) => Promise<void>;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  video: Video,
  document: FileText,
  presentation: Presentation,
  external_link: Link2,
  assignment: ClipboardList,
  quiz: AlignLeft,
};

const TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  document: 'Document',
  presentation: 'Presentation',
  external_link: 'Link',
  assignment: 'Assignment',
  quiz: 'Quiz',
};

function formatMinutes(min: number) {
  if (!min) return '';
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60 > 0 ? `${min % 60}m` : ''}`.trim();
}

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let videoId: string | null = null;
      if (u.hostname.includes('youtu.be')) {
        videoId = u.pathname.slice(1).split('?')[0];
      } else if (u.pathname.includes('/embed/')) {
        videoId = u.pathname.split('/embed/')[1].split('?')[0];
      } else if (u.pathname.includes('/shorts/')) {
        videoId = u.pathname.split('/shorts/')[1].split('?')[0];
      } else {
        videoId = u.searchParams.get('v');
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
      }
    }
  } catch {}
  return null;
}

export default function CoursePlayerPage({
  courseTitle,
  courseId,
  assignmentId,
  employeeId,
  modules,
  completedModuleIds: initialCompleted,
  readOnly,
  onBack,
  onModuleComplete,
}: CoursePlayerPageProps) {
  const [currentIdx, setCurrentIdx] = useState(() => {
    if (readOnly) return 0;
    const first = modules.findIndex(m => !initialCompleted.has(m.id));
    return first >= 0 ? first : 0;
  });
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set(initialCompleted));
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState('');
  const [saving, setSaving] = useState(false);
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [openingPdf, setOpeningPdf] = useState(false);

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; max: number; percentage: number } | null>(null);

  const quizScrollRef = useRef<HTMLDivElement>(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

  const mod = modules[currentIdx];
  const isVideo = mod?.content_type === 'video';
  const isPdf = mod?.content_file_name?.toLowerCase().endsWith('.pdf');
  const hasFile = Boolean(mod?.content_file_path);
  const hasLink = Boolean(mod?.content_url);
  const isQuiz = mod?.content_type === 'quiz';
  const isDone = mod ? completedIds.has(mod.id) : false;
  const completedCount = modules.filter(m => completedIds.has(m.id)).length;
  const progressPct = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;
  const youtubeEmbedUrl = hasLink && mod?.content_url ? getYouTubeEmbedUrl(mod.content_url) : null;

  useEffect(() => {
    setFileUrl(null);
    setFileError('');
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizResult(null);

    if (mod?.content_file_path) {
      setLoadingFile(true);
      supabase.storage
        .from('course-content')
        .createSignedUrl(mod.content_file_path, 3600)
        .then(({ data, error }) => {
          if (error || !data?.signedUrl) setFileError('Could not load file.');
          else setFileUrl(data.signedUrl);
          setLoadingFile(false);
        });
    }

    if (mod?.content_type === 'quiz') {
      setQuizLoading(true);
      const moduleId = mod.id;
      Promise.all([
        supabase
          .from('module_quiz_questions')
          .select('*')
          .eq('module_id', moduleId)
          .order('order_index'),
        employeeId
          ? supabase
              .from('module_quiz_responses')
              .select('points_awarded, question_id')
              .eq('module_id', moduleId)
              .eq('assignment_id', assignmentId)
              .eq('employee_id', employeeId)
          : Promise.resolve({ data: null }),
      ]).then(([questionsRes, responsesRes]) => {
        const qs = (questionsRes.data || []).map((q: Record<string, unknown>) => ({
          ...q,
          options: q.options
            ? Array.isArray(q.options) ? q.options : JSON.parse(q.options as string)
            : null,
        })) as QuizQuestion[];
        setQuizQuestions(qs);

        const existingResponses = (responsesRes as { data: { points_awarded: number; question_id: string }[] | null }).data;
        if (existingResponses && existingResponses.length > 0) {
          const score = existingResponses.reduce((s, r) => s + (r.points_awarded || 0), 0);
          const max = qs.reduce((s, q) => s + q.points, 0);
          const percentage = max > 0 ? Math.round((score / max) * 100) : 100;
          setQuizResult({ score, max, percentage });
        }

        setQuizLoading(false);
      });
    }
  }, [mod?.id]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= modules.length) return;
    setCurrentIdx(idx);
    setCurriculumOpen(false);
  };

  const handleOpenPdf = async () => {
    if (!mod?.content_file_path) return;
    setOpeningPdf(true);
    try {
      const { data, error } = await supabase.storage
        .from('course-content')
        .createSignedUrl(mod.content_file_path, 300);
      if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setOpeningPdf(false);
    }
  };

  const handleMarkDone = async () => {
    if (!mod || saving || readOnly) return;
    setSaving(true);
    try {
      await onModuleComplete(mod.id, courseId, assignmentId);
      setCompletedIds(prev => new Set([...prev, mod.id]));
      const next = modules.findIndex((m, i) => i > currentIdx && !completedIds.has(m.id));
      if (next >= 0) setTimeout(() => goTo(next), 300);
    } finally {
      setSaving(false);
    }
  };

  const handleQuizSubmit = async () => {
    if (!mod || !employeeId || quizSubmitting) return;
    setQuizSubmitting(true);
    try {
      let score = 0;
      let max = 0;
      const responses = quizQuestions.map(q => {
        const answered = quizAnswers[q.id] ?? '';
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
      setQuizResult({ score, max, percentage });

      await onModuleComplete(mod.id, courseId, assignmentId);
      setCompletedIds(prev => new Set([...prev, mod.id]));
    } finally {
      setQuizSubmitting(false);
    }
  };

  const allAnswered = quizQuestions.length > 0 && quizQuestions.every(q => quizAnswers[q.id]?.trim());

  const ModuleTypeIcon = mod ? (TYPE_ICON[mod.content_type] || BookOpen) : BookOpen;

  const CurriculumList = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-700 flex-shrink-0">
        <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">Course Content</p>
        <p className="text-xs text-gray-500 mt-0.5">{completedCount}/{modules.length} completed</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {modules.map((m, idx) => {
          const done = completedIds.has(m.id);
          const active = idx === currentIdx;
          const MIcon = TYPE_ICON[m.content_type] || BookOpen;
          return (
            <button
              key={m.id}
              onClick={() => goTo(idx)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition border-l-2 ${
                active ? 'bg-yellow-400/10 border-yellow-400' : 'border-transparent hover:bg-gray-700/40'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${done ? 'bg-emerald-500' : active ? 'bg-yellow-400' : 'bg-gray-600'}`}>
                {done
                  ? <CheckCircle2 className="w-3 h-3 text-white" />
                  : active
                  ? <Play className="w-2.5 h-2.5 text-gray-900" />
                  : <span className="text-[9px] font-bold text-gray-300">{idx + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium leading-snug ${active ? 'text-yellow-300' : done ? 'text-gray-400' : 'text-gray-200'}`}>
                  {m.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <MIcon className="w-3 h-3 text-gray-500" />
                  <span className="text-[10px] text-gray-500">{TYPE_LABEL[m.content_type] || m.content_type}</span>
                  {m.duration_minutes > 0 && (
                    <span className="text-[10px] text-gray-500">{formatMinutes(m.duration_minutes)}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderContent = () => {
    if (isQuiz) {
      if (quizLoading) {
        return (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw className="w-7 h-7 text-gray-400 animate-spin" />
          </div>
        );
      }
      if (quizResult) {
        const pct = quizResult.percentage;
        const passed = pct >= 70;
        return (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-sm">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${passed ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                <Award className={`w-10 h-10 ${passed ? 'text-emerald-400' : 'text-amber-400'}`} />
              </div>
              <p className={`text-4xl font-bold mb-1 ${passed ? 'text-emerald-400' : 'text-amber-400'}`}>{pct}%</p>
              <p className="text-sm text-gray-300 mb-1">{quizResult.score} / {quizResult.max} points</p>
              <p className={`text-base font-semibold mb-3 ${passed ? 'text-emerald-300' : 'text-amber-300'}`}>
                {passed ? 'Well done!' : 'Keep practising!'}
              </p>
              <p className="text-xs text-gray-500">This module has been marked as complete.</p>
            </div>
          </div>
        );
      }
      if (quizQuestions.length === 0) {
        return (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <ClipboardList className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-300">No quiz questions</p>
              <p className="text-xs text-gray-500 mt-1">This quiz has no questions yet.</p>
            </div>
          </div>
        );
      }
      return (
        <div ref={quizScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-4 h-4 text-yellow-400" />
              <p className="text-sm font-bold text-yellow-300">{mod.title}</p>
              <span className="text-xs text-gray-500 ml-auto">{Object.keys(quizAnswers).length}/{quizQuestions.length} answered</span>
            </div>
            {quizQuestions.map((q, qi) => (
              <div key={q.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <p className="text-xs font-bold text-gray-400 mb-2">Q{qi + 1} · {q.points} pt{q.points !== 1 ? 's' : ''}</p>
                <p className="text-sm text-gray-100 font-medium mb-3 leading-relaxed">{q.question_text}</p>
                {q.question_type === 'mcq' && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        quizAnswers[q.id] === opt
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/50'
                      }`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          quizAnswers[q.id] === opt ? 'border-yellow-400' : 'border-gray-500'
                        }`}>
                          {quizAnswers[q.id] === opt && <div className="w-2 h-2 rounded-full bg-yellow-400" />}
                        </div>
                        <input type="radio" className="sr-only" name={q.id} value={opt} checked={quizAnswers[q.id] === opt}
                          onChange={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt }))} />
                        <span className="text-sm text-gray-200">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.question_type === 'true_false' && (
                  <div className="flex gap-3">
                    {['True', 'False'].map(opt => (
                      <label key={opt} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                        quizAnswers[q.id] === opt
                          ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300'
                          : 'border-gray-600 hover:border-gray-500 text-gray-300'
                      }`}>
                        <input type="radio" className="sr-only" name={q.id} value={opt} checked={quizAnswers[q.id] === opt}
                          onChange={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt }))} />
                        {opt === 'True' ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        <span className="text-sm font-semibold">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.question_type === 'short_answer' && (
                  <textarea
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-400 resize-none"
                    placeholder="Type your answer here..."
                    value={quizAnswers[q.id] || ''}
                    onChange={e => setQuizAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <div className="pb-2">
              <button
                onClick={handleQuizSubmit}
                disabled={quizSubmitting || !allAnswered || !employeeId}
                className="w-full flex items-center justify-center gap-2 py-3 bg-yellow-400 text-gray-900 text-sm font-bold rounded-xl hover:bg-yellow-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {quizSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                {quizSubmitting ? 'Submitting...' : !allAnswered ? `Answer all questions to submit` : 'Submit Quiz'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (loadingFile) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-7 h-7 text-gray-400 animate-spin" />
        </div>
      );
    }
    if (fileError) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-5 h-5" />{fileError}
          </div>
        </div>
      );
    }

    if (hasFile && fileUrl) {
      if (isVideo) {
        return (
          <div className="flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
            <video
              key={fileUrl}
              src={fileUrl}
              controls
              autoPlay={false}
              className="w-full h-full object-contain"
              style={{ maxHeight: '100%' }}
            />
          </div>
        );
      }
      if (isPdf) {
        if (isMobile) {
          return (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 bg-gray-900">
              <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                <FileText className="w-8 h-8 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-100">{mod.content_file_name}</p>
                <p className="text-xs text-gray-500 mt-1">PDF Document</p>
              </div>
              <button
                onClick={handleOpenPdf}
                disabled={openingPdf}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-400 text-gray-900 text-sm font-bold rounded-xl hover:bg-yellow-300 transition disabled:opacity-60"
              >
                {openingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {openingPdf ? 'Opening...' : 'Open PDF'}
              </button>
            </div>
          );
        }
        return (
          <div className="flex-1 min-h-0 bg-gray-900 overflow-hidden">
            <iframe
              src={fileUrl}
              title={mod.title}
              className="w-full h-full border-0"
            />
          </div>
        );
      }
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 bg-gray-900">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center">
            <FileText className="w-7 h-7 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-200">{mod.content_file_name}</p>
            <p className="text-xs text-gray-500 mt-1">Click below to open</p>
          </div>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 bg-yellow-400 text-gray-900 text-sm font-bold rounded-xl hover:bg-yellow-300 transition"
          >
            <ExternalLink className="w-4 h-4" /> Open File
          </a>
        </div>
      );
    }

    if (!hasFile && youtubeEmbedUrl) {
      return (
        <div className="flex-1 min-h-0 bg-black overflow-hidden">
          <iframe
            key={youtubeEmbedUrl}
            src={youtubeEmbedUrl}
            title={mod.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      );
    }

    if (!hasFile && hasLink && !youtubeEmbedUrl) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 bg-gray-900">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center">
            <Link2 className="w-7 h-7 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">External resource</p>
            <p className="text-sm text-gray-300 mt-1 break-all max-w-xs">{mod.content_url}</p>
          </div>
          <a
            href={mod.content_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 bg-yellow-400 text-gray-900 text-sm font-bold rounded-xl hover:bg-yellow-300 transition"
          >
            <ExternalLink className="w-4 h-4" /> Open Link
          </a>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 bg-gray-900">
        <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-300">No content</p>
        <p className="text-xs text-gray-500 text-center max-w-xs">Mark as done once you have completed this activity.</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">

      {/* Top Bar */}
      <div className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-3 sm:px-5 h-11 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-gray-300 hover:text-white transition flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-medium hidden sm:inline">Back</span>
        </button>

        <div className="flex-1 min-w-0 mx-2">
          <p className="text-xs sm:text-sm font-bold text-white truncate leading-tight">{courseTitle}</p>
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 bg-gray-700 rounded-full overflow-hidden max-w-[100px]">
              <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-[10px] text-gray-400 flex-shrink-0">{completedCount}/{modules.length}</span>
          </div>
        </div>

        <button
          onClick={() => setCurriculumOpen(o => !o)}
          className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white transition flex-shrink-0"
        >
          {curriculumOpen ? <X className="w-4 h-4" /> : <List className="w-4 h-4" />}
          <span className="text-xs font-medium hidden sm:inline">Modules</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Main column */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* Content area - fills all available space */}
          {renderContent()}

          {/* Bottom bar - always visible, no scroll */}
          <div className="flex-shrink-0 bg-gray-900 border-t border-gray-800 px-3 sm:px-4">
            {/* Mobile: two compact rows */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:h-14 gap-0">

              {/* Row 1 (mobile) / Left section (desktop): module info */}
              <div className="flex items-center gap-2 py-2 sm:py-0 flex-1 min-w-0">
                <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <ModuleTypeIcon className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate leading-tight">{mod?.title}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">{currentIdx + 1}/{modules.length}</span>
                    {mod?.duration_minutes > 0 && (
                      <><span className="text-gray-700">·</span><span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5 inline" />{formatMinutes(mod.duration_minutes)}</span></>
                    )}
                    {mod?.is_mandatory && !isDone && (
                      <><span className="text-gray-700">·</span><span className="text-[10px] text-red-400 font-semibold flex items-center gap-0.5"><Lock className="w-2.5 h-2.5 inline" />Required</span></>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2 (mobile) / Right section (desktop): actions + nav */}
              <div className="flex items-center justify-between sm:justify-end gap-2 pb-2 sm:pb-0 border-t border-gray-800 sm:border-0 pt-1.5 sm:pt-0">
                {/* Status / Action */}
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-700/40">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400">Done</span>
                    </div>
                  ) : !readOnly && !isQuiz ? (
                    <button
                      onClick={handleMarkDone}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 text-gray-900 text-xs font-bold rounded-lg hover:bg-yellow-300 transition disabled:opacity-50"
                    >
                      {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">Mark Done</span>
                      <span className="sm:hidden">Done</span>
                    </button>
                  ) : readOnly ? (
                    <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1.5 rounded-lg">Review</span>
                  ) : null}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goTo(currentIdx - 1)}
                    disabled={currentIdx === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-700 text-xs font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  <button
                    onClick={() => goTo(currentIdx + 1)}
                    disabled={currentIdx === modules.length - 1}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-700 text-xs font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex w-72 xl:w-80 bg-gray-900 border-l border-gray-800 flex-col flex-shrink-0">
          <CurriculumList />
        </div>
      </div>

      {/* Mobile Curriculum Drawer */}
      {curriculumOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-black/70" onClick={() => setCurriculumOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-gray-900 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
              <span className="text-sm font-bold text-white">Modules</span>
              <button onClick={() => setCurriculumOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <CurriculumList />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
