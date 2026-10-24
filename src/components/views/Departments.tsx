import { useState, useEffect } from 'react';
import { Plus, Network, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Department {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  created_at: string;
}

export default function Departments() {
  const { userProfile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (userProfile?.organization_id) {
      loadDepartments();
    }
  }, [userProfile?.organization_id]);

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', userProfile?.organization_id)
        .order('created_at', { ascending: false});

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('departments').insert([
        { ...formData, organization_id: userProfile?.organization_id }
      ]);
      if (error) throw error;

      setShowForm(false);
      setFormData({ name: '', description: '' });
      loadDepartments();
    } catch (error) {
      console.error('Error creating department:', error);
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;

    try {
      const { error } = await supabase
        .from('departments')
        .update({
          name: editingDept.name,
          description: editingDept.description,
        })
        .eq('id', editingDept.id);

      if (error) throw error;

      setEditingDept(null);
      loadDepartments();
    } catch (error) {
      console.error('Error updating department:', error);
      alert('Error updating department. Please try again.');
    }
  };

  const handleDelete = async (deptId: string) => {
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', deptId);

      if (error) throw error;

      setShowDeleteConfirm(null);
      loadDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Cannot delete department. It may be associated with employees.');
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          {/* page name is in the header */}
          <p className="text-sm text-gray-600">Manage organizational departments</p>
        </div>
        {(userProfile?.role === 'admin' || userProfile?.role === 'hr') && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white text-sm rounded-lg hover:bg-blue-900 transition"
          >
            <Plus className="w-4 h-4" />
            Add Department
          </button>
        )}
      </div>

      {editingDept && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-md">
            <h2 className="text-base font-bold mb-3">Edit Department</h2>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingDept.name}
                  onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editingDept.description || ''}
                  onChange={(e) => setEditingDept({ ...editingDept, description: e.target.value })}
                  rows={2}
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
                  onClick={() => setEditingDept(null)}
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
            <h2 className="text-base font-bold mb-2">Delete Department</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this department? This action cannot be undone.
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
            <h2 className="text-base font-bold mb-3">Add New Department</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {departments.map((dept) => (
          <div key={dept.id} className="bg-white rounded-lg shadow-sm p-3 border border-gray-100 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Network className="w-5 h-5 text-green-600" />
              </div>
              {(userProfile?.role === 'admin' || userProfile?.role === 'hr') && (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(dept)}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Edit department"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(dept.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete department"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">{dept.name}</h3>
            {dept.description && (
              <p className="text-xs text-gray-600">{dept.description}</p>
            )}
          </div>
        ))}
      </div>

      {departments.length === 0 && (
        <div className="text-center py-8">
          <Network className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">No departments yet</h3>
          <p className="text-sm text-gray-600">Add your first department to get started</p>
        </div>
      )}
    </div>
  );
}
