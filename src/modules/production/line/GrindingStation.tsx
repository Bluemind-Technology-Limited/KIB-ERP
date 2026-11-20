import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { formatNumber } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { Pagination } from '../../../components/ui/Pagination';
import { usePagination } from '../../../hooks/usePagination';

interface AggregatedIngredient {
  id: string;
  materialId: string;
  totalQuantity: string | number;
  unitOfMeasure: string;
  status: string;
  issuedQuantity?: string | number | null;
  issuedWarehouseId?: string | null;
  material: { id: string; name: string; sku: string };
}


interface PlanItem {
  id: string;
  sequence: number;
  targetQuantity: string | number;
  bom: {
    productName: string;
    yieldUnit?: string | null;
    expectedYield?: string | number | null;
    finishedSku?: { name: string; sku: string; unitOfMeasure: string } | null;
  };
  grindingRecord?: { achievedQuantity: string | number; remainderQuantity: string | number } | null;
  grindingRecords?: Array<{ inputQuantity?: string | number; achievedQuantity: string | number; remainderQuantity: string | number }>;
  expectedBatches?: number;
  expectedYield?: number;
  receivedQuantity?: number;
  batchesGround?: number;
  groundQuantity?: number;
  grindingOutstanding?: number;
  variance?: number;
  grindingStatus?: string;
  finishingStatus?: string;
  stationStatus?: string;
}

interface Plan {
  id: string;
  planNumber: string;
  status: string;
  scheduledFor?: string | null;
  items: PlanItem[];
  aggregatedIngredients: AggregatedIngredient[];
  progress: { grinding: { totalItems: number; done: number; complete: boolean } };
}

interface FormState {
  inputQuantity: string;
  achievedQuantity: string;
  receivedQuantity: string;
  batchesProcessed: string;
  grindingBatchNumber: string;
  mixUnits: string;
  productionDate: string;
  machineId: string;
  remarks: string;
  remainders: Record<string, string>;
  inputs: Record<string, { quantity: string; batchLotId: string }>;
}

interface GrindingSequence {
  lastNumber: number | null;
  nextNumber: number | null;
}

const today = () => new Date().toISOString().slice(0, 10);

/** "Curry 100g" / "curry100g" → "Curry": the size is not part of the product. */
function familyName(name: string) {
  const cleaned = String(name ?? '')
    .replace(/\s*\d+(?:[.,]\d+)?\s*(?:g|kg|mg|ml|l|oz|lb)\b\.?$/i, '')
    .trim();
  return cleaned || String(name ?? '');
}

