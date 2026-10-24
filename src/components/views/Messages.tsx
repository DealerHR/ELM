import { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, AlertCircle, Info, Clock, CheckCircle, Users, ArrowRight, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ComposeModal from './messages/ComposeModal';

interface Recipient {
  recipient_id: string;
  recipient: { full_name: string } | null;
}

interface Message {
  id: string;
  title: string;
  body: string;
  priority: 'normal' | 'high' | 'urgent';
  message_type: 'public' | 'targeted';
  expires_at: string | null;
  created_at: string;
  sender_id: string;
  sender: { full_name: string } | null;
  message_recipients?: Recipient[];
}

const priorityConfig = {
  normal: { label: 'Normal', icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  high: { label: 'High', icon: Megaphone, color: 'text-amber-600', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
  urgent: { label: 'Urgent', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isExpired(expires_at: string | null) {
  return expires_at ? new Date(expires_at) < new Date() : false;
}

function MessageCard({
  msg,
  currentUserId,
  canManage,
  onDelete,
}: {
  msg: Message;
  currentUserId: string;
  canManage: boolean;
  onDelete: (id: string) => void;
}) {
  const cfg = priorityConfig[msg.priority];
  const Icon = cfg.icon;
  const expired = isExpired(msg.expires_at);
  const isSender = msg.sender_id === currentUserId;
  const isAnnouncement = msg.message_type === 'public';
  const recipients = msg.message_recipients || [];

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition ${expired ? 'opacity-55 border-gray-100' : 'border-gray-100 hover:shadow-md'}`}>
      <div className={`h-0.5 w-full ${isAnnouncement ? 'bg-amber-400' : 'bg-blue-400'}`} />
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <Icon className={`w-4 h-4 ${cfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-gray-900">{msg.title}</h3>
                {isAnnouncement ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                    <Megaphone className="w-2.5 h-2.5" />
                    Announcement
                  </span>
                ) : (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${isSender ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    <Users className="w-2.5 h-2.5" />
                    {isSender ? 'Sent' : 'Direct Message'}
                  </span>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                {expired && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Expired</span>}
              </div>

              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{msg.body}</p>

              {msg.message_type === 'targeted' && recipients.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {isSender ? (
                    <>
                      <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      {recipients.slice(0, 5).map(r => (
                        <span key={r.recipient_id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                          <User className="w-2.5 h-2.5" />
                          {r.recipient?.full_name || 'Unknown'}
                        </span>
                      ))}
                      {recipients.length > 5 && (
                        <span className="text-xs text-gray-400">+{recipients.length - 5} more</span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 font-medium">Sent to you</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(msg.created_at)}
                </span>
                {msg.sender?.full_name && (
                  <span>by {msg.sender.full_name}</span>
                )}
                {msg.expires_at && (
                  <span className={expired ? 'text-red-400' : ''}>
                    Expires {new Date(msg.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {(canManage || isSender) && (
            <button
              onClick={() => onDelete(msg.id)}
              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  const { userProfile } = useAuth();
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [filter, setFilter] = useState<'all' | 'announcements' | 'messages'>('all');

  const canManage = userProfile?.role === 'admin' || userProfile?.role === 'l_d_manager';

  useEffect(() => {
    loadMessages();
  }, [userProfile]);

  const loadMessages = async () => {
    if (!userProfile?.organization_id) return;
    setLoading(true);
    const [annResult, dmResult] = await Promise.all([
      supabase
        .from('org_messages')
        .select('*, sender:sender_id(full_name)')
        .eq('organization_id', userProfile.organization_id)
        .eq('message_type', 'public')
        .order('created_at', { ascending: false }),
      supabase
        .from('org_messages')
        .select('*, sender:sender_id(full_name), message_recipients(recipient_id, recipient:recipient_id(full_name))')
        .eq('organization_id', userProfile.organization_id)
        .eq('message_type', 'targeted')
        .order('created_at', { ascending: false }),
    ]);
    const combined = [
      ...(annResult.data || []),
      ...(dmResult.data || []),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setAllMessages(combined as Message[]);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('org_messages').delete().eq('id', id);
    setDeleteId(null);
    loadMessages();
  };

  const handleSent = () => {
    setShowCompose(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    loadMessages();
  };

  const announcementCount = allMessages.filter(m => m.message_type === 'public').length;
  const messageCount = allMessages.filter(m => m.message_type === 'targeted').length;

  const filteredList = allMessages.filter(m => {
    if (filter === 'announcements') return m.message_type === 'public';
    if (filter === 'messages') return m.message_type === 'targeted';
    return true;
  });

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          {/* page name is in the header */}
          <p className="text-sm text-gray-500 mt-0.5">Announcements and direct messages within your organization</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-2 bg-stratefix-black text-stratefix-yellow rounded-xl hover:bg-gray-900 transition font-semibold text-sm"
          >
            <Plus className="w-4 h-4" />
            Compose
          </button>
        )}
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <p className="text-sm text-emerald-700 font-medium">Message sent successfully!</p>
        </div>
      )}

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
            filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All
          {allMessages.length > 0 && (
            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">{allMessages.length}</span>
          )}
        </button>
        <button
          onClick={() => setFilter('announcements')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
            filter === 'announcements' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Announcements
          {announcementCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{announcementCount}</span>
          )}
        </button>
        <button
          onClick={() => setFilter('messages')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
            filter === 'messages' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Direct Messages
          {messageCount > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{messageCount}</span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-stratefix-yellow border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <Megaphone className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-700 mb-1">
            {filter === 'all' ? 'No communications yet' : filter === 'announcements' ? 'No announcements yet' : 'No direct messages yet'}
          </h3>
          <p className="text-sm text-gray-400">
            {canManage ? 'Click "Compose" to send a message or announcement.' : 'Nothing here yet from your organization.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map(msg => (
            <MessageCard
              key={msg.id}
              msg={msg}
              currentUserId={userProfile?.id || ''}
              canManage={canManage}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      {showCompose && (
        <ComposeModal onClose={() => setShowCompose(false)} onSent={handleSent} />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm">
            <h2 className="text-base font-bold text-gray-900 mb-2">Delete Message?</h2>
            <p className="text-sm text-gray-500 mb-4">This will permanently remove the message for all recipients.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold transition">Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-semibold transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
