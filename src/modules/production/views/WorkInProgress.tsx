import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Loader,
  MoveRight,
  PackageCheck,
  RefreshCw,
  Route,
} from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { formatNumber } from '../../../lib/format';

type Station = 'INGREDIENT' | 'GRINDING' | 'PRODUCTION';

interface WipEntry {
  id: string;
  productionPlanId: string;
  planItemId?: string | null;
  productionDate: string;
  productName?: string | null;
  batchNumber?: string | null;
  batchLotId?: string | null;
  materialId?: string | null;
  originStation: Station;
  destinationStation: Station | null;
  expectedQuantity: string | number;
  completedQuantity: string | number;
  transferredQuantity: string | number;
  remainingQuantity: string | number;
  unitOfMeasure: string;
  status: 'OPEN' | 'PARTIAL' | 'TRANSFERRED' | 'CLOSED';
  notes?: string | null;
  createdAt: string;
  productionPlan?: { id: string; planNumber: string; status: string; scheduledFor?: string | null } | null;
}

const STATION_LABEL: Record<Station, string> = {
  INGREDIENT: 'Ingredients',
  GRINDING: 'Grinding',
  PRODUCTION: 'Production',
};

const statusStyles: Record<string, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  PARTIAL: 'bg-blue-50 text-blue-700 border-blue-200',
  TRANSFERRED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
};

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function WorkInProgress({ searchQuery = '' }: { searchQuery?: string }) {
  const [entries, setEntries] = useState<WipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [stationFilter, setStationFilter] = useState('');
  const [transferTarget, setTransferTarget] = useState<WipEntry | null>(null);
  const [transferQty, setTransferQty] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ entries: WipEntry[] }>('/production-line/wip', {
        params: {
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          station: stationFilter || undefined,
        },
      });
      setEntries(res.data.entries || []);
      setError('');
    } catch (err: any) {
      setError(apiError(err, 'Failed to load carryover / WIP records'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, stationFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) =>
      [
        entry.productionPlan?.planNumber,
        entry.productName,
        entry.batchNumber,
        entry.notes,
        STATION_LABEL[entry.originStation],
        entry.destinationStation ? STATION_LABEL[entry.destinationStation] : '',
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [entries, searchQuery]);

  const totals = useMemo(
    () =>
      entries.reduce(
        (acc, entry) => {
          acc.remaining += Number(entry.remainingQuantity);
          acc.transferred += Number(entry.transferredQuantity);
          if (entry.status === 'OPEN' || entry.status === 'PARTIAL') acc.active += 1;
          if (entry.status === 'CLOSED' || entry.status === 'TRANSFERRED') acc.closed += 1;
          return acc;
        },
        { remaining: 0, transferred: 0, active: 0, closed: 0 }
      ),
    [entries]
  );

  const openTransfer = (entry: WipEntry) => {
    setTransferTarget(entry);
    setTransferQty(String(entry.remainingQuantity));
    setTransferNotes('');
    setModalError('');
  };

  const submitTransfer = async () => {
    if (!transferTarget) return;
    const quantity = Number(transferQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setModalError('Enter a quantity greater than zero.');
      return;
    }
    if (quantity > Number(transferTarget.remainingQuantity)) {
      setModalError(`Only ${transferTarget.remainingQuantity} ${transferTarget.unitOfMeasure} is outstanding.`);
      return;
    }

    setSaving(true);
    try {
      await axiosClient.post(`/production-line/wip/${transferTarget.id}/transfer`, {
        quantity,
        notes: transferNotes || undefined,
      });
      setTransferTarget(null);
      await load();
    } catch (err: any) {
      setModalError(apiError(err, 'Failed to transfer the outstanding quantity'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Carryover / Work in Progress</h2>
          <PageDescription>
            Material and production that has not yet reached the next station. WIP is never counted as completed output.
          </PageDescription>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[#E9E9E9] bg-white px-3 h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active WIP records', value: formatNumber(totals.active), icon: Route, tone: 'text-amber-600' },
          { label: 'Outstanding quantity', value: formatNumber(totals.remaining), icon: Boxes, tone: 'text-[#EA4335]' },
          { label: 'Transferred to next station', value: formatNumber(totals.transferred), icon: MoveRight, tone: 'text-[#00B4D8]' },
          { label: 'Closed carryovers', value: formatNumber(totals.closed), icon: PackageCheck, tone: 'text-emerald-600' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-[#E9E9E9] bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{card.label}</p>
              <card.icon className={`h-4 w-4 ${card.tone}`} />
            </div>
            <p className={`text-lg font-bold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-[#E9E9E9] bg-white px-3 text-xs focus:outline-none focus:border-[#EA4335]"
        >
          <option value="ACTIVE">Active (open / partial)</option>
          <option value="OPEN">Open only</option>
          <option value="PARTIAL">Partially transferred</option>
          <option value="TRANSFERRED">Transferred</option>
          <option value="CLOSED">Closed</option>
          <option value="ALL">All records</option>
        </select>
        <select
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
          className="h-9 rounded-lg border border-[#E9E9E9] bg-white px-3 text-xs focus:outline-none focus:border-[#EA4335]"
        >
          <option value="">All stations</option>
          <option value="INGREDIENT">Ingredients Station</option>
          <option value="GRINDING">Grinding Station</option>
          <option value="PRODUCTION">Production Station</option>
        </select>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No carryover records"
            hint="WIP appears when a station has quantity that has not moved to the next station."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Production order</th>
                  <th className="px-4 py-3 font-semibold">Product / material</th>
                  <th className="px-4 py-3 font-semibold">Flow</th>
                  <th className="px-4 py-3 font-semibold">Expected</th>
                  <th className="px-4 py-3 font-semibold">Completed</th>
                  <th className="px-4 py-3 font-semibold">Transferred</th>
                  <th className="px-4 py-3 font-semibold">Remaining</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => {
                  const active = entry.status === 'OPEN' || entry.status === 'PARTIAL';
                  return (
                    <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="text-[11px] font-bold text-[#171717]">
                          {entry.productionPlan?.planNumber ?? '—'}
                        </p>
                        <p className="text-[10px] text-slate-400">{dateLabel(entry.productionDate)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[11px] font-semibold text-slate-700">
                          {entry.productName ?? 'Ingredient requirement'}
                        </p>
                        {entry.batchNumber && (
                          <p className="text-[10px] font-mono text-slate-400">Batch {entry.batchNumber}</p>
                        )}
                        {entry.notes && <p className="text-[10px] text-slate-400">{entry.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                          {STATION_LABEL[entry.originStation]}
                          {entry.destinationStation && (
                            <>
                              <ArrowRight className="h-3 w-3 text-slate-400" />
                              {STATION_LABEL[entry.destinationStation]}
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600">
                        {formatNumber(entry.expectedQuantity)} {entry.unitOfMeasure}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600">
                        {formatNumber(entry.completedQuantity)} {entry.unitOfMeasure}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600">
                        {formatNumber(entry.transferredQuantity)} {entry.unitOfMeasure}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-amber-600">
                        {formatNumber(entry.remainingQuantity)} {entry.unitOfMeasure}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${
                            statusStyles[entry.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {active ? (
                          <button
                            onClick={() => openTransfer(entry)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#00B4D8] px-2.5 py-1 text-[10px] font-semibold text-[#0077A8] hover:bg-[#00B4D8]/10"
                          >
                            <MoveRight className="h-3 w-3" /> Transfer
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {transferTarget && (
        <Modal onClose={() => setTransferTarget(null)}>
          <div className="w-full max-w-md rounded-xl border border-[#E9E9E9] bg-white p-5 shadow-xl">
            <h3 className="text-sm font-bold text-[#171717]">Transfer outstanding quantity</h3>
            <p className="mt-1 text-[11px] text-slate-500">
              {transferTarget.productionPlan?.planNumber ?? 'Plan'} ·{' '}
              {STATION_LABEL[transferTarget.originStation]}
              {transferTarget.destinationStation
                ? ` → ${STATION_LABEL[transferTarget.destinationStation]}`
                : ''}
            </p>
            <p className="mt-2 text-[11px] font-semibold text-amber-600">
              Outstanding: {formatNumber(transferTarget.remainingQuantity)} {transferTarget.unitOfMeasure}
            </p>

            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Quantity to transfer
                </label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Notes (optional)
                </label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-[#E9E9E9] px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335]"
                  placeholder="Reason or hand-off notes"
                />
              </div>
              {modalError && <p className="text-[11px] text-rose-600">{modalError}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setTransferTarget(null)}
                className="h-9 rounded-lg border border-[#E9E9E9] px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitTransfer}
                disabled={saving}
                className="flex h-9 items-center gap-2 rounded-lg bg-[#EA4335] px-4 text-xs font-semibold text-white hover:bg-[#d3362a] disabled:opacity-50"
              >
                {saving ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <MoveRight className="h-3.5 w-3.5" />}
                Transfer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
