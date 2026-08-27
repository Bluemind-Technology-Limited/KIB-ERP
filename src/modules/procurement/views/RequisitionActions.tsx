import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';

const reqStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
};

export default function RequisitionActions({ searchQuery = '' }: { searchQuery?: string }) {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionConfirmation, setActionConfirmation] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const filteredRequisitions = requisitions.filter((r) =>
    r.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.requestedBy?.fullName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionConfirmation({ id, action });
  };

  const confirmAction = async () => {
    if (!actionConfirmation) return;
    setIsProcessing(true);
    try {
      await axiosClient.patch(
        `/procurement/requisitions/${actionConfirmation.id}/${actionConfirmation.action}`
      );
      setActionConfirmation(null);
      loadRequisitions();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Action failed');
      setActionConfirmation(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Requisition Approvals</h2>
          <p className="text-[#737373] text-xs">Review and approve pending requisitions.</p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>}

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
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-16 rounded-lg" />
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
                    onClick={() => handleAction(r.id, 'approve')}
                    className="h-8 px-3 rounded-lg border border-emerald-200 text-emerald-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-emerald-50"
                  >
                    <Check className="w-3 h-3" /> Approve
                  </button>
                  <button 
                    onClick={() => handleAction(r.id, 'reject')}
                    className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold flex items-center gap-1 hover:bg-rose-50"
                  >
                    <X className="w-3 h-3" /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Action Confirmation Modal */}
      {actionConfirmation && (
        <ConfirmationModal
          type={actionConfirmation.action === 'approve' ? 'action' : 'delete'}
          title={actionConfirmation.action === 'approve' ? 'Approve Requisition' : 'Reject Requisition'}
          description={
            actionConfirmation.action === 'approve'
              ? 'This requisition will be approved and forwarded to procurement.'
              : 'This requisition will be rejected and the requester will be notified.'
          }
          onConfirm={confirmAction}
          onCancel={() => setActionConfirmation(null)}
          isLoading={isProcessing}
        />
      )}
    </div>
  );
}
