import { useState, useRef } from 'react';
import {
  Sparkles, RefreshCw, Check, X, AlertCircle, ChevronDown, ChevronUp,
  Lightbulb, Upload, FileText, Loader2, ArrowRight, CheckCircle2
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface GeneratedQuestion {
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
  difficulty: string;
  explanation: string;
}

interface AcceptedQuestion {
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
  difficulty: string;
}

interface AIAssessmentGeneratorProps {
  onComplete: (jobDescription: string, questions: AcceptedQuestion[]) => void;
  onClose: () => void;
}

type Step = 'upload' | 'configure' | 'generate';

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy', desc: 'Basic recall and understanding' },
  { value: 'medium', label: 'Medium', desc: 'Application and situational judgment' },
  { value: 'hard', label: 'Hard', desc: 'Advanced analysis and expert judgment' },
];

export default function AIAssessmentGenerator({ onComplete, onClose }: AIAssessmentGeneratorProps) {
  const [step, setStep] = useState<Step>('upload');
  const [jobDescription, setJobDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [acceptedQuestions, setAcceptedQuestions] = useState<AcceptedQuestion[]>([]);
  const [currentGenerated, setCurrentGenerated] = useState<GeneratedQuestion | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<GeneratedQuestion | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJobDescription((ev.target?.result as string) || '');
    };
    reader.readAsText(file);
  };

  const handleProceedToConfigure = () => {
    if (!jobDescription.trim()) {
      setError('Please provide a job description before proceeding.');
      return;
    }
    setError('');
    setStep('configure');
  };

  const handleStartGeneration = () => {
    setStep('generate');
    generateNext([]);
  };

  const generateNext = async (existing: AcceptedQuestion[]) => {
    setGenerating(true);
    setError('');
    setCurrentGenerated(null);
    setEditing(false);
    setShowExplanation(false);

    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        session = refreshed.session;
      }
      if (!session?.access_token) {
        setError('Your session has expired. Please refresh the page and try again.');
        setGenerating(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-assessment-question`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            job_description: jobDescription,
            difficulty,
            existing_questions: existing.map(q => q.question_text),
          }),
        }
      );

      if (res.status === 401) {
        setError('Authentication failed (401). Please refresh the page and log in again.');
        setGenerating(false);
        return;
      }

      const text = await res.text();
      let json: { error?: string; question?: GeneratedQuestion };
      try {
        json = JSON.parse(text);
      } catch {
        setError(`Unexpected response from server (status ${res.status}). Please try again.`);
        setGenerating(false);
        return;
      }

      if (json.error) {
        setError(json.error);
      } else if (json.question) {
        setCurrentGenerated(json.question);
        setEditForm(json.question);
      } else {
        setError('Unexpected response from AI. Please try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate question. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = () => {
    const q = editing ? editForm : currentGenerated;
    if (!q) return;
    const accepted: AcceptedQuestion = {
      question_text: q.question_text,
      option_1: q.option_1,
      option_2: q.option_2,
      option_3: q.option_3,
      option_4: q.option_4,
      correct_option: q.correct_option,
      difficulty: q.difficulty,
    };
    const updated = [...acceptedQuestions, accepted];
    setAcceptedQuestions(updated);
    setCurrentGenerated(null);
    setEditing(false);

    if (updated.length >= totalQuestions) {
      setDone(true);
    } else {
      generateNext(updated);
    }
  };

  const handleRegenerate = () => {
    generateNext(acceptedQuestions);
  };

  const handleFinish = () => {
    onComplete(jobDescription, acceptedQuestions);
  };

  const displayQ = editing ? editForm : currentGenerated;
  const progress = acceptedQuestions.length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">AI Assessment Generator</h2>
              <p className="text-xs text-gray-500">Generate questions from a job description</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {step !== 'upload' && (
          <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              {(['upload', 'configure', 'generate'] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    step === s ? 'bg-blue-950 text-white' :
                    (['upload', 'configure', 'generate'].indexOf(step) > i) ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {(['upload', 'configure', 'generate'].indexOf(step) > i) ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${step === s ? 'text-gray-900' : 'text-gray-400'}`}>
                    {s === 'upload' ? 'Job Description' : s === 'configure' ? 'Settings' : 'Generate'}
                  </span>
                  {i < 2 && <div className="w-6 h-px bg-gray-200" />}
                </div>
              ))}
              {step === 'generate' && (
                <span className="ml-auto text-xs font-semibold text-gray-600">
                  {progress}/{totalQuestions} approved
                </span>
              )}
            </div>
            {step === 'generate' && (
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-950 rounded-full transition-all duration-500"
                  style={{ width: `${(progress / totalQuestions) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Job Description or Job Profile
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Upload a text file or paste the job description directly. The AI will use this to generate relevant knowledge assessment questions.
                </p>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition mb-3"
                >
                  <input ref={fileInputRef} type="file" accept=".txt,.md,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                  <Upload className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                  {fileName ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">{fileName}</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-600">Click to upload a file</p>
                      <p className="text-xs text-gray-400 mt-0.5">.txt, .md files supported</p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">or paste directly</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <textarea
                  rows={10}
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description or job profile here..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-950 focus:outline-none resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{jobDescription.length} characters</p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleProceedToConfigure}
                disabled={!jobDescription.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-950 text-white text-sm font-semibold rounded-xl hover:bg-blue-900 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue to Settings
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'configure' && (
            <div className="space-y-5">
              <div className="p-3 bg-gray-50 rounded-xl flex items-start gap-2">
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-gray-700">Job description loaded</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{jobDescription.substring(0, 150)}{jobDescription.length > 150 ? '...' : ''}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Number of Questions
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={30}
                    step={5}
                    value={totalQuestions}
                    onChange={e => setTotalQuestions(parseInt(e.target.value))}
                    className="flex-1 accent-blue-950"
                  />
                  <span className="w-10 text-center text-sm font-bold text-gray-900">{totalQuestions}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
                  <span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Question Difficulty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDifficulty(opt.value as 'easy' | 'medium' | 'hard')}
                      className={`p-3 rounded-xl border text-left transition ${
                        difficulty === opt.value
                          ? 'border-blue-950 bg-blue-950 text-white'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className={`text-xs mt-0.5 leading-tight ${difficulty === opt.value ? 'text-blue-200' : 'text-gray-400'}`}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <p className="font-semibold">How it works:</p>
                <p>The AI will generate one question at a time. You can review, edit, or regenerate each question. Only approved questions are added to the assessment.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleStartGeneration}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-950 text-white text-sm font-semibold rounded-xl hover:bg-blue-900 transition"
                >
                  <Sparkles className="w-4 h-4" />
                  Start Generating
                </button>
              </div>
            </div>
          )}

          {step === 'generate' && !done && (
            <div className="space-y-4">
              {generating && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-10 h-10 border-blue-950 border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px', borderStyle: 'solid' }} />
                  <p className="text-sm text-gray-600">Generating question {progress + 1} of {totalQuestions}...</p>
                </div>
              )}

              {error && !generating && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                  <button
                    onClick={handleRegenerate}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-950 text-white text-sm font-semibold rounded-xl hover:bg-blue-900 transition"
                  >
                    <RefreshCw className="w-4 h-4" /> Try Again
                  </button>
                </div>
              )}

              {displayQ && !generating && (
                <>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Question {progress + 1} of {totalQuestions}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        displayQ.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                        displayQ.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {displayQ.difficulty}
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      {editing && editForm ? (
                        <textarea
                          value={editForm.question_text}
                          onChange={e => setEditForm({ ...editForm, question_text: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:outline-none"
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-900">{displayQ.question_text}</p>
                      )}

                      <div className="space-y-2">
                        {[1, 2, 3, 4].map(num => {
                          const key = `option_${num}` as keyof GeneratedQuestion;
                          const isCorrect = displayQ.correct_option === num;
                          return (
                            <div key={num} className={`flex items-center gap-2 p-2.5 rounded-lg ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                              <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                                {num}
                              </span>
                              {editing && editForm ? (
                                <input
                                  type="text"
                                  value={editForm[key] as string}
                                  onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                                  className="flex-1 bg-transparent text-sm focus:outline-none"
                                />
                              ) : (
                                <span className={`text-sm flex-1 ${isCorrect ? 'text-green-800 font-medium' : 'text-gray-700'}`}>
                                  {displayQ[key] as string}
                                </span>
                              )}
                              {isCorrect && <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                            </div>
                          );
                        })}
                      </div>

                      {editing && editForm && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Correct Answer</label>
                          <select
                            value={editForm.correct_option}
                            onChange={e => setEditForm({ ...editForm, correct_option: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:outline-none"
                          >
                            {[1, 2, 3, 4].map(n => (
                              <option key={n} value={n}>Option {n}: {editForm[`option_${n}` as keyof GeneratedQuestion]}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {displayQ.explanation && (
                        <button
                          type="button"
                          onClick={() => setShowExplanation(v => !v)}
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                          {showExplanation ? 'Hide' : 'Show'} AI explanation
                          {showExplanation ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                      {showExplanation && displayQ.explanation && (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                          {displayQ.explanation}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAccept}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition"
                    >
                      <Check className="w-4 h-4" />
                      {progress + 1 === totalQuestions ? 'Accept & Finish' : 'Accept & Next'}
                    </button>
                    {!editing ? (
                      <button
                        onClick={() => { setEditing(true); setEditForm(currentGenerated); }}
                        className="px-4 py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-xl border border-gray-300 hover:bg-gray-50 transition"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditing(false)}
                        className="px-4 py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-xl border border-gray-300 hover:bg-gray-50 transition"
                      >
                        Preview
                      </button>
                    )}
                    <button
                      onClick={handleRegenerate}
                      className="px-4 py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-xl border border-gray-300 hover:bg-gray-50 transition flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Skip
                    </button>
                  </div>

                  {acceptedQuestions.length > 0 && (
                    <p className="text-xs text-center text-gray-500">
                      {acceptedQuestions.length} question{acceptedQuestions.length !== 1 ? 's' : ''} approved so far
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {done && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">All {totalQuestions} questions approved!</h3>
                <p className="text-sm text-gray-500 mt-1">Your AI-generated assessment is ready to be saved.</p>
              </div>
              <div className="w-full p-4 bg-gray-50 rounded-xl text-left space-y-1.5 max-h-48 overflow-y-auto">
                {acceptedQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="w-5 h-5 bg-blue-950 text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">{i + 1}</span>
                    <span className="text-gray-700 line-clamp-2">{q.question_text}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleFinish}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-950 text-white text-sm font-semibold rounded-xl hover:bg-blue-900 transition"
              >
                <Loader2 className="w-4 h-4 hidden" />
                Save Assessment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
