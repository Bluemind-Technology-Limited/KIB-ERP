import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import PlanDetailView from './PlanDetailView';
import { formatPercent } from '../../../lib/format';

interface Plan {
  id: string;
  planNumber: string;
  status: string;
  scheduledFor: string;
  createdBy: { fullName: string };
  items: any[];
  executionStatus?: {
    totalItems: number;
    completionPercentage: number;
    plannedTotalQty: number;
    actualTotalQty: number;
    variancePercentage: number;
  };
}

export default function ProductionPlanDashboard() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in-progress' | 'completed'>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  /** Selected plan is kept in the URL so the header Back/Forward control can leave the detail view. */
  const selectedPlanId = searchParams.get('plan');
  const setSelectedPlanId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('plan', id);
    else next.delete('plan');
    setSearchParams(next);
  };

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const status = filter === 'all' ? undefined : filter.toUpperCase().replace('-', '_');
        const res = await axiosClient.get('/supervisor/production-plans', {
          params: { status },
        });
        setPlans(res.data.plans);
        setError('');
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load plans');
      } finally {
        setLoading(false);
      }
    };
    loadPlans();
  }, [filter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-600 text-white';
      case 'IN_PROGRESS':
        return 'bg-amber-600 text-white';
      case 'COMPLETED':
        return 'bg-green-600 text-white';
      default:
        return 'bg-surface-2 border-line text-ink-2';
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 5) return 'text-rose-600 dark:text-rose-300';
    if (variance < -5) return 'text-amber-600 dark:text-amber-300';
    return 'text-green-600 dark:text-green-300';
  };

  if (selectedPlanId) {
    return <PlanDetailView planId={selectedPlanId} />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Production Plans</h2>
          <p className="text-xs text-ink-muted mt-1">Monitor and manage daily production schedules</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'scheduled', 'in-progress', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filter === f
                ? 'bg-[#AA3BFF] text-white border-[#AA3BFF]'
                : 'hover:border-line-strong bg-slate-600 text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Plans Grid */}
      <div className="grid gap-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface border border-line rounded-xl p-4">
                <Skeleton className="h-4 w-48 mb-3" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-80" />
              </div>
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl">
            <EmptyState title="No plans found" hint="Production plans will appear here" />
          </div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-surface border border-line rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              {/* Plan Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-ink-2">{plan.planNumber}</h3>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded border ${getStatusColor(plan.status)}`}
                    >
                      {plan.status}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Scheduled: {plan.scheduledFor ? new Date(plan.scheduledFor).toLocaleDateString() : 'TBD'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPlanId(plan.id)}
                  className="px-3 py-1.5 text-xs font-medium text-[#AA3BFF] hover:bg-[#AA3BFF] hover:text-white rounded border border-[#AA3BFF] transition-colors"
                >
                  View →
                </button>
              </div>

              {/* Stats */}
              {plan.executionStatus && (
                <div className="grid grid-cols-4 gap-3">
                  {/* Items Progress */}
                  <div className="bg-surface-2 rounded-lg p-2.5">
                    <p className="text-[9px] text-ink-muted mb-1">Items</p>
                    <p className="text-sm font-bold text-ink-2">{plan.executionStatus.totalItems}</p>
                  </div>

                  {/* Completion % */}
                  <div className="bg-surface-2 rounded-lg p-2.5">
                    <p className="text-[9px] text-ink-muted mb-1">Completion</p>
                    <p className="text-sm font-bold text-ink-2">{plan.executionStatus.completionPercentage}%</p>
                  </div>

                  {/* Planned Qty */}
                  <div className="bg-surface-2 rounded-lg p-2.5">
                    <p className="text-[9px] text-ink-muted mb-1">Planned</p>
                    <p className="text-sm font-bold text-ink-2">
                      {Math.round(plan.executionStatus.plannedTotalQty)}
                    </p>
                  </div>

                  {/* Variance */}
                  <div className="bg-surface-2 rounded-lg p-2.5">
                    <p className="text-[9px] text-ink-muted mb-1">Variance</p>
                    <p className={`text-sm font-bold ${getVarianceColor(plan.executionStatus.variancePercentage)}`}>
                      {plan.executionStatus.variancePercentage > 0 ? '+' : ''}
                      {formatPercent(plan.executionStatus.variancePercentage, 1)}
                    </p>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {plan.executionStatus && (
                <div className="mt-3 w-full h-2 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#AA3BFF] transition-all"
                    style={{ width: `${plan.executionStatus.completionPercentage}%` }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
