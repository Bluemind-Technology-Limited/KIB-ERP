import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Boxes, ChevronDown, ChevronRight, Loader, PackageCheck, RefreshCw } from 'lucide-react';
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
  returnedQuantity?: string | number | null;
  material: { id: string; name: string; sku: string; unitOfMeasure: string };
}

interface PlanItem {
  id: string;
  sequence: number;
  targetQuantity: string | number;
  bom: { productName: string; finishedSku?: { name: string; sku: string } | null };
}

interface Plan {
  id: string;
  planNumber: string;
  description?: string | null;
  status: string;
  scheduledFor?: string | null;
  createdBy?: { fullName: string } | null;
  items: PlanItem[];
  aggregatedIngredients: AggregatedIngredient[];
  progress: {
    issue: { totalIngredients: number; issuedIngredients: number; complete: boolean };
    grinding: { totalItems: number; done: number; complete: boolean };
    finishing: { totalItems: number; done: number; complete: boolean };
  };
}

interface StockRow {
  materialId: string;
  batchLotId: string | null;
  batchNumber: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  warehouseId: string;
  quantity: number;
  unitOfMeasure: string;
}

const statusBadge: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

/** FIFO: oldest manufactured first, then soonest to expire (unknowns last). */
function fifoSort(a: StockRow, b: StockRow) {
  const aMfg = a.manufacturingDate ? new Date(a.manufacturingDate).getTime() : Infinity;
  const bMfg = b.manufacturingDate ? new Date(b.manufacturingDate).getTime() : Infinity;
  if (aMfg !== bMfg) return aMfg - bMfg;
  const aExp = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
  const bExp = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
  return aExp - bExp;
}

