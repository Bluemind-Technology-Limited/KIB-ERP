import { useEffect, useState } from 'react';
import { useCostManagementStore } from '../../../stores/useCostManagementStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import CostApprovalWorkflow from '../components/CostApprovalWorkflow';
import CostHistoryViewer from '../components/CostHistoryViewer';
import CostEditModal from '../components/CostEditModal';
import type { EntityType } from '../../../types/costManagement';

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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Cost Management</h1>
        <p className="text-gray-600">Manage, approve, and track cost modifications across all resources</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-8 border-b border-gray-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-4 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Dashboard
          </button>
          {canApprove && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`pb-4 px-1 font-medium border-b-2 transition-colors relative ${
                activeTab === 'approvals'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Approvals
              {pendingApprovals.length > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingApprovals.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-4 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
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
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm font-medium">Total Changes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{auditSummary.totalChanges}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm font-medium">Pending Approval</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{auditSummary.pendingApprovals}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm font-medium">Approved</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{auditSummary.approvedChanges}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm font-medium">Rejected</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{auditSummary.rejectedChanges}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm font-medium">Avg Variance %</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {auditSummary.averageVariancePercent.toFixed(2)}%
                </p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {canModify && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
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
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recent Changes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Field</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Old Value</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">New Value</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Variance %</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Changed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {auditSummary.recentChanges.slice(0, 5).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{item.fieldName}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">₦{item.oldValue.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">₦{item.newValue.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm font-medium">
                          <span className={item.variancePercent > 0 ? 'text-red-600' : 'text-green-600'}>
                            {item.variancePercent > 0 ? '+' : ''}{item.variancePercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              item.status === 'APPROVED'
                                ? 'bg-green-100 text-green-800'
                                : item.status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{item.changedBy}</td>
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
    </div>
  );
}
