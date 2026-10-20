import { useState, useEffect } from 'react';
import { Link2, Plus, Trash2, GripVertical, ExternalLink, BookOpen, Target, Award, X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PinnedResource {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon: string;
  sort_order: number;
}

const iconOptions = [
  { value: 'link', label: 'Link', Icon: Link2 },
  { value: 'book', label: 'Book', Icon: BookOpen },
  { value: 'target', label: 'Target', Icon: Target },
  { value: 'award', label: 'Award', Icon: Award },
];

const iconMap: Record<string, typeof Link2> = { link: Link2, book: BookOpen, target: Target, award: Award };

export default function PinnedResources() {
  const { userProfile } = useAuth();
  const [resources, setResources] = useState<PinnedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    url: '',
    description: '',
    icon: 'link',
  });

  const canManage = userProfile?.role === 'admin' || userProfile?.role === 'l_d_manager';

  useEffect(() => {
    loadResources();
  }, [userProfile]);

  const loadResources = async () => {
    if (!userProfile?.organization_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('pinned_resources')
      .select('*')
      .eq('organization_id', userProfile.organization_id)
      .order('sort_order', { ascending: true });
    setResources((data || []) as PinnedResource[]);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.organization_id) return;
    setSaving(true);

    let url = form.url.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    const maxOrder = resources.length > 0 ? Math.max(...resources.map(r => r.sort_order)) + 1 : 0;

    const { error } = await supabase.from('pinned_resources').insert({
      organization_id: userProfile.organization_id,
      pinned_by: userProfile.id,
      title: form.title.trim(),
      url,
      description: form.description.trim() || null,
      icon: form.icon,
      sort_order: maxOrder,
    });

    if (!error) {
      setForm({ title: '', url: '', description: '', icon: 'link' });
      setShowForm(false);
      loadResources();
    } else {
      alert('Error adding quick link. Please try again.');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('pinned_resources').delete().eq('id', id);
    setDeleteId(null);
    loadResources();
  };

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quick Links</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pin important resources for your team to access from the dashboard</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-stratefix-black text-stratefix-yellow rounded-xl hover:bg-gray-900 transition font-semibold text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Link
          </button>
        )}
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Link2 className="w-4 h-4 text-emerald-600" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Add Quick Link</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Company Handbook"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">URL *</label>
                <input
                  type="text"
                  required
                  placeholder="https://example.com"
                  value={form.url}
                  onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description (optional)</label>
                <input
                  type="text"
                  placeholder="Brief description of the resource"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Icon</label>
                <div className="grid grid-cols-4 gap-2">
                  {iconOptions.map(opt => {
                    const Icon = opt.Icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, icon: opt.value }))}
                        className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2 transition ${
                          form.icon === opt.value
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${form.icon === opt.value ? 'text-emerald-600' : 'text-gray-500'}`} />
                        <span className={`text-[10px] font-medium ${form.icon === opt.value ? 'text-emerald-700' : 'text-gray-500'}`}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-stratefix-black text-stratefix-yellow rounded-xl hover:bg-gray-900 transition font-semibold text-sm disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Add Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-semibold text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm">
            <h2 className="text-base font-bold text-gray-900 mb-2">Remove Quick Link?</h2>
            <p className="text-sm text-gray-500 mb-4">This link will be removed from all employees' dashboards.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold transition">Remove</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-semibold transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-stratefix-yellow border-t-transparent rounded-full animate-spin" />
        </div>
      ) : resources.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <Link2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-700 mb-1">No quick links yet</h3>
          <p className="text-sm text-gray-400 mb-4">Add important resources so your team can access them quickly from the dashboard.</p>
          {canManage && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold transition"
            >
              Add your first link
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {resources.map(r => {
            const Icon = iconMap[r.icon] || Link2;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3 group hover:border-gray-200 transition">
                {canManage && (
                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />
                )}
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{r.title}</p>
                  {r.description && <p className="text-xs text-gray-500 truncate">{r.description}</p>}
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 mt-0.5 w-fit"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {r.url.replace(/^https?:\/\//, '').slice(0, 50)}
                  </a>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                    title="Open"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {canManage && (
                    <button
                      onClick={() => setDeleteId(r.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
