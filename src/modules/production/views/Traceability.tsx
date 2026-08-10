import { useState } from 'react';
import { Network, Search, PackageSearch, Factory, Truck, Boxes, AlertTriangle } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface Material {
  id: string;
  name: string;
  sku: string;
  type: string;
  unitOfMeasure: string;
}

interface InboundInfo {
  grnNumber: string;
  receivedAt: string;
  quantity: number;
  unitOfMeasure: string;
  poNumber: string;
  orderDate?: string | null;
  supplier?: { id: string; name: string; contactPerson?: string | null } | null;
}

interface RawBatch {
  batch: { id: string; batchNumber: string; status: string; expiryDate?: string | null; manufacturingDate?: string | null };
  inbound: InboundInfo | null;
}

interface TraceTree {
  batch: {
    id: string;
    batchNumber: string;
    status: string;
    manufacturingDate?: string | null;
    expiryDate?: string | null;
    material: Material;
  };
  inbound: InboundInfo | null;
  producedBy: {
    orderNumber: string;
    targetQuantity: number;
    actualYield: number | null;
    completedAt?: string | null;
    bomId: string;
    bomProductName: string;
    bomVersion: number;
  } | null;
  ingredients: Array<{
    materialId: string;
    materialName: string;
    sku: string;
    type: string;
    quantity: number;
    unitOfMeasure: string;
    isPercentage: boolean;
    rawBatches: RawBatch[];
  }>;
}

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  QUARANTINE: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
  EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function Traceability({ searchQuery: _searchQuery = '' }: { searchQuery?: string }) {
  const [batchNumber, setBatchNumber] = useState('');
  const [searched, setSearched] = useState('');
  const [tree, setTree] = useState<TraceTree | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runTrace = async (value: string) => {
    const term = value.trim();
    if (!term) return;
    setLoading(true);
    setError('');
    setTree(null);
    setSearched(term);
    try {
      const res = await axiosClient.get<{ tree: TraceTree }>('/production/trace', {
        params: { batchNumber: term },
      });
      setTree(res.data.tree);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Batch not found. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    runTrace(batchNumber);
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Batch Traceability</h2>
          <p className="text-[#737373] text-xs">Finished batch → production order → ingredients → raw batches → suppliers.</p>
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="Enter batch number…"
              className="pl-9 pr-3 h-9 rounded-lg border border-[#E9E9E9] bg-white text-xs text-[#171717] w-56 focus:outline-none focus:border-[#EA4335]"
            />
          </div>
          <button type="submit" className="btn-3d px-4 h-9">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
              <Network className="w-3.5 h-3.5" /> Trace
            </span>
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E9E9E9] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16 rounded" />
                </div>
                <Skeleton className="h-2.5 w-48" />
              </div>
            </div>
            <Skeleton className="h-2 w-64" />
          </div>
          <div className="bg-white border border-[#E9E9E9] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-56" />
                <Skeleton className="h-2 w-72" />
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#E9E9E9] rounded-xl p-4 space-y-3">
            <Skeleton className="h-3 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="w-6 h-6 rounded" />
                <Skeleton className="h-2 w-40" />
                <Skeleton className="h-2 w-16" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Trace Tree */}
      {tree && !loading && (
        <div className="space-y-4">
          {/* Root: the batch */}
          <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                  <PackageSearch className="w-4 h-4 text-[#EA4335]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#171717]">{tree.batch.batchNumber}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[tree.batch.status]}`}>{tree.batch.status}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {tree.batch.material.name} · <span className="font-mono">{tree.batch.material.sku}</span>
                  </p>
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-400">
                {tree.batch.manufacturingDate && (
                  <p>Manufactured: {new Date(tree.batch.manufacturingDate).toLocaleDateString()}</p>
                )}
                {tree.batch.expiryDate && (
                  <p>Expiry: {new Date(tree.batch.expiryDate).toLocaleDateString()}</p>
                )}
              </div>
            </div>

            {/* Inbound (raw batch received from supplier) */}
            {tree.inbound && (
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Truck className="w-3 h-3" /> Inbound Receipt
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-[11px] text-slate-600">
                  <span>GRN <b className="font-mono">{tree.inbound.grnNumber}</b></span>
                  <span>PO <b className="font-mono">{tree.inbound.poNumber}</b></span>
                  <span>Supplier <b>{tree.inbound.supplier?.name ?? '—'}</b></span>
                  <span>Qty <b>{tree.inbound.quantity} {tree.inbound.unitOfMeasure}</b></span>
                  <span>Received <b>{new Date(tree.inbound.receivedAt).toLocaleDateString()}</b></span>
                </div>
              </div>
            )}
          </div>

          {/* Production lineage */}
          {tree.producedBy ? (
            <div className="space-y-3">
              <div className="bg-white border border-[#E9E9E9] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <Factory className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#171717]">
                      Produced by {tree.producedBy.orderNumber}
                      <span className="ml-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                        BOM v{tree.producedBy.bomVersion} — {tree.producedBy.bomProductName}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Target {tree.producedBy.targetQuantity} · Actual {tree.producedBy.actualYield ?? '—'}
                      {tree.producedBy.completedAt && (
                        <> · Completed {new Date(tree.producedBy.completedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ingredient branches */}
              <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Boxes className="w-3 h-3" /> Ingredient Batches Consumed
                  </p>
                </div>
                <div className="divide-y divide-slate-50">
                  {tree.ingredients.map((ing) => (
                    <div key={ing.materialId} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-700">{ing.materialName}</p>
                          <p className="text-[9px] font-mono text-slate-400">{ing.sku}</p>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          {ing.quantity}{ing.isPercentage ? '%' : ''} {ing.unitOfMeasure}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-slate-100">
                        {ing.rawBatches.length === 0 && (
                          <p className="text-[10px] text-slate-400">No batch-lot consumption traced.</p>
                        )}
                        {ing.rawBatches.map((rb) => (
                          <div key={rb.batch.id} className="rounded-lg bg-slate-50/70 border border-slate-100 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold text-slate-600">{rb.batch.batchNumber}</span>
                              <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusBadge[rb.batch.status]}`}>{rb.batch.status}</span>
                              {rb.batch.expiryDate && (
                                <span className="text-[9px] text-slate-400">exp {new Date(rb.batch.expiryDate).toLocaleDateString()}</span>
                              )}
                            </div>
                            {rb.inbound ? (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                ← GRN <b className="font-mono">{rb.inbound.grnNumber}</b> · PO <b className="font-mono">{rb.inbound.poNumber}</b> ·{' '}
                                {rb.inbound.supplier?.name ?? '—'}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-400 mt-0.5">← no inbound GRN traced</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            !tree.inbound && (
              <div className="bg-white border border-[#E9E9E9] rounded-xl py-10 text-center text-[11px] text-slate-400 flex flex-col items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                This batch has no linked production order or inbound receipt — it may be a manually entered batch.
              </div>
            )
          )}
        </div>
      )}

      {searched && !tree && !loading && !error && (
        <div className="bg-white border border-[#E9E9E9] rounded-xl">
          <EmptyState title={`No trace data for "${searched}".`} hint="Check the batch number and try again." />
        </div>
      )}

      {/* 3. Initial state — nothing searched yet */}
      {!searched && !tree && !loading && !error && (
        <div className="bg-white border border-[#E9E9E9] rounded-xl">
          <EmptyState title="No batch selected." hint="Enter a finished batch number above and hit Trace to see its full lineage." />
        </div>
      )}
    </div>
  );
}
