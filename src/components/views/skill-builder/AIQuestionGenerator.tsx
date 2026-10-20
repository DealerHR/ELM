import { useState } from 'react';
import { Sparkles, RefreshCw, Check, X, AlertCircle, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
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

interface AIQuestionGeneratorProps {
  skillName: string;
  skillDescription: string;
  existingQuestions: string[];
  questionCount: number;
  maxQuestions: number;
  onAccept: (question: Omit<GeneratedQuestion, 'explanation'>) => void;
  onClose: () => void;
}

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy', desc: 'Basic recall and understanding' },
  { value: 'medium', label: 'Medium', desc: 'Application and analysis' },
  { value: 'hard', label: 'Hard', desc: 'Evaluation and problem-solving' },
];

export default function AIQuestionGenerator({
  skillName,
  skillDescription,
  existingQuestions,
  questionCount,
  maxQuestions,
  onAccept,
  onClose,
}: AIQuestionGeneratorProps) {
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedQuestion | null>(null);
  const [error, setError] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<GeneratedQuestion | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError('');
    setGenerated(null);
    setEditing(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-skill-question`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            skill_name: skillName,
            skill_description: skillDescription,
            difficulty,
            existing_questions: existingQuestions,
          }),
        }
      );

      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else if (json.question) {
        setGenerated(json.question);
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
    const q = editing ? editForm : generated;
    if (!q) return;
    onAccept({
      question_text: q.question_text,
      option_1: q.option_1,
      option_2: q.option_2,
      option_3: q.option_3,
      option_4: q.option_4,
      correct_option: q.correct_option,
      difficulty: q.difficulty,
    });
  };

  const displayQ = editing ? editForm : generated;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">AI Question Generator</h2>
              <p className="text-xs text-gray-500">Skill: {skillName} &nbsp;·&nbsp; {questionCount}/{maxQuestions} questions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!skillDescription && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>This skill has no description. Adding a description with behaviour points will produce much better questions.</span>
            </div>
          )}

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
                  className={`p-3 rounded-lg border text-left transition ${
                    difficulty === opt.value
                      ? 'border-blue-950 bg-blue-950 text-white'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="text-xs font-semibold">{opt.label}</div>
                  <div className={`text-xs mt-0.5 ${difficulty === opt.value ? 'text-blue-200' : 'text-gray-400'}`}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {!generated && !generating && (
            <button
              onClick={generate}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-950 text-white text-sm font-semibold rounded-xl hover:bg-blue-900 transition"
            >
              <Sparkles className="w-4 h-4" />
              Generate Question with AI
            </button>
          )}

          {generating && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-10 h-10 border-3 border-blue-950 border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }} />
              <p className="text-sm text-gray-600">AI is crafting a question for "{skillName}"...</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {displayQ && !generating && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Generated Question</span>
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
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-200 opacity-50">
                    <span className="text-xs font-bold w-5 h-5 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center flex-shrink-0">5</span>
                    <span className="text-sm text-gray-500 italic">Don't Know / Not Sure</span>
                  </div>
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
          )}

          {generated && !generating && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAccept}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition"
              >
                <Check className="w-4 h-4" />
                Accept & Add Question
              </button>
              {!editing ? (
                <button
                  onClick={() => { setEditing(true); setEditForm(generated); }}
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
                onClick={generate}
                className="px-4 py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-xl border border-gray-300 hover:bg-gray-50 transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
