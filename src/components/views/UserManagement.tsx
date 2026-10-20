import { useState, useEffect } from 'react';
import { Users, Edit2, Trash2, Shield, Mail, Building } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  organization_id?: string;
  created_at: string;
  organizations?: { name: string };
}

export default function UserManagement() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      loadUsers();
    }
  }, [userProfile]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          *,
          organizations(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: editingUser.full_name,
          phone: editingUser.phone,
          role: editingUser.role,
          is_active: editingUser.is_active,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      setEditingUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error updating user. Please try again.');
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;

      setShowDeleteConfirm(null);
      loadUsers();
    } catch (error) {
      console.error('Error deactivating user:', error);
      alert('Error deactivating user. Please try again.');
    }
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      hr: 'bg-blue-100 text-blue-800',
      l_d_manager: 'bg-purple-100 text-purple-800',
      manager: 'bg-green-100 text-green-800',
      employee: 'bg-gray-100 text-gray-800',
    };
    return badges[role] || 'bg-gray-100 text-gray-800';
  };

  if (userProfile?.role !== 'admin') {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <Shield className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <p className="text-sm text-red-900 font-medium">Access Denied</p>
          <p className="text-xs text-red-700">Only administrators can access user management.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">User Management</h1>
          <p className="text-sm text-gray-600">Manage all platform users and permissions</p>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-md">
            <h2 className="text-base font-bold mb-3">Edit User</h2>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  disabled
                  value={editingUser.email}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="hr">HR</option>
                  <option value="l_d_manager">L&D Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingUser.is_active}
                    onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-xs font-medium text-gray-700">Active User</span>
                </label>
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
                  onClick={() => setEditingUser(null)}
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
            <h2 className="text-base font-bold mb-2">Deactivate User</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to deactivate this user? They will no longer be able to access the platform.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 bg-red-600 text-white py-1.5 text-sm rounded-lg hover:bg-red-700 transition"
              >
                Deactivate
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

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-950" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{user.full_name}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Mail className="w-3 h-3" />
                    {user.email}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                    {user.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {user.organizations?.name ? (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Building className="w-3 h-3" />
                      {user.organizations.name}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-1.5 hover:bg-blue-50 rounded transition"
                      title="Edit user"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(user.id)}
                      className="p-1.5 hover:bg-red-50 rounded transition"
                      title="Deactivate user"
                      disabled={user.id === userProfile?.id}
                    >
                      <Trash2 className={`w-3.5 h-3.5 ${user.id === userProfile?.id ? 'text-gray-300' : 'text-red-600'}`} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">No users found</h3>
        </div>
      )}
    </div>
  );
}
