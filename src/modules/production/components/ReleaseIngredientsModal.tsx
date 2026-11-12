import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Layers,
  Loader2,
  RefreshCw,
  Rocket,
  X,
} from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Modal } from '../../../components/ui/Modal';
import { Skeleton } from '../../../components/ui/Skeleton';
import { formatNumber, parseUom } from '../../../lib/format';
import type { RequirementsResponse } from './IngredientRequirementsPanel';

interface ReleasePlan {
  id: string;
  planNumber: string;
  scheduledFor?: string | Date | null;
}

function apiError(err: unknown, fallback: string) {
  const typed = err as {
    response?: { data?: { error?: string } };
    message?: string;
  };
  return typed?.response?.data?.error || typed?.message || fallback;
}

function packText(quantity: number | string, unit?: string | null) {
  const parsed = parseUom(unit);
  return parsed
    ? `${formatNumber(quantity)} × ${unit}`
    : `${formatNumber(quantity)} ${unit ?? ''}`.trim();
}

/**
 * Confirmation summary for the single, centralized ingredient release action.
 * The summary is generated from the same requirement calculation the stations
 * receive, so what is approved is exactly what is released.
 */
export function ReleaseIngredientsModal({
  plan,
  onClose,
  onReleased,
}: {
  plan: ReleasePlan;
  onClose: () => void;
  onReleased: () => void;
}) {
  const [data, setData] = useState<RequirementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [released, setReleased] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get<RequirementsResponse>(
        `/production/production-plans/${plan.id}/ingredient-requirements`
      );
      setData(res.data);
    } catch (err: unknown) {
      setError(apiError(err, 'Failed to calculate the release summary'));
    } finally {
      setLoading(false);
    }
  }, [plan.id]);

  useEffect(() => {
    // Defer so the fetch never triggers a synchronous render cascade on mount.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const release = async () => {
    setReleasing(true);
    setError('');
    try {
      await axiosClient.post(`/production/production-plans/${plan.id}/release-ingredients`, {
        scheduledFor: plan.scheduledFor ?? undefined,
      });
      setReleased(true);
      onReleased();
    } catch (err: unknown) {
      setError(apiError(err, 'Failed to release ingredients'));
    } finally {
      setReleasing(false);
    }
  };

  const productionDate = plan.scheduledFor ? new Date(plan.scheduledFor) : null;
  const dateLabel = productionDate
    ? productionDate.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Set on release';

  const products = data?.formulas.map((formula) => formula.productName) ?? [];
  const requirements = data?.consolidated ?? [];
  const visibleRequirements = requirements.slice(0, 5);
  const hiddenCount = Math.max(0, requirements.length - visibleRequirements.length);
  const ready =
    Boolean(data) && !loading && !released && (data?.formulas.length ?? 0) > 0;

  return (
    <Modal onClose={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E9E9E9] bg-white shadow-2xl">
        {/* Header */}
        <div className="relative overflow-hidden bg-[#0B1220] px-5 py-4 text-white">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#00B4D8]/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">
                One-time action
              </p>
              <h3 className="mt-1 flex items-center gap-2 text-base font-bold tracking-tight">
                <Rocket className="h-4 w-4 text-[#7DD3FC]" />
                Release Ingredients
              </h3>
              <p className="mt-1 font-mono text-[11px] text-white/60">{plan.planNumber}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Summary */}
          {loading ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-slate-100 p-3">
                  <Skeleton className="mb-2 h-2.5 w-20" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                  Production order
                </p>
                <p className="mt-0.5 font-mono text-[12px] font-bold text-[#171717]">
                  {plan.planNumber}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-slate-400">
                  <CalendarDays className="h-2.5 w-2.5" /> Production date
                </p>
                <p className="mt-0.5 text-[12px] font-bold text-[#171717]">{dateLabel}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 sm:col-span-2">
                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                  Products
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {products.length ? (
                    products.map((product) => (
                      <span
                        key={product}
                        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                      >
                        {product}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-400">No products</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-[#00B4D8]/30 bg-[#00B4D8]/5 px-3 py-2">
                <p className="text-[8px] font-bold uppercase tracking-wider text-[#0077A8]">
                  Total batches
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#0077A8]">
                  {formatNumber(data?.totals.batches ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-[#EA4335]/25 bg-[#EA4335]/5 px-3 py-2">
                <p className="text-[8px] font-bold uppercase tracking-wider text-[#B3261E]">
                  Total ingredient requirement
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#B3261E]">
                  {formatNumber(data?.totals.ingredients ?? 0)}{' '}
                  <span className="text-[10px] font-semibold">ingredients</span>
                </p>
                <p className="text-[9px] font-medium text-slate-500">
                  {formatNumber(data?.totals.totalWeightKg ?? 0)} KG net weight
                </p>
              </div>
            </div>
          )}

          {/* Requirement preview */}
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Layers className="h-3 w-3 text-[#00B4D8]" /> Consolidated requirement
              </p>
              <span className="text-[9px] text-slate-400">
                {formatNumber(requirements.length)} ingredient
                {requirements.length === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-3 w-full" />
                ))}
              </div>
            ) : requirements.length === 0 ? (
              <p className="px-3 py-5 text-center text-[11px] text-slate-400">
                No requirements available — check the approved batch formulas.
              </p>
            ) : (
              <div className="divide-y divide-slate-50">
                {visibleRequirements.map((line) => (
                  <div
                    key={line.materialId}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-slate-700">
                        {line.name}
                      </p>
                      <p className="font-mono text-[9px] text-slate-400">{line.sku}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-bold text-[#171717]">
                        {packText(line.totalRequired, line.unitOfMeasure)}
                      </p>
                      {line.totalWeightKg != null && (
                        <p className="text-[9px] text-slate-400">
                          {formatNumber(line.totalWeightKg)} KG
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <p className="px-3 py-2 text-[10px] font-semibold text-slate-400">
                    + {formatNumber(hiddenCount)} more ingredient
                    {hiddenCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Consequence + error */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10px] leading-relaxed text-amber-800">
            <Boxes className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              This creates the three station work orders, provisions a QA batch code for every
              formula and notifies the Ingredient, Grinding and Production stations. Releasing is
              one-time and cannot be repeated.
            </span>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] text-rose-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="space-y-1">
                <p>{error}</p>
                {!data && (
                  <button
                    type="button"
                    onClick={load}
                    className="inline-flex items-center gap-1 font-semibold underline"
                  >
                    <RefreshCw className="h-3 w-3" /> Try again
                  </button>
                )}
              </div>
            </div>
          )}

          {released && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Ingredients released successfully.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className="flex items-center gap-1 text-[9px] font-medium text-slate-400">
            <ArrowRight className="h-3 w-3" /> Requirements are generated automatically
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={release}
              disabled={!ready || releasing}
              className="flex h-9 items-center gap-2 rounded-lg bg-[#EA4335] px-4 text-xs font-semibold text-white hover:bg-[#d3362a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {releasing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Rocket className="h-3.5 w-3.5" />
              )}
              {releasing ? 'Releasing…' : 'Release Ingredients'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ReleaseIngredientsModal;