export default function StockIssue() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState<Record<string, { quantity: string; batchLotId: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, whRes] = await Promise.all([
        axiosClient.get('/production-line/queue', { params: { station: 'ISSUE' } }),
        axiosClient.get('/master-data/warehouses'),
      ]);
      setPlans(queueRes.data.plans || []);
      setWarehouses(whRes.data.warehouses || []);
      setError('');
    } catch (err: any) {
      setError(apiError(err, 'Failed to load plans awaiting issue'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const batchesFor = useMemo(
    () =>
      (materialId: string, whId: string): StockRow[] =>
        stock
          .filter(
            (s) => s.materialId === materialId && s.warehouseId === whId && Number(s.quantity) > 0
          )
          .sort(fifoSort),
    [stock]
  );

  const availableFor = useMemo(
    () =>
      (materialId: string, whId: string): number =>
        stock
          .filter((s) => s.materialId === materialId && s.warehouseId === whId)
          .reduce((sum, s) => sum + Number(s.quantity), 0),
    [stock]
  );

  const expandedPlan = useMemo(
    () => plans.find((p) => p.id === expandedId) ?? null,
    [plans, expandedId]
  );

  // Buffer memory: when a warehouse is picked, default every line to the oldest
  // available batch so existing stock is consumed before anything newer.
  useEffect(() => {
    if (!warehouseId || !expandedPlan) return;
    setLines((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const agg of expandedPlan.aggregatedIngredients) {
        if (agg.status === 'RELEASED') continue;
        const line = next[agg.id];
        if (!line || line.batchLotId) continue;
        const batches = stock
          .filter(
            (s) =>
              s.materialId === agg.materialId &&
              s.warehouseId === warehouseId &&
              Number(s.quantity) > 0
          )
          .sort(fifoSort);
        if (batches[0]?.batchLotId) {
          next[agg.id] = { ...line, batchLotId: batches[0].batchLotId };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [warehouseId, stock, expandedPlan]);

  const openPlan = async (plan: Plan) => {
    if (expandedId === plan.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(plan.id);
    setWarehouseId('');

    const next: Record<string, { quantity: string; batchLotId: string }> = {};
    for (const agg of plan.aggregatedIngredients) {
      if (agg.status === 'RELEASED') continue;
      const remaining = Number(agg.totalQuantity) - Number(agg.issuedQuantity ?? 0);
      next[agg.id] = { quantity: remaining > 0 ? String(remaining) : '', batchLotId: '' };
    }
    setLines(next);

    try {
      const res = await axiosClient.get('/inventory/stock');
      setStock(res.data.stock || []);
    } catch {
      setStock([]);
    }
  };

  const submit = async (plan: Plan) => {
    setError('');
    if (!warehouseId) {
      setError('Select the warehouse the ingredients are being deducted from.');
      return;
    }

    const payloadLines = Object.entries(lines)
      .map(([aggregatedIngredientId, v]) => ({
        aggregatedIngredientId,
        quantity: Number(v.quantity),
        batchLotId: v.batchLotId || null,
      }))
      .filter((l) => l.quantity > 0);

    if (payloadLines.length === 0) {
      setError('Enter a quantity for at least one ingredient.');
      return;
    }

    setSubmitting(true);
    try {
      await axiosClient.post(`/production-line/plans/${plan.id}/issue`, {
        warehouseId,
        lines: payloadLines,
      });
      setExpandedId(null);
      await load();
    } catch (err: any) {
      setError(apiError(err, 'Failed to issue ingredients'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Stock Issue — Production</h2>
          <p className="text-[#737373] text-xs">
            Required ingredients for each plan. Select a warehouse and deduct the quantities.
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
            title="No plans awaiting ingredients"
            hint="Scheduled plans with unissued ingredients appear here."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const isOpen = expandedId === plan.id;
            const pending = plan.aggregatedIngredients.filter((a) => a.status !== 'RELEASED');

            return (
              <div key={plan.id} className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
                <button
                  onClick={() => openPlan(plan)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00B4D8]/10">
                      <Boxes className="h-4 w-4 text-[#00B4D8]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#171717]">{plan.planNumber}</p>
                      <p className="truncate text-[10px] text-slate-400">
                        {plan.items.length} product(s) · {plan.progress.issue.issuedIngredients}/
                        {plan.progress.issue.totalIngredients} ingredients issued
                        {plan.createdBy?.fullName ? ` · ${plan.createdBy.fullName}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded border px-2 py-0.5 text-[9px] font-bold ${
                        statusBadge[plan.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {plan.status}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Products in this plan
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {plan.items
                          .map(
                            (i) =>
                              `${i.bom?.finishedSku?.name ?? i.bom?.productName}: ${i.targetQuantity}`
                          )
                          .join(' · ')}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Deduct from warehouse
                      </label>
                      <select
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        className="h-9 w-full max-w-sm rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                      >
                        <option value="">Select warehouse…</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                            <th className="px-3 py-2 font-semibold">Ingredient</th>
                            <th className="px-3 py-2 font-semibold">Required</th>
                            <th className="px-3 py-2 font-semibold">Issued</th>
                            <th className="px-3 py-2 font-semibold">Available</th>
                            <th className="px-3 py-2 font-semibold">Issue now</th>
                            <th className="px-3 py-2 font-semibold">Batch lot</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pending.map((agg) => {
                            const batches = warehouseId ? batchesFor(agg.materialId, warehouseId) : [];
                            const line = lines[agg.id] ?? { quantity: '', batchLotId: '' };
                            return (
                              <tr key={agg.id} className="border-b border-slate-50">
                                <td className="px-3 py-2">
                                  <p className="text-[11px] font-bold text-slate-700">{agg.material.name}</p>
                                  <p className="text-[9px] font-mono text-slate-400">{agg.material.sku}</p>
                                </td>
                                <td className="px-3 py-2 text-[11px] text-slate-600">
                                  {agg.totalQuantity} {agg.unitOfMeasure}
                                </td>
                                <td className="px-3 py-2 text-[11px] text-slate-500">
                                  {agg.issuedQuantity ?? 0}
                                </td>
                                <td className="px-3 py-2 text-[11px] text-slate-500">
                                  {warehouseId ? (
                                    <span
                                      className={
                                        availableFor(agg.materialId, warehouseId) <
                                        Number(agg.totalQuantity) - Number(agg.issuedQuantity ?? 0)
                                          ? 'font-semibold text-amber-600'
                                          : 'text-slate-500'
                                      }
                                    >
                                      {availableFor(agg.materialId, warehouseId)}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={line.quantity}
                                    onChange={(e) =>
                                      setLines((prev) => ({
                                        ...prev,
                                        [agg.id]: { ...line, quantity: e.target.value },
                                      }))
                                    }
                                    className="h-8 w-28 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    value={line.batchLotId}
                                    onChange={(e) =>
                                      setLines((prev) => ({
                                        ...prev,
                                        [agg.id]: { ...line, batchLotId: e.target.value },
                                      }))
                                    }
                                    disabled={!warehouseId}
                                    className="h-8 w-36 rounded-lg border border-[#E9E9E9] bg-white px-2 text-[10px] focus:outline-none focus:border-[#EA4335] disabled:bg-slate-50"
                                  >
                                    <option value="">Auto / none</option>
                                    {batches.map((b) => (
                                      <option key={b.batchLotId ?? 'none'} value={b.batchLotId ?? ''}>
                                        {b.batchNumber ?? 'no batch'} ({b.quantity})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {pending.length === 0 ? (
                      <p className="flex items-center gap-2 text-xs text-emerald-700">
                        <PackageCheck className="h-4 w-4" /> All ingredients have been issued.
                      </p>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          onClick={() => submit(plan)}
                          disabled={submitting}
                          className="flex items-center gap-2 rounded-lg bg-[#EA4335] px-4 h-9 text-xs font-semibold text-white hover:bg-[#d3362a] disabled:opacity-50"
                        >
                          {submitting ? (
                            <Loader className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PackageCheck className="h-3.5 w-3.5" />
                          )}
                          Issue ingredients
                        </button>
                      </div>
                    )}
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
