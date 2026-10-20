import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, FileText, AlertCircle, BookOpen, CheckCircle, Loader2, XCircle, Sparkles, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AIAssessmentGenerator from './assessments/AIAssessmentGenerator';

interface DomainAssessment {
  id: string;
  title: string;
  description: string | null;
  designation_id: string | null;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  ai_generated?: boolean;
  job_description?: string | null;
  designation?: { title: string } | null;
  department?: { name: string } | null;
  question_count?: number;
}

interface DomainQuestion {
  id: string;
  assessment_id: string;
  question_number: number;
  question_text: string;
  question_type: string;
  options: string[] | null;
  correct_answer: string | null;
  points: number;
  difficulty?: string | null;
  explanation?: string | null;
}

interface Designation {
  id: string;
  title: string;
  department_id: string | null;
}

interface Department {
  id: string;
  name: string;
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function Assessments() {
  const { userProfile } = useAuth();
  const [assessments, setAssessments] = useState<DomainAssessment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DomainQuestion[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<DomainQuestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aiConfigured, setAiConfigured] = useState(false);

  const [assessmentForm, setAssessmentForm] = useState({
    title: '', description: '', department_id: '', designation_id: ''
  });
  const [questionForm, setQuestionForm] = useState({
    question_text: '', option_1: '', option_2: '', option_3: '', option_4: '', correct_answer: '', points: 1
  });

  useEffect(() => {
    if (userProfile?.organization_id) loadData();
  }, [userProfile?.organization_id]);

  useEffect(() => {
    if (selectedId) loadQuestions(selectedId);
  }, [selectedId]);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadAssessments(), loadDesignations(), loadDepartments(), checkAIConfig()]);
    setLoading(false);
  }

  async function loadDepartments() {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', userProfile!.organization_id)
      .order('name');
    if (data) setDepartments(data);
  }

  async function checkAIConfig() {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .maybeSingle();
    setAiConfigured(!!(data?.value));
  }

  async function loadAssessments() {
    const { data } = await supabase
      .from('candidate_domain_assessments')
      .select('*, designation:designations(title), department:departments(name)')
      .eq('organization_id', userProfile!.organization_id)
      .order('created_at', { ascending: false });

    if (data) {
      const withCounts = await Promise.all(data.map(async a => {
        const { count } = await supabase
          .from('domain_assessment_questions')
          .select('*', { count: 'exact', head: true })
          .eq('assessment_id', a.id);
        return { ...a, question_count: count || 0 };
      }));
      setAssessments(withCounts as DomainAssessment[]);
    }
  }

  async function loadQuestions(assessmentId: string) {
    const { data } = await supabase
      .from('domain_assessment_questions')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('question_number', { ascending: true });
    if (data) setQuestions(data as DomainQuestion[]);
  }

  async function loadDesignations() {
    const { data } = await supabase
      .from('designations')
      .select('id, title, department_id')
      .eq('organization_id', userProfile!.organization_id)
      .order('title');
    if (data) setDesignations(data as Designation[]);
  }

  async function handleCreateAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!assessmentForm.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    const { error: err, data } = await supabase.from('candidate_domain_assessments').insert({
      organization_id: userProfile!.organization_id,
      title: assessmentForm.title.trim(),
      description: assessmentForm.description.trim() || null,
      department_id: assessmentForm.department_id || null,
      designation_id: assessmentForm.designation_id || null,
      created_by: userProfile!.id,
      is_active: true
    }).select('id').maybeSingle();
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowAssessmentForm(false);
    setAssessmentForm({ title: '', description: '', department_id: '', designation_id: '' });
    await loadAssessments();
    if (data) setSelectedId(data.id);
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!questionForm.question_text.trim()) { setError('Question text is required.'); return; }
    setSaving(true); setError('');

    const options = [questionForm.option_1, questionForm.option_2, questionForm.option_3, questionForm.option_4].filter(o => o.trim());
    const payload = {
      question_text: questionForm.question_text.trim(),
      question_type: 'multiple_choice',
      options: options.length > 0 ? options : null,
      correct_answer: questionForm.correct_answer || null,
      points: questionForm.points
    };

    if (editingQuestion) {
      const { error: err } = await supabase.from('domain_assessment_questions').update(payload).eq('id', editingQuestion.id);
      if (err) { setSaving(false); setError(err.message); return; }
    } else {
      const { error: err } = await supabase.from('domain_assessment_questions').insert({
        ...payload,
        assessment_id: selectedId,
        question_number: questions.length + 1
      });
      if (err) { setSaving(false); setError(err.message); return; }
    }

    setSaving(false);
    setShowQuestionForm(false);
    setEditingQuestion(null);
    resetQuestionForm();
    await loadQuestions(selectedId!);
    await loadAssessments();
  }

  async function handleAIGeneratorComplete(
    jobDescription: string,
    generatedQuestions: {
      question_text: string;
      option_1: string;
      option_2: string;
      option_3: string;
      option_4: string;
      correct_option: number;
      difficulty: string;
    }[]
  ) {
    if (!selectedId) return;
    setSaving(true);
    setShowAIGenerator(false);

    await supabase
      .from('candidate_domain_assessments')
      .update({ job_description: jobDescription, ai_generated: true })
      .eq('id', selectedId);

    const startNumber = questions.length + 1;
    const rows = generatedQuestions.map((q, i) => {
      const opts = [q.option_1, q.option_2, q.option_3, q.option_4];
      const correctAnswer = opts[q.correct_option - 1];
      return {
        assessment_id: selectedId,
        question_number: startNumber + i,
        question_text: q.question_text,
        question_type: 'multiple_choice',
        options: opts,
        correct_answer: correctAnswer,
        points: 1,
        difficulty: q.difficulty,
      };
    });

    await supabase.from('domain_assessment_questions').insert(rows);
    setSaving(false);
    await loadQuestions(selectedId);
    await loadAssessments();
  }

  function resetQuestionForm() {
    setQuestionForm({ question_text: '', option_1: '', option_2: '', option_3: '', option_4: '', correct_answer: '', points: 1 });
  }

  function openEditQuestion(q: DomainQuestion) {
    setEditingQuestion(q);
    const opts = q.options || [];
    setQuestionForm({
      question_text: q.question_text,
      option_1: opts[0] || '', option_2: opts[1] || '', option_3: opts[2] || '', option_4: opts[3] || '',
      correct_answer: q.correct_answer || '',
      points: q.points
    });
    setError('');
    setShowQuestionForm(true);
  }

  async function handleDeleteQuestion(id: string) {
    if (!confirm('Delete this question?')) return;
    await supabase.from('domain_assessment_questions').delete().eq('id', id);
    await loadQuestions(selectedId!);
    await loadAssessments();
  }

  async function handleToggleActive(assessment: DomainAssessment) {
    await supabase.from('candidate_domain_assessments').update({ is_active: !assessment.is_active }).eq('id', assessment.id);
    await loadAssessments();
  }

  function handleExport(assessment: DomainAssessment) {
    const lines: string[] = [];
    lines.push(`KNOWLEDGE ASSESSMENT: ${assessment.title}`);
    lines.push('='.repeat(60));
    if (assessment.description) {
      lines.push(`Description: ${assessment.description}`);
    }
    if (assessment.designation?.title) {
      lines.push(`Role: ${assessment.designation.title}`);
    }
    if (assessment.ai_generated) {
      lines.push(`Generated: AI-assisted`);
    }
    lines.push(`Total Questions: ${questions.length}`);
    lines.push(`Status: ${assessment.is_active ? 'Active' : 'Inactive'}`);
    lines.push('');
    lines.push('QUESTIONS FOR SME REVIEW');
    lines.push('-'.repeat(60));
    lines.push('');

    questions.forEach((q, i) => {
      lines.push(`Q${i + 1}. ${q.question_text}`);
      if (q.difficulty) lines.push(`     Difficulty: ${q.difficulty}`);
      if (q.options) {
        q.options.forEach((opt, j) => {
          const letter = String.fromCharCode(65 + j);
          const isCorrect = opt === q.correct_answer;
          lines.push(`     ${letter}. ${opt}${isCorrect ? '  [CORRECT]' : ''}`);
        });
      }
      lines.push(`     Points: ${q.points}`);
      lines.push('');
    });

    lines.push('='.repeat(60));
    lines.push('SME REVIEW NOTES');
    lines.push('-'.repeat(60));
    lines.push('');
    questions.forEach((_, i) => {
      lines.push(`Q${i + 1}: _______________________________________________`);
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assessment.title.replace(/\s+/g, '_')}_SME_Review.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const selectedAssessment = assessments.find(a => a.id === selectedId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assessment Builder</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create knowledge assessments to send to candidates</p>
          </div>
          <button
            onClick={() => { setShowAssessmentForm(true); setError(''); setAssessmentForm({ title: '', description: '', department_id: '', designation_id: '' }); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-950 text-white rounded-lg hover:bg-blue-900 transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Assessment
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Knowledge Assessments ({assessments.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {assessments.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No assessments yet</p>
                <p className="text-xs text-gray-400">Create your first assessment</p>
              </div>
            ) : (
              assessments.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${selectedId === a.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-gray-900 text-sm truncate">{a.title}</div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {a.ai_generated && <Sparkles className="w-3 h-3 text-amber-500" />}
                      {!a.is_active && <span className="text-xs text-gray-400">Inactive</span>}
                    </div>
                  </div>
                  {(a.department?.name || a.designation?.title) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {a.department?.name}{a.department?.name && a.designation?.title ? ' · ' : ''}{a.designation?.title}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{a.question_count} question{a.question_count !== 1 ? 's' : ''}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!selectedAssessment ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileText className="w-12 h-12 text-gray-300 mb-3" />
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Select an assessment</h3>
              <p className="text-xs text-gray-500">Choose an assessment from the left panel or create a new one</p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-gray-900 text-lg">{selectedAssessment.title}</h2>
                      {selectedAssessment.ai_generated && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                          <Sparkles className="w-3 h-3" /> AI Generated
                        </span>
                      )}
                    </div>
                    {selectedAssessment.description && <p className="text-sm text-gray-600 mt-1">{selectedAssessment.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {selectedAssessment.department?.name && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{selectedAssessment.department.name}</span>}
                      {selectedAssessment.designation?.title && <span className="bg-gray-100 px-2 py-0.5 rounded">{selectedAssessment.designation.title}</span>}
                      <span>{selectedAssessment.question_count} questions</span>
                      <span className={`px-2 py-0.5 rounded font-medium ${selectedAssessment.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {selectedAssessment.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {questions.length > 0 && (
                      <button
                        onClick={() => handleExport(selectedAssessment)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-600"
                      >
                        <Download className="w-3.5 h-3.5" /> Export for SME
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleActive(selectedAssessment)}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-600"
                    >
                      {selectedAssessment.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    {aiConfigured && (
                      <button
                        onClick={() => setShowAIGenerator(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> AI Generate
                      </button>
                    )}
                    <button
                      onClick={() => { setEditingQuestion(null); resetQuestionForm(); setError(''); setShowQuestionForm(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white rounded-lg text-sm font-medium hover:bg-blue-900 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Question
                    </button>
                  </div>
                </div>
              </div>

              {!aiConfigured && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                  <span>AI question generation is not configured. Ask your platform administrator to set up the OpenAI API key in Settings.</span>
                </div>
              )}

              {questions.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">No questions yet</h3>
                  <p className="text-xs text-gray-500 mb-4">Add questions manually or use AI to generate them from a job description</p>
                  <div className="flex items-center justify-center gap-3">
                    {aiConfigured && (
                      <button
                        onClick={() => setShowAIGenerator(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Generate with AI
                      </button>
                    )}
                    <button
                      onClick={() => { resetQuestionForm(); setError(''); setShowQuestionForm(true); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-950 text-white rounded-lg text-sm font-medium hover:bg-blue-900 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Manually
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 bg-blue-950 text-white rounded-full text-xs flex items-center justify-center font-semibold flex-shrink-0">{idx + 1}</span>
                            <span className="text-xs text-gray-500">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                            {q.difficulty && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {q.difficulty}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 mb-3">{q.question_text}</p>
                          {q.options && q.options.length > 0 && (
                            <div className="space-y-1.5">
                              {q.options.map((opt, i) => (
                                <div key={i} className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${opt === q.correct_answer ? 'bg-green-50 border border-green-200 text-green-800 font-medium' : 'bg-gray-50 text-gray-600'}`}>
                                  {opt === q.correct_answer && <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                                  <span className="text-xs text-gray-400 font-medium w-4">{String.fromCharCode(65 + i)}.</span>
                                  {opt}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEditQuestion(q)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteQuestion(q.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAIGenerator && selectedId && (
        <AIAssessmentGenerator
          onComplete={handleAIGeneratorComplete}
          onClose={() => setShowAIGenerator(false)}
        />
      )}

      {showAssessmentForm && (
        <ModalOverlay title="Create Knowledge Assessment" onClose={() => setShowAssessmentForm(false)}>
          <form onSubmit={handleCreateAssessment} className="space-y-4">
            {error && <ErrorAlert message={error} />}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input className={inputCls} value={assessmentForm.title} onChange={e => setAssessmentForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Sales Executive Knowledge Test" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea rows={2} className={inputCls} value={assessmentForm.description} onChange={e => setAssessmentForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of what this assessment tests..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department (optional)</label>
                <select
                  className={inputCls}
                  value={assessmentForm.department_id}
                  onChange={e => setAssessmentForm(p => ({ ...p, department_id: e.target.value, designation_id: '' }))}
                >
                  <option value="">All departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Role (optional)</label>
                <select
                  className={inputCls}
                  value={assessmentForm.designation_id}
                  onChange={e => setAssessmentForm(p => ({ ...p, designation_id: e.target.value }))}
                >
                  <option value="">Any role</option>
                  {designations
                    .filter(d => !assessmentForm.department_id || d.department_id === assessmentForm.department_id)
                    .map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAssessmentForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-950 text-white rounded-lg hover:bg-blue-900 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Create Assessment
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {showQuestionForm && (
        <ModalOverlay title={editingQuestion ? 'Edit Question' : 'Add Question'} onClose={() => { setShowQuestionForm(false); setEditingQuestion(null); }}>
          <form onSubmit={handleSaveQuestion} className="space-y-4">
            {error && <ErrorAlert message={error} />}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question *</label>
              <textarea rows={3} className={inputCls} value={questionForm.question_text} onChange={e => setQuestionForm(p => ({ ...p, question_text: e.target.value }))} placeholder="Enter the question..." />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Answer Options</label>
              {[1, 2, 3, 4].map(num => (
                <div key={num} className="flex items-center gap-2">
                  <span className="w-6 text-xs font-semibold text-gray-500 text-center">{String.fromCharCode(64 + num)}.</span>
                  <input
                    className={inputCls}
                    value={questionForm[`option_${num}` as keyof typeof questionForm] as string}
                    onChange={e => setQuestionForm(p => ({ ...p, [`option_${num}`]: e.target.value }))}
                    placeholder={`Option ${num}`}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                <select className={inputCls} value={questionForm.correct_answer} onChange={e => setQuestionForm(p => ({ ...p, correct_answer: e.target.value }))}>
                  <option value="">Select correct option</option>
                  {[questionForm.option_1, questionForm.option_2, questionForm.option_3, questionForm.option_4]
                    .filter(o => o.trim())
                    .map((opt, i) => <option key={i} value={opt}>{String.fromCharCode(65 + i)}. {opt}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                <input type="number" min={1} max={10} className={inputCls} value={questionForm.points} onChange={e => setQuestionForm(p => ({ ...p, points: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowQuestionForm(false); setEditingQuestion(null); }} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-950 text-white rounded-lg hover:bg-blue-900 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                {editingQuestion ? 'Update' : 'Add'} Question
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </div>
  );
}

function ModalOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />{message}
    </div>
  );
}
