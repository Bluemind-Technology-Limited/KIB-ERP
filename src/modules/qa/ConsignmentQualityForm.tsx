import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader, ChevronDown } from 'lucide-react';
import { axiosClient } from '../../lib/axiosClient';
import { formatQty } from '../../lib/format';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';

interface CheckItem {
  id: string;
  checkType: string;
  status: string;
  result?: string;
  remarks?: string;
  consignmentItem: {
    material: {
      name: string;
      sku: string;
    };
    quantity: number;
    unitOfMeasure: string;
  };
}

export default function ConsignmentQualityForm() {
  const { consignmentId } = useParams<{ consignmentId: string }>();
  const [qualityStatus, setQualityStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  useEffect(() => {
    const loadQualityStatus = async () => {
      if (!consignmentId) return;
      try {
        const res = await axiosClient.get(`/api/quality/approvals/${consignmentId}`);
        setQualityStatus(res.data.data);
        setError('');
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load quality status');
      } finally {
        setLoading(false);
      }
    };

    loadQualityStatus();
  }, [consignmentId]);

  const handleCheckUpdate = async (checkItemId: string, checkType: string, result: 'PASS' | 'FAIL', remarks?: string) => {
    setSaving(true);
    try {
      await axiosClient.patch(`/api/quality/approvals/items/${checkItemId}`, {
        checkType,
        result,
        remarks,
      });

      // Reload quality status
      if (consignmentId) {
        const res = await axiosClient.get(`/api/quality/approvals/${consignmentId}`);
        setQualityStatus(res.data.data);
      }

      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update check');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!qualityStatus) return;

    setSaving(true);
    try {
      await axiosClient.post(`/api/quality/approvals/${qualityStatus.id}/approve`, {
        notes: 'All checks passed - consignment approved for release',
      });

      setShowApprovalModal(false);
      setError('');
      alert('Consignment approved! Stock manager can now access this consignment.');
      // Reload
      if (consignmentId) {
        const res = await axiosClient.get(`/api/quality/approvals/${consignmentId}`);
        setQualityStatus(res.data.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to approve consignment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error && !qualityStatus) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 flex items-start gap-2 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        {error}
      </div>
    );
  }

  if (!qualityStatus) {
    return <div className="text-center text-ink-muted">Quality status not found</div>;
  }

  const { checkItems, summary } = qualityStatus;
  const allChecksPassed = summary.failedItems === 0 && summary.pendingItems === 0;
  const hasFailures = summary.failedItems > 0;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-ink">Quality Check Review</h2>
        <p className="text-xs text-ink-muted mt-1">Review and record checks for each consignment item</p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-surface border border-line rounded-xl p-3">
          <p className="text-[9px] font-semibold text-ink-muted mb-1">Status</p>
          <p className="text-sm font-bold text-ink-2">{qualityStatus.status}</p>
        </div>
        <div className="bg-surface border border-line rounded-xl p-3">
          <p className="text-[9px] font-semibold text-ink-muted mb-1">Total Items</p>
          <p className="text-sm font-bold text-ink-2">{summary.totalItems}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 dark:bg-green-500/10 dark:border-green-500/30">
          <p className="text-[9px] font-semibold text-green-600 mb-1 dark:text-green-300">Passed</p>
          <p className="text-sm font-bold text-green-700 dark:text-green-300">{summary.passedItems}</p>
        </div>
        <div className={`${hasFailures ? 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30' : 'bg-surface-2 border-line'} border rounded-xl p-3`}>
          <p className={`text-[9px] font-semibold ${hasFailures ? 'text-rose-600 dark:text-rose-300' : 'text-ink-muted'} mb-1`}>
            Failed
          </p>
          <p className={`text-sm font-bold ${hasFailures ? 'text-rose-700 dark:text-rose-300' : 'text-ink-2'}`}>
            {summary.failedItems}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="flex justify-between mb-2">
          <span className="text-xs font-semibold text-ink-muted">Overall Completion</span>
          <span className="text-xs font-bold text-ink-2">{summary.completionPercentage}%</span>
        </div>
        <div className="w-full h-3 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#AA3BFF] transition-all"
            style={{ width: `${summary.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Check Items */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-ink-2">Items to Check ({checkItems.length})</h3>

        {checkItems.map((item: CheckItem) => (
          <div
            key={item.id}
            className="bg-surface border border-line rounded-xl overflow-hidden"
          >
            {/* Item Header - Clickable */}
            <button
              onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
              className="w-full text-left p-4 hover:bg-surface-2 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {item.result === 'PASS' && <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-300" />}
                  {item.result === 'FAIL' && <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-300" />}
                  <span className="text-sm font-bold text-ink-2">
                    {item.consignmentItem?.material?.name}
                  </span>
                </div>
                <p className="text-[9px] text-ink-muted">
                  {formatQty(item.consignmentItem?.quantity ?? 0, item.consignmentItem?.unitOfMeasure)}
                </p>
              </div>

              {/* Status Badge */}
              {item.result === 'PASS' && (
                <span className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider mr-2 bg-green-600 text-white">
                  PASS
                </span>
              )}
              {item.result === 'FAIL' && (
                <span className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider mr-2 bg-rose-600 text-white">
                  FAIL
                </span>
              )}
              {!item.result && (
                <span className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider mr-2 bg-slate-600 text-white">
                  PENDING
                </span>
              )}

              <ChevronDown
                className={`w-4 h-4 text-ink-faint transition-transform ${
                  expandedItemId === item.id ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Expanded Details */}
            {expandedItemId === item.id && (
              <div className="border-t border-line bg-surface-2 p-4 space-y-3">
                {/* Check Type Selection */}
                <div>
                  <label className="text-[9px] font-semibold text-ink-muted mb-1 block">
                    Check Type
                  </label>
                  <select className="w-full px-3 py-2 border border-line rounded-lg text-xs text-ink-2 focus:outline-none focus:border-[#AA3BFF]">
                    <option>PHYSICAL_INSPECTION</option>
                    <option>QUANTITY_VERIFICATION</option>
                    <option>EXPIRY_CHECK</option>
                    <option>PACKAGING_INSPECTION</option>
                    <option>DOCUMENTATION_REVIEW</option>
                    <option>LABORATORY_TEST</option>
                  </select>
                </div>

                {/* Result Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleCheckUpdate(item.id, item.checkType || 'PHYSICAL_INSPECTION', 'PASS')}
                    className={`px-3 py-2 rounded-lg font-semibold text-xs transition-colors ${
                      item.result === 'PASS'
                        ? 'bg-green-600 text-white'
                        : 'bg-surface text-ink-2 border border-line hover:border-green-200 dark:hover:border-green-500/30'
                    }`}
                  >
                    ✓ Pass
                  </button>
                  <button
                    onClick={() => handleCheckUpdate(item.id, item.checkType || 'PHYSICAL_INSPECTION', 'FAIL')}
                    className={`px-3 py-2 rounded-lg font-semibold text-xs transition-colors ${
                      item.result === 'FAIL'
                        ? 'bg-rose-600 text-white'
                        : 'bg-surface text-ink-2 border border-line hover:border-rose-200 dark:hover:border-rose-500/30'
                    }`}
                  >
                    ✗ Fail
                  </button>
                </div>

                {/* Remarks */}
                <div>
                  <label className="text-[9px] font-semibold text-ink-muted mb-1 block">
                    Remarks (optional)
                  </label>
                  <textarea
                    placeholder="Add any notes or issues found during inspection..."
                    defaultValue={item.remarks || ''}
                    className="w-full px-3 py-2 border border-line rounded-lg text-xs text-ink-2 focus:outline-none focus:border-[#AA3BFF]"
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Failed Items Alert */}
      {hasFailures && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-500/10">
          <p className="text-xs font-semibold text-rose-700 mb-2 dark:text-rose-300">⚠️ Failed Items Detected</p>
          <p className="text-[9px] text-rose-600 dark:text-rose-300">
            {summary.failedItems} item(s) failed QA checks. Consignment cannot be approved until issues are resolved.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {allChecksPassed && summary.pendingItems === 0 && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowApprovalModal(true)}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Approve for Release
          </button>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <Modal onClose={() => setShowApprovalModal(false)}>
          <div className="bg-surface rounded-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink-2">Approve Consignment?</h3>
            <p className="text-xs text-ink-muted">
              All items have passed QA checks. Approve to release consignment for inventory distribution.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="flex-1 px-4 py-2 border border-line text-ink-2 font-semibold rounded-lg hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