function emptyForm(
  item: PlanItem,
  ingredients: AggregatedIngredient[],
  grindingBatchNumber = ''
): FormState {
  const remainders: Record<string, string> = {};
  const inputs: Record<string, { quantity: string; batchLotId: string }> = {};
  for (const agg of ingredients) {
    remainders[agg.materialId] = '';
    inputs[agg.materialId] = { quantity: '', batchLotId: '' };
  }
  return {
    inputQuantity: String(item.grindingOutstanding ?? item.targetQuantity ?? ''),
    achievedQuantity: String(item.grindingOutstanding ?? item.targetQuantity ?? ''),
    receivedQuantity: String(item.grindingOutstanding ?? item.targetQuantity ?? ''),
    batchesProcessed: String(
      Math.max(
        0,
        Number(item.expectedBatches ?? 0) - Number(item.batchesGround ?? 0)
      ) || ''
    ),
    grindingBatchNumber,
    mixUnits: '',
    productionDate: today(),
    machineId: '',
    remarks: '',
    remainders,
    inputs,
  };
}

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function GrindingStation() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** Selected production day (date key) in the detail view — kept in the URL so Back/Forward work. */
  const [searchParams, setSearchParams] = useSearchParams();
  const openDayKey = searchParams.get('day');
  const setOpenDayKey = useCallback(
    (key: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (key) next.set('day', key);
      else next.delete('day');
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );
  /** The plan item currently being recorded in the modal. */
  const [entry, setEntry] = useState<{ planId: string; itemId: string } | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  /** Continuous grinding batch serial (seeded by the grinding manager). */
  const [sequence, setSequence] = useState<GrindingSequence>({ lastNumber: null, nextNumber: null });
  const [sequenceEditorOpen, setSequenceEditorOpen] = useState(false);
  const [sequenceInput, setSequenceInput] = useState('');
  const [savingSequence, setSavingSequence] = useState(false);
  const [sequenceError, setSequenceError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, machineRes, seqRes] = await Promise.all([
        axiosClient.get('/production-line/queue', { params: { station: 'GRINDING' } }),
        axiosClient.get('/production/machines').catch(() => ({ data: { machines: [] } })),
        axiosClient.get<GrindingSequence>('/production-line/grinding-batch-sequence').catch(() => ({ data: { lastNumber: null, nextNumber: null } })),
      ]);
      setPlans(queueRes.data.plans || []);
      setMachines(machineRes.data.machines || []);
      setSequence(seqRes.data);
      setError('');
    } catch (err: any) {
      setError(apiError(err, 'Failed to load the grinding queue'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);



  const openSequenceEditor = () => {
    setSequenceInput(sequence.lastNumber === null ? '' : String(sequence.lastNumber));
    setSequenceError('');
    setSequenceEditorOpen(true);
  };

  const saveSequence = async () => {
    const value = Number(sequenceInput);
    if (!Number.isInteger(value) || value < 0) {
      setSequenceError('Enter the last grinding batch number as a whole number.');
      return;
    }
    setSavingSequence(true);
    setSequenceError('');
    try {
      const res = await axiosClient.put<GrindingSequence>('/production-line/grinding-batch-sequence', {
        lastNumber: value,
      });
      setSequence(res.data);
      setSequenceEditorOpen(false);
      // Re-prefill the open batches from the new counter.
      setForms({});
    } catch (err: any) {
      setSequenceError(apiError(err, 'Failed to update the grinding batch sequence'));
    } finally {
      setSavingSequence(false);
    }
  };

  const submit = async (plan: Plan, item: PlanItem) => {
    const form = forms[item.id];
    if (!form) return;
    setError('');

    if (Number(form.achievedQuantity) > Number(form.inputQuantity)) {
      setError('Achieved quantity cannot exceed the input quantity.');
      return;
    }

    const remainders = Object.entries(form.remainders)
      .map(([materialId, qty]) => ({ materialId, quantity: Number(qty) }))
      .filter((r) => r.quantity > 0);

    const inputs = Object.entries(form.inputs)
      .map(([materialId, v]) => ({
        materialId,
        quantity: Number(v.quantity),
        batchLotId: v.batchLotId || null,
      }))
      .filter((r) => r.quantity > 0);

    const remainderQuantity = remainders.reduce((sum, r) => sum + r.quantity, 0);

    setBusyItem(item.id);
    try {
      // Untouched field → let the server allocate the block atomically.
      const typedBatch = form.grindingBatchNumber.trim();
      const isDefaultBatch =
        typedBatch === '' ||
        (sequence.nextNumber !== null && Number(typedBatch) === sequence.nextNumber);

      await axiosClient.post(`/production-line/plans/${plan.id}/items/${item.id}/grinding`, {
        inputQuantity: Number(form.inputQuantity),
        achievedQuantity: Number(form.achievedQuantity),
        receivedQuantity: form.receivedQuantity ? Number(form.receivedQuantity) : 0,
        batchesProcessed: form.batchesProcessed ? Number(form.batchesProcessed) : 0,
        remainderQuantity,
        remainders,
        inputs,
        machineId: form.machineId || null,
        grindingBatchNumber: isDefaultBatch ? null : Number(typedBatch),
        mixUnits: form.mixUnits ? Number(form.mixUnits) : undefined,
        productionDate: form.productionDate,
        remarks: form.remarks || undefined,
      });
      await load();
    } catch (err: any) {
      setError(apiError(err, 'Failed to record grinding'));
    } finally {
      setBusyItem(null);
    }
  };

  /** Grinding work grouped by production day. */
  const grindDays = useMemo(() => {
    const byDate = new Map<
      string,
      {
        key: string;
        label: string;
        totalBatches: number;
        families: Array<{ name: string; batches: number; uom: string }>;
        items: Array<{ plan: Plan; item: PlanItem }>;
        complete: boolean;
        started: boolean;
      }
    >();

    for (const plan of plans) {
      const raw = plan.scheduledFor ? new Date(plan.scheduledFor) : new Date();
      const key = `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(
        raw.getDate()
      ).padStart(2, '0')}`;

      let day = byDate.get(key);
      if (!day) {
        day = {
          key,
          label: raw.toLocaleDateString(),
          totalBatches: 0,
          families: [],
          items: [],
          complete: true,
          started: false,
        };
        byDate.set(key, day);
      }

      for (const item of plan.items) {
        const full = item.bom?.finishedSku?.name ?? item.bom?.productName ?? 'Product';
        const name = familyName(full);
        const uom = item.bom?.finishedSku?.unitOfMeasure ?? item.bom?.yieldUnit ?? '';
        const batches = Number(item.expectedBatches ?? item.targetQuantity ?? 0);
        const ground = Number(item.batchesGround ?? 0);

        day.totalBatches += batches;
        day.items.push({ plan, item });
        if (ground > 0.0001) day.started = true;
        if (Number(item.grindingOutstanding ?? batches) > 0.0001) day.complete = false;

        const existing = day.families.find((f) => f.name === name && f.uom === uom);
        if (existing) existing.batches += batches;
        else day.families.push({ name, batches, uom });
      }
    }

    return [...byDate.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [plans]);

  const { page, totalPages, total, pageItems, setPage } = usePagination(grindDays);

  /** Open the modal that records grinding for one plan item. */
  const openEntry = async (plan: Plan, item: PlanItem) => {
    const prefilled = sequence.nextNumber === null ? '' : String(sequence.nextNumber);
    setForms({ [item.id]: emptyForm(item, plan.aggregatedIngredients, prefilled) });
    setEntry({ planId: plan.id, itemId: item.id });
    setError('');
  };

  const entryPlan = entry ? plans.find((plan) => plan.id === entry.planId) ?? null : null;
  const entryItem =
    entryPlan && entry ? entryPlan.items.find((item) => item.id === entry.itemId) ?? null : null;

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Grinding Station</h2>
          <PageDescription>Record what you actually ground for each batch, and return any unused ingredients.</PageDescription>
        </div>
        <Button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 h-9 text-xs disabled:opacity-50"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-4">
              <Skeleton className="mb-3 h-4 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState title="No batches to grind" hint="Batches appear once the store issues the ingredients." />
        </div>
      ) : openDayKey ? (
        <div className="space-y-3">
          {(() => {
            const day = grindDays.find((d) => d.key === openDayKey);
            if (!day) return null;
            return (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink">{day.label}</h3>
                  </div>
                  <span
                    className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      day.complete
                        ? 'bg-emerald-600 text-white'
                        : day.started
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-600 text-white'
                    }`}
                  >
                    {day.complete ? 'Completed' : day.started ? 'Started' : 'Pending'}
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-line bg-surface">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-line text-[9px] uppercase tracking-wider text-ink-faint">
                        <th className="w-full px-4 py-2 font-semibold">Product</th>
                        <th className="px-4 py-2 text-right font-semibold">Batches</th>
                        <th className="px-4 py-2 text-right font-semibold">Ground</th>
                        <th className="px-4 py-2 text-right font-semibold">Outstanding</th>
                        <th className="px-4 py-2 text-right font-semibold">Action</th>
                        <th className="px-4 py-2 text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.items.map(({ plan, item }) => {
                        const batches = Number(item.expectedBatches ?? item.targetQuantity ?? 0);
                        const ground = Number(item.batchesGround ?? 0);
                        const outstanding = Math.max(
                          0,
                          Number(item.grindingOutstanding ?? batches - ground)
                        );
                        const status =
                          outstanding <= 0.0001
                            ? 'Completed'
                            : plan.status === 'SCHEDULED'
                              ? 'Waiting'
                              : ground > 0
                                ? 'Started'
                                : 'Pending';
                        return (
                          <tr
                            key={`${plan.id}-${item.id}`}
                            className="border-b border-line last:border-0"
                          >
                            <td className="px-4 py-3 text-[11px] font-semibold text-ink-2">
                              {familyName(
                                item.bom?.finishedSku?.name ?? item.bom?.productName ?? 'Product'
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-[11px] font-bold text-ink">
                              {formatNumber(batches)}
                            </td>
                            <td className="px-4 py-3 text-right text-[11px] text-ink-muted">
                              {formatNumber(ground)}
                            </td>
                            <td className="px-4 py-3 text-right text-[11px] font-semibold text-ink-muted">
                              {formatNumber(outstanding)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                type="button"
                                onClick={() => openEntry(plan, item)}
                                disabled={outstanding <= 0.0001 || plan.status === 'SCHEDULED'}
                                title={
                                  plan.status === 'SCHEDULED'
                                    ? 'Waiting for the Ingredients Station'
                                    : outstanding <= 0.0001
                                      ? 'Already ground'
                                      : 'Record grinding'
                                }
                                className="flex h-7 items-center gap-1 px-2.5 text-[10px] disabled:opacity-40 ml-auto"
                              >
                                Record
                              </Button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                  status === 'Completed'
                                    ? 'bg-emerald-600 text-white'
                                    : status === 'Started'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-slate-600 text-white'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-[9px] uppercase tracking-wider text-ink-faint">
                <th className="w-full px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 text-right font-semibold">Batches</th>
                <th className="px-4 py-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((day) => (
                <tr
                  key={day.key}
                  onClick={() => setOpenDayKey(day.key)}
                  className="cursor-pointer border-b border-line hover:bg-surface-2/60 last:border-0"
                >
                  <td className="px-4 py-3 text-[11px] font-semibold text-ink-2">
                    {day.label}
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] font-bold text-ink">
                    {formatNumber(day.totalBatches)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        day.complete
                          ? 'bg-emerald-600 text-white'
                          : day.started
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-600 text-white'
                      }`}
                    >
                      {day.complete ? 'Completed' : day.started ? 'Started' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      {entryPlan && entryItem && forms[entryItem.id] && (
        <Modal onClose={() => setEntry(null)}>
          <div className="w-full max-w-3xl space-y-4 rounded-xl bg-surface p-5 max-h-[88vh] overflow-y-auto">
            {(() => {
              const form = forms[entryItem.id];
              const patch = (next: Partial<FormState>) =>
                setForms((prev) => ({
                  ...prev,
                  [entryItem.id]: { ...prev[entryItem.id], ...next },
                }));
              const issued = entryPlan.aggregatedIngredients.filter(
                (agg) => agg.status === 'RELEASED' || Number(agg.issuedQuantity ?? 0) > 0
              );

              // One serial per batch ground: the entry walks the block forward.
              // Mirrors the server: the batch count drives it, falling back to the
              // achieved quantity when the batch field is left blank.
              const blockBatches = (() => {
                const typed = Number(form.batchesProcessed);
                const raw = typed > 0 ? typed : Number(form.achievedQuantity);
                const n = Math.round(raw);
                return Number.isFinite(n) && n >= 1 ? n : 1;
              })();
              const blockStart = Number(form.grindingBatchNumber || sequence.nextNumber || 0);
              const blockEnd = blockStart > 0 ? blockStart + blockBatches - 1 : 0;

              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">
                        Record grinding · {entryPlan.planNumber}
                      </p>
                      <h3 className="text-sm font-bold text-ink">
                        {familyName(
                          entryItem.bom?.finishedSku?.name ??
                            entryItem.bom?.productName ??
                            'Product'
                        )}
                      </h3>
                      <p className="text-[10px] text-ink-faint">
                        Planned {formatNumber(entryItem.expectedBatches ?? 0)} batch(es)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEntry(null)}
                      className="text-ink-faint hover:text-ink-muted"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex min-h-[24px] items-start justify-between gap-1">
                        <label className="text-[9px] font-semibold uppercase leading-tight tracking-wider text-ink-faint">
                          Grinding batch no.
                        </label>
                        <Button
                          type="button"
                          onClick={openSequenceEditor}
                          className="shrink-0 text-[9px] text-[#AA3BFF]"
                        >
                          Set last
                        </Button>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={form.grindingBatchNumber}
                        onChange={(e) => patch({ grindingBatchNumber: e.target.value })}
                        placeholder={sequence.nextNumber === null ? 'Enter' : String(sequence.nextNumber)}
                        className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                      />
                      <p
                        className="text-[9px] leading-tight text-ink-faint"
                        title="Numbers consumed by this record"
                      >
                        {blockStart > 0
                          ? blockEnd > blockStart
                            ? `${formatNumber(blockStart, 0)} – ${formatNumber(blockEnd, 0)}`
                            : formatNumber(blockStart, 0)
                          : 'Set last first'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="min-h-[24px] text-[9px] font-semibold uppercase leading-tight tracking-wider text-ink-faint">
                        Batch(es)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={form.batchesProcessed}
                        onChange={(e) => patch({ batchesProcessed: e.target.value })}
                        className="h-8 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="min-h-[24px] text-[9px] font-semibold uppercase leading-tight tracking-wider text-ink-faint">
                        Mix units
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.mixUnits}
                        onChange={(e) => patch({ mixUnits: e.target.value })}
                        placeholder="e.g. 5"
                        className="h-8 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="min-h-[24px] text-[9px] font-semibold uppercase leading-tight tracking-wider text-ink-faint">
                        Date
                      </label>
                      <input
                        type="date"
                        value={form.productionDate}
                        onChange={(e) => patch({ productionDate: e.target.value })}
                        className="h-8 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="min-h-[24px] text-[9px] font-semibold uppercase leading-tight tracking-wider text-ink-faint">
                        Input qty
                      </label>
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={form.inputQuantity}
                        onChange={(e) => patch({ inputQuantity: e.target.value })}
                        className="h-8 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="min-h-[24px] text-[9px] font-semibold uppercase leading-tight tracking-wider text-ink-faint">
                        Received
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={form.receivedQuantity}
                        onChange={(e) => patch({ receivedQuantity: e.target.value })}
                        className="h-8 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="min-h-[24px] text-[9px] font-semibold uppercase leading-tight tracking-wider text-ink-faint">
                        Achieved
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={form.achievedQuantity}
                        onChange={(e) => patch({ achievedQuantity: e.target.value })}
                        className="h-8 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                      />
                    </div>
                    {machines.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <label className="min-h-[24px] text-[9px] font-semibold uppercase leading-tight tracking-wider text-ink-faint">
                          Machine
                        </label>
                        <select
                          value={form.machineId}
                          onChange={(e) => patch({ machineId: e.target.value })}
                          className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                        >
                          <option value="">Not specified</option>
                          {machines.map((machine) => (
                            <option key={machine.id} value={machine.id}>
                              {machine.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-line bg-surface-2/60 p-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                      Unused ingredients returned to store
                    </p>
                    {issued.length === 0 ? (
                      <p className="text-[11px] text-ink-faint">No released ingredients to return.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        {issued.map((agg) => (
                          <div key={agg.id} className="flex items-center gap-2">
                            <span className="flex-1 truncate text-[10px] text-ink-muted">
                              {agg.material.name}
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={form.remainders[agg.materialId] ?? ''}
                              onChange={(e) =>
                                patch({
                                  remainders: {
                                    ...form.remainders,
                                    [agg.materialId]: e.target.value,
                                  },
                                })
                              }
                              placeholder="0"
                              className="h-7 w-20 rounded border border-line px-2 text-[11px] focus:outline-none focus:border-[#AA3BFF]"
                            />
                            <span className="text-[9px] text-ink-faint">{agg.unitOfMeasure}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <input
                      value={form.remarks}
                      onChange={(e) => patch({ remarks: e.target.value })}
                      placeholder="Remarks (optional)"
                      className="h-9 flex-1 rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#AA3BFF]"
                    />
                    <Button
                      type="button"
                      onClick={() => submit(entryPlan, entryItem)}
                      disabled={busyItem === entryItem.id}
                      className="flex items-center gap-2 px-4 h-9 text-xs disabled:opacity-50"
                    >
                      {busyItem === entryItem.id ? 'Saving…' : 'Record grinding'}
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {sequenceEditorOpen && (
        <Modal onClose={() => !savingSequence && setSequenceEditorOpen(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">Grinding batch number</h3>
                <p className="mt-1 text-[10px] text-ink-faint">
                  Set the last number already used. Each batch ground uses one number, so the
                  next run continues from here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSequenceEditorOpen(false)}
                disabled={savingSequence}
                className="text-ink-faint hover:text-ink-muted"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                Last batch number
              </label>
              <input
                type="number"
                min="0"
                value={sequenceInput}
                onChange={(e) => setSequenceInput(e.target.value)}
                placeholder="e.g. 800150"
                className="h-9 w-full rounded-lg border border-line px-3 text-xs font-mono focus:outline-none focus:border-[#AA3BFF]"
              />
              <p className="text-[9px] text-ink-faint">
                Next block starts at{' '}
                <span className="font-mono font-semibold text-ink-muted">
                  {sequenceInput === '' || Number.isNaN(Number(sequenceInput))
                    ? '—'
                    : formatNumber(Number(sequenceInput) + 1, 0)}
                </span>
              </p>
            </div>

            {sequenceError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {sequenceError}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-line pt-2">
              <Button
                type="button"
                onClick={() => setSequenceEditorOpen(false)}
                disabled={savingSequence}
                className="h-9 px-4 text-xs disabled:opacity-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={saveSequence}
                disabled={savingSequence}
                className="btn-3d h-9 px-4 text-xs disabled:opacity-50"
              >
                {savingSequence ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
