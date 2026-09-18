import { useState } from 'react';
import { useCostManagementStore } from '../../../stores/useCostManagementStore';
import type { EntityType } from '../../../types/costManagement';
import { toast } from '../../../stores/useToastStore';

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
            ? 'bg-green-100 text-green-800'
            : status === 'PENDING'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800'
        }`}
      >
        {status}
      </span>
    );
  };

  const getVarianceColor = (percent: number) => {
    if (percent > 10) return 'text-red-600';
    if (percent > 5) return 'text-orange-600';
    if (percent > 0) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Cost History</h2>
        
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Entity Type */}
          <div>
            <label htmlFor="entityType" className="block text-sm font-medium text-gray-700 mb-2">
              Entity Type *
            </label>
            <select
              id="entityType"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as EntityType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
            <label htmlFor="entityId" className="block text-sm font-medium text-gray-700 mb-2">
              Entity ID *
            </label>
            <input
              id="entityId"
              type="text"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="Enter entity ID..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {costHistory.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* Filter Tabs */}
              <div className="px-6 py-4 border-b border-gray-200 flex gap-4">
                {(['ALL', 'APPROVED', 'PENDING', 'REJECTED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      filterStatus === status
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {status}
                    {status === 'ALL' && (
                      <span className="ml-2 text-xs text-gray-500">({costHistory.length})</span>
                    )}
                    {status !== 'ALL' && (
                      <span className="ml-2 text-xs text-gray-500">
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
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Field</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Old Value</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">New Value</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Variance</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Reason</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Changed By</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.fieldName}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                            ₦{item.oldValue.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                            ₦{item.newValue.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="space-y-1">
                              <p className={`font-semibold ${
                                item.variance > 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {item.variance > 0 ? '+' : ''}₦{Math.abs(item.variance).toLocaleString()}
                              </p>
                              <p className={`text-xs font-medium ${getVarianceColor(item.variancePercent)}`}>
                                {item.variancePercent > 0 ? '+' : ''}{item.variancePercent.toFixed(2)}%
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            <div className="max-w-xs truncate" title={item.reason}>
                              {item.reason}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.changedBy}</td>
                          <td className="px-6 py-4 text-sm">{getStatusBadge(item.status)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div className="space-y-1">
                              <p>{new Date(item.changedAt).toLocaleDateString()}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(item.changedAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500">No cost history found with the selected filter</p>
                </div>
              )}
            </div>
          )}

          {costHistory.length === 0 && !isLoading && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 text-lg mb-2">No cost history found</p>
              <p className="text-gray-400">
                {entityType} with ID "{entityId}" has no cost change history
              </p>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!hasSearched && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
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
          <p className="text-gray-500 text-lg">Search for cost history</p>
          <p className="text-gray-400 mt-2">
            Select an entity type and enter an ID to view cost modification history
          </p>
        </div>
      )}
    </div>
  );
}
