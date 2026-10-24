import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil as Edit2, Trash2, BookOpen, Video, FileText, Link as LinkIcon, ArrowUp, ArrowDown, ChevronRight, ChevronLeft, Archive, CheckCircle, File as FileEdit, X, Layers, Upload, HelpCircle, Award, Users, ClipboardList, Monitor, Briefcase, Play } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import QuizBuilder from './course-builder/QuizBuilder';
import LDCertifications from './course-builder/LDCertifications';
import CourseAccessRequests from './CourseAccessRequests';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  delivery_type: 'self_paced' | 'classroom' | 'on_job';
  is_assessment: boolean;
  duration_hours: number;
  status: 'draft' | 'published' | 'archived';
  is_active: boolean;
  created_at: string;
  skill_ids?: string[];
}

interface Skill {
  id: string;
  name: string;
  category: string;
}

interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string;
  content_type: string;
  content_url: string;
  content_file_path: string | null;
  content_file_name: string | null;
  duration_minutes: number;
  order_index: number;
  is_mandatory: boolean;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileEdit },
  published: { label: 'Published', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  archived: { label: 'Archived', color: 'bg-amber-100 text-amber-700', icon: Archive },
};

const DELIVERY_META: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  self_paced: { label: 'Self-Paced', color: 'bg-blue-100 text-blue-700', icon: Monitor, description: 'Learner completes at their own pace' },
  classroom: { label: 'Classroom', color: 'bg-teal-100 text-teal-700', icon: Users, description: 'Instructor-led session; L&D must certify' },
  on_job: { label: 'On-the-Job', color: 'bg-orange-100 text-orange-700', icon: Briefcase, description: 'Workplace training; L&D must certify' },
};

const CONTENT_ICONS: Record<string, React.ElementType> = {
  video: Video,
  document: FileText,
  presentation: FileText,
  quiz: HelpCircle,
  assignment: ClipboardList,
  external_link: LinkIcon,
};

function getContentIcon(type: string): React.ElementType {
  return CONTENT_ICONS[type] || BookOpen;
}

const BLANK_COURSE = {
  title: '',
  description: '',
  category: '',
  delivery_type: 'self_paced' as const,
  is_assessment: false,
  duration_hours: 1,
  status: 'draft' as const,
  skill_ids: [] as string[],
};

const BLANK_MODULE = {
  title: '',
  description: '',
  content_type: 'video',
  content_url: '',
  duration_minutes: 30,
  is_mandatory: true,
};

type Tab = 'courses' | 'certifications' | 'requests';

