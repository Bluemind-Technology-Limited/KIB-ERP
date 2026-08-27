import { useEffect, useState } from 'react';
import { Truck, Plus, Trash2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';

interface MaterialOption { id: string; name: string; sku: string; unitOfMeasure: string }
interface SupplierOption { id: string; name: string }

const poStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  SENT: 'bg-sky-50 text-sky-700 border-sky-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  RECEIVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function Procurements({ searchQuery = '' }: { searchQuery?: string }) {
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPoForm, setShowPoForm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createPoConfirmation, setCreatePoConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusConfirmation, setStatusConfirmation] = useState<{ id: string; status: string } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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
      const [matRes, supRes, poRes] = await Promise.all([
        axiosClient.get<{ materials: MaterialOption[] }>('/master-data/materials'),
        axiosClient.get<{ suppliers: SupplierOption[] }>('/master-data/suppliers'),
        axiosClient.get<{ purchaseOrders: any[] }>('/procurement/purchase-orders'),
      ]);
      setMaterials(matRes.data.materials);
      setSuppliers(supRes.data.suppliers);
      // Show all POs regardless of status
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

  const filteredPos = purchaseOrders.filter((p) =>
    p.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.supplier?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createPo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplierId) { setError('Select a supplier'); return; }
    if (poItems.length === 0) { setError('At least one item is required'); return; }
    setCreatePoConfirmation(true);
  };

  const confirmCreatePo = async () => {
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
    } catch (err: any) { 
      setError(err?.response?.data?.error || 'Failed to create PO'); 
      setCreatePoConfirmation(false); 
    }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setStatusConfirmation({ id, status: newStatus });
  };

  const confirmStatusChange = async () => {
    if (!statusConfirmation) return;
    setIsUpdatingStatus(true);
    try {
      await axiosClient.patch(`/procurement/purchase-orders/${statusConfirmation.id}/status`, { 
        status: statusConfirmation.status 
      });
      setStatusConfirmation(null);
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Status update failed');
      setStatusConfirmation(null);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const deletePurchaseOrder = async (id: string) => {
    setDeleteConfirmation({ id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/procurement/purchase-orders/${deleteConfirmation.id}`);
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
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Purchase Orders</h2>
          <p className="text-[#737373] text-xs">Create and manage purchase orders with suppliers.</p>
        </div>
        <div className="flex gap-2">
            <button
              onClick={() => setShowPoForm(!showPoForm)}
              className="btn-3d px-4 h-9"
            >
              <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
                <Plus className="w-3.5 h-3.5" /> New Purchase Order
              </span>
            </button>
          </div>
      </div>

      {/* 2. No tabs needed - only Purchase Orders */}

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>}

      {/* 3. New Purchase Order Modal */}
      {showPoForm && (
        <Modal onClose={() => setShowPoForm(false)}>
          <form onSubmit={createPo} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#171717]">
                <Truck className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">New Purchase Order</h3>
              </div>
              <button type="button" onClick={() => setShowPoForm(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Supplier *</label>
                <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">PO Items *</label>
                {poItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Add items below.</p>
                ) : (
                  <div className="space-y-2">
                    {poItems.map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500">
                            {item.materialName ? `${item.materialName} (${item.sku})` : `Item ${idx + 1}`}
                          </span>
                          <button type="button" onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 p-0.5">✕</button>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Material *</label>
                          <select
                            value={item.materialId}
                            onChange={(e) => setPoItems(poItems.map((r, i) => i === idx ? { ...r, materialId: e.target.value, materialName: materials.find((m) => m.id === e.target.value)?.name || '', sku: materials.find((m) => m.id === e.target.value)?.sku || '', unitOfMeasure: materials.find((m) => m.id === e.target.value)?.unitOfMeasure || '' } : r))}
                            className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                          >
                            <option value="">Select material…</option>
                            {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
                          </select>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Qty *</label>
                            <input 
                              value={item.quantity} 
                              onChange={(e) => setPoItems(poItems.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))} 
                              placeholder="Qty" 
                              type="number" 
                              className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]" 
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unit Cost *</label>
                            <input 
                              value={item.unitCost} 
                              onChange={(e) => setPoItems(poItems.map((r, i) => i === idx ? { ...r, unitCost: e.target.value } : r))} 
                              placeholder="Cost" 
                              type="number" 
                              className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]" 
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unit</label>
                            <input value={item.unitOfMeasure} readOnly placeholder="UoM" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs bg-slate-50" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button type="button" onClick={() => setPoItems([...poItems, { materialId: '', materialName: '', sku: '', quantity: '', unitOfMeasure: '', unitCost: '0' }])} className="w-full h-10 rounded-lg border-2 border-dashed border-slate-200 hover:border-[#EA4335]/50 hover:bg-rose-50/30 text-xs font-bold text-slate-400 hover:text-[#EA4335] transition-colors flex items-center justify-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expected delivery</label>
                <input value={poExpected} onChange={(e) => setPoExpected(e.target.value)} type="date" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</label>
                <textarea value={poNotes} onChange={(e) => setPoNotes(e.target.value)} rows={3} placeholder="Terms, delivery instructions…" className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowPoForm(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold whitespace-nowrap">Create PO</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Purchase Orders List */}
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
      ) : (
        <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
          {filteredPos.length === 0 ? (
            <EmptyState title="No purchase orders yet." />
          ) : (
            filteredPos.map((p) => (
              <div key={p.id} className="border-b border-slate-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 flex-1">
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
                    <>
                      <button onClick={() => handleStatusChange(p.id, 'SENT')} className="h-8 px-3 rounded-lg border border-sky-200 text-sky-600 text-[11px] font-semibold hover:bg-sky-50">Mark Sent</button>
                      <button onClick={() => deletePurchaseOrder(p.id)} className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-50">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </>
                  )}
                  {['PARTIAL', 'RECEIVED'].includes(p.status) && (
                    <button onClick={() => handleStatusChange(p.id, 'CLOSED')} className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-semibold hover:bg-slate-50">Close PO</button>
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
          title="Delete Purchase Order"
          description="This purchase order will be permanently deleted. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}

      {/* Status Change Confirmation Modal */}
      {statusConfirmation && (
        <ConfirmationModal
          type="action"
          title="Update Purchase Order Status"
          description={`This purchase order will be marked as ${statusConfirmation.status.toLowerCase()}.`}
          onConfirm={confirmStatusChange}
          onCancel={() => setStatusConfirmation(null)}
          isLoading={isUpdatingStatus}
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
