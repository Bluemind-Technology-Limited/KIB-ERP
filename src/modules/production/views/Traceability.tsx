import { useState } from 'react';
import {
  Network,
  Search,
  PackageSearch,
  Factory,
  Truck,
  Boxes,
  AlertTriangle,
  ArrowDownRight,
  Cog,
  ClipboardList,
  RotateCcw,
} from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface BatchMatch {
  id: string;
  batchNumber: string;
  status: string;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  material: { id: string; name: string; sku: string; type: string; unitOfMeasure: string };
  origin: 'PRODUCTION_ORDER' | 'PRODUCTION_PLAN' | 'INBOUND' | 'UNKNOWN';
  /** Stored lot origin (SOP KIB/QCA/010): INBOUND receipt or FINISHED batch. */
  batchOrigin?: string;
  // Lot code parts — shown alongside the ingredient and supplier names.
  lotCode?: string | null;
  setNumber?: number | null;
  vendorCode?: string | null;
  ingredientCode?: string | null;
  yearCode?: string | null;
  supplierBatchNumber?: string | null;
  supplier?: { id: string; name: string; vendorCode?: string | null } | null;
}

interface Inbound {
  grnNumber: string;
  grnStatus: string;
  receivedAt: string;
  quantity: number;
  unitOfMeasure: string;
  poNumber: string | null;
  orderDate?: string | null;
  consignmentNumber: string | null;
  warehouse?: { id: string; name: string } | null;
  supplier?: { id: string; name: string; contactPerson?: string | null } | null;
  via: 'PO' | 'CONSIGNMENT' | 'UNKNOWN';
}

interface StageInfo {
  inputQuantity: number;
  achievedQuantity: number;
  remainderQuantity: number;
  unitOfMeasure: string;
  machineId?: string | null;
  batchNumber?: string | null;
  productionDate: string;
  status: string;
  remainders: Array<{ materialId: string; quantity: number; unitOfMeasure: string }>;
}

interface TraceTree {
  batch: {
    id: string;
    batchNumber: string;
    status: string;
    manufacturingDate?: string | null;
    expiryDate?: string | null;
    material: { id: string; name: string; sku: string; type: string; unitOfMeasure: string };
  };
  origin: BatchMatch['origin'];
  inbound: Inbound | null;
  producedBy:
    | {
        source: 'PRODUCTION_ORDER' | 'PRODUCTION_PLAN';
        orderNumber: string | null;
        planNumber: string | null;
        planStatus?: string | null;
        productName: string | null;
        targetQuantity: number;
        actualYield: number | null;
        completedAt?: string | null;
        bomId: string | null;
      }
    | null;
  stages: { grinding: StageInfo | null; finishing: StageInfo | null };
  ingredients: Array<{
    materialId: string;
    materialName: string | null;
    sku: string | null;
    type: string | null;
    quantity: number;
    unitOfMeasure: string;
    isPercentage: boolean;
    source: 'GRINDING_INPUTS' | 'PLAN_ISSUE' | 'PROD_CONSUMPTION' | null;
    rawBatches: Array<{
      batch: {
        id: string;
        batchNumber: string;
        status: string;
        expiryDate?: string | null;
        manufacturingDate?: string | null;
        /** SOP KIB/QCA/010 — present on lots created since lot coding was added. */
        lotCode?: string | null;
        origin?: string | null;
        supplierBatchNumber?: string | null;
      };
      inbound: Inbound | null;
    }>;
  }>;
  downstream: {
    usedInFinishedBatches: Array<{
      via: 'GRINDING' | 'ORDER_RELEASE';
      planNumber: string | null;
      orderNumber?: string | null;
      productName: string | null;
      materialName: string | null;
      sku: string | null;
      batchLotId: string | null;
      batchNumber: string | null;
      quantity: number;
    }>;
    movements: Array<{
      id: string;
      eventType: string;
      quantity: number;
      unitOfMeasure: string;
      warehouseName: string | null;
      referenceType: string | null;
      referenceId: string | null;
      createdBy: string | null;
      createdAt: string;
      notes: string | null;
    }>;
  };
}

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  QUARANTINE: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200',
  EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
};

