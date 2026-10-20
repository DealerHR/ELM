import { useState, useEffect } from 'react';
import {
  BookOpen, Clock, AlertCircle, CheckCircle, Calendar,
  Target, Award, ExternalLink, Link2, Megaphone, Info,
  ChevronRight, GraduationCap, TrendingUp, Zap,
  ArrowRight, Play, Bell, Users, ClipboardList, UserCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useMessages } from '../../hooks/useMessages';

interface PendingAssignment {
  id: string;
  due_date: string | null;
  status: string;
  learning_courses: { title: string; duration_hours?: number } | null;
  learning_paths: { title: string } | null;
}

interface PinnedResource {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon: string;
}

interface DirectReport {
  id: string;
  full_name: string;
  department?: string;
  designation?: string;
  pendingOKR: number;
  totalLearning: number;
  completedLearning: number;
}

interface PendingOKR {
  id: string;
  employee_id: string;
  employee_name: string;
  title: string;
  period: string;
  overall_progress: number;
}

interface DashboardProps {
  onNavigate?: (view: string) => void;
  learnerMode?: boolean;
}

const iconMap: Record<string, typeof Link2> = {
  link: Link2,
  book: BookOpen,
  target: Target,
  award: Award,
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDaysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86400000);
}

export default function Dashboard({ onNavigate, learnerMode = false }: DashboardProps) {
  const { userProfile } = useAuth();
  const role = userProfile?.role;
  const isLdOrAdmin = (role === 'l_d_manager' || role === 'admin') && !learnerMode;
  const isManager = role === 'manager' && !learnerMode;

  const { messages, unreadCount, markAsRead, markAllAsRead } = useMessages();
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignment[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalAssigned, setTotalAssigned] = useState(0);
  const [pinnedResources, setPinnedResources] = useState<PinnedResource[]>([]);
  const [orgStats, setOrgStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0 });
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);
  const [pendingOKRs, setPendingOKRs] = useState<PendingOKR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, [userProfile]);

  const loadAll = async () => {
    if (!userProfile) {
      setLoading(false);
      return;
    }
    await Promise.all([
      loadLearningData(),
      loadPinnedResources(),
      isLdOrAdmin ? loadOrgStats() : Promise.resolve(),
      isManager ? loadManagerData() : Promise.resolve(),
    ]);
    setLoading(false);
  };

  const loadLearningData = async () => {
    if (!userProfile) return;
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', userProfile.id)
      .maybeSingle();
    if (!emp) return;

    const { data: all } = await supabase
      .from('employee_learning_assignments')
      .select('id, due_date, status, learning_courses(title, duration_hours), learning_paths(title)')
      .eq('employee_id', emp.id)
      .order('due_date', { ascending: true, nullsFirst: false });

    const list = (all as PendingAssignment[]) || [];
    setTotalAssigned(list.length);
    setCompletedCount(list.filter(a => a.status === 'completed').length);
    setPendingAssignments(list.filter(a => a.status !== 'completed'));
  };

  const loadPinnedResources = async () => {
    if (!userProfile?.organization_id) return;
    const { data } = await supabase
      .from('pinned_resources')
      .select('*')
      .eq('organization_id', userProfile.organization_id)
      .order('sort_order', { ascending: true });
    setPinnedResources(data || []);
  };

  const loadOrgStats = async () => {
    if (!userProfile?.organization_id) return;
    const { data: empIds } = await supabase
      .from('employees')
      .select('id')
      .eq('organization_id', userProfile.organization_id)
      .eq('status', 'active');
    if (!empIds?.length) return;

    const { data: all } = await supabase
      .from('employee_learning_assignments')
      .select('id, status, due_date')
      .in('employee_id', empIds.map((e: any) => e.id));

    const list = (all || []) as { id: string; status: string; due_date: string | null }[];
    const now = new Date();
    setOrgStats({
      total: list.length,
      completed: list.filter(a => a.status === 'completed').length,
      pending: list.filter(a => ['assigned', 'in_progress'].includes(a.status)).length,
      overdue: list.filter(a => a.due_date && new Date(a.due_date) < now && a.status !== 'completed').length,
    });
  };

  const loadManagerData = async () => {
    if (!userProfile) return;

    const { data: empData } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', userProfile.id)
      .maybeSingle();

    if (!empData) return;

    const { data: reports } = await supabase
      .from('employees')
      .select('id, user_id, departments:department_id(name), designations:designation_id(title)')
      .eq('reporting_manager_id', empData.id)
      .eq('organization_id', userProfile.organization_id!);

    if (!reports?.length) {
      setDirectReports([]);
      setPendingOKRs([]);
      return;
    }

    const reportIds = reports.map(r => r.id);
    const userIds = reports.map(r => r.user_id).filter(Boolean);

    const [profilesRes, okrRes, assignRes] = await Promise.all([
      supabase.from('user_profiles').select('id, full_name').in('id', userIds),
      supabase.from('okrs').select('id, employee_id, title, period, overall_progress').in('employee_id', reportIds).eq('status', 'submitted'),
      supabase.from('employee_learning_assignments').select('employee_id, status').in('employee_id', reportIds),
    ]);

    const profiles = profilesRes.data || [];
    const submittedOKRs = okrRes.data || [];
    const assignments = assignRes.data || [];

    const enrichedOKRs: PendingOKR[] = submittedOKRs.map(okr => {
      const rep = reports.find(r => r.id === okr.employee_id);
      const profile = profiles.find(p => p.id === rep?.user_id);
      return {
        ...okr,
        employee_name: profile?.full_name || 'Unknown',
      };
    });
    setPendingOKRs(enrichedOKRs);

    const enriched: DirectReport[] = reports.map(r => {
      const profile = profiles.find(p => p.id === r.user_id);
      const empAssigns = assignments.filter((a: any) => a.employee_id === r.id);
      const completedCount = empAssigns.filter((a: any) => a.status === 'completed').length;
      const pendingOKRCount = submittedOKRs.filter(o => o.employee_id === r.id).length;
      return {
        id: r.id,
        full_name: profile?.full_name || 'Unknown',
        department: (r.departments as any)?.name,
        designation: (r.designations as any)?.title,
        pendingOKR: pendingOKRCount,
        totalLearning: empAssigns.length,
        completedLearning: completedCount,
      };
    });

    setDirectReports(enriched);
  };

  const overallProgress = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;
  const inProgressItem = pendingAssignments.find(a => a.status === 'in_progress');
  const overdueItems = pendingAssignments.filter(a => a.due_date && new Date(a.due_date) < new Date());
  const upcomingItems = pendingAssignments.filter(a => !a.due_date || new Date(a.due_date) >= new Date());
  const unreadUrgent = messages.filter(m => !m.isRead && (m.priority === 'urgent' || m.priority === 'high'));
  const initials = userProfile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-stratefix-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isLdOrAdmin) {
    return <AdminDashboard
      orgStats={orgStats}
      messages={messages}
      unreadCount={unreadCount}
      markAsRead={markAsRead}
      pinnedResources={pinnedResources}
      userProfile={userProfile}
      onNavigate={onNavigate}
      initials={initials}
    />;
  }

  if (isManager) {
    return <ManagerDashboard
      directReports={directReports}
      pendingOKRs={pendingOKRs}
      pendingAssignments={pendingAssignments}
      completedCount={completedCount}
      totalAssigned={totalAssigned}
      overdueItems={overdueItems}
      upcomingItems={upcomingItems}
      inProgressItem={inProgressItem || null}
      messages={messages}
      unreadCount={unreadCount}
      markAsRead={markAsRead}
      markAllAsRead={markAllAsRead}
      pinnedResources={pinnedResources}
      userProfile={userProfile}
      onNavigate={onNavigate}
      initials={initials}
    />;
  }

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4">

      {unreadUrgent.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <Bell className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {unreadUrgent.length} unread {unreadUrgent[0].priority} announcement{unreadUrgent.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-700">{unreadUrgent[0].title}</p>
            </div>
          </div>
          <button
            onClick={markAllAsRead}
            className="text-xs text-amber-700 hover:text-amber-900 font-semibold px-3 py-1.5 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
          >
            Mark read
          </button>
        </div>
      )}

      <div className="bg-gradient-to-br from-stratefix-black via-gray-900 to-gray-800 rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="relative flex-shrink-0">
              {userProfile?.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt={userProfile?.full_name}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl object-cover ring-2 ring-stratefix-yellow/40"
                />
              ) : (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-stratefix-yellow/20 border-2 border-stratefix-yellow/40 flex items-center justify-center">
                  <span className="text-xl sm:text-2xl font-black text-stratefix-yellow">{initials}</span>
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-400 rounded-full border-2 border-gray-900" />
            </div>
            <div className="min-w-0">
              <p className="text-stratefix-yellow text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-0.5">
                {role?.replace(/_/g, ' ')}
              </p>
              <h1 className="text-lg sm:text-2xl font-black text-white leading-tight truncate">
                {getGreeting()}, {userProfile?.full_name?.split(' ')[0]}
              </h1>
              <p className="text-gray-400 text-[10px] sm:text-xs mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {[
              { label: 'Assigned', value: totalAssigned, icon: GraduationCap, color: 'text-stratefix-yellow' },
              { label: 'Completed', value: completedCount, icon: CheckCircle, color: 'text-emerald-400' },
              { label: 'Overdue', value: overdueItems.length, icon: AlertCircle, color: overdueItems.length > 0 ? 'text-red-400' : 'text-gray-500' },
            ].map(stat => (
              <div key={stat.label} className="text-center bg-white/10 rounded-xl px-2.5 sm:px-4 py-2 sm:py-3 flex-1 sm:flex-none sm:min-w-[72px]">
                <stat.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stat.color} mx-auto mb-0.5 sm:mb-1`} />
                <p className="text-base sm:text-xl font-black text-white">{stat.value}</p>
                <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {totalAssigned > 0 && (
          <div className="px-4 sm:px-6 pb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400">Overall Learning Progress</span>
              <span className="text-stratefix-yellow font-bold">{overallProgress}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-stratefix-yellow h-2 rounded-full transition-all duration-700 relative"
                style={{ width: `${overallProgress}%` }}
              >
                {overallProgress > 5 && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-stratefix-yellow rounded-full shadow-lg" />
                )}
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>0%</span>
              <span>{completedCount}/{totalAssigned} courses done</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">

          {inProgressItem && (
            <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl overflow-hidden shadow-lg">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-20 w-24 h-24 bg-white rounded-full translate-y-1/2" />
              </div>
              <div className="relative px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Play className="w-5 h-5 text-white fill-white" />
                  </div>
                  <div>
                    <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-0.5">Continue where you left off</p>
                    <p className="text-white font-black text-base leading-snug">
                      {inProgressItem.learning_courses?.title || inProgressItem.learning_paths?.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {inProgressItem.learning_courses?.duration_hours && (
                        <span className="text-blue-200 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {inProgressItem.learning_courses.duration_hours}h total
                        </span>
                      )}
                      {inProgressItem.due_date && (
                        <span className={`text-xs flex items-center gap-1 font-medium ${
                          new Date(inProgressItem.due_date) < new Date() ? 'text-red-300' : 'text-blue-200'
                        }`}>
                          <Calendar className="w-3 h-3" />
                          Due {new Date(inProgressItem.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate?.('my-learning')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 font-bold text-sm rounded-xl hover:bg-blue-50 transition flex-shrink-0"
                >
                  Resume
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">My Learning Queue</h2>
              </div>
              <div className="flex items-center gap-2">
                {overdueItems.length > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {overdueItems.length} overdue
                  </span>
                )}
                {pendingAssignments.length > 0 && (
                  <span className="text-xs text-gray-400">{pendingAssignments.length} pending</span>
                )}
              </div>
            </div>

            {pendingAssignments.length === 0 ? (
              <div className="py-12 text-center px-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl mx-auto mb-3 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-base font-bold text-gray-800">All caught up!</p>
                <p className="text-sm text-gray-400 mt-1">
                  {totalAssigned === 0 ? 'No learning assigned yet.' : `All ${totalAssigned} course${totalAssigned > 1 ? 's' : ''} completed.`}
                </p>
              </div>
            ) : (
              <div>
                {overdueItems.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Overdue</p>
                    </div>
                    {overdueItems.slice(0, 3).map(a => (
                      <AssignmentRow key={a.id} assignment={a} />
                    ))}
                  </div>
                )}

                {upcomingItems.length > 0 && (
                  <div>
                    {overdueItems.length > 0 && (
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Upcoming</p>
                      </div>
                    )}
                    {upcomingItems.slice(0, 5).map(a => (
                      <AssignmentRow key={a.id} assignment={a} />
                    ))}
                  </div>
                )}

                <div className="px-4 py-3 border-t border-gray-50">
                  <button
                    onClick={() => onNavigate?.('my-learning')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    View All My Learning
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate?.('skill-mapping')}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:border-blue-200 hover:shadow-md transition group"
            >
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-200 transition">
                <Target className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <p className="text-sm font-bold text-gray-900">Skill Mapping</p>
              <p className="text-xs text-gray-500 mt-0.5">See your skill assessment</p>
            </button>

            <button
              onClick={() => onNavigate?.('okrs')}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:border-amber-200 hover:shadow-md transition group"
            >
              <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-amber-200 transition">
                <Award className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <p className="text-sm font-bold text-gray-900">My OKRs</p>
              <p className="text-xs text-gray-500 mt-0.5">Track your goals</p>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Megaphone className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Announcements</h2>
              </div>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="py-10 text-center px-4">
                  <Megaphone className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 font-medium">No announcements</p>
                </div>
              ) : (
                messages.slice(0, 6).map(msg => {
                  const cfg = {
                    urgent: { color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle },
                    high: { color: 'text-amber-600', bg: 'bg-amber-100', icon: Megaphone },
                    normal: { color: 'text-blue-600', bg: 'bg-blue-100', icon: Info },
                  }[msg.priority];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => !msg.isRead && markAsRead(msg.id)}
                      className={`px-4 py-3 cursor-pointer transition-colors ${msg.isRead ? 'hover:bg-gray-50/60' : 'bg-amber-50/40 hover:bg-amber-50/70'}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-6 h-6 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <Icon className={`w-3 h-3 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <p className={`text-xs leading-snug text-gray-900 ${!msg.isRead ? 'font-bold' : 'font-semibold'}`}>
                              {msg.title}
                            </p>
                            {!msg.isRead && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{msg.body}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {messages.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-50">
                <button
                  onClick={() => onNavigate?.('messages')}
                  className="w-full text-xs text-amber-700 hover:text-amber-900 font-semibold py-1 hover:underline transition flex items-center justify-center gap-1"
                >
                  View all announcements
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Quick Links</h2>
              </div>
            </div>

            <div className="p-2.5 space-y-1 max-h-[240px] overflow-y-auto">
              {pinnedResources.length === 0 ? (
                <div className="py-6 text-center">
                  <Link2 className="w-7 h-7 text-gray-200 mx-auto mb-1.5" />
                  <p className="text-xs text-gray-400">No quick links yet</p>
                </div>
              ) : (
                pinnedResources.map(r => {
                  const Icon = iconMap[r.icon] || Link2;
                  return (
                    <a
                      key={r.id}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-100"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{r.title}</p>
                        {r.description && (
                          <p className="text-[10px] text-gray-400 truncate">{r.description}</p>
                        )}
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                    </a>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-stratefix-black to-gray-800 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-stratefix-yellow" />
              <h3 className="text-sm font-bold">Your Progress</h3>
            </div>
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-3xl font-black text-stratefix-yellow">{overallProgress}%</p>
                <p className="text-xs text-gray-400 mt-0.5">{completedCount} of {totalAssigned} completed</p>
              </div>
              {overdueItems.length > 0 && (
                <div className="flex items-center gap-1 text-red-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{overdueItems.length} overdue</span>
                </div>
              )}
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 mb-4">
              <div
                className="bg-stratefix-yellow h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <button
              onClick={() => onNavigate?.('my-learning')}
              className="w-full flex items-center justify-center gap-2 py-2 bg-stratefix-yellow text-black text-xs font-bold rounded-xl hover:bg-yellow-400 transition"
            >
              <Zap className="w-3.5 h-3.5" />
              {inProgressItem ? 'Continue Learning' : totalAssigned === 0 ? 'Explore Courses' : 'Start Learning'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignmentRow({ assignment: a }: { assignment: PendingAssignment }) {
  const isOverdue = a.due_date && new Date(a.due_date) < new Date();
  const title = a.learning_courses?.title || a.learning_paths?.title || 'Untitled';
  const daysUntil = a.due_date ? getDaysUntil(a.due_date) : null;

  const statusColor = isOverdue
    ? 'bg-red-100 text-red-600'
    : a.status === 'in_progress'
    ? 'bg-blue-100 text-blue-600'
    : 'bg-gray-100 text-gray-500';

  return (
    <div className={`px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0 ${isOverdue ? 'bg-red-50/30' : ''}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${statusColor}`}>
        {a.learning_paths
          ? <Target className="w-4 h-4" />
          : <BookOpen className="w-4 h-4" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900 truncate">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-medium capitalize ${
            isOverdue ? 'text-red-500' : a.status === 'in_progress' ? 'text-blue-600' : 'text-gray-400'
          }`}>
            {a.status.replace('_', ' ')}
          </span>
          {a.due_date && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-semibold' : daysUntil !== null && daysUntil <= 7 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
              <Calendar className="w-2.5 h-2.5" />
              {isOverdue
                ? `${Math.abs(daysUntil ?? 0)}d overdue`
                : daysUntil === 0
                ? 'Due today'
                : daysUntil === 1
                ? 'Due tomorrow'
                : `${daysUntil}d left`
              }
            </span>
          )}
        </div>
      </div>
      {a.learning_courses?.duration_hours && (
        <span className="text-[10px] text-gray-400 flex items-center gap-0.5 flex-shrink-0">
          <Clock className="w-3 h-3" />
          {a.learning_courses.duration_hours}h
        </span>
      )}
    </div>
  );
}

