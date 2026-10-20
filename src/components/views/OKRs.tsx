import { useState, useEffect } from 'react';
import {
  Plus, Target, ChevronDown, ChevronUp, Send, CheckCircle, Lock,
  MessageSquare, Edit2, Trash2, X, AlertCircle, Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface KeyResult {
  id: string;
  okr_id: string;
  title: string;
  description?: string;
  target_value: number;
  current_value: number;
  unit?: string;
  weight: number;
  progress_percentage: number;
  status: string;
}

interface ReviewComment {
  id: string;
  okr_id: string;
  reviewer_employee_id: string;
  comment: string;
  review_date: string;
  overall_rating?: number;
  created_at: string;
  reviewer_name?: string;
}

interface OKR {
  id: string;
  employee_id: string;
  employee_name?: string;
  title: string;
  description?: string;
  okr_type: string;
  period: string;
  start_date: string;
  end_date: string;
  status: string;
  overall_progress: number;
  approved_by?: string;
  approved_at?: string;
  review_locked_at?: string;
  supervisor_notes?: string;
  created_by?: string;
  key_results?: KeyResult[];
  review_comments?: ReviewComment[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Pending Review',
  approved: 'Approved',
  review_locked: 'Locked',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  review_locked: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-700',
};

const KR_STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  on_track: 'bg-green-100 text-green-700',
  at_risk: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
};

export default function OKRs() {
  const { userProfile } = useAuth();
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOKR, setExpandedOKR] = useState<string | null>(null);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOKR, setEditingOKR] = useState<OKR | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showReviewCommentForm, setShowReviewCommentForm] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState<OKR | null>(null);

  const [krForms, setKrForms] = useState<Record<string, boolean>>({});
  const [newKR, setNewKR] = useState({
    title: '', description: '', target_value: '', unit: '', weight: '100',
  });
  const [reviewCommentData, setReviewCommentData] = useState({
    comment: '', review_date: new Date().toISOString().split('T')[0], overall_rating: '',
  });
  const [approvalData, setApprovalData] = useState({ supervisor_notes: '', action: 'approve' as 'approve' | 'request_changes' });

  const [formData, setFormData] = useState({
    title: '', description: '', okr_type: 'individual', period: 'quarterly',
    start_date: '', end_date: '',
  });

  const isManager = userProfile?.role === 'manager' || userProfile?.role === 'admin';
  const isHR = userProfile?.role === 'hr' || userProfile?.role === 'platform_admin';
  const canActAsManager = isManager || userProfile?.role === 'admin';

  useEffect(() => {
    loadData();
  }, [userProfile?.id]);

  const loadData = async () => {
    if (!userProfile?.id) return;
    setLoading(true);
    try {
      const { data: empData } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userProfile.id)
        .maybeSingle();

      const empId = empData?.id || null;
      setMyEmployeeId(empId);

      let query = supabase
        .from('okrs')
        .select(`*, key_results(*), okr_review_comments(*)`)
        .order('created_at', { ascending: false });

      if (isHR) {
        const { data: orgEmployees } = await supabase
          .from('employees')
          .select('id')
          .eq('organization_id', userProfile.organization_id!);
        const empIds = (orgEmployees || []).map(e => e.id);
        if (empIds.length > 0) {
          query = query.in('employee_id', empIds);
        }
      } else if (canActAsManager && empId) {
        const { data: reports } = await supabase
          .from('employees')
          .select('id')
          .eq('reporting_manager_id', empId);
        const reportIds = (reports || []).map(r => r.id);
        const ids = empId ? [empId, ...reportIds] : reportIds;
        if (ids.length > 0) {
          query = query.in('employee_id', ids);
        }
      } else if (empId) {
        query = query.eq('employee_id', empId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const enriched = await Promise.all((data || []).map(async (okr) => {
        const { data: empProfile } = await supabase
          .from('employees')
          .select('user_id')
          .eq('id', okr.employee_id)
          .maybeSingle();

        let employeeName = '';
        if (empProfile?.user_id) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', empProfile.user_id)
            .maybeSingle();
          employeeName = profile?.full_name || '';
        }

        const enrichedComments = await Promise.all(
          (okr.okr_review_comments || []).map(async (c: ReviewComment) => {
            if (!c.reviewer_employee_id) return { ...c, reviewer_name: 'Supervisor' };
            const { data: revEmp } = await supabase
              .from('employees')
              .select('user_id')
              .eq('id', c.reviewer_employee_id)
              .maybeSingle();
            if (revEmp?.user_id) {
              const { data: revProfile } = await supabase
                .from('user_profiles')
                .select('full_name')
                .eq('id', revEmp.user_id)
                .maybeSingle();
              return { ...c, reviewer_name: revProfile?.full_name || 'Supervisor' };
            }
            return { ...c, reviewer_name: 'Supervisor' };
          })
        );

        return {
          ...okr,
          employee_name: employeeName,
          key_results: okr.key_results || [],
          review_comments: enrichedComments,
        };
      }));

      setOkrs(enriched);
    } catch (err) {
      console.error('Error loading OKRs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOKR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myEmployeeId) return;
    try {
      const { error } = await supabase.from('okrs').insert([{
        ...formData,
        employee_id: myEmployeeId,
        created_by: userProfile?.id,
        status: 'draft',
      }]);
      if (error) throw error;
      setShowCreateForm(false);
      setFormData({ title: '', description: '', okr_type: 'individual', period: 'quarterly', start_date: '', end_date: '' });
      loadData();
    } catch (err) {
      console.error('Error creating OKR:', err);
    }
  };

  const handleUpdateOKR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOKR) return;
    try {
      const { error } = await supabase.from('okrs').update({
        title: editingOKR.title,
        description: editingOKR.description,
        okr_type: editingOKR.okr_type,
        period: editingOKR.period,
        start_date: editingOKR.start_date,
        end_date: editingOKR.end_date,
      }).eq('id', editingOKR.id);
      if (error) throw error;
      setEditingOKR(null);
      loadData();
    } catch (err) {
      console.error('Error updating OKR:', err);
    }
  };

  const handleSubmitForReview = async (okrId: string) => {
    try {
      const { error } = await supabase.from('okrs').update({ status: 'submitted' }).eq('id', okrId);
      if (error) throw error;
      loadData();
    } catch (err) {
      console.error('Error submitting OKR:', err);
    }
  };

  const handleApprovalAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showApprovalModal || !myEmployeeId) return;
    try {
      if (approvalData.action === 'approve') {
        const { error } = await supabase.from('okrs').update({
          status: 'approved',
          approved_by: myEmployeeId,
          approved_at: new Date().toISOString(),
          supervisor_notes: approvalData.supervisor_notes || null,
          title: showApprovalModal.title,
          description: showApprovalModal.description,
          okr_type: showApprovalModal.okr_type,
          period: showApprovalModal.period,
          start_date: showApprovalModal.start_date,
          end_date: showApprovalModal.end_date,
        }).eq('id', showApprovalModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('okrs').update({
          status: 'draft',
          supervisor_notes: approvalData.supervisor_notes || null,
        }).eq('id', showApprovalModal.id);
        if (error) throw error;
      }
      setShowApprovalModal(null);
      setApprovalData({ supervisor_notes: '', action: 'approve' });
      loadData();
    } catch (err) {
      console.error('Error processing approval:', err);
    }
  };

  const handleLockReview = async (okrId: string) => {
    try {
      const { error } = await supabase.from('okrs').update({
        status: 'review_locked',
        review_locked_at: new Date().toISOString(),
      }).eq('id', okrId);
      if (error) throw error;
      loadData();
    } catch (err) {
      console.error('Error locking review:', err);
    }
  };

  const handleAddKeyResult = async (okrId: string) => {
    if (!newKR.title || !newKR.target_value) return;
    try {
      const { error } = await supabase.from('key_results').insert([{
        okr_id: okrId,
        title: newKR.title,
        description: newKR.description || null,
        target_value: parseFloat(newKR.target_value),
        unit: newKR.unit || null,
        weight: parseInt(newKR.weight) || 100,
      }]);
      if (error) throw error;
      setNewKR({ title: '', description: '', target_value: '', unit: '', weight: '100' });
      setKrForms(prev => ({ ...prev, [okrId]: false }));
      loadData();
    } catch (err) {
      console.error('Error adding key result:', err);
    }
  };

  const handleUpdateKRProgress = async (kr: KeyResult, newValue: number) => {
    const progress = Math.min(100, Math.round((newValue / kr.target_value) * 100));
    let status = 'on_track';
    if (progress >= 100) status = 'completed';
    else if (progress < 30) status = 'at_risk';

    try {
      const { error } = await supabase.from('key_results').update({
        current_value: newValue,
        progress_percentage: progress,
        status,
      }).eq('id', kr.id);
      if (error) throw error;

      const okr = okrs.find(o => o.id === kr.okr_id);
      if (okr) {
        const updatedKRs = (okr.key_results || []).map(k =>
          k.id === kr.id ? { ...k, current_value: newValue, progress_percentage: progress, status } : k
        );
        const totalProgress = updatedKRs.length > 0
          ? Math.round(updatedKRs.reduce((sum, k) => sum + k.progress_percentage, 0) / updatedKRs.length)
          : 0;
        await supabase.from('okrs').update({ overall_progress: totalProgress }).eq('id', okr.id);
      }
      loadData();
    } catch (err) {
      console.error('Error updating KR progress:', err);
    }
  };

  const handleDeleteKR = async (krId: string) => {
    try {
      const { error } = await supabase.from('key_results').delete().eq('id', krId);
      if (error) throw error;
      loadData();
    } catch (err) {
      console.error('Error deleting key result:', err);
    }
  };

  const handleAddReviewComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReviewCommentForm || !myEmployeeId) return;
    try {
      const { error } = await supabase.from('okr_review_comments').insert([{
        okr_id: showReviewCommentForm,
        reviewer_employee_id: myEmployeeId,
        comment: reviewCommentData.comment,
        review_date: reviewCommentData.review_date,
        overall_rating: reviewCommentData.overall_rating ? parseInt(reviewCommentData.overall_rating) : null,
      }]);
      if (error) throw error;
      setShowReviewCommentForm(null);
      setReviewCommentData({ comment: '', review_date: new Date().toISOString().split('T')[0], overall_rating: '' });
      loadData();
    } catch (err) {
      console.error('Error adding review comment:', err);
    }
  };

  const handleDeleteOKR = async (okrId: string) => {
    try {
      const { error } = await supabase.from('okrs').delete().eq('id', okrId);
      if (error) throw error;
      setShowDeleteConfirm(null);
      loadData();
    } catch (err) {
      console.error('Error deleting OKR:', err);
    }
  };

  const isMyOKR = (okr: OKR) => okr.employee_id === myEmployeeId;
  const canEditOKR = (okr: OKR) => isMyOKR(okr) && okr.status === 'draft';
  const canSubmitOKR = (okr: OKR) => isMyOKR(okr) && okr.status === 'draft';
  const canDeleteOKR = (okr: OKR) => isMyOKR(okr) && okr.status === 'draft';
  const canReviewOKR = (okr: OKR) => !isMyOKR(okr) && canActAsManager && okr.status === 'submitted';
  const canAddReviewComment = (okr: OKR) => !isMyOKR(okr) && canActAsManager && okr.status === 'approved';
  const canLockReview = (okr: OKR) => !isMyOKR(okr) && canActAsManager && okr.status === 'approved';
  const canAddKR = (okr: OKR) => isMyOKR(okr) && okr.status === 'draft';

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-gray-500">Loading OKRs...</div>
      </div>
    );
  }

  const myOKRs = okrs.filter(o => o.employee_id === myEmployeeId);
  const teamOKRs = okrs.filter(o => o.employee_id !== myEmployeeId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OKRs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Objectives & Key Results</p>
        </div>
        {!isHR && myEmployeeId && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-500 transition font-semibold text-sm"
          >
            <Plus className="w-4 h-4" />
            New OKR
          </button>
        )}
      </div>

      {canActAsManager && teamOKRs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Team OKRs</h2>
          <div className="space-y-4">
            {teamOKRs.map(okr => (
              <OKRCard
                key={okr.id}
                okr={okr}
                expanded={expandedOKR === okr.id}
                onToggleExpand={() => setExpandedOKR(expandedOKR === okr.id ? null : okr.id)}
                canEdit={false}
                canSubmit={false}
                canDelete={false}
                canReview={canReviewOKR(okr)}
                canAddReviewComment={canAddReviewComment(okr)}
                canLockReview={canLockReview(okr)}
                canAddKR={false}
                isHR={isHR}
                showEmployeeName={true}
                onEdit={() => {}}
                onSubmit={() => handleSubmitForReview(okr.id)}
                onDelete={() => {}}
                onReview={() => { setShowApprovalModal(okr); setApprovalData({ supervisor_notes: okr.supervisor_notes || '', action: 'approve' }); }}
                onAddReviewComment={() => setShowReviewCommentForm(okr.id)}
                onLockReview={() => handleLockReview(okr.id)}
                onAddKR={() => {}}
                krForms={krForms}
                setKrForms={setKrForms}
                newKR={newKR}
                setNewKR={setNewKR}
                onSaveKR={handleAddKeyResult}
                onDeleteKR={handleDeleteKR}
                onUpdateKRProgress={handleUpdateKRProgress}
              />
            ))}
          </div>
        </section>
      )}

      {isHR && okrs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">All OKRs</h2>
          <div className="space-y-4">
            {okrs.map(okr => (
              <OKRCard
                key={okr.id}
                okr={okr}
                expanded={expandedOKR === okr.id}
                onToggleExpand={() => setExpandedOKR(expandedOKR === okr.id ? null : okr.id)}
                canEdit={false}
                canSubmit={false}
                canDelete={false}
                canReview={false}
                canAddReviewComment={false}
                canLockReview={false}
                canAddKR={false}
                isHR={true}
                showEmployeeName={true}
                onEdit={() => {}}
                onSubmit={() => {}}
                onDelete={() => {}}
                onReview={() => {}}
                onAddReviewComment={() => {}}
                onLockReview={() => {}}
                onAddKR={() => {}}
                krForms={krForms}
                setKrForms={setKrForms}
                newKR={newKR}
                setNewKR={setNewKR}
                onSaveKR={handleAddKeyResult}
                onDeleteKR={() => {}}
                onUpdateKRProgress={() => {}}
              />
            ))}
          </div>
        </section>
      )}

      {!isHR && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My OKRs</h2>
          {myOKRs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <Target className="w-14 h-14 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-600 mb-1">No OKRs yet</h3>
              <p className="text-sm text-gray-400">Create your first OKR to start tracking goals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myOKRs.map(okr => (
                <OKRCard
                  key={okr.id}
                  okr={okr}
                  expanded={expandedOKR === okr.id}
                  onToggleExpand={() => setExpandedOKR(expandedOKR === okr.id ? null : okr.id)}
                  canEdit={canEditOKR(okr)}
                  canSubmit={canSubmitOKR(okr)}
                  canDelete={canDeleteOKR(okr)}
                  canReview={false}
                  canAddReviewComment={false}
                  canLockReview={false}
                  canAddKR={canAddKR(okr)}
                  isHR={false}
                  showEmployeeName={false}
                  onEdit={() => setEditingOKR(okr)}
                  onSubmit={() => handleSubmitForReview(okr.id)}
                  onDelete={() => setShowDeleteConfirm(okr.id)}
                  onReview={() => {}}
                  onAddReviewComment={() => {}}
                  onLockReview={() => {}}
                  onAddKR={() => {}}
                  krForms={krForms}
                  setKrForms={setKrForms}
                  newKR={newKR}
                  setNewKR={setNewKR}
                  onSaveKR={handleAddKeyResult}
                  onDeleteKR={handleDeleteKR}
                  onUpdateKRProgress={handleUpdateKRProgress}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {showCreateForm && (
        <Modal title="Create New OKR" onClose={() => setShowCreateForm(false)}>
          <OKRForm
            data={formData}
            onChange={setFormData}
            onSubmit={handleCreateOKR}
            onCancel={() => setShowCreateForm(false)}
            submitLabel="Create OKR"
          />
        </Modal>
      )}

      {editingOKR && (
        <Modal title="Edit OKR" onClose={() => setEditingOKR(null)}>
          <OKRForm
            data={editingOKR}
            onChange={(d) => setEditingOKR({ ...editingOKR, ...d })}
            onSubmit={handleUpdateOKR}
            onCancel={() => setEditingOKR(null)}
            submitLabel="Save Changes"
          />
        </Modal>
      )}

      {showApprovalModal && (
        <Modal title="Review OKR" onClose={() => setShowApprovalModal(null)} wide>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Objective</p>
              <p className="text-base font-semibold text-gray-900">{showApprovalModal.title}</p>
              {showApprovalModal.description && (
                <p className="text-sm text-gray-600 mt-1">{showApprovalModal.description}</p>
              )}
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span className="capitalize">{showApprovalModal.okr_type}</span>
                <span>•</span>
                <span className="capitalize">{showApprovalModal.period}</span>
                <span>•</span>
                <span>{new Date(showApprovalModal.start_date).toLocaleDateString()} – {new Date(showApprovalModal.end_date).toLocaleDateString()}</span>
              </div>
            </div>

            {(showApprovalModal.key_results || []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Key Results</p>
                <div className="space-y-2">
                  {(showApprovalModal.key_results || []).map(kr => (
                    <div key={kr.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      <span className="text-sm text-gray-700">{kr.title}</span>
                      <span className="text-xs text-gray-500">Target: {kr.target_value} {kr.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleApprovalAction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor Notes</label>
                <textarea
                  value={approvalData.supervisor_notes}
                  onChange={e => setApprovalData({ ...approvalData, supervisor_notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow"
                  placeholder="Add notes, adjustments, or feedback..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  onClick={() => setApprovalData(p => ({ ...p, action: 'approve' }))}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-semibold text-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve & Lock
                </button>
                <button
                  type="submit"
                  onClick={() => setApprovalData(p => ({ ...p, action: 'request_changes' }))}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-100 text-amber-800 py-2 rounded-lg hover:bg-amber-200 transition font-semibold text-sm"
                >
                  <AlertCircle className="w-4 h-4" />
                  Request Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(null)}
                  className="px-4 bg-gray-100 text-gray-600 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {showReviewCommentForm && (
        <Modal title="Add Review Comment" onClose={() => setShowReviewCommentForm(null)}>
          <form onSubmit={handleAddReviewComment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Review Date</label>
              <input
                type="date"
                required
                value={reviewCommentData.review_date}
                onChange={e => setReviewCommentData({ ...reviewCommentData, review_date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment *</label>
              <textarea
                required
                rows={4}
                value={reviewCommentData.comment}
                onChange={e => setReviewCommentData({ ...reviewCommentData, comment: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow"
                placeholder="Progress review, observations, guidance..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1–5, optional)</label>
              <select
                value={reviewCommentData.overall_rating}
                onChange={e => setReviewCommentData({ ...reviewCommentData, overall_rating: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow"
              >
                <option value="">No rating</option>
                <option value="1">1 – Needs Improvement</option>
                <option value="2">2 – Below Expectations</option>
                <option value="3">3 – Meets Expectations</option>
                <option value="4">4 – Exceeds Expectations</option>
                <option value="5">5 – Outstanding</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-stratefix-yellow text-stratefix-black py-2 rounded-lg hover:bg-yellow-500 transition font-semibold text-sm"
              >
                Add Comment
              </button>
              <button
                type="button"
                onClick={() => setShowReviewCommentForm(null)}
                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDeleteConfirm && (
        <Modal title="Delete OKR" onClose={() => setShowDeleteConfirm(null)}>
          <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this OKR? This cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleDeleteOKR(showDeleteConfirm)}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition text-sm font-semibold"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose, wide }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function OKRForm({
  data, onChange, onSubmit, onCancel, submitLabel,
}: {
  data: { title: string; description?: string; okr_type: string; period: string; start_date: string; end_date: string };
  onChange: (d: typeof data) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Objective *</label>
        <input
          type="text"
          required
          value={data.title}
          onChange={e => onChange({ ...data, title: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow"
          placeholder="e.g., Improve customer satisfaction score"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          rows={3}
          value={data.description || ''}
          onChange={e => onChange({ ...data, description: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow"
          placeholder="Why is this objective important?"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={data.okr_type}
            onChange={e => onChange({ ...data, okr_type: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow"
          >
            <option value="individual">Individual</option>
            <option value="team">Team</option>
            <option value="company">Company</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
          <select
            value={data.period}
            onChange={e => onChange({ ...data, period: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow"
          >
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
          <input
            type="date"
            required
            value={data.start_date}
            onChange={e => onChange({ ...data, start_date: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
          <input
            type="date"
            required
            value={data.end_date}
            onChange={e => onChange({ ...data, end_date: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-stratefix-yellow"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="flex-1 bg-stratefix-yellow text-stratefix-black py-2 rounded-lg hover:bg-yellow-500 transition font-semibold text-sm"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function OKRCard({
  okr, expanded, onToggleExpand,
  canEdit, canSubmit, canDelete, canReview, canAddReviewComment, canLockReview, canAddKR,
  isHR, showEmployeeName,
  onEdit, onSubmit, onDelete, onReview, onAddReviewComment, onLockReview,
  krForms, setKrForms, newKR, setNewKR, onSaveKR, onDeleteKR, onUpdateKRProgress,
}: {
  okr: OKR;
  expanded: boolean;
  onToggleExpand: () => void;
  canEdit: boolean;
  canSubmit: boolean;
  canDelete: boolean;
  canReview: boolean;
  canAddReviewComment: boolean;
  canLockReview: boolean;
  canAddKR: boolean;
  isHR: boolean;
  showEmployeeName: boolean;
  onEdit: () => void;
  onSubmit: () => void;
  onDelete: () => void;
  onReview: () => void;
  onAddReviewComment: () => void;
  onLockReview: () => void;
  onAddKR: () => void;
  krForms: Record<string, boolean>;
  setKrForms: (f: Record<string, boolean>) => void;
  newKR: { title: string; description: string; target_value: string; unit: string; weight: string };
  setNewKR: (v: typeof newKR) => void;
  onSaveKR: (okrId: string) => void;
  onDeleteKR: (krId: string) => void;
  onUpdateKRProgress: (kr: KeyResult, val: number) => void;
}) {
  const keyResults = okr.key_results || [];
  const reviewComments = okr.review_comments || [];
  const isLocked = okr.status === 'review_locked';
  const isApproved = okr.status === 'approved' || isLocked;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isLocked ? 'bg-blue-50' : isApproved ? 'bg-green-50' : okr.status === 'submitted' ? 'bg-amber-50' : 'bg-orange-50'
          }`}>
            {isLocked
              ? <Lock className="w-5 h-5 text-blue-500" />
              : isApproved
              ? <CheckCircle className="w-5 h-5 text-green-500" />
              : <Target className="w-5 h-5 text-orange-500" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {showEmployeeName && okr.employee_name && (
                <span className="text-xs font-medium text-gray-500">{okr.employee_name}</span>
              )}
              {showEmployeeName && okr.employee_name && <span className="text-gray-300">•</span>}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[okr.status] || 'bg-gray-100 text-gray-700'}`}>
                {STATUS_LABELS[okr.status] || okr.status}
              </span>
              <span className="text-xs text-gray-400 capitalize">{okr.okr_type}</span>
              <span className="text-gray-300">•</span>
              <span className="text-xs text-gray-400 capitalize">{okr.period}</span>
            </div>
            <h3 className="text-base font-semibold text-gray-900 leading-snug">{okr.title}</h3>
            {okr.description && (
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{okr.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(okr.start_date).toLocaleDateString()} – {new Date(okr.end_date).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {canEdit && (
              <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded-lg transition" title="Edit">
                <Edit2 className="w-4 h-4 text-gray-500" />
              </button>
            )}
            {canDelete && (
              <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg transition" title="Delete">
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            )}
            {canSubmit && (
              <button
                onClick={onSubmit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stratefix-yellow text-stratefix-black rounded-lg hover:bg-yellow-500 transition text-xs font-semibold"
                title="Submit for review"
              >
                <Send className="w-3.5 h-3.5" />
                Submit
              </button>
            )}
            {canReview && (
              <button
                onClick={onReview}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs font-semibold"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Review
              </button>
            )}
            {canAddReviewComment && (
              <button
                onClick={onAddReviewComment}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-semibold"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Add Review
              </button>
            )}
            {canLockReview && (
              <button
                onClick={onLockReview}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition text-xs font-semibold"
              >
                <Lock className="w-3.5 h-3.5" />
                Lock
              </button>
            )}
            {isHR && (
              <span className="flex items-center gap-1 text-xs text-gray-400 px-2">
                <Eye className="w-3.5 h-3.5" />
                View only
              </span>
            )}
            <button onClick={onToggleExpand} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
              {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500">Overall Progress</span>
            <span className="text-xs font-semibold text-gray-700">{okr.overall_progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                okr.overall_progress >= 70 ? 'bg-green-500' : okr.overall_progress >= 40 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${okr.overall_progress}%` }}
            />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-5 space-y-5">
          {okr.supervisor_notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Supervisor Notes</p>
              <p className="text-sm text-amber-900">{okr.supervisor_notes}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Key Results</h4>
              {canAddKR && !krForms[okr.id] && (
                <button
                  onClick={() => setKrForms({ ...krForms, [okr.id]: true })}
                  className="flex items-center gap-1 text-xs text-stratefix-black font-semibold hover:text-yellow-600 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Key Result
                </button>
              )}
            </div>

            {keyResults.length === 0 && !krForms[okr.id] && (
              <p className="text-sm text-gray-400 italic">No key results defined yet.</p>
            )}

            <div className="space-y-3">
              {keyResults.map(kr => (
                <div key={kr.id} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-800">{kr.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${KR_STATUS_COLORS[kr.status] || 'bg-gray-100 text-gray-600'}`}>
                          {kr.status.replace('_', ' ')}
                        </span>
                      </div>
                      {kr.description && (
                        <p className="text-xs text-gray-500 mb-2">{kr.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                        <span>Target: <span className="font-semibold text-gray-700">{kr.target_value} {kr.unit}</span></span>
                        <span>Current: <span className="font-semibold text-gray-700">{kr.current_value} {kr.unit}</span></span>
                        <span>Progress: <span className="font-semibold text-gray-700">{kr.progress_percentage}%</span></span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                        <div
                          className={`h-1.5 rounded-full ${kr.progress_percentage >= 100 ? 'bg-green-500' : kr.progress_percentage >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(kr.progress_percentage, 100)}%` }}
                        />
                      </div>
                      {isApproved && !isLocked && !isHR && (
                        <div className="flex items-center gap-2 mt-2">
                          <label className="text-xs text-gray-500">Update current value:</label>
                          <input
                            type="number"
                            defaultValue={kr.current_value}
                            min={0}
                            max={kr.target_value * 2}
                            className="w-24 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-stratefix-yellow"
                            onBlur={e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val !== kr.current_value) {
                                onUpdateKRProgress(kr, val);
                              }
                            }}
                          />
                          <span className="text-xs text-gray-400">{kr.unit}</span>
                        </div>
                      )}
                    </div>
                    {canAddKR && (
                      <button
                        onClick={() => onDeleteKR(kr.id)}
                        className="p-1 hover:bg-red-50 rounded transition flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {krForms[okr.id] && canAddKR && (
              <div className="bg-white border border-stratefix-yellow/50 rounded-lg p-4 mt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-700">New Key Result</p>
                <input
                  type="text"
                  placeholder="Key result title *"
                  value={newKR.title}
                  onChange={e => setNewKR({ ...newKR, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-stratefix-yellow"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="Target value *"
                    value={newKR.target_value}
                    onChange={e => setNewKR({ ...newKR, target_value: e.target.value })}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-stratefix-yellow"
                  />
                  <input
                    type="text"
                    placeholder="Unit (%, $, ...)"
                    value={newKR.unit}
                    onChange={e => setNewKR({ ...newKR, unit: e.target.value })}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-stratefix-yellow"
                  />
                  <input
                    type="number"
                    placeholder="Weight (100)"
                    value={newKR.weight}
                    onChange={e => setNewKR({ ...newKR, weight: e.target.value })}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-stratefix-yellow"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSaveKR(okr.id)}
                    className="flex-1 bg-stratefix-yellow text-stratefix-black py-1.5 rounded-lg text-xs font-semibold hover:bg-yellow-500 transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setKrForms({ ...krForms, [okr.id]: false }); setNewKR({ title: '', description: '', target_value: '', unit: '', weight: '100' }); }}
                    className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-xs hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {(reviewComments.length > 0 || canAddReviewComment) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Review Comments ({reviewComments.length})
              </h4>
              {reviewComments.length === 0 && (
                <p className="text-sm text-gray-400 italic">No review comments yet.</p>
              )}
              <div className="space-y-3">
                {reviewComments.map(comment => (
                  <div key={comment.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <MessageSquare className="w-3 h-3 text-blue-600" />
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{comment.reviewer_name}</span>
                        <span className="text-xs text-gray-400">{new Date(comment.review_date).toLocaleDateString()}</span>
                      </div>
                      {comment.overall_rating && (
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(star => (
                            <div
                              key={star}
                              className={`w-3 h-3 rounded-full ${star <= comment.overall_rating! ? 'bg-stratefix-yellow' : 'bg-gray-200'}`}
                            />
                          ))}
                          <span className="text-xs text-gray-500 ml-1">{comment.overall_rating}/5</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{comment.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLocked && (
            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              <Lock className="w-3.5 h-3.5" />
              <span>This OKR is fully locked. Locked on {new Date(okr.review_locked_at!).toLocaleDateString()}.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
