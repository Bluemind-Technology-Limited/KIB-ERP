import { useEffect, useState } from 'react';
import { Boxes, ArrowRightLeft, SlidersHorizontal, Search } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface StockRow {
  materialId: string; materialName: string; sku: string; unitOfMeasure: string;
  batchLotId: string | null; batchNumber: string | null;
  warehouseId: string; warehouseName: string; binId: string | null; quantity: number;
}

export default function Inventory({ searchQuery = '' }: { searchQuery?: string }) {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'stock' | 'transfer' | 'adjust'>('stock');

  // transfer
  const [tr, setTr] = useState({ materialId: '', quantity: '', fromWarehouseId: '', toWarehouseId: '', unitOfMeasure: '' });
  // adjust
  const [adj, setAdj] = useState({ materialId: '', quantity: '', warehouseId: '', unitOfMeasure: '', reason: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [stockRes, matRes, whRes] = await Promise.all([
        axiosClient.get<{ stock: StockRow[] }>('/inventory/stock'),
        axiosClient.get<{ materials: any[] }>('/master-data/materials'),
        axiosClient.get<{ warehouses: any[] }>('/master-data/warehouses'),
      ]);
      setStock(stockRes.data.stock);
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
      setTr({ materialId: '', quantity: '', fromWarehouseId: '', toWarehouseId: '', unitOfMeasure: '' });
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={searchQuery} readOnly placeholder="Search (use top bar)" className="pl-9 pr-3 h-9 rounded-lg border border-[#E9E9E9] bg-white text-xs text-[#171717] w-48 focus:outline-none" />
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>}

      {/* 2. Section switch */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          ['stock', 'Stock', Boxes],
          ['transfer', 'Transfer', ArrowRightLeft],
          ['adjust', 'Adjustment', SlidersHorizontal],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setSection(id)} className={`flex items-center gap-1.5 px-4 h-8 rounded-md text-xs font-semibold transition-colors ${section === id ? 'bg-white shadow-sm text-[#171717]' : 'text-slate-500'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* 3. Stock */}
      {section === 'stock' && (
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
      )}

      {/* 4. Transfer */}
      {section === 'transfer' && (
        <form onSubmit={doTransfer} className="bg-white border border-[#E9E9E9] rounded-xl p-5 space-y-4 max-w-2xl">
          <div className="flex items-center gap-2 text-[#171717]">
            <ArrowRightLeft className="w-4 h-4 text-[#EA4335]" />
            <h3 className="text-sm font-bold">Internal Transfer</h3>
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
            <div className="flex justify-end">
              <button type="submit" className="btn-3d px-4 h-9"><span className="text-white text-xs font-semibold">Transfer (2 ledger entries)</span></button>
            </div>
          </div>
        </form>
      )}

      {/* 5. Adjustment */}
      {section === 'adjust' && (
        <form onSubmit={doAdjust} className="bg-white border border-[#E9E9E9] rounded-xl p-5 space-y-4 max-w-2xl">
          <div className="flex items-center gap-2 text-[#171717]">
            <SlidersHorizontal className="w-4 h-4 text-[#EA4335]" />
            <h3 className="text-sm font-bold">Manual Adjustment</h3>
          </div>
          <p className="text-[11px] text-slate-500">Signed quantity: positive = add stock, negative = remove stock. All adjustments are gated and recorded with the user id.</p>
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
            <div className="flex justify-end">
              <button type="submit" className="btn-3d px-4 h-9"><span className="text-white text-xs font-semibold">Post Adjustment</span></button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
