import { useEffect, useState } from 'react';
import { FilePlus2, Plus, Send, Check, X, Truck, Trash2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { PackQuantityPreview } from '../../../components/ui/PackQuantityPreview';
import { formatQty } from '../../../lib/format';

interface MaterialOption { id: string; name: string; sku: string; unitOfMeasure: string }
interface SupplierOption { id: string; name: string; vendorCode?: string }

const reqStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-600 text-white',
  PENDING_APPROVAL: 'bg-amber-600 text-white',
  APPROVED: 'bg-emerald-600 text-white',
  REJECTED: 'bg-rose-600 text-white',
};
const poStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-600 text-white',
  SENT: 'bg-sky-600 text-white',
  PARTIALLY_RECEIVED: 'bg-amber-600 text-white',
  RECEIVED: 'bg-emerald-600 text-white',
  CLOSED: 'bg-slate-600 text-white',
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
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'requisition' | 'po'; id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createReqConfirmation, setCreateReqConfirmation] = useState(false);
  const [createPoConfirmation, setCreatePoConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const [poItems, setPoItems] = useState<Array<{
    materialId: string;
    materialName: string;
    sku: string;
    quantity: string;
    originalQuantity?: number;
    unitOfMeasure: string;
    unitCost: string;
  }>>([]);

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
    setCreateReqConfirmation(true);
  };

  const confirmCreateRequisition = async () => {
    const items = reqItems
      .filter((i) => i.materialId && i.quantity)
      .map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity), unitOfMeasure: i.unitOfMeasure }));
    setSaving(true);
    try {
      await axiosClient.post('/procurement/requisitions', { notes: reqNotes, items });
      setShowReqForm(false);
      setCreateReqConfirmation(false);
      setReqItems([{ materialId: '', quantity: '', unitOfMeasure: '' }]);
      setReqNotes('');
      loadAll();
    } catch (err: any) { setError(err?.response?.data?.error || 'Failed to create requisition'); setCreateReqConfirmation(false); }
    finally { setSaving(false); }
  };

  const updateRequisition = async (id: string, action: 'submit' | 'approve' | 'reject') => {
    try {
      await axiosClient.patch(`/procurement/requisitions/${id}/${action}`);
      loadAll();
    } catch (err: any) { setError(err?.response?.data?.error || 'Action failed'); }
  };

  const handleRequisitionChange = (reqId: string) => {
    setPoRequisitionId(reqId);
    if (!reqId) {
      setPoItems([]);
      return;
    }
    const r = requisitions.find((req) => req.id === reqId);
    if (r && r.items) {
      setPoItems(r.items.map((it: any) => ({
        materialId: it.materialId,
        materialName: it.material?.name || it.materialId,
        sku: it.material?.sku || '',
        quantity: String(it.quantity),
        originalQuantity: it.quantity,
        unitOfMeasure: it.unitOfMeasure,
        unitCost: '0'
      })));
    }
  };

  const createPo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplierId) { setError('Select a supplier'); return; }
    if (poItems.length === 0) { setError('At least one item is required'); return; }
    setCreatePoConfirmation(true);
  };

  const confirmCreatePo = async () => {
    const supplier = suppliers.find((s) => s.id === poSupplierId);
    if (!supplier?.vendorCode?.trim()) {
      setError(`Supplier " ${supplier?.name ?? poSupplierId}" has no vendor code. Add it in Master Data → Suppliers before raising this PO.`);
      setCreatePoConfirmation(false);
      return;
    }
    setSaving(true);
    try {
      const body: any = { 
        supplierId: poSupplierId, 
        notes: poNotes,
        items: poItems.map((it) => ({
          materialId: it.materialId,
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost || 0),
          unitOfMeasure: it.unitOfMeasure
        }))
      };
      if (poRequisitionId) body.requisitionId = poRequisitionId;
      if (poExpected) body.expectedDelivery = new Date(poExpected).toISOString();
      await axiosClient.post('/procurement/purchase-orders', body);
      setShowPoForm(false);
      setCreatePoConfirmation(false);
      setPoSupplierId(''); setPoRequisitionId(''); setPoNotes(''); setPoExpected(''); setPoItems([]);
      loadAll();
    } catch (err: any) { setError(err?.response?.data?.error || 'Failed to create PO'); setCreatePoConfirmation(false); }
    finally { setSaving(false); }
  };

  const updatePoStatus = async (id: string, status: string) => {
    try {
      await axiosClient.patch(`/procurement/purchase-orders/${id}/status`, { status });
      loadAll();
    } catch (err: any) { setError(err?.response?.data?.error || 'Status update failed'); }
  };

  const deleteRequisition = async (id: string) => {
    setDeleteConfirmation({ type: 'requisition', id });
  };

  const deletePurchaseOrder = async (id: string) => {
    setDeleteConfirmation({ type: 'po', id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      if (deleteConfirmation.type === 'requisition') {
        await axiosClient.delete(`/procurement/requisitions/${deleteConfirmation.id}`);
      } else {
        await axiosClient.delete(`/procurement/purchase-orders/${deleteConfirmation.id}`);
      }
      setDeleteConfirmation(null);
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete');
      setDeleteConfirmation(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Procurement</h2>
          <PageDescription>Requisition → Approval → Purchase Order workflow.</PageDescription>
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
      <div className="flex gap-1 bg-surface-3 rounded-lg p-1 w-fit">
        {(['requisitions', 'purchase-orders'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 h-8 rounded-md text-xs font-semibold transition-colors ${tab === t ? 'bg-surface shadow-sm text-ink' : 'text-ink-muted'}`}
          >
            {t === 'requisitions' ? 'Requisitions' : 'Purchase Orders'}
          </button>
        ))}
      </div>

      {error && <div className="relative z-9999 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}

      {/* 3a. New Requisition modal */}
      {showReqForm && (
        <Modal onClose={() => setShowReqForm(false)}>
          <form onSubmit={createRequisition} className="bg-surface rounded-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink">
                <FilePlus2 className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">New Requisition</h3>
              </div>
              <button type="button" onClick={() => setShowReqForm(false)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            <div className="space-y-2">
              {reqItems.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-line bg-surface-2/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-ink-muted">Item {idx + 1}</span>
                    {reqItems.length > 1 && (
                      <button type="button" onClick={() => setReqItems(reqItems.filter((_, i) => i !== idx))} className="text-ink-faint hover:text-rose-500 p-0.5">✕</button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Material *</label>
                    <select
                      value={item.materialId}
                      onChange={(e) => setReqItems(reqItems.map((r, i) => i === idx ? { ...r, materialId: e.target.value, unitOfMeasure: materials.find((m) => m.id === e.target.value)?.unitOfMeasure || '' } : r))}
                      className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                    >
                      <option value="">Select material…</option>
                      {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Quantity *</label>
                      <input value={item.quantity} onChange={(e) => setReqItems(reqItems.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))} placeholder="e.g. 10" type="number" className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#EA4335]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Unit</label>
                      <input value={item.unitOfMeasure} readOnly placeholder="UoM" className="h-9 w-full rounded-lg border border-line px-2 text-xs bg-surface-2" />
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" onClick={() => setReqItems([...reqItems, { materialId: '', quantity: '', unitOfMeasure: '' }])} className="w-full h-10 rounded-lg border-2 border-dashed border-line hover:border-[#EA4335]/50 hover:bg-rose-50/30 text-xs font-bold text-ink-faint hover:text-[#EA4335] transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Notes</label>
                <textarea value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} rows={3} placeholder="Reason, urgency, etc." className="w-full rounded-lg border border-line px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => setShowReqForm(false)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold whitespace-nowrap">Create (Draft)</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showPoForm && (
        <Modal onClose={() => setShowPoForm(false)}>
          <form onSubmit={createPo} className="bg-surface rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink">
                <Truck className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">New Purchase Order</h3>
              </div>
              <button type="button" onClick={() => setShowPoForm(false)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Supplier *</label>
                <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)} className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">From approved requisition (optional)</label>
                <select value={poRequisitionId} onChange={(e) => handleRequisitionChange(e.target.value)} className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                  <option value="">None — create standalone</option>
                  {requisitions.filter((r) => r.status === 'APPROVED').map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}
                </select>
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-2 border-t border-line">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">PO Items *</label>
                {poItems.length === 0 ? (
                  <p className="text-xs text-ink-faint italic">Select a requisition or add items manually below.</p>
                ) : (
                  <div className="space-y-2">
                    {poItems.map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-line bg-surface-2/40 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-ink-muted">
                            {item.materialName ? `${item.materialName} ( ${item.sku})` : `Item ${idx + 1}`}
                          </span>
                          {!poRequisitionId && (
                            <button type="button" onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))} className="text-ink-faint hover:text-rose-500 p-0.5">✕</button>
                          )}
                        </div>
                        
                        {!poRequisitionId && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Material *</label>
                            <select
                              value={item.materialId}
                              onChange={(e) => setPoItems(poItems.map((r, i) => i === idx ? { ...r, materialId: e.target.value, materialName: materials.find((m) => m.id === e.target.value)?.name || '', sku: materials.find((m) => m.id === e.target.value)?.sku || '', unitOfMeasure: materials.find((m) => m.id === e.target.value)?.unitOfMeasure || '' } : r))}
                              className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                            >
                              <option value="">Select material…</option>
                              {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
                            </select>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">
                              Qty {item.originalQuantity !== undefined && `(Req: ${item.originalQuantity})`} *
                            </label>
                            <input 
                              value={item.quantity} 
                              onChange={(e) => setPoItems(poItems.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))} 
                              placeholder="Qty" 
                              type="number" 
                              min="0.0001"
                              step="any"
                              className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#EA4335]" 
                              required
                            />
                            <PackQuantityPreview quantity={item.quantity} unit={item.unitOfMeasure} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Cost per {item.unitOfMeasure || 'unit'} *</label>
                            <input 
                              value={item.unitCost} 
                              onChange={(e) => setPoItems(poItems.map((r, i) => i === idx ? { ...r, unitCost: e.target.value } : r))} 
                              placeholder="Cost" 
                              type="number" 
                              className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#EA4335]" 
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Unit</label>
                            <input value={item.unitOfMeasure} readOnly placeholder="UoM" className="h-9 w-full rounded-lg border border-line px-2 text-xs bg-surface-2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!poRequisitionId && (
                  <button type="button" onClick={() => setPoItems([...poItems, { materialId: '', materialName: '', sku: '', quantity: '', unitOfMeasure: '', unitCost: '0' }])} className="w-full h-10 rounded-lg border-2 border-dashed border-line hover:border-[#EA4335]/50 hover:bg-rose-50/30 text-xs font-bold text-ink-faint hover:text-[#EA4335] transition-colors flex items-center justify-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Expected delivery</label>
                <input value={poExpected} onChange={(e) => setPoExpected(e.target.value)} type="date" className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Notes</label>
                <textarea value={poNotes} onChange={(e) => setPoNotes(e.target.value)} rows={3} placeholder="Terms, delivery instructions…" className="w-full rounded-lg border border-line px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => setShowPoForm(false)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold whitespace-nowrap">Create PO</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Lists */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface border border-line rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
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
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {filteredRequisitions.length === 0 ? (
            <EmptyState title="No requisitions yet." />
          ) : (
            filteredRequisitions.map((r) => (
              <div key={r.id} className="border-b border-line p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-ink">{r.number}</span>
                    <span className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider  ${reqStatusBadge[r.status]}`}>{r.status}</span>
                  </div>
                  <p className="text-[10px] text-ink-faint">by {r.requestedBy?.fullName} · {r.items?.length} line(s)</p>
                  <p className="text-[10px] text-ink-muted">
                    {r.items?.map((i: any) => `${i.material?.name} ( ${formatQty(i.quantity, i.unitOfMeasure)})`).join(', ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.status === 'DRAFT' && (
                    <>
                      <button onClick={() => updateRequisition(r.id, 'submit')} className="h-8 px-3 rounded-lg border border-sky-200 text-sky-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-sky-50 dark:border-sky-500/30 dark:text-sky-300 dark:hover:bg-sky-500/10">
                        <Send className="w-3 h-3" /> Submit
                      </button>
                      <button onClick={() => deleteRequisition(r.id)} className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </>
                  )}
                  {r.status === 'PENDING_APPROVAL' && (
                    <>
                      <button onClick={() => updateRequisition(r.id, 'approve')} className="h-8 px-3 rounded-lg border border-emerald-200 text-emerald-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10">
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button onClick={() => updateRequisition(r.id, 'reject')} className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10">
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </>
                  )}
                  {r.purchaseOrders?.length > 0 && (
                    <span className="text-[10px] text-ink-faint self-center">→ {r.purchaseOrders.map((p: any) => p.number).join(', ')}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {filteredPos.length === 0 ? (
            <EmptyState title="No purchase orders yet." />
          ) : (
            filteredPos.map((p) => (
              <div key={p.id} className="border-b border-line p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-ink-faint" />
                    <span className="font-mono text-xs font-bold text-ink">{p.number}</span>
                    <span className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider  ${poStatusBadge[p.status]}`}>{p.status}</span>
                  </div>
                  <p className="text-[10px] text-ink-faint">
                    {p.supplier?.name} {p.requisition ? `· from ${p.requisition.number}` : ''} · {p.items?.length} line(s)
                  </p>
                  <p className="text-[10px] text-ink-muted">
                    {p.items?.map((i: any) => `${i.material?.name} × ${i.quantity}${i.receivedQty ? ` (recv ${i.receivedQty})` : ''}`).join(', ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {p.status === 'DRAFT' && (
                    <>
                      <button onClick={() => updatePoStatus(p.id, 'SENT')} className="h-8 px-3 rounded-lg border border-sky-200 text-sky-600 text-[11px] font-semibold hover:bg-sky-50 dark:border-sky-500/30 dark:text-sky-300 dark:hover:bg-sky-500/10">Mark Sent</button>
                      <button onClick={() => deletePurchaseOrder(p.id)} className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </>
                  )}
                  {['PARTIALLY_RECEIVED', 'RECEIVED'].includes(p.status) && (
                    <button onClick={() => updatePoStatus(p.id, 'CLOSED')} className="h-8 px-3 rounded-lg border border-line text-ink-muted text-[11px] font-semibold hover:bg-surface-2">Close PO</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title={deleteConfirmation.type === 'requisition' ? 'Delete Requisition' : 'Delete Purchase Order'}
          description={`This ${deleteConfirmation.type === 'requisition' ? 'requisition' : 'purchase order'} will be permanently deleted. This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}

      {/* Create Requisition Confirmation Modal */}
      {createReqConfirmation && (
        <ConfirmationModal
          type="create"
          title="Create Requisition"
          description="Create a new purchase requisition with the specified items."
          onConfirm={confirmCreateRequisition}
          onCancel={() => setCreateReqConfirmation(false)}
          isLoading={saving}
        />
      )}

      {/* Create Purchase Order Confirmation Modal */}
      {createPoConfirmation && (
        <ConfirmationModal
          type="create"
          title="Create Purchase Order"
          description="Create a new purchase order with the specified items and supplier."
          onConfirm={confirmCreatePo}
          onCancel={() => setCreatePoConfirmation(false)}
          isLoading={saving}
        />
      )}
    </div>
  );
}
