import { useEffect, useState } from 'react';
import { PackageCheck, Plus } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';

interface GrnData { id: string; number: string; status: string; receivedAt: string; po: { number: string; supplier: { name: string } } | null; receivedBy: { fullName: string } | null; items: any[] }

const grnStatusBadge: Record<string, string> = {
  PENDING_QA: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
};

export default function GRN({ searchQuery = '' }: { searchQuery?: string }) {
  const [grns, setGrns] = useState<GrnData[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [poId, setPoId] = useState('');
  const [grnNotes, setGrnNotes] = useState('');
  const [lines, setLines] = useState<{ materialId: string; batchNumber: string; quantity: string; unitOfMeasure: string; expiryDate: string; warehouseId: string }[]>([
    { materialId: '', batchNumber: '', quantity: '', unitOfMeasure: '', expiryDate: '', warehouseId: '' },
  ]);

  const load = async () => {
    setLoading(true);
    try {
      const [grnRes, poRes, whRes] = await Promise.all([
        axiosClient.get<{ grns: GrnData[] }>('/grn'),
        axiosClient.get<{ purchaseOrders: any[] }>('/procurement/purchase-orders'),
        axiosClient.get<{ warehouses: any[] }>('/master-data/warehouses'),
      ]);
      setGrns(grnRes.data.grns);
      setPos(poRes.data.purchaseOrders);
      setWarehouses(whRes.data.warehouses);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load GRN data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectPo = (id: string) => {
    setPoId(id);
    const po = pos.find((p) => p.id === id);
    if (po?.items) {
      setLines(po.items.map((i: any) => ({
        materialId: i.materialId,
        batchNumber: '',
        quantity: String(Number(i.quantity) - Number(i.receivedQty || 0)),
        unitOfMeasure: i.unitOfMeasure,
        expiryDate: '',
        warehouseId: '',
      })));
    }
  };

  const receive = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = lines
      .filter((l) => l.materialId && l.batchNumber && l.quantity && l.warehouseId)
      .map((l) => ({ ...l, quantity: Number(l.quantity) }));
    if (items.length === 0) { setError('Complete at least one line (batch, qty, warehouse)'); return; }
    try {
      await axiosClient.post('/grn', { poId, notes: grnNotes, items });
      setShowForm(false);
      setPoId(''); setGrnNotes(''); setLines([{ materialId: '', batchNumber: '', quantity: '', unitOfMeasure: '', expiryDate: '', warehouseId: '' }]);
      load();
    } catch (err: any) { setError(err?.response?.data?.error || 'Receive failed'); }
  };

  const filtered = grns.filter((g) =>
    g.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.po?.supplier?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Goods Receipt (GRN)</h2>
          <p className="text-[#737373] text-xs">Receive goods against a PO, assign batch numbers + expiry dates. Writes PO_RECEIPT ledger entries.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(!showForm)} className="btn-3d px-4 h-9">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Receive Goods</span>
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>}

      {/* 3. GRN table */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={4} rows={6} hasAvatar={false} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No goods receipts yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">GRN #</th>
                  <th className="px-4 py-3 font-semibold">PO / Supplier</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 font-semibold">Received</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-[#171717]">{g.number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-600">{g.po?.supplier?.name ?? '—'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{g.po?.number ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {(g.items ?? []).map((it: any) => (
                          <p key={it.id} className="text-[11px] text-slate-500">
                            {it.material?.name}
                            {it.batchLot?.batchNumber ? <span className="text-slate-400"> · {it.batchLot.batchNumber}</span> : ''}
                            <span className="text-slate-400"> × {it.quantity} {it.unitOfMeasure}</span>
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[11px] text-slate-500">{new Date(g.receivedAt).toLocaleDateString()}</p>
                      <p className="text-[10px] text-slate-400">{g.receivedBy?.fullName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${grnStatusBadge[g.status] || grnStatusBadge.PENDING_QA}`}>{g.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Receive Goods modal */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <form onSubmit={receive} data-lenis-prevent className="kib-scroll bg-white rounded-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#171717]">
                <PackageCheck className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">Receive Goods</h3>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <select value={poId} onChange={(e) => selectPo(e.target.value)} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                <option value="">Select purchase order…</option>
                {pos.filter((p) => p.status !== 'CLOSED').map((p) => (
                  <option key={p.id} value={p.id}>{p.number} — {p.supplier?.name} ({p.status})</option>
                ))}
              </select>
              <textarea
                value={grnNotes}
                onChange={(e) => setGrnNotes(e.target.value)}
                placeholder="Notes"
                rows={4}
                className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none"
              />
            </div>

            {lines.map((line, idx) => (
              <div key={idx} className="space-y-2 rounded-lg border border-slate-100 p-2">
                <span className="block text-[11px] font-semibold text-slate-600">{line.materialId ? pos.flatMap((p: any) => p.items ?? []).find((i: any) => i.materialId === line.materialId)?.material?.name : 'Material'}</span>
                <input
                  value={line.batchNumber}
                  onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, batchNumber: e.target.value } : l))}
                  placeholder="Batch #"
                  className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                />
                <input
                  value={line.quantity}
                  onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))}
                  placeholder="Qty"
                  type="number"
                  className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                />
                <input
                  value={line.expiryDate}
                  onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, expiryDate: e.target.value } : l))}
                  type="date"
                  className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                />
                <select
                  value={line.warehouseId}
                  onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, warehouseId: e.target.value } : l))}
                  className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="">Warehouse…</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            ))}

            <div className="flex justify-between items-center">
              <button type="button" onClick={() => setShowForm(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9">
                <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap"><PackageCheck className="w-3.5 h-3.5" /> Post Receipt + Ledger</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