export default function CourseBuilder({ initialTab = 'courses' }: { initialTab?: Tab } = {}) {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);

  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState(BLANK_COURSE);

  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleForm, setModuleForm] = useState(BLANK_MODULE);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [quizBuilderModule, setQuizBuilderModule] = useState<Module | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'course' | 'module'; id: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'course' | 'assessment'>('all');
  const [descExpanded, setDescExpanded] = useState(false);
  const [courseStats, setCourseStats] = useState<{ assigned: number; completed: number; paths: string[] } | null>(null);
  // On phones the list and the detail are two screens; this says which one is showing.
  const [mobileDetail, setMobileDetail] = useState(false);

  useEffect(() => {
    if (userProfile?.organization_id) {
      loadCourses();
      loadSkills();
      supabase.from('course_access_requests').select('id', { count: 'exact', head: true }).eq('organization_id', userProfile.organization_id).eq('status', 'pending')
        .then(({ count }) => setPendingRequests(count || 0));
    }
  }, [userProfile?.organization_id]);

  useEffect(() => {
    if (selectedCourse) { loadModules(selectedCourse.id); loadCourseStats(selectedCourse.id); }
    else setModules([]);
    setDescExpanded(false);
  }, [selectedCourse?.id]);

  const loadSkills = async () => {
    const { data } = await supabase
      .from('skills')
      .select('id, name, category')
      .eq('organization_id', userProfile?.organization_id)
      .order('name');
    setAvailableSkills(data || []);
  };

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_courses')
        .select('*')
        .eq('organization_id', userProfile?.organization_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCourses(data || []);
    } finally {
      setLoading(false);
    }
  };

  const loadCourseStats = async (courseId: string) => {
    setCourseStats(null);
    const [asg, prog, items] = await Promise.all([
      supabase.from('employee_learning_assignments').select('employee_id, status').eq('course_id', courseId),
      supabase.from('learning_progress').select('employee_id, status').eq('course_id', courseId).is('module_id', null),
      supabase.from('learning_path_items').select('learning_paths(title)').eq('course_id', courseId),
    ]);
    // A learner counts as assigned if the course was assigned directly or reached through a path.
    const assignedIds = new Set<string>();
    const completedIds = new Set<string>();
    for (const a of (asg.data || []) as { employee_id: string; status: string }[]) { assignedIds.add(a.employee_id); if (a.status === 'completed') completedIds.add(a.employee_id); }
    for (const p of (prog.data || []) as { employee_id: string; status: string }[]) { assignedIds.add(p.employee_id); if (p.status === 'completed') completedIds.add(p.employee_id); }
    const paths = [...new Set((items.data || []).map((i: any) => i.learning_paths?.title).filter(Boolean))] as string[];
    setCourseStats({ assigned: assignedIds.size, completed: completedIds.size, paths });
  };

  const loadModules = async (courseId: string) => {
    const { data } = await supabase
      .from('learning_modules')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });
    setModules(data || []);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: courseForm.title,
        description: courseForm.description,
        category: courseForm.category,
        delivery_type: courseForm.delivery_type,
        is_assessment: courseForm.is_assessment,
        duration_hours: courseForm.duration_hours,
        status: courseForm.status,
        skill_ids: courseForm.skill_ids,
        is_active: courseForm.status === 'published',
      };
      if (editingCourse) {
        await supabase.from('learning_courses').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingCourse.id);
        setSelectedCourse({ ...editingCourse, ...payload });
      } else {
        await supabase.from('learning_courses').insert([{
          ...payload,
          organization_id: userProfile?.organization_id,
          created_by: userProfile?.id,
        }]);
      }
      setShowCourseForm(false);
      setEditingCourse(null);
      setCourseForm(BLANK_COURSE);
      loadCourses();
    } catch (err) {
      console.error('Error saving course:', err);
    }
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setCourseForm({
      title: course.title,
      description: course.description || '',
      category: course.category || '',
      delivery_type: course.delivery_type || 'self_paced',
      is_assessment: course.is_assessment || false,
      duration_hours: course.duration_hours || 1,
      status: course.status,
      skill_ids: course.skill_ids || [],
    });
    setShowCourseForm(true);
  };

  const handleDeleteCourse = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'course') return;
    await supabase.from('learning_courses').delete().eq('id', deleteConfirm.id);
    if (selectedCourse?.id === deleteConfirm.id) setSelectedCourse(null);
    setDeleteConfirm(null);
    loadCourses();
  };

  const handleStatusChange = async (course: Course, status: 'draft' | 'published' | 'archived') => {
    await supabase.from('learning_courses').update({ status, is_active: status === 'published', updated_at: new Date().toISOString() }).eq('id', course.id);
    if (selectedCourse?.id === course.id) setSelectedCourse({ ...selectedCourse, status, is_active: status === 'published' });
    loadCourses();
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setUploading(true);
    try {
      let filePath: string | null = editingModule?.content_file_path || null;
      let fileName: string | null = editingModule?.content_file_name || null;

      if (uploadFile) {
        const ext = uploadFile.name.split('.').pop();
        const storagePath = `${userProfile?.organization_id}/${selectedCourse.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('course-content').upload(storagePath, uploadFile, { upsert: true });
        if (!uploadErr) {
          filePath = storagePath;
          fileName = uploadFile.name;
        }
      }

      const payload = {
        ...moduleForm,
        content_file_path: filePath,
        content_file_name: fileName,
        content_url: moduleForm.content_url || '',
      };

      if (editingModule) {
        await supabase.from('learning_modules').update(payload).eq('id', editingModule.id);
      } else {
        await supabase.from('learning_modules').insert([{
          ...payload,
          course_id: selectedCourse.id,
          order_index: modules.length + 1,
        }]);
      }
      setShowModuleForm(false);
      setEditingModule(null);
      setModuleForm(BLANK_MODULE);
      setUploadFile(null);
      loadModules(selectedCourse.id);
    } finally {
      setUploading(false);
    }
  };

  const handleEditModule = (module: Module) => {
    setEditingModule(module);
    setModuleForm({
      title: module.title,
      description: module.description || '',
      content_type: module.content_type,
      content_url: module.content_url || '',
      duration_minutes: module.duration_minutes,
      is_mandatory: module.is_mandatory,
    });
    setUploadFile(null);
    setShowModuleForm(true);
  };

  const handleDeleteModule = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'module') return;
    await supabase.from('learning_modules').delete().eq('id', deleteConfirm.id);
    setDeleteConfirm(null);
    loadModules(selectedCourse!.id);
  };

  const handleMoveModule = async (moduleId: string, direction: 'up' | 'down') => {
    const currentIndex = modules.findIndex(m => m.id === moduleId);
    if ((direction === 'up' && currentIndex === 0) || (direction === 'down' && currentIndex === modules.length - 1)) return;
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const reordered = [...modules];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(newIndex, 0, moved);
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from('learning_modules').update({ order_index: i + 1 }).eq('id', reordered[i].id);
    }
    loadModules(selectedCourse!.id);
  };

  const filteredCourses = courses.filter(c => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesType = typeFilter === 'all' || (typeFilter === 'assessment' ? c.is_assessment : !c.is_assessment);
    return matchesStatus && matchesType;
  });

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

  const isLDManager = userProfile?.role && ['admin', 'platform_admin', 'l_d_manager', 'org_admin', 'hr'].includes(userProfile.role);

  const selectCourse = (course: Course) => { setSelectedCourse(course); setMobileDetail(true); };

  const newCourseButton = (assessment: boolean) => () => {
    setEditingCourse(null);
    setCourseForm({ ...BLANK_COURSE, is_assessment: assessment });
    setShowCourseForm(true);
  };

  const requiredCount = modules.filter(m => m.is_mandatory).length;
  const totalMinutes = modules.reduce((s, m) => s + (m.duration_minutes || 0), 0);

  const chip = (cls: string, text: string) => (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{text}</span>
  );

  const statusChip = (status: string) => {
    const sm = STATUS_META[status] || STATUS_META.draft;
    return chip(sm.color.replace(/bg-(\w+)-100/, 'bg-$1-50'), sm.label);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Toolbar: tabs left, actions right */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 lg:px-6 flex items-center gap-3 h-11">
        {isLDManager ? (
          <div className="flex items-stretch gap-5 h-full">
            {([
              { id: 'courses', label: 'Courses & assessments', short: 'Courses', count: courses.length },
              { id: 'certifications', label: 'Certifications', short: 'Certifications', count: null },
              { id: 'requests', label: 'Access requests', short: 'Requests', count: pendingRequests || null },
            ] as { id: Tab; label: string; short: string; count: number | null }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 text-sm border-b-2 transition ${activeTab === tab.id ? 'border-stratefix-yellow text-gray-900 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              >
                <span className="hidden sm:inline">{tab.label}</span><span className="sm:hidden">{tab.short}</span>
                {tab.count !== null && <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-px">{tab.count}</span>}
              </button>
            ))}
          </div>
        ) : <span className="text-sm font-semibold text-gray-900">Courses & assessments</span>}
        <div className="flex-1" />
        {activeTab === 'courses' && (
          <div className="flex items-center gap-2">
            <button onClick={newCourseButton(true)} className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
              <ClipboardList className="w-3.5 h-3.5" /> New assessment
            </button>
            <button onClick={newCourseButton(false)} className="inline-flex items-center gap-1.5 h-8 px-3 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-400 transition text-sm font-semibold">
              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">New course</span><span className="sm:hidden">New</span>
            </button>
          </div>
        )}
      </div>

      {activeTab === 'requests' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <CourseAccessRequests embedded />
        </div>
      ) : activeTab === 'certifications' && userProfile?.organization_id ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <LDCertifications organizationId={userProfile.organization_id} />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">

          {/* List */}
          <section
            aria-label="Courses"
            className={`w-full lg:w-[280px] lg:flex-shrink-0 flex-col bg-white lg:border-r border-gray-200 min-h-0 ${mobileDetail ? 'hidden lg:flex' : 'flex'}`}
          >
            <div className="px-3 py-2.5 border-b border-gray-100 flex flex-wrap gap-1.5">
              {(['all', 'published', 'draft', 'archived'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`h-7 px-2.5 rounded-full text-xs font-medium capitalize transition ${statusFilter === f ? 'bg-stratefix-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {f}
                </button>
              ))}
              <button
                onClick={() => setTypeFilter(typeFilter === 'assessment' ? 'all' : 'assessment')}
                className={`h-7 px-2.5 rounded-full text-xs font-medium transition ${typeFilter === 'assessment' ? 'bg-violet-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                Assessments
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredCourses.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm">Nothing matches these filters</div>
              )}
              {filteredCourses.map(course => {
                const isSelected = selectedCourse?.id === course.id;
                const dm = DELIVERY_META[course.delivery_type || 'self_paced'];
                const dot = course.status === 'published' ? 'bg-emerald-500' : course.status === 'archived' ? 'bg-gray-300' : 'bg-amber-400';
                return (
                  <button
                    key={course.id}
                    onClick={() => selectCourse(course)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 border-l-[3px] transition ${isSelected ? 'bg-yellow-50 border-stratefix-yellow' : 'border-transparent hover:bg-gray-50'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{course.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {course.is_assessment ? 'Assessment' : dm.label}{course.duration_hours > 0 ? ` · ${course.duration_hours} h` : ''}{course.category ? ` · ${course.category}` : ''}
                      </p>
                    </div>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} title={STATUS_META[course.status]?.label || course.status} />
                    <ChevronRight className="w-4 h-4 text-gray-300 lg:hidden" />
                  </button>
                );
              })}
            </div>
          </section>

          {/* Detail */}
          <section
            aria-label="Course detail"
            className={`flex-1 min-w-0 flex-col min-h-0 overflow-y-auto ${mobileDetail ? 'flex' : 'hidden lg:flex'}`}
          >
            {!selectedCourse ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Select a course or assessment</h3>
                  <p className="text-xs text-gray-500">Choose one from the list to see and edit its modules.</p>
                </div>
              </div>
            ) : (
              <div className="p-4 lg:p-6 space-y-4">
                <button onClick={() => setMobileDetail(false)} className="lg:hidden inline-flex items-center gap-1 text-sm text-gray-600 -mt-1">
                  <ChevronLeft className="w-4 h-4" /> All courses
                </button>

                {/* Title row */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-gray-900 leading-tight">{selectedCourse.title}</h2>
                      {statusChip(selectedCourse.status)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {[
                        selectedCourse.is_assessment ? 'Assessment' : DELIVERY_META[selectedCourse.delivery_type || 'self_paced'].label,
                        selectedCourse.duration_hours > 0 ? `${selectedCourse.duration_hours} h` : null,
                        selectedCourse.category,
                        (selectedCourse.skill_ids || []).length > 0
                          ? 'Skills: ' + (selectedCourse.skill_ids || []).map(sid => availableSkills.find(sk => sk.id === sid)?.name).filter(Boolean).join(', ')
                          : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {selectedCourse.description && (
                      <div className="mt-2 max-w-3xl">
                        <p className={`text-sm text-gray-700 leading-relaxed ${descExpanded ? '' : 'line-clamp-2'}`}>{selectedCourse.description}</p>
                        {selectedCourse.description.length > 140 && (
                          <button onClick={() => setDescExpanded(e => !e)} className="text-xs text-blue-800 font-medium mt-0.5 hover:underline">
                            {descExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {selectedCourse.status !== 'published' ? (
                      <button onClick={() => handleStatusChange(selectedCourse, 'published')} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">Publish</button>
                    ) : (
                      <button onClick={() => handleStatusChange(selectedCourse, 'draft')} className="h-8 px-3 rounded-lg border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-50 transition">Unpublish</button>
                    )}
                    <button onClick={() => handleEditCourse(selectedCourse)} className="h-8 px-3 rounded-lg border border-gray-300 text-gray-800 text-sm font-medium hover:bg-gray-50 transition">Edit</button>
                    {selectedCourse.status !== 'archived' && (
                      <button onClick={() => handleStatusChange(selectedCourse, 'archived')} title="Archive" className="h-8 w-8 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition flex items-center justify-center"><Archive className="w-3.5 h-3.5" /></button>
                    )}
                    <button onClick={() => setDeleteConfirm({ type: 'course', id: selectedCourse.id })} title="Delete" className="h-8 w-8 rounded-lg border border-gray-300 text-red-600 hover:bg-red-50 transition flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* Stats strip */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg">
                  <div><p className="text-xs text-gray-500">Assigned</p><p className="text-sm font-semibold text-gray-900">{courseStats ? `${courseStats.assigned} learner${courseStats.assigned === 1 ? '' : 's'}` : '…'}</p></div>
                  <div><p className="text-xs text-gray-500">Completed</p><p className="text-sm font-semibold text-gray-900">{courseStats ? `${courseStats.completed}${courseStats.assigned ? ` · ${Math.round((courseStats.completed / courseStats.assigned) * 100)}%` : ''}` : '…'}</p></div>
                  <div><p className="text-xs text-gray-500">Modules</p><p className="text-sm font-semibold text-gray-900">{modules.length} · {totalMinutes} min · {requiredCount} required</p></div>
                  <div className="min-w-0"><p className="text-xs text-gray-500">In learning paths</p><p className="text-sm font-semibold text-gray-900 truncate">{courseStats ? (courseStats.paths.length ? courseStats.paths.join(', ') : 'None') : '…'}</p></div>
                </div>

                {(selectedCourse.delivery_type === 'classroom' || selectedCourse.delivery_type === 'on_job') && !selectedCourse.is_assessment && (
                  <div className="px-3.5 py-2.5 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-2.5 text-xs text-teal-900">
                    <Award className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <span>
                      <strong>{DELIVERY_META[selectedCourse.delivery_type].label}:</strong> completion is signed off by L&D in the{' '}
                      <button onClick={() => setActiveTab('certifications')} className="underline font-semibold hover:no-underline">Certifications</button> tab.
                    </span>
                  </div>
                )}

                {/* Modules table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900">{selectedCourse.is_assessment ? 'Assessment modules' : 'Modules'}</h3>
                    <span className="text-xs text-gray-500">{modules.length}</span>
                    <div className="flex-1" />
                    <button
                      onClick={() => { setEditingModule(null); setModuleForm({ ...BLANK_MODULE, content_type: selectedCourse.is_assessment ? 'quiz' : 'video' }); setUploadFile(null); setShowModuleForm(true); }}
                      className="inline-flex items-center gap-1.5 h-8 px-3 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-400 transition text-sm font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add module
                    </button>
                  </div>

                  {modules.length === 0 ? (
                    <div className="text-center py-10">
                      <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700">No modules yet</p>
                      <p className="text-xs text-gray-500 mt-0.5">Add the first module to give this {selectedCourse.is_assessment ? 'assessment' : 'course'} some content.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 text-left">
                              <th className="font-medium px-3.5 py-2 w-8">#</th>
                              <th className="font-medium px-3.5 py-2">Module</th>
                              <th className="font-medium px-3.5 py-2 w-28">Type</th>
                              <th className="font-medium px-3.5 py-2 w-20">Length</th>
                              <th className="font-medium px-3.5 py-2 w-24">Required</th>
                              <th className="font-medium px-3.5 py-2 w-44"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {modules.map((module, index) => {
                              const Icon = getContentIcon(module.content_type);
                              const isQuiz = module.content_type === 'quiz';
                              return (
                                <tr key={module.id} className="border-t border-gray-100 group">
                                  <td className="px-3.5 py-2.5 text-gray-500">{index + 1}</td>
                                  <td className="px-3.5 py-2.5">
                                    <p className="font-medium text-gray-900">{module.title}</p>
                                    <p className="text-xs text-gray-500 truncate max-w-md">
                                      {module.content_file_name || module.content_url || module.description || ''}
                                    </p>
                                  </td>
                                  <td className="px-3.5 py-2.5 text-gray-700"><span className="inline-flex items-center gap-1.5"><Icon className={`w-3.5 h-3.5 ${isQuiz ? 'text-violet-600' : 'text-gray-400'}`} />{module.content_type.replace('_', ' ')}</span></td>
                                  <td className="px-3.5 py-2.5 text-gray-700">{module.duration_minutes} min</td>
                                  <td className="px-3.5 py-2.5">{module.is_mandatory ? chip('bg-amber-50 text-amber-800', 'Required') : <span className="text-xs text-gray-500">Optional</span>}</td>
                                  <td className="px-3.5 py-2.5">
                                    <div className="flex items-center justify-end gap-0.5 opacity-70 group-hover:opacity-100">
                                      {isQuiz && (
                                        <button onClick={() => setQuizBuilderModule(module)} className="h-7 px-2 rounded-md text-xs font-medium text-violet-700 hover:bg-violet-50 transition">Questions</button>
                                      )}
                                      <button onClick={() => handleMoveModule(module.id, 'up')} disabled={index === 0} title="Move up" className="h-7 w-7 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"><ArrowUp className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => handleMoveModule(module.id, 'down')} disabled={index === modules.length - 1} title="Move down" className="h-7 w-7 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center"><ArrowDown className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => handleEditModule(module)} title="Edit" className="h-7 w-7 rounded-md text-gray-600 hover:bg-gray-100 flex items-center justify-center"><Edit2 className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => setDeleteConfirm({ type: 'module', id: module.id })} title="Delete" className="h-7 w-7 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Phone list */}
                      <ul className="md:hidden divide-y divide-gray-100">
                        {modules.map((module, index) => {
                          const Icon = getContentIcon(module.content_type);
                          const isQuiz = module.content_type === 'quiz';
                          return (
                            <li key={module.id} className="px-3.5 py-3">
                              <div className="flex items-start gap-3">
                                <span className="text-xs text-gray-500 w-4 pt-0.5">{index + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">{module.title}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    <Icon className={`w-3.5 h-3.5 ${isQuiz ? 'text-violet-600' : 'text-gray-400'}`} />
                                    <span className="capitalize">{module.content_type.replace('_', ' ')}</span> · {module.duration_minutes} min
                                    {module.is_mandatory && <> · <span className="text-amber-800 font-medium">Required</span></>}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 mt-2 pl-7">
                                {isQuiz && <button onClick={() => setQuizBuilderModule(module)} className="h-9 px-3 rounded-lg text-xs font-medium text-violet-700 bg-violet-50">Questions</button>}
                                <button onClick={() => handleEditModule(module)} className="h-9 px-3 rounded-lg text-xs font-medium text-gray-700 border border-gray-300">Edit</button>
                                <button onClick={() => handleMoveModule(module.id, 'up')} disabled={index === 0} aria-label="Move up" className="h-9 w-9 rounded-lg text-gray-500 border border-gray-200 disabled:opacity-30 flex items-center justify-center"><ArrowUp className="w-4 h-4" /></button>
                                <button onClick={() => handleMoveModule(module.id, 'down')} disabled={index === modules.length - 1} aria-label="Move down" className="h-9 w-9 rounded-lg text-gray-500 border border-gray-200 disabled:opacity-30 flex items-center justify-center"><ArrowDown className="w-4 h-4" /></button>
                                <button onClick={() => setDeleteConfirm({ type: 'module', id: module.id })} aria-label="Delete" className="h-9 w-9 rounded-lg text-red-500 border border-gray-200 flex items-center justify-center ml-auto"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {showCourseForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingCourse ? 'Edit' : courseForm.is_assessment ? 'New Assessment' : 'New Course'}
              </h2>
              <button onClick={() => { setShowCourseForm(false); setEditingCourse(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSaveCourse} className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <button
                  type="button"
                  onClick={() => setCourseForm(f => ({ ...f, is_assessment: false }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition ${!courseForm.is_assessment ? 'bg-white shadow text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <BookOpen className="w-4 h-4" />Course
                </button>
                <button
                  type="button"
                  onClick={() => setCourseForm(f => ({ ...f, is_assessment: true }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition ${courseForm.is_assessment ? 'bg-white shadow text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <ClipboardList className="w-4 h-4" />Assessment
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={courseForm.title}
                  onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                  placeholder={courseForm.is_assessment ? 'e.g., Safety Knowledge Assessment' : 'e.g., Excel Fundamentals'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={courseForm.description}
                  onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                  placeholder="What will learners gain from this?"
                />
              </div>

              {!courseForm.is_assessment && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(DELIVERY_META) as [string, typeof DELIVERY_META[string]][]).map(([key, meta]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCourseForm(f => ({ ...f, delivery_type: key as Course['delivery_type'] }))}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition ${courseForm.delivery_type === key ? 'border-stratefix-yellow bg-yellow-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <meta.icon className={`w-5 h-5 ${courseForm.delivery_type === key ? 'text-gray-900' : 'text-gray-400'}`} />
                        <div>
                          <p className="text-xs font-semibold text-gray-800">{meta.label}</p>
                          <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{meta.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={courseForm.category}
                    onChange={e => setCourseForm({ ...courseForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                    placeholder="e.g., Technical Skills"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={courseForm.duration_hours}
                    onChange={e => setCourseForm({ ...courseForm, duration_hours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={courseForm.status}
                  onChange={e => setCourseForm({ ...courseForm, status: e.target.value as Course['status'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {availableSkills.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Linked Skills</label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                    {availableSkills.map(skill => {
                      const checked = (courseForm.skill_ids || []).includes(skill.id);
                      return (
                        <label key={skill.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${checked ? 'bg-blue-50 border border-blue-200' : 'hover:bg-white border border-transparent'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              const ids = courseForm.skill_ids || [];
                              setCourseForm({ ...courseForm, skill_ids: e.target.checked ? [...ids, skill.id] : ids.filter(id => id !== skill.id) });
                            }}
                            className="w-3.5 h-3.5 accent-blue-600"
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

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-stratefix-yellow text-stratefix-black py-2 rounded-lg hover:bg-yellow-500 transition font-semibold text-sm">
                  {editingCourse ? 'Save Changes' : courseForm.is_assessment ? 'Create Assessment' : 'Create Course'}
                </button>
                <button type="button" onClick={() => { setShowCourseForm(false); setEditingCourse(null); }} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModuleForm && selectedCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingModule ? 'Edit Module' : 'Add Module'}</h2>
              <button onClick={() => { setShowModuleForm(false); setEditingModule(null); setUploadFile(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSaveModule} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={moduleForm.title}
                  onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={moduleForm.description}
                  onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                  <select
                    value={moduleForm.content_type}
                    onChange={e => setModuleForm({ ...moduleForm, content_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                  >
                    <option value="video">Video</option>
                    <option value="document">Document</option>
                    <option value="presentation">Presentation</option>
                    <option value="quiz">Quiz</option>
                    <option value="assignment">Assignment</option>
                    <option value="external_link">External Link</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={moduleForm.duration_minutes}
                    onChange={e => setModuleForm({ ...moduleForm, duration_minutes: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                  />
                </div>
              </div>

              {moduleForm.content_type === 'document' || moduleForm.content_type === 'presentation' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload File</label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition ${uploadFile ? 'border-stratefix-yellow bg-yellow-50' : 'border-gray-300 hover:border-gray-400'}`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    />
                    {uploadFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-4 h-4 text-stratefix-black" />
                        <span className="text-sm font-medium text-gray-800">{uploadFile.name}</span>
                        <button type="button" onClick={e => { e.stopPropagation(); setUploadFile(null); }} className="text-gray-400 hover:text-gray-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : editingModule?.content_file_name ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-blue-600">{editingModule.content_file_name}</span>
                        <span className="text-xs text-gray-400">(click to replace)</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-400 mt-0.5">PDF, PPT, DOC, XLS, Images (max 50MB)</p>
                      </>
                    )}
                  </div>
                  <div className="relative mt-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                    <div className="relative flex justify-center text-xs"><span className="px-2 bg-white text-gray-400">or link URL</span></div>
                  </div>
                  <input
                    type="url"
                    value={moduleForm.content_url}
                    onChange={e => setModuleForm({ ...moduleForm, content_url: e.target.value })}
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
              ) : moduleForm.content_type === 'quiz' ? (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  <p className="text-xs text-violet-800">Save this module first, then use the <strong>Questions</strong> button to add quiz questions.</p>
                </div>
              ) : moduleForm.content_type === 'video' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
                  <div className="relative">
                    <Play className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="url"
                      value={moduleForm.content_url}
                      onChange={e => setModuleForm({ ...moduleForm, content_url: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                      placeholder="https://youtube.com/... or video URL"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {moduleForm.content_type === 'external_link' ? 'External URL' : 'Content URL'}
                  </label>
                  <input
                    type="url"
                    value={moduleForm.content_url}
                    onChange={e => setModuleForm({ ...moduleForm, content_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={moduleForm.is_mandatory}
                  onChange={e => setModuleForm({ ...moduleForm, is_mandatory: e.target.checked })}
                  className="w-4 h-4 accent-stratefix-yellow"
                />
                <span className="text-sm font-medium text-gray-700">Mandatory module</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={uploading} className="flex-1 bg-stratefix-yellow text-stratefix-black py-2 rounded-lg hover:bg-yellow-500 transition font-semibold text-sm disabled:opacity-50">
                  {uploading ? 'Uploading...' : editingModule ? 'Save Changes' : 'Add Module'}
                </button>
                <button type="button" onClick={() => { setShowModuleForm(false); setEditingModule(null); setUploadFile(null); }} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {quizBuilderModule && (
        <QuizBuilder
          moduleId={quizBuilderModule.id}
          moduleName={quizBuilderModule.title}
          onClose={() => setQuizBuilderModule(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-2">Delete {deleteConfirm.type === 'course' ? 'Course' : 'Module'}</h2>
            <p className="text-sm text-gray-500 mb-5">
              This action cannot be undone.{deleteConfirm.type === 'course' && ' All modules and quiz questions will also be deleted.'}
            </p>
            <div className="flex gap-3">
              <button onClick={deleteConfirm.type === 'course' ? handleDeleteCourse : handleDeleteModule} className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition font-semibold text-sm">Delete</button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
