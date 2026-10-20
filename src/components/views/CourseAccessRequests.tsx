import { useState, useEffect, useCallback } from 'react';
import { BookOpen, CheckCircle, XCircle, Clock, User, Calendar, MessageSquare, Inbox } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface AccessRequest {
  id: string;
  employee_id: string;
  course_id: string;
  status: 'pending' | 'approved' | 'denied';
  requested_at: string;
  reviewed_at: string | null;
  denial_reason: string | null;
  employee: { full_name: string } | null;
  course: { title: string; category: string | null; type: string | null } | null;
  reviewer: { full_name: string } | null;
}

type Tab = 'pending' | 'approved' | 'denied';

export default function CourseAccessRequests() {
  const { userProfile } = useAuth();

  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [acting, setActing] = useState<string | null>(null);
  const [denyModal, setDenyModal] = useState<{ request: AccessRequest } | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    if (!userProfile?.organization_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('course_access_requests')
        .select(`
          id, employee_id, course_id, status, requested_at, reviewed_at, denial_reason,
          employee:user_profiles!employee_id(full_name),
          course:learning_courses!course_id(title, category, type),
          reviewer:user_profiles!reviewed_by(full_name)
        `)
        .eq('organization_id', userProfile.organization_id)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setRequests((data as unknown as AccessRequest[]) || []);
    } catch (err) {
      console.error('Error loading access requests:', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.organization_id]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (req: AccessRequest) => {
    setActing(req.id);
    try {
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', req.employee_id)
        .maybeSingle();

      if (!emp) throw new Error('Employee record not found');

      const { error: assignErr } = await supabase
        .from('employee_learning_assignments')
        .insert({
          employee_id: emp.id,
          course_id: req.course_id,
          assigned_by: userProfile!.id,
          assigned_date: new Date().toISOString().slice(0, 10),
          status: 'assigned',
        });

      if (assignErr) throw assignErr;

      const { error: updateErr } = await supabase
        .from('course_access_requests')
        .update({ status: 'approved', reviewed_by: userProfile!.id, reviewed_at: new Date().toISOString() })
        .eq('id', req.id);

      if (updateErr) throw updateErr;

      setRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'approved', reviewed_at: new Date().toISOString() } : r
      ));
      showToast(`Access approved — ${req.employee?.full_name} has been enrolled in "${req.course?.title}"`);
    } catch (err) {
      console.error('Error approving request:', err);
      showToast('Failed to approve request. Please try again.');
    } finally {
      setActing(null);
    }
  };

  const handleDenySubmit = async () => {
    if (!denyModal) return;
    const req = denyModal.request;
    setActing(req.id);
    try {
      const { error: updateErr } = await supabase
        .from('course_access_requests')
        .update({
          status: 'denied',
          reviewed_by: userProfile!.id,
          reviewed_at: new Date().toISOString(),
          denial_reason: denyReason.trim() || null,
        })
        .eq('id', req.id);

      if (updateErr) throw updateErr;

      const messageBody = denyReason.trim()
        ? `Your request to access the course "${req.course?.title}" has been reviewed and unfortunately could not be approved at this time.\n\nReason: ${denyReason.trim()}\n\nPlease reach out to your L&D manager if you have any questions.`
        : `Your request to access the course "${req.course?.title}" has been reviewed and unfortunately could not be approved at this time.\n\nPlease reach out to your L&D manager if you have any questions.`;

      const { data: msgData, error: msgErr } = await supabase
        .from('org_messages')
        .insert({
          organization_id: userProfile!.organization_id,
          title: `Course Access Update: ${req.course?.title}`,
          body: messageBody,
          sender_id: userProfile!.id,
          priority: 'normal',
          message_type: 'targeted',
        })
        .select('id')
        .single();

      if (msgErr) throw msgErr;

      await supabase
        .from('message_recipients')
        .insert({ message_id: msgData.id, recipient_id: req.employee_id });

      setRequests(prev => prev.map(r =>
        r.id === req.id
          ? { ...r, status: 'denied', reviewed_at: new Date().toISOString(), denial_reason: denyReason.trim() || null }
          : r
      ));
      setDenyModal(null);
      setDenyReason('');
      showToast(`Request denied — ${req.employee?.full_name} has been notified via message`);
    } catch (err) {
      console.error('Error denying request:', err);
      showToast('Failed to deny request. Please try again.');
    } finally {
      setActing(null);
    }
  };

  const pending = requests.filter(r => r.status === 'pending');
  const approved = requests.filter(r => r.status === 'approved');
  const denied = requests.filter(r => r.status === 'denied');

  const tabCounts: Record<Tab, number> = { pending: pending.length, approved: approved.length, denied: denied.length };
  const shown = tab === 'pending' ? pending : tab === 'approved' ? approved : denied;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="p-8">
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Course Access Requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and action employee requests to access optional courses
        </p>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-6">
        {(['pending', 'approved', 'denied'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-xs font-medium transition capitalize flex items-center gap-2 ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
            {tabCounts[t] > 0 && (
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold ${
                t === 'pending' ? 'bg-amber-500 text-white' :
                t === 'approved' ? 'bg-emerald-500 text-white' :
                'bg-red-400 text-white'
              }`}>
                {tabCounts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Inbox className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-500">
            {tab === 'pending' ? 'No pending requests' : tab === 'approved' ? 'No approved requests yet' : 'No denied requests'}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {tab === 'pending' ? 'Employee access requests will appear here' : 'Reviewed requests will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(req => (
            <div
              key={req.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {req.course?.title ?? 'Unknown Course'}
                    </h3>
                    {req.course?.category && (
                      <p className="text-xs text-gray-400">{req.course.category}</p>
                    )}
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {req.employee?.full_name ?? 'Unknown Employee'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Requested {formatDate(req.requested_at)}
                  </span>
                  {req.reviewed_at && (
                    <span className="flex items-center gap-1 text-gray-400">
                      <Clock className="w-3 h-3" />
                      Reviewed {formatDate(req.reviewed_at)}
                    </span>
                  )}
                </div>

                {req.denial_reason && (
                  <div className="mt-2 flex items-start gap-1.5 bg-red-50 rounded-lg px-3 py-2 text-xs text-red-700">
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{req.denial_reason}</span>
                  </div>
                )}
              </div>

              {req.status === 'pending' && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(req)}
                    disabled={acting === req.id}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-60"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => { setDenyModal({ request: req }); setDenyReason(''); }}
                    disabled={acting === req.id}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium rounded-lg transition disabled:opacity-60"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Deny
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {denyModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Deny Access Request</h2>
            <p className="text-sm text-gray-500 mb-4">
              You are denying <strong>{denyModal.request.employee?.full_name}</strong>'s request for{' '}
              <strong>"{denyModal.request.course?.title}"</strong>.
              The employee will receive a personal message informing them.
            </p>

            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Reason (optional — shown to employee)
            </label>
            <textarea
              value={denyReason}
              onChange={e => setDenyReason(e.target.value)}
              rows={3}
              placeholder="e.g. This course is not relevant to your current role..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-300 focus:outline-none resize-none"
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setDenyModal(null); setDenyReason(''); }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDenySubmit}
                disabled={acting === denyModal.request.id}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60"
              >
                {acting === denyModal.request.id ? 'Processing…' : 'Deny & Notify Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex-shrink-0">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 flex-shrink-0">
        <CheckCircle className="w-3 h-3" /> Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex-shrink-0">
      <XCircle className="w-3 h-3" /> Denied
    </span>
  );
}
