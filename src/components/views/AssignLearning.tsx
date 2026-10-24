import { useState, useEffect } from 'react';
import {
  Plus, X, BookOpen, Layers, Users, Calendar, CheckCircle,
  Search, ChevronDown, Trash2, AlertCircle, RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Employee {
  id: string;
  full_name: string;
  designation?: string;
  user_profiles?: { full_name: string };
  designations?: { title: string };
}

interface Course {
  id: string;
  title: string;
  category?: string;
  type: string;
  duration_hours?: number;
}

interface LearningPath {
  id: string;
  title: string;
  description?: string;
  path_type: string;
}

interface Assignment {
  id: string;
  employee_id: string;
  course_id: string | null;
  learning_path_id: string | null;
  assigned_date: string;
  due_date: string | null;
  status: string;
  employees: { full_name: string; designation?: string } | null;
  learning_courses: { title: string } | null;
  learning_paths: { title: string } | null;
}

const TYPE_COLORS: Record<string, string> = {
  mandatory_company: 'bg-red-100 text-red-700',
  mandatory_skill: 'bg-orange-100 text-orange-700',
  role_specific: 'bg-blue-100 text-blue-700',
  optional: 'bg-green-100 text-green-700',
};

const STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function AssignLearning() {
  const { userProfile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [assignType, setAssignType] = useState<'course' | 'path'>('course');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedContentId, setSelectedContentId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.organization_id) {
      loadData();
    }
  }, [userProfile?.organization_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assignmentsRes, employeesRes, coursesRes, pathsRes] = await Promise.all([
        supabase
          .from('employee_learning_assignments')
          .select(`
            id, employee_id, course_id, learning_path_id, assigned_date, due_date, status,
            employees(full_name, designation),
            learning_courses(title),
            learning_paths(title)
          `)
          .order('assigned_date', { ascending: false }),

        supabase
          .from('employees')
          .select('id, user_profiles(full_name), designations(title)')
          .eq('organization_id', userProfile!.organization_id)
          .eq('status', 'active')
          .order('id'),

        supabase
          .from('learning_courses')
          .select('id, title, category, type, duration_hours')
          .eq('organization_id', userProfile!.organization_id)
          .eq('status', 'published')
          .order('title'),

        supabase
          .from('learning_paths')
          .select('id, title, description, path_type')
          .eq('organization_id', userProfile!.organization_id)
          .eq('is_active', true)
          .order('title'),
      ]);

      setAssignments((assignmentsRes.data as Assignment[]) || []);
      const normalizedEmployees: Employee[] = ((employeesRes.data as any[]) || []).map(e => ({
        id: e.id,
        full_name: (e.user_profiles as any)?.full_name || '',
        designation: (e.designations as any)?.title || '',
      })).filter(e => e.full_name);
      setEmployees(normalizedEmployees);
      setCourses((coursesRes.data as Course[]) || []);
      setPaths((pathsRes.data as LearningPath[]) || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContentId || selectedEmployeeIds.length === 0) {
      setError('Please select at least one employee and a course or path.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const rows = selectedEmployeeIds.map(empId => ({
        employee_id: empId,
        course_id: assignType === 'course' ? selectedContentId : null,
        learning_path_id: assignType === 'path' ? selectedContentId : null,
        assigned_by: userProfile!.id,
        assigned_date: new Date().toISOString(),
        due_date: dueDate || null,
        status: 'assigned',
      }));

      const { error: insertError } = await supabase
        .from('employee_learning_assignments')
        .insert(rows);

      if (insertError) throw insertError;

      setShowForm(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to assign learning');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('employee_learning_assignments')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setDeleteConfirm(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete assignment');
    }
  };

  const resetForm = () => {
    setAssignType('course');
    setSelectedEmployeeIds([]);
    setSelectedContentId('');
    setDueDate('');
    setEmployeeSearch('');
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const filteredEmployeesDropdown = employees.filter(e =>
    e.full_name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    (e.designation || '').toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const filteredAssignments = assignments.filter(a => {
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    const matchEmployee = !filterEmployee ||
      (a.employees?.full_name || '').toLowerCase().includes(filterEmployee.toLowerCase());
    return matchStatus && matchEmployee;
  });

  const pendingCount = assignments.filter(a => a.status === 'assigned' || a.status === 'in_progress').length;
  const overdueCount = assignments.filter(a =>
    a.due_date && new Date(a.due_date) < new Date() && a.status !== 'completed'
  ).length;
  const completedCount = assignments.filter(a => a.status === 'completed').length;

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          {/* page name is in the header */}
          <p className="text-sm text-gray-500 mt-1">Assign courses and learning paths to employees with deadlines</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-500 transition font-semibold text-sm"
        >
          <Plus className="w-4 h-4" />
          New Assignment
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pending / In Progress', value: pendingCount, color: 'bg-blue-50 text-blue-800 border-blue-100' },
          { label: 'Overdue', value: overdueCount, color: 'bg-red-50 text-red-800 border-red-100' },
          { label: 'Completed', value: completedCount, color: 'bg-emerald-50 text-emerald-800 border-emerald-100' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm font-medium mt-0.5 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by employee..."
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none w-48"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Content</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Deadline</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredAssignments.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                  No assignments found
                </td>
              </tr>
            )}
            {filteredAssignments.map(a => {
              const isOverdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== 'completed';
              const contentTitle = a.learning_courses?.title || a.learning_paths?.title || '—';
              const isPath = !!a.learning_path_id;
              return (
                <tr key={a.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-gray-900">{a.employees?.full_name || '—'}</p>
                    {a.employees?.designation && <p className="text-xs text-gray-400">{a.employees.designation}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {isPath
                        ? <Layers className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        : <BookOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      }
                      <span className="text-gray-800 truncate max-w-48">{contentTitle}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${isPath ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {isPath ? 'Learning Path' : 'Course'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(a.assigned_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3">
                    {a.due_date ? (
                      <span className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        <Calendar className="w-3 h-3" />
                        {new Date(a.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {isOverdue && ' (Overdue)'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No deadline</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {a.status !== 'completed' && (
                      <button
                        onClick={() => setDeleteConfirm(a.id)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded transition"
                        title="Remove assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">New Assignment</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAssign} className="p-6 space-y-5">

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Content Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setAssignType('course'); setSelectedContentId(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${
                      assignType === 'course' ? 'border-stratefix-yellow bg-yellow-50 text-stratefix-black' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    Individual Course
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAssignType('path'); setSelectedContentId(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${
                      assignType === 'path' ? 'border-stratefix-yellow bg-yellow-50 text-stratefix-black' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Learning Path
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {assignType === 'course' ? 'Select Course' : 'Select Learning Path'} *
                </label>
                {assignType === 'course' ? (
                  <select
                    required
                    value={selectedContentId}
                    onChange={(e) => setSelectedContentId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                  >
                    <option value="">— Choose a course —</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title}{c.category ? ` · ${c.category}` : ''}{c.duration_hours ? ` (${c.duration_hours}h)` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    required
                    value={selectedContentId}
                    onChange={(e) => setSelectedContentId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                  >
                    <option value="">— Choose a learning path —</option>
                    {paths.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.path_type.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Assign To * ({selectedEmployeeIds.length} selected)
                </label>
                <div className="relative">
                  <div
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer flex items-center justify-between hover:border-gray-400 transition"
                    onClick={() => setShowEmployeeDropdown(v => !v)}
                  >
                    <span className={selectedEmployeeIds.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
                      {selectedEmployeeIds.length === 0
                        ? 'Search and select employees...'
                        : `${selectedEmployeeIds.length} employee${selectedEmployeeIds.length > 1 ? 's' : ''} selected`}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                  {showEmployeeDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <div className="p-2 border-b border-gray-100">
                        <input
                          type="text"
                          placeholder="Search employees..."
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-stratefix-yellow"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredEmployeesDropdown.length === 0 && (
                          <p className="text-sm text-gray-400 text-center py-4">No employees found</p>
                        )}
                        {filteredEmployeesDropdown.map(emp => (
                          <label key={emp.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedEmployeeIds.includes(emp.id)}
                              onChange={() => toggleEmployee(emp.id)}
                              className="w-4 h-4 accent-stratefix-yellow"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{emp.full_name}</p>
                              {emp.designation && <p className="text-xs text-gray-400">{emp.designation}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="p-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setShowEmployeeDropdown(false)}
                          className="w-full py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded transition"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {selectedEmployeeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedEmployeeIds.map(id => {
                      const emp = employees.find(e => e.id === id);
                      return (
                        <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-stratefix-black rounded text-xs font-medium">
                          {emp?.full_name}
                          <button type="button" onClick={() => toggleEmployee(id)}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Completion Deadline
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Leave blank for no deadline</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving || selectedEmployeeIds.length === 0 || !selectedContentId}
                  className="flex-1 flex items-center justify-center gap-2 bg-stratefix-yellow text-stratefix-black py-2.5 rounded-lg hover:bg-yellow-500 transition font-semibold text-sm disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Assign to {selectedEmployeeIds.length || '...'} Employee{selectedEmployeeIds.length !== 1 ? 's' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-2">Remove Assignment</h2>
            <p className="text-sm text-gray-500 mb-5">This will remove the learning assignment. Any progress made will be preserved.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition font-semibold text-sm"
              >
                Remove
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
