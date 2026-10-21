import { useEffect, useState } from 'react';
import { Check, X, Eye, Plus, Trash2, Loader2 } from 'lucide-react';
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

export default function RequisitionActions({ searchQuery = '' }: { searchQuery?: string }) {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<RequisitionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionConfirmation, setActionConfirmation] = useState<'approve' | 'reject' | null>(null);

  const loadRequisitions = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ requisitions: any[] }>('/procurement/requisitions');
      // Filter: only PENDING_APPROVAL
      const filtered = res.data.requisitions.filter((r) => r.status === 'PENDING_APPROVAL');
      setRequisitions(filtered);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load requisitions. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequisitions();
  }, []);

  // Materials for the "add item" picker — finished products are never requisitioned.
  useEffect(() => {
    axiosClient
      .get<{ materials: MaterialOption[] }>('/master-data/materials')
      .then((res) => setMaterials(res.data.materials.filter((m) => m.type !== 'FINISHED')))
      .catch(() => {});
  }, []);

  const filteredRequisitions = requisitions.filter((r) =>
    r.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.requestedBy?.fullName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const materialFor = (materialId: string): MaterialOption | undefined =>
    materials.find((m) => m.id === materialId) ??
    selected?.items.find((i) => i.materialId === materialId)?.material;

  const suppliersFor = (materialId: string) =>
    materialFor(materialId)?.suppliers?.map((s) => s.supplier) ?? [];

  const markDirty = () => setDirty(true);

  const updateItem = (idx: number, patch: Partial<EditItem>) => {
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    markDirty();
  };

  const selectMaterial = (idx: number, materialId: string) => {
    const unitOfMeasure = materials.find((m) => m.id === materialId)?.unitOfMeasure ?? '';
    updateItem(idx, { materialId, unitOfMeasure });
  };

  const addItem = () => {
    setEditItems((prev) => [...prev, { materialId: '', quantity: '', unitOfMeasure: '' }]);
    markDirty();
  };

  const removeItem = (idx: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
    markDirty();
  };

  const openReview = async (id: string) => {
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
    setActionConfirmation(null);
  };

  const validateItems = () => {
    if (editItems.length === 0) {
      setError('Add at least one item');
      return false;
    }
    if (
      editItems.some(
        (it) => !it.materialId || !(Number(it.quantity) > 0) || !it.unitOfMeasure
      )
    ) {
      setError('Every item needs a material and a quantity greater than zero');
      return false;
    }
    return true;
  };

  const saveItems = async (): Promise<boolean> => {
    if (!selected || !validateItems()) return false;
    setSaving(true);
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
      setDirty(false);
      setError('');
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save requisition changes');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAction = (action: 'approve' | 'reject') => {
    // Rejecting does not need valid line items; editing only matters for approval.
    if (action === 'approve' && !validateItems()) return;
    setActionConfirmation(action);
  };

  const confirmAction = async () => {
    if (!selected || !actionConfirmation) return;
    setIsProcessing(true);
    try {
      if (dirty && actionConfirmation === 'approve') {
        const saved = await saveItems();
        if (!saved) {
          setActionConfirmation(null);
          return;
        }
      }
      await axiosClient.patch(
        `/procurement/requisitions/${selected.id}/${actionConfirmation}`
      );
      setActionConfirmation(null);
      closeDetail();
      loadRequisitions();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Action failed');
      setActionConfirmation(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const canEdit =
    selected?.status === 'PENDING_APPROVAL' &&
    (selected?.purchaseOrders?.length ?? 0) === 0;

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Requisition Approvals</h2>
          <PageDescription>Review, adjust and approve pending requisitions.</PageDescription>
        </div>
      </div>

      {error && !selected && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Requisitions List */}
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
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
          {filteredRequisitions.length === 0 ? (
            <EmptyState title="No pending requisitions." />
          ) : (
            filteredRequisitions.map((r) => (
              <div key={r.id} className="border-b border-slate-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#171717]">{r.number}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${reqStatusBadge[r.status]}`}>{r.status}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Requested by: {r.requestedBy?.fullName} · {r.items?.length} line(s)</p>
                  <p className="text-[10px] text-slate-500 mb-2">
                    {r.items?.map((i: any) => `${i.material?.name} (${i.quantity} ${i.unitOfMeasure})`).join(', ')}
                  </p>
                  {r.notes && <p className="text-[9px] text-slate-500 italic">Notes: {r.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openReview(r.id)}
                    className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-slate-50"
                  >
                    <Eye className="w-3 h-3" /> Review
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. Review / Edit modal */}
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

                <div className="space-y-2">
                  {editItems.map((item, idx) => {
                    const materialSuppliers = suppliersFor(item.materialId);
                    const options = materials.filter(
                      (m) =>
                        m.id === item.materialId ||
                        !editItems.some((other, i) => i !== idx && other.materialId === m.id)
                    );

                    return (
                      <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500">Item {idx + 1}</span>
                          {canEdit && editItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-slate-300 hover:text-rose-500 p-0.5"
                              title="Remove item"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Material *</label>
                          {canEdit ? (
                            <select
                              value={item.materialId}
                              onChange={(e) => selectMaterial(idx, e.target.value)}
                              className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                            >
                              <option value="">Select material…</option>
                              {options.map((m) => (
                                <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-xs text-[#171717]">{materialFor(item.materialId)?.name ?? item.materialId}</p>
                          )}
                        </div>

                        {item.materialId && (
                          <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Supplier</p>
                            {materialSuppliers.length === 0 ? (
                              <p className="text-[10px] text-amber-600">No supplier linked to this material yet.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {materialSuppliers.map((s) => (
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
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Quantity *</label>
                            <input
                              value={item.quantity}
                              readOnly={!canEdit}
                              onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                              placeholder="e.g. 10"
                              type="number"
                              min="0"
                              step="any"
                              className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#EA4335] read-only:bg-slate-50"
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

                  {canEdit && (
                    <button
                      type="button"
                      onClick={addItem}
                      className="w-full h-10 rounded-lg border-2 border-dashed border-slate-200 hover:border-[#EA4335]/50 hover:bg-rose-50/30 text-xs font-bold text-slate-400 hover:text-[#EA4335] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Item
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Notes</label>
                  <textarea
                    value={editNotes}
                    readOnly={!canEdit}
                    onChange={(e) => {
                      setEditNotes(e.target.value);
                      markDirty();
                    }}
                    rows={3}
                    placeholder="Reason, urgency, etc."
                    className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335] resize-none read-only:bg-slate-50"
                  />
                </div>

                {selected.purchaseOrders && selected.purchaseOrders.length > 0 && (
                  <p className="text-[10px] text-amber-600">
                    A purchase order already exists for this requisition; editing is locked.
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={saveItems}
                        disabled={!dirty || saving}
                        className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction('reject')}
                        disabled={saving || isProcessing}
                        className="h-9 px-4 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 disabled:opacity-40 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction('approve')}
                        disabled={saving || isProcessing}
                        className="h-9 px-4 rounded-lg border border-emerald-200 text-emerald-600 text-xs font-semibold hover:bg-emerald-50 disabled:opacity-40 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Approve
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* 4. Approve / Reject confirmation */}
      {actionConfirmation && (
        <ConfirmationModal
          type={actionConfirmation === 'approve' ? 'action' : 'delete'}
          title={actionConfirmation === 'approve' ? 'Approve Requisition' : 'Reject Requisition'}
          description={
            actionConfirmation === 'approve'
              ? 'The edited requisition will be approved and forwarded to procurement.'
              : 'This requisition will be rejected and the requester will be notified.'
          }
          onConfirm={confirmAction}
          onCancel={() => setActionConfirmation(null)}
          isLoading={isProcessing || saving}
        />
      )}
    </div>
  );
}
