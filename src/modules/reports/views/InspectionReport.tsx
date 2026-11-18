import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, FileText, Paperclip, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { DetailsModal, ViewButton, detailDate, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { formatNumber } from '../../../lib/format';

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
  PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  PASSED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  FAIL: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  FAILED: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  PENDING: 'bg-surface-3 text-ink-muted border-line',
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
  const [viewing, setViewing] = useState<ReportRow | null>(null);
  const [viewingAdjustment, setViewingAdjustment] = useState<AdjustmentRow | null>(null);

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
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Inspection Report</h2>
          <PageDescription>Every quality check the QC team carried out, across consignments and batch inspections.</PageDescription>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV(items)}
            disabled={items.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 h-9 text-xs font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 h-9 text-xs font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-4 md:grid-cols-5">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">To</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Result</label>
          <select
            value={filters.result}
            onChange={(e) => setFilters({ ...filters, result: e.target.value })}
            className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#EA4335]"
          >
            <option value="">All</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
        <div className="space-y-1 md:col-span-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Material or document"
              className="h-9 w-full rounded-lg border border-line pl-8 pr-2 text-xs focus:outline-none focus:border-[#EA4335]"
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
            className="h-9 rounded-lg border border-line px-3 text-xs font-semibold text-ink-muted hover:bg-surface-2"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="mb-1 text-[9px] font-semibold text-ink-muted">Total checks</p>
              <p className="text-2xl font-bold text-ink">{formatNumber(summary.totalChecks)}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="mb-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-300">Passed</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatNumber(summary.passed)}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
              <p className="mb-1 text-[9px] font-semibold text-rose-600 dark:text-rose-300">Failed</p>
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{formatNumber(summary.failed)}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-4">
              <p className="mb-1 text-[9px] font-semibold text-ink-muted">Pending</p>
              <p className="text-2xl font-bold text-ink-2">{formatNumber(summary.pending)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint">Sources</p>
              <div className="space-y-1 text-xs text-ink-muted">
                <div className="flex justify-between"><span>Consignment checks</span><b>{formatNumber(summary.consignmentChecks)}</b></div>
                <div className="flex justify-between"><span>Batch inspections</span><b>{formatNumber(summary.batchInspections)}</b></div>
                <div className="flex justify-between"><span>Quantity changes</span><b>{formatNumber(summary.quantityAdjustments)}</b></div>
                <div className="flex justify-between"><span>Pending approvals</span><b>{formatNumber(summary.pendingQuantityAdjustments)}</b></div>
              </div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 lg:col-span-2">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint">Checks by type</p>
              <div className="space-y-1.5">
                {topCheckTypes.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 truncate text-[11px] text-ink-muted">
                      {type.replace(/_/g, ' ')}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full bg-[#EA4335]"
                        style={{ width: `${summary.totalChecks ? (count / summary.totalChecks) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[11px] font-semibold text-ink-2">{formatNumber(count)}</span>
                  </div>
                ))}
                {topCheckTypes.length === 0 && <p className="text-xs text-ink-faint">No checks in range.</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 w-fit">
        <button
          onClick={() => setTab('checks')}
          className={`px-3 h-7 rounded-md text-[10px] font-semibold ${tab === 'checks' ? 'bg-[#EA4335] text-white' : 'text-ink-muted hover:bg-surface-2'}`}
        >
          Checks ({formatNumber(items.length)})
        </button>
        <button
          onClick={() => setTab('adjustments')}
          className={`px-3 h-7 rounded-md text-[10px] font-semibold ${tab === 'adjustments' ? 'bg-[#EA4335] text-white' : 'text-ink-muted hover:bg-surface-2'}`}
        >
          Quantity changes ({formatNumber(adjustments.length)})
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {loading ? (
          <TableSkeleton cols={7} rows={6} />
        ) : tab === 'checks' ? (
          items.length === 0 ? (
            <EmptyState title="No quality checks found." hint="Adjust the filters or date range." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Material</th>
                    <th className="px-4 py-3 font-semibold">Document</th>
                    <th className="px-4 py-3 font-semibold">Check</th>
                    <th className="px-4 py-3 font-semibold">Checked by</th>
                    <th className="px-4 py-3 font-semibold">Result</th>
                    <th className="px-4 py-3 font-semibold text-right">Proof</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={`${row.source}-${row.id}`} className="border-b border-line hover:bg-surface-2/50">
                      <td className="px-4 py-3 text-[11px] text-ink-muted">
                        {row.checkedAt ? new Date(row.checkedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-ink">{row.material?.name ?? '—'}</p>
                        <p className="text-[9px] font-mono text-ink-faint">{row.material?.sku ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-ink-muted">
                        <div className="max-w-[180px] truncate" title={row.document ?? '—'}>
                          {row.document ?? '—'}
                        </div>
                        <p className="text-[9px] text-ink-faint">{row.source === 'BATCH_INSPECTION' ? 'Batch inspection' : 'Consignment'}</p>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-ink-muted">
                        <div className="max-w-[180px] truncate" title={row.checkType.replace(/_/g, ' ')}>
                          {row.checkType.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-muted">{row.checkedBy ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${resultBadge[row.result] ?? resultBadge.PENDING}`}>
                          {row.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.attachmentCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#AA3BFF]">
                            <Paperclip className="h-3 w-3" /> {formatNumber(row.attachmentCount)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ViewButton onClick={() => setViewing(row)} />
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
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Requested</th>
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">Consignment</th>
                  <th className="px-4 py-3 font-semibold">Change</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">QC</th>
                  <th className="px-4 py-3 font-semibold">Head of QC</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((row) => (
                  <tr key={row.id} className="border-b border-line hover:bg-surface-2/50">
                    <td className="px-4 py-3 text-[11px] text-ink-muted">
                      {new Date(row.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-ink">{row.material?.name}</p>
                      <p className="text-[9px] font-mono text-ink-faint">{row.material?.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-ink-muted">{row.consignment?.consignmentNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-[11px] text-ink-muted">
                      {formatNumber(row.oldQuantity)} → <b>{formatNumber(row.newQuantity)}</b>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-ink-muted">{(row.reasonCode ?? '—').replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-[11px] text-ink-muted">{row.requestedBy?.fullName ?? '—'}</td>
                    <td className="px-4 py-3 text-[11px] text-ink-muted">{row.approvedBy?.fullName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                          row.status === 'APPROVED'
                            ? 'bg-emerald-600 text-white'
                            : row.status === 'REJECTED'
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-600 text-white'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ViewButton onClick={() => setViewingAdjustment(row)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[10px] text-ink-faint">
        <FileText className="h-3 w-3" />
        Includes consignment ingredient checks, GRN / finished-batch inspections and QC quantity changes.
        <ShieldCheck className="ml-1 h-3 w-3" />
      </p>

      {viewing && (
        <DetailsModal
          title={viewing.material?.name ?? viewing.checkType.replace(/_/g, ' ')}
          subtitle={viewing.document ?? (viewing.source === 'BATCH_INSPECTION' ? 'Batch inspection' : 'Consignment check')}
          status={{
            label: viewing.result,
            className: resultBadge[viewing.result] ?? resultBadge.PENDING,
          }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Inspection',
              fields: [
                { label: 'Source', value: viewing.source === 'BATCH_INSPECTION' ? 'Batch inspection' : 'Consignment check' },
                { label: 'Document', value: <span className="font-mono">{detailValue(viewing.document)}</span> },
                { label: 'Check type', value: viewing.checkType.replace(/_/g, ' ') },
                { label: 'Checked at', value: detailDate(viewing.checkedAt, true) },
              ],
            },
            {
              title: 'Material',
              fields: [
                { label: 'Material', value: detailValue(viewing.material?.name) },
                { label: 'SKU', value: <span className="font-mono text-[10px]">{detailValue(viewing.material?.sku)}</span> },
              ],
            },
            {
              title: 'Outcome',
              fields: [
                { label: 'Result', value: detailValue(viewing.result) },
                { label: 'Approval status', value: detailValue(viewing.approvalStatus) },
                { label: 'Checked by', value: detailValue(viewing.checkedBy) },
                { label: 'Attachments', value: formatNumber(viewing.attachmentCount) },
              ],
            },
            {
              title: 'Remarks',
              fields: [{ label: 'Remarks', value: detailValue(viewing.remarks), wide: true }],
            },
          ]}
        />
      )}

      {viewingAdjustment && (
        <DetailsModal
          title={viewingAdjustment.material?.name ?? 'Quantity change'}
          subtitle={viewingAdjustment.consignment?.consignmentNumber ?? undefined}
          status={{
            label: viewingAdjustment.status,
            className:
              viewingAdjustment.status === 'APPROVED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
                : viewingAdjustment.status === 'REJECTED'
                  ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
          }}
          onClose={() => setViewingAdjustment(null)}
          sections={[
            {
              title: 'Material',
              fields: [
                { label: 'Material', value: detailValue(viewingAdjustment.material?.name) },
                { label: 'SKU', value: <span className="font-mono text-[10px]">{detailValue(viewingAdjustment.material?.sku)}</span> },
                { label: 'Consignment', value: detailValue(viewingAdjustment.consignment?.consignmentNumber) },
                { label: 'Requested at', value: detailDate(viewingAdjustment.requestedAt, true) },
              ],
            },
            {
              title: 'Change',
              fields: [
                { label: 'Old quantity', value: formatNumber(viewingAdjustment.oldQuantity) },
                { label: 'New quantity', value: formatNumber(viewingAdjustment.newQuantity) },
                { label: 'Difference', value: formatNumber(viewingAdjustment.difference) },
                { label: 'Reason code', value: (viewingAdjustment.reasonCode ?? '—').replace('_', ' ') },
              ],
            },
            {
              title: 'Sign-off',
              fields: [
                { label: 'Requested by', value: detailValue(viewingAdjustment.requestedBy?.fullName) },
                { label: 'Head of QC', value: detailValue(viewingAdjustment.approvedBy?.fullName) },
                { label: 'Status', value: detailValue(viewingAdjustment.status) },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
