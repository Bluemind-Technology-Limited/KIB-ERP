import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Factory, Loader, RefreshCw, X } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { PackQuantityPreview } from '../../../components/ui/PackQuantityPreview';
import { formatNumber, formatQty } from '../../../lib/format';

interface PlanItem {
  id: string;
  sequence: number;
  targetQuantity: string | number;
  bom: { productName: string; yieldUnit?: string | null; finishedSku?: { name: string; sku: string } | null; expectedYield?: string | number | null };
  grindingRecord?: { achievedQuantity: string | number } | null;
  finishingRecord?: { achievedQuantity: string | number; batchNumber?: string | null } | null;
  expectedBatches?: number;
  groundQuantity?: number;
  receivedQuantity?: number;
  achievedQuantity?: number;
  rejectedQuantity?: number;
  finishingOutstanding?: number;
  variance?: number;
  stationStatus?: string;
  carryoverAvailable?: number;
}

interface Plan {
  id: string;
  planNumber: string;
  status: string;
  items: PlanItem[];
  progress: { finishing: { totalItems: number; done: number; complete: boolean } };
}

interface FormState {
  achievedQuantity: string;
  remainderQuantity: string;
  carryoverUsedQuantity: string;
  rejectedQuantity: string;
  warehouseId: string;
  productionDate: string;
  remarks: string;
}

