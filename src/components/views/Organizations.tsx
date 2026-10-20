import { useState, useEffect } from 'react';
import { Plus, Building, CreditCard as Edit2, Trash2, Eye, EyeOff, User, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  website?: string;
  industry?: string;
  size?: string;
  created_at: string;
  admin_email?: string;
  admin_name?: string;
}

const INDUSTRY_OPTIONS = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing',
  'Retail', 'Consulting', 'Media', 'Real Estate', 'Other',
];

const SIZE_OPTIONS = [
  { value: '1-10', label: '1–10 employees' },
  { value: '11-50', label: '11–50 employees' },
  { value: '51-200', label: '51–200 employees' },
  { value: '201-500', label: '201–500 employees' },
  { value: '501+', label: '501+ employees' },
];

const emptyForm = {
  name: '',
  website: '',
  industry: '',
  size: '',
  admin_full_name: '',
  admin_email: '',
  admin_password: '',
};

export default function Organizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const [{ data: orgs, error: orgsError }, { data: admins }] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('organization_id, email, full_name').eq('role', 'admin'),
      ]);

      if (orgsError) throw orgsError;

      const adminMap: Record<string, { email: string; full_name: string }> = {};
      (admins || []).forEach((a) => {
        if (a.organization_id && !adminMap[a.organization_id]) {
          adminMap[a.organization_id] = { email: a.email, full_name: a.full_name };
        }
      });

      setOrganizations(
        (orgs || []).map((org) => ({
          ...org,
          admin_email: adminMap[org.id]?.email,
          admin_name: adminMap[org.id]?.full_name,
        }))
      );
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`${supabaseUrl}/functions/v1/provision-org-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'Apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          org: {
            name: formData.name,
            website: formData.website || null,
            industry: formData.industry || null,
            size: formData.size || null,
          },
          admin: {
            full_name: formData.admin_full_name,
            email: formData.admin_email,
            password: formData.admin_password,
          },
        }),
      });

      const result = await res.json();

      if (!result.success) {
        setFormError(result.error || 'Something went wrong. Please try again.');
        return;
      }

      setFormSuccess(`Organization "${result.org.name}" created with admin ${result.admin.email}`);
      setFormData(emptyForm);
      setShowPassword(false);
      loadOrganizations();

      setTimeout(() => {
        setShowForm(false);
        setFormSuccess('');
      }, 2000);
    } catch (err) {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: editingOrg.name,
          website: editingOrg.website,
          industry: editingOrg.industry,
          size: editingOrg.size,
        })
        .eq('id', editingOrg.id);

      if (error) throw error;
      setEditingOrg(null);
      loadOrganizations();
    } catch (error) {
      console.error('Error updating organization:', error);
      alert('Error updating organization. Please try again.');
    }
  };

  const handleDelete = async (orgId: string) => {
    try {
      const { error } = await supabase.from('organizations').delete().eq('id', orgId);
      if (error) throw error;
      setShowDeleteConfirm(null);
      loadOrganizations();
    } catch (error) {
      console.error('Error deleting organization:', error);
      alert('Error deleting organization. Please try again.');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData(emptyForm);
    setFormError('');
    setFormSuccess('');
    setShowPassword(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-blue-950 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Organizations</h1>
          <p className="text-sm text-gray-500">Provision new client organizations and their admin accounts</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white text-sm rounded-lg hover:bg-blue-900 transition"
        >
          <Plus className="w-4 h-4" />
          Add Organization
        </button>
      </div>

      {/* Edit Modal */}
      {editingOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md">
            <h2 className="text-base font-bold mb-4">Edit Organization</h2>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Organization Name *</label>
                <input
                  type="text"
                  required
                  value={editingOrg.name}
                  onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={editingOrg.website || ''}
                  onChange={(e) => setEditingOrg({ ...editingOrg, website: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Industry</label>
                <select
                  value={editingOrg.industry || ''}
                  onChange={(e) => setEditingOrg({ ...editingOrg, industry: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                >
                  <option value="">Select industry</option>
                  {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Size</label>
                <select
                  value={editingOrg.size || ''}
                  onChange={(e) => setEditingOrg({ ...editingOrg, size: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                >
                  <option value="">Select size</option>
                  {SIZE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 bg-blue-950 text-white py-1.5 text-sm rounded-lg hover:bg-blue-900 transition">
                  Update
                </button>
                <button type="button" onClick={() => setEditingOrg(null)} className="flex-1 bg-gray-100 text-gray-700 py-1.5 text-sm rounded-lg hover:bg-gray-200 transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
            <h2 className="text-base font-bold mb-2">Delete Organization</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this organization? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 bg-red-600 text-white py-1.5 text-sm rounded-lg hover:bg-red-700 transition">
                Delete
              </button>
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 bg-gray-100 text-gray-700 py-1.5 text-sm rounded-lg hover:bg-gray-200 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <h2 className="text-base font-bold text-gray-900 mb-1">Add New Organization</h2>
              <p className="text-xs text-gray-500 mb-4">
                Creates the organization and provisions the admin account in one step.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Org Details */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Organization Details</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Organization Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Acme Corp"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Industry</label>
                        <select
                          value={formData.industry}
                          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                        >
                          <option value="">Select</option>
                          {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Company Size</label>
                        <select
                          value={formData.size}
                          onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                        >
                          <option value="">Select</option>
                          {SIZE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Website</label>
                      <input
                        type="url"
                        placeholder="https://example.com"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Admin Account */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Admin Account</p>
                  <p className="text-xs text-gray-500 mb-3">
                    This person will be the organization admin and can log in immediately with these credentials.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Admin Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Jane Smith"
                        value={formData.admin_full_name}
                        onChange={(e) => setFormData({ ...formData, admin_full_name: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Admin Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="admin@acmecorp.com"
                        value={formData.admin_email}
                        onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Admin Password *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          placeholder="Min. 8 characters"
                          value={formData.admin_password}
                          onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                          className="w-full px-3 py-1.5 pr-9 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Share these credentials with the organization admin.</p>
                    </div>
                  </div>
                </div>

                {/* Feedback */}
                {formError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700">{formError}</p>
                  </div>
                )}
                {formSuccess && (
                  <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-green-700">{formSuccess}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-950 text-white py-2 text-sm rounded-lg hover:bg-blue-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating...' : 'Create Organization & Admin'}
                  </button>
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={submitting}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 text-sm rounded-lg hover:bg-gray-200 transition disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Org Cards */}
      {organizations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No organizations yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organizations.map((org) => (
            <div key={org.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Building className="w-5 h-5 text-blue-950" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingOrg(org)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(org.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="text-sm font-bold text-gray-900 mb-1">{org.name}</h3>

              <div className="space-y-0.5 mb-3">
                {org.industry && <p className="text-xs text-gray-500">{org.industry}</p>}
                {org.size && <p className="text-xs text-gray-400">{org.size} employees</p>}
              </div>

              {org.admin_email ? (
                <div className="flex items-center gap-1.5 pt-2.5 border-t border-gray-100">
                  <User className="w-3 h-3 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{org.admin_name}</p>
                    <p className="text-xs text-gray-400 truncate">{org.admin_email}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 pt-2.5 border-t border-gray-100">
                  <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-600">No admin assigned</p>
                </div>
              )}

              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-blue-600 hover:underline mt-2 truncate"
                >
                  {org.website}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
