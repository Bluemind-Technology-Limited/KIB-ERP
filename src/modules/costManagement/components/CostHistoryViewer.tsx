import { useState } from 'react';
import { useCostManagementStore } from '../../../stores/useCostManagementStore';
import type { EntityType, CostHistoryItem } from '../../../types/costManagement';
import { toast } from '../../../stores/useToastStore';
import { DetailsModal, ViewButton, detailDate, detailValue } from '../../../components/ui/DetailsModal';
import { formatMoney, formatPercent } from '../../../lib/format';

export default function CostHistoryViewer() {
  const {
    fetchCostHistory,
    costHistory,
    isLoading,
    error,
  } = useCostManagementStore();

  const [entityType, setEntityType] = useState<EntityType>('Material');
  const [entityId, setEntityId] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  const [viewing, setViewing] = useState<CostHistoryItem | null>(null);

  const entityTypes: EntityType[] = ['Material', 'BomIngredient', 'ProductionOrder', 'PurchaseOrderItem', 'GoodsReceiptItem'];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId.trim()) {
      toast.error('Please enter an entity ID');
      return;
    }
    await fetchCostHistory(entityType, entityId);
    setHasSearched(true);
  };

  const filteredHistory = filterStatus === 'ALL'
    ? costHistory
    : costHistory.filter((item) => item.status === filterStatus);

  const getStatusBadge = (status: string) => {
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${
          status === 'APPROVED'
            ? 'bg-green-600 text-white'
            : status === 'PENDING'
            ? 'bg-yellow-600 text-white'
            : 'bg-red-600 text-white'
        }`}
      >
        {status}
      </span>
    );
  };

  const getVarianceColor = (percent: number) => {
    if (percent > 10) return 'text-red-600 dark:text-red-300';
    if (percent > 5) return 'text-orange-600 dark:text-orange-300';
    if (percent > 0) return 'text-yellow-600 dark:text-yellow-300';
    return 'text-green-600 dark:text-green-300';
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="bg-surface rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-ink mb-4 dark:text-ink-faint">Search Cost History</h2>
        
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Entity Type */}
          <div>
            <label htmlFor="entityType" className="block text-sm font-medium text-ink-2 mb-2 dark:text-ink-faint">
              Entity Type *
            </label>
            <select
              id="entityType"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as EntityType)}
              className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:border-gray-500/30"
              disabled={isLoading}
            >
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Entity ID */}
          <div>
            <label htmlFor="entityId" className="block text-sm font-medium text-ink-2 mb-2 dark:text-ink-faint">
              Entity ID *
            </label>
            <input
              id="entityId"
              type="text"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="Enter entity ID..."
              className="w-full px-4 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:border-gray-500/30"
              disabled={isLoading}
            />
          </div>

          {/* Submit Button */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {hasSearched && (
        <>
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-500/10 dark:border-red-500/30">
              <p className="text-red-800 text-sm dark:text-red-300">{error}</p>
            </div>
          )}

          {costHistory.length > 0 && (
            <div className="bg-surface rounded-lg shadow overflow-hidden">
              {/* Filter Tabs */}
              <div className="px-6 py-4 border-b border-line flex gap-4 dark:border-gray-500/30">
                {(['ALL', 'APPROVED', 'PENDING', 'REJECTED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      filterStatus === status
                        ? 'bg-blue-600 text-white'
                        : 'text-ink-muted hover:bg-surface-3 dark:text-ink-faint dark:hover:bg-surface-20/15'
                    }`}
                  >
                    {status}
                    {status === 'ALL' && (
                      <span className="ml-2 text-xs text-ink-muted">({costHistory.length})</span>
                    )}
                    {status !== 'ALL' && (
                      <span className="ml-2 text-xs text-ink-muted">
                        ({costHistory.filter((h) => h.status === status).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* History Table */}
              {filteredHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface-2 dark:bg-surface-20/10">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-ink-2 dark:text-ink-faint">Field</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-ink-2 dark:text-ink-faint">Old Value</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-ink-2 dark:text-ink-faint">New Value</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-ink-2 dark:text-ink-faint">Variance</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-ink-2 dark:text-ink-faint">Reason</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-ink-2 dark:text-ink-faint">Changed By</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-ink-2 dark:text-ink-faint">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-ink-2 dark:text-ink-faint">Date</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-ink-2 dark:text-ink-faint">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-500/30">
                      {filteredHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-2 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-ink dark:text-ink-faint">{item.fieldName}</td>
                          <td className="px-6 py-4 text-sm text-ink-muted font-mono dark:text-ink-faint">
                            ₦{item.oldValue.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-ink-muted font-mono dark:text-ink-faint">
                            ₦{item.newValue.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="space-y-1">
                              <p className={`font-semibold ${
                                item.variance > 0 ? 'text-red-600 dark:text-red-300' : 'text-green-600 dark:text-green-300'
                              }`}>
                                {item.variance > 0 ? '+' : ''}₦{Math.abs(item.variance).toLocaleString()}
                              </p>
                              <p className={`text-xs font-medium ${getVarianceColor(item.variancePercent)}`}>
                                {item.variancePercent > 0 ? '+' : ''}{formatPercent(item.variancePercent, 2)}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-ink-2 dark:text-ink-faint">
                            <div className="max-w-xs truncate" title={item.reason}>
                              {item.reason}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-ink-muted dark:text-ink-faint">{item.changedBy}</td>
                          <td className="px-6 py-4 text-sm">{getStatusBadge(item.status)}</td>
                          <td className="px-6 py-4 text-sm text-ink-muted dark:text-ink-faint">
                            <div className="space-y-1">
                              <p>{new Date(item.changedAt).toLocaleDateString()}</p>
                              <p className="text-xs text-ink-muted">
                                {new Date(item.changedAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-right">
                            <ViewButton onClick={() => setViewing(item)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-ink-muted">No cost history found with the selected filter</p>
                </div>
              )}
            </div>
          )}

          {costHistory.length === 0 && !isLoading && (
            <div className="bg-surface rounded-lg shadow p-8 text-center">
              <p className="text-ink-muted text-lg mb-2">No cost history found</p>
              <p className="text-ink-faint">
                {entityType} with ID "{entityId}" has no cost change history
              </p>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!hasSearched && (
        <div className="bg-surface rounded-lg shadow p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-ink-faint mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-ink-muted text-lg">Search for cost history</p>
          <p className="text-ink-faint mt-2">
            Select an entity type and enter an ID to view cost modification history
          </p>
        </div>
      )}

      {viewing && (
        <DetailsModal
          title={viewing.fieldName}
          subtitle={`${entityType} · ${entityId}`}
          status={{
            label: viewing.status,
            className:
              viewing.status === 'APPROVED'
                ? 'bg-emerald-600 text-white'
                : viewing.status === 'PENDING'
                  ? 'bg-amber-600 text-white'
                  : 'bg-rose-600 text-white',
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
                { label: 'Entity type', value: entityType },
                { label: 'Entity ID', value: <span className="font-mono text-[10px]">{detailValue(entityId)}</span>, wide: true },
                { label: 'Changed by', value: detailValue(viewing.changedBy) },
                { label: 'Changed at', value: detailDate(viewing.changedAt, true) },
                { label: 'Approved by', value: detailValue(viewing.approvedBy) },
                { label: 'Approved at', value: viewing.approvedAt ? detailDate(viewing.approvedAt, true) : '—' },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
