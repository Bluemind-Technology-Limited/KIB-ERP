import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useAuthStore } from '../../../stores/useAuthStore';

/** Shape returned by GET /supervisor/production-plans/:planId/reconciliation-history */
interface Reconciliation {
  id: string;
  productionPlanId: string;
  reconciliationDate: string;
  status: string;
  supervisor: { fullName: string } | null;
  plannedTotalQuantity: string | number;
  actualTotalQuantity: string | number;
  quantityVariance: string | number;
  variancePercentage: string | number;
  discrepancyNotes?: string | null;
}

/**
 * Reconciliation history for one plan.
 *
 * Verify/flag is a sign-off, gated on `production:approve` (managers only), and
 * the creator cannot verify their own record — matching the server rules.
 */
export default function ReconciliationHistory({ planId }: { planId: string }) {
  const currentUser = useAuthStore((s) => s.user);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canApprove = ['SUPER_ADMIN', 'PRODUCTION_MANAGER'].includes(currentUser?.role ?? '');

  useEffect(() => {
    const loadHistory = async () => {
      if (!planId) {
        setLoading(false);
        return;
      }
      try {
        const res = await axiosClient.get<{ reconciliations: Reconciliation[] }>(
          `/supervisor/production-plans/${planId}/reconciliation-history`
        );
        setReconciliations(res.data.reconciliations ?? []);
      } catch {
        // The page-level toast already reports the failure.
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [planId, reloadKey]);

  const act = async (id: string, action: 'verify' | 'flag') => {
    setBusyId(id);
    try {
      await axiosClient.post(
        `/supervisor/daily-reconciliations/${id}/${action}`,
        {},
        { toast: { success: action === 'verify' ? 'Reconciliation verified' : 'Reconciliation flagged' } }
      );
      setReloadKey((k) => k + 1);
    } catch {
      // toast handled globally
    } finally {
      setBusyId(null);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'FLAGGED':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      default:
        return <Loader className="w-4 h-4 text-amber-600" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'FLAGGED':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      default:
        return 'bg-amber-50 border-amber-200 text-amber-700';
    }
  };

  const varianceColor = (percent: number) => {
    if (percent > 5) return 'text-rose-600';
    if (percent < -5) return 'text-amber-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white border border-[#E9E9E9] rounded-xl p-4">
            <Skeleton className="h-4 w-48 mb-3" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (reconciliations.length === 0) {
    return (
      <div className="bg-white border border-[#E9E9E9] rounded-xl">
        <EmptyState
          title="No reconciliations yet"
          hint="Create one with “Reconcile day” once production has been recorded."
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <h3 className="text-sm font-bold text-[#171717]">Reconciliation History</h3>
      {reconciliations.map((recon) => {
        const percent = Number(recon.variancePercentage ?? 0);
        const planned = Number(recon.plannedTotalQuantity ?? 0);
        const actual = Number(recon.actualTotalQuantity ?? 0);
        const variance = Number(recon.quantityVariance ?? 0);

        return (
          <div key={recon.id} className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === recon.id ? null : recon.id)}
              className="w-full text-left p-4 hover:bg-slate-50 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  {statusIcon(recon.status)}
                  <span className="text-sm font-bold text-slate-700">
                    {new Date(recon.reconciliationDate).toLocaleDateString()}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded border ${statusColor(recon.status)}`}>
                    {recon.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">By {recon.supervisor?.fullName ?? '—'}</p>
              </div>

              <div className="text-right mr-2">
                <p className={`text-sm font-bold ${varianceColor(percent)}`}>
                  {percent > 0 ? '+' : ''}
                  {percent.toFixed(1)}%
                </p>
                <p className="text-[9px] text-slate-500">variance</p>
              </div>

              <div className={`text-slate-400 transition-transform ${expandedId === recon.id ? 'rotate-180' : ''}`}>
                ▼
              </div>
            </button>

            {expandedId === recon.id && (
              <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[9px] font-semibold text-slate-500 mb-1">Planned</p>
                    <p className="text-sm font-bold text-slate-700">{planned.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-slate-500 mb-1">Actual</p>
                    <p className="text-sm font-bold text-slate-700">{actual.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-slate-500 mb-1">Variance</p>
                    <p className={`text-sm font-bold ${varianceColor(percent)}`}>
                      {variance > 0 ? '+' : ''}
                      {variance.toFixed(2)}
                    </p>
                  </div>
                </div>

                {recon.discrepancyNotes && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-[9px] font-semibold text-amber-700 mb-1">Note</p>
                    <p className="text-xs text-amber-700">{recon.discrepancyNotes}</p>
                  </div>
                )}

                {recon.status === 'PENDING' && (
                  canApprove ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => act(recon.id, 'verify')}
                        disabled={busyId === recon.id}
                        className="flex-1 px-3 py-2 bg-green-100 text-green-700 font-semibold text-xs rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => act(recon.id, 'flag')}
                        disabled={busyId === recon.id}
                        className="flex-1 px-3 py-2 bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg hover:bg-rose-200 disabled:opacity-50 transition-colors"
                      >
                        Flag Issue
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">
                      Awaiting manager sign-off — production managers verify or flag reconciliations.
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