const today = () => new Date().toISOString().slice(0, 10);

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function FinishingStation() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<Plan | null>(null);
  const [closeReason, setCloseReason] = useState('');
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, whRes] = await Promise.all([
        axiosClient.get('/production-line/queue', { params: { station: 'FINISHING' } }),
        axiosClient.get('/master-data/warehouses'),
      ]);
      setPlans(queueRes.data.plans || []);
      setWarehouses(whRes.data.warehouses || []);
      setError('');
    } catch (err: any) {
      setError(apiError(err, 'Failed to load the finishing queue'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPlan = (plan: Plan) => {
    if (expandedId === plan.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(plan.id);
    const next: Record<string, FormState> = {};
    for (const item of plan.items) {
      if (Number(item.groundQuantity ?? 0) <= 0) continue;
      if (Number(item.finishingOutstanding ?? item.targetQuantity ?? 0) <= 0.0001) continue;
      next[item.id] = {
        achievedQuantity: String(item.finishingOutstanding ?? item.targetQuantity ?? ''),
        remainderQuantity: '',
        carryoverUsedQuantity: '',
        rejectedQuantity: '',
        warehouseId: '',
        productionDate: today(),
        remarks: '',
      };
    }
    setForms(next);
  };

  const update = (id: string, patch: Partial<FormState>) =>
    setForms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const closeOutstanding = async () => {
    if (!closeTarget) return;
    if (!closeReason.trim()) {
      setError('Enter a reason for closing the outstanding production quantity.');
      return;
    }
    setClosing(true);
    try {
      await axiosClient.post(`/production-line/plans/${closeTarget.id}/close-outstanding`, {
        reason: closeReason.trim(),
      });
      setCloseTarget(null);
      setCloseReason('');
      setError('');
      await load();
    } catch (err: any) {
      setError(apiError(err, 'Failed to close outstanding production'));
    } finally {
      setClosing(false);
    }
  };

  const submit = async (plan: Plan, item: PlanItem) => {
    const form = forms[item.id];
    if (!form) return;
    setError('');

    if (!form.warehouseId) {
      setError('Select the warehouse that receives the finished goods.');
      return;
    }

    setBusyItem(item.id);
    try {
      await axiosClient.post(`/production-line/plans/${plan.id}/items/${item.id}/finishing`, {
        achievedQuantity: Number(form.achievedQuantity),
        remainderQuantity: form.remainderQuantity ? Number(form.remainderQuantity) : 0,
        carryoverUsedQuantity: form.carryoverUsedQuantity ? Number(form.carryoverUsedQuantity) : 0,
        rejectedQuantity: form.rejectedQuantity ? Number(form.rejectedQuantity) : 0,
        warehouseId: form.warehouseId,
        productionDate: form.productionDate,
        remarks: form.remarks || undefined,
      });
      await load();
    } catch (err: any) {
      setError(apiError(err, 'Failed to record finished output'));
    } finally {
      setBusyItem(null);
    }
  };

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Production Station</h2>
          <PageDescription>Required finished-goods output per batch. Record what you achieved and any unused ground batches.</PageDescription>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 h-9 text-xs font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-4">
              <Skeleton className="mb-3 h-4 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            title="Nothing awaiting finishing"
            hint="Batches appear here once the grinding station has recorded them."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const isOpen = expandedId === plan.id;
            const ready = plan.items.filter(
              (i) =>
                Number(i.groundQuantity ?? 0) > 0 &&
                Number(i.finishingOutstanding ?? i.targetQuantity ?? 0) > 0.0001
            );

            return (
              <div key={plan.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                <button
                  onClick={() => openPlan(plan)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EA4335]/10">
                      <Factory className="h-4 w-4 text-[#EA4335]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink">{plan.planNumber}</p>
                      <p className="truncate text-[10px] text-ink-faint">
                        {formatNumber(plan.progress.finishing.done)}/{formatNumber(plan.progress.finishing.totalItems)} batches finished
                      </p>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-ink-faint" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-ink-faint" />
                  )}
                </button>

                {isOpen && (
                  <div className={`space-y-3 border-t border-line px-4 py-4 ${
                    plan.status === 'SCHEDULED' ||
                    !plan.items.some((item) => Number(item.groundQuantity ?? 0) > 0.0001)
                      ? 'pointer-events-none opacity-50'
                      : ''
                  }`}>
                    {(plan.status === 'SCHEDULED' ||
                      !plan.items.some((item) => Number(item.groundQuantity ?? 0) > 0.0001)) && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        {plan.status === 'SCHEDULED'
                          ? 'Waiting for the Ingredients Station to release the ingredients.'
                          : 'Waiting for the Grinding Station to hand over ground material.'}
                      </div>
                    )}
                    {/* Production dashboard — expected vs finished */}
                    <div className="overflow-hidden rounded-lg border border-line">
                      <div className="flex items-center justify-between border-b border-line bg-surface-2/70 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                          Production dashboard
                        </p>
                        {plan.items.some(
                          (item) => Number(item.finishingOutstanding ?? 0) > 0.0001
                        ) && (
                          <button
                            type="button"
                            onClick={() => {
                              setCloseTarget(plan);
                              setCloseReason('');
                              setError('');
                            }}
                            className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-600 text-white"
                          >
                            Close outstanding
                          </button>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left">
                          <thead>
                            <tr className="border-b border-line text-[8px] uppercase tracking-wider text-ink-faint">
                              <th className="px-3 py-2 font-semibold">Product</th>
                              <th className="px-3 py-2 text-right font-semibold">Expected batches</th>
                              <th className="px-3 py-2 font-semibold">Expected finished</th>
                              <th className="px-3 py-2 font-semibold">Received from grinding</th>
                              <th className="px-3 py-2 font-semibold">Actual finished</th>
                              <th className="px-3 py-2 font-semibold">Variance</th>
                              <th className="px-3 py-2 font-semibold">Outstanding</th>
                              <th className="px-3 py-2 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.items.map((item) => (
                              <tr key={item.id} className="border-b border-line last:border-0">
                                <td className="px-3 py-2 text-[10px] font-semibold text-ink-2">
                                  {item.bom?.finishedSku?.name ?? item.bom?.productName}
                                </td>
                                <td className="px-3 py-2 text-right text-[10px] font-semibold text-ink-muted">
                                  {formatNumber(item.expectedBatches ?? 0)}
                                </td>
                                <td className="px-3 py-2 text-[10px] text-ink-muted">
                                  {formatQty(item.targetQuantity, item.bom?.yieldUnit)}
                                </td>
                                <td className="px-3 py-2 text-[10px] text-ink-muted">
                                  {formatQty(item.groundQuantity ?? 0, item.bom?.yieldUnit)}
                                </td>
                                <td className="px-3 py-2 text-[10px] font-semibold text-ink-2">
                                  {formatQty(item.achievedQuantity ?? 0, item.bom?.yieldUnit)}
                                </td>
                                <td className={`px-3 py-2 text-[10px] font-bold ${Number(item.variance ?? 0) < 0 ? 'text-amber-600 dark:text-amber-300' : Number(item.variance ?? 0) > 0 ? 'text-blue-600 dark:text-blue-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                                  {Number(item.variance ?? 0) > 0 ? '+' : ''}
                                  {formatQty(item.variance ?? 0, item.bom?.yieldUnit)}
                                </td>
                                <td className={`px-3 py-2 text-[10px] font-bold ${Number(item.finishingOutstanding ?? 0) > 0.0001 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                                  {formatQty(item.finishingOutstanding ?? 0, item.bom?.yieldUnit)}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                      item.stationStatus === 'COMPLETED'
                                        ? 'bg-emerald-600 text-white'
                                        : item.stationStatus === 'IN_PROGRESS'
                                          ? 'bg-amber-600 text-white'
                                          : 'bg-slate-600 text-white'
                                    }`}
                                  >
                                    {item.stationStatus ?? 'PENDING'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {ready.length === 0 && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">Nothing left to finish for this plan.</p>
                    )}
                    {ready.map((item) => {
                      const form = forms[item.id];
                      if (!form) return null;
                      return (
                        <div key={item.id} className="rounded-xl border border-line p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold text-ink">
                              Batch {item.sequence} · {item.bom?.finishedSku?.name ?? item.bom?.productName}
                            </p>
                            <div className="flex items-center gap-3 text-[10px]">
                              <span className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-600 text-white">
                                Required {formatQty(item.targetQuantity, item.bom?.yieldUnit)}
                              </span>
                              <span className="rounded border border-[#AA3BFF]/30 bg-[#AA3BFF]/5 px-2 py-0.5 text-[#AA3BFF]">
                                Ground {formatNumber(item.groundQuantity)}
                              </span>
                            </div>
                          </div>

                          {Number(item.carryoverAvailable ?? 0) > 0 && (
                            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#AA3BFF]/30 bg-[#AA3BFF]/5 px-3 py-2">
                              <span className="text-[10px] font-semibold text-[#AA3BFF]">
                                Unfinished from previous batches: {formatNumber(item.carryoverAvailable)}
                              </span>
                              <label className="flex items-center gap-2 text-[10px] text-ink-muted">
                                Use now
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={form.carryoverUsedQuantity}
                                  onChange={(e) =>
                                    update(item.id, { carryoverUsedQuantity: e.target.value })
                                  }
                                  placeholder="0"
                                  className="h-7 w-24 rounded border border-line px-2 text-[11px] focus:outline-none focus:border-[#AA3BFF]"
                                />
                              </label>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
                                Achieved
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={form.achievedQuantity}
                                onChange={(e) => update(item.id, { achievedQuantity: e.target.value })}
                                className="h-8 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                              <PackQuantityPreview quantity={form.achievedQuantity} unit={item.bom?.yieldUnit} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
                                Unused batches
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={form.remainderQuantity}
                                onChange={(e) => update(item.id, { remainderQuantity: e.target.value })}
                                placeholder="0"
                                className="h-8 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
                                Rejected / lost
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={form.rejectedQuantity}
                                onChange={(e) => update(item.id, { rejectedQuantity: e.target.value })}
                                placeholder="0"
                                className="h-8 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-1 md:col-span-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
                                Receive into warehouse
                              </label>
                              <select
                                value={form.warehouseId}
                                onChange={(e) => update(item.id, { warehouseId: e.target.value })}
                                className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              >
                                <option value="">Select warehouse…</option>
                                {warehouses.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
                                Production date
                              </label>
                              <input
                                type="date"
                                value={form.productionDate}
                                onChange={(e) => update(item.id, { productionDate: e.target.value })}
                                className="h-8 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
                                Remarks
                              </label>
                              <input
                                value={form.remarks}
                                onChange={(e) => update(item.id, { remarks: e.target.value })}
                                placeholder="Optional"
                                className="h-8 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              onClick={() => submit(plan, item)}
                              disabled={busyItem === item.id}
                              className="flex items-center gap-2 rounded-lg bg-[#EA4335] px-4 h-8 text-[11px] font-semibold text-white hover:bg-[#d3362a] disabled:opacity-50"
                            >
                              {busyItem === item.id ? (
                                <Loader className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Record finished output
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {closeTarget && (
        <Modal onClose={() => setCloseTarget(null)}>
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">Close outstanding production</h3>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {closeTarget.planNumber} will be completed with its remaining quantities explicitly
                  reconciled. This is recorded in the audit trail.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCloseTarget(null)}
                className="text-ink-faint hover:text-ink-muted"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                Reason for closing outstanding quantity
              </label>
              <textarea
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                rows={3}
                placeholder="e.g. Balance reconciled at shift close, spills/rejects written off"
                className="w-full rounded-lg border border-line px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335]"
              />
              {error && <p className="text-[11px] text-rose-600 dark:text-rose-300">{error}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloseTarget(null)}
                className="h-9 rounded-lg border border-line px-4 text-xs font-semibold text-ink-muted hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={closeOutstanding}
                disabled={closing}
                className="flex h-9 items-center gap-2 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {closing ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Close outstanding
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