const originLabel: Record<BatchMatch['origin'], string> = {
  PRODUCTION_ORDER: 'Made by production order',
  PRODUCTION_PLAN: 'Made by production plan',
  INBOUND: 'Received from supplier',
  UNKNOWN: 'Origin unknown',
};

const sourceLabel: Record<string, string> = {
  GRINDING_INPUTS: 'Exact ground batches',
  PLAN_ISSUE: 'Issued to plan (plan-level)',
  PROD_CONSUMPTION: 'Consumed by order',
};

export default function Traceability({ searchQuery: _searchQuery = '' }: { searchQuery?: string }) {
  const [term, setTerm] = useState('');
  const [matches, setMatches] = useState<BatchMatch[]>([]);
  const [tree, setTree] = useState<TraceTree | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState('');

  const loadTree = async (batchId: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get<{ tree: TraceTree }>(`/traceability/batch/${batchId}`);
      setTree(res.data.tree);
    } catch (err: any) {
      setTree(null);
      setError(err?.response?.data?.error || 'Failed to build trace');
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async (value: string) => {
    const q = value.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setTree(null);
    setMatches([]);
    setSearched(q);
    try {
      const res = await axiosClient.get<{ matches: BatchMatch[] }>('/traceability/search', {
        params: { q },
      });
      const found = res.data.matches || [];
      setMatches(found);
      if (found.length === 0) {
        setError(`No batches match "${q}".`);
      } else if (found.length === 1) {
        await loadTree(found[0].id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(term);
  };

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Traceability</h2>
          <p className="text-[#737373] text-xs">
            Trace any raw material, ingredient or finished good — upstream to the supplier and downstream to
            finished goods.
          </p>
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Lot code (A-1-1-26), batch number, ingredient or supplier…"
              className="h-9 w-64 rounded-lg border border-[#E9E9E9] bg-white pl-9 pr-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
            />
          </div>
          <button type="submit" className="btn-3d px-4 h-9">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Network className="w-3.5 h-3.5" /> Trace
            </span>
          </button>
        </form>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-[#E9E9E9] bg-white p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <div className="space-y-3 rounded-xl border border-[#E9E9E9] bg-white p-4">
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>
      )}

      {/* Match list (batch numbers are only unique per material) */}
      {!loading && matches.length > 1 && (
        <div className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {matches.length} matches for “{searched}” — pick one
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {matches.map((m) => (
              <button
                key={m.id}
                onClick={() => loadTree(m.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60"
              >
                <div className="min-w-0">
                  {/* The code leads, with the ingredient and supplier named beside it. */}
                  <p className="font-mono text-xs font-bold text-[#171717]">
                    {m.lotCode ?? m.batchNumber}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {m.material?.name} · <span className="font-mono">{m.material?.sku}</span>
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {m.supplier?.name ? `from ${m.supplier.name}` : originLabel[m.origin]}
                    {m.lotCode && ` · ${originLabel[m.origin]}`}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold ${
                    statusBadge[m.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {m.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tree && !loading && (
        <div className="space-y-4">
          {/* Root */}
          <div className="rounded-xl border border-[#E9E9E9] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EA4335]/10">
                  <PackageSearch className="h-4 w-4 text-[#EA4335]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#171717]">{tree.batch.batchNumber}</p>
                    <span
                      className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        statusBadge[tree.batch.status] ?? statusBadge.ACTIVE
                      }`}
                    >
                      {tree.batch.status}
                    </span>
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      {originLabel[tree.origin]}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {tree.batch.material.name} ·{' '}
                    <span className="font-mono">{tree.batch.material.sku}</span> · {tree.batch.material.type}
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
          </div>

          {/* ---- UPSTREAM ---- */}
          <SectionTitle icon={<ArrowDownRight className="h-3 w-3 rotate-180" />} label="Upstream — where it came from" />

          {tree.inbound && (
            <div className="rounded-xl border border-[#E9E9E9] bg-white p-4">
              <p className="mb-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                <Truck className="h-3 w-3" /> Inbound receipt ·{' '}
                {tree.inbound.via === 'CONSIGNMENT' ? 'via Consignment' : tree.inbound.via === 'PO' ? 'via Purchase Order' : ''}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-600">
                <span>GRN <b className="font-mono">{tree.inbound.grnNumber}</b></span>
                {tree.inbound.poNumber && (
                  <span>PO <b className="font-mono">{tree.inbound.poNumber}</b></span>
                )}
                {tree.inbound.consignmentNumber && (
                  <span>Consignment <b className="font-mono">{tree.inbound.consignmentNumber}</b></span>
                )}
                <span>Supplier <b>{tree.inbound.supplier?.name ?? '—'}</b></span>
                <span>Qty <b>{tree.inbound.quantity} {tree.inbound.unitOfMeasure}</b></span>
                <span>Received <b>{new Date(tree.inbound.receivedAt).toLocaleDateString()}</b></span>
              </div>
            </div>
          )}

          {tree.producedBy && (
            <div className="rounded-xl border border-[#E9E9E9] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50">
                  <Factory className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#171717]">
                    {tree.producedBy.source === 'PRODUCTION_PLAN'
                      ? `Produced by plan ${tree.producedBy.planNumber}`
                      : `Produced by order ${tree.producedBy.orderNumber}`}
                    {tree.producedBy.productName && (
                      <span className="ml-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                        {tree.producedBy.productName}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Required {tree.producedBy.targetQuantity} · Achieved {tree.producedBy.actualYield ?? '—'}
                    {tree.producedBy.completedAt && (
                      <> · Completed {new Date(tree.producedBy.completedAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stages */}
          {(tree.stages.grinding || tree.stages.finishing) && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {tree.stages.grinding && <StageCard title="Grinding" icon={<Cog className="h-3.5 w-3.5" />} stage={tree.stages.grinding} />}
              {tree.stages.finishing && <StageCard title="Finishing" icon={<ClipboardList className="h-3.5 w-3.5" />} stage={tree.stages.finishing} />}
            </div>
          )}

          {/* Ingredients */}
          {tree.ingredients.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Boxes className="h-3 w-3" /> Ingredients &amp; raw batches
                </p>
              </div>
              <div className="divide-y divide-slate-50">
                {tree.ingredients.map((ing) => (
                  <div key={ing.materialId} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-700">{ing.materialName ?? ing.materialId}</p>
                        <p className="text-[9px] font-mono text-slate-400">{ing.sku ?? ''}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-mono text-slate-500">
                          {ing.quantity}{ing.isPercentage ? '%' : ''} {ing.unitOfMeasure}
                        </span>
                        {ing.source && (
                          <p className="text-[9px] text-slate-400">{sourceLabel[ing.source]}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1.5 border-l-2 border-slate-100 pl-3">
                      {ing.rawBatches.length === 0 && (
                        <p className="text-[10px] text-slate-400">No batch-lot consumption traced.</p>
                      )}
                      {ing.rawBatches.map((rb) => (
                        <div key={rb.batch.id} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-600">
                              {rb.batch.lotCode ?? rb.batch.batchNumber}
                            </span>
                            {rb.batch.supplierBatchNumber && (
                              <span className="text-[9px] text-slate-400">
                                sup. batch <b className="font-mono">{rb.batch.supplierBatchNumber}</b>
                              </span>
                            )}
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                                statusBadge[rb.batch.status] ?? statusBadge.ACTIVE
                              }`}
                            >
                              {rb.batch.status}
                            </span>
                            {rb.batch.expiryDate && (
                              <span className="text-[9px] text-slate-400">
                                exp {new Date(rb.batch.expiryDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {rb.inbound ? (
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              ← {rb.inbound.via === 'CONSIGNMENT' ? 'Consignment' : 'GRN'}{' '}
                              <b className="font-mono">{rb.inbound.consignmentNumber ?? rb.inbound.grnNumber}</b>
                              {rb.inbound.poNumber && <> · PO <b className="font-mono">{rb.inbound.poNumber}</b></>} ·{' '}
                              {rb.inbound.supplier?.name ?? '—'}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[10px] text-slate-400">← no inbound GRN traced</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- DOWNSTREAM ---- */}
          <SectionTitle icon={<ArrowDownRight className="h-3 w-3" />} label="Downstream — where it went" />

          <div className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Factory className="h-3 w-3" /> Used in finished batches
              </p>
            </div>
            {tree.downstream.usedInFinishedBatches.length === 0 ? (
              <p className="px-4 py-3 text-[11px] text-slate-400">
                Not consumed by any finished batch yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-50">
                {tree.downstream.usedInFinishedBatches.map((d, idx) => (
                  <div key={`${d.batchLotId}-${idx}`} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-bold text-slate-700">{d.batchNumber ?? '—'}</p>
                      <p className="text-[10px] text-slate-400">
                        {d.materialName ?? '—'}
                        {d.productName ? ` · ${d.productName}` : ''}
                        {d.planNumber ? ` · plan ${d.planNumber}` : ''}
                        {d.orderNumber ? ` · order ${d.orderNumber}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-mono text-slate-500">{d.quantity}</p>
                      <p className="text-[9px] uppercase tracking-wider text-slate-400">
                        {d.via === 'GRINDING' ? 'grinding input' : 'order release'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Movements */}
          {tree.downstream.movements.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-[#E9E9E9] bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <RotateCcw className="h-3 w-3" /> Stock movements
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-[9px] uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-4 py-2 font-semibold">Event</th>
                      <th className="px-4 py-2 font-semibold">Qty</th>
                      <th className="px-4 py-2 font-semibold">Warehouse</th>
                      <th className="px-4 py-2 font-semibold">Reference</th>
                      <th className="px-4 py-2 font-semibold">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tree.downstream.movements.map((m) => (
                      <tr key={m.id} className="border-b border-slate-50">
                        <td className="px-4 py-2 text-[10px] text-slate-500">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-[10px] font-semibold text-slate-600">{m.eventType}</td>
                        <td className="px-4 py-2 text-[10px] font-mono text-slate-600">
                          {m.quantity} {m.unitOfMeasure}
                        </td>
                        <td className="px-4 py-2 text-[10px] text-slate-500">{m.warehouseName ?? '—'}</td>
                        <td className="px-4 py-2 text-[10px] text-slate-500">
                          {m.referenceType ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-[10px] text-slate-500">{m.createdBy ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!searched && !tree && !loading && !error && (
        <div className="rounded-xl border border-[#E9E9E9] bg-white">
          <EmptyState
            title="No batch selected."
            hint="Search any batch number, material name or SKU to trace it end to end."
          />
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
      {icon}
      {label}
    </div>
  );
}

function StageCard({
  title,
  icon,
  stage,
}: {
  title: string;
  icon: React.ReactNode;
  stage: StageInfo;
}) {
  return (
    <div className="rounded-xl border border-[#E9E9E9] bg-white p-4">
      <p className="mb-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {icon} {title} · {stage.status}
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-600">
        <span>In <b>{stage.inputQuantity}</b></span>
        <span>Out <b>{stage.achievedQuantity}</b></span>
        <span>Remainder <b>{stage.remainderQuantity}</b></span>
        {stage.batchNumber && <span>Batch <b className="font-mono">{stage.batchNumber}</b></span>}
        <span>{new Date(stage.productionDate).toLocaleDateString()}</span>
      </div>
      {stage.remainders.length > 0 && (
        <p className="mt-2 text-[10px] text-slate-400">
          Returned to store: {stage.remainders.map((r) => `${r.quantity} ${r.unitOfMeasure}`).join(', ')}
        </p>
      )}
    </div>
  );
}
