import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface Reconciliation {
  id: string;
  productionPlanId: string;
  reconciliationDate: string;
  status: string;
  supervisor: { fullName: string };
  plannedTotal?: number;
  actualTotal?: number;
  variance?: number;
  variancePercentage?: number;
  flaggedIssue?: string;
}

export default function ReconciliationHistory() {
  const { planId } = useParams<{ planId: string }>();
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      if (!planId) return;
      try {
        const res = await axiosClient.get(`/api/supervisor/production-plans/${planId}/reconciliation-history`);
        setReconciliations(res.data.reconciliations || []);
      } catch (err) {
        console.error('Failed to load reconciliation history:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [planId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'FLAGGED':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'PENDING':
        return <Loader className="w-4 h-4 text-amber-600 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'FLAGGED':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'PENDING':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 5) return 'text-rose-600';
    if (variance < -5) return 'text-amber-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
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
          title="No reconciliations"
          hint="Daily reconciliations will appear here after completion"
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <h3 className="text-sm font-bold text-[#171717]">Reconciliation History</h3>
      {reconciliations.map((recon) => (
        <div
          key={recon.id}
          className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden hover:shadow-md transition-shadow"
        >
          {/* Header - Clickable */}
          <button
            onClick={() => setExpandedId(expandedId === recon.id ? null : recon.id)}
            className="w-full text-left p-4 hover:bg-slate-50 flex items-center justify-between"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                {getStatusIcon(recon.status)}
                <span className="text-sm font-bold text-slate-700">
                  {new Date(recon.reconciliationDate).toLocaleDateString()}
                </span>
                <span className={`text-xs font-semibold px-2 py-1 rounded border ${getStatusColor(recon.status)}`}>
                  {recon.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">By {recon.supervisor?.fullName}</p>
            </div>

            {/* Variance Badge */}
            {recon.variancePercentage !== undefined && (
              <div className="text-right mr-2">
                <p className={`text-sm font-bold ${getVarianceColor(recon.variancePercentage)}`}>
                  {recon.variancePercentage > 0 ? '+' : ''}{recon.variancePercentage.toFixed(1)}%
                </p>
                <p className="text-[9px] text-slate-500">variance</p>
              </div>
            )}

            {/* Chevron */}
            <div className={`text-slate-400 transition-transform ${expandedId === recon.id ? 'rotate-180' : ''}`}>
              ▼
            </div>
          </button>

          {/* Details - Expandable */}
          {expandedId === recon.id && (
            <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-4">
              {/* Quantities */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[9px] font-semibold text-slate-500 mb-1">Planned</p>
                  <p className="text-sm font-bold text-slate-700">
                    {recon.plannedTotal?.toFixed(2) || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-slate-500 mb-1">Actual</p>
                  <p className="text-sm font-bold text-slate-700">
                    {recon.actualTotal?.toFixed(2) || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-slate-500 mb-1">Variance</p>
                  <p className={`text-sm font-bold ${getVarianceColor(recon.variancePercentage || 0)}`}>
                    {(recon.variance || 0) > 0 ? '+' : ''}{(recon.variance || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Issue if Flagged */}
              {recon.status === 'FLAGGED' && recon.flaggedIssue && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-[9px] font-semibold text-rose-700 mb-1">Flagged Issue</p>
                  <p className="text-xs text-rose-600">{recon.flaggedIssue}</p>
                </div>
              )}

              {/* Action Buttons */}
              {recon.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 bg-green-100 text-green-700 font-semibold text-xs rounded-lg hover:bg-green-200 transition-colors">
                    Verify
                  </button>
                  <button className="flex-1 px-3 py-2 bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg hover:bg-rose-200 transition-colors">
                    Flag Issue
                  </button>
                </div>
              )}

              {/* View Details Link */}
              <a
                href={`/production/supervisor/reconciliations/${recon.id}`}
                className="block text-center px-3 py-2 bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-300 transition-colors"
              >
                View Full Details →
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
