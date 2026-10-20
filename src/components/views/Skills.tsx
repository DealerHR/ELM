import { useState, useEffect } from 'react';
import { Plus, Award, BookOpen, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Skill {
  id: string;
  name: string;
  description?: string;
  category?: string;
  is_active: boolean;
  created_at: string;
}

export default function Skills() {
  const { userProfile } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
  });

  useEffect(() => {
    if (userProfile?.organization_id) {
      loadSkills();
    }
  }, [userProfile?.organization_id]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('skills').insert([
        { ...formData, organization_id: userProfile?.organization_id }
      ]);
      if (error) throw error;

      setShowForm(false);
      setFormData({ name: '', description: '', category: '' });
      loadSkills();
    } catch (error) {
      console.error('Error creating skill:', error);
    }
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSkill) return;

    try {
      const { error } = await supabase
        .from('skills')
        .update({
          name: editingSkill.name,
          description: editingSkill.description,
          category: editingSkill.category,
        })
        .eq('id', editingSkill.id);

      if (error) throw error;

      setEditingSkill(null);
      loadSkills();
    } catch (error) {
      console.error('Error updating skill:', error);
      alert('Error updating skill. Please try again.');
    }
  };

  const handleDelete = async (skillId: string) => {
    try {
      const { error } = await supabase
        .from('skills')
        .delete()
        .eq('id', skillId);

      if (error) throw error;

      setShowDeleteConfirm(null);
      loadSkills();
    } catch (error) {
      console.error('Error deleting skill:', error);
      alert('Error deleting skill. Please try again.');
    }
  };

  const categories = [...new Set(skills.map(s => s.category).filter(Boolean))];

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Skills</h1>
          <p className="text-sm text-gray-600">Manage skill inventory and assessments</p>
        </div>
        {(userProfile?.role === 'admin' || userProfile?.role === 'l_d_manager') && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white text-sm rounded-lg hover:bg-blue-900 transition"
          >
            <Plus className="w-4 h-4" />
            Add Skill
          </button>
        )}
      </div>

      {editingSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-md">
            <h2 className="text-base font-bold mb-3">Edit Skill</h2>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Skill Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingSkill.name}
                  onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editingSkill.description || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={editingSkill.category || ''}
                  onChange={(e) => setEditingSkill({ ...editingSkill, category: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-950 text-white py-1.5 text-sm rounded-lg hover:bg-blue-900 transition"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSkill(null)}
                  className="flex-1 bg-gray-200 text-gray-700 py-1.5 text-sm rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-sm">
            <h2 className="text-base font-bold mb-2">Delete Skill</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this skill? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 bg-red-600 text-white py-1.5 text-sm rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-1.5 text-sm rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-md">
            <h2 className="text-base font-bold mb-3">Add New Skill</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Skill Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  placeholder="e.g., Excel, Consulting Skills"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  placeholder="e.g., Technical, Soft Skills"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-950 text-white py-1.5 text-sm rounded-lg hover:bg-blue-900 transition"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-1.5 text-sm rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {categories.length > 0 ? (
        categories.map((category) => (
          <div key={category} className="mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-2">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {skills
                .filter((skill) => skill.category === category)
                .map((skill) => (
                  <div
                    key={skill.id}
                    className="bg-white rounded-lg shadow-sm p-3 border border-gray-100 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Award className="w-4 h-4 text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{skill.name}</h3>
                          {skill.description && (
                            <p className="text-xs text-gray-600">{skill.description}</p>
                          )}
                        </div>
                      </div>
                      {(userProfile?.role === 'admin' || userProfile?.role === 'l_d_manager') && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(skill)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Edit skill"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(skill.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete skill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="bg-white rounded-lg shadow-sm p-3 border border-gray-100 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Award className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{skill.name}</h3>
                    {skill.description && (
                      <p className="text-xs text-gray-600">{skill.description}</p>
                    )}
                  </div>
                </div>
                {(userProfile?.role === 'admin' || userProfile?.role === 'l_d_manager') && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(skill)}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Edit skill"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(skill.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete skill"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {skills.length === 0 && (
        <div className="text-center py-8">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">No skills yet</h3>
          <p className="text-sm text-gray-600">Add your first skill to get started</p>
        </div>
      )}
    </div>
  );
}
