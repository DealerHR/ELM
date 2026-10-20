import { useState, useEffect, useCallback } from 'react';
import { Award, CheckCircle2, Clock, User, X, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface PendingAssignment {
  id: string;
  assigned_date: string;
  due_date: string | null;
  status: string;
  employee_id: string;
  course_id: string;
  employees: {
    id: string;
    first_name: string;
    last_name: string;
    designation?: string;
  } | null;
  learning_courses: {
    id: string;
    title: string;
    delivery_type: string;
  } | null;
  ld_certifications: { id: string; certified_at: string; notes: string | null; session_date: string | null } | null;
}

interface CertifyForm {
  session_date: string;
  notes: string;
}

interface LDCertificationsProps {
  organizationId: string;
}

export default function LDCertifications({ organizationId }: LDCertificationsProps) {
  const { userProfile } = useAuth();
  const [assignments, setAssignments] = useState<PendingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [certifying, setCertifying] = useState<string | null>(null);
  const [certifyModal, setCertifyModal] = useState<PendingAssignment | null>(null);
  const [certifyForm, setCertifyForm] = useState<CertifyForm>({ session_date: '', notes: '' });
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'pending' | 'certified' | 'all'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('employee_learning_assignments')
        .select(`
          id, assigned_date, due_date, status, employee_id, course_id,
          employees(id, first_name, last_name, designation),
          learning_courses!inner(id, title, delivery_type),
          ld_certifications(id, certified_at, notes, session_date)
        `)
        .eq('learning_courses.delivery_type', 'classroom')
        .or('learning_courses.delivery_type.eq.on_job')
        .not('course_id', 'is', null)
        .order('assigned_date', { ascending: false });

      if (err) throw err;

      const filtered = (data || []).filter((a: any) =>
        a.learning_courses?.delivery_type === 'classroom' || a.learning_courses?.delivery_type === 'on_job'
      );
      setAssignments(filtered as unknown as PendingAssignment[]);
    } catch {
      setError('Failed to load assignments.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const openCertify = (a: PendingAssignment) => {
    setCertifyModal(a);
    setCertifyForm({ session_date: new Date().toISOString().split('T')[0], notes: '' });
  };

  const handleCertify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certifyModal || !userProfile) return;
    setCertifying(certifyModal.id);
    setError('');
    try {
      const { error: certErr } = await supabase.from('ld_certifications').insert({
        assignment_id: certifyModal.id,
        course_id: certifyModal.course_id,
        employee_id: certifyModal.employee_id,
        certified_by: userProfile.id,
        session_date: certifyForm.session_date || null,
        notes: certifyForm.notes || null,
        certified_at: new Date().toISOString(),
      });
      if (certErr) throw certErr;

      const { data: prog } = await supabase
        .from('learning_progress')
        .select('id')
        .eq('assignment_id', certifyModal.id)
        .eq('employee_id', certifyModal.employee_id)
        .maybeSingle();

      if (prog) {
        await supabase.from('learning_progress').update({
          status: 'completed',
          progress_percentage: 100,
          completed_at: new Date().toISOString(),
        }).eq('id', prog.id);
      } else {
        await supabase.from('learning_progress').insert({
          assignment_id: certifyModal.id,
          employee_id: certifyModal.employee_id,
          course_id: certifyModal.course_id,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          progress_percentage: 100,
          status: 'completed',
          attempts: 1,
        });
      }

      await supabase.from('employee_learning_assignments').update({ status: 'completed' }).eq('id', certifyModal.id);

      setCertifyModal(null);
      load();
    } catch (e: any) {
      setError('Failed to certify: ' + e.message);
    } finally {
      setCertifying(null);
    }
  };

  const pendingList = assignments.filter(a => !a.ld_certifications);
  const certifiedList = assignments.filter(a => !!a.ld_certifications);
  const displayList = filter === 'pending' ? pendingList : filter === 'certified' ? certifiedList : assignments;

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">L&D Certifications</h3>
            <p className="text-xs text-gray-500 mt-0.5">Certify completed classroom and on-job training sessions</p>
          </div>
          <button onClick={load} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex gap-2">
          {(['pending', 'certified', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === f ? 'bg-stratefix-yellow text-stratefix-black' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f === 'pending' && <Clock className="w-3 h-3" />}
              {f === 'certified' && <CheckCircle2 className="w-3 h-3" />}
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pending' && pendingList.length > 0 && (
                <span className="bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">{pendingList.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-16">
            <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600 mb-1">
              {filter === 'pending' ? 'No pending certifications' : filter === 'certified' ? 'No certified sessions' : 'No classroom or on-job courses assigned'}
            </p>
            <p className="text-xs text-gray-400">
              {filter === 'pending' ? 'All sessions have been certified or no classroom/on-job courses are assigned.' : 'Certifications will appear here once sessions are completed.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayList.map(a => {
              const certified = !!a.ld_certifications;
              const employee = a.employees;
              const course = a.learning_courses;
              const isOverdue = a.due_date && new Date(a.due_date) < new Date() && !certified;
              return (
                <div key={a.id} className={`border rounded-xl p-4 transition ${certified ? 'border-emerald-200 bg-emerald-50/50' : isOverdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${certified ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                      {certified ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" /> : <User className="w-4.5 h-4.5 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-gray-900">
                          {employee ? `${employee.first_name} ${employee.last_name}` : 'Employee'}
                        </p>
                        {employee?.designation && (
                          <span className="text-xs text-gray-400 truncate">{employee.designation}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-1">{course?.title || 'Course'}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className={`px-1.5 py-0.5 rounded font-medium capitalize ${course?.delivery_type === 'classroom' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {course?.delivery_type?.replace('_', '-') || 'Training'}
                        </span>
                        {a.due_date && (
                          <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                            Due {new Date(a.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {certified && a.ld_certifications?.certified_at && (
                          <span className="text-emerald-600 font-medium">
                            Certified {new Date(a.ld_certifications.certified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {certified && a.ld_certifications?.session_date && (
                          <span>Session: {new Date(a.ld_certifications.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        )}
                      </div>
                      {certified && a.ld_certifications?.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic">"{a.ld_certifications.notes}"</p>
                      )}
                    </div>
                    {!certified && (
                      <button
                        onClick={() => openCertify(a)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
                      >
                        <Award className="w-3.5 h-3.5" /> Certify
                      </button>
                    )}
                    {certified && (
                      <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Certified
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {certifyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Certify Completion</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {certifyModal.employees?.first_name} {certifyModal.employees?.last_name} · {certifyModal.learning_courses?.title}
                </p>
              </div>
              <button onClick={() => setCertifyModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCertify} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Session Date</label>
                <input
                  type="date"
                  value={certifyForm.session_date}
                  onChange={e => setCertifyForm(f => ({ ...f, session_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
                <textarea
                  rows={3}
                  value={certifyForm.notes}
                  onChange={e => setCertifyForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Session notes, observations..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stratefix-yellow focus:outline-none resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={!!certifying} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition disabled:opacity-50">
                  {certifying ? 'Certifying...' : 'Mark as Completed'}
                </button>
                <button type="button" onClick={() => setCertifyModal(null)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-200 transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
