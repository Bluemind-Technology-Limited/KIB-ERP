import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader, Trash2 } from 'lucide-react';
import { axiosClient } from '../../lib/axiosClient';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

interface PendingConsignment {
  id: string;
  consignmentNumber: string;
  supplier: { supplierName: string };
  warehouse: { warehouseName: string };
  receivedAt: string;
  items: any[];
  qualityApproval: {
    id: string;
    status: string;
    totalItems: number;
    passedItems: number;
    failedItems: number;
    startedBy: { fullName: string };
    startedAt: string;
  };
}

export default function QualityCheckDashboard() {
  const [consignments, setConsignments] = useState<PendingConsignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const loadConsignments = async () => {
      try {
        const res = await axiosClient.get('/api/quality/pending', {
          params: { limit: 50 },
        });
        setConsignments(res.data.consignments);
        setError('');
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load consignments');
      } finally {
        setLoading(false);
      }
    };

    loadConsignments();
  }, []);

  const handleDelete = async (approvalId: string, consignmentNumber: string) => {
    if (!confirm(`Delete quality checks for ${consignmentNumber}? This will revert the consignment to RECEIVED status.`)) {
      return;
    }

    setDeleting(approvalId);
    try {
      await axiosClient.delete(`/api/quality/approvals/${approvalId}`);
      setError('');
      // Reload consignments
      const res = await axiosClient.get('/api/quality/pending', { params: { limit: 50 } });
      setConsignments(res.data.consignments);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete quality checks');
    } finally {
      setDeleting(null);
    }
  };

  const getCompletionPercentage = (qa: any) => {
    const completed = qa.passedItems + qa.failedItems;
    return Math.round((completed / qa.totalItems) * 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage === 100) return 'bg-green-500';
    if (percentage > 50) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#171717]">Quality Checks</h2>
        <p className="text-xs text-[#737373] mt-1">Review and approve consignments for release to inventory</p>
      </div>

      {/* Pending Count Badge */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-700 mb-1">Awaiting QA Review</p>
            <p className="text-2xl font-bold text-blue-900">{consignments.length}</p>
          </div>
          <Clock className="w-8 h-8 text-blue-300" />
        </div>
      </div>

      {/* Consignments List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E9E9E9] rounded-xl p-4">
              <Skeleton className="h-4 w-48 mb-3" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-80" />
            </div>
          ))
        ) : consignments.length === 0 ? (
          <div className="bg-white border border-[#E9E9E9] rounded-xl">
            <EmptyState title="No pending consignments" hint="All consignments have been reviewed" />
          </div>
        ) : (
          consignments.map((consignment) => {
            const completion = getCompletionPercentage(consignment.qualityApproval);
            const hasFailures = consignment.qualityApproval.failedItems > 0;

            return (
              <div
                key={consignment.id}
                className="bg-white border border-[#E9E9E9] rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-700">{consignment.consignmentNumber}</h3>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      From {consignment.supplier?.supplierName} → {consignment.warehouse?.warehouseName}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1">
                      Received: {new Date(consignment.receivedAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {hasFailures ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-rose-100 border border-rose-200 text-rose-700 rounded text-[9px] font-semibold">
                        <AlertCircle className="w-3 h-3" />
                        FAILED
                      </span>
                    ) : completion === 100 ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 border border-green-200 text-green-700 rounded text-[9px] font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        READY
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 border border-blue-200 text-blue-700 rounded text-[9px] font-semibold">
                        <Loader className="w-3 h-3 animate-spin" />
                        IN PROGRESS
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[9px] font-semibold text-slate-600">Check Progress</span>
                    <span className="text-[9px] font-bold text-slate-700">{completion}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor(completion)} transition-all`}
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-slate-50 rounded p-2">
                    <p className="text-[9px] text-slate-500 mb-0.5">Total Items</p>
                    <p className="text-sm font-bold text-slate-700">{consignment.qualityApproval.totalItems}</p>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <p className="text-[9px] text-green-600 mb-0.5">Passed</p>
                    <p className="text-sm font-bold text-green-700">{consignment.qualityApproval.passedItems}</p>
                  </div>
                  <div className={`${hasFailures ? 'bg-rose-50' : 'bg-slate-50'} rounded p-2`}>
                    <p className={`text-[9px] ${hasFailures ? 'text-rose-600' : 'text-slate-500'} mb-0.5`}>
                      Failed
                    </p>
                    <p className={`text-sm font-bold ${hasFailures ? 'text-rose-700' : 'text-slate-700'}`}>
                      {consignment.qualityApproval.failedItems}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <a
                    href={`/quality/checks/${consignment.id}`}
                    className="flex-1 text-center px-3 py-2 bg-[#AA3BFF] text-white text-xs font-semibold rounded-lg hover:bg-[#9a2ff5] transition-colors"
                  >
                    Review Checks →
                  </a>
                  <button
                    onClick={() => handleDelete(consignment.qualityApproval.id, consignment.consignmentNumber)}
                    disabled={deleting === consignment.qualityApproval.id}
                    className="px-3 py-2 bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-200 transition-colors disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                    title="Delete quality checks and revert consignment"
                  >
                    {deleting === consignment.qualityApproval.id ? (
                      <Loader className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
