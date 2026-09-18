import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Cog, Loader, RefreshCw } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface AggregatedIngredient {
  id: string;
  materialId: string;
  totalQuantity: string | number;
  unitOfMeasure: string;
  status: string;
  issuedQuantity?: string | number | null;
  issuedWarehouseId?: string | null;
  material: { id: string; name: string; sku: string };
}

interface StockRow {
  materialId: string;
  batchLotId: string | null;
  batchNumber: string | null;
  warehouseId: string;
  quantity: number;
}

interface PlanItem {
  id: string;
  sequence: number;
  targetQuantity: string | number;
  bom: { productName: string };
  grindingRecord?: { achievedQuantity: string | number; remainderQuantity: string | number } | null;
}

interface Plan {
  id: string;
  planNumber: string;
  status: string;
  items: PlanItem[];
  aggregatedIngredients: AggregatedIngredient[];
  progress: { grinding: { totalItems: number; done: number; complete: boolean } };
}

interface FormState {
  inputQuantity: string;
  achievedQuantity: string;
  batchNumber: string;
  productionDate: string;
  machineId: string;
  remarks: string;
  remainders: Record<string, string>;
  inputs: Record<string, { quantity: string; batchLotId: string }>;
}

const today = () => new Date().toISOString().slice(0, 10);

