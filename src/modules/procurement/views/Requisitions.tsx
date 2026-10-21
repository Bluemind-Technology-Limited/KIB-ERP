import { useEffect, useState } from 'react';
import { FilePlus2, Plus, Send, Trash2, Pencil, Eye, Loader2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { PageDescription } from '../../../components/ui/PageDescription';

const reqStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
};

interface SupplierDetail {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface MaterialOption {
  id: string;
  name: string;
  sku: string;
  unitOfMeasure: string;
  type: 'RAW' | 'PACKAGING' | 'FINISHED';
  suppliers?: Array<{ supplier: SupplierDetail }>;
}

interface RequisitionItem {
  id: string;
  materialId: string;
  quantity: string | number;
  unitOfMeasure: string;
  material?: MaterialOption;
}

interface RequisitionDetail {
  id: string;
  number: string;
  status: string;
  notes?: string | null;
  createdAt?: string;
  requestedBy?: { fullName?: string; email?: string };
  items: RequisitionItem[];
  purchaseOrders?: Array<{ id: string; number: string; status: string }>;
}

interface EditItem {
  materialId: string;
  quantity: string;
  unitOfMeasure: string;
}

const emptyItem = (): EditItem => ({ materialId: '', quantity: '', unitOfMeasure: '' });

function SupplierList({ suppliers }: { suppliers: SupplierDetail[] }) {
  if (suppliers.length === 0) {
    return <p className="text-[10px] text-amber-600">No supplier linked to this material yet.</p>;
  }
  return (
    <div className="space-y-1.5">
      {suppliers.map((s) => (
        <div key={s.id} className="text-[10px] leading-tight">
          <p className="font-semibold text-[#171717]">
            {s.name}
            {s.contactPerson && <span className="font-normal text-slate-500"> · {s.contactPerson}</span>}
          </p>
          {(s.email || s.phone) && (
            <p className="text-[9px] text-slate-400">
              {[s.email, s.phone].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Requisitions({ searchQuery = '' }: { searchQuery?: string }) {
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [requisitions, setRequisitions] = useState<RequisitionDetail[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Create form
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqNotes, setReqNotes] = useState('');
  const [reqItems, setReqItems] = useState<EditItem[]>([emptyItem()]);
  const [createReqConfirmation, setCreateReqConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);

  // View / edit modal
  const [selected, setSelected] = useState<RequisitionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [matRes, reqRes] = await Promise.all([
        axiosClient.get<{ materials: MaterialOption[] }>('/master-data/materials'),
        axiosClient.get<{ requisitions: RequisitionDetail[] }>('/procurement/requisitions'),
      ]);
      // Finished products are produced in-house, never requisitioned.
      setMaterials(matRes.data.materials.filter((m) => m.type !== 'FINISHED'));
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

  const filteredRequisitions = requisitions.filter(
    (r) =>
      r.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.requestedBy?.fullName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const materialFor = (materialId: string): MaterialOption | undefined =>
    materials.find((m) => m.id === materialId) ??
    selected?.items.find((i) => i.materialId === materialId)?.material;

  const suppliersFor = (materialId: string): SupplierDetail[] =>
    materialFor(materialId)?.suppliers?.map((s) => s.supplier) ?? [];

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  const createRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqItems.some((i) => i.materialId && i.quantity)) {
      setError('Add at least one item');
      return;
    }
    setCreateReqConfirmation(true);
  };

  const confirmCreateRequisition = async () => {
    const items = reqItems
      .filter((i) => i.materialId && i.quantity)
      .map((i) => ({
        materialId: i.materialId,
        quantity: Number(i.quantity),
        unitOfMeasure: i.unitOfMeasure,
      }));
    setSaving(true);
    try {
      const res = await axiosClient.post<{ requisition: RequisitionDetail }>(
        '/procurement/requisitions',
        { notes: reqNotes, items }
      );
      const created = res.data.requisition;
      setShowReqForm(false);
      setCreateReqConfirmation(false);
      setReqItems([emptyItem()]);
      setReqNotes('');
      setSelected(created);
      setEditItems(
        created.items.map((i) => ({
          materialId: i.materialId,
          quantity: String(i.quantity),
          unitOfMeasure: i.unitOfMeasure,
        }))
      );
      setEditNotes(created.notes ?? '');
      setDirty(false);
      setMode('edit');
      setError('');
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create requisition');
      setCreateReqConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Submit / delete
  // -------------------------------------------------------------------------

  const submitRequisition = async (id: string): Promise<boolean> => {
    try {
      await axiosClient.patch(`/procurement/requisitions/${id}/submit`);
      await loadAll();
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit requisition');
      return false;
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/procurement/requisitions/${deleteConfirmation.id}`);
      if (selected?.id === deleteConfirmation.id) setSelected(null);
      setDeleteConfirmation(null);
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete');
      setDeleteConfirmation(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // -------------------------------------------------------------------------
  // View / edit
  // -------------------------------------------------------------------------

  const openDetail = async (id: string, nextMode: 'view' | 'edit') => {
    setDetailLoading(true);
    setError('');
    try {
      const res = await axiosClient.get<{ requisition: RequisitionDetail }>(
        `/procurement/requisitions/${id}`
      );
      const r = res.data.requisition;
      setSelected(r);
      setEditItems(
        r.items.map((i) => ({
          materialId: i.materialId,
          quantity: String(i.quantity),
          unitOfMeasure: i.unitOfMeasure,
        }))
      );
      setEditNotes(r.notes ?? '');
      setDirty(false);
      setMode(nextMode === 'edit' && r.status === 'DRAFT' ? 'edit' : 'view');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load requisition details');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetailLoading(false);
    setEditItems([]);
    setEditNotes('');
    setDirty(false);
    setMode('view');
  };

  const startEdit = () => {
    if (!selected || selected.status !== 'DRAFT') return;
    setEditItems(
      selected.items.map((i) => ({
        materialId: i.materialId,
        quantity: String(i.quantity),
        unitOfMeasure: i.unitOfMeasure,
      }))
    );
    setEditNotes(selected.notes ?? '');
    setDirty(false);
    setMode('edit');
  };

  const cancelEdit = () => {
    if (selected) {
      setEditItems(
        selected.items.map((i) => ({
          materialId: i.materialId,
          quantity: String(i.quantity),
          unitOfMeasure: i.unitOfMeasure,
        }))
      );
      setEditNotes(selected.notes ?? '');
    }
    setDirty(false);
    setMode('view');
  };

  const updateEditItem = (idx: number, patch: Partial<EditItem>) => {
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    setDirty(true);
  };

  const selectEditMaterial = (idx: number, materialId: string) => {
    const unitOfMeasure = materials.find((m) => m.id === materialId)?.unitOfMeasure ?? '';
    updateEditItem(idx, { materialId, unitOfMeasure });
  };

  const addEditItem = () => {
    setEditItems((prev) => [...prev, emptyItem()]);
    setDirty(true);
  };

  const removeEditItem = (idx: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const validateEditItems = () => {
    if (editItems.length === 0) {
      setError('Add at least one item');
      return false;
    }
    if (editItems.some((it) => !it.materialId || !(Number(it.quantity) > 0) || !it.unitOfMeasure)) {
      setError('Every item needs a material and a quantity greater than zero');
      return false;
    }
    return true;
  };

  const saveDraft = async (): Promise<boolean> => {
    if (!selected || !validateEditItems()) return false;
    setSavingEdit(true);
    try {
      const res = await axiosClient.patch<{ requisition: RequisitionDetail }>(
        `/procurement/requisitions/${selected.id}/items`,
        {
          notes: editNotes,
          items: editItems.map((it) => ({
            materialId: it.materialId,
            quantity: Number(it.quantity),
            unitOfMeasure: it.unitOfMeasure,
          })),
        }
      );
      setSelected(res.data.requisition);
      setEditItems(
        res.data.requisition.items.map((i) => ({
          materialId: i.materialId,
          quantity: String(i.quantity),
          unitOfMeasure: i.unitOfMeasure,
        }))
      );
      setEditNotes(res.data.requisition.notes ?? '');
      setDirty(false);
      setError('');
      setMode('view');
      loadAll();
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save draft');
      return false;
    } finally {
      setSavingEdit(false);
    }
  };

  const submitSelected = async () => {
    if (!selected) return;
    const ok = await submitRequisition(selected.id);
    if (ok) setSelected(null);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Requisitions</h2>
          <PageDescription>Create, review and edit draft purchase requisitions.</PageDescription>
        </div>
        <button onClick={() => setShowReqForm(true)} className="btn-3d px-4 h-9 self-start md:self-auto">
          <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> New Requisition
          </span>
        </button>
      </div>

      {error && !selected && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

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

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-600">{error}</div>
            )}

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
                  {item.materialId && (
                    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Supplier</p>
                      <SupplierList suppliers={suppliersFor(item.materialId)} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Quantity *</label>
                      <input value={item.quantity} onChange={(e) => setReqItems(reqItems.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))} placeholder="e.g. 10" type="number" min="0" step="any" className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unit</label>
                      <input value={item.unitOfMeasure} readOnly placeholder="UoM" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs bg-slate-50" />
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" onClick={() => setReqItems([...reqItems, emptyItem()])} className="w-full h-10 rounded-lg border-2 border-dashed border-slate-200 hover:border-[#EA4335]/50 hover:bg-rose-50/30 text-xs font-bold text-slate-400 hover:text-[#EA4335] transition-colors flex items-center justify-center gap-1.5">
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

      {/* 3. Requisitions list (compact) */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E9E9E9] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
                <Skeleton className="h-2 w-56" />
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
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#171717]">{r.number}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${reqStatusBadge[r.status] ?? reqStatusBadge.DRAFT}`}>{r.status}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    by {r.requestedBy?.fullName ?? '—'} · {r.items?.length ?? 0} line(s)
                    {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openDetail(r.id, 'view')} className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-slate-50">
                    <Eye className="w-3 h-3" /> View
                  </button>
                  {r.status === 'DRAFT' && (
                    <>
                      <button onClick={() => openDetail(r.id, 'edit')} className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-slate-50">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => submitRequisition(r.id)} className="h-8 px-3 rounded-lg border border-sky-200 text-sky-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-sky-50">
                        <Send className="w-3 h-3" /> Submit
                      </button>
                      <button onClick={() => setDeleteConfirmation({ id: r.id })} className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-50">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </>
                  )}
                  {r.purchaseOrders && r.purchaseOrders.length > 0 && (
                    <span className="text-[10px] text-slate-400">→ {r.purchaseOrders.map((p) => p.number).join(', ')}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 4. Detail / edit modal */}
      {(detailLoading || selected) && (
        <Modal onClose={closeDetail}>
          <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            {detailLoading || !selected ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#171717]">{selected.number}</h3>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${reqStatusBadge[selected.status] ?? reqStatusBadge.DRAFT}`}>
                        {selected.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Requested by {selected.requestedBy?.fullName ?? '—'}
                      {selected.createdAt ? ` · ${new Date(selected.createdAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={closeDetail} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                {error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-600">{error}</div>
                )}

                {mode === 'view' ? (
                  <>
                    <div className="space-y-2">
                      {selected.items.map((item) => {
                        const material = item.material ?? materialFor(item.materialId);
                        return (
                          <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold text-[#171717]">{material?.name ?? item.materialId}</p>
                                <p className="text-[9px] font-mono text-slate-400">{material?.sku ?? ''}</p>
                              </div>
                              <p className="text-xs font-semibold text-[#171717] whitespace-nowrap">
                                {item.quantity} {item.unitOfMeasure}
                              </p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Supplier</p>
                              <SupplierList suppliers={material?.suppliers?.map((s) => s.supplier) ?? []} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selected.notes && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Notes</p>
                        <p className="text-[11px] text-slate-600 whitespace-pre-wrap">{selected.notes}</p>
                      </div>
                    )}

                    {selected.purchaseOrders && selected.purchaseOrders.length > 0 && (
                      <p className="text-[10px] text-slate-400">
                        Purchase orders: {selected.purchaseOrders.map((p) => p.number).join(', ')}
                      </p>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={closeDetail} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        Close
                      </button>
                      {selected.status === 'DRAFT' && (
                        <>
                          <button type="button" onClick={startEdit} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button type="button" onClick={submitSelected} className="h-9 px-4 rounded-lg border border-sky-200 text-sky-600 text-xs font-semibold hover:bg-sky-50 flex items-center gap-1">
                            <Send className="w-3 h-3" /> Submit
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      {editItems.map((item, idx) => {
                        const options = materials.filter(
                          (m) =>
                            m.id === item.materialId ||
                            !editItems.some((other, i) => i !== idx && other.materialId === m.id)
                        );
                        return (
                          <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500">Item {idx + 1}</span>
                              {editItems.length > 1 && (
                                <button type="button" onClick={() => removeEditItem(idx)} className="text-slate-300 hover:text-rose-500 p-0.5" title="Remove item">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Material *</label>
                              <select
                                value={item.materialId}
                                onChange={(e) => selectEditMaterial(idx, e.target.value)}
                                className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                              >
                                <option value="">Select material…</option>
                                {item.materialId && !options.some((m) => m.id === item.materialId) && (
                                  <option value={item.materialId}>
                                    {materialFor(item.materialId)?.name ?? item.materialId}
                                  </option>
                                )}
                                {options.map((m) => (
                                  <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
                                ))}
                              </select>
                            </div>
                            {item.materialId && (
                              <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Supplier</p>
                                <SupplierList suppliers={suppliersFor(item.materialId)} />
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Quantity *</label>
                                <input
                                  value={item.quantity}
                                  onChange={(e) => updateEditItem(idx, { quantity: e.target.value })}
                                  placeholder="e.g. 10"
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unit</label>
                                <input value={item.unitOfMeasure} readOnly placeholder="UoM" className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs bg-slate-50" />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={addEditItem}
                        className="w-full h-10 rounded-lg border-2 border-dashed border-slate-200 hover:border-[#EA4335]/50 hover:bg-rose-50/30 text-xs font-bold text-slate-400 hover:text-[#EA4335] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Item
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Notes</label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => {
                          setEditNotes(e.target.value);
                          setDirty(true);
                        }}
                        rows={3}
                        placeholder="Reason, urgency, etc."
                        className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={cancelEdit} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveDraft}
                        disabled={!dirty || savingEdit}
                        className="btn-3d px-4 h-9 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="flex items-center gap-1 text-white text-xs font-semibold">
                          {savingEdit && <Loader2 className="w-3 h-3 animate-spin" />}
                          Save Changes
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {/* 5. Confirmations */}
      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Delete Requisition"
          description="This draft requisition will be permanently deleted. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}

      {createReqConfirmation && (
        <ConfirmationModal
          type="create"
          title="Create Requisition"
          description="Create a new draft requisition with the specified items."
          onConfirm={confirmCreateRequisition}
          onCancel={() => setCreateReqConfirmation(false)}
          isLoading={saving}
        />
      )}
    </div>
  );
}
