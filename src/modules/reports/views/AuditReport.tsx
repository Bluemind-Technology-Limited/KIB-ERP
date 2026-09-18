import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Download, Factory, RefreshCw } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { useAuthStore } from '../../../stores/useAuthStore';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface FlowItem {
  planItemId: string;
  productName: string | null;
  sku: string | null;
  unitOfMeasure: string | null;
  targetQuantity: number;
  grinding: {
    id: string;
    input: number;
    achieved: number;
    remainder: number;
    batchNumber: string | null;
    status: string;
    date: string;
    inputs: Array<{ materialId: string; batchLotId: string | null; quantity: number }>;
    remainders: Array<{ materialId: string; quantity: number; unitOfMeasure: string }>;
  } | null;
  finishing: {
    id: string;
    input: number;
    achieved: number;
    remainder: number;
    carryoverUsedQuantity: number;
    batchNumber: string | null;
    finishedBatchLotId: string | null;
    status: string;
    date: string;
  } | null;
  achievedQuantity: number | null;
  variance: number | null;
  variancePct: number | null;
  grindingYieldPct: number | null;
  finishingYieldPct: number | null;
  grindingRemainderPct: number | null;
  finishingRemainderPct: number | null;
  inspections: Array<{ id: string; result: string; batchNumber: string | null; batchStatus: string | null; inspectedAt: string | null }>;
}

interface FlowPlan {
  planId: string;
  planNumber: string;
  description: string | null;
  status: string;
  scheduledFor: string | null;
  completedAt: string | null;
  createdBy: string | null;
  items: FlowItem[];
  issue: {
    totalIngredients: number;
    issuedIngredients: number;
    ingredients: Array<{
      material: string | null;
      sku: string | null;
      required: number;
      issued: number;
      returned: number;
      unitOfMeasure: string;
      status: string;
    }>;
  };
  movements: Array<{
    id: string;
    eventType: string;
    referenceType: string | null;
    quantity: number;
    unitOfMeasure: string;
    material: string | null;
    warehouse: string | null;
    by: string | null;
    createdAt: string;
  }>;
}

interface FlowSummary {
  plans: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  batches: number;
  totalTarget: number;
  totalAchieved: number;
  totalIssued: number;
  totalReturned: number;
  grindingRemainder: number;
  avgGrindingYieldPct: number | null;
  avgFinishingYieldPct: number | null;
}

interface ActivityRow {
  id: string;
  type: string;
  module: string;
  description: string;
  detail: string;
  actor: string | null;
  amount: number | null;
  timestamp: string;
  referenceType: string | null;
  referenceId: string | null;
}

const statusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};

const stageStatusBadge: Record<string, string> = {
  SUBMITTED: 'bg-slate-100 text-slate-600 border-slate-200',
  VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FLAGGED: 'bg-rose-50 text-rose-600 border-rose-200',
};

