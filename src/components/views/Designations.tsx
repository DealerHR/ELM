import { useState, useEffect } from 'react';
import { Plus, Briefcase, Building, CreditCard as Edit2, Trash2, LayoutGrid, LayoutList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Designation {
  id: string;
  title: string;
  description?: string;
  level?: string;
  department_id?: string;
  created_at: string;
  departments?: { name: string };
}

interface Department {
  id: string;
  name: string;
}

const levelColors: Record<string, string> = {
  entry: 'bg-gray-100 text-gray-700',
  junior: 'bg-blue-100 text-blue-700',
  mid: 'bg-amber-100 text-amber-700',
  senior: 'bg-orange-100 text-orange-700',
  lead: 'bg-emerald-100 text-emerald-700',
  manager: 'bg-teal-100 text-teal-700',
  director: 'bg-rose-100 text-rose-700',
  executive: 'bg-slate-100 text-slate-700',
};

export default function Designations() {
  const { userProfile } = useAuth();
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    try { return (localStorage.getItem('designations_view') as 'card' | 'table') || 'card'; } catch { return 'card'; }
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: '',
    department_id: '',
  });

  const canManage = userProfile?.role === 'admin' || userProfile?.role === 'hr';

  useEffect(() => {
    if (userProfile?.organization_id) {
      loadData();
    }
  }, [userProfile?.organization_id]);

  const loadData = async () => {
    try {
      const [designationsRes, departmentsRes] = await Promise.all([
        supabase
          .from('designations')
          .select(`*, departments:department_id(name)`)
          .eq('organization_id', userProfile?.organization_id)
          .order('title', { ascending: true }),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', userProfile?.organization_id),
      ]);

      if (designationsRes.error) throw designationsRes.error;
      if (departmentsRes.error) throw departmentsRes.error;

      setDesignations(designationsRes.data || []);
      setDepartments(departmentsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('designations').insert([
        {
          ...formData,
          department_id: formData.department_id || null,
          organization_id: userProfile?.organization_id,
        }
      ]);
      if (error) throw error;
      setShowForm(false);
      setFormData({ title: '', description: '', level: '', department_id: '' });
      loadData();
    } catch (error) {
      console.error('Error creating designation:', error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDesig) return;
    try {
      const { error } = await supabase
        .from('designations')
        .update({
          title: editingDesig.title,
          description: editingDesig.description,
          level: editingDesig.level,
          department_id: editingDesig.department_id || null,
        })
        .eq('id', editingDesig.id);
      if (error) throw error;
      setEditingDesig(null);
      loadData();
    } catch (error) {
      console.error('Error updating designation:', error);
      alert('Error updating designation. Please try again.');
    }
  };

  const handleDelete = async (desigId: string) => {
    try {
      const { error } = await supabase.from('designations').delete().eq('id', desigId);
      if (error) throw error;
      setShowDeleteConfirm(null);
      loadData();
    } catch (error) {
      console.error('Error deleting designation:', error);
      alert('Cannot delete designation. It may be associated with employees.');
    }
  };

  const toggleView = (mode: 'card' | 'table') => {
    setViewMode(mode);
    try { localStorage.setItem('designations_view', mode); } catch {}
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Designations</h1>
          <p className="text-sm text-gray-600">Manage job titles and positions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white flex-shrink-0">
            <button
              onClick={() => toggleView('card')}
              title="Card view"
              className={`p-2 transition ${viewMode === 'card' ? 'bg-blue-950 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toggleView('table')}
              title="Table view"
              className={`p-2 transition ${viewMode === 'table' ? 'bg-blue-950 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
          </div>
          {canManage && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white text-sm rounded-lg hover:bg-blue-900 transition"
            >
              <Plus className="w-4 h-4" />
              Add Designation
            </button>
          )}
        </div>
      </div>

      {editingDesig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-md">
            <h2 className="text-base font-bold mb-3">Edit Designation</h2>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={editingDesig.title}
                  onChange={(e) => setEditingDesig({ ...editingDesig, title: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editingDesig.description || ''}
                  onChange={(e) => setEditingDesig({ ...editingDesig, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Level</label>
                <select
                  value={editingDesig.level || ''}
                  onChange={(e) => setEditingDesig({ ...editingDesig, level: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                >
                  <option value="">Select level</option>
                  <option value="entry">Entry Level</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid Level</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead</option>
                  <option value="manager">Manager</option>
                  <option value="director">Director</option>
                  <option value="executive">Executive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={editingDesig.department_id || ''}
                  onChange={(e) => setEditingDesig({ ...editingDesig, department_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                >
                  <option value="">Select department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-blue-950 text-white py-1.5 text-sm rounded-lg hover:bg-blue-900 transition">Update</button>
                <button type="button" onClick={() => setEditingDesig(null)} className="flex-1 bg-gray-200 text-gray-700 py-1.5 text-sm rounded-lg hover:bg-gray-300 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-sm">
            <h2 className="text-base font-bold mb-2">Delete Designation</h2>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this designation? This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 bg-red-600 text-white py-1.5 text-sm rounded-lg hover:bg-red-700 transition">Delete</button>
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 bg-gray-200 text-gray-700 py-1.5 text-sm rounded-lg hover:bg-gray-300 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-md">
            <h2 className="text-base font-bold mb-3">Add New Designation</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  placeholder="e.g., Senior Software Engineer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  placeholder="Brief description of the role"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Level</label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                >
                  <option value="">Select level</option>
                  <option value="entry">Entry Level</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid Level</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead</option>
                  <option value="manager">Manager</option>
                  <option value="director">Director</option>
                  <option value="executive">Executive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                >
                  <option value="">Select department (optional)</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-blue-950 text-white py-1.5 text-sm rounded-lg hover:bg-blue-900 transition">Create</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-200 text-gray-700 py-1.5 text-sm rounded-lg hover:bg-gray-300 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {designations.length === 0 ? (
        <div className="text-center py-8">
          <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">No designations yet</h3>
          <p className="text-sm text-gray-600">Add your first job title to get started</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {designations.map((designation) => (
            <div key={designation.id} className="bg-white rounded-lg shadow-sm p-3 border border-gray-100 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-blue-950" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 mb-0.5">{designation.title}</h3>
                    {designation.level && (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${levelColors[designation.level] || 'bg-gray-100 text-gray-700'}`}>
                        {designation.level.charAt(0).toUpperCase() + designation.level.slice(1)}
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => setEditingDesig(designation)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" title="Edit designation">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setShowDeleteConfirm(designation.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete designation">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {designation.description && (
                <p className="text-xs text-gray-600 mb-2">{designation.description}</p>
              )}
              {designation.departments?.name && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Building className="w-3 h-3" />
                  {designation.departments.name}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Level</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                {canManage && <th className="px-4 py-3 w-20"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {designations.map((designation) => (
                <tr key={designation.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-3.5 h-3.5 text-blue-950" />
                      </div>
                      <span className="font-semibold text-gray-900">{designation.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {designation.level ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${levelColors[designation.level] || 'bg-gray-100 text-gray-700'}`}>
                        {designation.level.charAt(0).toUpperCase() + designation.level.slice(1)}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {designation.departments?.name ? (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Building className="w-3 h-3 text-gray-400" />
                        {designation.departments.name}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="text-xs text-gray-500 line-clamp-2">{designation.description || '—'}</span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditingDesig(designation)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setShowDeleteConfirm(designation.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
