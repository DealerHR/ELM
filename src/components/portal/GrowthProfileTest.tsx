import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Languages } from 'lucide-react';

interface Question {
  id: string;
  question_number: number;
  dimension: string;
  question_text: string;
  question_text_simple: string | null;
  question_text_hi: string | null;
  question_type: string;
  answer_scale: string;
  question_format: string;
  option_1: string | null;
  option_2: string | null;
  option_3: string | null;
  option_4: string | null;
  option_5: string | null;
  option_1_simple: string | null;
  option_2_simple: string | null;
  option_3_simple: string | null;
  option_4_simple: string | null;
  option_5_simple: string | null;
  option_1_hi: string | null;
  option_2_hi: string | null;
  option_3_hi: string | null;
  option_4_hi: string | null;
  option_5_hi: string | null;
  is_reverse_scored: boolean;
  is_social_desirability_trap: boolean;
}

interface Invitation {
  id: string;
  growth_assessment_id: string | null;
  candidate_name: string | null;
  organization_name: string | null;
  access_code: string;
  growth_profile_level: string | null;
}

interface GrowthProfileTestProps {
  invitation: Invitation;
  onComplete: () => void;
  onBack: () => void;
}

const QUESTIONS_PER_PAGE = 5;

function getQuestionText(q: Question, showHindi: boolean): string {
  if (showHindi && q.question_text_hi) return q.question_text_hi;
  return q.question_text_simple || q.question_text;
}

function getOptions(q: Question, showHindi: boolean): (string | null)[] {
  if (showHindi) {
    return [q.option_1_hi, q.option_2_hi, q.option_3_hi, q.option_4_hi, q.option_5_hi];
  }
  return [
    q.option_1_simple || q.option_1,
    q.option_2_simple || q.option_2,
    q.option_3_simple || q.option_3,
    q.option_4_simple || q.option_4,
    q.option_5_simple || q.option_5,
  ];
}