const moduleBadge: Record<string, string> = {
  inventory: 'bg-sky-50 text-sky-700 border-sky-200',
  production: 'bg-amber-50 text-amber-700 border-amber-200',
  qa: 'bg-[#AA3BFF]/10 text-[#AA3BFF] border-[#AA3BFF]/30',
  procurement: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function downloadCSV(rows: ActivityRow[]) {
  const header = ['Timestamp', 'Module', 'Type', 'Description', 'Detail', 'Actor', 'Amount', 'Reference'];
  const body = rows.map((r) => [
    r.timestamp,
    r.module,
    r.type,
    r.description,
    r.detail,
    r.actor ?? '',
    r.amount ?? '',
    `${r.referenceType ?? ''} ${r.referenceId ?? ''}`.trim(),
  ]);
  const csv = [header, ...body]
    .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `erp-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AuditReport() {
  const user = useAuthStore((state) => state.user);
  const canApprove = ['SUPER_ADMIN', 'PRODUCTION_MANAGER'].includes(user?.role ?? '');

  const [tab, setTab] = useState<'flow' | 'activity'>('flow');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', entity: '' });
  const [applied, setApplied] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [flow, setFlow] = useState<{ rows: FlowPlan[]; summary: FlowSummary } | null>(null);
  const [activity, setActivity] = useState<{ rows: ActivityRow[]; summary: { total: number; byModule: Record<string, number> } } | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [flowRes, actRes] = await Promise.all([
        axiosClient.get('/reports/production-flow', {
          params: { dateFrom: applied.dateFrom || undefined, dateTo: applied.dateTo || undefined, limit: 200 },
        }),
        axiosClient.get('/reports/erp-activity', {
          params: {
            dateFrom: applied.dateFrom || undefined,
            dateTo: applied.dateTo || undefined,
            entity: applied.entity || undefined,
            limit: 500,
          },
        }),
      ]);
      setFlow(flowRes.data);
      setActivity(actRes.data);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load the audit report');
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    load();
  }, [load]);

  const setRecordStatus = async (recordId: string, status: 'VERIFIED' | 'FLAGGED') => {
    try {
      await axiosClient.patch(`/production-line/stage-records/${recordId}/status`, { status });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update the stage record');
    }
  };

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Audit &amp; Report</h2>
          <p className="text-[#737373] text-xs">
            The whole production flow and every ERP activity in a date range.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV(activity?.rows ?? [])}
            disabled={!activity || activity.rows.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#E9E9E9] bg-white px-3 h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-[#E9E9E9] bg-white px-3 h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#E9E9E9] bg-white p-4 md:grid-cols-4">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">To</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Module</label>
          <select
            value={filters.entity}
            onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
            className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
          >
            <option value="">All</option>
            <option value="inventory">Inventory</option>
            <option value="production">Production</option>
            <option value="qa">Quality</option>
            <option value="procurement">Procurement</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={() => setApplied(filters)}
            className="h-9 flex-1 rounded-lg bg-[#EA4335] px-3 text-xs font-semibold text-white hover:bg-[#d3362a]"
          >
            Apply
          </button>
          <button
            onClick={() => {
              const cleared = { dateFrom: '', dateTo: '', entity: '' };
              setFilters(cleared);
              setApplied(cleared);
            }}
            className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex w-fit items-center gap-1 rounded-lg border border-[#E9E9E9] bg-white p-1">
        <button
          onClick={() => setTab('flow')}
          className={`px-3 h-7 rounded-md text-[10px] font-semibold ${tab === 'flow' ? 'bg-[#EA4335] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Production flow ({flow?.rows.length ?? 0})
        </button>
        <button
          onClick={() => setTab('activity')}
          className={`px-3 h-7 rounded-md text-[10px] font-semibold ${tab === 'activity' ? 'bg-[#EA4335] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          ERP activity ({activity?.rows.length ?? 0})
        </button>
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
          <TableSkeleton cols={6} rows={6} />
        </div>
      ) : tab === 'flow' ? (
        <div className="space-y-4">
          {flow?.summary && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi label="Plans" value={flow.summary.plans} sub={`${flow.summary.completed} completed`} />
              <Kpi label="Batches" value={flow.summary.batches} sub="plan items" />
              <Kpi label="Target" value={flow.summary.totalTarget} sub="finished qty" />
              <Kpi label="Achieved" value={flow.summary.totalAchieved} sub="finished qty" />
              <Kpi
                label="Avg yield"
                value={
                  flow.summary.avgGrindingYieldPct === null && flow.summary.avgFinishingYieldPct === null
                    ? '—'
                    : `${flow.summary.avgGrindingYieldPct ?? '—'}% grind / ${flow.summary.avgFinishingYieldPct ?? '—'}% finish`
                }
                sub="grinding / finishing"
              />
              <Kpi label="Issued / returned" value={`${flow.summary.totalIssued}`} sub={`${flow.summary.totalReturned} returned`} />
            </div>
          )}

          {(flow?.rows.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-[#E9E9E9] bg-white">
              <EmptyState title="No production plans in range." hint="Adjust the date filters." />
            </div>
          ) : (
            flow?.rows.map((plan) => {
              const isOpen = expandedPlan === plan.planId;
              return (
                <div key={plan.planId} className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
                  <button
                    onClick={() => setExpandedPlan(isOpen ? null : plan.planId)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EA4335]/10">
                        <Factory className="h-4 w-4 text-[#EA4335]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#171717]">{plan.planNumber}</p>
                        <p className="truncate text-[10px] text-slate-400">
                          {plan.items.length} product(s) · {plan.issue.issuedIngredients}/
                          {plan.issue.totalIngredients} issued
                          {plan.createdBy ? ` · ${plan.createdBy}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded border px-2 py-0.5 text-[9px] font-bold ${statusBadge[plan.status] ?? statusBadge.DRAFT}`}>
                        {plan.status}
                      </span>
                      {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                      {/* Items flow */}
                      <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-[9px] uppercase tracking-wider text-slate-400">
                              <th className="px-3 py-2 font-semibold">Product</th>
                              <th className="px-3 py-2 font-semibold">Target</th>
                              <th className="px-3 py-2 font-semibold">Ground</th>
                              <th className="px-3 py-2 font-semibold">Achieved</th>
                              <th className="px-3 py-2 font-semibold">Yield</th>
                              <th className="px-3 py-2 font-semibold">Variance</th>
                              <th className="px-3 py-2 font-semibold">QA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.items.map((item) => (
                              <tr key={item.planItemId} className="border-b border-slate-50">
                                <td className="px-3 py-2">
                                  <p className="text-[11px] font-bold text-slate-700">{item.productName ?? '—'}</p>
                                  <p className="text-[9px] font-mono text-slate-400">{item.sku ?? ''}</p>
                                </td>
                                <td className="px-3 py-2 text-[11px] text-slate-600">{item.targetQuantity}</td>
                                <td className="px-3 py-2 text-[11px] text-slate-600">
                                  {item.grinding ? `${item.grinding.achieved} / in ${item.grinding.input}` : '—'}
                                </td>
                                <td className="px-3 py-2 text-[11px] text-slate-600">
                                  {item.achievedQuantity ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-[10px] text-slate-500">
                                  {item.grindingYieldPct !== null && (
                                    <span>g {item.grindingYieldPct}%</span>
                                  )}
                                  {item.grindingYieldPct !== null && item.finishingYieldPct !== null && ' · '}
                                  {item.finishingYieldPct !== null && (
                                    <span>f {item.finishingYieldPct}%</span>
                                  )}
                                  {item.grindingYieldPct === null && item.finishingYieldPct === null && '—'}
                                </td>
                                <td className="px-3 py-2 text-[11px]">
                                  {item.variance === null ? (
                                    <span className="text-slate-400">—</span>
                                  ) : (
                                    <span className={item.variance < 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-700'}>
                                      {item.variance > 0 ? '+' : ''}
                                      {item.variance} ({item.variancePct}%)
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {item.inspections.length === 0 ? (
                                    <span className="text-[10px] text-slate-400">—</span>
                                  ) : (
                                    item.inspections.map((ins) => (
                                      <span
                                        key={ins.id}
                                        className={`mr-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                                          ins.result === 'PASSED'
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                            : ins.result === 'FAILED'
                                              ? 'border-rose-200 bg-rose-50 text-rose-600'
                                              : 'border-slate-200 bg-slate-50 text-slate-500'
                                        }`}
                                      >
                                        {ins.result}
                                      </span>
                                    ))
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {canApprove && (
                        <div className="rounded-lg border border-slate-100 p-3">
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Stage sign-off
                          </p>
                          <div className="space-y-1.5">
                            {plan.items
                              .flatMap((item) => {
                                const rows: Array<{ id: string; label: string; status: string; yieldPct: number | null }> = [];
                                if (item.grinding) {
                                  rows.push({
                                    id: item.grinding.id,
                                    label: `${item.productName ?? ''} · Grinding`,
                                    status: item.grinding.status,
                                    yieldPct: item.grindingYieldPct,
                                  });
                                }
                                if (item.finishing) {
                                  rows.push({
                                    id: item.finishing.id,
                                    label: `${item.productName ?? ''} · Finishing`,
                                    status: item.finishing.status,
                                    yieldPct: item.finishingYieldPct,
                                  });
                                }
                                return rows;
                              })
                              .map((rec) => (
                                <div key={rec.id} className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[10px] text-slate-600">
                                    {rec.label}
                                    {rec.yieldPct !== null ? ` · yield ${rec.yieldPct}%` : ''}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${stageStatusBadge[rec.status] ?? stageStatusBadge.SUBMITTED}`}>
                                      {rec.status}
                                    </span>
                                    <button
                                      onClick={() => setRecordStatus(rec.id, 'VERIFIED')}
                                      className="rounded border border-emerald-200 px-2 h-6 text-[9px] font-semibold text-emerald-700 hover:bg-emerald-50"
                                    >
                                      Verify
                                    </button>
                                    <button
                                      onClick={() => setRecordStatus(rec.id, 'FLAGGED')}
                                      className="rounded border border-rose-200 px-2 h-6 text-[9px] font-semibold text-rose-600 hover:bg-rose-50"
                                    >
                                      Flag
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Issue */}
                      <div className="rounded-lg border border-slate-100 p-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Ingredient issue
                        </p>
                        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                          {plan.issue.ingredients.map((ing, idx) => (
                            <div key={`${ing.sku}-${idx}`} className="flex items-center justify-between text-[10px]">
                              <span className="truncate text-slate-600">{ing.material ?? ing.sku}</span>
                              <span className="ml-2 shrink-0 font-mono text-slate-500">
                                req {ing.required} · iss {ing.issued}
                                {ing.returned > 0 && <span className="text-amber-600"> · ret {ing.returned}</span>}
                              </span>
                            </div>
                          ))}
                          {plan.issue.ingredients.length === 0 && (
                            <p className="text-[10px] text-slate-400">No aggregated ingredients.</p>
                          )}
                        </div>
                      </div>

                      {/* Movements */}
                      {plan.movements.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-slate-100">
                          <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Ledger movements
                          </div>
                          <table className="w-full text-left">
                            <tbody>
                              {plan.movements.map((m) => (
                                <tr key={m.id} className="border-b border-slate-50">
                                  <td className="px-3 py-1.5 text-[10px] text-slate-500">
                                    {new Date(m.createdAt).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 py-1.5 text-[10px] font-semibold text-slate-600">
                                    {m.referenceType}
                                  </td>
                                  <td className="px-3 py-1.5 text-[10px] text-slate-600">{m.material ?? '—'}</td>
                                  <td className="px-3 py-1.5 text-[10px] font-mono text-slate-600">
                                    {m.quantity} {m.unitOfMeasure}
                                  </td>
                                  <td className="px-3 py-1.5 text-[10px] text-slate-400">{m.warehouse ?? '—'}</td>
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
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {activity?.summary && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi label="Events" value={activity.summary.total} sub="in range" />
              {Object.entries(activity.summary.byModule).map(([mod, count]) => (
                <Kpi key={mod} label={mod} value={count} sub="events" />
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
            {!activity || activity.rows.length === 0 ? (
              <EmptyState title="No ERP activity in range." hint="Adjust the filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3 font-semibold">When</th>
                      <th className="px-4 py-3 font-semibold">Module</th>
                      <th className="px-4 py-3 font-semibold">Event</th>
                      <th className="px-4 py-3 font-semibold">Detail</th>
                      <th className="px-4 py-3 font-semibold">Actor</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.rows.map((r) => (
                      <tr key={`${r.type}-${r.id}`} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-[10px] text-slate-500">
                          {new Date(r.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${moduleBadge[r.module] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {r.module}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[10px] font-semibold text-slate-600">{r.type}</td>
                        <td className="px-4 py-2.5 text-[10px] text-slate-600">
                          {r.description}
                          {r.detail && <span className="block text-[9px] text-slate-400">{r.detail}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-slate-500">{r.actor ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-[10px] font-mono text-slate-600">
                          {r.amount === null ? '—' : r.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#E9E9E9] bg-white p-4">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-xl font-bold text-[#171717]">{value}</p>
      {sub && <p className="mt-0.5 text-[9px] text-slate-400">{sub}</p>}
    </div>
  );
}
