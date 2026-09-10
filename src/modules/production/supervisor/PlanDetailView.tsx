import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Modal } from '../../../components/ui/Modal';
import BatchAllocationTable from './BatchAllocationTable';

interface PlanDetail {
  plan: any;
  executionStatus: any;
}

export default function PlanDetailView() {
  const { planId } = useParams<{ planId: string }>();
  const [planData, setPlanData] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllocationModal, setShowAllocationModal] = useState(false);

  useEffect(() => {
    const loadPlan = async () => {
      if (!planId) return;
      try {
        const res = await axiosClient.get(`/api/supervisor/production-plans/${planId}`);
        setPlanData(res.data);
        setError('');
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load plan');
      } finally {
        setLoading(false);
      }
    };
    loadPlan();
  }, [planId]);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {error}
      </div>
    );
  }

  if (!planData) {
    return <div className="text-center text-slate-500">Plan not found</div>;
  }

  const { plan, executionStatus } = planData;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">{plan.planNumber}</h2>
          <p className="text-xs text-[#737373] mt-1">Production Plan Execution & Batch Allocation</p>
        </div>
      </div>

      {/* Plan Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
          <p className="text-[9px] font-semibold text-slate-500 mb-1">Status</p>
          <p className="text-sm font-bold text-slate-700">{plan.status}</p>
        </div>
        <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
          <p className="text-[9px] font-semibold text-slate-500 mb-1">Completion</p>
          <p className="text-sm font-bold text-slate-700">{executionStatus?.completionPercentage || 0}%</p>
        </div>
        <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
          <p className="text-[9px] font-semibold text-slate-500 mb-1">Planned Qty</p>
          <p className="text-sm font-bold text-slate-700">
            {Math.round(executionStatus?.plannedTotalQty || 0)}
          </p>
        </div>
        <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
          <p className="text-[9px] font-semibold text-slate-500 mb-1">Variance</p>
          <p
            className={`text-sm font-bold ${
              (executionStatus?.variancePercentage || 0) > 0 ? 'text-rose-600' : 'text-green-600'
            }`}
          >
            {(executionStatus?.variancePercentage || 0) > 0 ? '+' : ''}
            {(executionStatus?.variancePercentage || 0).toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Production Items */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Production Items</h3>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {plan.items?.map((item: any, idx: number) => (
                <div key={item.id} className="border border-slate-100 rounded-lg p-3 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">{idx + 1}.</span>
                        <span className="text-xs font-semibold text-slate-700">
                          {item.bom?.finishedSku?.name || 'Unknown Product'}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1">
                        Target: {Number(item.targetQuantity).toFixed(2)} {item.bom?.yieldUnit}
                      </p>
                    </div>
                    {item.batchMachineAllocations?.length > 0 && (
                      <span className="text-[9px] font-bold px-2 py-1 rounded bg-green-100 text-green-700">
                        {item.batchMachineAllocations.length} allocations
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="space-y-4">
          <button
            onClick={() => setShowAllocationModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#AA3BFF] text-white font-semibold rounded-lg hover:bg-[#9a2ff5] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Allocation
          </button>

          <div className="bg-white border border-[#E9E9E9] rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-700">Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[9px] text-slate-600">Items Planned</span>
                <span className="text-[9px] font-bold text-slate-700">{plan.items?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] text-slate-600">Completed</span>
                <span className="text-[9px] font-bold text-green-600">
                  {executionStatus?.completedCount || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] text-slate-600">In Progress</span>
                <span className="text-[9px] font-bold text-amber-600">
                  {executionStatus?.inProgressCount || 0}
                </span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between">
                <span className="text-[9px] font-semibold text-slate-600">Actual Total</span>
                <span className="text-[9px] font-bold text-slate-700">
                  {Math.round(executionStatus?.actualTotalQty || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Allocation Table */}
      <BatchAllocationTable planId={planId || ''} />

      {/* Allocation Modal */}
      {showAllocationModal && (
        <Modal onClose={() => setShowAllocationModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-700">Add Batch Allocation</h3>
            <p className="text-xs text-slate-600 text-center">
              Select a production item and machine to allocate this batch
            </p>
            <button
              onClick={() => setShowAllocationModal(false)}
              className="w-full px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
