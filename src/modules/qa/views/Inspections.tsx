import { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Search } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface Inspection {
  id: string;
  inspectionType: 'GRN' | 'FINISHED_BATCH';
  materialId: string;
  result: 'PENDING' | 'PASSED' | 'FAILED';
  notes?: string | null;
  inspectedAt?: string | null;
  createdAt: string;
  referenceLabel?: string | null;
  material?: { name: string; sku: string; unitOfMeasure: string } | null;
  batchLot?: { id: string; batchNumber: string; status: string } | null;
  inspector?: { fullName?: string } | null;
}

const resultBadge: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
  PASSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-600 border-rose-200',
};
const batchStatusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  QUARANTINE: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
  EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function Inspections({ searchQuery = '' }: { searchQuery?: string }) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ inspections: Inspection[] }>('/qa/inspections', {
        params: { type: filter || undefined, result: resultFilter || undefined },
      });
      setInspections(res.data.inspections);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load inspections. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter, resultFilter]);

  const decide = async (inspection: Inspection, action: 'release' | 'reject') => {
    setBusyId(inspection.id);
    try {
      await axiosClient.post(`/qa/inspections/${inspection.id}/${action}`, {});
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || `Failed to ${action} batch`);
    } finally {
      setBusyId(null);
    }
  };

  const filtered = inspections.filter(
    (i) =>
      (i.material?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.batchLot?.batchNumber ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.referenceLabel ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">QA Inspections</h2>
          <p className="text-[#737373] text-xs">Release or reject quarantined batches from GRN receiving and finished production.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Type (GRN / FINISHED_BATCH)"
              className="pl-9 pr-3 h-9 rounded-lg border border-[#E9E9E9] bg-white text-xs text-[#171717] w-44 focus:outline-none focus:border-[#EA4335]"
            />
          </div>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#E9E9E9] bg-white text-xs text-[#171717] px-2 focus:outline-none focus:border-[#EA4335]"
          >
            <option value="">All results</option>
            <option value="PENDING">Pending</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {/* 2. Inspections Table */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={7} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No inspections found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">Batch / Ref</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Inspected By</th>
                  <th className="px-4 py-3 font-semibold">Batch Status</th>
                  <th className="px-4 py-3 font-semibold">Result</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#EA4335]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#171717] leading-none">{i.material?.name ?? '—'}</p>
                          <p className="text-[9px] font-mono text-slate-400 mt-0.5">{i.material?.sku ?? ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono text-slate-500">{i.batchLot?.batchNumber ?? '—'}</span>
                      {i.referenceLabel && (
                        <p className="text-[9px] text-slate-400">Ref: {i.referenceLabel}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-sky-50 text-sky-700 border-sky-200">
                        {i.inspectionType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      {i.inspector?.fullName ?? '—'}
                      {i.inspectedAt && (
                        <p className="text-[9px] text-slate-400">{new Date(i.inspectedAt).toLocaleDateString()}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${batchStatusBadge[i.batchLot?.status ?? ''] ?? batchStatusBadge.ACTIVE}`}>
                        {i.batchLot?.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${resultBadge[i.result]}`}>{i.result}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {i.result === 'PENDING' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => decide(i, 'release')}
                            disabled={busyId === i.id}
                            className="btn-3d px-3 h-7"
                          >
                            <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Release
                            </span>
                          </button>
                          <button
                            onClick={() => decide(i, 'reject')}
                            disabled={busyId === i.id}
                            className="px-3 h-7 rounded-lg border border-rose-200 text-rose-600 text-[10px] font-semibold hover:bg-rose-50"
                          >
                            <span className="flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Reject
                            </span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
