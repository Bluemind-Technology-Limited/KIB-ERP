import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, ChevronDown, ChevronRight, Trash2, Boxes, ShieldCheck } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { useAuthStore } from '../../../stores/useAuthStore';
import { rolePermissions } from '../../../components/routing/RoleGuard';
import { PageDescription } from '../../../components/ui/PageDescription';

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
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  READY_FOR_SHIPMENT: 'bg-sky-50 text-sky-700 border-sky-200',
  IN_TRANSIT: 'bg-blue-50 text-blue-700 border-blue-200',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-700 border-amber-200',
  RECEIVED: 'bg-amber-50 text-amber-700 border-amber-200',
  QUALITY_PENDING: 'bg-orange-50 text-orange-700 border-orange-200',
  QUALITY_APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DISTRIBUTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
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
  PENDING: 'bg-orange-100 text-orange-700 border-orange-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  PASSED: 'bg-green-100 text-green-700 border-green-200',
  FAILED: 'bg-rose-100 text-rose-700 border-rose-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-slate-100 text-slate-600 border-slate-200',
};


export default function Consignments({ searchQuery = '' }: { searchQuery?: string }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canOpenQA = !!user && (rolePermissions[user.role]?.includes('qa-consignments') ?? false);
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
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Consignments</h2>
          <PageDescription>Record what arrived from a purchase order. Anything not received stays outstanding on the PO for the next consignment.</PageDescription>
        </div>
        <button onClick={() => navigate('/inventory/grn')} className="btn-3d px-4 h-9">
          <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> Record Receipt
          </span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Consignments List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
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
          <div className="bg-white border border-[#E9E9E9] rounded-xl">
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
              <div key={csn.id} className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpanded(csn.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#00B4D8]/10 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-[#00B4D8]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-[#171717]">{csn.consignmentNumber}</p>
                      <p className="text-[10px] text-slate-400">
                        {csn.po ? `${csn.po.number} · ` : csn.poNumbers ? `${csn.poNumbers} · ` : ''}
                        {csn.supplier.name} → {csn.warehouse.name} · {csn.items.length} items · Received {csn.receivedAt ? new Date(csn.receivedAt).toLocaleDateString() : '—'}
                      </p>
                      {orderedTotal > 0 && (
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          PO received <b>{receivedTotal.toLocaleString()}</b> of {orderedTotal.toLocaleString()}
                          {outstandingTotal > 0 ? (
                            <span className="text-amber-600 font-semibold"> · {outstandingTotal.toLocaleString()} still outstanding</span>
                          ) : (
                            <span className="text-emerald-600 font-semibold"> · complete</span>
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
                      className="text-slate-300 hover:text-rose-600 transition-colors p-1.5"
                      title="Delete consignment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                    {/* Items Summary */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Items in Consignment</div>
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
                            ? 'bg-rose-50 text-rose-600 border-rose-200'
                            : allDone
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200';
                          const qaLabel = hasFail ? 'QA FAIL' : allDone ? 'QA PASS' : 'QA PENDING';

                          return (
                            <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1">
                                  <p className="text-[11px] font-bold text-slate-700">{item.material.name}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    Arrived in this shipment: <b>{Number(item.quantity)}</b> {item.unitOfMeasure}
                                  </p>
                                  {item.poItem && (
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      PO line: <b>{Number(item.poItem.receivedQty)}</b> of {Number(item.poItem.quantity)} received
                                      {Number(item.poItem.quantity) > Number(item.poItem.receivedQty) ? (
                                        <span className="text-amber-600 font-semibold">
                                          {' '}· {Number(item.poItem.quantity) - Number(item.poItem.receivedQty)} still outstanding
                                        </span>
                                      ) : (
                                        <span className="text-emerald-600 font-semibold"> · complete</span>
                                      )}
                                    </p>
                                  )}
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    Distributed: <b>{Number(item.distributedQty)}</b>
                                  </p>
                                  {checks.length > 0 && (
                                    <p className="text-[9px] text-slate-400 mt-1">
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
                                    <div className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                      {Number(item.quantity - item.distributedQty).toFixed(2)} pending
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
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
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
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
                          <span className="text-[10px] font-semibold text-orange-700">⏳ Awaiting QA Approval</span>
                        </div>
                      )}
                      {canOpenQA &&
                        ['RECEIVED', 'QUALITY_PENDING', 'QUALITY_APPROVED'].includes(csn.status) && (
                          <button
                            onClick={() => navigate(`/quality/consignment-checks?consignment=${csn.id}`)}
                            className="flex items-center gap-1 px-3 h-7 rounded-lg border border-[#AA3BFF]/30 text-[#AA3BFF] text-[10px] font-semibold hover:bg-[#AA3BFF]/5"
                          >
                            <ShieldCheck className="w-3 h-3" /> Open QA Checks
                          </button>
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
          <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#00B4D8]" />
                <h3 className="text-sm font-bold text-[#171717]">Distribute to Bins</h3>
              </div>
              <button type="button" onClick={() => setShowDistributionModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              {selectedConsignmentForDistribution.items
                .filter((item) => item.quantity > item.distributedQty)
                .map((item, idx) => (
                  <div key={item.id} className="rounded-lg border border-slate-100 p-3 space-y-2">
                    <p className="text-[11px] font-bold text-slate-700">{item.material.name}</p>
                    <p className="text-[10px] text-slate-400">
                      Remaining: <b>{Number(item.quantity - item.distributedQty).toFixed(2)}</b> {item.unitOfMeasure}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bin *</label>
                        <select
                          value={distributions[idx]?.binId || ''}
                          onChange={(e) => setDistributions((prev) => [...prev.slice(0, idx), { ...prev[idx], binId: e.target.value }, ...prev.slice(idx + 1)])}
                          className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#00B4D8]"
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
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Qty *</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={distributions[idx]?.quantity || ''}
                          onChange={(e) => setDistributions((prev) => [...prev.slice(0, idx), { ...prev[idx], quantity: e.target.value }, ...prev.slice(idx + 1)])}
                          placeholder={Number(item.quantity - item.distributedQty).toFixed(2)}
                          className="h-9 w-full rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs focus:outline-none focus:border-[#00B4D8]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowDistributionModal(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
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
