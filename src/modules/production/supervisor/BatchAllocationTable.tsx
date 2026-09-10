import { useEffect, useState } from 'react';
import { Play, CheckCircle2, Loader } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';

interface Allocation {
  id: string;
  batchNumber?: string;
  productionOrder: any;
  machine: any;
  status: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
}

export default function BatchAllocationTable({ planId }: { planId: string }) {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingIds, setStartingIds] = useState<Set<string>>(new Set());
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadAllocations = async () => {
      try {
        const res = await axiosClient.get(`/api/supervisor/production-plans/${planId}/allocations`);
        setAllocations(res.data.allocations || []);
      } catch (err) {
        console.error('Failed to load allocations:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAllocations();
  }, [planId]);

  const handleStart = async (id: string) => {
    setStartingIds((prev) => new Set([...prev, id]));
    try {
      await axiosClient.post(`/api/supervisor/batch-allocations/${id}/start`);
      // Reload allocations
      const res = await axiosClient.get(`/api/supervisor/production-plans/${planId}/allocations`);
      setAllocations(res.data.allocations || []);
    } catch (err: any) {
      console.error('Failed to start batch:', err);
    } finally {
      setStartingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleComplete = async (id: string, batchNumber: string) => {
    setCompletingIds((prev) => new Set([...prev, id]));
    try {
      await axiosClient.post(`/api/supervisor/batch-allocations/${id}/complete`, {
        batchNumber,
      });
      // Reload allocations
      const res = await axiosClient.get(`/api/supervisor/production-plans/${planId}/allocations`);
      setAllocations(res.data.allocations || []);
    } catch (err: any) {
      console.error('Failed to complete batch:', err);
    } finally {
      setCompletingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ALLOCATED':
        return 'bg-slate-100 text-slate-700';
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-700';
      case 'IN_PROGRESS':
        return 'bg-amber-100 text-amber-700';
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return <Skeleton className="h-80 w-full" />;
  }

  return (
    <div className="bg-white border border-[#E9E9E9] rounded-xl p-4 overflow-x-auto">
      <h3 className="text-sm font-bold text-slate-700 mb-4">Batch-to-Machine Allocations</h3>

      {allocations.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-slate-500">No allocations yet. Click &quot;Add Allocation&quot; to get started.</p>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 font-semibold text-slate-600">Batch#</th>
              <th className="text-left py-2 px-3 font-semibold text-slate-600">Product</th>
              <th className="text-left py-2 px-3 font-semibold text-slate-600">Machine</th>
              <th className="text-left py-2 px-3 font-semibold text-slate-600">Scheduled</th>
              <th className="text-left py-2 px-3 font-semibold text-slate-600">Status</th>
              <th className="text-left py-2 px-3 font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((alloc) => (
              <tr key={alloc.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-3 px-3">
                  <span className="font-mono text-[9px] font-semibold">
                    {alloc.batchNumber || 'TBD'}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-slate-700">
                    {alloc.productionOrder.bom.finishedSku?.name || 'Unknown'}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="font-semibold text-slate-700">{alloc.machine.name}</span>
                </td>
                <td className="py-3 px-3">
                  {alloc.scheduledStartTime ? (
                    <div className="text-[9px] text-slate-600">
                      <div>{new Date(alloc.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="py-3 px-3">
                  <span className={`inline-block px-2 py-1 rounded font-semibold ${getStatusBadge(alloc.status)}`}>
                    {alloc.status}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    {alloc.status === 'ALLOCATED' && (
                      <button
                        onClick={() => handleStart(alloc.id)}
                        disabled={startingIds.has(alloc.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                        title="Start production"
                      >
                        {startingIds.has(alloc.id) ? (
                          <Loader className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                      </button>
                    )}
                    {alloc.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleComplete(alloc.id, alloc.batchNumber || `BATCH-${Date.now()}`)}
                        disabled={completingIds.has(alloc.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                        title="Complete production"
                      >
                        {completingIds.has(alloc.id) ? (
                          <Loader className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                      </button>
                    )}
                    {alloc.status === 'COMPLETED' && (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
