import { useEffect, useState } from 'react';
import { Bell, RefreshCw, CheckCheck, AlertTriangle, Boxes, ShieldCheck } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt: string;
}

const typeIcon: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  EXPIRY: { icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50 border-amber-200' },
  LOW_STOCK: { icon: Boxes, cls: 'text-rose-600 bg-rose-50 border-rose-200' },
  APPROVAL: { icon: ShieldCheck, cls: 'text-sky-600 bg-sky-50 border-sky-200' },
  SYSTEM: { icon: Bell, cls: 'text-slate-600 bg-slate-50 border-slate-200' },
};

export default function Notifications({ searchQuery = '' }: { searchQuery?: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ notifications: Notification[]; unreadCount: number }>('/notifications');
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load notifications. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await axiosClient.post<{ created: number }>('/notifications/generate');
      setError(res.data.created > 0 ? '' : 'No new alerts — all caught up.');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to generate alerts');
    } finally {
      setGenerating(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await axiosClient.post(`/notifications/${id}/read`);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update notification');
    }
  };

  const markAllRead = async () => {
    try {
      await axiosClient.post('/notifications/read-all');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update notifications');
    }
  };

  const filtered = notifications.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.body ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Notifications</h2>
          <p className="text-[#737373] text-xs">Expiry, low-stock and pending-approval alerts for your workspace.</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50">
              <span className="flex items-center gap-1.5">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </span>
            </button>
          )}
          <button onClick={generate} disabled={generating} className="btn-3d px-4 h-9">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
              <RefreshCw className="w-3.5 h-3.5" /> {generating ? 'Scanning…' : 'Check for alerts'}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Summary chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-[#E9E9E9] rounded-xl px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unread</p>
          <p className="text-xl font-bold text-[#171717]">{unreadCount}</p>
        </div>
        <div className="bg-white border border-[#E9E9E9] rounded-xl px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p>
          <p className="text-xl font-bold text-[#171717]">{notifications.length}</p>
        </div>
        <div className="bg-white border border-[#E9E9E9] rounded-xl px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Alerts</p>
          <p className="text-xl font-bold text-[#171717]">{notifications.filter((n) => n.type !== 'SYSTEM').length}</p>
        </div>
      </div>

      {/* 3. Notification List */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="w-1.5 h-1.5 rounded-full" />
                  </div>
                  <Skeleton className="h-2 w-72" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-3.5 w-14 rounded" />
                  <Skeleton className="h-2 w-10" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No notifications." hint='Hit "Check for alerts" to scan for expiry, low stock and pending approvals.' />
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((n) => {
              const meta = typeIcon[n.type] ?? typeIcon.SYSTEM;
              const Icon = meta.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50/60 transition-colors ${n.isRead ? '' : 'bg-rose-50/30'}`}
                >
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${meta.cls}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs ${n.isRead ? 'font-semibold text-slate-500' : 'font-bold text-[#171717]'}`}>{n.title}</p>
                      {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-[#EA4335]" />}
                    </div>
                    {n.body && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1.5 py-0.5 rounded border border-slate-200">
                      {n.type}
                    </span>
                    <span className="text-[9px] text-slate-300">{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
