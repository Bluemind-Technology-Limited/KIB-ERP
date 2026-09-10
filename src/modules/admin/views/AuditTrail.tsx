import { useEffect, useState } from 'react';
import { BarChart3, Clock, User, ChevronDown, ChevronRight } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';

interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: { id: string; fullName: string };
  timestamp: string;
  changes?: Record<string, any>;
  reason?: string;
  referenceId?: string;
}

interface EntityTimeline {
  entityId: string;
  entityType: string;
  timeline: AuditEntry[];
  totalEvents: number;
}

interface UserActivity {
  userId: string;
  userName: string;
  actionsCount: number;
  lastAction: string;
  days: Array<{ date: string; actionCount: number; actions: string[] }>;
}

interface ApprovalMetrics {
  totalApprovals: number;
  totalRejections: number;
  averageApprovalTime: number;
  approvalRate: number;
  entityCounts: Record<string, number>;
}

interface ProductionMetrics {
  totalCompleted: number;
  averageYield: number;
  averageWaste: number;
  completionRate: number;
  averageLeadTime: number;
}

const entityTypeColors: Record<string, string> = {
  'requisition': 'bg-blue-50 text-blue-700 border-blue-200',
  'purchase-order': 'bg-purple-50 text-purple-700 border-purple-200',
  'goods-receipt': 'bg-green-50 text-green-700 border-green-200',
  'production-order': 'bg-amber-50 text-amber-700 border-amber-200',
  'bom': 'bg-pink-50 text-pink-700 border-pink-200',
};

