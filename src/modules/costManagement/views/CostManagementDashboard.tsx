import { useEffect, useState } from 'react';
import { useCostManagementStore } from '../../../stores/useCostManagementStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import CostApprovalWorkflow from '../components/CostApprovalWorkflow';
import CostHistoryViewer from '../components/CostHistoryViewer';
import CostEditModal from '../components/CostEditModal';
import type { EntityType, CostHistoryItem } from '../../../types/costManagement';
import { DetailsModal, ViewButton, detailDate, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { formatMoney, formatNumber, formatPercent } from '../../../lib/format';

export default function CostManagementDashboard() {
  const {
    fetchPendingApprovals,
    fetchAuditSummary,
    pendingApprovals,
    auditSummary,
    error,
    successMessage,
    clearError,
    clearSuccess,
  } = useCostManagementStore();

  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'approvals' | 'history'>('dashboard');
  const [showCostEditModal, setShowCostEditModal] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState<EntityType>('Material');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [viewing, setViewing] = useState<CostHistoryItem | null>(null);

  // Determine if user can approve costs
  const canApprove = ['SUPER_ADMIN', 'EXECUTIVE_ADMIN'].includes(user?.role || '');
  const canModify = ['SUPER_ADMIN', 'EXECUTIVE_ADMIN', 'PROCUREMENT_OFFICER', 'PRODUCTION_MANAGER', 'STORE_OFFICER'].includes(user?.role || '');

  useEffect(() => {
    fetchPendingApprovals();
    fetchAuditSummary();
    const interval = setInterval(() => {
      fetchPendingApprovals();
      fetchAuditSummary();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(clearSuccess, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleOpenCostEdit = (entityType: EntityType, entityId: string) => {
    setSelectedEntityType(entityType);
    setSelectedEntityId(entityId);
    setShowCostEditModal(true);
  };

  return (
    <div className="min-h-screen bg-surface-2 p-6 dark:bg-surface-20/10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-ink mb-2 dark:text-ink-faint">Cost Management</h1>
        <PageDescription>Manage, approve, and track cost modifications across all resources</PageDescription>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-500/10 dark:border-red-500/30">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-500/10 dark:border-green-500/30">
          <p className="text-green-800 dark:text-green-300">{successMessage}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-8 border-b border-line dark:border-gray-500/30">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-4 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-blue-600 text-blue-600 dark:text-blue-300'
                : 'border-transparent text-ink-muted hover:text-ink dark:text-ink-faint dark:hover:text-ink-faint'
            }`}
          >
            Dashboard
          </button>
          {canApprove && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`pb-4 px-1 font-medium border-b-2 transition-colors relative ${
                activeTab === 'approvals'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-300'
                  : 'border-transparent text-ink-muted hover:text-ink dark:text-ink-faint dark:hover:text-ink-faint'
              }`}
            >
              Approvals
              {pendingApprovals.length > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {formatNumber(pendingApprovals.length)}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-4 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-300'
                : 'border-transparent text-ink-muted hover:text-ink dark:text-ink-faint dark:hover:text-ink-faint'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {auditSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-surface rounded-lg shadow p-6">
                <p className="text-ink-muted text-sm font-medium dark:text-ink-faint">Total Changes</p>
                <p className="text-3xl font-bold text-ink mt-2 dark:text-ink-faint">{formatNumber(auditSummary.totalChanges)}</p>
              </div>
              <div className="bg-surface rounded-lg shadow p-6">
                <p className="text-ink-muted text-sm font-medium dark:text-ink-faint">Pending Approval</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2 dark:text-yellow-300">{formatNumber(auditSummary.pendingApprovals)}</p>
              </div>
              <div className="bg-surface rounded-lg shadow p-6">
                <p className="text-ink-muted text-sm font-medium dark:text-ink-faint">Approved</p>
                <p className="text-3xl font-bold text-green-600 mt-2 dark:text-green-300">{formatNumber(auditSummary.approvedChanges)}</p>
              </div>
              <div className="bg-surface rounded-lg shadow p-6">
                <p className="text-ink-muted text-sm font-medium dark:text-ink-faint">Rejected</p>
                <p className="text-3xl font-bold text-red-600 mt-2 dark:text-red-300">{formatNumber(auditSummary.rejectedChanges)}</p>
              </div>
              <div className="bg-surface rounded-lg shadow p-6">
                <p className="text-ink-muted text-sm font-medium dark:text-ink-faint">Avg Variance %</p>
                <p className="text-3xl font-bold text-ink mt-2 dark:text-ink-faint">
                  {formatPercent(auditSummary.averageVariancePercent, 2)}
                </p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {canModify && (
            <div className="bg-surface rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-ink mb-4 dark:text-ink-faint">Quick Actions</h2>
              <button
                onClick={() => handleOpenCostEdit('Material', '')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Request Cost Change
              </button>
            </div>
          )}

          {/* Recent Changes */}
          {auditSummary && auditSummary.recentChanges.length > 0 && (
            <div className="bg-surface rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-line dark:border-gray-500/30">
                <h2 className="text-lg font-semibold text-ink dark:text-ink-faint">Recent Changes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-2 dark:bg-surface-20/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-medium text-ink-2 dark:text-ink-faint">Field</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-ink-2 dark:text-ink-faint">Old Value</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-ink-2 dark:text-ink-faint">New Value</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-ink-2 dark:text-ink-faint">Variance %</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-ink-2 dark:text-ink-faint">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-ink-2 dark:text-ink-faint">Changed By</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-ink-2 dark:text-ink-faint">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-500/30">
                    {auditSummary.recentChanges.slice(0, 5).map((item) => (
                      <tr key={item.id} className="hover:bg-surface-2">
                        <td className="px-6 py-4 text-sm text-ink dark:text-ink-faint">{item.fieldName}</td>
                        <td className="px-6 py-4 text-sm text-ink-muted dark:text-ink-faint">{formatMoney(item.oldValue)}</td>
                        <td className="px-6 py-4 text-sm text-ink-muted dark:text-ink-faint">{formatMoney(item.newValue)}</td>
                        <td className="px-6 py-4 text-sm font-medium">
                          <span className={item.variancePercent > 0 ? 'text-red-600 dark:text-red-300' : 'text-green-600 dark:text-green-300'}>
                            {item.variancePercent > 0 ? '+' : ''}{formatPercent(item.variancePercent, 2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              item.status === 'APPROVED'
                                ? 'bg-green-600 text-white'
                                : item.status === 'PENDING'
                                ? 'bg-yellow-600 text-white'
                                : 'bg-red-600 text-white'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-ink-muted dark:text-ink-faint">{item.changedBy}</td>
                        <td className="px-6 py-4 text-sm text-right">
                          <ViewButton onClick={() => setViewing(item)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && <CostApprovalWorkflow />}

      {/* History Tab */}
      {activeTab === 'history' && <CostHistoryViewer />}

      {/* Cost Edit Modal */}
      {showCostEditModal && (
        <CostEditModal
          isOpen={showCostEditModal}
          onClose={() => {
            setShowCostEditModal(false);
            setSelectedEntityId('');
          }}
          entityType={selectedEntityType}
          entityId={selectedEntityId}
        />
      )}

      {viewing && (
        <DetailsModal
          title={viewing.fieldName}
          subtitle={viewing.changedBy}
          status={{
            label: viewing.status,
            className:
              viewing.status === 'APPROVED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
                : viewing.status === 'PENDING'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30'
                  : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
          }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Cost change',
              fields: [
                { label: 'Field', value: detailValue(viewing.fieldName) },
                { label: 'Status', value: detailValue(viewing.status) },
                { label: 'Old value', value: formatMoney(viewing.oldValue) },
                { label: 'New value', value: formatMoney(viewing.newValue) },
                { label: 'Variance', value: `${viewing.variance > 0 ? '+' : ''}${formatMoney(Math.abs(viewing.variance))}` },
                { label: 'Variance %', value: `${viewing.variancePercent > 0 ? '+' : ''}${formatPercent(viewing.variancePercent, 2)}` },
              ],
            },
            {
              title: 'Reason',
              fields: [{ label: 'Reason', value: detailValue(viewing.reason), wide: true }],
            },
            {
              title: 'Audit trail',
              fields: [
                { label: 'Changed by', value: detailValue(viewing.changedBy) },
                { label: 'Changed at', value: detailDate(viewing.changedAt, true) },
                { label: 'Approved by', value: detailValue(viewing.approvedBy) },
                { label: 'Approved at', value: viewing.approvedAt ? detailDate(viewing.approvedAt, true) : '—' },
                { label: 'Change ID', value: <span className="font-mono text-[10px]">{detailValue(viewing.id)}</span>, wide: true },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