export default function GrowthProfileTest({ invitation, onComplete, onBack }: GrowthProfileTestProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [hindiToggles, setHindiToggles] = useState<Record<string, boolean>>({});

  useEffect(() => { loadQuestions(); }, []);

  async function loadQuestions() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('growth_profile_questions')
      .select(`
        id, question_number, dimension, question_text, question_text_simple, question_text_hi,
        question_type, answer_scale, question_format,
        option_1, option_2, option_3, option_4, option_5,
        option_1_simple, option_2_simple, option_3_simple, option_4_simple, option_5_simple,
        option_1_hi, option_2_hi, option_3_hi, option_4_hi, option_5_hi,
        is_reverse_scored, is_social_desirability_trap
      `)
      .order('question_number', { ascending: true });

    if (err || !data) { setError('Failed to load questions.'); setLoading(false); return; }
    setQuestions(data);

    if (invitation.growth_assessment_id) {
      const { data: existing } = await supabase
        .from('candidate_growth_responses')
        .select('question_id, answer_value')
        .eq('assessment_id', invitation.growth_assessment_id);
      if (existing && existing.length > 0) {
        const preloaded: Record<string, number> = {};
        existing.forEach(r => { preloaded[r.question_id] = r.answer_value; });
        setAnswers(preloaded);
        const lastAnsweredIndex = data.findIndex(q => !preloaded[q.id]);
        if (lastAnsweredIndex > 0) {
          setPage(Math.floor(lastAnsweredIndex / QUESTIONS_PER_PAGE));
        }
      }
    }

    setLoading(false);
  }

  function setAnswer(questionId: string, value: number) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  function toggleHindi(questionId: string) {
    setHindiToggles(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  }

  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const pageQuestions = questions.slice(page * QUESTIONS_PER_PAGE, (page + 1) * QUESTIONS_PER_PAGE);
  const pageAnswered = pageQuestions.every(q => answers[q.id] !== undefined);
  const totalAnswered = Object.keys(answers).length;
  const allAnswered = totalAnswered >= questions.length;

  async function savePageResponses(qs: Question[]) {
    if (!invitation.growth_assessment_id) return;
    for (const q of qs) {
      const val = answers[q.id];
      if (val === undefined) continue;
      const { data: existing } = await supabase
        .from('candidate_growth_responses')
        .select('id')
        .eq('assessment_id', invitation.growth_assessment_id)
        .eq('question_id', q.id)
        .maybeSingle();
      if (!existing) {
        await supabase.from('candidate_growth_responses').insert({
          assessment_id: invitation.growth_assessment_id,
          question_id: q.id,
          answer_value: val,
        });
      }
    }
  }

  async function handleNext() {
    if (!pageAnswered) { setError('Please answer all questions on this page before continuing.'); return; }
    setError('');
    setSaving(true);
    await savePageResponses(pageQuestions);
    await supabase.from('assessment_invitations').update({ status: 'in_progress' }).eq('id', invitation.id);
    setSaving(false);
    if (page < totalPages - 1) {
      setPage(p => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handleSubmit() {
    if (!allAnswered) { setError('Please answer all questions before submitting.'); return; }
    setSubmitting(true); setError('');

    if (invitation.growth_assessment_id) {
      await savePageResponses(questions);
      await supabase.from('candidate_growth_assessments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', invitation.growth_assessment_id);
      await supabase.from('assessment_invitations')
        .update({ growth_completed_at: new Date().toISOString() })
        .eq('id', invitation.id);

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        await fetch(`${supabaseUrl}/functions/v1/compute-growth-profile-scores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Apikey': supabaseAnonKey,
          },
          body: JSON.stringify({ assessment_id: invitation.growth_assessment_id }),
        });
      } catch (_) {
      }
    }

    setSubmitting(false);
    onComplete();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-950 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading assessment...</p>
        </div>
      </div>
    );
  }

  const progressPct = questions.length > 0 ? Math.round((totalAnswered / questions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-sm font-bold text-gray-900">Growth Profile Assessment</h1>
              <p className="text-xs text-gray-500">{invitation.organization_name} · {questions.length} questions</p>
            </div>
            <span className="text-xs font-semibold text-blue-950 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
              Page {page + 1} of {totalPages}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-950 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{totalAnswered} of {questions.length} answered</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        {pageQuestions.map((q, idx) => {
          const qNum = page * QUESTIONS_PER_PAGE + idx + 1;
          const isForced = q.question_format === 'forced_choice';
          const showHindi = !!hindiToggles[q.id];
          const hasHindi = !!(q.question_text_hi || q.option_1_hi);

          return (
            <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-start gap-3 mb-1">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-950 text-white text-xs font-bold flex items-center justify-center">
                  {qNum}
                </span>
                <div className="flex-1">
                  <p className={`text-sm font-medium text-gray-900 leading-relaxed ${showHindi ? 'font-hindi' : ''}`}>
                    {getQuestionText(q, showHindi)}
                  </p>
                </div>
              </div>

              {hasHindi && (
                <div className="flex items-center gap-2 mt-2 ml-10">
                  <button
                    type="button"
                    onClick={() => toggleHindi(q.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition ${
                      showHindi
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-white border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-500'
                    }`}
                    title={showHindi ? 'Switch to English' : 'हिंदी में देखें'}
                  >
                    <Languages className="w-3.5 h-3.5" />
                    {showHindi ? 'English' : 'हिंदी'}
                  </button>
                  {!showHindi && (
                    <span className="text-xs text-gray-400">हिंदी में देखने के लिए क्लिक करें</span>
                  )}
                </div>
              )}

              <div className="mt-4">
                {isForced ? (
                  <ForcedChoiceInput
                    question={q}
                    value={answers[q.id]}
                    onChange={v => setAnswer(q.id, v)}
                    showHindi={showHindi}
                  />
                ) : (
                  <RatingScaleInput
                    question={q}
                    value={answers[q.id]}
                    onChange={v => setAnswer(q.id, v)}
                    showHindi={showHindi}
                  />
                )}
              </div>

              {answers[q.id] !== undefined && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-emerald-600">
                  <CheckCircle className="w-3.5 h-3.5" /> Answered
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-2 pb-8">
          {page > 0 ? (
            <button
              onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
          ) : (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Overview
            </button>
          )}

          {page < totalPages - 1 ? (
            <button
              onClick={handleNext}
              disabled={saving || !pageAnswered}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-950 text-white rounded-xl text-sm font-semibold hover:bg-blue-900 disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save & Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !allAnswered}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RatingScaleInput({ question, value, onChange, showHindi }: {
  question: Question;
  value: number | undefined;
  onChange: (v: number) => void;
  showHindi: boolean;
}) {
  const options = getOptions(question, showHindi)
    .map((o, i) => ({ text: o, index: i }))
    .filter((o): o is { text: string; index: number } => o.text !== null && o.text !== undefined && o.text !== '');

  return (
    <div className="space-y-2">
      {options.map(({ text, index }) => (
        <label
          key={index}
          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
            value === (index + 1)
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition ${
            value === (index + 1) ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
          }`}>
            {value === (index + 1) && <div className="w-2 h-2 bg-white rounded-full m-auto mt-[2px]" />}
          </div>
          <span className={`text-sm text-gray-700 leading-snug ${showHindi ? 'font-hindi' : ''}`}>{text}</span>
          <input type="radio" className="sr-only" name={question.id} value={index + 1} onChange={() => onChange(index + 1)} />
        </label>
      ))}
    </div>
  );
}

function ForcedChoiceInput({ question, value, onChange, showHindi }: {
  question: Question;
  value: number | undefined;
  onChange: (v: number) => void;
  showHindi: boolean;
}) {
  const allOptions = getOptions(question, showHindi);
  const optA = allOptions[0] || '';
  const optB = allOptions[1] || '';

  const hint = showHindi
    ? 'वह statement चुनें जो आपसे ज्यादा मिलती-जुलती हो — दोनों अच्छी qualities हैं, वह चुनें जो आपके बारे में सबसे सच लगे।'
    : 'Select the statement that is more like you — both are positive qualities, so choose the one that feels most true.';

  return (
    <div className="space-y-2">
      <p className={`text-xs text-gray-500 mb-3 ${showHindi ? 'font-hindi' : ''}`}>{hint}</p>
      {[optA, optB].map((opt, i) => (
        <label
          key={i}
          className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${
            value === (i + 1)
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className={`w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition ${
            value === (i + 1)
              ? 'border-blue-500 bg-blue-500 text-white'
              : 'border-gray-300 text-gray-500'
          }`}>
            {i === 0 ? 'A' : 'B'}
          </div>
          <span className={`text-sm text-gray-800 leading-snug ${showHindi ? 'font-hindi' : ''}`}>{opt}</span>
          <input type="radio" className="sr-only" name={question.id} value={i + 1} onChange={() => onChange(i + 1)} />
        </label>
      ))}
    </div>
  );
}
