import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { portalApi, PortalError, DomainQuestion as Question } from '../../lib/portalApi';

interface DomainAssessmentMeta {
  id: string;
  title: string;
  description: string | null;
}

interface Invitation {
  id: string;
  candidate_name: string | null;
  organization_name: string | null;
  access_code: string;
}

interface DomainTestProps {
  invitation: Invitation;
  onComplete: () => void;
  onBack: () => void;
}

function errorMessage(err: unknown): string {
  return err instanceof PortalError ? err.message : 'Something went wrong. Please try again.';
}

export default function DomainTest({ invitation, onComplete, onBack }: DomainTestProps) {
  const [meta, setMeta] = useState<DomainAssessmentMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAssessment();
  }, []);

  async function loadAssessment() {
    try {
      const payload = await portalApi.getDomainTest(invitation.access_code);
      setMeta(payload.assessment);
      setQuestions(payload.questions.map(q => ({
        ...q,
        options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null,
      })));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit() {
    if (!meta) return;
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      setError(`Please answer all questions. ${unanswered.length} question${unanswered.length > 1 ? 's' : ''} remaining.`);
      return;
    }
    setSubmitting(true); setError('');

    try {
      // Scoring happens in the database; the answer key never reaches the browser.
      await portalApi.submitDomain(invitation.access_code, answers);
      onComplete();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
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

  const totalAnswered = Object.keys(answers).length;
  const progressPct = questions.length > 0 ? Math.round((totalAnswered / questions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-sm font-bold text-gray-900">{meta?.title || 'Knowledge Assessment'}</h1>
              <p className="text-xs text-gray-500">{invitation.organization_name} · {questions.length} questions</p>
            </div>
            <span className="text-xs font-semibold text-blue-950 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
              {totalAnswered} / {questions.length}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-950 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {meta?.description && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            {meta.description}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        {questions.map((q, idx) => {
          const opts: string[] = Array.isArray(q.options) ? q.options : [];
          return (
            <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-950 text-white text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 leading-relaxed">{q.question_text}</p>
                  {(q.points || 1) > 1 && (
                    <p className="text-xs text-gray-400 mt-1">{q.points} points</p>
                  )}
                </div>
              </div>

              {opts.length > 0 ? (
                <div className="space-y-2">
                  {opts.map((opt, i) => (
                    <label
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${answers[q.id] === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition ${answers[q.id] === opt ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                        {answers[q.id] === opt && <div className="w-2 h-2 bg-white rounded-full m-auto mt-[2px]" />}
                      </div>
                      <span className="text-sm text-gray-700">{opt}</span>
                      <input type="radio" className="sr-only" name={q.id} value={opt} onChange={() => setAnswer(q.id, opt)} />
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  rows={3}
                  placeholder="Type your answer here..."
                  value={answers[q.id] || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              )}

              {answers[q.id] !== undefined && answers[q.id] !== '' && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-emerald-600">
                  <CheckCircle className="w-3.5 h-3.5" /> Answered
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-2 pb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Overview
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || totalAnswered < questions.length}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {submitting ? 'Submitting...' : 'Submit Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}
