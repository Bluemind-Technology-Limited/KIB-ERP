import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, ChevronDown, ChevronRight, Trash2, Boxes } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { PackQuantityPreview } from '../../../components/ui/PackQuantityPreview';
import { formatNumber, formatQty } from '../../../lib/format';

interface Material {
  id: string;
  name: string;
  sku: string;
  unitOfMeasure: string;
}

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
}

interface Warehouse {
  id: string;
  name: string;
  location?: string | null;
}

interface WarehouseBin {
  id: string;
  binCode: string;
  capacity?: number | null;
  warehouseId: string;
}

interface ConsignmentItem {
  id: string;
  materialId: string;
  poItemId?: string | null;
  quantity: number;
  receivedQty: number;
  unitOfMeasure: string;
  distributedQty: number;
  material: Material;
  poItem?: { id: string; quantity: number; receivedQty: number; unitCost: number } | null;
}

interface ConsignmentDistribution {
  id: string;
  consignmentItemId: string;
  quantity: number;
  distributedAt: Date;
  distributedBy?: { fullName: string };
  bin?: { binCode: string };
}

interface Consignment {
  id: string;
  consignmentNumber: string;
  status: string;
  poNumbers?: string | null;
  po?: { id: string; number: string; status: string } | null;
  shipDate?: Date | null;
  expectedDelivery?: Date | null;
  receivedAt?: Date | null;
  distributedAt?: Date | null;
  createdAt: Date;
  supplier: Supplier;
  warehouse: Warehouse;
  createdBy?: { fullName: string };
  receivedBy?: { fullName: string };
  items: ConsignmentItem[];
  distributions?: ConsignmentDistribution[];
  qualityApproval?: {
    id: string;
    status: string;
    totalItems: number;
    passedItems: number;
    failedItems: number;
    checkItems?: {
      id: string;
      consignmentItemId: string;
      checkType: string;
      status: string;
      result?: string | null;
      remarks?: string | null;
    }[];
  };
}

const consignmentStatusBadge: Record<string, string> = {
  DRAFT: 'bg-surface-3 text-ink-muted border-line',
  READY_FOR_SHIPMENT: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
  IN_TRANSIT: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  RECEIVED: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  QUALITY_PENDING: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30',
  QUALITY_APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  DISTRIBUTED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  CANCELLED: 'bg-surface-3 text-ink-muted border-line',
};

/** Human labels for the receipt states. */
const consignmentStatusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  READY_FOR_SHIPMENT: 'Ready',
  IN_TRANSIT: 'In transit',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  QUALITY_PENDING: 'QA pending',
  QUALITY_APPROVED: 'QA approved',
  DISTRIBUTED: 'Distributed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const qualityStatusBadge: Record<string, string> = {
  PENDING: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  PASSED: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
  FAILED: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  REJECTED: 'bg-surface-3 text-ink-muted border-line',
};


