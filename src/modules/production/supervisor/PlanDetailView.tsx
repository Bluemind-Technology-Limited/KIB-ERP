import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2, Recycle } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import BatchAllocationTable from './BatchAllocationTable';
import DailyReconciliationForm from './DailyReconciliationForm';
import ReconciliationHistory from './ReconciliationHistory';
import { formatNumber, formatPercent, formatQty } from '../../../lib/format';

interface LineItem {
  id: string;
  targetQuantity: number | string;
  achievedQuantity?: number;
  groundQuantity?: number;
  carryoverAvailable?: number;
  bom?: { finishedSku?: { name?: string } | null; productName?: string; yieldUnit?: string };
}

export default function PlanDetailView({ planId }: { planId: string }) {
  const [planData, setPlanData] = useState<{ plan: any; executionStatus: any } | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReconcile, setShowReconcile] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!planId) return;
    try {
      const [supervisorRes, lineRes] = await Promise.all([
        axiosClient.get(`/supervisor/production-plans/${planId}`),
        // The line view carries the finishing output and the WIP carryover pool.
        axiosClient.get(`/production-line/plans/${planId}`),
      ]);
      setPlanData(supervisorRes.data);
      setLineItems(lineRes.data?.items ?? []);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load this plan');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  if (loading) return <Skeleton className="h-96 w-full" />;

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        {error}
      </div>
    );
  }

  const plan = planData?.plan;
  const executionStatus = planData?.executionStatus;
  if (!plan) return <div className="text-center text-ink-muted">Plan not found</div>;

  const allocations = (plan.items ?? []).flatMap((item: any) => item.batchMachineAllocations ?? []);
  const unitFor = (item: LineItem) => item.bom?.yieldUnit ?? '';
  const productFor = (item: LineItem) =>
    item.bom?.finishedSku?.name ?? item.bom?.productName ?? 'Unknown';

  const wipItems = lineItems.filter((i) => Number(i.carryoverAvailable ?? 0) > 0);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-ink">{plan.planNumber}</h2>
            <p className="text-xs text-ink-muted mt-1">
              Production plan execution, WIP carryover and daily reconciliation
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowReconcile(true)}
          className="btn-3d h-9 shrink-0 px-4"
        >
          <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-white">
            <CalendarCheck2 className="h-3.5 w-3.5 shrink-0" /> Reconcile day
          </span>
        </button>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-line rounded-xl p-4">
          <p className="text-[9px] font-semibold text-ink-muted mb-1">Status</p>
          <p className="text-sm font-bold text-ink-2">{plan.status}</p>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <p className="text-[9px] font-semibold text-ink-muted mb-1">Completion</p>
          <p className="text-sm font-bold text-ink-2">{executionStatus?.completionPercentage || 0}%</p>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <p className="text-[9px] font-semibold text-ink-muted mb-1">Planned Qty</p>
          <p className="text-sm font-bold text-ink-2">{Math.round(executionStatus?.plannedTotalQty || 0)}</p>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <p className="text-[9px] font-semibold text-ink-muted mb-1">Variance</p>
          <p
            className={`text-sm font-bold ${
              (executionStatus?.variancePercentage || 0) > 0 ? 'text-rose-600 dark:text-rose-300' : 'text-green-600 dark:text-green-300'
            }`}
          >
            {(executionStatus?.variancePercentage || 0) > 0 ? '+' : ''}
            {formatPercent(executionStatus?.variancePercentage || 0, 1)}
          </p>
        </div>
      </div>

      {/* Production items: target vs recorded output */}
      <div className="bg-surface border border-line rounded-xl p-4">
        <h3 className="text-sm font-bold text-ink-2 mb-4">Production Items</h3>
        <div className="space-y-3 max-h-[420px] overflow-y-auto">
          {lineItems.length === 0 && (
            <p className="py-6 text-center text-xs text-ink-faint">This plan has no items.</p>
          )}
          {lineItems.map((item, idx) => {
            const target = Number(item.targetQuantity ?? 0);
            const achieved = Number(item.achievedQuantity ?? 0);
            const diff = achieved - target;
            return (
              <div key={item.id} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-2">
                      {idx + 1}. {productFor(item)}
                    </p>
                    <p className="text-[9px] text-ink-muted mt-1">
                      Target: {formatQty(target, unitFor(item), 2)} · Ground:{' '}
                      {formatNumber(Number(item.groundQuantity ?? 0), 2)} · Output: {formatNumber(achieved, 2)}{' '}
                      {unitFor(item)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-bold ${
                      achieved === 0
                        ? 'bg-slate-600 text-white'
                        : diff < 0
                          ? 'bg-rose-600 text-white'
                          : diff > 0
                            ? 'bg-amber-600 text-white'
                            : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {diff > 0 ? '+' : ''}
                    {formatNumber(diff, 2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WIP / carryover pool */}
      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Recycle className="h-4 w-4 text-[#EA4335]" />
          <h3 className="text-sm font-bold text-ink-2">WIP Carryover</h3>
        </div>
        <p className="text-[10px] text-ink-faint mb-3">
          Unused output from earlier batches of the same product, carried forward until a later run draws on it.
        </p>
        {wipItems.length === 0 ? (
          <p className="text-[11px] text-ink-faint">Nothing carried over for the products on this plan.</p>
        ) : (
          <div className="space-y-2">
            {wipItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-line bg-surface-2/70 px-3 py-2"
              >
                <span className="text-[11px] font-semibold text-ink-2">{productFor(item)}</span>
                <span className="font-mono text-[11px] font-bold text-ink">
                  {formatQty(Number(item.carryoverAvailable ?? 0), unitFor(item), 2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BatchAllocationTable allocations={allocations} onChanged={loadPlan} />

      <ReconciliationHistory planId={planId} />

      {showReconcile && (
        <DailyReconciliationForm
          planId={planId}
          plan={{ planNumber: plan.planNumber, items: lineItems }}
          onClose={() => setShowReconcile(false)}
        />
      )}
    </div>
  );
}
