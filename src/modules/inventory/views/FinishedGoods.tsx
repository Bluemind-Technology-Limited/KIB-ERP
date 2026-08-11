import { useEffect, useState } from 'react';
import { PackageCheck, Truck } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';

interface FinishedGoodsRow {
  materialId: string;
  materialName: string;
  sku: string;
  unitOfMeasure: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  batchLotId: string;
  batchNumber: string;
  batchStatus: string;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  quantity: number;
  orderNumber: string | null;
}

interface Warehouse { id: string; name: string; code: string }

const batchStatusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  QUARANTINE: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
  EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function FinishedGoods({ searchQuery = '' }: { searchQuery?: string }) {
  const [rows, setRows] = useState<FinishedGoodsRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // dispatch modal
  const [dispatchRow, setDispatchRow] = useState<FinishedGoodsRow | null>(null);
  const [dispatchForm, setDispatchForm] = useState({ toWarehouseId: '', quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [fgRes, whRes] = await Promise.all([
        axiosClient.get<{ finishedGoods: FinishedGoodsRow[] }>('/inventory/finished-goods'),
        axiosClient.get<{ warehouses: Warehouse[] }>('/master-data/warehouses'),
      ]);
      setRows(fgRes.data.finishedGoods);
      setWarehouses(whRes.data.warehouses);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load finished goods. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDispatch = (row: FinishedGoodsRow) => {
    setDispatchRow(row);
    setDispatchForm({ toWarehouseId: '', quantity: '', notes: '' });
    setError('');
  };

  const submitDispatch = async () => {
    if (!dispatchRow) return;
    if (!dispatchForm.toWarehouseId || !dispatchForm.quantity) {
      setError('Destination warehouse and quantity are required');
      return;
    }
    if (dispatchForm.toWarehouseId === dispatchRow.warehouseId) {
      setError('Destination warehouse must differ from the source');
      return;
    }
    setSaving(true);
    try {
      await axiosClient.post('/inventory/stock/transfer', {
        materialId: dispatchRow.materialId,
        batchLotId: dispatchRow.batchLotId,
        quantity: Number(dispatchForm.quantity),
        unitOfMeasure: dispatchRow.unitOfMeasure,
        fromWarehouseId: dispatchRow.warehouseId,
        toWarehouseId: dispatchForm.toWarehouseId,
        notes: dispatchForm.notes || `Dispatch ${dispatchRow.batchNumber}`,
      });
      setDispatchRow(null);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Dispatch failed');
    } finally {
      setSaving(false);
    }
  };

  const filtered = rows.filter(
    (r) =>
      r.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.orderNumber ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Finished Goods</h2>
          <p className="text-[#737373] text-xs">QA-released finished product batches per warehouse, with dispatch via the ledger.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Finished Goods Table */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={8} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No finished goods stock yet." hint="Complete and QA-release a batch first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 font-semibold">Warehouse</th>
                  <th className="px-4 py-3 font-semibold">On Hand</th>
                  <th className="px-4 py-3 font-semibold">Expiry</th>
                  <th className="px-4 py-3 font-semibold">Batch Status</th>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={`${r.batchLotId}-${r.warehouseId}-${idx}`} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                          <PackageCheck className="w-3.5 h-3.5 text-[#EA4335]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#171717] leading-none">{r.materialName}</p>
                          <p className="text-[9px] font-mono text-slate-400 mt-0.5">{r.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono font-bold text-slate-600">{r.batchNumber}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{r.warehouseName} <span className="text-[9px] text-slate-400">({r.warehouseCode})</span></td>
                    <td className="px-4 py-3 text-xs font-mono font-bold text-slate-700">{r.quantity} <span className="text-[9px] font-normal text-slate-400">{r.unitOfMeasure}</span></td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      {r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${batchStatusBadge[r.batchStatus] ?? batchStatusBadge.ACTIVE}`}>{r.batchStatus}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.orderNumber ? (
                        <span className="text-[10px] font-mono text-slate-500">{r.orderNumber}</span>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.batchStatus === 'ACTIVE' && Number(r.quantity) > 0 && (
                        <button onClick={() => openDispatch(r)} className="btn-3d px-3 h-7">
                          <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                            <Truck className="w-3 h-3" /> Dispatch
                          </span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Dispatch Modal */}
      {dispatchRow && (
        <Modal onClose={() => setDispatchRow(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#171717]">Dispatch Finished Goods</h3>
              <button onClick={() => setDispatchRow(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-[11px] text-slate-500">
              <span className="font-mono font-bold text-slate-700">{dispatchRow.batchNumber}</span> — {dispatchRow.materialName} ·{' '}
              {dispatchRow.warehouseName} ({dispatchRow.quantity} {dispatchRow.unitOfMeasure} on hand)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destination Warehouse *</label>
                <select value={dispatchForm.toWarehouseId} onChange={(e) => setDispatchForm({ ...dispatchForm, toWarehouseId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                  <option value="">Select warehouse…</option>
                  {warehouses.filter((w) => w.id !== dispatchRow.warehouseId).map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quantity *</label>
                <input value={dispatchForm.quantity} onChange={(e) => setDispatchForm({ ...dispatchForm, quantity: e.target.value })} type="number" step="0.0001" placeholder={`Max ${dispatchRow.quantity}`} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</label>
                <textarea value={dispatchForm.notes} onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDispatchRow(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={submitDispatch} disabled={saving} className="btn-3d px-4 h-9">
                <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
                  <Truck className="w-3.5 h-3.5" /> {saving ? 'Dispatching…' : 'Dispatch'}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
