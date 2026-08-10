import { useEffect, useState } from 'react';
import { Boxes, ArrowRightLeft, SlidersHorizontal, History as HistoryIcon } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';

interface StockRow {
  materialId: string; materialName: string; sku: string; unitOfMeasure: string;
  batchLotId: string | null; batchNumber: string | null;
  warehouseId: string; warehouseName: string; binId: string | null; quantity: number;
}

interface HistoryEntry {
  id: string;
  eventType: string;
  quantity: string;
  unitOfMeasure: string;
  referenceType: string | null;
  notes: string | null;
  createdAt: string;
  material: { name: string; sku: string };
  batchLot: { batchNumber: string } | null;
  warehouse: { name: string };
  createdBy: { fullName: string | null; email: string | null };
  approvedBy: { fullName: string | null } | null;
}

const EVENT_LABEL: Record<string, string> = {
  RECEIPT: 'Goods Received',
  TRANSFER_OUT: 'Transfer Out',
  TRANSFER_IN: 'Transfer In',
  ADJUSTMENT: 'Adjustment',
  PRODUCTION_OUT: 'Consumed in Production',
  FINISHED_IN: 'Finished Goods In',
  WASTE: 'Waste',
};

export default function Inventory({ searchQuery = '' }: { searchQuery?: string }) {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // transfer modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [tr, setTr] = useState({ materialId: '', quantity: '', fromWarehouseId: '', toWarehouseId: '', unitOfMeasure: '' });
  // adjust modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [adj, setAdj] = useState({ materialId: '', quantity: '', warehouseId: '', unitOfMeasure: '', reason: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [stockRes, histRes, matRes, whRes] = await Promise.all([
        axiosClient.get<{ stock: StockRow[] }>('/inventory/stock'),
        axiosClient.get<{ history: HistoryEntry[] }>('/inventory/stock/history'),
        axiosClient.get<{ materials: any[] }>('/master-data/materials'),
        axiosClient.get<{ warehouses: any[] }>('/master-data/warehouses'),
      ]);
      setStock(stockRes.data.stock);
      setHistory(histRes.data.history);
      setMaterials(matRes.data.materials);
      setWarehouses(whRes.data.warehouses);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load inventory. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const doTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tr.materialId || !tr.quantity || !tr.fromWarehouseId || !tr.toWarehouseId) { setError('Complete all fields'); return; }
    try {
      await axiosClient.post('/inventory/stock/transfer', {
        materialId: tr.materialId, quantity: Number(tr.quantity),
        unitOfMeasure: materials.find((m) => m.id === tr.materialId)?.unitOfMeasure || 'units',
        fromWarehouseId: tr.fromWarehouseId, toWarehouseId: tr.toWarehouseId,
      });
      setShowTransfer(false);
      setTr({ materialId: '', quantity: '', fromWarehouseId: '', toWarehouseId: '', unitOfMeasure: '' });
      setError('');
      load();
    } catch (err: any) { setError(err?.response?.data?.error || 'Transfer failed'); }
  };

  const doAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adj.materialId || !adj.quantity || !adj.warehouseId) { setError('Complete all fields'); return; }
    try {
      const res = await axiosClient.post('/inventory/stock/adjustment', {
        materialId: adj.materialId, quantity: Number(adj.quantity),
        unitOfMeasure: materials.find((m) => m.id === adj.materialId)?.unitOfMeasure || 'units',
        warehouseId: adj.warehouseId, reason: adj.reason,
      });
      setShowAdjust(false);
      setError(res.data.requiresApproval ? 'Adjustment posted (flagged for approval).' : 'Adjustment posted.');
      setAdj({ materialId: '', quantity: '', warehouseId: '', unitOfMeasure: '', reason: '' });
      load();
    } catch (err: any) { setError(err?.response?.data?.error || 'Adjustment failed'); }
  };

  const filtered = stock.filter((s) =>
    s.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.batchNumber ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Inventory Ledger</h2>
          <p className="text-[#737373] text-xs">Derived stock — SUM of all ledger transactions per material/batch/location. No mutable stock columns.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTransfer(true)} className="btn-3d px-4 h-9 shrink-0">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap">
              <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" /> Transfer
            </span>
          </button>
          <button onClick={() => setShowAdjust(true)} className="btn-3d px-4 h-9 shrink-0">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap">
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" /> Adjustment
            </span>
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>}

      {/* 2. Stock table */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={5} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No stock yet" hint="Post a GRN to create ledger entries." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 font-semibold">Warehouse</th>
                  <th className="px-4 py-3 font-semibold text-right">Qty</th>
                  <th className="px-4 py-3 font-semibold">UoM</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0"><Boxes className="w-3.5 h-3.5 text-[#EA4335]" /></div>
                        <div>
                          <p className="text-xs font-bold text-[#171717] leading-none">{s.materialName}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-mono">{s.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.batchNumber ? <span className="text-[10px] font-mono text-slate-600">{s.batchNumber}</span> : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{s.warehouseName}</td>
                    <td className={`px-4 py-3 text-right text-sm font-bold ${s.quantity < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{s.quantity}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{s.unitOfMeasure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Ledger log list */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <HistoryIcon className="w-4 h-4 text-[#EA4335]" />
          <h3 className="text-xs font-bold text-[#171717]">Ledger Activity</h3>
          <span className="text-[9px] font-semibold text-slate-400 ml-auto">{history.length} entries</span>
        </div>
        {loading ? (
          <TableSkeleton cols={4} rows={6} hasAvatar={false} />
        ) : history.length === 0 ? (
          <EmptyState title="No ledger activity yet." hint="Receipts, transfers and adjustments will show up here." />
        ) : (
          <div className="divide-y divide-slate-50">
            {history.map((h) => {
              const qty = Number(h.quantity);
              const label = EVENT_LABEL[h.eventType] ?? h.eventType.replace(/_/g, ' ');
              return (
                <div key={h.id} className="flex items-start gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${qty < 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                    <HistoryIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-[#171717]">{label}</p>
                      <span className={`text-[10px] font-bold ${qty < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {qty > 0 ? '+' : ''}{qty} {h.unitOfMeasure}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {h.material.name} {h.batchLot ? `· Batch ${h.batchLot.batchNumber}` : ''} · {h.warehouse.name}
                    </p>
                    {h.notes && <p className="text-[10px] text-slate-400 mt-0.5">{h.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[9px] text-slate-400">{new Date(h.createdAt).toLocaleString()}</span>
                    <span className="text-[9px] text-slate-300">{h.createdBy.fullName || h.createdBy.email}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Transfer modal */}
      {showTransfer && (
        <Modal onClose={() => setShowTransfer(false)}>
          <form onSubmit={doTransfer} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#171717]">
                <ArrowRightLeft className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">Internal Transfer</h3>
              </div>
              <button type="button" onClick={() => setShowTransfer(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={tr.materialId} onChange={(e) => setTr({ ...tr, materialId: e.target.value })} className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335] md:col-span-2">
                <option value="">Material…</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
              </select>
              <select value={tr.fromWarehouseId} onChange={(e) => setTr({ ...tr, fromWarehouseId: e.target.value })} className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                <option value="">From warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select value={tr.toWarehouseId} onChange={(e) => setTr({ ...tr, toWarehouseId: e.target.value })} className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                <option value="">To warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <input value={tr.quantity} onChange={(e) => setTr({ ...tr, quantity: e.target.value })} type="number" placeholder="Quantity" className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowTransfer(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9"><span className="text-white text-xs font-semibold whitespace-nowrap">Transfer (2 entries)</span></button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Adjustment modal */}
      {showAdjust && (
        <Modal onClose={() => setShowAdjust(false)}>
          <form onSubmit={doAdjust} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#171717]">
                <SlidersHorizontal className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">Manual Adjustment</h3>
              </div>
              <button type="button" onClick={() => setShowAdjust(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="text-[11px] text-slate-500">Signed quantity: positive = add stock, negative = remove stock. All adjustments are recorded with the user id.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={adj.materialId} onChange={(e) => setAdj({ ...adj, materialId: e.target.value })} className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335] md:col-span-2">
                <option value="">Material…</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
              </select>
              <select value={adj.warehouseId} onChange={(e) => setAdj({ ...adj, warehouseId: e.target.value })} className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                <option value="">Warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <input value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value })} type="number" placeholder="Quantity (+/-)" className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              <input value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} placeholder="Reason" className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335] md:col-span-2" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAdjust(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9"><span className="text-white text-xs font-semibold whitespace-nowrap">Post Adjustment</span></button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
