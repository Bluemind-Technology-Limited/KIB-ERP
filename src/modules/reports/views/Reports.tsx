import { useEffect, useState } from 'react';
import { BarChart3, DollarSign, Download, LineChart } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton, Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface EfficiencyRow {
  orderNumber: string;
  productName: string;
  sku: string;
  bomVersion: number;
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
  SCHEDULED: 'bg-slate-100 text-slate-600 border-slate-200',
  PROCESSING: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WASTED: 'bg-rose-50 text-rose-600 border-rose-200',
};

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
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
        r.bomVersion,
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
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Reports</h2>
          <p className="text-[#737373] text-xs">Production efficiency, yield analysis and inventory valuation with CSV export.</p>
        </div>
        <button
          onClick={tab === 'efficiency' ? exportEfficiency : exportValuation}
          className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50"
        >
          <span className="flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </span>
        </button>
      </div>

      {/* 2. Tabs */}
      <div className="flex gap-1 bg-white border border-[#E9E9E9] rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('efficiency')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === 'efficiency' ? 'bg-[#171717] text-white' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Production Efficiency
        </button>
        <button
          onClick={() => setTab('valuation')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === 'valuation' ? 'bg-[#171717] text-white' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <DollarSign className="w-3.5 h-3.5" /> Inventory Valuation
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#E9E9E9] rounded-xl px-4 py-3 space-y-2">
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
          <div className="bg-white border border-[#E9E9E9] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Orders</p>
            <p className="text-xl font-bold text-[#171717]">{efficiency.summary.totalOrders ?? 0}</p>
          </div>
          <div className="bg-white border border-[#E9E9E9] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed</p>
            <p className="text-xl font-bold text-[#171717]">{efficiency.summary.completedOrders ?? 0}</p>
          </div>
          <div className="bg-white border border-[#E9E9E9] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">In Progress</p>
            <p className="text-xl font-bold text-amber-600">{efficiency.summary.inProgress ?? 0}</p>
          </div>
          <div className="bg-white border border-[#E9E9E9] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Yield</p>
            <p className="text-xl font-bold text-emerald-600">{efficiency.summary.avgYieldPct ?? '—'}%</p>
          </div>
        </div>
      )}
      {!loading && tab === 'valuation' && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="bg-white border border-[#E9E9E9] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Materials</p>
            <p className="text-xl font-bold text-[#171717]">{valuation.summary.materials ?? 0}</p>
          </div>
          <div className="bg-white border border-[#E9E9E9] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Value</p>
            <p className="text-xl font-bold text-emerald-600">
              {valuation.summary.totalValue?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) ?? '$0.00'}
            </p>
          </div>
        </div>
      )}

      {/* 4. Tables */}
      {!loading && tab === 'efficiency' && (
        <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
          {effFiltered.length === 0 ? (
            <EmptyState title="No production orders yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 font-semibold">Order</th>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Target</th>
                    <th className="px-4 py-3 font-semibold text-right">Actual</th>
                    <th className="px-4 py-3 font-semibold text-right">Yield %</th>
                  </tr>
                </thead>
                <tbody>
                  {effFiltered.map((r) => (
                    <tr key={r.orderNumber} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-[11px] font-mono font-bold text-slate-600">{r.orderNumber}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-700">{r.productName}</p>
                        <p className="text-[9px] font-mono text-slate-400">{r.sku} · BOM v{r.bomVersion}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[r.status]}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-slate-500">{r.targetQuantity}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-slate-500">{r.actualYield ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {r.yieldPct !== null ? (
                          <span className={`text-xs font-bold font-mono ${r.yieldPct >= 95 ? 'text-emerald-600' : r.yieldPct >= 80 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {r.yieldPct}%
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
          )}
        </div>
      )}

      {!loading && tab === 'valuation' && (
        <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
          {valFiltered.length === 0 ? (
            <EmptyState title="No stock data yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 font-semibold">Material</th>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold text-right">On Hand</th>
                    <th className="px-4 py-3 font-semibold text-right">Unit Cost</th>
                    <th className="px-4 py-3 font-semibold text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {valFiltered.map((r) => (
                    <tr key={r.materialId} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                            <LineChart className="w-3.5 h-3.5 text-[#EA4335]" />
                          </div>
                          <p className="text-xs font-bold text-slate-700">{r.materialName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[10px] font-mono text-slate-500">{r.sku}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-slate-600">
                        {r.quantity} <span className="text-[9px] font-normal text-slate-400">{r.unitOfMeasure}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-slate-500">
                        {r.unitCost ? r.unitCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-bold text-emerald-600">
                        {r.value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
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
}