interface ManagerDashboardProps {
  directReports: DirectReport[];
  pendingOKRs: PendingOKR[];
  pendingAssignments: PendingAssignment[];
  completedCount: number;
  totalAssigned: number;
  overdueItems: PendingAssignment[];
  upcomingItems: PendingAssignment[];
  inProgressItem: PendingAssignment | null;
  messages: any[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  pinnedResources: PinnedResource[];
  userProfile: any;
  onNavigate?: (view: string) => void;
  initials: string;
}

function ManagerDashboard({
  directReports, pendingOKRs, pendingAssignments, completedCount, totalAssigned,
  overdueItems, upcomingItems, inProgressItem, messages, unreadCount, markAsRead,
  markAllAsRead, pinnedResources, userProfile, onNavigate, initials,
}: ManagerDashboardProps) {
  const role = userProfile?.role;
  const overallProgress = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;
  const unreadUrgent = messages.filter((m: any) => !m.isRead && (m.priority === 'urgent' || m.priority === 'high'));

  const teamTotalLearning = directReports.reduce((s, r) => s + r.totalLearning, 0);
  const teamCompletedLearning = directReports.reduce((s, r) => s + r.completedLearning, 0);
  const teamCompletionPct = teamTotalLearning > 0 ? Math.round((teamCompletedLearning / teamTotalLearning) * 100) : 0;

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4">

      {unreadUrgent.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <Bell className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {unreadUrgent.length} unread {unreadUrgent[0].priority} announcement{unreadUrgent.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-700">{unreadUrgent[0].title}</p>
            </div>
          </div>
          <button onClick={markAllAsRead} className="text-xs text-amber-700 hover:text-amber-900 font-semibold px-3 py-1.5 bg-amber-100 hover:bg-amber-200 rounded-lg transition">
            Mark read
          </button>
        </div>
      )}

      <div className="bg-gradient-to-br from-stratefix-black via-gray-900 to-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt={userProfile?.full_name} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-stratefix-yellow/40" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-stratefix-yellow/20 border-2 border-stratefix-yellow/40 flex items-center justify-center">
                  <span className="text-2xl font-black text-stratefix-yellow">{initials}</span>
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-gray-900" />
            </div>
            <div>
              <p className="text-stratefix-yellow text-xs font-semibold uppercase tracking-wider mb-0.5">{role?.replace(/_/g, ' ')}</p>
              <h1 className="text-2xl font-black text-white">
                {getGreeting()}, {userProfile?.full_name?.split(' ')[0]}
              </h1>
              <p className="text-gray-400 text-xs mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {[
              { label: 'Direct Reports', value: directReports.length, icon: Users, color: 'text-stratefix-yellow' },
              { label: 'Pending Reviews', value: pendingOKRs.length, icon: ClipboardList, color: pendingOKRs.length > 0 ? 'text-amber-400' : 'text-gray-500' },
              { label: 'Team Completion', value: `${teamCompletionPct}%`, icon: TrendingUp, color: 'text-emerald-400' },
            ].map(stat => (
              <div key={stat.label} className="text-center bg-white/10 rounded-xl px-4 py-3 min-w-[88px]">
                <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
                <p className="text-xl font-black text-white">{stat.value}</p>
                <p className="text-[10px] text-gray-400 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {teamTotalLearning > 0 && (
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400">Team Learning Completion</span>
              <span className="text-stratefix-yellow font-bold">{teamCompletionPct}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div className="bg-stratefix-yellow h-2 rounded-full transition-all duration-700" style={{ width: `${teamCompletionPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>0%</span>
              <span>{teamCompletedLearning}/{teamTotalLearning} assignments done</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">My Team</h2>
                {directReports.length > 0 && (
                  <span className="text-xs text-gray-400">{directReports.length} member{directReports.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              <button
                onClick={() => onNavigate?.('employees')}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition"
              >
                View All
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {directReports.length === 0 ? (
              <div className="py-10 text-center px-4">
                <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-500">No direct reports assigned</p>
                <p className="text-xs text-gray-400 mt-1">Employees will appear here once assigned to you</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {directReports.map(rep => {
                  const completion = rep.totalLearning > 0
                    ? Math.round((rep.completedLearning / rep.totalLearning) * 100)
                    : null;
                  const repInitials = rep.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={rep.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-black text-blue-700">{repInitials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{rep.full_name}</p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {[rep.designation, rep.department].filter(Boolean).join(' · ') || 'No role assigned'}
                        </p>
                        {rep.totalLearning > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-gray-100 rounded-full h-1">
                              <div
                                className="bg-emerald-500 h-1 rounded-full transition-all"
                                style={{ width: `${completion}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">{completion}%</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {rep.pendingOKR > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                            <ClipboardList className="w-2.5 h-2.5" />
                            {rep.pendingOKR} OKR{rep.pendingOKR > 1 ? 's' : ''}
                          </span>
                        )}
                        {rep.totalLearning === 0 && (
                          <span className="text-[10px] text-gray-400">No learning</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {pendingOKRs.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                    <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900">OKRs Awaiting Your Review</h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{pendingOKRs.length}</span>
                </div>
                <button
                  onClick={() => onNavigate?.('okrs')}
                  className="text-xs text-amber-600 hover:text-amber-800 font-semibold flex items-center gap-1 transition"
                >
                  Review
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {pendingOKRs.slice(0, 4).map(okr => (
                  <div key={okr.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Target className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{okr.title}</p>
                      <p className="text-[10px] text-gray-400">{okr.employee_name} · {okr.period}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${okr.overall_progress}%` }} />
                      </div>
                      <span className="text-[10px] font-medium text-gray-500">{okr.overall_progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
              {pendingOKRs.length > 4 && (
                <div className="px-4 py-2.5 border-t border-amber-50">
                  <button onClick={() => onNavigate?.('okrs')} className="w-full text-xs text-amber-600 hover:text-amber-800 font-semibold text-center py-1 transition">
                    View all {pendingOKRs.length} pending reviews
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">My Learning Queue</h2>
              </div>
              {overdueItems.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{overdueItems.length} overdue</span>
              )}
            </div>
            {pendingAssignments.length === 0 ? (
              <div className="py-8 text-center px-4">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-700">All caught up!</p>
                <p className="text-xs text-gray-400 mt-0.5">{totalAssigned === 0 ? 'No learning assigned yet.' : `All ${totalAssigned} courses completed.`}</p>
              </div>
            ) : (
              <div>
                {[...overdueItems.slice(0, 2), ...upcomingItems.slice(0, 3)].map(a => (
                  <AssignmentRow key={a.id} assignment={a} />
                ))}
                <div className="px-4 py-2.5 border-t border-gray-50">
                  <button
                    onClick={() => onNavigate?.('my-learning')}
                    className="w-full text-xs text-emerald-700 hover:text-emerald-900 font-semibold text-center py-1 flex items-center justify-center gap-1 transition"
                  >
                    View my learning
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Team OKRs', sub: 'Review & approve', view: 'okrs', color: 'bg-amber-50 border-amber-100 text-amber-900', icon: Target },
              { label: 'Reviews', sub: 'Performance reviews', view: 'reviews', color: 'bg-blue-50 border-blue-100 text-blue-900', icon: TrendingUp },
              { label: 'Employees', sub: 'View your team', view: 'employees', color: 'bg-gray-50 border-gray-200 text-gray-900', icon: UserCheck },
            ].map(action => (
              <button
                key={action.view}
                onClick={() => onNavigate?.(action.view)}
                className={`flex flex-col items-start px-3 py-3 rounded-xl border ${action.color} hover:opacity-90 transition group`}
              >
                <action.icon className="w-4 h-4 mb-2 opacity-70" />
                <p className="text-xs font-bold">{action.label}</p>
                <p className="text-[10px] opacity-60 mt-0.5">{action.sub}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Megaphone className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Announcements</h2>
              </div>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount} new</span>
              )}
            </div>
            <div className="divide-y divide-gray-50 max-h-[260px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="py-8 text-center px-4">
                  <Megaphone className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No announcements</p>
                </div>
              ) : (
                messages.slice(0, 5).map((msg: any) => {
                  const cfg = {
                    urgent: { color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle },
                    high: { color: 'text-amber-600', bg: 'bg-amber-100', icon: Megaphone },
                    normal: { color: 'text-blue-600', bg: 'bg-blue-100', icon: Info },
                  }[msg.priority as 'urgent' | 'high' | 'normal'];
                  const Icon = cfg.icon;
                  return (
                    <div key={msg.id} onClick={() => !msg.isRead && markAsRead(msg.id)}
                      className={`px-4 py-3 cursor-pointer transition-colors ${msg.isRead ? 'hover:bg-gray-50' : 'bg-amber-50/30 hover:bg-amber-50'}`}>
                      <div className="flex items-start gap-2.5">
                        <div className={`w-5 h-5 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <Icon className={`w-2.5 h-2.5 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug text-gray-900 ${!msg.isRead ? 'font-bold' : 'font-medium'}`}>{msg.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{msg.body}</p>
                        </div>
                        {!msg.isRead && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="px-4 py-2.5 border-t border-gray-50">
              <button onClick={() => onNavigate?.('messages')} className="w-full text-xs text-amber-700 hover:text-amber-900 font-semibold py-1 text-center flex items-center justify-center gap-1 transition">
                View all
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {pinnedResources.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900">Quick Links</h2>
                </div>
              </div>
              <div className="p-2.5 space-y-1">
                {pinnedResources.slice(0, 4).map(r => {
                  const Icon = iconMap[r.icon] || Link2;
                  return (
                    <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3 h-3 text-emerald-600" />
                      </div>
                      <p className="text-xs font-semibold text-gray-800 truncate flex-1">{r.title}</p>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-stratefix-black to-gray-800 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-stratefix-yellow" />
              <h3 className="text-sm font-bold">My Progress</h3>
            </div>
            <p className="text-3xl font-black text-stratefix-yellow">{overallProgress}%</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">{completedCount} of {totalAssigned} completed</p>
            <div className="w-full bg-white/10 rounded-full h-1.5 mb-4">
              <div className="bg-stratefix-yellow h-1.5 rounded-full transition-all duration-700" style={{ width: `${overallProgress}%` }} />
            </div>
            <button
              onClick={() => onNavigate?.('my-learning')}
              className="w-full flex items-center justify-center gap-2 py-2 bg-stratefix-yellow text-black text-xs font-bold rounded-xl hover:bg-yellow-400 transition"
            >
              <Zap className="w-3.5 h-3.5" />
              {inProgressItem ? 'Continue Learning' : 'My Learning'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AdminDashboardProps {
  orgStats: { total: number; completed: number; pending: number; overdue: number };
  messages: any[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  pinnedResources: PinnedResource[];
  userProfile: any;
  onNavigate?: (view: string) => void;
  initials: string;
}

function AdminDashboard({ orgStats, messages, unreadCount, markAsRead, pinnedResources, userProfile, onNavigate, initials }: AdminDashboardProps) {
  const role = userProfile?.role;
  const orgCompletionRate = orgStats.total > 0 ? Math.round((orgStats.completed / orgStats.total) * 100) : 0;

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4">

      <div className="bg-gradient-to-br from-stratefix-black via-gray-900 to-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt={userProfile?.full_name} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-stratefix-yellow/40" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-stratefix-yellow/20 border-2 border-stratefix-yellow/40 flex items-center justify-center">
                  <span className="text-xl font-black text-stratefix-yellow">{initials}</span>
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-gray-900" />
            </div>
            <div>
              <p className="text-stratefix-yellow text-xs font-semibold uppercase tracking-wider mb-0.5">{role?.replace(/_/g, ' ')}</p>
              <h1 className="text-xl font-black text-white">
                {getGreeting()}, {userProfile?.full_name?.split(' ')[0]}
              </h1>
              <p className="text-gray-400 text-xs mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {[
              { label: 'Total', value: orgStats.total, icon: BookOpen, color: 'text-stratefix-yellow' },
              { label: 'Completed', value: orgStats.completed, icon: CheckCircle, color: 'text-emerald-400' },
              { label: 'Overdue', value: orgStats.overdue, icon: AlertCircle, color: orgStats.overdue > 0 ? 'text-red-400' : 'text-gray-500' },
            ].map(stat => (
              <div key={stat.label} className="text-center bg-white/10 rounded-xl px-4 py-3 min-w-[72px]">
                <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
                <p className="text-xl font-black text-white">{stat.value}</p>
                <p className="text-[10px] text-gray-400 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {orgStats.total > 0 && (
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400">Org Learning Completion Rate</span>
              <span className="text-stratefix-yellow font-bold">{orgCompletionRate}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div className="bg-stratefix-yellow h-2 rounded-full transition-all duration-700" style={{ width: `${orgCompletionRate}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">Org Learning Stats</h2>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: 'Total Assignments', value: orgStats.total, color: 'bg-gray-100', text: 'text-gray-700', icon: BookOpen },
              { label: 'In Progress / Pending', value: orgStats.pending, color: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
              { label: 'Overdue', value: orgStats.overdue, color: 'bg-red-100', text: 'text-red-700', icon: AlertCircle },
              { label: 'Completed', value: orgStats.completed, color: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
            ].map(stat => {
              const Icon = stat.icon;
              const pct = orgStats.total > 0 ? Math.round((stat.value / orgStats.total) * 100) : 0;
              return (
                <div key={stat.label} className={`${stat.color} rounded-xl p-3`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${stat.text}`} />
                      <span className={`text-xs font-semibold ${stat.text}`}>{stat.label}</span>
                    </div>
                    <span className={`text-lg font-black ${stat.text}`}>{stat.value}</span>
                  </div>
                  <div className="w-full bg-white/50 rounded-full h-1">
                    <div className={`h-1 rounded-full ${stat.text.replace('text', 'bg')}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Megaphone className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">Announcements</h2>
            </div>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount} new</span>
            )}
          </div>

          <div className="divide-y divide-gray-50 max-h-[320px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="py-10 text-center px-4">
                <Megaphone className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-medium">No announcements yet</p>
              </div>
            ) : (
              messages.slice(0, 5).map(msg => {
                const cfg = {
                  urgent: { color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle },
                  high: { color: 'text-amber-600', bg: 'bg-amber-100', icon: Megaphone },
                  normal: { color: 'text-blue-600', bg: 'bg-blue-100', icon: Info },
                }[msg.priority as 'urgent' | 'high' | 'normal'];
                const Icon = cfg.icon;
                return (
                  <div
                    key={msg.id}
                    onClick={() => !msg.isRead && markAsRead(msg.id)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${msg.isRead ? 'hover:bg-gray-50' : 'bg-amber-50/30 hover:bg-amber-50/60'}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-6 h-6 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon className={`w-3 h-3 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug text-gray-900 ${!msg.isRead ? 'font-bold' : 'font-semibold'}`}>{msg.title}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{msg.body}</p>
                      </div>
                      {!msg.isRead && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-3 border-t border-gray-50">
            <button
              onClick={() => onNavigate?.('messages')}
              className="w-full flex items-center justify-center gap-2 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl transition"
            >
              <Megaphone className="w-3.5 h-3.5" />
              Compose Announcement
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Course Builder', sub: 'Create new content', view: 'course-builder', color: 'bg-blue-50 border-blue-100 text-blue-900' },
                { label: 'Assign Learning', sub: 'Assign to employees', view: 'assign-learning', color: 'bg-amber-50 border-amber-100 text-amber-900' },
                { label: 'Send Announcement', sub: 'Message your team', view: 'messages', color: 'bg-emerald-50 border-emerald-100 text-emerald-900' },
                { label: 'Quick Links', sub: 'Manage pinned resources', view: 'pinned-resources', color: 'bg-gray-50 border-gray-200 text-gray-900' },
              ].map(action => (
                <button
                  key={action.view}
                  onClick={() => onNavigate?.(action.view)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border ${action.color} hover:opacity-90 transition group`}
                >
                  <div className="text-left">
                    <p className="text-xs font-bold">{action.label}</p>
                    <p className="text-[10px] opacity-70">{action.sub}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition" />
                </button>
              ))}
            </div>
          </div>

          {pinnedResources.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900">Quick Links</h2>
                </div>
                <button onClick={() => onNavigate?.('pinned-resources')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold">Manage</button>
              </div>
              <div className="p-2.5 space-y-1">
                {pinnedResources.slice(0, 4).map(r => {
                  const Icon = iconMap[r.icon] || Link2;
                  return (
                    <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3 h-3 text-emerald-600" />
                      </div>
                      <p className="text-xs font-semibold text-gray-800 truncate flex-1">{r.title}</p>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {pinnedResources.length === 0 && (
            <button
              onClick={() => onNavigate?.('pinned-resources')}
              className="w-full bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm p-4 text-center hover:border-emerald-300 hover:bg-emerald-50/30 transition group"
            >
              <Link2 className="w-6 h-6 text-gray-300 mx-auto mb-1.5 group-hover:text-emerald-500 transition" />
              <p className="text-xs font-semibold text-gray-500 group-hover:text-emerald-700">Add Quick Links</p>
              <p className="text-[10px] text-gray-400">Pin resources for your team</p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
