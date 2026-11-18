import { useEffect, useState, useRef } from 'react';
import { Bell, X, AlertTriangle, Boxes, ShieldCheck } from 'lucide-react';
import { axiosClient } from '../../lib/axiosClient';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt: string;
}

const typeIcon: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  EXPIRY: { icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30' },
  LOW_STOCK: { icon: Boxes, cls: 'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30' },
  APPROVAL: { icon: ShieldCheck, cls: 'text-sky-600 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-500/10 dark:border-sky-500/30' },
  SYSTEM: { icon: Bell, cls: 'text-ink-muted bg-surface-2 border-line' },
};

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load notifications
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ notifications: Notification[]; unreadCount: number }>('/notifications');
      setNotifications(res.data.notifications.slice(0, 5)); // Show only latest 5 in dropdown
      setUnreadCount(res.data.unreadCount);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // Poll notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const markRead = async (id: string) => {
    try {
      await axiosClient.post(`/notifications/${id}/read`);
      loadNotifications();
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-3 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#EA4335] rounded-full" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface rounded-xl border border-line shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <div>
              <h3 className="text-sm font-bold text-ink">Notifications</h3>
              {unreadCount > 0 && <p className="text-xs text-ink-muted">{unreadCount} unread</p>}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-ink-faint hover:text-ink transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="px-4 py-6 text-center text-xs text-ink-muted">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-ink-muted">No notifications yet</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((n) => {
                const meta = typeIcon[n.type] ?? typeIcon.SYSTEM;
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.isRead) markRead(n.id);
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors border-b border-line last:border-b-0 ${
                      n.isRead ? '' : 'bg-rose-50/30'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${meta.cls}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs ${n.isRead ? 'font-semibold text-ink-muted' : 'font-bold text-ink'}`}>
                          {n.title}
                        </p>
                        {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-[#EA4335]" />}
                      </div>
                      {n.body && <p className="text-[10px] text-ink-faint mt-0.5 line-clamp-1">{n.body}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line bg-surface-2 rounded-b-xl">
            <button
              onClick={() => {
                setIsOpen(false);
                // Navigate to notifications page
                window.location.href = '/alerts/notifications';
              }}
              className="w-full text-xs font-semibold text-[#AA3BFF] hover:text-[#8a2fc9] transition-colors"
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
