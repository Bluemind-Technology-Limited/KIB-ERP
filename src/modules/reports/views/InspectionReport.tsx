import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, FileText, Paperclip, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface ReportRow {
  id: string;
  source: 'CONSIGNMENT_CHECK' | 'BATCH_INSPECTION';
  document: string | null;
  material: { name: string; sku: string } | null;
  checkType: string;
  result: string;
  remarks: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
  attachmentCount: number;
  approvalStatus: string | null;
}

interface AdjustmentRow {
  id: string;
  oldQuantity: string | number;
  newQuantity: string | number;
  difference: string | number;
  reasonCode?: string | null;
  status: string;
  requestedAt: string;
  material: { name: string; sku: string };
  requestedBy?: { fullName?: string } | null;
  approvedBy?: { fullName?: string } | null;
  consignment?: { consignmentNumber: string } | null;
}

interface ReportResponse {
  items: ReportRow[];
  adjustments: AdjustmentRow[];
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    pending: number;
    consignmentChecks: number;
    batchInspections: number;
    quantityAdjustments: number;
    pendingQuantityAdjustments: number;
    byCheckType: Record<string, number>;
    byInspector: Record<string, number>;
    byDay: Record<string, number>;
  };
  pagination: { page: number; limit: number; total: number; pages: number };
}

const resultBadge: Record<string, string> = {
  PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PASSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAIL: 'bg-rose-50 text-rose-600 border-rose-200',
  FAILED: 'bg-rose-50 text-rose-600 border-rose-200',
  PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
};

