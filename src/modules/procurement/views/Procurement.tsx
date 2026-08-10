import { useEffect, useState } from 'react';
import { FilePlus2, Plus, Send, Check, X, Truck } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface MaterialOption { id: string; name: string; sku: string; unitOfMeasure: string }
interface SupplierOption { id: string; name: string }

const reqStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
};
const poStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  SENT: 'bg-sky-50 text-sky-700 border-sky-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  RECEIVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function Procurement({ searchQuery = '' }: { searchQuery?: string }) {
  const [tab, setTab] = useState<'requisitions' | 'purchase-orders'>('requisitions');
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showReqForm, setShowReqForm] = useState(false);
  const [showPoForm, setShowPoForm] = useState(false);

  // Requisition form
  const [reqNotes, setReqNotes] = useState('');
  const [reqItems, setReqItems] = useState<{ materialId: string; quantity: string; unitOfMeasure: string }[]>([
    { materialId: '', quantity: '', unitOfMeasure: '' },
  ]);

  // PO form
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poRequisitionId, setPoRequisitionId] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poExpected, setPoExpected] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [matRes, supRes, reqRes, poRes] = await Promise.all([
        axiosClient.get<{ materials: MaterialOption[] }>('/master-data/materials'),
        axiosClient.get<{ suppliers: SupplierOption[] }>('/master-data/suppliers'),
        axiosClient.get<{ requisitions: any[] }>('/procurement/requisitions'),
        axiosClient.get<{ purchaseOrders: any[] }>('/procurement/purchase-orders'),
      ]);
      setMaterials(matRes.data.materials);
      setSuppliers(supRes.data.suppliers);
      setRequisitions(reqRes.data.requisitions);
      setPurchaseOrders(poRes.data.purchaseOrders);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load procurement data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredRequisitions = requisitions.filter((r) =>
    r.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.requestedBy?.fullName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredPos = purchaseOrders.filter((p) =>
    p.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.supplier?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = reqItems
      .filter((i) => i.materialId && i.quantity)
      .map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity), unitOfMeasure: i.unitOfMeasure }));
    if (items.length === 0) { setError('Add at least one item'); return; }
    try {
      await axiosClient.post('/procurement/requisitions', { notes: reqNotes, items });
      setShowReqForm(false);
      setReqItems([{ materialId: '', quantity: '', unitOfMeasure: '' }]);
      setReqNotes('');
      loadAll();
    } catch (err: any) { setError(err?.response?.data?.error || 'Failed to create requisition'); }
  };

  const updateRequisition = async (id: string, action: 'submit' | 'approve' | 'reject') => {
    try {
      await axiosClient.patch(`/procurement/requisitions/${id}/${action}`);
      loadAll();
    } catch (err: any) { setError(err?.response?.data?.error || 'Action failed'); }
  };

  const createPo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplierId) { setError('Select a supplier'); return; }
    try {
      const body: any = { supplierId: poSupplierId, notes: poNotes };
      if (poRequisitionId) body.requisitionId = poRequisitionId;
      if (poExpected) body.expectedDelivery = new Date(poExpected).toISOString();
      await axiosClient.post('/procurement/purchase-orders', body);
      setShowPoForm(false);
      setPoSupplierId(''); setPoRequisitionId(''); setPoNotes(''); setPoExpected('');
      loadAll();
    } catch (err: any) { setError(err?.response?.data?.error || 'Failed to create PO'); }
  };

  const updatePoStatus = async (id: string, status: string) => {
    try {
      await axiosClient.patch(`/procurement/purchase-orders/${id}/status`, { status });
      loadAll();
    } catch (err: any) { setError(err?.response?.data?.error || 'Status update failed'); }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Procurement</h2>
          <p className="text-[#737373] text-xs">Requisition → Approval → Purchase Order workflow.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => tab === 'requisitions' ? setShowReqForm(!showReqForm) : setShowPoForm(!showPoForm)}
            className="btn-3d px-4 h-9"
          >
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> {tab === 'requisitions' ? 'New Requisition' : 'New Purchase Order'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(['requisitions', 'purchase-orders'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 h-8 rounded-md text-xs font-semibold transition-colors ${tab === t ? 'bg-white shadow-sm text-[#171717]' : 'text-slate-500'}`}
          >
            {t === 'requisitions' ? 'Requisitions' : 'Purchase Orders'}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>}

      {/* 3a. Requisition form */}
      {tab === 'requisitions' && showReqForm && (
        <form onSubmit={createRequisition} className="bg-white border border-[#E9E9E9] rounded-xl p-4 space-y-3">
          {reqItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select
                value={item.materialId}
                onChange={(e) => setReqItems(reqItems.map((r, i) => i === idx ? { ...r, materialId: e.target.value, unitOfMeasure: materials.find((m) => m.id === e.target.value)?.unitOfMeasure || '' } : r))}
                className="h-9 md:col-span-2 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
              >
                <option value="">Select material…</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
              </select>
              <input
                value={item.quantity}
                onChange={(e) => setReqItems(reqItems.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))}
                placeholder="Quantity"
                type="number"
                className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
              />
              <div className="flex gap-2">
                <input value={item.unitOfMeasure} readOnly placeholder="UoM" className="h-9 flex-1 rounded-lg border border-[#E9E9E9] px-3 text-xs bg-slate-50" />
                {reqItems.length > 1 && (
                  <button type="button" onClick={() => setReqItems(reqItems.filter((_, i) => i !== idx))} className="h-9 w-9 rounded-lg border border-slate-200 text-slate-400 text-xs">✕</button>
                )}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => setReqItems([...reqItems, { materialId: '', quantity: '', unitOfMeasure: '' }])} className="h-8 px-3 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <FilePlus2 className="w-3 h-3" /> Add line
              </button>
              <input value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} placeholder="Notes" className="h-8 w-48 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowReqForm(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9"><span className="text-white text-xs font-semibold">Create (Draft)</span></button>
            </div>
          </div>
        </form>
      )}

      {/* 3b. PO form */}
      {tab === 'purchase-orders' && showPoForm && (
        <form onSubmit={createPo} className="bg-white border border-[#E9E9E9] rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)} className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
            <option value="">Select supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={poRequisitionId} onChange={(e) => setPoRequisitionId(e.target.value)} className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
            <option value="">Link from approved requisition…</option>
            {requisitions.filter((r) => r.status === 'APPROVED').map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}
          </select>
          <input value={poNotes} onChange={(e) => setPoNotes(e.target.value)} placeholder="Notes" className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
          <input value={poExpected} onChange={(e) => setPoExpected(e.target.value)} type="date" className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setShowPoForm(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
            <button type="submit" className="btn-3d px-4 h-9"><span className="text-white text-xs font-semibold">Create PO</span></button>
          </div>
        </form>
      )}

      {/* 4. Lists */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E9E9E9] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
                <Skeleton className="h-2 w-48" />
                <Skeleton className="h-2 w-64" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'requisitions' ? (
        <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
          {filteredRequisitions.length === 0 ? (
            <EmptyState title="No requisitions yet." />
          ) : (
            filteredRequisitions.map((r) => (
              <div key={r.id} className="border-b border-slate-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#171717]">{r.number}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${reqStatusBadge[r.status]}`}>{r.status}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">by {r.requestedBy?.fullName} · {r.items?.length} line(s)</p>
                  <p className="text-[10px] text-slate-500">
                    {r.items?.map((i: any) => `${i.material?.name} (${i.quantity} ${i.unitOfMeasure})`).join(', ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.status === 'DRAFT' && (
                    <button onClick={() => updateRequisition(r.id, 'submit')} className="h-8 px-3 rounded-lg border border-sky-200 text-sky-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-sky-50">
                      <Send className="w-3 h-3" /> Submit
                    </button>
                  )}
                  {r.status === 'PENDING_APPROVAL' && (
                    <>
                      <button onClick={() => updateRequisition(r.id, 'approve')} className="h-8 px-3 rounded-lg border border-emerald-200 text-emerald-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-emerald-50">
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => updateRequisition(r.id, 'reject')} className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-50">
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </>
                  )}
                  {r.purchaseOrders?.length > 0 && (
                    <span className="text-[10px] text-slate-400 self-center">→ {r.purchaseOrders.map((p: any) => p.number).join(', ')}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
          {filteredPos.length === 0 ? (
            <EmptyState title="No purchase orders yet." />
          ) : (
            filteredPos.map((p) => (
              <div key={p.id} className="border-b border-slate-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-xs font-bold text-[#171717]">{p.number}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${poStatusBadge[p.status]}`}>{p.status}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {p.supplier?.name} {p.requisition ? `· from ${p.requisition.number}` : ''} · {p.items?.length} line(s)
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {p.items?.map((i: any) => `${i.material?.name} × ${i.quantity}${i.receivedQty ? ` (recv ${i.receivedQty})` : ''}`).join(', ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {p.status === 'DRAFT' && (
                    <button onClick={() => updatePoStatus(p.id, 'SENT')} className="h-8 px-3 rounded-lg border border-sky-200 text-sky-600 text-[11px] font-semibold hover:bg-sky-50">Mark Sent</button>
                  )}
                  {['PARTIAL', 'RECEIVED'].includes(p.status) && (
                    <button onClick={() => updatePoStatus(p.id, 'CLOSED')} className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-semibold hover:bg-slate-50">Close PO</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
