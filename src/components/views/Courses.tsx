import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Clock, Layers, Search, Monitor, Users, Briefcase, HelpCircle, Send, CheckCircle, Hourglass, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Course {
  id: string;
  title: string;
  description?: string;
  category?: string;
  type?: string;
  delivery_type?: string;
  is_assessment?: boolean;
  duration_hours?: number;
  status: string;
  module_count?: number;
}

interface AccessRequest {
  course_id: string;
  status: 'pending' | 'approved' | 'denied';
}

const DELIVERY_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  self_paced: { label: 'Self-Paced', color: 'bg-blue-100 text-blue-700', icon: Monitor },
  classroom: { label: 'Classroom', color: 'bg-teal-100 text-teal-700', icon: Users },
  on_job: { label: 'On-the-Job', color: 'bg-orange-100 text-orange-700', icon: Briefcase },
};

export default function Courses() {
  const { userProfile } = useAuth();
  const isEmployee = userProfile?.role === 'employee';

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'course' | 'assessment'>('all');
  const [accessRequests, setAccessRequests] = useState<Record<string, AccessRequest>>({});
  const [requesting, setRequesting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    if (!userProfile?.organization_id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('learning_courses')
        .select('id, title, description, category, type, delivery_type, is_assessment, duration_hours, status')
        .eq('organization_id', userProfile.organization_id)
        .eq('status', 'published');

      if (isEmployee) {
        query = query.eq('type', 'optional');
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      let filteredData = data || [];

      if (isEmployee) {
        const { data: emp } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', userProfile.id)
          .maybeSingle();

        if (emp) {
          const { data: assignments } = await supabase
            .from('employee_learning_assignments')
            .select('course_id, learning_path_id')
            .eq('employee_id', emp.id);

          const directCourseIds = new Set(
            (assignments || []).filter(a => a.course_id).map(a => a.course_id)
          );

          const pathIds = (assignments || []).filter(a => a.learning_path_id).map(a => a.learning_path_id!);
          if (pathIds.length > 0) {
            const { data: pathItems } = await supabase
              .from('learning_path_items')
              .select('course_id')
              .in('path_id', pathIds);
            (pathItems || []).forEach(pi => directCourseIds.add(pi.course_id));
          }

          filteredData = filteredData.filter(c => !directCourseIds.has(c.id));
        }

        const { data: reqs } = await supabase
          .from('course_access_requests')
          .select('course_id, status')
          .eq('employee_id', userProfile.id);

        const reqMap: Record<string, AccessRequest> = {};
        (reqs || []).forEach(r => { reqMap[r.course_id] = r; });
        setAccessRequests(reqMap);
      }

      const coursesWithModules = await Promise.all(
        filteredData.map(async (course) => {
          const { count } = await supabase
            .from('learning_modules')
            .select('id', { count: 'exact', head: true })
            .eq('course_id', course.id);
          return { ...course, module_count: count ?? 0 };
        })
      );

      setCourses(coursesWithModules);
    } catch (err) {
      console.error('Error loading courses:', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.organization_id, userProfile?.id, isEmployee]);

  useEffect(() => { load(); }, [load]);

  const handleRequestAccess = async (course: Course) => {
    if (!userProfile) return;
    setRequesting(course.id);
    try {
      const existing = accessRequests[course.id];
      if (existing && existing.status === 'denied') {
        const { error } = await supabase
          .from('course_access_requests')
          .update({ status: 'pending', reviewed_by: null, reviewed_at: null, denial_reason: null, requested_at: new Date().toISOString() })
          .eq('employee_id', userProfile.id)
          .eq('course_id', course.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('course_access_requests')
          .insert({
            organization_id: userProfile.organization_id,
            employee_id: userProfile.id,
            course_id: course.id,
            status: 'pending',
          });
        if (error) throw error;
      }

      setAccessRequests(prev => ({ ...prev, [course.id]: { course_id: course.id, status: 'pending' } }));
      showToast('Access request sent to your L&D manager');
    } catch (err) {
      console.error('Error requesting access:', err);
      showToast('Failed to send request. Please try again.');
    } finally {
      setRequesting(null);
    }
  };

  const filtered = courses.filter(c => {
    const matchesSearch = !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.category || '').toLowerCase().includes(search.toLowerCase());
    const matchesDelivery = deliveryFilter === 'all' || c.delivery_type === deliveryFilter;
    const matchesType = typeFilter === 'all' || (typeFilter === 'assessment' ? !!c.is_assessment : !c.is_assessment);
    return matchesSearch && matchesDelivery && matchesType;
  });

  const requestButton = (course: Course) => {
    if (!isEmployee) return null;
    const req = accessRequests[course.id];

    if (!req) {
      return (
        <button
          onClick={() => handleRequestAccess(course)}
          disabled={requesting === course.id}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-60"
        >
          <Send className="w-3 h-3" />
          {requesting === course.id ? 'Sending…' : 'Request Access'}
        </button>
      );
    }

    if (req.status === 'pending') {
      return (
        <span className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium rounded-lg">
          <Hourglass className="w-3 h-3" />
          Request Pending
        </span>
      );
    }

    if (req.status === 'approved') {
      return (
        <span className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium rounded-lg">
          <CheckCircle className="w-3 h-3" />
          Approved
        </span>
      );
    }

    if (req.status === 'denied') {
      return (
        <button
          onClick={() => handleRequestAccess(course)}
          disabled={requesting === course.id}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 text-xs font-medium rounded-lg transition group disabled:opacity-60"
        >
          <XCircle className="w-3 h-3 text-red-400 group-hover:text-white" />
          {requesting === course.id ? 'Sending…' : 'Re-request Access'}
        </button>
      );
    }

    return null;
  };

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="p-4 lg:p-6">
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      <div className="mb-6">
        {/* page name is in the header */}
        <p className="text-sm text-gray-500 mt-1">
          {isEmployee
            ? 'Browse optional courses and request access from your L&D manager'
            : 'Browse available learning courses and assessments'}
        </p>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
          />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {(['all', 'course', 'assessment'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition capitalize ${typeFilter === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
            </button>
          ))}
        </div>
        <select
          value={deliveryFilter}
          onChange={(e) => setDeliveryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
        >
          <option value="all">All Delivery Types</option>
          <option value="self_paced">Self-Paced</option>
          <option value="classroom">Classroom</option>
          <option value="on_job">On-the-Job</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-600 mb-1">
            {courses.length === 0
              ? isEmployee ? 'No optional courses available' : 'No published courses yet'
              : 'No courses match your search'}
          </h3>
          <p className="text-sm text-gray-400">
            {courses.length === 0
              ? isEmployee
                ? 'Your L&D team will add optional courses here'
                : 'Courses will appear here once published by your L&D team'
              : 'Try adjusting your search or filter'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(course => {
            const dm = course.delivery_type ? DELIVERY_META[course.delivery_type] : null;
            return (
              <div
                key={course.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition flex flex-col"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${course.is_assessment ? 'bg-amber-50' : 'bg-blue-50'}`}>
                    {course.is_assessment
                      ? <HelpCircle className="w-5 h-5 text-amber-600" />
                      : <BookOpen className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm leading-snug">{course.title}</h3>
                    {course.category && (
                      <p className="text-xs text-gray-400 mt-0.5">{course.category}</p>
                    )}
                  </div>
                </div>

                {course.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2 flex-1">{course.description}</p>
                )}

                <div className="flex items-center gap-2 flex-wrap mt-auto pt-3 border-t border-gray-50">
                  {course.is_assessment ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                      <HelpCircle className="w-3 h-3" />Assessment
                    </span>
                  ) : dm ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${dm.color}`}>
                      <dm.icon className="w-3 h-3" />{dm.label}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {course.duration_hours && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {course.duration_hours}h
                      </span>
                    )}
                    {!course.is_assessment && (
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {course.module_count} {course.module_count === 1 ? 'module' : 'modules'}
                      </span>
                    )}
                  </div>
                  {requestButton(course)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
