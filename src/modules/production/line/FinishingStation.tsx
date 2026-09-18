import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Factory, Loader, RefreshCw } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface PlanItem {
  id: string;
  sequence: number;
  targetQuantity: string | number;
  bom: { productName: string; finishedSku?: { name: string; sku: string } | null };
  grindingRecord?: { achievedQuantity: string | number } | null;
  finishingRecord?: { achievedQuantity: string | number; batchNumber?: string | null } | null;
  groundQuantity: number;
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
  warehouseId: string;
  batchNumber: string;
  expiryDate: string;
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
      if (!item.grindingRecord || item.finishingRecord) continue;
      next[item.id] = {
        achievedQuantity: String(item.targetQuantity ?? ''),
        remainderQuantity: '',
        warehouseId: '',
        batchNumber: '',
        expiryDate: '',
        productionDate: today(),
        remarks: '',
      };
    }
    setForms(next);
  };

  const update = (itemId: string, patch: Partial<FormState>) =>
    setForms((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));

  const submit = async (plan: Plan, item: PlanItem) => {
    const form = forms[item.id];
    if (!form) return;
    setError('');

    if (!form.warehouseId) {
      setError('Select the warehouse that receives the finished goods.');
      return;
    }
    if (!form.batchNumber) {
      setError('A finished batch number is required.');
      return;
    }

    setBusyItem(item.id);
    try {
      await axiosClient.post(`/production-line/plans/${plan.id}/items/${item.id}/finishing`, {
        achievedQuantity: Number(form.achievedQuantity),
        remainderQuantity: form.remainderQuantity ? Number(form.remainderQuantity) : 0,
        warehouseId: form.warehouseId,
        batchNumber: form.batchNumber,
        expiryDate: form.expiryDate || undefined,
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
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Finishing Station</h2>
          <p className="text-[#737373] text-xs">
            Required finished-goods output per batch. Record what you achieved and any unused ground batches.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[#E9E9E9] bg-white px-3 h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#E9E9E9] bg-white p-4">
              <Skeleton className="mb-3 h-4 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-[#E9E9E9] bg-white">
          <EmptyState
            title="Nothing awaiting finishing"
            hint="Batches appear here once the grinding station has recorded them."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const isOpen = expandedId === plan.id;
            const ready = plan.items.filter((i) => i.grindingRecord && !i.finishingRecord);

            return (
              <div key={plan.id} className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
                <button
                  onClick={() => openPlan(plan)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EA4335]/10">
                      <Factory className="h-4 w-4 text-[#EA4335]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#171717]">{plan.planNumber}</p>
                      <p className="truncate text-[10px] text-slate-400">
                        {plan.progress.finishing.done}/{plan.progress.finishing.totalItems} batches finished
                      </p>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {isOpen && (
                  <div className="space-y-3 border-t border-slate-100 px-4 py-4">
                    {ready.length === 0 && (
                      <p className="text-xs text-emerald-700">Nothing left to finish for this plan.</p>
                    )}
                    {ready.map((item) => {
                      const form = forms[item.id];
                      if (!form) return null;
                      return (
                        <div key={item.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[#171717]">
                              Batch {item.sequence} · {item.bom?.finishedSku?.name ?? item.bom?.productName}
                            </p>
                            <div className="flex items-center gap-3 text-[10px]">
                              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                                Required {item.targetQuantity}
                              </span>
                              <span className="rounded border border-[#AA3BFF]/30 bg-[#AA3BFF]/5 px-2 py-0.5 text-[#AA3BFF]">
                                Ground {item.groundQuantity}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                Achieved
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={form.achievedQuantity}
                                onChange={(e) => update(item.id, { achievedQuantity: e.target.value })}
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                Unused batches
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={form.remainderQuantity}
                                onChange={(e) => update(item.id, { remainderQuantity: e.target.value })}
                                placeholder="0"
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                Finished batch no.
                              </label>
                              <input
                                value={form.batchNumber}
                                onChange={(e) => update(item.id, { batchNumber: e.target.value })}
                                placeholder="Required"
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                Expiry date
                              </label>
                              <input
                                type="date"
                                value={form.expiryDate}
                                onChange={(e) => update(item.id, { expiryDate: e.target.value })}
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-1 md:col-span-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                Receive into warehouse
                              </label>
                              <select
                                value={form.warehouseId}
                                onChange={(e) => update(item.id, { warehouseId: e.target.value })}
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
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
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                Production date
                              </label>
                              <input
                                type="date"
                                value={form.productionDate}
                                onChange={(e) => update(item.id, { productionDate: e.target.value })}
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                Remarks
                              </label>
                              <input
                                value={form.remarks}
                                onChange={(e) => update(item.id, { remarks: e.target.value })}
                                placeholder="Optional"
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
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
    </div>
  );
}
