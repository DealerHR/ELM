import { useState, useEffect } from 'react';
import { Plus, Users, Mail, Phone, Building, Briefcase, CreditCard as Edit2, Trash2, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Employee {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  employee_id?: string;
  department_id?: string;
  designation_id?: string;
  reporting_manager_id?: string;
  employment_status: string;
  departments?: { name: string };
  designations?: { title: string };
}

interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  title: string;
}

interface EmployeeOption {
  employee_id: string;
  full_name: string;
}

export default function Employees() {
  const { userProfile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingManagerId, setEditingManagerId] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<'all' | 'my-team'>('all');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'employee',
    department_id: '',
    designation_id: '',
    employment_status: 'active',
    reporting_manager_employee_id: '',
  });

  useEffect(() => {
    if (userProfile?.organization_id) {
      loadData();
    }
  }, [userProfile?.organization_id]);

  const loadData = async () => {
    try {
      if (userProfile?.role === 'manager') {
        const { data: myEmp } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', userProfile.id)
          .maybeSingle();
        setMyEmployeeId(myEmp?.id || null);
      }

      const [profilesRes, empRes, departmentsRes, designationsRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, full_name, email, phone, role, is_active')
          .eq('organization_id', userProfile?.organization_id)
          .order('full_name', { ascending: true }),
        supabase
          .from('employees')
          .select(`
            id,
            user_id,
            department_id,
            designation_id,
            reporting_manager_id,
            status,
            departments:department_id(name),
            designations:designation_id(title)
          `)
          .eq('organization_id', userProfile?.organization_id),
        supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', userProfile?.organization_id),
        supabase
          .from('designations')
          .select('id, title')
          .eq('organization_id', userProfile?.organization_id),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (designationsRes.error) throw designationsRes.error;

      const empRecords = empRes.data || [];

      const enriched: Employee[] = (profilesRes.data || []).map(profile => {
        const rec = empRecords.find(r => r.user_id === profile.id);
        return {
          ...profile,
          employee_id: rec?.id,
          department_id: rec?.department_id,
          designation_id: rec?.designation_id,
          reporting_manager_id: rec?.reporting_manager_id,
          employment_status: rec?.status || 'active',
          departments: rec?.departments as { name: string } | undefined,
          designations: rec?.designations as { title: string } | undefined,
        };
      });

      setEmployees(enriched);
      setDepartments(departmentsRes.data || []);
      setDesignations(designationsRes.data || []);

      const opts: EmployeeOption[] = enriched
        .filter(e => e.employee_id)
        .map(e => ({ employee_id: e.employee_id!, full_name: e.full_name }));
      setEmployeeOptions(opts);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/create-org-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          organization_id: userProfile?.organization_id,
          full_name: formData.full_name,
          email: formData.email,
          password: 'ChangeMe123!',
          phone: formData.phone || null,
          role: formData.role,
          department_id: formData.department_id || null,
          designation_id: formData.designation_id || null,
          employment_status: formData.employment_status,
          reporting_manager_id: formData.reporting_manager_employee_id || null,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        alert(result.error || 'Error creating employee. Please try again.');
        return;
      }

      setShowForm(false);
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        role: 'employee',
        department_id: '',
        designation_id: '',
        employment_status: 'active',
        reporting_manager_employee_id: '',
      });
      loadData();
    } catch (error) {
      console.error('Error creating employee:', error);
      alert('Error creating employee. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      on_leave: 'bg-yellow-100 text-yellow-800',
      notice_period: 'bg-orange-100 text-orange-800',
      inactive: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      hr: 'bg-blue-100 text-blue-800',
      l_d_manager: 'bg-teal-100 text-teal-800',
      manager: 'bg-green-100 text-green-800',
      employee: 'bg-gray-100 text-gray-800',
    };
    return badges[role] || 'bg-gray-100 text-gray-800';
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditingManagerId(employee.reporting_manager_id || '');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          full_name: editingEmployee.full_name,
          phone: editingEmployee.phone,
          role: editingEmployee.role,
        })
        .eq('id', editingEmployee.id);

      if (profileError) throw profileError;

      if (editingEmployee.employee_id) {
        const { error: empError } = await supabase
          .from('employees')
          .update({
            department_id: editingEmployee.department_id || null,
            designation_id: editingEmployee.designation_id || null,
            status: editingEmployee.employment_status,
            reporting_manager_id: editingManagerId || null,
          })
          .eq('id', editingEmployee.employee_id);

        if (empError) throw empError;
      }

      setEditingEmployee(null);
      setEditingManagerId('');
      loadData();
    } catch (error) {
      console.error('Error updating employee:', error);
      alert('Error updating employee. Please try again.');
    }
  };

  const handleDelete = async (profileId: string) => {
    try {
      const emp = employees.find(e => e.id === profileId);
      if (emp?.employee_id) {
        await supabase
          .from('employees')
          .update({ status: 'inactive' })
          .eq('id', emp.employee_id);
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', profileId);

      if (error) throw error;

      setShowDeleteConfirm(null);
      loadData();
    } catch (error) {
      console.error('Error deactivating employee:', error);
      alert('Error deactivating employee. Please try again.');
    }
  };

  const isManager = userProfile?.role === 'manager';
  const displayedEmployees = (isManager && teamFilter === 'my-team' && myEmployeeId)
    ? employees.filter(e => e.reporting_manager_id === myEmployeeId)
    : employees;

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Employees</h1>
          <p className="text-sm text-gray-600">
            {isManager && teamFilter === 'my-team'
              ? `${displayedEmployees.length} direct report${displayedEmployees.length !== 1 ? 's' : ''}`
              : 'Manage your workforce'}
          </p>
        </div>
        {(userProfile?.role === 'admin' || userProfile?.role === 'hr') && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950 text-white text-sm rounded-lg hover:bg-blue-900 transition"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        )}
      </div>

      {isManager && (
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
          <button
            onClick={() => setTeamFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              teamFilter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            All Employees
          </button>
          <button
            onClick={() => setTeamFilter('my-team')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
              teamFilter === 'my-team'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            My Team
            {myEmployeeId && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                teamFilter === 'my-team' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {employees.filter(e => e.reporting_manager_id === myEmployeeId).length}
              </span>
            )}
          </button>
        </div>
      )}

      {editingEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold mb-3">Edit Employee</h2>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.full_name}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, full_name: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    disabled
                    value={editingEmployee.email}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editingEmployee.phone || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={editingEmployee.role}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editingEmployee.employment_status}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, employment_status: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="notice_period">Notice Period</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={editingEmployee.department_id || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, department_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  >
                    <option value="">Select department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Designation</label>
                  <select
                    value={editingEmployee.designation_id || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, designation_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  >
                    <option value="">Select designation</option>
                    {designations.map(desig => (
                      <option key={desig.id} value={desig.id}>{desig.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reporting Manager</label>
                <select
                  value={editingManagerId}
                  onChange={(e) => setEditingManagerId(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                >
                  <option value="">No reporting manager</option>
                  {employeeOptions
                    .filter(opt => opt.employee_id !== editingEmployee.employee_id)
                    .map(opt => (
                      <option key={opt.employee_id} value={opt.employee_id}>{opt.full_name}</option>
                    ))}
                </select>
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
                  onClick={() => { setEditingEmployee(null); setEditingManagerId(''); }}
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
            <h2 className="text-base font-bold mb-2">Deactivate Employee</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to deactivate this employee? They will lose access to the system.
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

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold mb-3">Add New Employee</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.employment_status}
                    onChange={(e) => setFormData({ ...formData, employment_status: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="notice_period">Notice Period</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  >
                    <option value="">Select department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Designation</label>
                  <select
                    value={formData.designation_id}
                    onChange={(e) => setFormData({ ...formData, designation_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                  >
                    <option value="">Select designation</option>
                    {designations.map(desig => (
                      <option key={desig.id} value={desig.id}>{desig.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reporting Manager</label>
                <select
                  value={formData.reporting_manager_employee_id}
                  onChange={(e) => setFormData({ ...formData, reporting_manager_employee_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
                >
                  <option value="">No reporting manager</option>
                  {employeeOptions.map(opt => (
                    <option key={opt.employee_id} value={opt.employee_id}>{opt.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-900">
                  <strong>Note:</strong> A temporary password 'ChangeMe123!' will be set. Employee should change it on first login.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-950 text-white py-1.5 text-sm rounded-lg hover:bg-blue-900 transition"
                >
                  Create Employee
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-1.5 text-sm rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Designation</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reporting Manager</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              {(userProfile?.role === 'admin' || userProfile?.role === 'hr') && (
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displayedEmployees.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-950" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{employee.full_name}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Mail className="w-3 h-3" />
                      {employee.email}
                    </div>
                    {employee.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Phone className="w-3 h-3" />
                        {employee.phone}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(employee.role)}`}>
                    {employee.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    {employee.departments?.name ? (
                      <>
                        <Building className="w-3 h-3" />
                        {employee.departments.name}
                      </>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    {employee.designations?.title ? (
                      <>
                        <Briefcase className="w-3 h-3" />
                        {employee.designations.title}
                      </>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    {employee.reporting_manager_id ? (
                      <>
                        <UserCheck className="w-3 h-3" />
                        {employeeOptions.find(o => o.employee_id === employee.reporting_manager_id)?.full_name || '-'}
                      </>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(employee.employment_status)}`}>
                    {employee.employment_status.replace('_', ' ')}
                  </span>
                </td>
                {(userProfile?.role === 'admin' || userProfile?.role === 'hr') && (
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(employee)}
                        className="p-1.5 hover:bg-blue-50 rounded transition"
                        title="Edit employee"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(employee.id)}
                        className="p-1.5 hover:bg-red-50 rounded transition"
                        title="Deactivate employee"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {displayedEmployees.length === 0 && (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          {isManager && teamFilter === 'my-team' ? (
            <>
              <h3 className="text-base font-medium text-gray-900 mb-1">No direct reports yet</h3>
              <p className="text-sm text-gray-600">Employees assigned to you will appear here</p>
            </>
          ) : (
            <>
              <h3 className="text-base font-medium text-gray-900 mb-1">No employees yet</h3>
              <p className="text-sm text-gray-600">Add your first employee to get started</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
