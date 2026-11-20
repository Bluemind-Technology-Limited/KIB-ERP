import { useEffect, useState } from 'react';
import { BarChart3, Download, LineChart, Wallet2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton, Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { DetailsModal, ViewButton, detailDate, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { formatMoney, formatNumber, formatPercent, formatQty } from '../../../lib/format';

interface EfficiencyRow {
  orderNumber: string;
  productName: string;
  sku: string;
  status: string;
  targetQuantity: number;
  actualYield: number | null;
  yieldPct: number | null;
  completedAt?: string | null;
}

interface ValuationRow {
  materialId: string;
  materialName: string;
  sku: string;
  unitOfMeasure: string;
  quantity: number;
  unitCost: number;
  value: number;
}

const statusBadge: Record<string, string> = {
  SCHEDULED: 'bg-slate-600 text-white',
  PROCESSING: 'bg-amber-600 text-white',
  COMPLETED: 'bg-emerald-600 text-white',
  WASTED: 'bg-rose-600 text-white',
};

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `" ${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports({ searchQuery = '' }: { searchQuery?: string }) {
  const [tab, setTab] = useState<'efficiency' | 'valuation'>('efficiency');
  const [efficiency, setEfficiency] = useState<{ rows: EfficiencyRow[]; summary: any }>({ rows: [], summary: {} });
  const [valuation, setValuation] = useState<{ rows: ValuationRow[]; summary: any }>({ rows: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<EfficiencyRow | null>(null);
  const [viewingValuation, setViewingValuation] = useState<ValuationRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [effRes, valRes] = await Promise.all([
        axiosClient.get<{ rows: EfficiencyRow[]; summary: any }>('/reports/production-efficiency'),
        axiosClient.get<{ rows: ValuationRow[]; summary: any }>('/reports/inventory-valuation'),
      ]);
      setEfficiency(effRes.data);
      setValuation(valRes.data);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load reports. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const effFiltered = efficiency.rows.filter(
    (r) =>
      r.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const valFiltered = valuation.rows.filter(
    (r) =>
      r.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportEfficiency = () =>
    downloadCSV(
      'production-efficiency.csv',
      ['Order', 'Product', 'SKU', 'BOM v', 'Status', 'Target', 'Actual', 'Yield %', 'Completed'],
      effFiltered.map((r) => [
        r.orderNumber,
        r.productName,
        r.sku,
        r.productName,
        r.status,
        r.targetQuantity,
        r.actualYield ?? '',
        r.yieldPct ?? '',
        r.completedAt ? new Date(r.completedAt).toLocaleDateString() : '',
      ])
    );

  const exportValuation = () =>
    downloadCSV(
      'inventory-valuation.csv',
      ['Material', 'SKU', 'UoM', 'Quantity', 'Unit Cost', 'Value'],
      valFiltered.map((r) => [r.materialName, r.sku, r.unitOfMeasure, r.quantity, r.unitCost, r.value])
    );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Reports</h2>
          <PageDescription>Production efficiency, yield analysis and inventory valuation with CSV export.</PageDescription>
        </div>
        <button
          onClick={tab === 'efficiency' ? exportEfficiency : exportValuation}
          className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted bg-surface hover:bg-surface-2"
        >
          <span className="flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </span>
        </button>
      </div>

      {/* 2. Tabs */}
      <div className="flex gap-1 bg-surface border border-line rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('efficiency')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === 'efficiency' ? 'bg-inverted text-inverted-ink' : 'text-ink-muted hover:text-ink-2'}`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Production Efficiency
        </button>
        <button
          onClick={() => setTab('valuation')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === 'valuation' ? 'bg-inverted text-inverted-ink' : 'text-ink-muted hover:text-ink-2'}`}
        >
          <Wallet2 className="w-3.5 h-3.5" /> Inventory Valuation
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>
      )}

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-line rounded-xl px-4 py-3 space-y-2">
                <Skeleton className="h-2 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
          <TableSkeleton cols={6} rows={6} hasAvatar={false} />
        </div>
      )}

      {/* 3. Summary chips */}
      {!loading && tab === 'efficiency' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface border border-line rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Total Orders</p>
            <p className="text-xl font-bold text-ink">{formatNumber(efficiency.summary.totalOrders ?? 0)}</p>
          </div>
          <div className="bg-surface border border-line rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Completed</p>
            <p className="text-xl font-bold text-ink">{formatNumber(efficiency.summary.completedOrders ?? 0)}</p>
          </div>
          <div className="bg-surface border border-line rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">In Progress</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-300">{formatNumber(efficiency.summary.inProgress ?? 0)}</p>
          </div>
          <div className="bg-surface border border-line rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Avg Yield</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300">
              {efficiency.summary.avgYieldPct == null ? '—' : formatPercent(efficiency.summary.avgYieldPct)}
            </p>
          </div>
        </div>
      )}
      {!loading && tab === 'valuation' && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="bg-surface border border-line rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Materials</p>
            <p className="text-xl font-bold text-ink">{formatNumber(valuation.summary.materials ?? 0)}</p>
          </div>
          <div className="bg-surface border border-line rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Total Value</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300">
              {formatMoney(valuation.summary.totalValue)}
            </p>
          </div>
        </div>
      )}

      {/* 4. Tables */}
      {!loading && tab === 'efficiency' && (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {effFiltered.length === 0 ? (
            <EmptyState title="No production orders yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                    <th className="px-4 py-3 font-semibold">Order</th>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Target</th>
                    <th className="px-4 py-3 font-semibold text-right">Actual</th>
                    <th className="px-4 py-3 font-semibold text-right">Yield %</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {effFiltered.map((r) => (
                    <tr key={r.orderNumber} className="border-b border-line hover:bg-surface-2/50">
                      <td className="px-4 py-3 text-[11px] font-mono font-bold text-ink-muted">{r.orderNumber}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-ink-2 max-w-[180px] truncate" title={r.productName}>{r.productName}</p>
                        <p className="text-[9px] font-mono text-ink-faint">{r.sku}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider  ${statusBadge[r.status]}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-ink-muted">{formatNumber(r.targetQuantity)}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-ink-muted">
                        {r.actualYield == null ? '—' : formatNumber(r.actualYield)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.yieldPct !== null ? (
                          <span className={`text-xs font-bold font-mono ${r.yieldPct >= 95 ? 'text-emerald-600 dark:text-emerald-300' : r.yieldPct >= 80 ? 'text-amber-600 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}`}>
                            {formatPercent(r.yieldPct)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ViewButton onClick={() => setViewing(r)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'valuation' && (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {valFiltered.length === 0 ? (
            <EmptyState title="No stock data yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                    <th className="px-4 py-3 font-semibold">Material</th>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold text-right">On Hand</th>
                    <th className="px-4 py-3 font-semibold text-right">Unit Cost</th>
                    <th className="px-4 py-3 font-semibold text-right">Value</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {valFiltered.map((r) => (
                    <tr key={r.materialId} className="border-b border-line hover:bg-surface-2/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                            <LineChart className="w-3.5 h-3.5 text-[#EA4335]" />
                          </div>
                          <p className="text-xs font-bold text-ink-2 max-w-[180px] truncate" title={r.materialName}>{r.materialName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[10px] font-mono text-ink-muted">{r.sku}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-ink-muted">
                        {formatQty(r.quantity, r.unitOfMeasure)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-ink-muted">
                        {r.unitCost ? formatMoney(r.unitCost) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-bold text-emerald-600 dark:text-emerald-300">
                        {formatMoney(r.value)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ViewButton onClick={() => setViewingValuation(r)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewing && (
        <DetailsModal
          title={viewing.productName}
          subtitle={viewing.orderNumber}
          status={{
            label: viewing.status,
            className: statusBadge[viewing.status] ?? 'bg-slate-600 text-white',
          }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Order',
              fields: [
                { label: 'Order number', value: <span className="font-mono">{detailValue(viewing.orderNumber)}</span> },
                { label: 'Product', value: detailValue(viewing.productName) },
                { label: 'SKU', value: <span className="font-mono text-[10px]">{detailValue(viewing.sku)}</span> },
                { label: 'Completed', value: detailDate(viewing.completedAt, true) },
              ],
            },
            {
              title: 'Output',
              fields: [
                { label: 'Target quantity', value: formatNumber(viewing.targetQuantity) },
                { label: 'Actual yield', value: viewing.actualYield == null ? '—' : formatNumber(viewing.actualYield) },
                {
                  label: 'Yield %',
                  value: viewing.yieldPct === null ? '—' : formatPercent(viewing.yieldPct),
                },
                { label: 'Status', value: detailValue(viewing.status) },
              ],
            },
          ]}
        />
      )}

      {viewingValuation && (
        <DetailsModal
          title={viewingValuation.materialName}
          subtitle={viewingValuation.sku}
          onClose={() => setViewingValuation(null)}
          sections={[
            {
              title: 'Material',
              fields: [
                { label: 'Material', value: detailValue(viewingValuation.materialName), wide: true },
                { label: 'SKU', value: <span className="font-mono text-[10px]">{detailValue(viewingValuation.sku)}</span> },
                { label: 'Unit of measure', value: detailValue(viewingValuation.unitOfMeasure) },
              ],
            },
            {
              title: 'Stock value',
              fields: [
                { label: 'On hand', value: formatQty(viewingValuation.quantity, viewingValuation.unitOfMeasure) },
                {
                  label: 'Unit cost',
                  value: viewingValuation.unitCost ? formatMoney(viewingValuation.unitCost) : '—',
                },
                {
                  label: 'Total value',
                  value: formatMoney(viewingValuation.value),
                  wide: true,
                },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
