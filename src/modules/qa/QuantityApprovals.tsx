import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader,
  Plus,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { axiosClient } from '../../lib/axiosClient';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { PageDescription } from '../../components/ui/PageDescription';
import { PackQuantityPreview } from '../../components/ui/PackQuantityPreview';
import { formatQty } from '../../lib/format';
import { useAuthStore } from '../../stores/useAuthStore';

interface Adjustment {
  id: string;
  oldQuantity: string | number;
  newQuantity: string | number;
  difference: string | number;
  reasonCode?: string | null;
  reason?: string | null;
  requestedAt: string;
  material: { id: string; name: string; sku: string; unitOfMeasure: string };
  requestedBy?: { fullName?: string; role?: string } | null;
  consignment?: { id: string; consignmentNumber: string; status: string } | null;
  consignmentItem?: { id: string; distributedQty: string | number } | null;
}

interface ConsignmentItemOption {
  id: string;
  materialId: string;
  quantity: number | string;
  unitOfMeasure: string;
  distributedQty: number | string;
  material: { id: string; name: string; sku: string; unitOfMeasure: string };
}

interface ConsignmentOption {
  id: string;
  consignmentNumber: string;
  status: string;
  supplier?: { name?: string } | null;
  items: ConsignmentItemOption[];
}

