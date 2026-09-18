import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { useCostManagementStore } from '../../../stores/useCostManagementStore';
import type { EntityType, CostChangeRequest } from '../../../types/costManagement';
import { toast } from '../../../stores/useToastStore';

interface CostEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
  entityId: string;
}

export default function CostEditModal({
  isOpen,
  onClose,
  entityType,
  entityId,
}: CostEditModalProps) {
  const { requestCostChange, isLoading, error } = useCostManagementStore();

  const [formData, setFormData] = useState({
    newValue: '',
    reason: '',
    changeType: 'MANUAL_ADJUSTMENT' as const,
  });

  const changeTypeOptions = [
    { value: 'MANUAL_ADJUSTMENT', label: 'Manual Adjustment' },
    { value: 'VARIANCE_CORRECTION', label: 'Variance Correction' },
    { value: 'MARKET_UPDATE', label: 'Market Update' },
    { value: 'QUALITY_ADJUSTMENT', label: 'Quality Adjustment' },
  ];

  const handleNewValueChange = (value: string) => {
    setFormData((prev) => ({ ...prev, newValue: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.newValue || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    const request: CostChangeRequest = {
      entityType,
      entityId,
      fieldName: entityType === 'ProductionOrder' ? 'estimatedCost' : 'standardCost',
      newValue: parseFloat(formData.newValue),
      reason: formData.reason,
      changeType: formData.changeType,
    };

    await requestCostChange(request);
    if (!error) {
      setFormData({ newValue: '', reason: '', changeType: 'MANUAL_ADJUSTMENT' });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Request Cost Change</h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Entity Type Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
            <div className="px-4 py-3 bg-gray-100 rounded-lg text-gray-700 font-medium">
              {entityType}
            </div>
          </div>

          {/* Entity ID Display */}
          {entityId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entity ID</label>
              <div className="px-4 py-3 bg-gray-100 rounded-lg text-gray-700 text-sm font-mono">
                {entityId}
              </div>
            </div>
          )}

          {/* New Value */}
          <div>
            <label htmlFor="newValue" className="block text-sm font-medium text-gray-700 mb-2">
              New Cost Value *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-500 font-medium">₦</span>
              <input
                id="newValue"
                type="number"
                step="0.01"
                value={formData.newValue}
                onChange={(e) => handleNewValueChange(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={isLoading}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Enter the new cost value. If this represents a change greater than 5% or ₦10,000, it will require approval.
            </p>
          </div>

          {/* Estimated Variance */}
          {false && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">Estimated Variance</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Amount</p>
                  <p className={`text-lg font-bold text-green-600`}>
                    ₦0
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Percentage</p>
                  <p className={`text-lg font-bold text-green-600`}>
                    0.00%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Change Type */}
          <div>
            <label htmlFor="changeType" className="block text-sm font-medium text-gray-700 mb-2">
              Change Type *
            </label>
            <select
              id="changeType"
              value={formData.changeType}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  changeType: e.target.value as any,
                }))
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              disabled={isLoading}
            >
              {changeTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Change *
            </label>
            <textarea
              id="reason"
              value={formData.reason}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="Explain the reason for this cost change..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              {formData.reason.length}/500 characters
            </p>
          </div>

          {/* Approval Info */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-900">
              <strong>Note:</strong> Changes exceeding 5% variance or ₦10,000 will require manager approval. Changes over ₦50,000 require executive approval.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Submitting...' : 'Submit Change Request'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
