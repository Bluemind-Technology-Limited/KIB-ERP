import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Layers,
  Loader,
  Package,
  Sigma,
} from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { formatNumber, parseUom } from '../../../lib/format';

export interface RequirementIngredient {
  materialId: string;
  name: string;
  sku: string;
  unitOfMeasure: string;
  quantityPerBatch: number;
  perBatchRequired: number;
  batchCount: number;
  totalRequired: number;
  isPercentage: boolean;
  packWeightKg: number | null;
  perBatchWeightKg: number | null;
  totalWeightKg: number | null;
}

export interface RequirementFormula {
  planItemId: string;
  sequence: number;
  bomId: string;
  productName: string;
  sku: string;
  expectedYield: number;
  yieldUnit: string;
  targetQuantity: number;
  batchCount: number;
  batchStatus?: string | null;
  batchApprovedAt?: string | null;
  ingredients: RequirementIngredient[];
  totalWeightKg: number;
}

export interface ConsolidatedRequirement {
  materialId: string;
  name: string;
  sku: string;
  unitOfMeasure: string;
  totalRequired: number;
  packWeightKg: number | null;
  totalWeightKg: number | null;
  sources: Array<{
    planItemId: string;
    bomId: string;
    productName: string;
    totalRequired: number;
    unitOfMeasure: string;
  }>;
}

export interface RequirementsResponse {
  plan: {
    id: string;
    planNumber: string;
    status: string;
    description?: string | null;
    scheduledFor?: string | null;
  };
  formulas: RequirementFormula[];
  consolidated: ConsolidatedRequirement[];
  totals: {
    formulas: number;
    batches: number;
    ingredients: number;
    totalWeightKg: number;
  };
}

function apiError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

/** "2 × 25 KG" when the UOM is a pack label, else "2 KG". */
function packText(quantity: number | string, unit?: string | null) {
  const parsed = parseUom(unit);
  return parsed
    ? `${formatNumber(quantity)} × ${unit}`
    : `${formatNumber(quantity)} ${unit ?? ''}`.trim();
}

function perBatchDisplay(line: RequirementIngredient) {
  return (
    <div className="space-y-0.5">
      <p className="font-semibold text-ink">
        {line.isPercentage
          ? `${formatNumber(line.quantityPerBatch)}%`
          : packText(line.perBatchRequired, line.unitOfMeasure)}
      </p>
      <p className="text-[9px] text-ink-faint">
        {line.isPercentage
          ? `${packText(line.perBatchRequired, line.unitOfMeasure)}/batch`
          : line.perBatchWeightKg != null
            ? `= ${formatNumber(line.perBatchWeightKg)} KG`
            : 'per batch'}
      </p>
    </div>
  );
}

