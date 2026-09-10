import { useEffect, useState } from 'react';
import { BarChart3, Zap } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import ProductionPlanDashboard from './ProductionPlanDashboard';

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
        const res = await axiosClient.get('/api/supervisor/dashboard');
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
        <h1 className="text-2xl font-bold tracking-tight text-[#171717]">Production Supervisor</h1>
        <p className="text-sm text-[#737373] mt-2">
          Manage batch allocations, track machine schedules, and reconcile daily production
        </p>
      </div>

      {/* Key Metrics */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E9E9E9] rounded-xl p-4">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
            <p className="text-[9px] font-semibold text-slate-500 mb-2">Total Plans</p>
            <p className="text-2xl font-bold text-slate-700">{dashboardData?.totalPlans || 0}</p>
          </div>
          <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
            <p className="text-[9px] font-semibold text-slate-500 mb-2">Active</p>
            <p className="text-2xl font-bold text-amber-600">{dashboardData?.activePlans || 0}</p>
          </div>
          <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
            <p className="text-[9px] font-semibold text-slate-500 mb-2">Completed Today</p>
            <p className="text-2xl font-bold text-green-600">{dashboardData?.completedToday || 0}</p>
          </div>
          <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
            <p className="text-[9px] font-semibold text-slate-500 mb-2">Pending Reconcile</p>
            <p className="text-2xl font-bold text-rose-600">{dashboardData?.pendingReconciliations || 0}</p>
          </div>
        </div>
      )}

      {/* Allocation & Reconciliation Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocations */}
        <div className="bg-white border border-[#E9E9E9] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-[#AA3BFF]" />
            <h3 className="text-sm font-bold text-slate-700">Batch Allocations</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-xs font-semibold text-blue-700">Scheduled</span>
              <span className="text-lg font-bold text-blue-700">
                {dashboardData?.allocationMetrics?.scheduled || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-xs font-semibold text-amber-700">In Progress</span>
              <span className="text-lg font-bold text-amber-700">
                {dashboardData?.allocationMetrics?.inProgress || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
              <span className="text-xs font-semibold text-green-700">Completed</span>
              <span className="text-lg font-bold text-green-700">
                {dashboardData?.allocationMetrics?.completed || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Reconciliations */}
        <div className="bg-white border border-[#E9E9E9] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-[#AA3BFF]" />
            <h3 className="text-sm font-bold text-slate-700">Reconciliations</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-xs font-semibold text-amber-700">Pending</span>
              <span className="text-lg font-bold text-amber-700">
                {dashboardData?.reconciliationMetrics?.pending || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
              <span className="text-xs font-semibold text-green-700">Verified</span>
              <span className="text-lg font-bold text-green-700">
                {dashboardData?.reconciliationMetrics?.verified || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100">
              <span className="text-xs font-semibold text-rose-700">Flagged</span>
              <span className="text-lg font-bold text-rose-700">
                {dashboardData?.reconciliationMetrics?.flagged || 0}
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
