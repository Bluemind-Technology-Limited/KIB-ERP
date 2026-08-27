import { useEffect, useState } from 'react';
import { FilePlus2, Plus, Send, Trash2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';

interface MaterialOption { id: string; name: string; sku: string; unitOfMeasure: string }

const reqStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
};

export default function Requisitions({ searchQuery = '' }: { searchQuery?: string }) {
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showReqForm, setShowReqForm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createReqConfirmation, setCreateReqConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);

  // Requisition form
  const [reqNotes, setReqNotes] = useState('');
  const [reqItems, setReqItems] = useState<{ materialId: string; quantity: string; unitOfMeasure: string }[]>([
    { materialId: '', quantity: '', unitOfMeasure: '' },
  ]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [matRes, reqRes] = await Promise.all([
        axiosClient.get<{ materials: MaterialOption[] }>('/master-data/materials'),
        axiosClient.get<{ requisitions: any[] }>('/procurement/requisitions'),
      ]);
      setMaterials(matRes.data.materials);
      // Show all requisitions for this user (DRAFT and PENDING_APPROVAL)
      setRequisitions(reqRes.data.requisitions);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load requisitions. Is the backend running?');
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
    } catch (err: any) { 
      setError(err?.response?.data?.error || 'Failed to create requisition'); 
      setCreateReqConfirmation(false); 
    }
    finally { setSaving(false); }
  };

  const submitRequisition = async (id: string) => {
    try {
      await axiosClient.patch(`/procurement/requisitions/${id}/submit`);
      loadAll();
    } catch (err: any) { setError(err?.response?.data?.error || 'Failed to submit requisition'); }
  };

  const deleteRequisition = async (id: string) => {
    setDeleteConfirmation({ id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/procurement/requisitions/${deleteConfirmation.id}`);
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
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Requisitions</h2>
          <p className="text-[#737373] text-xs">Create and manage your purchase requisitions.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReqForm(!showReqForm)}
            className="btn-3d px-4 h-9"
          >
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> New Requisition
            </span>
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>}

      {/* 2. New Requisition modal */}
      {showReqForm && (
        <Modal onClose={() => setShowReqForm(false)}>
          <form onSubmit={createRequisition} className="bg-white rounded-xl w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#171717]">
                <FilePlus2 className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">New Requisition</h3>
              </div>
              <button type="button" onClick={() => setShowReqForm(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-2">
              {reqItems.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500">Item {idx + 1}</span>
                    {reqItems.length > 1 && (
                      <button type="button" onClick={() => setReqItems(reqItems.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 p-0.5">✕</button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Material *</label>
                    <select
                      value={item.materialId}
                      onChange={(e) => setReqItems(reqItems.map((r, i) => i === idx ? { ...r, materialId: e.target.value, unitOfMeasure: materials.find((m) => m.id === e.target.value)?.unitOfMeasure || '' } : r))}
                      className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                    >
                      <option value="">Select material…</option>
                      {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Quantity *</label>
                      <input value={item.quantity} onChange={(e) => setReqItems(reqItems.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))} placeholder="e.g. 10" type="number" className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unit</label>
                      <input value={item.unitOfMeasure} readOnly placeholder="UoM" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs bg-slate-50" />
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" onClick={() => setReqItems([...reqItems, { materialId: '', quantity: '', unitOfMeasure: '' }])} className="w-full h-10 rounded-lg border-2 border-dashed border-slate-200 hover:border-[#EA4335]/50 hover:bg-rose-50/30 text-xs font-bold text-slate-400 hover:text-[#EA4335] transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Notes</label>
                <textarea value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} rows={3} placeholder="Reason, urgency, etc." className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowReqForm(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold whitespace-nowrap">Create (Draft)</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Requisitions List */}
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
                    <>
                      <button onClick={() => submitRequisition(r.id)} className="h-8 px-3 rounded-lg border border-sky-200 text-sky-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-sky-50">
                        <Send className="w-3 h-3" /> Submit
                      </button>
                      <button onClick={() => deleteRequisition(r.id)} className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-50">
                        <Trash2 className="w-3 h-3" /> Delete
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
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Delete Requisition"
          description="This requisition will be permanently deleted. This action cannot be undone."
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
    </div>
  );
}