function emptyForm(item: PlanItem, ingredients: AggregatedIngredient[]): FormState {
  const remainders: Record<string, string> = {};
  const inputs: Record<string, { quantity: string; batchLotId: string }> = {};
  for (const agg of ingredients) {
    remainders[agg.materialId] = '';
    inputs[agg.materialId] = { quantity: '', batchLotId: '' };
  }
  return {
    inputQuantity: String(item.targetQuantity ?? ''),
    achievedQuantity: String(item.targetQuantity ?? ''),
    batchNumber: '',
    productionDate: today(),
    machineId: '',
    remarks: '',
    remainders,
    inputs,
  };
}

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function GrindingStation() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, machineRes] = await Promise.all([
        axiosClient.get('/production-line/queue', { params: { station: 'GRINDING' } }),
        axiosClient.get('/production/machines').catch(() => ({ data: { machines: [] } })),
      ]);
      setPlans(queueRes.data.plans || []);
      setMachines(machineRes.data.machines || []);
      setError('');
    } catch (err: any) {
      setError(apiError(err, 'Failed to load the grinding queue'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPlan = async (plan: Plan) => {
    if (expandedId === plan.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(plan.id);
    const next: Record<string, FormState> = {};
    for (const item of plan.items) {
      if (item.grindingRecord) continue;
      next[item.id] = emptyForm(item, plan.aggregatedIngredients);
    }
    setForms(next);

    try {
      const res = await axiosClient.get('/inventory/stock');
      setStock(res.data.stock || []);
    } catch {
      setStock([]);
    }
  };

  const update = (itemId: string, patch: Partial<FormState>) =>
    setForms((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));

  const submit = async (plan: Plan, item: PlanItem) => {
    const form = forms[item.id];
    if (!form) return;
    setError('');

    if (Number(form.achievedQuantity) > Number(form.inputQuantity)) {
      setError('Achieved quantity cannot exceed the input quantity.');
      return;
    }

    const remainders = Object.entries(form.remainders)
      .map(([materialId, qty]) => ({ materialId, quantity: Number(qty) }))
      .filter((r) => r.quantity > 0);

    const inputs = Object.entries(form.inputs)
      .map(([materialId, v]) => ({
        materialId,
        quantity: Number(v.quantity),
        batchLotId: v.batchLotId || null,
      }))
      .filter((r) => r.quantity > 0);

    const remainderQuantity = remainders.reduce((sum, r) => sum + r.quantity, 0);

    setBusyItem(item.id);
    try {
      await axiosClient.post(`/production-line/plans/${plan.id}/items/${item.id}/grinding`, {
        inputQuantity: Number(form.inputQuantity),
        achievedQuantity: Number(form.achievedQuantity),
        remainderQuantity,
        remainders,
        inputs,
        machineId: form.machineId || null,
        batchNumber: form.batchNumber || null,
        productionDate: form.productionDate,
        remarks: form.remarks || undefined,
      });
      await load();
    } catch (err: any) {
      setError(apiError(err, 'Failed to record grinding'));
    } finally {
      setBusyItem(null);
    }
  };

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Grinding Station</h2>
          <p className="text-[#737373] text-xs">
            Record what you actually ground for each batch, and return any unused ingredients.
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
          <EmptyState title="No batches to grind" hint="Batches appear once the store issues the ingredients." />
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const isOpen = expandedId === plan.id;
            const pending = plan.items.filter((i) => !i.grindingRecord);
            const issued = plan.aggregatedIngredients.filter((a) => a.status === 'RELEASED');

            return (
              <div key={plan.id} className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
                <button
                  onClick={() => openPlan(plan)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#AA3BFF]/10">
                      <Cog className="h-4 w-4 text-[#AA3BFF]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#171717]">{plan.planNumber}</p>
                      <p className="truncate text-[10px] text-slate-400">
                        {plan.progress.grinding.done}/{plan.progress.grinding.totalItems} batches ground
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
                    {pending.length === 0 && (
                      <p className="text-xs text-emerald-700">All batches for this plan are ground.</p>
                    )}
                    {pending.map((item) => {
                      const form = forms[item.id];
                      if (!form) return null;
                      return (
                        <div key={item.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-[#171717]">
                              Batch {item.sequence} · {item.bom?.productName}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              Target {item.targetQuantity}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                Input qty
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={form.inputQuantity}
                                onChange={(e) => update(item.id, { inputQuantity: e.target.value })}
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                              />
                            </div>
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
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                Batch no.
                              </label>
                              <input
                                value={form.batchNumber}
                                onChange={(e) => update(item.id, { batchNumber: e.target.value })}
                                placeholder="Optional"
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                Date
                              </label>
                              <input
                                type="date"
                                value={form.productionDate}
                                onChange={(e) => update(item.id, { productionDate: e.target.value })}
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                              />
                            </div>
                          </div>

                          {machines.length > 0 && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                Grinding machine (optional)
                              </label>
                              <select
                                value={form.machineId}
                                onChange={(e) => update(item.id, { machineId: e.target.value })}
                                className="h-8 w-full max-w-xs rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                              >
                                <option value="">Not specified</option>
                                {machines.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Batch lots ground — exact traceability lineage */}
                          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Batch lots ground (for exact traceability)
                            </p>
                            {issued.length === 0 ? (
                              <p className="text-[11px] text-slate-400">No issued ingredients to record.</p>
                            ) : (
                              <div className="space-y-2">
                                {issued.map((agg) => {
                                  const batches = stock.filter(
                                    (s) =>
                                      s.materialId === agg.materialId &&
                                      (!agg.issuedWarehouseId || s.warehouseId === agg.issuedWarehouseId) &&
                                      Number(s.quantity) > 0
                                  );
                                  const line = form.inputs[agg.materialId] ?? {
                                    quantity: '',
                                    batchLotId: '',
                                  };
                                  return (
                                    <div key={agg.id} className="flex flex-wrap items-center gap-2">
                                      <span className="min-w-[8rem] flex-1 truncate text-[10px] text-slate-600">
                                        {agg.material.name}
                                      </span>
                                      <select
                                        value={line.batchLotId}
                                        onChange={(e) =>
                                          update(item.id, {
                                            inputs: {
                                              ...form.inputs,
                                              [agg.materialId]: {
                                                ...line,
                                                batchLotId: e.target.value,
                                              },
                                            },
                                          })
                                        }
                                        className="h-7 w-44 rounded border border-[#E9E9E9] bg-white px-2 text-[10px] focus:outline-none focus:border-[#AA3BFF]"
                                      >
                                        <option value="">Select batch…</option>
                                        {batches.map((b) => (
                                          <option key={b.batchLotId ?? 'none'} value={b.batchLotId ?? ''}>
                                            {b.batchNumber ?? 'no batch'} ({b.quantity})
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={line.quantity}
                                        onChange={(e) =>
                                          update(item.id, {
                                            inputs: {
                                              ...form.inputs,
                                              [agg.materialId]: {
                                                ...line,
                                                quantity: e.target.value,
                                              },
                                            },
                                          })
                                        }
                                        placeholder="Qty"
                                        className="h-7 w-20 rounded border border-[#E9E9E9] px-2 text-[11px] focus:outline-none focus:border-[#AA3BFF]"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Remainders: unused issued ingredients */}
                          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Unused ingredients returned to store
                            </p>
                            {issued.length === 0 ? (
                              <p className="text-[11px] text-slate-400">No issued ingredients to return.</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                {issued.map((agg) => (
                                  <div key={agg.id} className="flex items-center gap-2">
                                    <span className="flex-1 truncate text-[10px] text-slate-600">
                                      {agg.material.name}
                                      <span className="ml-1 text-slate-400">({agg.issuedQuantity ?? 0})</span>
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={form.remainders[agg.materialId] ?? ''}
                                      onChange={(e) =>
                                        update(item.id, {
                                          remainders: { ...form.remainders, [agg.materialId]: e.target.value },
                                        })
                                      }
                                      placeholder="0"
                                      className="h-7 w-20 rounded border border-[#E9E9E9] px-2 text-[11px] focus:outline-none focus:border-[#AA3BFF]"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <input
                              value={form.remarks}
                              onChange={(e) => update(item.id, { remarks: e.target.value })}
                              placeholder="Remarks (optional)"
                              className="h-8 flex-1 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                            />
                            <button
                              onClick={() => submit(plan, item)}
                              disabled={busyItem === item.id}
                              className="flex items-center gap-2 rounded-lg bg-[#AA3BFF] px-4 h-8 text-[11px] font-semibold text-white hover:bg-[#9a2ff5] disabled:opacity-50"
                            >
                              {busyItem === item.id ? (
                                <Loader className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Cog className="h-3.5 w-3.5" />
                              )}
                              Record grinding
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
