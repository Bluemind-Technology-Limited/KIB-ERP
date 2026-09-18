import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader, ShieldCheck, XCircle } from 'lucide-react';
import { axiosClient } from '../../lib/axiosClient';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';

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

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function QuantityApprovals() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Adjustment | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#171717]">Quantity Approvals</h2>
        <p className="text-[#737373] text-xs">
          Approve quantity corrections proposed by QC. Only an approved change is written to inventory.
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold text-blue-700">Awaiting your approval</p>
            <p className="text-2xl font-bold text-blue-900">{adjustments.length}</p>
          </div>
          <Clock className="h-8 w-8 text-blue-300" />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#E9E9E9] bg-white p-4">
              <Skeleton className="mb-3 h-4 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : adjustments.length === 0 ? (
        <div className="rounded-xl border border-[#E9E9E9] bg-white">
          <EmptyState title="No quantity changes pending" hint="QC-proposed corrections appear here." />
        </div>
      ) : (
        <div className="space-y-3">
          {adjustments.map((adjustment) => {
            const diff = Number(adjustment.difference);
            return (
              <div
                key={adjustment.id}
                className="rounded-xl border border-[#E9E9E9] bg-white p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#AA3BFF]/10">
                      <ShieldCheck className="h-4 w-4 text-[#AA3BFF]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#171717]">
                        {adjustment.material?.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        <span className="font-mono">{adjustment.material?.sku}</span>
                        {adjustment.consignment?.consignmentNumber
                          ? ` · ${adjustment.consignment.consignmentNumber}`
                          : ''}
                        {adjustment.requestedBy?.fullName
                          ? ` · by ${adjustment.requestedBy.fullName}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold ${
                      diff < 0
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {diff > 0 ? '+' : ''}
                    {diff} {adjustment.material?.unitOfMeasure}
                  </span>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[9px] text-slate-500">Current</p>
                    <p className="text-sm font-bold text-slate-700">{adjustment.oldQuantity}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[9px] text-slate-500">Proposed</p>
                    <p className="text-sm font-bold text-slate-700">{adjustment.newQuantity}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[9px] text-slate-500">Reason</p>
                    <p className="text-sm font-bold text-slate-700">
                      {(adjustment.reasonCode ?? 'ADJUSTMENT').replace('_', ' ')}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[9px] text-slate-500">Requested</p>
                    <p className="text-[11px] font-semibold text-slate-700">
                      {new Date(adjustment.requestedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {adjustment.reason && (
                  <p className="mb-3 rounded-lg border border-slate-100 bg-slate-50 p-2 text-[11px] text-slate-600">
                    {adjustment.reason}
                  </p>
                )}

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
                    className="flex items-center gap-2 rounded-lg border border-rose-200 px-4 h-9 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejectTarget && (
        <Modal onClose={() => setRejectTarget(null)}>
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5">
            <h3 className="text-sm font-bold text-slate-700">Reject quantity change?</h3>
            <p className="text-xs text-slate-600">
              {rejectTarget.material?.name}: {rejectTarget.oldQuantity} → {rejectTarget.newQuantity}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-rose-300"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