export default function Consignments({ searchQuery = '' }: { searchQuery?: string }) {
  const navigate = useNavigate();
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [warehouseBins, setWarehouseBins] = useState<WarehouseBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDistributionModal, setShowDistributionModal] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ consignmentId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [distributions, setDistributions] = useState<Array<{ itemId: string; binId: string; quantity: string }>>([]);
  const [selectedConsignmentForDistribution, setSelectedConsignmentForDistribution] = useState<Consignment | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [consRes, binRes] = await Promise.all([
        axiosClient.get<{ consignments: Consignment[] }>('/procurement/consignments'),
        axiosClient.get<{ bins: WarehouseBin[] }>('/master-data/warehouse-bins'),
      ]);
      setConsignments(consRes.data.consignments);
      setWarehouseBins(binRes.data.bins);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load consignments. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleExpanded = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const openDistributionModal = (consignment: Consignment) => {
    setSelectedConsignmentForDistribution(consignment);
    const bins = warehouseBins.filter((b) => b.warehouseId === consignment.warehouse.id);
    setDistributions(
      consignment.items.map((item) => ({
        itemId: item.id,
        binId: bins[0]?.id || '',
        quantity: '',
      }))
    );
    setShowDistributionModal(consignment.id);
  };

  const submitDistribution = async () => {
    if (!selectedConsignmentForDistribution) return;
    setSaving(true);
    try {
      for (const dist of distributions) {
        if (dist.binId && dist.quantity) {
          await axiosClient.post(
            `/procurement/consignments/${selectedConsignmentForDistribution.id}/distribute`,
            {
              consignmentItemId: dist.itemId,
              binId: dist.binId,
              quantity: Number(dist.quantity),
            }
          );
        }
      }
      setShowDistributionModal(null);
      setSelectedConsignmentForDistribution(null);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to distribute consignment');
    } finally {
      setSaving(false);
    }
  };

  const deleteConsignment = (consignmentId: string) => {
    setDeleteConfirmation({ consignmentId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await axiosClient.delete(`/procurement/consignments/${deleteConfirmation.consignmentId}`);
      setDeleteConfirmation(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete consignment');
      setDeleteConfirmation(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = consignments.filter(
    (c) =>
      c.consignmentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.warehouse.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Consignments</h2>
          <PageDescription>Record what arrived from a purchase order. Anything not received stays outstanding on the PO for the next consignment.</PageDescription>
        </div>
        <button onClick={() => navigate('/inventory/grn')} className="btn-3d px-4 h-9">
          <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> Record Receipt
          </span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>
      )}

      {/* 2. Consignments List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-line rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-2 w-52" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl">
            <EmptyState title="No consignments found." hint="Create your first consignment shipment." />
          </div>
        ) : (
          filtered.map((csn) => {
            const isOpen = !!expanded[csn.id];
            const undistributedItems = csn.items.filter((item) => item.quantity > item.distributedQty);
            // PO-level progress: what this order has received so far, and what is
            // still owed (which is what the next consignment will offer).
            const orderedTotal = csn.items.reduce(
              (sum, item) => sum + Number(item.poItem?.quantity ?? item.quantity),
              0
            );
            const receivedTotal = csn.items.reduce(
              (sum, item) => sum + Number(item.poItem?.receivedQty ?? item.receivedQty ?? 0),
              0
            );
            const outstandingTotal = Math.max(orderedTotal - receivedTotal, 0);
            return (
              <div key={csn.id} className="bg-surface border border-line rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpanded(csn.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2/60 text-left"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#00B4D8]/10 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-[#00B4D8]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-ink">{csn.consignmentNumber}</p>
                      <p className="text-[10px] text-ink-faint">
                        {csn.po ? `${csn.po.number} · ` : csn.poNumbers ? `${csn.poNumbers} · ` : ''}
                        {csn.supplier.name} → {csn.warehouse.name} · {formatNumber(csn.items.length)} items · Received {csn.receivedAt ? new Date(csn.receivedAt).toLocaleDateString() : '—'}
                      </p>
                      {orderedTotal > 0 && (
                        <p className="text-[10px] text-ink-muted mt-0.5">
                          PO received <b>{formatNumber(receivedTotal)}</b> of {formatNumber(orderedTotal)}
                          {outstandingTotal > 0 ? (
                            <span className="text-amber-600 font-semibold dark:text-amber-300"> · {formatNumber(outstandingTotal)} still outstanding</span>
                          ) : (
                            <span className="text-emerald-600 font-semibold dark:text-emerald-300"> · complete</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${consignmentStatusBadge[csn.status] ?? consignmentStatusBadge.DRAFT}`}>
                      {consignmentStatusLabel[csn.status] ?? csn.status}
                    </span>
                    {csn.qualityApproval && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${qualityStatusBadge[csn.qualityApproval.status]}`}>
                        QA: {csn.qualityApproval.status}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConsignment(csn.id);
                      }}
                      className="text-ink-faint hover:text-rose-600 transition-colors p-1.5 dark:hover:text-rose-300"
                      title="Delete consignment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-ink-faint" /> : <ChevronRight className="w-4 h-4 text-ink-faint" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-line px-4 py-4 space-y-4">
                    {/* Items Summary */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Items in Consignment</div>
                      <div className="space-y-2">
                        {csn.items.map((item) => {
                          const checks = (csn.qualityApproval?.checkItems ?? []).filter(
                            (check) => check.consignmentItemId === item.id
                          );
                          const hasFail = checks.some((check) => check.result === 'FAIL');
                          const allDone =
                            checks.length > 0 &&
                            checks.every((check) => check.result === 'PASS' || check.result === 'FAIL');
                          const qaBadge = hasFail
                            ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
                            : allDone
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
                              : 'bg-surface-3 text-ink-muted border-line';
                          const qaLabel = hasFail ? 'QA FAIL' : allDone ? 'QA PASS' : 'QA PENDING';

                          return (
                            <div key={item.id} className="rounded-lg border border-line p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1">
                                  <p className="text-[11px] font-bold text-ink-2">{item.material.name}</p>
                                  <p className="text-[10px] text-ink-faint mt-1">
                                    Arrived in this shipment: <b>{formatQty(item.quantity, item.unitOfMeasure)}</b>
                                  </p>
                                  {item.poItem && (
                                    <p className="text-[10px] text-ink-faint mt-0.5">
                                      PO line: <b>{formatNumber(item.poItem.receivedQty)}</b> of {formatNumber(item.poItem.quantity)} received
                                      {Number(item.poItem.quantity) > Number(item.poItem.receivedQty) ? (
                                        <span className="text-amber-600 font-semibold dark:text-amber-300">
                                          {' '}· {formatNumber(Number(item.poItem.quantity) - Number(item.poItem.receivedQty))} still outstanding
                                        </span>
                                      ) : (
                                        <span className="text-emerald-600 font-semibold dark:text-emerald-300"> · complete</span>
                                      )}
                                    </p>
                                  )}
                                  <p className="text-[10px] text-ink-faint mt-0.5">
                                    Distributed: <b>{formatNumber(item.distributedQty)}</b>
                                  </p>
                                  {checks.length > 0 && (
                                    <p className="text-[9px] text-ink-faint mt-1">
                                      {checks
                                        .map((check) => `${check.checkType.replace(/_/g, ' ')}: ${check.result ?? 'PENDING'}`)
                                        .join(' · ')}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${qaBadge}`}>
                                    {qaLabel}
                                  </span>
                                  {item.quantity > item.distributedQty && (
                                    <div className="text-[9px] font-bold px-2 py-1 rounded bg-amber-600 text-white">
                                      {formatNumber(item.quantity - item.distributedQty, 2)} pending
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
                      {csn.status === 'QUALITY_APPROVED' && undistributedItems.length > 0 && (
                        <button
                          onClick={() => openDistributionModal(csn)}
                          className="btn-3d px-3 h-7"
                        >
                          <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                            <Boxes className="w-3 h-3" /> Distribute to Bins
                          </span>
                        </button>
                      )}
                      {csn.status === 'QUALITY_PENDING' && undistributedItems.length > 0 && (
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-500/10 dark:border-orange-500/30">
                          <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300">⏳ Awaiting QA Approval</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Distribution Modal */}
      {showDistributionModal && selectedConsignmentForDistribution && (
        <Modal onClose={() => setShowDistributionModal(null)}>
          <div className="bg-surface rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#00B4D8]" />
                <h3 className="text-sm font-bold text-ink">Distribute to Bins</h3>
              </div>
              <button type="button" onClick={() => setShowDistributionModal(null)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            <div className="space-y-3">
              {selectedConsignmentForDistribution.items
                .filter((item) => item.quantity > item.distributedQty)
                .map((item, idx) => (
                  <div key={item.id} className="rounded-lg border border-line p-3 space-y-2">
                    <p className="text-[11px] font-bold text-ink-2">{item.material.name}</p>
                    <p className="text-[10px] text-ink-faint">
                      Remaining: <b>{formatQty(item.quantity - item.distributedQty, item.unitOfMeasure)}</b>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Bin *</label>
                        <select
                          value={distributions[idx]?.binId || ''}
                          onChange={(e) => setDistributions((prev) => [...prev.slice(0, idx), { ...prev[idx], binId: e.target.value }, ...prev.slice(idx + 1)])}
                          className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#00B4D8]"
                        >
                          <option value="">Select bin…</option>
                          {warehouseBins
                            .filter((b) => b.warehouseId === selectedConsignmentForDistribution.warehouse.id)
                            .map((b) => (
                              <option key={b.id} value={b.id}>{b.binCode}</option>
                            ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Qty *</label>
                        <input
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          value={distributions[idx]?.quantity || ''}
                          onChange={(e) => setDistributions((prev) => [...prev.slice(0, idx), { ...prev[idx], quantity: e.target.value }, ...prev.slice(idx + 1)])}
                          placeholder={formatNumber(item.quantity - item.distributedQty, 2)}
                          className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#00B4D8]"
                        />
                        <PackQuantityPreview quantity={distributions[idx]?.quantity} unit={item.unitOfMeasure} />
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => setShowDistributionModal(null)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">Cancel</button>
              <button type="button" onClick={submitDistribution} disabled={saving} className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">{saving ? 'Distributing…' : 'Distribute'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <ConfirmationModal
          type="delete"
          title="Delete Consignment"
          description="This consignment will be permanently deleted. This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