export default function AuditTrail() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'user-activity' | 'metrics'>('metrics');
  const [entityTimelines, setEntityTimelines] = useState<EntityTimeline[]>([]);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [approvalMetrics, setApprovalMetrics] = useState<ApprovalMetrics | null>(null);
  const [productionMetrics, setProductionMetrics] = useState<ProductionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedTimeline, setSelectedTimeline] = useState<EntityTimeline | null>(null);
  const [showTimelineModal, setShowTimelineModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [systemRes, approvalRes, prodRes, userActRes] = await Promise.all([
        axiosClient.get<{ activities: EntityTimeline[] }>('/audits/system-activity?limit=100'),
        axiosClient.get<{ metrics: ApprovalMetrics }>('/audits/metrics/approval-velocity'),
        axiosClient.get<{ metrics: ProductionMetrics }>('/audits/metrics/production'),
        axiosClient.get<{ activities: Array<any> }>('/audits/user-activities?limit=50'),
      ]);
      
      setEntityTimelines(systemRes.data.activities || []);
      setApprovalMetrics(approvalRes.data.metrics);
      setProductionMetrics(prodRes.data.metrics);
      
      // Aggregate user activities
      const userMap = new Map<string, UserActivity>();
      for (const activity of userActRes.data.activities || []) {
        if (!userMap.has(activity.userId)) {
          userMap.set(activity.userId, {
            userId: activity.userId,
            userName: activity.userName,
            actionsCount: 0,
            lastAction: activity.timestamp,
            days: [],
          });
        }
        const user = userMap.get(activity.userId)!;
        user.actionsCount++;
        user.lastAction = activity.timestamp;
        
        // Group by day
        const dateStr = new Date(activity.timestamp).toISOString().split('T')[0];
        let dayEntry = user.days.find(d => d.date === dateStr);
        if (!dayEntry) {
          dayEntry = { date: dateStr, actionCount: 0, actions: [] };
          user.days.push(dayEntry);
        }
        dayEntry.actionCount++;
        dayEntry.actions.push(activity.activityType);
      }
      
      setUserActivities(Array.from(userMap.values()));
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleExpanded = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const openTimeline = (timeline: EntityTimeline) => {
    setSelectedTimeline(timeline);
    setShowTimelineModal(true);
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Audit Trail & Analytics</h2>
          <p className="text-[#737373] text-xs">System activity, user actions, approval workflows, and production metrics.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200">
        {(['timeline', 'user-activity', 'metrics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-[#AA3BFF] text-[#AA3BFF]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'timeline' && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Entity Timeline</span>}
            {tab === 'user-activity' && <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> User Activity</span>}
            {tab === 'metrics' && <span className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Metrics</span>}
          </button>
        ))}
      </div>

      {/* 3. Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border border-[#E9E9E9] rounded-xl p-4">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-80" />
                </div>
              ))}
            </div>
          ) : entityTimelines.length === 0 ? (
            <div className="bg-white border border-[#E9E9E9] rounded-xl">
              <EmptyState title="No audit entries found." hint="System activities will appear here." />
            </div>
          ) : (
            <div className="space-y-3">
              {entityTimelines.map((timeline) => {
                const isOpen = expanded[timeline.entityId];
                return (
                  <div key={timeline.entityId} className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleExpanded(timeline.entityId)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded border ${entityTypeColors[timeline.entityType] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {timeline.entityType}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{timeline.entityId.substring(0, 8)}…</p>
                          <p className="text-[10px] text-slate-400">{timeline.totalEvents} events</p>
                        </div>
                      </div>
                      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 px-4 py-4">
                        <div className="space-y-2">
                          {timeline.timeline.slice(0, 10).map((entry) => (
                            <div key={entry.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0">
                              <div className="w-2 h-2 rounded-full bg-[#AA3BFF] mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-700">{entry.action}</span>
                                  <span className="text-[9px] text-slate-400 truncate">by {entry.actor.fullName}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </p>
                                {entry.reason && (
                                  <p className="text-[9px] text-slate-400 mt-1">Reason: {entry.reason}</p>
                                )}
                              </div>
                            </div>
                          ))}
                          {timeline.totalEvents > 10 && (
                            <button
                              onClick={() => openTimeline(timeline)}
                              className="w-full text-center text-[10px] font-semibold text-[#AA3BFF] hover:underline py-2"
                            >
                              View all {timeline.totalEvents} events
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Metrics Tab */}
      {activeTab === 'metrics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Approval Metrics */}
          {approvalMetrics && (
            <div className="bg-white border border-[#E9E9E9] rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Approval Metrics</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-600">Approval Rate</span>
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-bold text-emerald-600">{(approvalMetrics?.approvalRate || 0).toFixed(1)}%</span>
                    <span className="text-[9px] text-slate-400">{approvalMetrics?.totalApprovals || 0} approved</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${approvalMetrics?.approvalRate || 0}%` }} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-600">Rejection Rate</span>
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-bold text-rose-600">{(100 - (approvalMetrics?.approvalRate || 0)).toFixed(1)}%</span>
                    <span className="text-[9px] text-slate-400">{approvalMetrics?.totalRejections || 0} rejected</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: `${100 - (approvalMetrics?.approvalRate || 0)}%` }} />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-[10px] font-semibold text-slate-600 mb-2">By Entity Type</p>
                <div className="space-y-1">
                  {approvalMetrics?.entityCounts && Object.entries(approvalMetrics.entityCounts).map(([entity, count]) => (
                    <div key={entity} className="flex justify-between text-[9px]">
                      <span className="text-slate-600 capitalize">{entity}:</span>
                      <span className="font-mono text-slate-700">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Production Metrics */}
          {productionMetrics && (
            <div className="bg-white border border-[#E9E9E9] rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Production Metrics</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-600">Completion Rate</span>
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-bold text-[#AA3BFF]">{(productionMetrics?.completionRate || 0).toFixed(1)}%</span>
                    <span className="text-[9px] text-slate-400">{productionMetrics?.totalCompleted || 0} orders</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#AA3BFF]" style={{ width: `${productionMetrics?.completionRate || 0}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 p-2.5 space-y-1">
                  <p className="text-[9px] text-slate-500">Average Yield</p>
                  <p className="text-lg font-bold text-slate-700">{(productionMetrics?.averageYield || 0).toFixed(1)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 space-y-1">
                  <p className="text-[9px] text-slate-500">Avg Waste</p>
                  <p className="text-lg font-bold text-rose-600">{(productionMetrics?.averageWaste || 0).toFixed(2)}%</p>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-2.5 space-y-1">
                <p className="text-[9px] text-slate-500">Average Lead Time</p>
                <p className="text-sm font-bold text-slate-700">{Math.round(productionMetrics?.averageLeadTime || 0)} hours</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. User Activity Tab */}
      {activeTab === 'user-activity' && (
        <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2 mb-4 pb-4 border-b border-slate-100 last:border-0">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-60" />
                </div>
              ))}
            </div>
          ) : userActivities.length === 0 ? (
            <EmptyState title="No user activities yet." hint="User actions will appear here." />
          ) : (
            <div className="divide-y divide-slate-100">
              {userActivities.map((user) => (
                <div key={user.userId} className="px-4 py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700">{user.userName}</p>
                    <span className="text-[10px] font-semibold text-slate-500">{user.actionsCount} actions</span>
                  </div>
                  <p className="text-[9px] text-slate-400">Last: {new Date(user.lastAction).toLocaleString()}</p>
                  {user.days.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {user.days.slice(-7).map((day) => (
                        <div
                          key={day.date}
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-[9px] font-semibold hover:bg-slate-50 cursor-pointer"
                          title={`${day.date}: ${day.actionCount} actions`}
                          style={{
                            backgroundColor: day.actionCount > 0 ? `rgba(170, 59, 255, ${Math.min(day.actionCount / 10, 1)})` : '#f8f8f8',
                            color: day.actionCount > 5 ? 'white' : '#666'
                          }}
                        >
                          {day.actionCount}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Timeline Modal */}
      {showTimelineModal && selectedTimeline && (
        <Modal onClose={() => setShowTimelineModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">
                Entity Timeline — {selectedTimeline.entityType}
              </h3>
              <button onClick={() => setShowTimelineModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              {selectedTimeline.timeline.map((entry, idx) => (
                <div key={entry.id} className="flex gap-3">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-[#AA3BFF] border-2 border-white" />
                    {idx < selectedTimeline.timeline.length - 1 && (
                      <div className="w-0.5 h-12 bg-slate-200 my-1" />
                    )}
                  </div>

                  {/* Event details */}
                  <div className="flex-1 pb-4 last:pb-0">
                    <div className="rounded-lg border border-slate-100 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">{entry.action}</span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600">by {entry.actor.fullName}</p>
                      {entry.reason && (
                        <p className="text-[9px] text-slate-500 bg-slate-50 px-2 py-1.5 rounded">
                          Reason: {entry.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
