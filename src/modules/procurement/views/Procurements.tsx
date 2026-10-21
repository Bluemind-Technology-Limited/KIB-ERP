import { useEffect, useState } from 'react';
import { Truck, Plus, Trash2, Send } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import LpoSendModal from '../components/LpoSendModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { DetailsModal, ViewButton, detailDate, detailValue } from '../../../components/ui/DetailsModal';

interface SupplierOption { id: string; name: string; vendorCode?: string }

interface RequisitionLine {
  materialId: string;
  materialName: string;
  sku: string;
  supplierId: string;
  supplierOptions: Array<{ id: string; name: string }>;
  quantity: string;
  unitOfMeasure: string;
  unitCost: string;
}

const poStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  SENT: 'bg-sky-50 text-sky-700 border-sky-200',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-700 border-amber-200',
  RECEIVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
};

const poStatusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CLOSED: 'Closed',
};

export default function Procurements({ searchQuery = '' }: { searchQuery?: string }) {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [approvedRequisitions, setApprovedRequisitions] = useState<any[]>([]);
  const [lpoPoId, setLpoPoId] = useState<string | null>(null);
  const [ensuringLpoId, setEnsuringLpoId] = useState<string | null>(null);
  const [holdTarget, setHoldTarget] = useState<{ poId: string; itemId: string; materialName: string; onHold: boolean } | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [savingHold, setSavingHold] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPoForm, setShowPoForm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string } | null>(null);
  const [viewingPo, setViewingPo] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createPoConfirmation, setCreatePoConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusConfirmation, setStatusConfirmation] = useState<{ id: string; status: string } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // PO form. The supplier is not chosen here — it is derived from the materials
  // on the order, since a material already knows who supplies it.
  const [poRequisitionId, setPoRequisitionId] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poExpected, setPoExpected] = useState('');
  const [poItems, setPoItems] = useState<RequisitionLine[]>([]);

  /**
   * A purchase order is always raised from an approved requisition. Picking one
   * loads its lines — the officer only fills in cost and, when a material has
   * several suppliers, which one it is bought from.
   */
  const selectRequisition = (requisitionId: string) => {
    setPoRequisitionId(requisitionId);
    const requisition = approvedRequisitions.find((r) => r.id === requisitionId);
    if (!requisition) {
      setPoItems([]);
      return;
    }

    setPoItems(
      (requisition.items ?? []).map((item: any) => {
        const options = (item.material?.suppliers ?? []).map((link: any) => ({
          id: link.supplier.id,
          name: link.supplier.name,
        }));
        return {
          materialId: item.materialId ?? item.material?.id,
          materialName: item.material?.name ?? 'Material',
          sku: item.material?.sku ?? '',
          // Auto-select when the material only has one supplier.
          supplierId: options.length === 1 ? options[0].id : '',
          supplierOptions: options,
          quantity: String(item.quantity ?? ''),
          unitOfMeasure: item.unitOfMeasure ?? item.material?.unitOfMeasure ?? '',
          unitCost: '0',
        };
      })
    );
  };

  /**
   * A purchase order is raised against exactly one supplier, so the supplier is
   * derived from the items. When a material has more than one supplier the row
   * asks which one, and if items disagree the order has to be split.
   */
  const chosenSupplierIds = [
    ...new Set(poItems.filter((it) => it.materialId && it.supplierId).map((it) => it.supplierId)),
  ];
  const resolvedSupplierId = chosenSupplierIds.length === 1 ? chosenSupplierIds[0] : '';
  const resolvedSupplier = suppliers.find((s) => s.id === resolvedSupplierId) ?? null;

  const loadAll = async () => {
    setLoading(true);
    try {
      const [supRes, reqRes, poRes] = await Promise.all([
        axiosClient.get<{ suppliers: SupplierOption[] }>('/master-data/suppliers'),
        axiosClient.get<{ requisitions: any[] }>('/procurement/requisitions', {
          params: { status: 'APPROVED' },
        }),
        axiosClient.get<{ purchaseOrders: any[] }>('/procurement/purchase-orders'),
      ]);
      setSuppliers(supRes.data.suppliers);
      setApprovedRequisitions(reqRes.data.requisitions);
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

  // Approved requisitions with no PO yet, or a draft/partial PO to retry.
  const awaitingLpo = approvedRequisitions.filter((r) => {
    const pos = r.purchaseOrders ?? [];
    return (
      pos.length === 0 ||
      pos.some((p: any) => p.status === 'DRAFT' || p.status === 'PARTIALLY_RECEIVED')
    );
  });

  /**
   * LPOs are always issued against the purchase order. If the requisition has
   * no order yet, create it first, then open the modal on the real order lines.
   */
  const openLpoForRequisition = async (requisitionId: string) => {
    setEnsuringLpoId(requisitionId);
    setError('');
    try {
      const res = await axiosClient.post<{ purchaseOrder: { id: string } }>(
        `/procurement/requisitions/${requisitionId}/ensure-po`
      );
      setLpoPoId(res.data.purchaseOrder.id);
    } catch (err: any) {
      const data = err?.response?.data;
      setError(
        Array.isArray(data?.issues) && data.issues.length
          ? data.issues.join(' ')
          : data?.error || 'Failed to prepare the purchase order'
      );
    } finally {
      setEnsuringLpoId(null);
    }
  };

  /** How many lines are still sendable / already sent / on hold. */
  const lpoState = (po: any) => {
    const items = po.items ?? [];
    const sent = items.filter((i: any) => i.lpoSentAt).length;
    const onHold = items.filter((i: any) => i.onHold).length;
    const eligible = items.filter(
      (i: any) => !i.lpoSentAt && !i.onHold && Number(i.receivedQty ?? 0) < Number(i.quantity)
    ).length;
    return { total: items.length, sent, onHold, eligible };
  };

  const confirmHold = async () => {
    if (!holdTarget) return;
    setSavingHold(true);
    setError('');
    try {
      await axiosClient.patch(
        `/procurement/purchase-orders/${holdTarget.poId}/items/${holdTarget.itemId}/hold`,
        { onHold: holdTarget.onHold, reason: holdTarget.onHold ? holdReason : undefined }
      );
      const res = await axiosClient.get<{ purchaseOrders: any[] }>('/procurement/purchase-orders');
      setPurchaseOrders(res.data.purchaseOrders);
      const refreshed = res.data.purchaseOrders.find((p: any) => p.id === holdTarget.poId);
      if (refreshed) setViewingPo(refreshed);
      setHoldTarget(null);
      setHoldReason('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update the line hold');
    } finally {
      setSavingHold(false);
    }
  };

  /** Internal POs can span suppliers; show a compact label instead of one name. */
  const poSupplierLabel = (po: any) => {
    const names = [
      ...new Set(
        (po.items ?? [])
          .map((item: any) => item.supplier?.name)
          .filter(Boolean)
      ),
    ] as string[];
    if (names.length === 0) return po.supplier?.name ?? '—';
    if (names.length === 1) return names[0];
    return `${names[0]} +${names.length - 1} more`;
  };

  const createPo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poRequisitionId) { setError('Select an approved requisition first'); return; }
    if (poItems.length === 0) { setError('This requisition has no items'); return; }

    const unsupplied = poItems.find((it) => it.supplierOptions.length === 0);
    if (unsupplied) {
      setError(
        `"${unsupplied.materialName}" has no supplier. Add one in Master Data → Materials before raising this PO.`
      );
      return;
    }

    const unchosen = poItems.find((it) => !it.supplierId);
    if (unchosen) {
      setError(`Choose which supplier "${unchosen.materialName}" is being bought from.`);
      return;
    }

    if (chosenSupplierIds.length > 1) {
      const names = chosenSupplierIds
        .map((id) => suppliers.find((s) => s.id === id)?.name ?? id)
        .join(', ');
      setError(
        `All items on a purchase order must come from the same supplier — this one has ${chosenSupplierIds.length} (${names}). Split it into separate purchase orders.`
      );
      return;
    }

    setCreatePoConfirmation(true);
  };

  const confirmCreatePo = async () => {
    const supplier = resolvedSupplier;
    if (!supplier?.vendorCode?.trim()) {
      setError(
        `Supplier "${supplier?.name ?? 'The selected supplier'}" has no vendor code. Add it in Master Data → Suppliers before raising this PO.`
      );
      setCreatePoConfirmation(false);
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        supplierId: resolvedSupplierId,
        requisitionId: poRequisitionId,
        notes: poNotes,
        items: poItems.map((it) => ({
          materialId: it.materialId,
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost || 0),
          unitOfMeasure: it.unitOfMeasure
        }))
      };
      if (poExpected) body.expectedDelivery = new Date(poExpected).toISOString();
      await axiosClient.post('/procurement/purchase-orders', body, {
        toast: { success: `Purchase order raised with ${supplier.name}` },
      });
      setShowPoForm(false);
      setCreatePoConfirmation(false);
      setPoRequisitionId(''); setPoNotes(''); setPoExpected(''); setPoItems([]);
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
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Purchase Orders</h2>
          <PageDescription>Create and manage purchase orders with suppliers.</PageDescription>
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

      {error && <div className="relative z-9999 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>}

      {/* 2b. Approved requisitions awaiting supplier LPOs */}
      {awaitingLpo.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Approved Requisitions · Awaiting LPO
            </h3>
            <span className="text-[10px] text-slate-400">{awaitingLpo.length} ready</span>
          </div>
          <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
            {awaitingLpo.map((r) => {
              const retry = (r.purchaseOrders ?? []).some((p: any) => p.status === 'DRAFT' || p.status === 'PARTIALLY_RECEIVED');
              return (
                <div key={r.id} className="border-b border-slate-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#171717]">{r.number}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">APPROVED</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      by {r.requestedBy?.fullName ?? '—'} · {r.items?.length ?? 0} line(s)
                      {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => openLpoForRequisition(r.id)}
                    disabled={ensuringLpoId === r.id}
                    className="h-8 px-3 rounded-lg border border-sky-200 text-sky-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-sky-50 shrink-0 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    {ensuringLpoId === r.id ? 'Preparing…' : retry ? 'Continue LPO' : 'Generate & Send LPO'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. New Purchase Order Modal */}
      {showPoForm && (
        <Modal onClose={() => setShowPoForm(false)}>
          <form onSubmit={createPo} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#171717]">
                <Truck className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">Purchase Order from Requisition</h3>
              </div>
              <button type="button" onClick={() => setShowPoForm(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved Requisition *</label>
                <select
                  value={poRequisitionId}
                  onChange={(e) => selectRequisition(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="">Select approved requisition…</option>
                  {approvedRequisitions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.number} — {r.requestedBy?.fullName ?? '—'} · {r.items?.length ?? 0} line(s)
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400">
                  {approvedRequisitions.length === 0
                    ? 'No approved requisitions yet — approve a requisition before raising a purchase order.'
                    : 'Purchase orders are always raised from an approved requisition. Selecting one lists its items below.'}
                </p>
              </div>

              {/* Supplier is derived from the materials on the order. */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Supplier</label>
                <div className="flex h-9 items-center gap-2 rounded-lg border border-[#E9E9E9] bg-slate-50 px-3 text-xs">
                  {resolvedSupplier ? (
                    <>
                      <span className="font-semibold text-slate-700">{resolvedSupplier.name}</span>
                      {resolvedSupplier.vendorCode && (
                        <span className="font-mono text-[10px] text-slate-400">
                          code {resolvedSupplier.vendorCode}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400">
                      {chosenSupplierIds.length > 1
                        ? 'Items have different suppliers — split into separate POs'
                        : 'Filled in from the requisition items'}
                    </span>
                  )}
                </div>
              </div>

              {/* Items come from the requisition — no free entry. */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Requisition Items *</label>
                {!poRequisitionId ? (
                  <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[10px] text-slate-400">
                    Select a requisition to load its items.
                  </div>
                ) : poItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">This requisition has no items.</p>
                ) : (
                  <div className="space-y-2">
                    {poItems.map((item, idx) => (
                      <div key={`${item.materialId}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-700 truncate" title={item.materialName}>
                              {item.materialName}
                            </p>
                            <p className="text-[9px] font-mono text-slate-400">{item.sku}</p>
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                            {item.quantity} {item.unitOfMeasure}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unit Cost *</label>
                            <input
                              value={item.unitCost}
                              onChange={(e) =>
                                setPoItems(poItems.map((r, i) => (i === idx ? { ...r, unitCost: e.target.value } : r)))
                              }
                              type="number"
                              min="0"
                              step="any"
                              required
                              className="h-8 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Supplier</label>
                            {item.supplierOptions.length === 0 ? (
                              <p className="text-[10px] text-amber-600 py-1.5">
                                No supplier linked — add one in Master Data → Materials.
                              </p>
                            ) : item.supplierOptions.length === 1 ? (
                              <p className="h-8 flex items-center text-[10px] text-slate-600">
                                {item.supplierOptions[0].name}
                              </p>
                            ) : (
                              <select
                                value={item.supplierId}
                                onChange={(e) =>
                                  setPoItems(poItems.map((r, i) => (i === idx ? { ...r, supplierId: e.target.value } : r)))
                                }
                                className="h-8 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-[11px] focus:outline-none focus:border-[#EA4335]"
                              >
                                <option value="">Which supplier…</option>
                                {item.supplierOptions.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${poStatusBadge[p.status]}`}>{poStatusLabel[p.status] ?? p.status}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {poSupplierLabel(p)} {p.requisition ? `· from ${p.requisition.number}` : ''} · {p.items?.length} line(s)
                    {(() => {
                      const state = lpoState(p);
                      if (!state.sent && !state.onHold) return '';
                      return ` · LPO ${state.sent}/${state.total}${state.onHold ? ` · ${state.onHold} on hold` : ''}`;
                    })()}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {p.items?.map((i: any) => {
                      const received = Number(i.receivedQty ?? 0);
                      const ordered = Number(i.quantity);
                      const outstanding = ordered - received;
                      return `${i.material?.name} ${received}/${ordered}${outstanding > 0 ? ` (${outstanding} outstanding)` : ' ✓'}`;
                    }).join(' · ')}
                  </p>
                  {Array.isArray(p.consignments) && p.consignments.length > 0 && (
                    <p className="text-[10px] text-slate-400">
                      Receipts:{' '}
                      {p.consignments
                        .map((c: any) =>
                          c.receivedAt ? new Date(c.receivedAt).toLocaleDateString() : '—'
                        )
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <ViewButton onClick={() => setViewingPo(p)} />
                  {lpoState(p).eligible > 0 && (
                    <button onClick={() => setLpoPoId(p.id)} className="h-8 px-3 rounded-lg border border-sky-200 text-sky-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-sky-50">
                      <Send className="w-3 h-3" /> {lpoState(p).sent > 0 ? 'Send remaining' : 'LPO'}
                    </button>
                  )}
                  {p.status === 'DRAFT' && (
                    <>
                      <button onClick={() => handleStatusChange(p.id, 'SENT')} className="h-8 px-3 rounded-lg border border-sky-200 text-sky-600 text-[11px] font-semibold hover:bg-sky-50">Mark Sent</button>
                      <button onClick={() => deletePurchaseOrder(p.id)} className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-50">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </>
                  )}
                  {['PARTIALLY_RECEIVED', 'RECEIVED'].includes(p.status) && (
                    <button onClick={() => handleStatusChange(p.id, 'CLOSED')} className="h-8 px-3 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-semibold hover:bg-slate-50">Close PO</button>
                  )}
                  {p.status === 'CLOSED' && (
                    <button onClick={() => deletePurchaseOrder(p.id)} className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-50">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {viewingPo && (
        <DetailsModal
          title={viewingPo.number}
          subtitle={poSupplierLabel(viewingPo)}
          status={{ label: poStatusLabel[viewingPo.status] ?? viewingPo.status, className: poStatusBadge[viewingPo.status] }}
          onClose={() => setViewingPo(null)}
          sections={[
            {
              title: 'Order',
              fields: [
                { label: 'Supplier', value: poSupplierLabel(viewingPo) },
                { label: 'Requisition', value: detailValue(viewingPo.requisition?.number) },
                { label: 'Created by', value: detailValue(viewingPo.createdBy?.fullName) },
                { label: 'Order date', value: detailDate(viewingPo.orderDate) },
                { label: 'Expected delivery', value: detailDate(viewingPo.expectedDelivery) },
                { label: 'Closed at', value: detailDate(viewingPo.closedAt) },
              ],
            },
            {
              title: 'Lines',
              fields: [
                {
                  label: 'Materials',
                  wide: true,
                  value: (
                    <div className="space-y-1">
                      {(viewingPo.items ?? []).map((i: any) => {
                        const received = Number(i.receivedQty ?? 0);
                        const ordered = Number(i.quantity);
                        const outstanding = ordered - received;
                        const stateLabel = i.lpoSentAt
                          ? i.lpoNumber ?? 'LPO sent'
                          : i.onHold
                          ? 'On hold'
                          : received >= ordered
                          ? 'Received'
                          : 'Not sent';
                        const stateClass = i.lpoSentAt
                          ? 'text-emerald-600'
                          : i.onHold
                          ? 'text-amber-600'
                          : received >= ordered
                          ? 'text-slate-400'
                          : 'text-slate-500';
                        return (
                          <div key={i.id} className="flex items-center justify-between gap-3 border-b border-slate-50 pb-1 last:border-0">
                            <div className="min-w-0">
                              <p className="truncate">{i.material?.name}</p>
                              <p className={`text-[9px] font-semibold uppercase tracking-wider ${stateClass}`}>
                                {stateLabel}
                                {i.onHold && i.holdReason ? ` — ${i.holdReason}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="shrink-0 text-slate-500 text-[10px]">
                                {received}/{ordered} {i.unitOfMeasure}
                                {outstanding > 0 ? (
                                  <span className="text-amber-600 font-semibold"> · {outstanding} outstanding</span>
                                ) : (
                                  <span className="text-emerald-600 font-semibold"> · complete</span>
                                )}
                              </span>
                              {!i.lpoSentAt && received === 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHoldTarget({
                                      poId: viewingPo.id,
                                      itemId: i.id,
                                      materialName: i.material?.name ?? 'Item',
                                      onHold: !i.onHold,
                                    });
                                    setHoldReason(i.holdReason ?? '');
                                  }}
                                  className={`h-6 px-2 rounded-md border text-[9px] font-semibold ${
                                    i.onHold
                                      ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                      : 'border-amber-200 text-amber-600 hover:bg-amber-50'
                                  }`}
                                >
                                  {i.onHold ? 'Resume' : 'Hold'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ),
                },
              ],
            },
            {
              title: 'Receipts',
              fields: [
                {
                  label: 'Delivery dates',
                  wide: true,
                  value:
                    Array.isArray(viewingPo.consignments) && viewingPo.consignments.length > 0
                      ? viewingPo.consignments
                          .map((c: any) =>
                            c.receivedAt ? new Date(c.receivedAt).toLocaleDateString() : '—'
                          )
                          .join(' · ')
                      : '—',
                },
                { label: 'Notes', wide: true, value: detailValue(viewingPo.notes) },
              ],
            },
          ]}
        />
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
          description="Raise this purchase order from the selected approved requisition?"
          onConfirm={confirmCreatePo}
          onCancel={() => setCreatePoConfirmation(false)}
          isLoading={saving}
        />
      )}

      {lpoPoId && (
        <LpoSendModal
          poId={lpoPoId}
          onClose={() => {
            setLpoPoId(null);
            loadAll();
          }}
          onSent={() => {
            setLpoPoId(null);
            loadAll();
          }}
        />
      )}

      {holdTarget && (
        <Modal onClose={() => !savingHold && setHoldTarget(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#171717]">
                  {holdTarget.onHold ? 'Put line on hold' : 'Resume line'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 truncate">{holdTarget.materialName}</p>
              </div>
              <button
                type="button"
                onClick={() => setHoldTarget(null)}
                disabled={savingHold}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              {holdTarget.onHold
                ? 'A held line is left out of LPO selection until it is resumed.'
                : 'This line will be available for LPO selection again.'}
            </p>

            {holdTarget.onHold && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reason (optional)</label>
                <textarea
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. price under review"
                  className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335]"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setHoldTarget(null)}
                disabled={savingHold}
                className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmHold}
                disabled={savingHold}
                className="btn-3d px-4 h-9 disabled:opacity-50"
              >
                <span className="text-white text-xs font-semibold">
                  {savingHold ? 'Saving…' : holdTarget.onHold ? 'Put on hold' : 'Resume line'}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
