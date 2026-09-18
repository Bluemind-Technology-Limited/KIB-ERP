import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarCheck2, Recycle } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import BatchAllocationTable from './BatchAllocationTable';
import DailyReconciliationForm from './DailyReconciliationForm';
import ReconciliationHistory from './ReconciliationHistory';

interface LineItem {
  id: string;
  targetQuantity: number | string;
  achievedQuantity?: number;
  groundQuantity?: number;
  carryoverAvailable?: number;
  bom?: { finishedSku?: { name?: string } | null; productName?: string; yieldUnit?: string };
}

export default function PlanDetailView({
  planId,
  onBack,
}: {
  planId: string;
  onBack?: () => void;
}) {
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
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {error}
      </div>
    );
  }

  const plan = planData?.plan;
  const executionStatus = planData?.executionStatus;
  if (!plan) return <div className="text-center text-slate-500">Plan not found</div>;

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
          {onBack && (
            <button
              onClick={onBack}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              title="Back to plans"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#171717]">{plan.planNumber}</h2>
            <p className="text-xs text-[#737373] mt-1">
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
        <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
          <p className="text-[9px] font-semibold text-slate-500 mb-1">Status</p>
          <p className="text-sm font-bold text-slate-700">{plan.status}</p>
        </div>
        <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
          <p className="text-[9px] font-semibold text-slate-500 mb-1">Completion</p>
          <p className="text-sm font-bold text-slate-700">{executionStatus?.completionPercentage || 0}%</p>
        </div>
        <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
          <p className="text-[9px] font-semibold text-slate-500 mb-1">Planned Qty</p>
          <p className="text-sm font-bold text-slate-700">{Math.round(executionStatus?.plannedTotalQty || 0)}</p>
        </div>
        <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
          <p className="text-[9px] font-semibold text-slate-500 mb-1">Variance</p>
          <p
            className={`text-sm font-bold ${
              (executionStatus?.variancePercentage || 0) > 0 ? 'text-rose-600' : 'text-green-600'
            }`}
          >
            {(executionStatus?.variancePercentage || 0) > 0 ? '+' : ''}
            {(executionStatus?.variancePercentage || 0).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Production items: target vs recorded output */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Production Items</h3>
        <div className="space-y-3 max-h-[420px] overflow-y-auto">
          {lineItems.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">This plan has no items.</p>
          )}
          {lineItems.map((item, idx) => {
            const target = Number(item.targetQuantity ?? 0);
            const achieved = Number(item.achievedQuantity ?? 0);
            const diff = achieved - target;
            return (
              <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700">
                      {idx + 1}. {productFor(item)}
                    </p>
                    <p className="text-[9px] text-slate-500 mt-1">
                      Target: {target.toFixed(2)} {unitFor(item)} · Ground:{' '}
                      {Number(item.groundQuantity ?? 0).toFixed(2)} · Output: {achieved.toFixed(2)}{' '}
                      {unitFor(item)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold ${
                      achieved === 0
                        ? 'border-slate-200 bg-slate-50 text-slate-500'
                        : diff < 0
                          ? 'border-rose-200 bg-rose-50 text-rose-600'
                          : diff > 0
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {diff > 0 ? '+' : ''}
                    {diff.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WIP / carryover pool */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Recycle className="h-4 w-4 text-[#EA4335]" />
          <h3 className="text-sm font-bold text-slate-700">WIP Carryover</h3>
        </div>
        <p className="text-[10px] text-slate-400 mb-3">
          Unused output from earlier batches of the same product, carried forward until a later run draws on it.
        </p>
        {wipItems.length === 0 ? (
          <p className="text-[11px] text-slate-400">Nothing carried over for the products on this plan.</p>
        ) : (
          <div className="space-y-2">
            {wipItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
              >
                <span className="text-[11px] font-semibold text-slate-700">{productFor(item)}</span>
                <span className="font-mono text-[11px] font-bold text-[#171717]">
                  {Number(item.carryoverAvailable ?? 0).toFixed(2)} {unitFor(item)}
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
