import { useState, useEffect } from 'react';
import { Plus, Trash2, X, GripVertical, CheckCircle, HelpCircle, AlignLeft } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

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

interface QuizBuilderProps {
  moduleId: string;
  moduleName: string;
  onClose: () => void;
}

const BLANK_QUESTION = {
  question_text: '',
  question_type: 'mcq' as const,
  options: ['', '', '', ''],
  correct_answer: '',
  points: 1,
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  mcq: CheckCircle,
  true_false: HelpCircle,
  short_answer: AlignLeft,
};

export default function QuizBuilder({ moduleId, moduleName, onClose }: QuizBuilderProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [form, setForm] = useState(BLANK_QUESTION);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadQuestions();
  }, [moduleId]);

  const loadQuestions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('module_quiz_questions')
      .select('*')
      .eq('module_id', moduleId)
      .order('order_index', { ascending: true });
    setQuestions((data || []).map(q => ({
      ...q,
      options: q.options ? (Array.isArray(q.options) ? q.options : JSON.parse(q.options)) : null,
    })));
    setLoading(false);
  };

  const openCreate = () => {
    setEditingQuestion(null);
    setForm(BLANK_QUESTION);
    setShowForm(true);
  };

  const openEdit = (q: QuizQuestion) => {
    setEditingQuestion(q);
    setForm({
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options && q.options.length > 0 ? [...q.options] : ['', '', '', ''],
      correct_answer: q.correct_answer || '',
      points: q.points,
    });
    setShowForm(true);
  };

  const handleTypeChange = (type: 'mcq' | 'true_false' | 'short_answer') => {
    if (type === 'true_false') {
      setForm(f => ({ ...f, question_type: type, options: ['True', 'False'], correct_answer: 'True' }));
    } else if (type === 'short_answer') {
      setForm(f => ({ ...f, question_type: type, options: null as any, correct_answer: '' }));
    } else {
      setForm(f => ({ ...f, question_type: type, options: ['', '', '', ''], correct_answer: '' }));
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    const opts = [...(form.options || [])];
    opts[idx] = val;
    setForm(f => ({ ...f, options: opts }));
  };

  const addOption = () => {
    setForm(f => ({ ...f, options: [...(f.options || []), ''] }));
  };

  const removeOption = (idx: number) => {
    const opts = (form.options || []).filter((_, i) => i !== idx);
    setForm(f => ({ ...f, options: opts, correct_answer: f.correct_answer === f.options?.[idx] ? '' : f.correct_answer }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question_text.trim()) return;
    setSaving(true);
    try {
      const payload = {
        module_id: moduleId,
        question_text: form.question_text,
        question_type: form.question_type,
        options: form.question_type !== 'short_answer' ? (form.options || []).filter(o => o.trim()) : null,
        correct_answer: form.question_type !== 'short_answer' ? form.correct_answer : null,
        points: form.points,
        order_index: editingQuestion ? editingQuestion.order_index : questions.length,
      };
      if (editingQuestion) {
        await supabase.from('module_quiz_questions').update(payload).eq('id', editingQuestion.id);
      } else {
        await supabase.from('module_quiz_questions').insert(payload);
      }
      setShowForm(false);
      setEditingQuestion(null);
      loadQuestions();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('module_quiz_questions').delete().eq('id', deleteId);
    setDeleteId(null);
    loadQuestions();
  };

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Quiz Questions</h2>
            <p className="text-xs text-gray-500 mt-0.5">{moduleName} · {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalPoints} pts total</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stratefix-yellow text-stratefix-black rounded-lg text-xs font-semibold hover:bg-yellow-500 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Question
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-14">
              <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600 mb-1">No questions yet</p>
              <p className="text-xs text-gray-400 mb-4">Add questions to build this quiz</p>
              <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-stratefix-yellow text-stratefix-black rounded-lg text-sm font-semibold hover:bg-yellow-500 transition mx-auto">
                <Plus className="w-4 h-4" /> Add First Question
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => {
                const Icon = TYPE_ICONS[q.question_type] || HelpCircle;
                return (
                  <div key={q.id} className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition">
                    <div className="flex items-start gap-3">
                      <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-400">Q{idx + 1}</span>
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">
                            <Icon className="w-3 h-3" />
                            {q.question_type.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-400">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{q.question_text}</p>
                        {q.options && q.options.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {q.options.map((opt, oi) => (
                              <span key={oi} className={`text-xs px-2 py-0.5 rounded-full ${opt === q.correct_answer ? 'bg-emerald-100 text-emerald-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}>
                                {opt === q.correct_answer && <span className="mr-1">✓</span>}{opt}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.question_type === 'short_answer' && (
                          <p className="text-xs text-gray-400 mt-1 italic">Open-ended — manually graded</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(q)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setDeleteId(q.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">{editingQuestion ? 'Edit Question' : 'Add Question'}</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Question Text *</label>
                  <textarea
                    required
                    rows={3}
                    value={form.question_text}
                    onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none resize-none"
                    placeholder="Enter your question here..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Type</label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {(['mcq', 'true_false', 'short_answer'] as const).map(t => {
                        const Icon = TYPE_ICONS[t];
                        return (
                          <label key={t} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${form.question_type === t ? 'border-stratefix-yellow bg-yellow-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <input type="radio" className="sr-only" checked={form.question_type === t} onChange={() => handleTypeChange(t)} />
                            <Icon className="w-3.5 h-3.5 text-gray-600" />
                            <span className="text-xs font-medium text-gray-700 capitalize">{t.replace('_', ' ')}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Points</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={form.points}
                      onChange={e => setForm(f => ({ ...f, points: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                    />
                  </div>
                </div>

                {form.question_type === 'mcq' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Answer Options</label>
                    <div className="space-y-2">
                      {(form.options || []).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <label className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                              type="radio"
                              name="correct_answer"
                              checked={form.correct_answer === opt && opt !== ''}
                              onChange={() => setForm(f => ({ ...f, correct_answer: opt }))}
                              className="w-3.5 h-3.5 accent-emerald-600 flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={e => handleOptionChange(oi, e.target.value)}
                              placeholder={`Option ${oi + 1}`}
                              className={`flex-1 px-2.5 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none ${form.correct_answer === opt && opt !== '' ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300'}`}
                            />
                          </label>
                          {(form.options || []).length > 2 && (
                            <button type="button" onClick={() => removeOption(oi)} className="p-1 text-red-400 hover:bg-red-50 rounded flex-shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      {(form.options || []).length < 6 && (
                        <button type="button" onClick={addOption} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition">
                          <Plus className="w-3 h-3" /> Add option
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">Select the radio button next to the correct answer</p>
                  </div>
                )}

                {form.question_type === 'true_false' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Correct Answer</label>
                    <div className="flex gap-3">
                      {['True', 'False'].map(v => (
                        <label key={v} className={`flex items-center gap-2 flex-1 p-2.5 rounded-lg border cursor-pointer transition ${form.correct_answer === v ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}>
                          <input type="radio" checked={form.correct_answer === v} onChange={() => setForm(f => ({ ...f, correct_answer: v }))} className="accent-emerald-600" />
                          <span className="text-sm font-medium text-gray-700">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {form.question_type === 'short_answer' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">Short answer questions are open-ended and will be marked as correct when the learner submits an answer. Points are awarded automatically for completion.</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={saving} className="flex-1 bg-stratefix-yellow text-stratefix-black py-2.5 rounded-lg font-semibold text-sm hover:bg-yellow-500 transition disabled:opacity-50">
                    {saving ? 'Saving...' : editingQuestion ? 'Save Changes' : 'Add Question'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteId && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Delete Question</h3>
              <p className="text-sm text-gray-500 mb-5">This question and all learner responses will be permanently deleted.</p>
              <div className="flex gap-3">
                <button onClick={handleDelete} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition">Delete</button>
                <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200 transition">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
