import { useState, useEffect } from 'react';
import { Plus, Trash2, MoveUp, MoveDown, BookOpen, Lock, Layers, Pencil as Edit2, X, Link as LinkIcon, ChevronRight, ChevronLeft } from 'lucide-react';
import { useRoute, replaceRoute, navigate } from '../../lib/router';
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

interface PathLearner { employee_id: string; full_name: string; status: 'assigned' | 'in_progress' | 'completed'; pct: number; coursesDone: number; due_date: string | null; }

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
  const [mobileDetail, setMobileDetail] = useState(false);
  const [showLearners, setShowLearners] = useState(false);
  const [pathStats, setPathStats] = useState<{ learners: PathLearner[]; inductionTemplates: string[] } | null>(null);
  const route = useRoute();

  useEffect(() => {
    if (!userProfile?.organization_id) return;
    loadPaths();
    loadCourses();
  }, [userProfile?.organization_id]);

  useEffect(() => {
    if (selectedPath) { loadPathItems(selectedPath); loadPathStats(selectedPath); }
  }, [selectedPath]);

  // Deep link: #/learning-path-builder/<path id>
  useEffect(() => {
    if (route.view !== 'learning-path-builder' || !route.id || paths.length === 0) return;
    if (paths.some(p => p.id === route.id)) { setSelectedPath(route.id); setMobileDetail(true); }
  }, [route.id, paths.length]);

  // Who is on this path, and how far along; which induction templates hand it out.
  const loadPathStats = async (pathId: string) => {
    setPathStats(null);
    const [asgRes, itemsRes, tplRes] = await Promise.all([
      supabase.from('employee_learning_assignments').select('id, employee_id, status, due_date').eq('learning_path_id', pathId),
      supabase.from('learning_path_items').select('course_id').eq('path_id', pathId),
      supabase.from('induction_templates').select('title').eq('learning_path_id', pathId).eq('is_active', true),
    ]);
    const asg = (asgRes.data || []) as any[];
    const courseIds = ((itemsRes.data || []) as any[]).map(i => i.course_id);
    const empIds = [...new Set(asg.map(a => a.employee_id))];
    let names = new Map<string, string>(); let doneByEmp = new Map<string, number>();
    if (empIds.length) {
      const [{ data: emps }, { data: prog }] = await Promise.all([
        supabase.from('employees').select('id, user_id').in('id', empIds),
        courseIds.length ? supabase.from('learning_progress').select('employee_id, course_id').in('employee_id', empIds).in('course_id', courseIds).is('module_id', null).eq('status', 'completed') : Promise.resolve({ data: [] as any[] }),
      ]);
      const userIds = ((emps || []) as any[]).map(e => e.user_id);
      const { data: profiles } = userIds.length ? await supabase.from('user_profiles').select('id, full_name').in('id', userIds) : { data: [] as any[] };
      for (const e of (emps || []) as any[]) names.set(e.id, ((profiles || []) as any[]).find(p => p.id === e.user_id)?.full_name || 'Unknown');
      const seen = new Set<string>();
      for (const p of (prog || []) as any[]) { const k = `${p.employee_id}:${p.course_id}`; if (!seen.has(k)) { seen.add(k); doneByEmp.set(p.employee_id, (doneByEmp.get(p.employee_id) || 0) + 1); } }
    }
    const learners: PathLearner[] = empIds.map(id => {
      const a = asg.find(x => x.employee_id === id);
      const coursesDone = doneByEmp.get(id) || 0;
      const done = a?.status === 'completed' || (courseIds.length > 0 && coursesDone >= courseIds.length);
      const status: PathLearner['status'] = done ? 'completed' : coursesDone > 0 || a?.status === 'in_progress' ? 'in_progress' : 'assigned';
      return { employee_id: id, full_name: names.get(id) || 'Unknown', status, pct: done ? 100 : courseIds.length ? Math.round(100 * coursesDone / courseIds.length) : 0, coursesDone, due_date: a?.due_date || null };
    }).sort((x, y) => x.full_name.localeCompare(y.full_name));
    setPathStats({ learners, inductionTemplates: ((tplRes.data || []) as any[]).map(t => t.title) });
  };

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

  const selectPath = (id: string) => { setSelectedPath(id); setMobileDetail(true); replaceRoute('learning-path-builder', id); };
  const totalHours = pathItems.reduce((n, it) => n + (it.learning_courses?.duration_hours || 0), 0);
  const requiredCount = pathItems.filter(it => it.is_mandatory).length;
  const typeLabel = (t: string) => t.replace('_', ' ');

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 lg:px-6 h-11 flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900 hidden sm:inline">{paths.length} learning path{paths.length === 1 ? '' : 's'}</span>
        <div className="flex-1" />
        <button onClick={openCreatePath} className="inline-flex items-center gap-1.5 h-8 px-3 bg-stratefix-yellow text-brand-on-primary rounded-lg hover:bg-stratefix-yellow/90 transition text-sm font-semibold">
          <Plus className="w-3.5 h-3.5" /> New path
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* List */}
        <section aria-label="Learning paths" className={`w-full lg:w-[280px] lg:flex-shrink-0 flex-col bg-white lg:border-r border-gray-200 min-h-0 ${mobileDetail ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex-1 overflow-y-auto">
            {paths.length === 0 && (
              <div className="text-center py-12 px-6">
                <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">No learning paths yet</p>
                <p className="text-xs text-gray-500 mt-0.5">A path is a sequence of courses with an order and prerequisites.</p>
              </div>
            )}
            {paths.map(path => {
              const isSel = path.id === selectedPath;
              return (
                <button key={path.id} onClick={() => selectPath(path.id)} aria-current={isSel ? 'true' : undefined} className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border-l-[3px] transition ${isSel ? 'bg-stratefix-yellow/10 border-stratefix-yellow' : 'border-transparent hover:bg-gray-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${path.is_active ? 'text-gray-900' : 'text-gray-400'}`}>{path.title}</p>
                    <p className="text-xs text-gray-500 truncate capitalize">{typeLabel(path.path_type)}</p>
                  </div>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${path.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} title={path.is_active ? 'Active' : 'Inactive'} />
                  <ChevronRight className="w-4 h-4 text-gray-300 lg:hidden" />
                </button>
              );
            })}
          </div>
        </section>

        {/* Detail */}
        <section aria-label="Learning path detail" className={`flex-1 min-w-0 flex-col min-h-0 overflow-y-auto ${mobileDetail ? 'flex' : 'hidden lg:flex'}`}>
          {!selectedPathData ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Select a learning path</h3>
                <p className="text-xs text-gray-500">Choose one from the list to see its courses and who is on it.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 lg:p-6 space-y-4">
              <button onClick={() => setMobileDetail(false)} className="lg:hidden inline-flex items-center gap-1 text-sm text-gray-600 -mt-1"><ChevronLeft className="w-4 h-4" /> All paths</button>

              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-gray-900 leading-tight">{selectedPathData.title}</h2>
                    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${selectedPathData.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{selectedPathData.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 capitalize">{typeLabel(selectedPathData.path_type)}</p>
                  {selectedPathData.description && <p className="text-sm text-gray-700 mt-2 max-w-3xl">{selectedPathData.description}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <button onClick={() => openEditPath(selectedPathData)} className="h-8 px-3 rounded-lg border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-50 transition">Edit</button>
                  <button onClick={() => setDeletingPath(selectedPathData.id)} title="Delete" className="h-8 w-8 rounded-lg border border-gray-300 text-red-600 hover:bg-red-50 transition flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Stats strip */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-2 sm:flex -mt-px -ml-px">
                  <button onClick={() => pathStats?.learners.length && setShowLearners(true)} disabled={!pathStats?.learners.length} title="See who is on this path" className="px-4 py-2.5 min-w-0 sm:flex-1 sm:basis-0 border-t border-l border-gray-100 text-left hover:bg-gray-50 transition disabled:cursor-default">
                    <p className="text-xs text-gray-500">Assigned</p>
                    <p className={`text-sm font-semibold ${pathStats?.learners.length ? 'text-blue-800 underline decoration-dotted underline-offset-2' : 'text-gray-900'}`}>{pathStats ? `${pathStats.learners.length} learner${pathStats.learners.length === 1 ? '' : 's'}` : '…'}</p>
                  </button>
                  <button onClick={() => pathStats?.learners.length && setShowLearners(true)} disabled={!pathStats?.learners.length} className="px-4 py-2.5 min-w-0 sm:flex-1 sm:basis-0 border-t border-l border-gray-100 text-left hover:bg-gray-50 transition disabled:cursor-default">
                    <p className="text-xs text-gray-500">Completed</p>
                    <p className="text-sm font-semibold text-gray-900">{pathStats ? `${pathStats.learners.filter(l => l.status === 'completed').length}${pathStats.learners.length ? ` · ${Math.round(100 * pathStats.learners.filter(l => l.status === 'completed').length / pathStats.learners.length)}%` : ''}` : '…'}</p>
                  </button>
                  <div className="px-4 py-2.5 min-w-0 sm:flex-1 sm:basis-0 border-t border-l border-gray-100"><p className="text-xs text-gray-500">Courses</p><p className="text-sm font-semibold text-gray-900">{pathItems.length} · {totalHours} h · {requiredCount} required</p></div>
                  <div className="px-4 py-2.5 min-w-0 sm:flex-1 sm:basis-0 border-t border-l border-gray-100"><p className="text-xs text-gray-500">Used by inductions</p><p className="text-sm font-semibold text-gray-900 truncate">{pathStats ? (pathStats.inductionTemplates.length ? pathStats.inductionTemplates.join(', ') : 'None') : '…'}</p></div>
                </div>
              </div>

              {/* Courses table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 h-10 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Courses in order</h3>
                  <span className="text-xs text-gray-500">{pathItems.length}</span>
                  <div className="flex-1" />
                  <button onClick={openAddItem} className="inline-flex items-center gap-1.5 h-8 px-3 bg-stratefix-yellow text-brand-on-primary rounded-lg hover:bg-stratefix-yellow/90 transition text-sm font-semibold"><Plus className="w-3.5 h-3.5" /> Add course</button>
                </div>
                {pathItems.length === 0 ? (
                  <div className="text-center py-10">
                    <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">No courses yet</p>
                    <p className="text-xs text-gray-500 mt-0.5">Add courses in the order learners should take them.</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full text-sm hidden md:table">
                      <thead>
                        <tr className="text-xs text-gray-500 text-left">
                          <th className="font-medium px-3.5 py-2 w-8">#</th>
                          <th className="font-medium px-3.5 py-2">Course</th>
                          <th className="font-medium px-3.5 py-2 w-28">Delivery</th>
                          <th className="font-medium px-3.5 py-2 w-20">Length</th>
                          <th className="font-medium px-3.5 py-2 w-24">Required</th>
                          <th className="font-medium px-3.5 py-2">Unlocks after</th>
                          <th className="font-medium px-3.5 py-2 w-28"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pathItems.map((item, index) => {
                          const d = DELIVERY_LABELS[item.learning_courses?.delivery_type || 'self_paced'];
                          return (
                            <tr key={item.id} className="border-t border-gray-100 group">
                              <td className="px-3.5 py-2.5 text-gray-500">{index + 1}</td>
                              <td className="px-3.5 py-2.5"><button onClick={() => navigate('course-builder', item.course_id)} className="font-medium text-gray-900 hover:underline text-left">{item.learning_courses?.title}</button></td>
                              <td className="px-3.5 py-2.5 text-gray-700">{d?.label || 'Self-Paced'}</td>
                              <td className="px-3.5 py-2.5 text-gray-700">{item.learning_courses?.duration_hours || 0} h</td>
                              <td className="px-3.5 py-2.5">{item.is_mandatory ? <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">Required</span> : <span className="text-xs text-gray-500">Optional</span>}</td>
                              <td className="px-3.5 py-2.5 text-xs text-gray-600">
                                {item.prerequisite_item_id ? <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" />{getPrereqItemName(item.prerequisite_item_id)}</span>
                                  : item.prerequisite_path_id ? <span className="inline-flex items-center gap-1"><LinkIcon className="w-3 h-3" />Path: {getPrereqPathName(item.prerequisite_path_id)}</span>
                                  : <span className="text-gray-400">—</span>}
                              </td>
                              <td className="px-3.5 py-2.5">
                                <div className="flex items-center justify-end gap-0.5 opacity-70 group-hover:opacity-100">
                                  <button onClick={() => handleMoveItem(item.id!, 'up')} disabled={index === 0} title="Move up" className="h-7 w-7 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"><MoveUp className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleMoveItem(item.id!, 'down')} disabled={index === pathItems.length - 1} title="Move down" className="h-7 w-7 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"><MoveDown className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => openEditItem(item)} title="Edit" className="h-7 w-7 rounded-md text-gray-600 hover:bg-gray-100 flex items-center justify-center"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleRemoveItem(item.id!)} title="Remove from path" className="h-7 w-7 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <ul className="md:hidden divide-y divide-gray-100">
                      {pathItems.map((item, index) => (
                        <li key={item.id} className="px-3.5 py-3">
                          <div className="flex items-start gap-3">
                            <span className="text-xs text-gray-500 w-4 pt-0.5">{index + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{item.learning_courses?.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{DELIVERY_LABELS[item.learning_courses?.delivery_type || 'self_paced']?.label} · {item.learning_courses?.duration_hours || 0} h{item.is_mandatory ? ' · Required' : ''}{item.prerequisite_item_id ? ` · after ${getPrereqItemName(item.prerequisite_item_id)}` : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-2 pl-7">
                            <button onClick={() => openEditItem(item)} className="h-9 px-3 rounded-lg text-xs font-medium text-gray-700 border border-gray-300">Edit</button>
                            <button onClick={() => handleMoveItem(item.id!, 'up')} disabled={index === 0} aria-label="Move up" className="h-9 w-9 rounded-lg text-gray-500 border border-gray-200 disabled:opacity-30 flex items-center justify-center"><MoveUp className="w-4 h-4" /></button>
                            <button onClick={() => handleMoveItem(item.id!, 'down')} disabled={index === pathItems.length - 1} aria-label="Move down" className="h-9 w-9 rounded-lg text-gray-500 border border-gray-200 disabled:opacity-30 flex items-center justify-center"><MoveDown className="w-4 h-4" /></button>
                            <button onClick={() => handleRemoveItem(item.id!)} aria-label="Remove" className="h-9 w-9 rounded-lg text-red-500 border border-gray-200 flex items-center justify-center ml-auto"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {showLearners && selectedPathData && pathStats && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLearners(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 px-4 h-12 border-b border-gray-100 flex-shrink-0">
              <div className="min-w-0"><h3 className="text-sm font-semibold text-gray-900 truncate">Who is on “{selectedPathData.title}”</h3><p className="text-xs text-gray-500">{pathStats.learners.length} learner{pathStats.learners.length === 1 ? '' : 's'} · {pathStats.learners.filter(l => l.status === 'completed').length} completed</p></div>
              <div className="flex-1" />
              <button onClick={() => setShowLearners(false)} className="w-9 h-9 -mr-2 flex items-center justify-center text-gray-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-500 text-left"><th className="font-medium px-4 py-2">Learner</th><th className="font-medium px-4 py-2 w-44">Progress</th><th className="font-medium px-4 py-2 w-28">Due</th></tr></thead>
                <tbody>
                  {pathStats.learners.map(l => (
                    <tr key={l.employee_id} className="border-t border-gray-100">
                      <td className="px-4 py-2"><button onClick={() => navigate('employees', l.employee_id)} className="text-gray-900 hover:underline text-left">{l.full_name}</button></td>
                      <td className="px-4 py-2"><div className="flex items-center gap-2"><div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${l.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${l.pct}%` }} /></div><span className="text-xs text-gray-600">{l.status === 'completed' ? 'Done' : `${l.coursesDone} of ${pathItems.length} courses`}</span></div></td>
                      <td className={`px-4 py-2 text-xs ${l.due_date && l.status !== 'completed' && new Date(l.due_date) < new Date() ? 'text-red-700 font-medium' : 'text-gray-600'}`}>{l.due_date ? new Date(l.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex justify-end"><button onClick={() => { setShowLearners(false); navigate('assign-learning'); }} className="h-8 px-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50">Assign to more people</button></div>
          </div>
        </div>
      )}

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
                <button type="submit" className="flex-1 px-4 py-2 bg-stratefix-yellow text-brand-on-primary rounded-lg hover:bg-stratefix-yellow/90 text-sm font-semibold">
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
                <button type="submit" className="flex-1 px-4 py-2 bg-stratefix-yellow text-brand-on-primary rounded-lg hover:bg-stratefix-yellow/90 text-sm font-semibold">
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