function totalDisplay(line: RequirementIngredient) {
  return (
    <div className="space-y-0.5">
      <p className="font-bold text-ink tabular-nums">
        {packText(line.totalRequired, line.unitOfMeasure)}
      </p>
      <p className="text-[9px] font-medium text-[#0077A8]">
        {line.totalWeightKg != null ? `= ${formatNumber(line.totalWeightKg)} KG` : 'pack count'}
      </p>
    </div>
  );
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
      <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

export function IngredientRequirementsPanel({
  planId,
  className = '',
}: {
  planId: string;
  className?: string;
}) {
  const [data, setData] = useState<RequirementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axiosClient
      .get<RequirementsResponse>(`/production/production-plans/${planId}/ingredient-requirements`)
      .then((res) => {
        if (active) setData(res.data);
      })
      .catch((err) => {
        if (active) setError(apiError(err, 'Failed to calculate ingredient requirements'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [planId]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-xl border border-line bg-surface py-14 text-xs text-ink-faint ${className}`}
      >
        <Loader className="h-4 w-4 animate-spin text-[#00B4D8]" />
        Calculating requirements from approved batch formulas…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 ${className}`}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { plan, formulas, consolidated, totals } = data;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Hero — the calculation, at a glance */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0B1220] p-5 text-white shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#00B4D8]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-[#EA4335]/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/40">
              Automatic requirement calculation
            </p>
            <h3 className="mt-1 text-lg font-bold tracking-tight">
              {plan.planNumber}
              <span className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ml-2 bg-slate-600 align-middle text-white">
                {plan.status.replace('_', ' ')}
              </span>
            </h3>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-white/50">
              Every quantity below is derived from the approved batch formulas. No totals are typed
              by hand — change a formula or a batch count and this recalculates.
            </p>
            <div className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px]">
              <Sigma className="h-3.5 w-3.5 text-[#7DD3FC]" />
              <span className="text-white/60">(quantity per batch</span>
              <span className="text-white/30">×</span>
              <span className="text-white/60">number of batches)</span>
              <span className="text-white/30">=</span>
              <span className="font-bold text-white">total required</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <HeroStat label="Formulas" value={formatNumber(totals.formulas)} />
            <HeroStat
              label="Σ Batches"
              value={formatNumber(totals.batches)}
              accent="text-[#7DD3FC]"
            />
            <HeroStat label="Ingredients" value={formatNumber(totals.ingredients)} />
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between border-t border-white/10 pt-3">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            <Package className="h-3.5 w-3.5" /> Total net weight
          </span>
          <span className="text-lg font-bold tabular-nums text-white">
            {formatNumber(totals.totalWeightKg)}{' '}
            <span className="text-[11px] text-white/50">KG</span>
          </span>
        </div>
      </div>

      {/* Formula-by-formula calculation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            <FlaskConical className="h-3.5 w-3.5 text-[#AA3BFF]" />
            Formula-level calculation
          </p>
          <p className="text-[10px] text-ink-faint">
            {formatNumber(formulas.length)} formula{formulas.length === 1 ? '' : 's'}
          </p>
        </div>

        {formulas.map((formula) => {
          const open = !collapsed[formula.planItemId];
          return (
            <div
              key={formula.planItemId}
              className="overflow-hidden rounded-xl border border-line bg-surface"
            >
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [formula.planItemId]: open }))
                }
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#AA3BFF]/10 text-[10px] font-bold text-[#7C2BB8]">
                    #{formula.sequence}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">
                      {formula.productName}
                    </p>
                    <p className="truncate text-[10px] text-ink-faint">
                      {formula.sku} · {formatNumber(formula.ingredients.length)} ingredients
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-md border border-[#00B4D8]/30 bg-[#00B4D8]/10 px-2 py-0.5 text-[10px] font-bold text-[#0077A8]">
                    {formatNumber(formula.batchCount)} batches
                  </span>
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-ink-faint" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-ink-faint" />
                  )}
                </div>
              </button>

              {open && (
                <div className="border-t border-line px-4 py-4">
                  {/* Batch multiplier equation */}
                  <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
                    <div className="rounded-lg border border-line bg-surface-2/70 px-3 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-ink-faint">
                        Plan target
                      </p>
                      <p className="mt-0.5 text-[12px] font-bold text-ink">
                        {formatNumber(formula.targetQuantity)} {formula.yieldUnit}
                      </p>
                    </div>
                    <div className="flex items-center justify-center text-sm font-bold text-ink-faint">
                      ÷
                    </div>
                    <div className="rounded-lg border border-line bg-surface-2/70 px-3 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-ink-faint">
                        Yield per batch
                      </p>
                      <p className="mt-0.5 text-[12px] font-bold text-ink">
                        {formatNumber(formula.expectedYield)} {formula.yieldUnit}
                      </p>
                    </div>
                    <div className="flex items-center justify-center text-sm font-bold text-ink-faint">
                      =
                    </div>
                    <div className="rounded-lg border border-[#00B4D8]/40 bg-[#00B4D8]/10 px-3 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-[#0077A8]">
                        Batches
                      </p>
                      <p className="mt-0.5 text-[12px] font-bold text-[#0077A8]">
                        {formatNumber(formula.batchCount)}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left">
                      <thead>
                        <tr className="border-b border-line text-[9px] uppercase tracking-wider text-ink-faint">
                          <th className="py-2 pr-3 font-semibold">Ingredient</th>
                          <th className="px-3 py-2 font-semibold">Per batch</th>
                          <th className="px-3 py-2 text-center font-semibold">Batches</th>
                          <th className="px-3 py-2 font-semibold">= Total required</th>
                          <th className="py-2 pl-3 text-right font-semibold">Net weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formula.ingredients.map((line) => (
                          <tr
                            key={line.materialId}
                            className="border-b border-line last:border-0"
                          >
                            <td className="py-2.5 pr-3">
                              <p className="text-[11px] font-semibold text-ink">{line.name}</p>
                              <p className="font-mono text-[9px] text-ink-faint">{line.sku}</p>
                            </td>
                            <td className="px-3 py-2.5 text-[11px]">{perBatchDisplay(line)}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="inline-block rounded-md bg-slate-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                                × {formatNumber(line.batchCount)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-[11px]">{totalDisplay(line)}</td>
                            <td className="py-2.5 pl-3 text-right text-[11px] font-semibold tabular-nums text-ink-muted">
                              {line.totalWeightKg != null
                                ? `${formatNumber(line.totalWeightKg)} KG`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                    <span className="text-[10px] text-ink-faint">
                      Derived from the approved formula — {formatNumber(formula.ingredients.length)}{' '}
                      ingredient line{formula.ingredients.length === 1 ? '' : 's'}
                    </span>
                    <span className="text-[10px] font-semibold text-ink-muted">
                      Formula net weight:{' '}
                      <span className="text-[12px] font-bold text-ink">
                        {formatNumber(formula.totalWeightKg)} KG
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Consolidated requirement — what the Ingredient Station issues */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex flex-col gap-1 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
              <Layers className="h-3.5 w-3.5 text-[#00B4D8]" />
              Consolidated requirement
            </p>
            <p className="mt-0.5 text-[10px] text-ink-faint">
              Identical ingredients are combined across formulas. These are the exact quantities the
              Ingredient Station must issue.
            </p>
          </div>
          <span className="rounded-full inline-flex items-center justify-center gap-1 min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider self-start sm:self-auto bg-emerald-600 text-white">
            <ArrowRight className="h-3 w-3" /> Ingredient Station work order
          </span>
        </div>

        {consolidated.length === 0 ? (
          <p className="px-4 py-8 text-center text-[11px] text-ink-faint">
            No requirements yet. Add batch formulas to the plan and release it.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-line text-[9px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-2.5 font-semibold">Ingredient</th>
                  <th className="px-4 py-2.5 font-semibold">Total required</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Net weight</th>
                  <th className="px-4 py-2.5 font-semibold">Contributed by</th>
                </tr>
              </thead>
              <tbody>
                {consolidated.map((line) => (
                  <tr
                    key={line.materialId}
                    className="border-b border-line last:border-0 hover:bg-surface-2/50"
                  >
                    <td className="px-4 py-2.5">
                      <p className="text-[11px] font-semibold text-ink">{line.name}</p>
                      <p className="font-mono text-[9px] text-ink-faint">{line.sku}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-[11px] font-bold text-ink">
                        {packText(line.totalRequired, line.unitOfMeasure)}
                      </p>
                      {line.packWeightKg != null && (
                        <p className="text-[9px] text-ink-faint">
                          {formatNumber(line.totalRequired)} packs ×{' '}
                          {formatNumber(line.packWeightKg)} KG
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[11px] font-bold tabular-nums text-ink-2">
                      {line.totalWeightKg != null ? `${formatNumber(line.totalWeightKg)} KG` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {line.sources.map((source) => (
                          <span
                            key={`${source.planItemId}-${line.materialId}`}
                            className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-600 text-white"
                          >
                            {source.productName} · {formatNumber(source.totalRequired)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-surface-2/60">
                  <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    Total
                  </td>
                  <td className="px-4 py-2.5 text-[11px] font-semibold text-ink-muted">
                    {formatNumber(totals.ingredients)} ingredient
                    {totals.ingredients === 1 ? '' : 's'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-bold tabular-nums text-ink">
                    {formatNumber(totals.totalWeightKg)} KG
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 px-1 text-[10px] text-ink-faint">
        <Calculator className="h-3 w-3" />
        Calculated automatically from approved batch formulas and the plan's batch counts. Manual
        requirement totals are not used.
      </p>
    </div>
  );
}

export default IngredientRequirementsPanel;
