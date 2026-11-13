import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Boxes, ChevronDown, ChevronRight, Loader, PackageCheck, RefreshCw } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageDescription } from '../../../components/ui/PageDescription';
import { formatNumber, formatQty } from '../../../lib/format';

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
  releasedAt?: string | null;
  outstandingClosedAt?: string | null;
  outstandingCloseReason?: string | null;
  ingredientIssues?: Array<{
    id: string;
    materialId: string;
    quantity: string | number;
    unitOfMeasure: string;
    issuedAt: string;
    material?: { name: string; sku: string } | null;
  }>;
  progress: {
    issue: { totalIngredients: number; issuedIngredients: number; complete: boolean };
    grinding: { totalItems: number; done: number; complete: boolean };
    finishing: { totalItems: number; done: number; complete: boolean };
  };
}

interface ReleaseRecord {
  id: string;
  planNumber: string | null;
  materialName: string;
  unitOfMeasure: string;
  quantity: number;
  warehouseName: string | null;
  issuedByName: string | null;
  issuedAt: string;
}

const statusBadge: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function StockIssue() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyPlans, setHistoryPlans] = useState<Plan[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [lines, setLines] = useState<Record<string, string>>({});
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [releasesLoading, setReleasesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setReleasesLoading(true);
    try {
      const [queueRes, releaseRes, warehouseRes] = await Promise.all([
        axiosClient.get('/production-line/queue', { params: { station: 'ISSUE' } }),
        axiosClient.get('/production-line/releases', { params: { limit: 100 } }),
        axiosClient.get('/master-data/warehouses'),
      ]);
      setPlans(queueRes.data.plans || []);
      setReleases(releaseRes.data.releases || []);
      setWarehouses(warehouseRes.data.warehouses || []);
      setError('');
    } catch (err: any) {
      setError(apiError(err, 'Failed to load plans awaiting release'));
    } finally {
      setLoading(false);
      setReleasesLoading(false);
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

    // Default each line to what is still outstanding, so a full release is one
    // click and a partial release is just editing the number.
    const next: Record<string, string> = {};
    for (const agg of plan.aggregatedIngredients) {
      const outstanding = Number(agg.totalQuantity) - Number(agg.issuedQuantity ?? 0);
      next[agg.id] = outstanding > 0.0001 ? String(outstanding) : '';
    }
    setLines(next);

  };

  const toggleHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    if (historyPlans.length > 0) return;
    setHistoryLoading(true);
    try {
      const res = await axiosClient.get('/production-line/plans', {
        params: { status: 'COMPLETED' },
      });
      setHistoryPlans(res.data.plans || []);
    } catch (err: any) {
      setError(apiError(err, 'Failed to load ingredient preparation history'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const submit = async (plan: Plan) => {
    const payloadLines = Object.entries(lines)
      .map(([aggregatedIngredientId, value]) => ({
        aggregatedIngredientId,
        quantity: Number(value),
      }))
      .filter((line) => Number(line.quantity) > 0);

    if (payloadLines.length === 0) {
      setError('Enter a quantity to release for at least one ingredient.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      // Deducts what was entered (earliest-expiry lots first, across warehouses)
      // and hands the released quantity to the Grinding Station.
      const res = await axiosClient.post(`/production-line/plans/${plan.id}/issue`, {
        lines: payloadLines,
        warehouseId: warehouseId || null,
      });

      // Repopulate the inputs with whatever is still outstanding.
      const updated = res.data?.plan;
      if (updated?.aggregatedIngredients) {
        const next: Record<string, string> = {};
        for (const agg of updated.aggregatedIngredients as Array<{
          id: string;
          totalQuantity: string | number;
          issuedQuantity?: string | number | null;
        }>) {
          const outstanding = Number(agg.totalQuantity) - Number(agg.issuedQuantity ?? 0);
          next[agg.id] = outstanding > 0.0001 ? String(outstanding) : '';
        }
        setLines(next);
      }

      await load();
    } catch (err: any) {
      setError(apiError(err, 'Failed to release the ingredients'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Ingredients Station</h2>
          <PageDescription>Orders released by production. Release the ingredients to grinding — that is when stock is deducted.</PageDescription>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[#E9E9E9] bg-white px-3 h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <button
          onClick={toggleHistory}
          className="flex items-center gap-1.5 rounded-lg border border-[#E9E9E9] bg-white px-3 h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {showHistory ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          History
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
                        {formatNumber(plan.items.length)} product(s) · {formatNumber(plan.progress.issue.issuedIngredients)}/
                        {formatNumber(plan.progress.issue.totalIngredients)} ingredients issued
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

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Release from warehouse
                      </label>
                      <select
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                        className="h-9 w-full max-w-sm rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                      >
                        <option value="">Any warehouse — earliest expiry first</option>
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
                            <th className="px-3 py-2 font-semibold">Released</th>
                            <th className="px-3 py-2 font-semibold">Outstanding</th>
                            <th className="px-3 py-2 font-semibold">Release now</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.aggregatedIngredients.map((agg) => {
                            const issued = Number(agg.issuedQuantity ?? 0);
                            const required = Number(agg.totalQuantity);
                            const outstanding = Math.max(0, required - issued);
                            // The material's pack label is the unit — the row always
                            // reads as a count of those packs (50 × 25 KG).
                            const uom = agg.material.unitOfMeasure ?? agg.unitOfMeasure;
                            return (
                              <tr key={agg.id} className="border-b border-slate-50 last:border-0">
                                <td className="px-3 py-2">
                                  <p className="text-[11px] font-bold text-slate-700">{agg.material.name}</p>
                                  <p className="text-[9px] font-mono text-slate-400">{agg.material.sku}</p>
                                </td>
                                <td className="px-3 py-2 text-[11px] text-slate-600">
                                  {formatQty(required, uom)}
                                </td>
                                <td className="px-3 py-2 text-[11px]">
                                  <span
                                    className={
                                      outstanding > 0.0001
                                        ? 'font-semibold text-amber-600'
                                        : 'font-semibold text-emerald-600'
                                    }
                                  >
                                    {formatNumber(issued)} / {formatNumber(required)}
                                  </span>
                                  <p className="text-[9px] text-slate-400">{uom}</p>
                                </td>
                                <td
                                  className={`px-3 py-2 text-[11px] font-bold ${
                                    outstanding > 0.0001 ? 'text-amber-600' : 'text-emerald-600'
                                  }`}
                                >
                                  {formatNumber(outstanding)}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={lines[agg.id] ?? ''}
                                    onChange={(e) =>
                                      setLines((prev) => ({ ...prev, [agg.id]: e.target.value }))
                                    }
                                    disabled={outstanding <= 0.0001}
                                    placeholder={outstanding > 0.0001 ? String(outstanding) : '0'}
                                    className="h-8 w-24 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335] disabled:bg-slate-50 disabled:text-slate-400"
                                  />
                                  <p className="text-[9px] text-slate-400">{uom}</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="max-w-md text-[10px] text-slate-400">
                        Enter what you are handing over. Stock is deducted from the selected warehouse (or the
                        earliest-expiry lots across all of them) and released to the Grinding Station.
                      </p>
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
                        Release to grinding
                      </button>
                    </div>

                    {/* Release record for this order */}
                    {plan.ingredientIssues && plan.ingredientIssues.length > 0 && (
                      <div className="overflow-hidden rounded-lg border border-slate-100">
                        <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Release record
                        </div>
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-[9px] uppercase tracking-wider text-slate-400">
                              <th className="px-3 py-1.5 font-semibold">Released at</th>
                              <th className="px-3 py-1.5 font-semibold">Ingredient</th>
                              <th className="px-3 py-1.5 text-right font-semibold">Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.ingredientIssues.map((issue) => (
                              <tr key={issue.id} className="border-b border-slate-50 last:border-0">
                                <td className="px-3 py-1.5 text-[10px] text-slate-500">
                                  {new Date(issue.issuedAt).toLocaleString()}
                                </td>
                                <td className="px-3 py-1.5 text-[10px] text-slate-600">
                                  {issue.material?.name ?? issue.materialId}
                                </td>
                                <td className="px-3 py-1.5 text-right text-[10px] font-semibold text-slate-700">
                                  {formatQty(issue.quantity, issue.unitOfMeasure)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Release history — every ingredient handed to grinding */}
      <div className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-[11px] font-bold text-[#171717]">Release history</p>
            <p className="text-[10px] text-slate-400">
              Every ingredient handed to grinding, newest first.
            </p>
          </div>
          <span className="text-[9px] font-semibold text-slate-400">
            {formatNumber(releases.length)} line(s)
          </span>
        </div>

        {releasesLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : releases.length === 0 ? (
          <EmptyState
            title="No releases yet"
            hint="Released ingredients appear here with the order, quantity and user."
          />
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-100 text-[9px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2 font-semibold">Released at</th>
                  <th className="px-4 py-2 font-semibold">Order</th>
                  <th className="px-4 py-2 font-semibold">Ingredient</th>
                  <th className="px-4 py-2 text-right font-semibold">Quantity</th>
                  <th className="px-4 py-2 font-semibold">Warehouse</th>
                  <th className="px-4 py-2 font-semibold">By</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => (
                  <tr key={release.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 text-[10px] text-slate-500">
                      {new Date(release.issuedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-slate-600">
                      {release.planNumber ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-[10px] font-medium text-slate-700">
                      {release.materialName}
                    </td>
                    <td className="px-4 py-2 text-right text-[10px] font-semibold text-slate-700">
                      {formatQty(release.quantity, release.unitOfMeasure)}
                    </td>
                    <td className="px-4 py-2 text-[10px] text-slate-500">
                      {release.warehouseName ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-[10px] text-slate-500">
                      {release.issuedByName ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showHistory && (
        <div className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[11px] font-bold text-[#171717]">Ingredient preparation history</p>
            <p className="text-[10px] text-slate-400">
              Completed production orders and the ingredient lots issued to them.
            </p>
          </div>

          {historyLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : historyPlans.length === 0 ? (
            <EmptyState title="No completed production orders yet" hint="Completed plans appear here with their issued ingredients." />
          ) : (
            <div className="divide-y divide-slate-100">
              {historyPlans.map((plan) => (
                <div key={plan.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] font-bold text-[#171717]">{plan.planNumber}</p>
                      <p className="text-[10px] text-slate-400">
                        {plan.scheduledFor ? new Date(plan.scheduledFor).toLocaleDateString() : '—'} ·{' '}
                        {plan.items.map((item) => item.bom?.finishedSku?.name ?? item.bom?.productName).join(', ')}
                      </p>
                    </div>
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-700">
                      Completed
                    </span>
                  </div>

                  {plan.ingredientIssues?.length ? (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left">
                        <thead>
                          <tr className="border-b border-slate-100 text-[8px] uppercase tracking-wider text-slate-400">
                            <th className="py-1.5 pr-3 font-semibold">Ingredient</th>
                            <th className="px-3 py-1.5 font-semibold">Quantity issued</th>
                            <th className="py-1.5 pl-3 text-right font-semibold">Issued at</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.ingredientIssues.map((issue) => (
                            <tr key={issue.id} className="border-b border-slate-50 last:border-0">
                              <td className="py-1.5 pr-3 text-[10px] text-slate-600">
                                {issue.material?.name ?? issue.materialId}
                              </td>
                              <td className="px-3 py-1.5 text-[10px] font-semibold text-slate-700">
                                {formatQty(issue.quantity, issue.unitOfMeasure)}
                              </td>
                              <td className="py-1.5 pl-3 text-right text-[9px] text-slate-400">
                                {new Date(issue.issuedAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] text-slate-400">No issue lines recorded.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
