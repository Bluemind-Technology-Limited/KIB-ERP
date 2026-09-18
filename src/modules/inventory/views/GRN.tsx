import { useEffect, useState } from 'react';
import { PackageCheck, Plus, Trash2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';

interface GrnData { id: string; number: string; status: string; receivedAt: string; po: { number: string; supplier: { name: string } } | null; receivedBy: { fullName: string } | null; items: any[] }

const grnStatusBadge: Record<string, string> = {
  PENDING_QA: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
};

/** SOP KIB/QCA/010 — what still has to be filled in before a lot code can be built. */
const MISSING_LABELS: Record<string, string> = {
  vendorCode: 'a vendor code on the supplier',
  ingredientCode: 'a traceability code on the material',
  setNumber: 'a set number',
  yearCode: 'the year',
};

interface GrnLine {
  materialId: string;
  materialName: string;
  batchNumber: string;
  quantity: string;
  unitOfMeasure: string;
  expiryDate: string;
  warehouseId: string;
  setNumber: string;
  supplierBatchNumber: string;
}

interface LotPreviewItem {
  materialId: string;
  materialName: string;
  materialSku: string;
  setNumber: number;
  lotCode: string | null;
  missing: string[];
}

const emptyLine = (): GrnLine => ({
  materialId: '', materialName: '', batchNumber: '', quantity: '', unitOfMeasure: '',
  expiryDate: '', warehouseId: '', setNumber: '', supplierBatchNumber: '',
});

export default function GRN({ searchQuery = '' }: { searchQuery?: string }) {
  const [grns, setGrns] = useState<GrnData[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [poId, setPoId] = useState('');
  const [grnNotes, setGrnNotes] = useState('');
  const [lines, setLines] = useState<GrnLine[]>([emptyLine()]);
  const [lotPreviews, setLotPreviews] = useState<Record<string, LotPreviewItem>>({});
  const [supplierName, setSupplierName] = useState('');
  const [submitConfirmation, setSubmitConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ grnId: string; grnNumber: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const selectPo = async (id: string) => {
    setPoId(id);
    setLotPreviews({});
    setSupplierName('');

    if (!id) {
      setLines([emptyLine()]);
      return;
    }

    const po = pos.find((p) => p.id === id);
    setSupplierName(po?.supplier?.name ?? '');

    const base: GrnLine[] = (po?.items ?? []).map((i: any) => ({
      ...emptyLine(),
      materialId: i.materialId,
      quantity: String(Number(i.quantity) - Number(i.receivedQty || 0)),
      unitOfMeasure: i.unitOfMeasure,
    }));
    setLines(base);

    // Lot codes come from the server so the UI never reimplements the format.
    try {
      const res = await axiosClient.get<{ items: LotPreviewItem[] }>('/grn/lot-preview', {
        params: { poId: id },
      });
      const map: Record<string, LotPreviewItem> = {};
      for (const item of res.data.items) map[item.materialId] = item;
      setLotPreviews(map);
      setLines(
        base.map((l) => ({
          ...l,
          setNumber: map[l.materialId] ? String(map[l.materialId].setNumber) : '',
        }))
      );
    } catch {
      // Leave the preview blank — the server still builds the code on submit.
    }
  };

  /** A line is postable when it has a material, a quantity, a warehouse and
   *  either a generated lot code or a manually typed batch number. */
  const lineIsComplete = (l: GrnLine) =>
    Boolean(l.materialId && l.quantity && l.warehouseId && (l.batchNumber || lotPreviews[l.materialId]?.lotCode));

  const buildItems = () =>
    lines.filter(lineIsComplete).map((l) => ({
      materialId: l.materialId,
      quantity: Number(l.quantity),
      unitOfMeasure: l.unitOfMeasure,
      batchNumber: l.batchNumber || undefined,
      expiryDate: l.expiryDate || undefined,
      warehouseId: l.warehouseId,
      setNumber: l.setNumber === '' ? undefined : Number(l.setNumber),
      supplierBatchNumber: l.supplierBatchNumber || undefined,
    }));

  const receive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poId) { setError('Select a purchase order first'); return; }
    if (buildItems().length === 0) { setError('Complete at least one line (qty, warehouse)'); return; }
    setSubmitConfirmation(true);
  };

  const confirmReceive = async () => {
    setSaving(true);
    try {
      await axiosClient.post('/grn', { poId, notes: grnNotes, items: buildItems() }, {
        toast: { success: 'Goods received and posted to stock' },
      });
      setShowForm(false);
      setPoId(''); setGrnNotes(''); setLines([emptyLine()]); setLotPreviews({}); setSupplierName('');
      setSubmitConfirmation(false);
      load();
    } catch (err: any) { setError(err?.response?.data?.error || 'Receive failed'); setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirmation) return;
    setDeleting(true);
    try {
      await axiosClient.delete(`/grn/${deleteConfirmation.grnId}`);
      setDeleteConfirmation(null);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete GRN');
      setDeleteConfirmation(null);
    } finally {
      setDeleting(false);
    }
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
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
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
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteConfirmation({ grnId: g.id, grnNumber: g.number })}
                        className="text-slate-300 hover:text-rose-600 transition-colors p-1.5"
                        title="Delete GRN"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
          <form onSubmit={receive} className="bg-white rounded-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
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

            {lines.map((line, idx) => {
              const preview = lotPreviews[line.materialId];
              return (
                <div key={idx} className="space-y-2 rounded-lg border border-slate-100 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold text-slate-600">
                        {preview?.materialName || line.materialName || 'Material'}
                      </span>
                      {preview?.materialSku && (
                        <span className="block text-[9px] font-mono text-slate-400">{preview.materialSku}</span>
                      )}
                    </div>
                    {supplierName && (
                      <span className="shrink-0 text-right text-[9px] text-slate-400">{supplierName}</span>
                    )}
                  </div>

                  {/* Lot code — always shown beside the ingredient and supplier names it belongs to. */}
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Lot Code</span>
                    {preview?.lotCode ? (
                      <span className="block font-mono text-xs font-bold text-[#171717]">{preview.lotCode}</span>
                    ) : (
                      <span className="block text-[10px] text-amber-600">
                        {preview?.missing?.length
                          ? `Add ${preview.missing.map((m) => MISSING_LABELS[m] ?? m).join(', ')} to generate a lot code`
                          : 'Select a purchase order to generate a lot code'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={line.setNumber}
                      onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, setNumber: e.target.value } : l))}
                      placeholder="Set no."
                      type="number"
                      min={1}
                      className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                    />
                    <input
                      value={line.supplierBatchNumber}
                      onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, supplierBatchNumber: e.target.value } : l))}
                      placeholder="Supplier batch #"
                      className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                    />
                  </div>

                  {/* Only needed while the master-data codes are still missing. */}
                  {!preview?.lotCode && (
                    <input
                      value={line.batchNumber}
                      onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, batchNumber: e.target.value } : l))}
                      placeholder="Batch # (until codes are set)"
                      className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                    />
                  )}

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
                    min={new Date().toISOString().split('T')[0]}
                    className="h-8 w-full rounded-lg border border-[#E9E9E9] px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                    required
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
              );
            })}

            <div className="flex justify-between items-center">
              <button type="button" onClick={() => setShowForm(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9">
                <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap"><PackageCheck className="w-3.5 h-3.5" /> Post Receipt + Ledger</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {submitConfirmation && (
        <ConfirmationModal
          type="submit"
          title="Post Receipt + Ledger"
          description="Post this goods receipt to update stock levels and create QA inspection records?"
          onConfirm={confirmReceive}
          onCancel={() => setSubmitConfirmation(false)}
          isLoading={saving}
          confirmText="Post Receipt"
        />
      )}

      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Delete GRN"
          description={`Delete GRN ${deleteConfirmation.grnNumber}? This will remove all items and inspection records. This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={deleting}
          confirmText="Delete"
        />
      )}
    </div>
  );
}
