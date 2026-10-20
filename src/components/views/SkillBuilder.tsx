import { useState, useEffect, useRef } from 'react';
import {
  Plus, Edit2, Trash2, Award, AlertCircle, Sparkles, X,
  ChevronDown, ChevronUp, Copy, ToggleLeft, ToggleRight, Users, CheckCircle, GripVertical,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AIQuestionGenerator from './skill-builder/AIQuestionGenerator';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
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

interface RoleMapping {
  designation_id: string;
  designation_title: string;
  is_mandatory: boolean;
  minimum_score: number;
}

const EMPTY_QUESTION = {
  question_text: '',
  option_1: '',
  option_2: '',
  option_3: '',
  option_4: '',
  correct_option: 1,
  difficulty: 'medium',
};

function CollapsibleQuestion({
  question,
  index,
  getDifficultyColor,
  onEdit,
  onDelete,
}: {
  question: SkillQuestion;
  index: number;
  getDifficultyColor: (d: string) => string;
  onEdit: (q: SkillQuestion) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-500 flex-shrink-0">Q{index + 1}.</span>
          <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${getDifficultyColor(question.difficulty)}`}>
            {question.difficulty}
          </span>
          <p className="text-sm text-gray-900 truncate">{question.question_text}</p>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(question); }}
            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(question.id); }}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <p className="text-gray-900 mb-3 text-sm font-medium">{question.question_text}</p>
          <div className="space-y-1">
            {[1, 2, 3, 4].map((num) => (
              <div
                key={num}
                className={`text-sm p-2 rounded ${
                  question.correct_option === num
                    ? 'bg-green-50 text-green-800 font-medium'
                    : 'text-gray-600'
                }`}
              >
                {num}. {question[`option_${num}` as keyof SkillQuestion]}
              </div>
            ))}
            <div className="text-sm p-2 rounded text-gray-400 italic">
              5. Don't Know / Not Sure
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface QuestionFormState {
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
  difficulty: string;
}

function OptionsList({
  questionForm,
  setQuestionForm,
}: {
  questionForm: QuestionFormState;
  setQuestionForm: (fn: (prev: QuestionFormState) => QuestionFormState) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const optKeys = ['option_1', 'option_2', 'option_3', 'option_4'] as const;
  const vals = optKeys.map(k => questionForm[k]);

  const handleDragStart = (i: number) => { dragIndex.current = i; };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, i: number) => {
    e.preventDefault();
    setDragOver(i);
  };

  const handleDrop = (dropIndex: number) => {
    const from = dragIndex.current;
    if (from === null || from === dropIndex) {
      dragIndex.current = null;
      setDragOver(null);
      return;
    }
    const reordered = [...vals];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(dropIndex, 0, moved);

    setQuestionForm(prev => {
      const oldCorrectIdx = prev.correct_option - 1;
      let newCorrectIdx = oldCorrectIdx;
      if (oldCorrectIdx === from) {
        newCorrectIdx = dropIndex;
      } else if (from < oldCorrectIdx && dropIndex >= oldCorrectIdx) {
        newCorrectIdx = oldCorrectIdx - 1;
      } else if (from > oldCorrectIdx && dropIndex <= oldCorrectIdx) {
        newCorrectIdx = oldCorrectIdx + 1;
      }
      return {
        ...prev,
        option_1: reordered[0],
        option_2: reordered[1],
        option_3: reordered[2],
        option_4: reordered[3],
        correct_option: newCorrectIdx + 1,
      };
    });

    dragIndex.current = null;
    setDragOver(null);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDragOver(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">Answer Options *</label>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <GripVertical className="w-3 h-3" /> Drag to reorder
        </span>
      </div>
      {vals.map((val, i) => {
        const isCorrect = questionForm.correct_option === i + 1;
        const isDragTarget = dragOver === i;
        return (
          <div
            key={i}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 rounded-lg border-2 transition-all select-none ${
              isDragTarget
                ? 'border-blue-400 bg-blue-50'
                : isCorrect
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="pl-2 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0">
              <GripVertical className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-gray-500 flex-shrink-0 w-5">
              {String.fromCharCode(65 + i)}.
            </span>
            <input
              type="text"
              required
              value={val}
              onChange={(e) => {
                const key = `option_${i + 1}` as keyof QuestionFormState;
                setQuestionForm(prev => ({ ...prev, [key]: e.target.value }));
              }}
              className="flex-1 py-2 bg-transparent focus:outline-none text-sm text-gray-800"
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
            />
            <button
              type="button"
              onClick={() => setQuestionForm(prev => ({ ...prev, correct_option: i + 1 }))}
              className={`mr-2 flex-shrink-0 text-xs px-2.5 py-1 rounded-md font-semibold transition ${
                isCorrect
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700'
              }`}
              title="Mark as correct answer"
            >
              {isCorrect ? 'Correct' : 'Mark correct'}
            </button>
          </div>
        );
      })}
      <div className="flex items-center gap-2 opacity-40 border border-dashed border-gray-200 rounded-lg px-3 py-2 mt-1">
        <span className="text-sm font-semibold text-gray-500 w-5">E.</span>
        <span className="text-sm text-gray-400 italic">Don't Know / Not Sure (always fixed)</span>
      </div>
    </div>
  );
}

export default function SkillBuilder() {
  const { userProfile } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedSkillData, setSelectedSkillData] = useState<Skill | null>(null);
  const [questions, setQuestions] = useState<SkillQuestion[]>([]);
  const [roleMappings, setRoleMappings] = useState<RoleMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SkillQuestion | null>(null);
  const [questionError, setQuestionError] = useState('');
  const [aiConfigured, setAiConfigured] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [skillForm, setSkillForm] = useState({
    name: '',
    description: '',
    category: '',
    is_active: true,
    bullets: ['', '', ''],
  });

  const [questionForm, setQuestionForm] = useState(EMPTY_QUESTION);

  useEffect(() => {
    if (userProfile?.organization_id) {
      loadSkills();
      checkAIConfig();
    }
  }, [userProfile?.organization_id]);

  useEffect(() => {
    if (selectedSkill) {
      loadQuestions(selectedSkill);
      loadRoleMappings(selectedSkill);
      setSelectedSkillData(skills.find(s => s.id === selectedSkill) || null);
    }
  }, [selectedSkill, skills]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const checkAIConfig = async () => {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'openrouter_api_key')
      .maybeSingle();
    setAiConfigured(!!(data?.value));
  };

  const loadSkills = async () => {
    try {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .eq('organization_id', userProfile?.organization_id)
        .order('name', { ascending: true });
      if (error) throw error;
      setSkills(data || []);
    } catch (error) {
      console.error('Error loading skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async (skillId: string) => {
    try {
      const { data, error } = await supabase
        .from('skill_questions')
        .select('*')
        .eq('skill_id', skillId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error('Error loading questions:', error);
    }
  };

  const loadRoleMappings = async (skillId: string) => {
    try {
      const { data } = await supabase
        .from('skill_role_mappings')
        .select('designation_id, designation_title, is_mandatory, minimum_score')
        .eq('skill_id', skillId);
      setRoleMappings((data as RoleMapping[]) || []);
    } catch {
      setRoleMappings([]);
    }
  };

  const buildDescription = () => {
    const bullets = skillForm.bullets.filter(b => b.trim());
    if (!bullets.length) return skillForm.description;
    return `${skillForm.description}\n\nBehaviours:\n${bullets.map(b => `• ${b}`).join('\n')}`;
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    const filledBullets = skillForm.bullets.filter(b => b.trim());
    if (filledBullets.length < 3) {
      alert('Please add at least 3 behaviour bullet points describing what this skill looks like in practice.');
      return;
    }
    try {
      const { error } = await supabase.from('skills').insert([{
        name: skillForm.name,
        description: buildDescription(),
        category: skillForm.category,
        is_active: skillForm.is_active,
        organization_id: userProfile?.organization_id,
      }]);
      if (error) throw error;
      setShowSkillForm(false);
      setSkillForm({ name: '', description: '', category: '', is_active: true, bullets: ['', '', ''] });
      loadSkills();
      showToast('Skill created successfully.');
    } catch (error) {
      console.error('Error creating skill:', error);
    }
  };

  const handleToggleActive = async (skill: Skill) => {
    if (skill.is_active && roleMappings.length > 0 && selectedSkill === skill.id) {
      alert(`Cannot deactivate "${skill.name}" — it is currently mapped to ${roleMappings.length} role(s): ${roleMappings.map(r => r.designation_title).join(', ')}. Remove it from those roles first.`);
      return;
    }
    try {
      const { error } = await supabase
        .from('skills')
        .update({ is_active: !skill.is_active })
        .eq('id', skill.id);
      if (error) throw error;
      await loadSkills();
      showToast(skill.is_active ? 'Skill deactivated.' : 'Skill activated.');
    } catch (err) {
      console.error('Error toggling skill:', err);
    }
  };

  const handleDuplicateSkill = async (skill: Skill) => {
    if (!confirm(`Duplicate "${skill.name}" along with all its questions?`)) return;
    try {
      const { data: newSkill, error: sErr } = await supabase
        .from('skills')
        .insert([{
          name: `${skill.name} (Copy)`,
          description: skill.description,
          category: skill.category,
          is_active: false,
          organization_id: userProfile?.organization_id,
        }])
        .select()
        .single();
      if (sErr) throw sErr;

      const { data: srcQuestions } = await supabase
        .from('skill_questions')
        .select('*')
        .eq('skill_id', skill.id)
        .order('order_index');

      if (srcQuestions && srcQuestions.length > 0) {
        const copies = srcQuestions.map(q => ({
          skill_id: newSkill.id,
          question_text: q.question_text,
          option_1: q.option_1,
          option_2: q.option_2,
          option_3: q.option_3,
          option_4: q.option_4,
          option_5: q.option_5,
          correct_option: q.correct_option,
          difficulty: q.difficulty,
          order_index: q.order_index,
        }));
        const { error: qErr } = await supabase.from('skill_questions').insert(copies);
        if (qErr) throw qErr;
      }

      await loadSkills();
      setSelectedSkill(newSkill.id);
      showToast(`Duplicated as "${newSkill.name}" with ${srcQuestions?.length ?? 0} question(s). Activate when ready.`);
    } catch (err: any) {
      alert('Duplicate failed: ' + err.message);
    }
  };

  const saveQuestion = async (form: typeof EMPTY_QUESTION) => {
    setQuestionError('');
    try {
      if (editingQuestion) {
        const { error } = await supabase
          .from('skill_questions')
          .update({
            question_text: form.question_text,
            option_1: form.option_1,
            option_2: form.option_2,
            option_3: form.option_3,
            option_4: form.option_4,
            option_5: "Don't Know / Not Sure",
            correct_option: form.correct_option,
            difficulty: form.difficulty,
          })
          .eq('id', editingQuestion.id);
        if (error) throw error;
      } else {
        if (questions.length >= 20) {
          alert('A skill can have maximum 20 questions');
          return;
        }
        const { error } = await supabase.from('skill_questions').insert([{
          skill_id: selectedSkill,
          question_text: form.question_text,
          option_1: form.option_1,
          option_2: form.option_2,
          option_3: form.option_3,
          option_4: form.option_4,
          option_5: "Don't Know / Not Sure",
          correct_option: form.correct_option,
          difficulty: form.difficulty,
          order_index: questions.length + 1,
        }]);
        if (error) throw error;
      }
      setShowQuestionForm(false);
      setEditingQuestion(null);
      setQuestionForm(EMPTY_QUESTION);
      loadQuestions(selectedSkill!);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save question.';
      setQuestionError(msg);
      throw error;
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveQuestion(questionForm);
    } catch {
      /* error already set */
    }
  };

  const handleAIAccept = async (q: Omit<typeof EMPTY_QUESTION, never>) => {
    setShowAIGenerator(false);
    try {
      await saveQuestion(q);
    } catch {
      /* show error inline if needed */
    }
  };

  const handleEditQuestion = (question: SkillQuestion) => {
    setEditingQuestion(question);
    setQuestionForm({
      question_text: question.question_text,
      option_1: question.option_1,
      option_2: question.option_2,
      option_3: question.option_3,
      option_4: question.option_4,
      correct_option: question.correct_option,
      difficulty: question.difficulty,
    });
    setShowQuestionForm(true);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const { error } = await supabase.from('skill_questions').delete().eq('id', questionId);
      if (error) throw error;
      loadQuestions(selectedSkill!);
    } catch (error) {
      console.error('Error deleting question:', error);
    }
  };

  const getDifficultyColor = (d: string) => {
    const m: Record<string, string> = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800',
    };
    return m[d] || 'bg-gray-100 text-gray-800';
  };

  const addBullet = () => setSkillForm(f => ({ ...f, bullets: [...f.bullets, ''] }));
  const removeBullet = (i: number) => setSkillForm(f => ({ ...f, bullets: f.bullets.filter((_, idx) => idx !== i) }));
  const updateBullet = (i: number, val: string) =>
    setSkillForm(f => ({ ...f, bullets: f.bullets.map((b, idx) => (idx === i ? val : b)) }));

  const filledBulletCount = skillForm.bullets.filter(b => b.trim()).length;

  const visibleSkills = showInactive ? skills : skills.filter(s => s.is_active);
  const inactiveCount = skills.filter(s => !s.is_active).length;

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Skill Question Builder</h1>
          <p className="text-gray-600">Create skills with up to 20 assessment questions each</p>
        </div>
        <button
          onClick={() => setShowSkillForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-500 transition font-semibold"
        >
          <Plus className="w-5 h-5" />
          New Skill
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Skills</h2>
            {inactiveCount > 0 && (
              <button
                onClick={() => setShowInactive(v => !v)}
                className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition"
              >
                {showInactive ? <ToggleRight className="w-4 h-4 text-blue-600" /> : <ToggleLeft className="w-4 h-4" />}
                {showInactive ? 'Hide inactive' : `+${inactiveCount} inactive`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {visibleSkills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => setSelectedSkill(skill.id)}
                className={`w-full text-left p-3 rounded-lg border transition ${
                  selectedSkill === skill.id
                    ? 'border-stratefix-yellow bg-yellow-50'
                    : skill.is_active
                    ? 'border-gray-200 hover:border-stratefix-yellow'
                    : 'border-gray-100 bg-gray-50 opacity-60 hover:opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{skill.name}</div>
                    <div className="text-xs text-gray-500">{skill.category}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    {!skill.is_active && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded font-medium">
                        Inactive
                      </span>
                    )}
                    <Award className="w-4 h-4 text-stratefix-yellow" />
                  </div>
                </div>
              </button>
            ))}
            {visibleSkills.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">No skills yet. Create your first skill.</p>
            )}
          </div>
        </div>

        <div className="col-span-2">
          {selectedSkill && selectedSkillData ? (
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-gray-900">{selectedSkillData.name}</h2>
                      {selectedSkillData.is_active ? (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full font-medium">
                          Inactive
                        </span>
                      )}
                      {selectedSkillData.category && (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                          {selectedSkillData.category}
                        </span>
                      )}
                    </div>
                    {roleMappings.length > 0 ? (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-500">Mapped to:</span>
                        {roleMappings.map(r => (
                          <span key={r.designation_id} className={`text-xs px-2 py-0.5 rounded font-medium ${r.is_mandatory ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {r.designation_title}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Not mapped to any role yet
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDuplicateSkill(selectedSkillData)}
                      title="Duplicate skill with all questions"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition font-medium"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleToggleActive(selectedSkillData)}
                      title={selectedSkillData.is_active ? 'Deactivate skill' : 'Activate skill'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition font-medium ${
                        selectedSkillData.is_active
                          ? 'border border-red-200 text-red-600 hover:bg-red-50'
                          : 'border border-green-200 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {selectedSkillData.is_active
                        ? <><ToggleRight className="w-3.5 h-3.5" /> Deactivate</>
                        : <><ToggleLeft className="w-3.5 h-3.5" /> Activate</>
                      }
                    </button>
                  </div>
                </div>
              </div>

              {!selectedSkillData.is_active && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  This skill is inactive and will not appear in assessments. Activate it when the question bank is ready.
                </div>
              )}

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold">Questions ({questions.length}/20)</h2>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium">
                        Easy: {questions.filter(q => q.difficulty === 'easy').length}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 font-medium">
                        Medium: {questions.filter(q => q.difficulty === 'medium').length}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 font-medium">
                        Hard: {questions.filter(q => q.difficulty === 'hard').length}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {aiConfigured && questions.length < 20 && (
                      <button
                        onClick={() => setShowAIGenerator(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition font-semibold text-sm"
                      >
                        <Sparkles className="w-4 h-4" />
                        AI Generate
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (questions.length >= 20) {
                          alert('Maximum 20 questions allowed per skill');
                          return;
                        }
                        setEditingQuestion(null);
                        setQuestionForm(EMPTY_QUESTION);
                        setShowQuestionForm(true);
                      }}
                      disabled={questions.length >= 20}
                      className="flex items-center gap-2 px-4 py-2 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-500 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-5 h-5" />
                      Add Question
                    </button>
                  </div>
                </div>

                {!aiConfigured && (
                  <div className="mb-4 flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                    <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                    AI question generation is not enabled. A platform administrator can configure OpenRouter in the Super Admin dashboard.
                  </div>
                )}

                {questions.length === 0 ? (
                  <div className="text-center py-12">
                    <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No questions yet</h3>
                    <p className="text-gray-600">Add questions manually or use AI to generate them.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {questions.map((question, index) => (
                      <CollapsibleQuestion
                        key={question.id}
                        question={question}
                        index={index}
                        getDifficultyColor={getDifficultyColor}
                        onEdit={handleEditQuestion}
                        onDelete={handleDeleteQuestion}
                      />
                    ))}
                  </div>
                )}

                {questions.length < 20 && questions.length > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-900">Incomplete Skill Assessment</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        Add {20 - questions.length} more question{20 - questions.length !== 1 ? 's' : ''} to complete this skill assessment.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100">
              <div className="text-center">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No skill selected</h3>
                <p className="text-gray-600">Select a skill from the list to view and manage questions</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAIGenerator && selectedSkillData && (
        <AIQuestionGenerator
          skillName={selectedSkillData.name}
          skillDescription={selectedSkillData.description || ''}
          existingQuestions={questions.map(q => q.question_text)}
          questionCount={questions.length}
          maxQuestions={20}
          onAccept={handleAIAccept}
          onClose={() => setShowAIGenerator(false)}
        />
      )}

      {showSkillForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Create Skill</h2>
              <button onClick={() => setShowSkillForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateSkill} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Skill Title *</label>
                  <input
                    type="text"
                    required
                    value={skillForm.name}
                    onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                    placeholder="e.g., Excel, Communication, Python"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={skillForm.category}
                    onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                    placeholder="e.g., Technical, Soft Skills"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                <textarea
                  value={skillForm.description}
                  onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                  placeholder="One or two sentences about what this skill is."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Demonstrated Behaviours *
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Describe what a person with this skill actually does — at least 3 bullet points.
                      The AI uses these to generate relevant questions.
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${filledBulletCount >= 3 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {filledBulletCount}/3 min
                  </span>
                </div>
                <div className="space-y-2">
                  {skillForm.bullets.map((bullet, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm font-medium w-4">•</span>
                      <input
                        type="text"
                        value={bullet}
                        onChange={e => updateBullet(i, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                        placeholder={`e.g., ${i === 0 ? 'Uses pivot tables to summarise data quickly' : i === 1 ? 'Applies formulas to automate repetitive calculations' : 'Identifies and fixes errors in spreadsheet formulas'}`}
                      />
                      {skillForm.bullets.length > 3 && (
                        <button type="button" onClick={() => removeBullet(i)} className="text-gray-400 hover:text-red-500 p-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addBullet}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add another behaviour
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-stratefix-yellow text-stratefix-black py-2.5 rounded-lg hover:bg-yellow-500 transition font-semibold"
                >
                  Create Skill
                </button>
                <button
                  type="button"
                  onClick={() => setShowSkillForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQuestionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingQuestion ? 'Edit' : 'Add'} Question</h2>
              <button onClick={() => { setShowQuestionForm(false); setEditingQuestion(null); setQuestionError(''); }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {questionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {questionError}
              </div>
            )}
            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question *</label>
                <textarea
                  required
                  value={questionForm.question_text}
                  onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                  placeholder="Write a clear, simple question in plain English..."
                />
              </div>
              <OptionsList
                questionForm={questionForm}
                setQuestionForm={setQuestionForm as (fn: (prev: QuestionFormState) => QuestionFormState) => void}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                <select
                  value={questionForm.difficulty}
                  onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-stratefix-yellow text-stratefix-black py-2 rounded-lg hover:bg-yellow-500 transition font-semibold"
                >
                  {editingQuestion ? 'Update' : 'Add'} Question
                </button>
                <button
                  type="button"
                  onClick={() => { setShowQuestionForm(false); setEditingQuestion(null); setQuestionError(''); }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
