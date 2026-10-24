import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck, AlertCircle, Info, Megaphone } from 'lucide-react';
import { useMessages } from '../../hooks/useMessages';

export default function NotificationBell() {
  const { messages, unreadCount, markAsRead, markAllAsRead } = useMessages();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const priorityConfig = {
    urgent: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-500' },
    high: { icon: Megaphone, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-500' },
    normal: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-500' },
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-500">{unreadCount} unread</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {messages.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400 font-medium">No notifications</p>
                <p className="text-xs text-gray-300 mt-1">You're all caught up!</p>
              </div>
            ) : (
              messages.map(msg => {
                const cfg = priorityConfig[msg.priority];
                const Icon = cfg.icon;
                return (
                  <div
                    key={msg.id}
                    onClick={() => !msg.isRead && markAsRead(msg.id)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      msg.isRead ? 'hover:bg-gray-50' : 'bg-blue-50/40 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-semibold text-gray-900 leading-snug ${!msg.isRead ? 'font-bold' : ''}`}>
                            {msg.title}
                          </p>
                          {!msg.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">{msg.body}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                          {msg.priority !== 'normal' && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium text-white ${cfg.badge}`}>
                              {msg.priority}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
