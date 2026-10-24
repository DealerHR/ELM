import { useState, useEffect, useRef } from 'react';
import { Plus, FolderOpen, FileText, Download, Eye, CreditCard as Edit2, Trash2, Upload, X, CheckSquare, Square, Users, Building2, Briefcase, Globe, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ContentViewer, { kindFor } from '../viewers/ContentViewer';

interface Resource {
  id: string;
  title: string;
  description?: string;
  file_type: string;
  file_url: string;
  file_path?: string;
  category?: string;
  tags?: string[];
  access_level: string;
  department_ids?: string[];
  designation_ids?: string[];
  access_user_ids?: string[];
  skill_ids?: string[];
  created_at: string;
}

interface Skill { id: string; name: string; category: string; }
interface Department { id: string; name: string; }
interface Designation { id: string; title: string; }
interface OrgUser { id: string; full_name: string; }

const blankForm = {
  title: '',
  description: '',
  file_type: 'pdf',
  category: '',
  access_level: 'all',
  department_ids: [] as string[],
  designation_ids: [] as string[],
  access_user_ids: [] as string[],
  skill_ids: [] as string[],
};

function MultiSelect<T extends { id: string }>({
  items,
  selected,
  label,
  getLabel,
  onChange,
  placeholder,
}: {
  items: T[];
  selected: string[];
  label: string;
  getLabel: (item: T) => string;
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label} *</label>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-2">{placeholder || 'No options available'}</p>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-gray-50 max-h-40 overflow-y-auto p-1.5 space-y-0.5">
          {items.map(item => {
            const checked = selected.includes(item.id);
            return (
              <label
                key={item.id}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition select-none ${
                  checked ? 'bg-blue-50 border border-blue-200' : 'hover:bg-white border border-transparent'
                }`}
              >
                {checked ? (
                  <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                )}
                <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} className="sr-only" />
                <span className="text-sm text-gray-800">{getLabel(item)}</span>
              </label>
            );
          })}
        </div>
      )}
      {selected.length > 0 && (
        <p className="text-xs text-blue-600 mt-1 font-medium">{selected.length} selected</p>
      )}
    </div>
  );
}

function ResourceForm({
  initial,
  onClose,
  onSaved,
  skills,
  departments,
  designations,
  orgUsers,
  orgId,
  userId,
  editId,
}: {
  initial: typeof blankForm;
  onClose: () => void;
  onSaved: () => void;
  skills: Skill[];
  departments: Department[];
  designations: Designation[];
  orgUsers: OrgUser[];
  orgId: string;
  userId: string;
  editId?: string;
}) {
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isEdit = !!editId;

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 52_428_800) {
      setFileError('File must be under 50 MB');
      return;
    }
    setFileError('');
    setFile(f);
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
      pdf: 'pdf', doc: 'document', docx: 'document',
      xls: 'spreadsheet', xlsx: 'spreadsheet',
      ppt: 'presentation', pptx: 'presentation',
      mp4: 'video', webm: 'video',
    };
    set('file_type', typeMap[ext] || 'other');
  };

  const validate = () => {
    if (!form.title.trim()) return 'Title is required';
    if (!isEdit && !file) return 'Please select a file to upload';
    if (form.access_level === 'department' && form.department_ids.length === 0)
      return 'Select at least one department';
    if (form.access_level === 'designation' && form.designation_ids.length === 0)
      return 'Select at least one designation';
    if (form.access_level === 'specific' && form.access_user_ids.length === 0)
      return 'Select at least one user';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setUploading(true);

    try {
      let fileUrl = (initial as any).file_url || '';
      let filePath = (initial as any).file_path || '';

      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${orgId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('resources').upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        filePath = path;
        const { data: urlData } = supabase.storage.from('resources').getPublicUrl(path);
        fileUrl = urlData?.publicUrl || '';
        if (!fileUrl) {
          const { data: signed } = await supabase.storage.from('resources').createSignedUrl(path, 60 * 60 * 24 * 365);
          fileUrl = signed?.signedUrl || path;
        }
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        file_type: form.file_type,
        category: form.category.trim() || null,
        access_level: form.access_level,
        department_ids: form.access_level === 'department' ? form.department_ids : [],
        designation_ids: form.access_level === 'designation' ? form.designation_ids : [],
        access_user_ids: form.access_level === 'specific' ? form.access_user_ids : [],
        skill_ids: form.skill_ids,
        ...(file ? { file_url: fileUrl, file_path: filePath } : {}),
      };

      if (isEdit) {
        const { error: e } = await supabase.from('resource_repository').update(payload).eq('id', editId);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('resource_repository').insert({
          ...payload,
          file_url: fileUrl,
          file_path: filePath,
          organization_id: orgId,
          uploaded_by: userId,
        });
        if (e) throw e;
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Resource' : 'Upload New Resource'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={e => set('title', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-950 focus:border-transparent outline-none"
                placeholder="Enter resource title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-950 focus:border-transparent outline-none resize-none"
                placeholder="Brief description of this resource"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isEdit ? 'Replace File (optional)' : 'File *'}
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                  file ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input ref={fileRef} type="file" onChange={handleFile} className="sr-only"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.webm,.png,.jpg,.jpeg,.txt"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">{file.name}</span>
                    <span className="text-xs text-blue-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="w-8 h-8 text-gray-300" />
                    <p className="text-sm text-gray-500 font-medium">Click to browse files</p>
                    <p className="text-xs text-gray-400">PDF, Word, Excel, PowerPoint, Video · Max 50 MB</p>
                  </div>
                )}
              </div>
              {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
                <select
                  value={form.file_type}
                  onChange={e => set('file_type', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-950 focus:border-transparent outline-none"
                >
                  <option value="pdf">PDF</option>
                  <option value="video">Video</option>
                  <option value="document">Document</option>
                  <option value="spreadsheet">Spreadsheet</option>
                  <option value="presentation">Presentation</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-950 focus:border-transparent outline-none"
                  placeholder="e.g. Onboarding, Safety"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Level *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'all', label: 'All Employees', icon: Globe, desc: 'Visible to everyone' },
                  { value: 'department', label: 'Department', icon: Building2, desc: 'Specific departments' },
                  { value: 'designation', label: 'Designation', icon: Briefcase, desc: 'Specific job roles' },
                  { value: 'specific', label: 'Specific Users', icon: Users, desc: 'Individual people' },
                ].map(opt => {
                  const Icon = opt.icon;
                  const active = form.access_level === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('access_level', opt.value)}
                      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left transition ${
                        active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div>
                        <p className={`text-sm font-semibold leading-tight ${active ? 'text-blue-800' : 'text-gray-700'}`}>{opt.label}</p>
                        <p className={`text-xs mt-0.5 ${active ? 'text-blue-500' : 'text-gray-400'}`}>{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {form.access_level === 'department' && (
              <MultiSelect
                items={departments}
                selected={form.department_ids}
                label="Select Departments"
                getLabel={d => d.name}
                onChange={ids => set('department_ids', ids)}
                placeholder="No departments found for this organization"
              />
            )}

            {form.access_level === 'designation' && (
              <MultiSelect
                items={designations}
                selected={form.designation_ids}
                label="Select Designations"
                getLabel={d => d.title}
                onChange={ids => set('designation_ids', ids)}
                placeholder="No designations found for this organization"
              />
            )}

            {form.access_level === 'specific' && (
              <MultiSelect
                items={orgUsers}
                selected={form.access_user_ids}
                label="Select Users"
                getLabel={u => u.full_name}
                onChange={ids => set('access_user_ids', ids)}
                placeholder="No users found for this organization"
              />
            )}

            {skills.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Linked Skills</label>
                <p className="text-xs text-gray-400 mb-1.5">Learners will see this resource under the selected skills.</p>
                <div className="border border-gray-200 rounded-lg bg-gray-50 max-h-36 overflow-y-auto p-1.5 space-y-0.5">
                  {skills.map(skill => {
                    const checked = form.skill_ids.includes(skill.id);
                    return (
                      <label
                        key={skill.id}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer transition select-none ${
                          checked ? 'bg-blue-50 border border-blue-200' : 'hover:bg-white border border-transparent'
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        )}
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            const ids = form.skill_ids;
                            set('skill_ids', e.target.checked ? [...ids, skill.id] : ids.filter(id => id !== skill.id));
                          }}
                          className="sr-only"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{skill.name}</p>
                          {skill.category && <p className="text-xs text-gray-400 truncate">{skill.category}</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-950 text-white py-2.5 rounded-xl hover:bg-blue-900 transition text-sm font-semibold disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {file ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                <>{isEdit ? 'Save Changes' : 'Upload Resource'}</>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl hover:bg-gray-200 transition text-sm font-semibold disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const accessConfig: Record<string, { label: string; color: string }> = {
  all: { label: 'All Employees', color: 'bg-emerald-100 text-emerald-700' },
  department: { label: 'Department', color: 'bg-blue-100 text-blue-700' },
  designation: { label: 'Designation', color: 'bg-amber-100 text-amber-700' },
  specific: { label: 'Specific Users', color: 'bg-rose-100 text-rose-700' },
};

export default function Repository() {
  const { userProfile } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editResource, setEditResource] = useState<Resource | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canManage = userProfile?.role === 'admin' || userProfile?.role === 'l_d_manager' || userProfile?.role === 'hr';
  const orgId = userProfile?.organization_id || '';
  const userId = userProfile?.id || '';

  useEffect(() => {
    if (orgId) {
      loadAll();
    }
  }, [orgId]);

  const loadAll = async () => {
    setLoading(true);
    const [res, sk, dep, des, users] = await Promise.all([
      supabase.from('resource_repository').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
      supabase.from('skills').select('id, name, category').eq('organization_id', orgId).order('name'),
      supabase.from('departments').select('id, name').eq('organization_id', orgId).order('name'),
      supabase.from('designations').select('id, title').eq('organization_id', orgId).order('title'),
      supabase.from('user_profiles').select('id, full_name').eq('organization_id', orgId).order('full_name'),
    ]);
    setResources(res.data || []);
    setSkills(sk.data || []);
    setDepartments(dep.data || []);
    setDesignations(des.data || []);
    setOrgUsers(users.data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const resource = resources.find(r => r.id === id);
    if (resource?.file_path) {
      await supabase.storage.from('resources').remove([resource.file_path]);
    }
    await supabase.from('resource_repository').delete().eq('id', id);
    setDeleteId(null);
    loadAll();
  };

  const [viewing, setViewing] = useState<{ resource: Resource; url: string } | null>(null);

  // View opens the file right here; Download fetches it. No new tabs, so phones
  // always have a way back.
  const handleOpenResource = async (resource: Resource, download = false) => {
    if (!resource.file_path) return;
    const { data, error } = await supabase.storage
      .from('resources')
      .createSignedUrl(resource.file_path, 3600, download ? { download: resource.title } : undefined);
    if (error || !data?.signedUrl) return;
    if (download) {
      const a = document.createElement('a');
      a.href = data.signedUrl; a.download = resource.title; a.rel = 'noopener noreferrer';
      a.click();
      return;
    }
    setViewing({ resource, url: data.signedUrl });
  };

  const getInitialFromResource = (r: Resource): typeof blankForm => ({
    title: r.title,
    description: r.description || '',
    file_type: r.file_type,
    category: r.category || '',
    access_level: r.access_level,
    department_ids: r.department_ids || [],
    designation_ids: r.designation_ids || [],
    access_user_ids: r.access_user_ids || [],
    skill_ids: r.skill_ids || [],
  });

  const getAccessDetail = (r: Resource) => {
    const parts: string[] = [];
    if (r.access_level === 'department' && r.department_ids?.length) {
      const names = r.department_ids.map(id => departments.find(d => d.id === id)?.name).filter(Boolean);
      if (names.length) parts.push(names.join(', '));
    }
    if (r.access_level === 'designation' && r.designation_ids?.length) {
      const names = r.designation_ids.map(id => designations.find(d => d.id === id)?.title).filter(Boolean);
      if (names.length) parts.push(names.join(', '));
    }
    if (r.access_level === 'specific' && r.access_user_ids?.length) {
      const names = r.access_user_ids.map(id => orgUsers.find(u => u.id === id)?.full_name).filter(Boolean);
      if (names.length) parts.push(names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : ''));
    }
    return parts.join('; ');
  };

  if (loading) return <div className="p-4 flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          {/* page name is in the header */}
          <p className="text-sm text-gray-600">Access learning materials and documents</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white text-sm rounded-lg hover:bg-blue-900 transition font-medium"
          >
            <Plus className="w-4 h-4" />
            Upload Resource
          </button>
        )}
      </div>

      {showForm && (
        <ResourceForm
          initial={blankForm}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadAll(); }}
          skills={skills}
          departments={departments}
          designations={designations}
          orgUsers={orgUsers}
          orgId={orgId}
          userId={userId}
        />
      )}

      {editResource && (
        <ResourceForm
          initial={getInitialFromResource(editResource)}
          onClose={() => setEditResource(null)}
          onSaved={() => { setEditResource(null); loadAll(); }}
          skills={skills}
          departments={departments}
          designations={designations}
          orgUsers={orgUsers}
          orgId={orgId}
          userId={userId}
          editId={editResource.id}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm">
            <h2 className="text-base font-bold text-gray-900 mb-2">Delete Resource?</h2>
            <p className="text-sm text-gray-500 mb-4">This will permanently remove the file and its record. This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 text-white py-2 rounded-xl hover:bg-red-700 text-sm font-semibold transition">Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl hover:bg-gray-200 text-sm font-semibold transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {resources.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-700 mb-1">No resources yet</h3>
          <p className="text-gray-400 text-sm">Upload your first resource to build your library</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resource</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-28 text-center">Access</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-24 text-center">Type</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-20 text-center">Actions</span>
          </div>
          {resources.map((resource, idx) => {
            const ac = accessConfig[resource.access_level] || accessConfig.all;
            const detail = getAccessDetail(resource);
            const skillCount = (resource.skill_ids || []).length;
            return (
              <div
                key={resource.id}
                className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 hover:bg-gray-50 transition ${
                  idx < resources.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-blue-950" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{resource.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {resource.category && (
                        <span className="text-xs text-gray-400">{resource.category}</span>
                      )}
                      {detail && (
                        <span className="text-xs text-gray-400 truncate max-w-xs">{detail}</span>
                      )}
                      {skillCount > 0 && (
                        <span className="text-xs text-blue-500 font-medium">{skillCount} skill{skillCount > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                </div>

                <span className={`w-28 text-center text-xs font-semibold px-2 py-1 rounded-full ${ac.color}`}>
                  {ac.label}
                </span>

                <span className="w-24 text-center text-xs text-gray-500 font-medium capitalize">
                  {resource.file_type}
                </span>

                <div className="w-20 flex items-center justify-center gap-1">
                  <button
                    onClick={() => handleOpenResource(resource, false)}
                    className="p-1.5 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                    title="View"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenResource(resource, true)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {canManage && (
                    <>
                      <button onClick={() => setEditResource(resource)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(resource.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col" role="dialog" aria-label={viewing.resource.title}>
          <div className="h-12 flex-shrink-0 flex items-center gap-3 px-3 border-b border-gray-200">
            <button onClick={() => setViewing(null)} className="h-9 px-2 -ml-1 inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4" /> Close
            </button>
            <p className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0">{viewing.resource.title}</p>
            <button onClick={() => handleOpenResource(viewing.resource, true)} className="h-9 px-2 inline-flex items-center gap-1 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"><Download className="w-4 h-4" /><span className="hidden sm:inline">Download</span></button>
          </div>
          <ContentViewer kind={kindFor(viewing.resource.file_path, viewing.resource.file_type === 'video' ? 'video' : null, null)} url={viewing.url} title={viewing.resource.title} fileName={viewing.resource.file_path?.split('/').pop()} dark={false} />
        </div>
      )}
    </div>
  );
}
