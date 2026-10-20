import { useState, useEffect } from 'react';
import { Plus, Trash2, Award, AlertCircle, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface Skill {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface Designation {
  id: string;
  title: string;
  department_id: string;
  departments?: { name: string };
}

interface RoleSkill {
  id: string;
  designation_id: string;
  skill_id: string;
  is_mandatory: boolean;
  minimum_score: number;
  skills: Skill;
}

export default function AdminSkillMapping() {
  const { userProfile } = useAuth();
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [roleSkills, setRoleSkills] = useState<Record<string, RoleSkill[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showAssignForm, setShowAssignForm] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ skill_id: '', is_mandatory: true, minimum_score: 70 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userProfile?.organization_id) load();
  }, [userProfile?.organization_id]);

  const load = async () => {
    setLoading(true);
    try {
      const [desRes, skillRes] = await Promise.all([
        supabase
          .from('designations')
          .select('id, title, department_id, departments(name)')
          .eq('organization_id', userProfile!.organization_id)
          .order('title'),
        supabase
          .from('skills')
          .select('id, name, category, description')
          .eq('organization_id', userProfile!.organization_id)
          .order('name'),
      ]);

      const desData: Designation[] = (desRes.data || []) as any;
      const skillData: Skill[] = skillRes.data || [];
      setDesignations(desData);
      setSkills(skillData);

      if (desData.length > 0) {
        const rsRes = await supabase
          .from('role_skills')
          .select('*, skills(id, name, category, description)')
          .in('designation_id', desData.map(d => d.id));

        const grouped: Record<string, RoleSkill[]> = {};
        for (const rs of (rsRes.data || []) as any[]) {
          if (!grouped[rs.designation_id]) grouped[rs.designation_id] = [];
          grouped[rs.designation_id].push(rs);
        }
        setRoleSkills(grouped);
      }
    } catch (e: any) {
      setError('Failed to load data: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (designationId: string) => {
    if (!assignForm.skill_id) return;
    setSaving(true);
    setError('');
    try {
      const existing = (roleSkills[designationId] || []).find(rs => rs.skill_id === assignForm.skill_id);
      if (existing) {
        setError('This skill is already assigned to this role.');
        setSaving(false);
        return;
      }
      const { error: err } = await supabase.from('role_skills').insert({
        designation_id: designationId,
        skill_id: assignForm.skill_id,
        is_mandatory: assignForm.is_mandatory,
        minimum_score: assignForm.minimum_score,
      });
      if (err) throw err;
      setShowAssignForm(null);
      setAssignForm({ skill_id: '', is_mandatory: true, minimum_score: 70 });
      await load();
    } catch (e: any) {
      setError('Failed to assign skill: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (roleSkillId: string, designationId: string) => {
    if (!confirm('Remove this skill from the role?')) return;
    try {
      const { error: err } = await supabase.from('role_skills').delete().eq('id', roleSkillId);
      if (err) throw err;
      await load();
    } catch (e: any) {
      setError('Failed to remove skill: ' + e.message);
    }
  };

  const handleUpdateScore = async (roleSkillId: string, minimumScore: number) => {
    try {
      const { error: err } = await supabase
        .from('role_skills')
        .update({ minimum_score: minimumScore })
        .eq('id', roleSkillId);
      if (err) throw err;
      await load();
    } catch (e: any) {
      setError('Failed to update: ' + e.message);
    }
  };

  const handleToggleMandatory = async (rs: RoleSkill) => {
    try {
      const { error: err } = await supabase
        .from('role_skills')
        .update({ is_mandatory: !rs.is_mandatory })
        .eq('id', rs.id);
      if (err) throw err;
      await load();
    } catch (e: any) {
      setError('Failed to update: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-950 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 text-xs">Dismiss</button>
        </div>
      )}

      {designations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">No designations found</p>
          <p className="text-xs text-gray-400 mt-1">Add designations first, then assign skills to each role.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {designations.map(des => {
            const assigned = roleSkills[des.id] || [];
            const isExpanded = expandedRole === des.id;
            const isAddingSkill = showAssignForm === des.id;
            const availableSkills = skills.filter(s => !assigned.find(rs => rs.skill_id === s.id));

            return (
              <div key={des.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedRole(isExpanded ? null : des.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Award className="w-5 h-5 text-blue-700" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 text-sm">{des.title}</p>
                      {(des.departments as any)?.name && (
                        <p className="text-xs text-gray-400">{(des.departments as any).name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${assigned.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {assigned.length} skill{assigned.length !== 1 ? 's' : ''}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                    {assigned.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No skills assigned to this role yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {assigned.map(rs => (
                          <div key={rs.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">{rs.skills?.name}</span>
                                {rs.skills?.category && (
                                  <span className="text-xs text-gray-400">{rs.skills.category}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => handleToggleMandatory(rs)}
                                className={`text-xs px-2 py-1 rounded font-medium transition ${rs.is_mandatory ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                              >
                                {rs.is_mandatory ? 'Required' : 'Optional'}
                              </button>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">Min:</span>
                                <select
                                  value={rs.minimum_score}
                                  onChange={e => handleUpdateScore(rs.id, parseInt(e.target.value))}
                                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                >
                                  {[50, 60, 70, 75, 80, 85, 90].map(v => (
                                    <option key={v} value={v}>{v}%</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                onClick={() => handleRemove(rs.id, des.id)}
                                className="p-1 text-red-400 hover:bg-red-50 rounded transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isAddingSkill ? (
                      <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
                        <p className="text-xs font-semibold text-blue-900">Assign Skill to {des.title}</p>
                        {availableSkills.length === 0 ? (
                          <p className="text-xs text-gray-500">All available skills have been assigned to this role.</p>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Select Skill *</label>
                              <select
                                value={assignForm.skill_id}
                                onChange={e => setAssignForm({ ...assignForm, skill_id: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                              >
                                <option value="">Choose a skill...</option>
                                {availableSkills.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}{s.category ? ` (${s.category})` : ''}</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Minimum Pass Score</label>
                                <select
                                  value={assignForm.minimum_score}
                                  onChange={e => setAssignForm({ ...assignForm, minimum_score: parseInt(e.target.value) })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                                >
                                  {[50, 60, 70, 75, 80, 85, 90].map(v => (
                                    <option key={v} value={v}>{v}%</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer pb-2">
                                  <input
                                    type="checkbox"
                                    checked={assignForm.is_mandatory}
                                    onChange={e => setAssignForm({ ...assignForm, is_mandatory: e.target.checked })}
                                    className="w-4 h-4 accent-blue-600"
                                  />
                                  <span className="text-sm font-medium text-gray-700">Required skill</span>
                                </label>
                              </div>
                            </div>
                          </>
                        )}
                        <div className="flex gap-2">
                          {availableSkills.length > 0 && (
                            <button
                              onClick={() => handleAssign(des.id)}
                              disabled={!assignForm.skill_id || saving}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white text-xs rounded-lg font-semibold hover:bg-blue-900 transition disabled:opacity-50"
                            >
                              <Plus className="w-3 h-3" />
                              {saving ? 'Assigning...' : 'Assign Skill'}
                            </button>
                          )}
                          <button
                            onClick={() => { setShowAssignForm(null); setAssignForm({ skill_id: '', is_mandatory: true, minimum_score: 70 }); }}
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setShowAssignForm(des.id); setError(''); }}
                        className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-medium transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Assign skill to this role
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