function downloadCSV(rows: ReportRow[]) {
  const header = ['Date', 'Source', 'Document', 'Material', 'SKU', 'Check Type', 'Result', 'Checked By', 'Proof', 'Remarks'];
  const body = rows.map((r) => [
    r.checkedAt ?? '',
    r.source,
    r.document ?? '',
    r.material?.name ?? '',
    r.material?.sku ?? '',
    r.checkType,
    r.result,
    r.checkedBy ?? '',
    String(r.attachmentCount),
    r.remarks ?? '',
  ]);
  const csv = [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `inspection-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function InspectionReport() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'checks' | 'adjustments'>('checks');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', result: '', q: '' });
  const [applied, setApplied] = useState(filters);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<ReportResponse>('/quality/inspections/report', {
        params: {
          dateFrom: applied.dateFrom || undefined,
          dateTo: applied.dateTo || undefined,
          result: applied.result || undefined,
          q: applied.q || undefined,
          limit: 200,
        },
      });
      setData(res.data);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load the inspection report');
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary;
  const items = data?.items ?? [];
  const adjustments = data?.adjustments ?? [];

  const topCheckTypes = useMemo(() => {
    if (!summary) return [] as [string, number][];
    return Object.entries(summary.byCheckType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [summary]);

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Inspection Report</h2>
          <p className="text-[#737373] text-xs">
            Every quality check the QC team carried out, across consignments and batch inspections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV(items)}
            disabled={items.length === 0}
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
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#E9E9E9] bg-white p-4 md:grid-cols-5">
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
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Result</label>
          <select
            value={filters.result}
            onChange={(e) => setFilters({ ...filters, result: e.target.value })}
            className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
          >
            <option value="">All</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
        <div className="space-y-1 md:col-span-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Material or document"
              className="h-9 w-full rounded-lg border border-[#E9E9E9] pl-8 pr-2 text-xs focus:outline-none focus:border-[#EA4335]"
            />
          </div>
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
              const cleared = { dateFrom: '', dateTo: '', result: '', q: '' };
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

      {/* Summary */}
      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-[#E9E9E9] bg-white p-4">
              <p className="mb-1 text-[9px] font-semibold text-slate-500">Total checks</p>
              <p className="text-2xl font-bold text-[#171717]">{summary.totalChecks}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-1 text-[9px] font-semibold text-emerald-600">Passed</p>
              <p className="text-2xl font-bold text-emerald-700">{summary.passed}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="mb-1 text-[9px] font-semibold text-rose-600">Failed</p>
              <p className="text-2xl font-bold text-rose-700">{summary.failed}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-1 text-[9px] font-semibold text-slate-500">Pending</p>
              <p className="text-2xl font-bold text-slate-700">{summary.pending}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-[#E9E9E9] bg-white p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Sources</p>
              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex justify-between"><span>Consignment checks</span><b>{summary.consignmentChecks}</b></div>
                <div className="flex justify-between"><span>Batch inspections</span><b>{summary.batchInspections}</b></div>
                <div className="flex justify-between"><span>Quantity changes</span><b>{summary.quantityAdjustments}</b></div>
                <div className="flex justify-between"><span>Pending approvals</span><b>{summary.pendingQuantityAdjustments}</b></div>
              </div>
            </div>
            <div className="rounded-xl border border-[#E9E9E9] bg-white p-4 lg:col-span-2">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Checks by type</p>
              <div className="space-y-1.5">
                {topCheckTypes.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 truncate text-[11px] text-slate-600">
                      {type.replace(/_/g, ' ')}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-[#EA4335]"
                        style={{ width: `${summary.totalChecks ? (count / summary.totalChecks) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[11px] font-semibold text-slate-700">{count}</span>
                  </div>
                ))}
                {topCheckTypes.length === 0 && <p className="text-xs text-slate-400">No checks in range.</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-[#E9E9E9] bg-white p-1 w-fit">
        <button
          onClick={() => setTab('checks')}
          className={`px-3 h-7 rounded-md text-[10px] font-semibold ${tab === 'checks' ? 'bg-[#EA4335] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Checks ({items.length})
        </button>
        <button
          onClick={() => setTab('adjustments')}
          className={`px-3 h-7 rounded-md text-[10px] font-semibold ${tab === 'adjustments' ? 'bg-[#EA4335] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          Quantity changes ({adjustments.length})
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
        {loading ? (
          <TableSkeleton cols={7} rows={6} />
        ) : tab === 'checks' ? (
          items.length === 0 ? (
            <EmptyState title="No quality checks found." hint="Adjust the filters or date range." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Material</th>
                    <th className="px-4 py-3 font-semibold">Document</th>
                    <th className="px-4 py-3 font-semibold">Check</th>
                    <th className="px-4 py-3 font-semibold">Checked by</th>
                    <th className="px-4 py-3 font-semibold">Result</th>
                    <th className="px-4 py-3 font-semibold text-right">Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={`${row.source}-${row.id}`} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {row.checkedAt ? new Date(row.checkedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-[#171717]">{row.material?.name ?? '—'}</p>
                        <p className="text-[9px] font-mono text-slate-400">{row.material?.sku ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-slate-500">
                        {row.document ?? '—'}
                        <p className="text-[9px] text-slate-400">{row.source === 'BATCH_INSPECTION' ? 'Batch inspection' : 'Consignment'}</p>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-slate-600">{row.checkType.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">{row.checkedBy ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded border px-2 py-0.5 text-[9px] font-bold ${resultBadge[row.result] ?? resultBadge.PENDING}`}>
                          {row.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.attachmentCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#AA3BFF]">
                            <Paperclip className="h-3 w-3" /> {row.attachmentCount}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : adjustments.length === 0 ? (
          <EmptyState title="No quantity changes found." hint="QC-proposed corrections appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Requested</th>
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">Consignment</th>
                  <th className="px-4 py-3 font-semibold">Change</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">QC</th>
                  <th className="px-4 py-3 font-semibold">Head of QC</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      {new Date(row.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-[#171717]">{row.material?.name}</p>
                      <p className="text-[9px] font-mono text-slate-400">{row.material?.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">{row.consignment?.consignmentNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-600">
                      {row.oldQuantity} → <b>{row.newQuantity}</b>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">{(row.reasonCode ?? '—').replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{row.requestedBy?.fullName ?? '—'}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{row.approvedBy?.fullName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded border px-2 py-0.5 text-[9px] font-bold ${
                          row.status === 'APPROVED'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : row.status === 'REJECTED'
                              ? 'border-rose-200 bg-rose-50 text-rose-600'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
        <FileText className="h-3 w-3" />
        Includes consignment ingredient checks, GRN / finished-batch inspections and QC quantity changes.
        <ShieldCheck className="ml-1 h-3 w-3" />
      </p>
    </div>
  );
}
