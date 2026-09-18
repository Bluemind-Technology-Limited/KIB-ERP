import { useEffect, useState } from 'react';
import { useCostManagementStore } from '../../../stores/useCostManagementStore';
import { Modal } from '../../../components/ui/Modal';

export default function CostApprovalWorkflow() {
  const {
    fetchPendingApprovals,
    approveCostChange,
    pendingApprovals,
    isLoading,
    error,
  } = useCostManagementStore();

  const [selectedApproval, setSelectedApproval] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchPendingApprovals();
    const interval = setInterval(fetchPendingApprovals, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (auditId: string) => {
    setIsProcessing(true);
    try {
      await approveCostChange({
        auditId,
        approved: true,
      });
      setSelectedApproval(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (auditId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setIsProcessing(true);
    try {
      await approveCostChange({
        auditId,
        approved: false,
        rejectionReason,
      });
      setSelectedApproval(null);
      setRejectionReason('');
    } finally {
      setIsProcessing(false);
    }
  };

  const getApprovalLevelBadge = (level: string) => {
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${
          level === 'EXECUTIVE'
            ? 'bg-red-100 text-red-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}
      >
        {level === 'EXECUTIVE' ? 'Executive Approval Required' : 'Manager Approval Required'}
      </span>
    );
  };

  const getVarianceColor = (percent: number) => {
    if (percent > 10) return 'text-red-600 bg-red-50';
    if (percent > 5) return 'text-orange-600 bg-orange-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  if (isLoading && pendingApprovals.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center justify-center h-32">
          <p className="text-gray-500">Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  if (pendingApprovals.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500 text-lg mb-2">No pending approvals</p>
        <p className="text-gray-400">All cost changes are up to date</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {pendingApprovals.map((approval) => (
        <div
          key={approval.id}
          className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {approval.entityName || approval.entityId}
                  </h3>
                  {getApprovalLevelBadge(approval.requiredApprovalLevel)}
                </div>
                <p className="text-sm text-gray-600">
                  {approval.entityType} • {approval.fieldName}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${getVarianceColor(approval.variancePercent)}`}>
                <p className="text-xs font-medium mb-1">Variance</p>
                <p className="text-lg font-bold">
                  {approval.variancePercent > 0 ? '+' : ''}
                  {approval.variancePercent.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-600 mb-1">Old Value</p>
                <p className="font-mono text-sm font-semibold text-gray-900">
                  ₦{approval.oldValue.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">New Value</p>
                <p className="font-mono text-sm font-semibold text-gray-900">
                  ₦{approval.newValue.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Variance Amount</p>
                <p className={`font-mono text-sm font-semibold ${
                  approval.variance > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {approval.variance > 0 ? '+' : ''}₦{Math.abs(approval.variance).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Requested By</p>
                <p className="text-sm text-gray-900">{approval.changedBy}</p>
              </div>
            </div>

            {/* Reason */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-600 mb-2">Reason</p>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                {approval.reason}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(approval.id)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={() => setSelectedApproval(approval.id)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Rejection Modal */}
      {selectedApproval && (
        <Modal onClose={() => setSelectedApproval(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Reject Cost Change</h3>

            <p className="text-gray-600 mb-6">
              Please provide a reason for rejecting this cost change. This will be visible to the requester.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none mb-6"
              disabled={isProcessing}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedApproval(null)}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedApproval)}
                disabled={isProcessing || !rejectionReason.trim()}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
