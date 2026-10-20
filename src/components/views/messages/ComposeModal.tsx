import { useState, useRef, useEffect } from 'react';
import { X, Send, Megaphone, Users, Search, Check, ChevronDown } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface OrgUser {
  id: string;
  full_name: string;
  role: string;
}

interface ComposeModalProps {
  onClose: () => void;
  onSent: () => void;
}

const priorityOptions = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function ComposeModal({ onClose, onSent }: ComposeModalProps) {
  const { userProfile } = useAuth();
  const [type, setType] = useState<'public' | 'targeted'>('public');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [showFor, setShowFor] = useState<string>('');
  const [selectedRecipients, setSelectedRecipients] = useState<OrgUser[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (type === 'targeted') loadOrgUsers();
  }, [type]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadOrgUsers = async () => {
    if (!userProfile?.organization_id) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, role')
      .eq('organization_id', userProfile.organization_id)
      .neq('id', userProfile.id)
      .order('full_name');
    setOrgUsers((data || []) as OrgUser[]);
  };

  const toggleRecipient = (user: OrgUser) => {
    setSelectedRecipients(prev =>
      prev.find(r => r.id === user.id)
        ? prev.filter(r => r.id !== user.id)
        : [...prev, user]
    );
  };

  const removeRecipient = (id: string) => {
    setSelectedRecipients(prev => prev.filter(r => r.id !== id));
  };

  const filteredUsers = orgUsers.filter(u =>
    u.full_name.toLowerCase().includes(userSearch.toLowerCase()) &&
    !selectedRecipients.find(r => r.id === u.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (type === 'targeted' && selectedRecipients.length === 0) {
      setError('Please select at least one recipient.');
      return;
    }
    if (!userProfile?.organization_id) return;
    setSaving(true);
    try {
      let expiresAt: string | null = null;
      if (showFor) {
        const days = parseInt(showFor, 10);
        const d = new Date();
        d.setDate(d.getDate() + days);
        expiresAt = d.toISOString();
      }
      const { data: msg, error: insertErr } = await supabase
        .from('org_messages')
        .insert({
          organization_id: userProfile.organization_id,
          sender_id: userProfile.id,
          title: title.trim(),
          body: body.trim(),
          priority,
          message_type: type,
          expires_at: expiresAt,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      if (type === 'targeted' && msg) {
        const { error: recipErr } = await supabase
          .from('message_recipients')
          .insert(selectedRecipients.map(r => ({ message_id: msg.id, recipient_id: r.id })));
        if (recipErr) throw recipErr;
      }

      onSent();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (role: string) => role.replace(/_/g, ' ');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">New Message</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Message Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('public')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${
                  type === 'public'
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Megaphone className="w-4 h-4 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold">Public</p>
                  <p className="text-[10px] font-normal opacity-70">All employees</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType('targeted')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${
                  type === 'targeted'
                    ? 'border-blue-400 bg-blue-50 text-blue-800'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold">Targeted</p>
                  <p className="text-[10px] font-normal opacity-70">Select recipients</p>
                </div>
              </button>
            </div>
          </div>

          {type === 'targeted' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Recipients <span className="text-red-500">*</span>
              </label>

              {selectedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedRecipients.map(r => (
                    <span key={r.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg">
                      {r.full_name}
                      <button type="button" onClick={() => removeRecipient(r.id)} className="ml-0.5 hover:text-blue-600">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative" ref={dropdownRef}>
                <div
                  className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 transition"
                  onClick={() => setShowUserDropdown(v => !v)}
                >
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search and add people..."
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setShowUserDropdown(true); }}
                    className="flex-1 text-sm outline-none bg-transparent"
                    onClick={e => { e.stopPropagation(); setShowUserDropdown(true); }}
                  />
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </div>

                {showUserDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-44 overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400 text-center">
                        {userSearch ? 'No users found' : 'All users selected'}
                      </p>
                    ) : (
                      filteredUsers.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => { toggleRecipient(user); setUserSearch(''); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition"
                        >
                          <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-gray-600">
                              {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{user.full_name}</p>
                            <p className="text-xs text-gray-400 capitalize">{roleLabel(user.role)}</p>
                          </div>
                          {selectedRecipients.find(r => r.id === user.id) && (
                            <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              placeholder={type === 'public' ? 'e.g. System Maintenance Notice' : 'e.g. Follow-up on your training'}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Message <span className="text-red-500">*</span></label>
            <textarea
              required
              rows={4}
              placeholder="Type your message here..."
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent outline-none"
              >
                {priorityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Show For</label>
              <select
                value={showFor}
                onChange={e => setShowFor(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-stratefix-yellow focus:border-transparent outline-none"
              >
                <option value="">No expiry</option>
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="15">15 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 font-medium">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-stratefix-black text-stratefix-yellow rounded-xl hover:bg-gray-900 transition font-semibold text-sm disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              {saving ? 'Sending...' : type === 'public' ? 'Send Announcement' : 'Send Message'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-semibold text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