const REASON_CODES = [
  { value: 'SHORTAGE', label: 'Shortage' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'OVERAGE', label: 'Overage' },
  { value: 'QUALITY_REJECT', label: 'Quality Reject' },
  { value: 'RECOUNT', label: 'Recount' },
] as const;

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function QuantityApprovals() {
  const user = useAuthStore((state) => state.user);
  const isApprover = user?.role === 'HEAD_OF_QC' || user?.role === 'SUPER_ADMIN';

  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<Adjustment | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Propose adjustment modal state
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [consignments, setConsignments] = useState<ConsignmentOption[]>([]);
  const [loadingConsignments, setLoadingConsignments] = useState(false);
  const [selectedConsignmentId, setSelectedConsignmentId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [reasonCode, setReasonCode] = useState<string>('SHORTAGE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [proposeError, setProposeError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/quality/quantity-adjustments/pending', {
        params: { limit: 100 },
      });
      setAdjustments(res.data.adjustments || []);
      setError('');
    } catch (err: any) {
      setError(apiError(err, 'Failed to load pending quantity changes'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadConsignments = async () => {
    setLoadingConsignments(true);
    setProposeError('');
    try {
      const res = await axiosClient.get<{ consignments: ConsignmentOption[] }>(
        '/procurement/consignments'
      );
      // Only consignments in editable statuses (before completion/final distribution)
      const eligible = (res.data.consignments || []).filter((c) =>
        ['DRAFT', 'READY_FOR_SHIPMENT', 'IN_TRANSIT', 'RECEIVED', 'QUALITY_PENDING'].includes(
          c.status
        )
      );
      setConsignments(eligible);
      if (eligible.length > 0) {
        setSelectedConsignmentId(eligible[0].id);
        if (eligible[0].items.length > 0) {
          setSelectedItemId(eligible[0].items[0].id);
          setNewQuantity(String(eligible[0].items[0].quantity));
        }
      }
    } catch (err: any) {
      setProposeError(apiError(err, 'Failed to load consignments'));
    } finally {
      setLoadingConsignments(false);
    }
  };

  const handleOpenProposeModal = () => {
    setShowProposeModal(true);
    setProposeError('');
    loadConsignments();
  };

  const selectedConsignment = consignments.find((c) => c.id === selectedConsignmentId);
  const selectedItem = selectedConsignment?.items.find((i) => i.id === selectedItemId);

  const handleConsignmentChange = (consignmentId: string) => {
    setSelectedConsignmentId(consignmentId);
    const found = consignments.find((c) => c.id === consignmentId);
    if (found && found.items.length > 0) {
      setSelectedItemId(found.items[0].id);
      setNewQuantity(String(found.items[0].quantity));
    } else {
      setSelectedItemId('');
      setNewQuantity('');
    }
  };

  const handleItemChange = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = selectedConsignment?.items.find((i) => i.id === itemId);
    if (item) {
      setNewQuantity(String(item.quantity));
    }
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      setProposeError('Select an ingredient item');
      return;
    }
    const num = Number(newQuantity);
    if (!Number.isFinite(num) || num <= 0) {
      setProposeError('Enter a valid quantity greater than 0');
      return;
    }
    if (selectedItem && num === Number(selectedItem.quantity)) {
      setProposeError('New quantity must be different from the current quantity');
      return;
    }

    setSubmitting(true);
    setProposeError('');
    try {
      await axiosClient.post('/quality/quantity-adjustments', {
        consignmentItemId: selectedItemId,
        newQuantity: num,
        reasonCode,
        reason: notes.trim() || undefined,
      });

      setShowProposeModal(false);
      setNotes('');
      await load();
    } catch (err: any) {
      setProposeError(apiError(err, 'Failed to submit quantity correction'));
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async (adjustment: Adjustment) => {
    setBusyId(adjustment.id);
    try {
      await axiosClient.post(`/quality/quantity-adjustments/${adjustment.id}/approve`);
      setError('');
      await load();
    } catch (err: any) {
      setError(apiError(err, 'Failed to approve quantity change'));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setBusyId(rejectTarget.id);
    try {
      await axiosClient.post(`/quality/quantity-adjustments/${rejectTarget.id}/reject`, {
        rejectionReason: rejectReason.trim(),
      });
      setRejectTarget(null);
      setRejectReason('');
      setError('');
      await load();
    } catch (err: any) {
      setError(apiError(err, 'Failed to reject quantity change'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Quantity Approvals</h2>
          <PageDescription>
            Review and process quantity adjustments and corrections proposed by QC.
          </PageDescription>
        </div>
        <button
          onClick={handleOpenProposeModal}
          className="btn-3d px-3.5 h-9 shrink-0 flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4 text-white" />
          <span className="text-white text-xs font-semibold">Propose Correction</span>
        </button>
      </div>

      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:border-blue-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold text-blue-700 dark:text-blue-300">Awaiting approval</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{adjustments.length}</p>
          </div>
          <Clock className="h-8 w-8 text-blue-300" />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-4">
              <Skeleton className="mb-3 h-4 w-48" />
              <Skeleton className="mb-2 h-3 w-full" />
              <Skeleton className="h-3 w-80" />
            </div>
          ))}
        </div>
      ) : adjustments.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8">
          <EmptyState
            title="No quantity changes pending"
            hint="Corrections proposed by QC will automatically appear here for review."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {adjustments.map((adjustment) => {
            const diff = Number(adjustment.difference);
            return (
              <div
                key={adjustment.id}
                className="rounded-xl border border-line bg-surface p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#AA3BFF]/10">
                      <ShieldCheck className="h-4 w-4 text-[#AA3BFF]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink">
                        {adjustment.material?.name}
                      </p>
                      <p className="text-[10px] text-ink-faint">
                        <span className="font-mono">{adjustment.material?.sku}</span>
                        {adjustment.consignment?.consignmentNumber
                          ? ` · Consignment ${adjustment.consignment.consignmentNumber}`
                          : ''}
                        {adjustment.requestedBy?.fullName
                          ? ` · Initiated by ${adjustment.requestedBy.fullName}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-bold ${
                      diff < 0
                        ? 'bg-rose-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {diff > 0 ? '+' : ''}
                    {formatQty(diff, adjustment.material?.unitOfMeasure)}
                  </span>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-lg bg-surface-2 p-2">
                    <p className="text-[9px] text-ink-muted">Original / Current</p>
                    <p className="text-sm font-bold text-ink-2">
                      {formatQty(adjustment.oldQuantity, adjustment.material?.unitOfMeasure)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-2">
                    <p className="text-[9px] text-ink-muted">Proposed Revised</p>
                    <p className="text-sm font-bold text-ink-2">
                      {formatQty(adjustment.newQuantity, adjustment.material?.unitOfMeasure)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-2">
                    <p className="text-[9px] text-ink-muted">Reason</p>
                    <p className="text-sm font-bold text-ink-2">
                      {(adjustment.reasonCode ?? 'ADJUSTMENT').replace('_', ' ')}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-2">
                    <p className="text-[9px] text-ink-muted">Requested</p>
                    <p className="text-[11px] font-semibold text-ink-2">
                      {new Date(adjustment.requestedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {adjustment.reason && (
                  <p className="mb-3 rounded-lg border border-line bg-surface-2 p-2 text-[11px] text-ink-muted">
                    <span className="font-semibold text-ink-2">Notes: </span>
                    {adjustment.reason}
                  </p>
                )}

                {isApprover && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(adjustment)}
                      disabled={busyId === adjustment.id}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 h-9 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busyId === adjustment.id ? (
                        <Loader className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Approve &amp; update inventory
                    </button>
                    <button
                      onClick={() => setRejectTarget(adjustment)}
                      disabled={busyId === adjustment.id}
                      className="flex items-center gap-2 rounded-lg border border-rose-200 px-4 h-9 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Propose Adjustment Modal */}
      {showProposeModal && (
        <Modal onClose={() => setShowProposeModal(false)}>
          <div className="w-full max-w-lg space-y-4 rounded-xl bg-surface p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Propose Quantity Correction</h3>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Initiate a quantity correction on an ingredient consignment for QA approval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProposeModal(false)}
                className="text-ink-faint hover:text-ink-muted text-sm"
              >
                ✕
              </button>
            </div>

            {proposeError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-600 flex items-start gap-1.5 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{proposeError}</span>
              </div>
            )}

            {loadingConsignments ? (
              <div className="py-8 flex flex-col items-center justify-center text-xs text-ink-muted">
                <Loader className="w-5 h-5 animate-spin mb-2 text-[#AA3BFF]" />
                Loading consignments…
              </div>
            ) : consignments.length === 0 ? (
              <div className="py-6 text-center text-xs text-ink-muted">
                No active consignments found in editable status.
              </div>
            ) : (
              <form onSubmit={handleSubmitProposal} className="space-y-3.5">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block mb-1">
                    Select Consignment
                  </label>
                  <select
                    value={selectedConsignmentId}
                    onChange={(e) => handleConsignmentChange(e.target.value)}
                    className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs focus:outline-none focus:border-[#AA3BFF]"
                  >
                    {consignments.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.consignmentNumber} ({c.status})
                        {c.supplier?.name ? ` — ${c.supplier.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block mb-1">
                    Select Ingredient / Item
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => handleItemChange(e.target.value)}
                    className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs focus:outline-none focus:border-[#AA3BFF]"
                  >
                    {(selectedConsignment?.items || []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.material.name} ({item.material.sku}) — Current: {formatQty(item.quantity, item.unitOfMeasure)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block mb-1">
                      Current Quantity
                    </label>
                    <div className="h-9 rounded-lg border border-line bg-surface-2 px-3 flex items-center text-xs font-semibold text-ink-muted">
                      {selectedItem ? formatQty(selectedItem.quantity, selectedItem.unitOfMeasure) : '—'}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block mb-1">
                      Proposed Quantity *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      placeholder="e.g. 950"
                      className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs font-semibold focus:outline-none focus:border-[#AA3BFF]"
                      required
                    />
                    <PackQuantityPreview quantity={newQuantity} unit={selectedItem?.unitOfMeasure} />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block mb-1">
                    Reason Code *
                  </label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs focus:outline-none focus:border-[#AA3BFF]"
                  >
                    {REASON_CODES.map((code) => (
                      <option key={code.value} value={code.value}>
                        {code.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block mb-1">
                    Reason &amp; Inspection Remarks
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Provide context or explanation for this adjustment..."
                    rows={3}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs focus:outline-none focus:border-[#AA3BFF] resize-none"
                  />
                </div>

                <div className="flex gap-2.5 pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setShowProposeModal(false)}
                    className="flex-1 rounded-lg border border-line px-4 h-9 text-xs font-semibold text-ink-2 hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 btn-3d px-4 h-9 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <span className="text-white text-xs font-semibold">Submit for Approval</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <Modal onClose={() => setRejectTarget(null)}>
          <div className="w-full max-w-md space-y-4 rounded-xl bg-surface p-5">
            <h3 className="text-sm font-bold text-ink-2">Reject quantity change?</h3>
            <p className="text-xs text-ink-muted">
              {rejectTarget.material?.name}: {rejectTarget.oldQuantity} → {rejectTarget.newQuantity}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              rows={3}
              className="w-full rounded-lg border border-line px-3 py-2 text-xs focus:outline-none focus:border-rose-300 dark:focus:border-rose-500/30"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-lg border border-line px-4 py-2 text-xs font-semibold text-ink-2 hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={reject}
                disabled={busyId !== null || !rejectReason.trim()}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busyId ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
