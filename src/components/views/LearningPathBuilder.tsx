import { useState, useEffect } from 'react';
import { Plus, Trash2, MoveUp, MoveDown, BookOpen, Lock, Layers, CreditCard as Edit2, X, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface LearningPath {
  id: string;
  title: string;
  description: string;
  path_type: string;
  is_active: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string;
  duration_hours: number;
  delivery_type?: string;
}

interface PathItem {
  id?: string;
  course_id: string;
  order_index: number;
  is_mandatory: boolean;
  prerequisite_item_id?: string | null;
  prerequisite_path_id?: string | null;
  learning_courses?: Course;
}

const PATH_TYPE_COLORS: Record<string, string> = {
  induction: 'bg-blue-100 text-blue-700',
  skill_development: 'bg-emerald-100 text-emerald-700',
  role_specific: 'bg-amber-100 text-amber-700',
  custom: 'bg-gray-100 text-gray-600',
};

const DELIVERY_LABELS: Record<string, { label: string; color: string }> = {
  self_paced: { label: 'Self-Paced', color: 'bg-blue-50 text-blue-600' },
  classroom: { label: 'Classroom', color: 'bg-teal-50 text-teal-600' },
  on_job: { label: 'On-the-Job', color: 'bg-orange-50 text-orange-600' },
};

export default function LearningPathBuilder() {
  const { userProfile } = useAuth();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pathItems, setPathItems] = useState<PathItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPathModal, setShowPathModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PathItem | null>(null);
  const [editingPath, setEditingPath] = useState<LearningPath | null>(null);

  const [pathForm, setPathForm] = useState({
    title: '',
    description: '',
    path_type: 'induction',
    is_active: true,
  });

  const [itemForm, setItemForm] = useState({
    course_id: '',
    is_mandatory: true,
    prerequisite_item_id: '',
    prerequisite_path_id: '',
  });

  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  useEffect(() => {
    loadPaths();
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedPath) loadPathItems(selectedPath);
  }, [selectedPath]);

  const loadPaths = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('learning_paths')
      .select('*')
      .eq('organization_id', userProfile?.organization_id)
      .order('created_at', { ascending: false });
    setPaths(data || []);
    if (data && data.length > 0 && !selectedPath) setSelectedPath(data[0].id);
    setLoading(false);
  };

  const loadCourses = async () => {
    const { data } = await supabase
      .from('learning_courses')
      .select('id, title, description, duration_hours, delivery_type')
      .eq('organization_id', userProfile?.organization_id)
      .eq('is_active', true)
      .order('title');
    setCourses(data || []);
  };

  const loadPathItems = async (pathId: string) => {
    const { data } = await supabase
      .from('learning_path_items')
      .select('*, learning_courses(id, title, description, duration_hours, delivery_type)')
      .eq('path_id', pathId)
      .order('order_index', { ascending: true });
    setPathItems(data || []);
  };

  const openCreatePath = () => {
    setEditingPath(null);
    setPathForm({ title: '', description: '', path_type: 'induction', is_active: true });
    setShowPathModal(true);
  };

  const openEditPath = (path: LearningPath) => {
    setEditingPath(path);
    setPathForm({ title: path.title, description: path.description, path_type: path.path_type, is_active: path.is_active });
    setShowPathModal(true);
  };

  const handleSavePath = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPath) {
        await supabase.from('learning_paths').update(pathForm).eq('id', editingPath.id);
      } else {
        await supabase.from('learning_paths').insert([{
          organization_id: userProfile?.organization_id,
          ...pathForm,
          created_by: userProfile?.id,
        }]);
      }
      setShowPathModal(false);
      setEditingPath(null);
      loadPaths();
    } catch (err) {
      console.error('Error saving path:', err);
    }
  };

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({ course_id: '', is_mandatory: true, prerequisite_item_id: '', prerequisite_path_id: '' });
    setShowItemModal(true);
  };

  const openEditItem = (item: PathItem) => {
    setEditingItem(item);
    setItemForm({
      course_id: item.course_id,
      is_mandatory: item.is_mandatory,
      prerequisite_item_id: item.prerequisite_item_id || '',
      prerequisite_path_id: item.prerequisite_path_id || '',
    });
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        course_id: itemForm.course_id,
        is_mandatory: itemForm.is_mandatory,
        prerequisite_item_id: itemForm.prerequisite_item_id || null,
        prerequisite_path_id: itemForm.prerequisite_path_id || null,
      };

      if (editingItem?.id) {
        await supabase.from('learning_path_items').update(payload).eq('id', editingItem.id);
      } else {
        const nextOrderIndex = pathItems.length > 0 ? Math.max(...pathItems.map(i => i.order_index)) + 1 : 0;
        await supabase.from('learning_path_items').insert([{
          path_id: selectedPath,
          ...payload,
          order_index: nextOrderIndex,
        }]);
      }
      setShowItemModal(false);
      setEditingItem(null);
      if (selectedPath) loadPathItems(selectedPath);
    } catch (err) {
      console.error('Error saving item:', err);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm('Remove this course from the learning path?')) return;
    await supabase.from('learning_path_items').delete().eq('id', itemId);
    if (selectedPath) loadPathItems(selectedPath);
  };

  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = pathItems.findIndex(item => item.id === itemId);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === pathItems.length - 1) return;
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const current = pathItems[currentIndex];
    const swap = pathItems[swapIndex];
    await Promise.all([
      supabase.from('learning_path_items').update({ order_index: swap.order_index }).eq('id', current.id),
      supabase.from('learning_path_items').update({ order_index: current.order_index }).eq('id', swap.id),
    ]);
    if (selectedPath) loadPathItems(selectedPath);
  };

  const getPrereqPathName = (pathId: string) => paths.find(p => p.id === pathId)?.title || 'Unknown Path';
  const getPrereqItemName = (itemId: string) => {
    const idx = pathItems.findIndex(p => p.id === itemId);
    return idx >= 0 ? `Step ${idx + 1}: ${pathItems[idx].learning_courses?.title}` : 'Unknown Step';
  };

  const selectedPathData = paths.find(p => p.id === selectedPath);

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>;

  return (
    <div className="h-full flex flex-col px-8 py-8">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Learning Path Builder</h1>
          <p className="text-sm text-gray-500 mt-1">Create structured learning journeys with prerequisites and sequenced courses</p>
        </div>
        <button
          onClick={openCreatePath}
          className="flex items-center gap-2 px-4 py-2 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-500 transition font-semibold text-sm"
        >
          <Plus className="w-4 h-4" /> New Path
        </button>
      </div>

      <div className="flex flex-1 min-h-0 gap-5">
        <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Learning Paths</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {paths.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No paths created yet</p>
            ) : paths.map(path => (
              <button
                key={path.id}
                onClick={() => setSelectedPath(path.id)}
                className={`w-full text-left p-3 rounded-lg border transition group ${selectedPath === path.id ? 'border-stratefix-yellow bg-yellow-50' : 'border-gray-100 hover:border-gray-200'}`}
              >
                <p className={`text-sm font-semibold ${selectedPath === path.id ? 'text-gray-900' : 'text-gray-700'}`}>{path.title}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PATH_TYPE_COLORS[path.path_type] || 'bg-gray-100 text-gray-600'}`}>
                    {path.path_type.replace('_', ' ')}
                  </span>
                  {!path.is_active && <span className="text-xs text-gray-400">Inactive</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {!selectedPathData ? (
            <div className="h-full flex items-center justify-center bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="text-center">
                <Layers className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-700 mb-1">No path selected</h3>
                <p className="text-sm text-gray-400">Select a learning path or create a new one</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedPathData.title}</h2>
                  {selectedPathData.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{selectedPathData.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PATH_TYPE_COLORS[selectedPathData.path_type] || 'bg-gray-100 text-gray-600'}`}>
                      {selectedPathData.path_type.replace('_', ' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedPathData.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {selectedPathData.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-gray-400">{pathItems.length} course{pathItems.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEditPath(selectedPathData)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-xs font-semibold">
                    <Edit2 className="w-3.5 h-3.5" /> Edit Path
                  </button>
                  <button
                    onClick={openAddItem}
                    className="flex items-center gap-2 px-3 py-1.5 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-500 transition text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Course
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {pathItems.length === 0 ? (
                  <div className="text-center py-14">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-600 mb-1">No courses in this path</p>
                    <p className="text-xs text-gray-400 mb-4">Add courses to build this learning journey</p>
                    <button onClick={openAddItem} className="flex items-center gap-1.5 px-4 py-2 bg-stratefix-yellow text-stratefix-black rounded-lg text-sm font-semibold hover:bg-yellow-500 transition mx-auto">
                      <Plus className="w-4 h-4" /> Add First Course
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pathItems.map((item, index) => {
                      const course = item.learning_courses;
                      const dm = course?.delivery_type ? DELIVERY_LABELS[course.delivery_type] : null;
                      return (
                        <div key={item.id} className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <button onClick={() => handleMoveItem(item.id!, 'up')} disabled={index === 0} className={`p-1 rounded ${index === 0 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:bg-gray-100'}`}>
                                <MoveUp className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleMoveItem(item.id!, 'down')} disabled={index === pathItems.length - 1} className={`p-1 rounded ${index === pathItems.length - 1 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:bg-gray-100'}`}>
                                <MoveDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="w-8 h-8 rounded-full bg-blue-950 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                              {index + 1}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {item.is_mandatory && (
                                  <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-medium">Required</span>
                                )}
                                {dm && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${dm.color}`}>{dm.label}</span>
                                )}
                                {item.prerequisite_item_id && (
                                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">
                                    <Lock className="w-3 h-3" /> Step prerequisite
                                  </span>
                                )}
                                {item.prerequisite_path_id && (
                                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                                    <LinkIcon className="w-3 h-3" /> Path prerequisite
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-bold text-gray-900">{course?.title || 'Course'}</p>
                              {course?.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{course.description}</p>}
                              <div className="text-xs text-gray-400 mt-1.5 space-y-0.5">
                                {course?.duration_hours && <span>Duration: {course.duration_hours}h</span>}
                                {item.prerequisite_item_id && (
                                  <div className="flex items-center gap-1 text-amber-600">
                                    <Lock className="w-3 h-3" />
                                    <span>Requires: {getPrereqItemName(item.prerequisite_item_id)}</span>
                                  </div>
                                )}
                                {item.prerequisite_path_id && (
                                  <div className="flex items-center gap-1 text-blue-600">
                                    <Layers className="w-3 h-3" />
                                    <span>Requires path: {getPrereqPathName(item.prerequisite_path_id)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => openEditItem(item)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleRemoveItem(item.id!)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showPathModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{editingPath ? 'Edit Learning Path' : 'Create Learning Path'}</h2>
              <button onClick={() => setShowPathModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSavePath} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={pathForm.title}
                  onChange={e => setPathForm({ ...pathForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={pathForm.description}
                  onChange={e => setPathForm({ ...pathForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Path Type</label>
                <select
                  value={pathForm.path_type}
                  onChange={e => setPathForm({ ...pathForm, path_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                >
                  <option value="induction">Induction</option>
                  <option value="skill_development">Skill Development</option>
                  <option value="role_specific">Role Specific</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={pathForm.is_active} onChange={e => setPathForm({ ...pathForm, is_active: e.target.checked })} className="w-4 h-4 accent-stratefix-yellow" />
                <span className="text-sm text-gray-700">Active path</span>
              </label>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowPathModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-500 text-sm font-semibold">
                  {editingPath ? 'Save Changes' : 'Create Path'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{editingItem ? 'Edit Step' : 'Add Course to Path'}</h2>
              <button onClick={() => setShowItemModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSaveItem} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
                <select
                  value={itemForm.course_id}
                  onChange={e => setItemForm({ ...itemForm, course_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                  required
                  disabled={!!editingItem}
                >
                  <option value="">Select a course</option>
                  {courses
                    .filter(c => !pathItems.some(item => item.course_id === c.id && item.id !== editingItem?.id))
                    .map(course => (
                      <option key={course.id} value={course.id}>
                        {course.title} ({course.duration_hours}h)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prerequisites</label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Step in this path (optional)</label>
                    <select
                      value={itemForm.prerequisite_item_id}
                      onChange={e => setItemForm({ ...itemForm, prerequisite_item_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                    >
                      <option value="">No step prerequisite</option>
                      {pathItems.filter(item => item.id !== editingItem?.id).map((item, idx) => (
                        <option key={item.id} value={item.id}>
                          Step {idx + 1}: {item.learning_courses?.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">This step unlocks only after the selected step is completed.</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Entire learning path (optional)</label>
                    <select
                      value={itemForm.prerequisite_path_id}
                      onChange={e => setItemForm({ ...itemForm, prerequisite_path_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                    >
                      <option value="">No path prerequisite</option>
                      {paths.filter(p => p.id !== selectedPath).map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">This step unlocks only after the entire selected path is completed.</p>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={itemForm.is_mandatory} onChange={e => setItemForm({ ...itemForm, is_mandatory: e.target.checked })} className="w-4 h-4 accent-stratefix-yellow" />
                <span className="text-sm text-gray-700">Mandatory course</span>
              </label>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowItemModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-500 text-sm font-semibold">
                  {editingItem ? 'Save Changes' : 'Add Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingPath && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Delete Learning Path</h3>
            <p className="text-sm text-gray-500 mb-5">This will also remove all course steps in this path. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  await supabase.from('learning_paths').delete().eq('id', deletingPath);
                  if (selectedPath === deletingPath) setSelectedPath(null);
                  setDeletingPath(null);
                  loadPaths();
                }}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition"
              >
                Delete
              </button>
              <button onClick={() => setDeletingPath(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
