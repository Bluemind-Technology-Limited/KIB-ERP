import { useEffect, useState } from 'react';
import { Play, CheckCircle2, Loader } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';

export interface Allocation {
  id: string;
  batchNumber?: string | null;
  machineId?: string | null;
  productionOrderId?: string;
  status: string;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  planItem?: { bom?: { finishedSku?: { name?: string } | null; productName?: string } | null } | null;
  productionOrder?: { orderNumber?: string } | null;
}

/**
 * Allocations come from the plan payload rather than a dedicated endpoint, and
 * `BatchMachineAllocation` stores `machineId` with no Prisma relation — so machine
 * names are resolved from the machine list.
 */
export default function BatchAllocationTable({
  allocations,
  onChanged,
}: {
  allocations: Allocation[];
  onChanged?: () => void;
}) {
  const [machineNames, setMachineNames] = useState<Record<string, string>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadMachines = async () => {
      try {
        const res = await axiosClient.get<{ machines: Array<{ id: string; name: string }> }>(
          '/production/machines'
        );
        const map: Record<string, string> = {};
        for (const m of res.data.machines ?? []) map[m.id] = m.name;
        setMachineNames(map);
      } catch {
        // Machine names are cosmetic here — the table still works without them.
      }
    };
    loadMachines();
  }, []);

  const run = async (id: string, path: string, body?: unknown) => {
    setBusyIds((prev) => new Set([...prev, id]));
    try {
      await axiosClient.post(path, body);
      onChanged?.();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
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

  const productName = (alloc: Allocation) =>
    alloc.planItem?.bom?.finishedSku?.name ?? alloc.planItem?.bom?.productName ?? 'Unknown';

  return (
    <div className="bg-white border border-[#E9E9E9] rounded-xl p-4 overflow-x-auto">
      <h3 className="text-sm font-bold text-slate-700 mb-4">Batch-to-Machine Allocations</h3>

      {allocations.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-slate-500">No allocations yet for this plan.</p>
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
                  <span className="text-slate-700">{productName(alloc)}</span>
                </td>
                <td className="py-3 px-3">
                  <span className="font-semibold text-slate-700">
                    {alloc.machineId ? machineNames[alloc.machineId] ?? '—' : '—'}
                  </span>
                </td>
                <td className="py-3 px-3">
                  {alloc.scheduledStartTime ? (
                    <div className="text-[9px] text-slate-600">
                      {new Date(alloc.scheduledStartTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
                    {(alloc.status === 'ALLOCATED' || alloc.status === 'SCHEDULED') && (
                      <button
                        onClick={() => run(alloc.id, `/supervisor/batch-allocations/${alloc.id}/start`)}
                        disabled={busyIds.has(alloc.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                        title="Start production"
                      >
                        {busyIds.has(alloc.id) ? (
                          <Loader className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                      </button>
                    )}
                    {alloc.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() =>
                          run(alloc.id, `/supervisor/batch-allocations/${alloc.id}/complete`, {
                            batchNumber: alloc.batchNumber || `BATCH-${Date.now()}`,
                          })
                        }
                        disabled={busyIds.has(alloc.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                        title="Complete production"
                      >
                        {busyIds.has(alloc.id) ? (
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
