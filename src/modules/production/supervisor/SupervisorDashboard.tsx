import { useEffect, useState } from 'react';
import { BarChart3, Zap } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import ProductionPlanDashboard from './ProductionPlanDashboard';
import { formatNumber } from '../../../lib/format';

interface DashboardData {
  totalPlans: number;
  activePlans: number;
  completedToday: number;
  pendingReconciliations: number;
  allocationMetrics: {
    scheduled: number;
    inProgress: number;
    completed: number;
  };
  reconciliationMetrics: {
    verified: number;
    flagged: number;
    pending: number;
  };
}

export default function SupervisorDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const res = await axiosClient.get('/supervisor/dashboard');
        setDashboardData(res.data);
      } catch (err: any) {
        // Log error but don't store
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
    // Reload every 30 seconds
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Production Supervisor</h1>
        <p className="text-sm text-ink-muted mt-2">
          Manage batch allocations, track machine schedules, and reconcile daily production
        </p>
      </div>

      {/* Key Metrics */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-line rounded-xl p-4">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-line rounded-xl p-4">
            <p className="text-[9px] font-semibold text-ink-muted mb-2">Total Plans</p>
            <p className="text-2xl font-bold text-ink-2">{formatNumber(dashboardData?.totalPlans || 0)}</p>
          </div>
          <div className="bg-surface border border-line rounded-xl p-4">
            <p className="text-[9px] font-semibold text-ink-muted mb-2">Active</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-300">{formatNumber(dashboardData?.activePlans || 0)}</p>
          </div>
          <div className="bg-surface border border-line rounded-xl p-4">
            <p className="text-[9px] font-semibold text-ink-muted mb-2">Completed Today</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-300">{formatNumber(dashboardData?.completedToday || 0)}</p>
          </div>
          <div className="bg-surface border border-line rounded-xl p-4">
            <p className="text-[9px] font-semibold text-ink-muted mb-2">Pending Reconcile</p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-300">{formatNumber(dashboardData?.pendingReconciliations || 0)}</p>
          </div>
        </div>
      )}

      {/* Allocation & Reconciliation Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocations */}
        <div className="bg-surface border border-line rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-[#AA3BFF]" />
            <h3 className="text-sm font-bold text-ink-2">Batch Allocations</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/30">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Scheduled</span>
              <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                {formatNumber(dashboardData?.allocationMetrics?.scheduled || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/30">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">In Progress</span>
              <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
                {formatNumber(dashboardData?.allocationMetrics?.inProgress || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100 dark:bg-green-500/10 dark:border-green-500/30">
              <span className="text-xs font-semibold text-green-700 dark:text-green-300">Completed</span>
              <span className="text-lg font-bold text-green-700 dark:text-green-300">
                {formatNumber(dashboardData?.allocationMetrics?.completed || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Reconciliations */}
        <div className="bg-surface border border-line rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-[#AA3BFF]" />
            <h3 className="text-sm font-bold text-ink-2">Reconciliations</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/30">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Pending</span>
              <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
                {formatNumber(dashboardData?.reconciliationMetrics?.pending || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100 dark:bg-green-500/10 dark:border-green-500/30">
              <span className="text-xs font-semibold text-green-700 dark:text-green-300">Verified</span>
              <span className="text-lg font-bold text-green-700 dark:text-green-300">
                {formatNumber(dashboardData?.reconciliationMetrics?.verified || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/30">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">Flagged</span>
              <span className="text-lg font-bold text-rose-700 dark:text-rose-300">
                {formatNumber(dashboardData?.reconciliationMetrics?.flagged || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Production Plans */}
      <ProductionPlanDashboard />
    </div>
  );
}
