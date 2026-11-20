import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageDescription } from '../../../components/ui/PageDescription';
import { Modal } from '../../../components/ui/Modal';
import { formatNumber, formatQty } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { Pagination } from '../../../components/ui/Pagination';
import { usePagination } from '../../../hooks/usePagination';

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
  SCHEDULED: 'bg-blue-600 text-white',
  IN_PROGRESS: 'bg-amber-600 text-white',
  COMPLETED: 'bg-emerald-600 text-white',
};

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function StockIssue() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** Drill-down day kept in the URL so the header Back/Forward controls work. */
  const [searchParams, setSearchParams] = useSearchParams();
  const openDayKey = searchParams.get('day');
  const setOpenDayKey = useCallback(
    (key: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (key) next.set('day', key);
      else next.delete('day');
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );
  /** The plan currently being released in the modal. */
  const [releasePlan, setReleasePlan] = useState<Plan | null>(null);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState<Record<string, string>>({});
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [releasesLoading, setReleasesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  /** Which history day is expanded (one at a time). */
  const [openHistoryDay, setOpenHistoryDay] = useState<string | null>(null);

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


  const openPlan = (plan: Plan) => {
    // Default each line to what is still outstanding, so a full release is one
    // click and a partial release is just editing the number.
    const next: Record<string, string> = {};
    for (const agg of plan.aggregatedIngredients) {
      const outstanding = Number(agg.totalQuantity) - Number(agg.issuedQuantity ?? 0);
      next[agg.id] = outstanding > 0.0001 ? String(outstanding) : '';
    }
    setLines(next);
    setReleasePlan(plan);
  };

  const closeRelease = () => {
    setReleasePlan(null);
    setLines({});
    setWarehouseId('');
  };

  /** Issue work grouped by production day — the same shape as the Grinding Station. */
  const issueDays = useMemo(() => {
    const byDate = new Map<
      string,
      {
        key: string;
        label: string;
        orders: number;
        issued: number;
        required: number;
        plans: Plan[];
        complete: boolean;
        started: boolean;
      }
    >();

    for (const plan of plans) {
      const raw = plan.scheduledFor ? new Date(plan.scheduledFor) : new Date();
      const key = `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(
        raw.getDate()
      ).padStart(2, '0')}`;

      let day = byDate.get(key);
      if (!day) {
        day = {
          key,
          label: raw.toLocaleDateString(),
          orders: 0,
          issued: 0,
          required: 0,
          plans: [],
          complete: true,
          started: false,
        };
        byDate.set(key, day);
      }

      day.orders += 1;
      day.plans.push(plan);
      day.issued += Number(plan.progress.issue.issuedIngredients ?? 0);
      day.required += Number(plan.progress.issue.totalIngredients ?? 0);
      if (Number(plan.progress.issue.issuedIngredients ?? 0) > 0) day.started = true;
      if (!plan.progress.issue.complete) day.complete = false;
    }

    return [...byDate.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [plans]);

  const { page, totalPages, total, pageItems, setPage } = usePagination(issueDays);

  /** Release history grouped by the day it happened. */
  const historyDays = useMemo(() => {
    const byDate = new Map<
      string,
      { key: string; label: string; lines: ReleaseRecord[]; quantity: number; orders: Set<string> }
    >();

    for (const release of releases) {
      const raw = new Date(release.issuedAt);
      const key = `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(
        raw.getDate()
      ).padStart(2, '0')}`;

      let day = byDate.get(key);
      if (!day) {
        day = { key, label: raw.toLocaleDateString(), lines: [], quantity: 0, orders: new Set() };
        byDate.set(key, day);
      }

      day.lines.push(release);
      day.quantity += Number(release.quantity ?? 0);
      if (release.planNumber) day.orders.add(release.planNumber);
    }

    return [...byDate.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [releases]);

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
        setReleasePlan(updated);
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
      {/* Header — actions grouped together */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Ingredients Station</h2>
          <PageDescription>Orders released by production. Release the ingredients to grinding — that is when stock is deducted.</PageDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center rounded-md border border-line bg-surface px-3 text-xs font-semibold text-ink-3 transition-colors hover:bg-surface-3 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
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
            title="No plans awaiting ingredients"
            hint="Scheduled plans with unissued ingredients appear here."
          />
        </div>
      ) : openDayKey && issueDays.some((d) => d.key === openDayKey) ? (
        <div className="space-y-3">
          {(() => {
            const day = issueDays.find((d) => d.key === openDayKey);
            if (!day) return null;
            return (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink">{day.label}</h3>
                    <p className="text-[10px] text-ink-faint">
                      {formatNumber(day.orders)} order(s) · {formatNumber(day.issued)} of{' '}
                      {formatNumber(day.required)} ingredients released
                    </p>
                  </div>
                  <span
                    className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      day.complete
                        ? 'bg-emerald-600 text-white'
                        : day.started
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-600 text-white'
                    }`}
                  >
                    {day.complete ? 'Completed' : day.started ? 'Started' : 'Pending'}
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-line bg-surface">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-line text-[9px] uppercase tracking-wider text-ink-faint">
                        <th className="w-full px-4 py-2 font-semibold">Order</th>
                        <th className="px-4 py-2 text-right font-semibold">Products</th>
                        <th className="px-4 py-2 text-right font-semibold">Released</th>
                        <th className="px-4 py-2 text-right font-semibold">Action</th>
                        <th className="px-4 py-2 text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.plans.map((plan) => {
                        const issued = Number(plan.progress.issue.issuedIngredients ?? 0);
                        const required = Number(plan.progress.issue.totalIngredients ?? 0);
                        return (
                          <tr key={plan.id} className="border-b border-line/60 last:border-0">
                            <td className="px-4 py-3">
                              <p className="font-mono text-[11px] font-bold text-ink">{plan.planNumber}</p>
                              <p className="text-[9px] text-ink-faint">
                                {plan.createdBy?.fullName ?? '—'}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right text-[11px] text-ink-muted">
                              {plan.items
                                .map((item) => item.bom?.finishedSku?.name ?? item.bom?.productName ?? 'Product')
                                .join(', ')}
                            </td>
                            <td className="px-4 py-3 text-right text-[11px] font-semibold text-ink-2">
                              {formatNumber(issued)} / {formatNumber(required)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                type="button"
                                onClick={() => openPlan(plan)}
                                className="ml-auto flex h-7 items-center gap-1 px-2.5 text-[10px]"
                              >
                                Release
                              </Button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                  statusBadge[plan.status] ?? 'bg-slate-600 text-white'
                                }`}
                              >
                                {plan.status.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-[9px] uppercase tracking-wider text-ink-faint">
                <th className="w-full px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 text-right font-semibold">Orders</th>
                <th className="px-4 py-3 text-right font-semibold">Released</th>
                <th className="px-4 py-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((day) => (
                <tr
                  key={day.key}
                  onClick={() => setOpenDayKey(day.key)}
                  className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-surface-2"
                >
                  <td className="px-4 py-3 text-[11px] font-semibold text-ink">{day.label}</td>
                  <td className="px-4 py-3 text-right text-[11px] font-bold text-ink">
                    {formatNumber(day.orders)}
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] text-ink-muted">
                    {formatNumber(day.issued)} / {formatNumber(day.required)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        day.complete
                          ? 'bg-emerald-600 text-white'
                          : day.started
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-600 text-white'
                      }`}
                    >
                      {day.complete ? 'Completed' : day.started ? 'Started' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      {/* Release history — always below the queue, grouped by day */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="text-[11px] font-bold text-ink">Release history</p>
            <p className="text-[10px] text-ink-faint">
              Every ingredient handed to grinding, grouped by day.
            </p>
          </div>
          <span className="text-[9px] font-semibold text-ink-faint">
            {formatNumber(releases.length)} line(s)
          </span>
        </div>

        {releasesLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : historyDays.length === 0 ? (
          <EmptyState
            title="No releases yet"
            hint="Released ingredients appear here with the order, quantity and user."
          />
        ) : (
          <div className="divide-y divide-line">
            {historyDays.map((day) => {
              const isOpen = openHistoryDay === day.key;
              return (
                <div key={day.key}>
                  <button
                    type="button"
                    onClick={() => setOpenHistoryDay(isOpen ? null : day.key)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-ink">{day.label}</p>
                      <p className="text-[10px] text-ink-faint">
                        {formatNumber(day.lines.length)} line(s) · {formatNumber(day.orders.size)} order(s)
                      </p>
                    </div>
                    <span className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 bg-slate-600 text-white">
                      {isOpen ? 'Hide' : 'View'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="overflow-x-auto border-t border-line">
                      <table className="w-full min-w-[720px] text-left">
                        <thead>
                          <tr className="border-b border-line text-[9px] uppercase tracking-wider text-ink-faint">
                            <th className="px-4 py-2 font-semibold">Released at</th>
                            <th className="px-4 py-2 font-semibold">Order</th>
                            <th className="px-4 py-2 font-semibold">Ingredient</th>
                            <th className="px-4 py-2 text-right font-semibold">Quantity</th>
                            <th className="px-4 py-2 font-semibold">Warehouse</th>
                            <th className="px-4 py-2 font-semibold">By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {day.lines.map((release) => (
                            <tr key={release.id} className="border-b border-line/60 last:border-0">
                              <td className="px-4 py-2 text-[10px] text-ink-muted">
                                {new Date(release.issuedAt).toLocaleTimeString()}
                              </td>
                              <td className="px-4 py-2 font-mono text-[10px] text-ink-muted">
                                {release.planNumber ?? '—'}
                              </td>
                              <td className="px-4 py-2 text-[10px] font-medium text-ink-2">
                                {release.materialName}
                              </td>
                              <td className="px-4 py-2 text-right text-[10px] font-semibold text-ink-2">
                                {formatQty(release.quantity, release.unitOfMeasure)}
                              </td>
                              <td className="px-4 py-2 text-[10px] text-ink-muted">
                                {release.warehouseName ?? '—'}
                              </td>
                              <td className="px-4 py-2 text-[10px] text-ink-muted">
                                {release.issuedByName ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Release form for one order */}
      {releasePlan && (
        <Modal onClose={closeRelease}>
          <div className="max-h-[88vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-xl bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">
                  Release ingredients
                </p>
                <h3 className="text-sm font-bold text-ink">{releasePlan.planNumber}</h3>
                <p className="text-[10px] text-ink-faint">
                  {releasePlan.items
                    .map((item) => item.bom?.finishedSku?.name ?? item.bom?.productName ?? 'Product')
                    .join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRelease}
                className="text-ink-faint hover:text-ink-muted"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                Release from warehouse
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="h-9 w-full max-w-sm rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:outline-none focus:border-[#EA4335]"
              >
                <option value="">Any warehouse — earliest expiry first</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                    <th className="px-3 py-2 font-semibold">Ingredient</th>
                    <th className="px-3 py-2 font-semibold">Required</th>
                    <th className="px-3 py-2 font-semibold">Released</th>
                    <th className="px-3 py-2 font-semibold">Outstanding</th>
                    <th className="px-3 py-2 font-semibold">Release now</th>
                  </tr>
                </thead>
                <tbody>
                  {releasePlan.aggregatedIngredients.map((agg) => {
                    const issued = Number(agg.issuedQuantity ?? 0);
                    const required = Number(agg.totalQuantity);
                    const outstanding = Math.max(0, required - issued);
                    // The material's pack label is the unit — the row always
                    // reads as a count of those packs (50 × 25 KG).
                    const uom = agg.material.unitOfMeasure ?? agg.unitOfMeasure;
                    return (
                      <tr key={agg.id} className="border-b border-line last:border-0">
                        <td className="px-3 py-2">
                          <p className="text-[11px] font-bold text-ink-2">{agg.material.name}</p>
                          <p className="text-[9px] font-mono text-ink-faint">{agg.material.sku}</p>
                        </td>
                        <td className="px-3 py-2 text-[11px] text-ink-muted">
                          {formatQty(required, uom)}
                        </td>
                        <td className="px-3 py-2 text-[11px]">
                          <span
                            className={
                              outstanding > 0.0001
                                ? 'font-semibold text-amber-600 dark:text-amber-300'
                                : 'font-semibold text-emerald-600 dark:text-emerald-300'
                            }
                          >
                            {formatNumber(issued)} / {formatNumber(required)}
                          </span>
                          <p className="text-[9px] text-ink-faint">{uom}</p>
                        </td>
                        <td
                          className={`px-3 py-2 text-[11px] font-bold ${
                            outstanding > 0.0001
                              ? 'text-amber-600 dark:text-amber-300'
                              : 'text-emerald-600 dark:text-emerald-300'
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
                            className="h-8 w-24 rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:outline-none focus:border-[#EA4335] disabled:bg-surface-3 disabled:text-ink-faint"
                          />
                          <p className="text-[9px] text-ink-faint">{uom}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="max-w-md text-[10px] text-ink-faint">
                Enter what you are handing over. Stock is deducted from the selected warehouse (or the
                earliest-expiry lots across all of them) and released to the Grinding Station.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeRelease}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-line bg-surface px-4 text-xs font-semibold text-ink-3 transition-colors hover:bg-surface-3"
                >
                  Close
                </button>
                <Button
                  onClick={() => submit(releasePlan)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 h-9 text-xs disabled:opacity-50"
                >
                  {submitting ? 'Releasing…' : 'Release to grinding'}
                </Button>
              </div>
            </div>

            {/* Release record for this order */}
            {releasePlan.ingredientIssues && releasePlan.ingredientIssues.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="border-b border-line bg-surface-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  Release record
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line text-[9px] uppercase tracking-wider text-ink-faint">
                      <th className="px-3 py-1.5 font-semibold">Released at</th>
                      <th className="px-3 py-1.5 font-semibold">Ingredient</th>
                      <th className="px-3 py-1.5 text-right font-semibold">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releasePlan.ingredientIssues.map((issue) => (
                      <tr key={issue.id} className="border-b border-line last:border-0">
                        <td className="px-3 py-1.5 text-[10px] text-ink-muted">
                          {new Date(issue.issuedAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5 text-[10px] text-ink-muted">
                          {issue.material?.name ?? issue.materialId}
                        </td>
                        <td className="px-3 py-1.5 text-right text-[10px] font-semibold text-ink-2">
                          {formatQty(issue.quantity, issue.unitOfMeasure)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
