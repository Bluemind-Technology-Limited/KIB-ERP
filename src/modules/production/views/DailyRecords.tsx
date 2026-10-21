import { Fragment, useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { DetailsModal, ViewButton } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';

interface LotLine {
  batchNumber: string;
  quantity: number;
}

interface MaterialLine {
  materialId: string;
  name: string;
  sku?: string;
  unit: string;
  quantity: number;
  value?: number;
  lots: LotLine[];
}

interface StageLine {
  id: string;
  stage: 'GRINDING' | 'FINISHING';
  planNumber: string;
  product: string;
  expected: number;
  achieved: number;
  unit: string;
  value: number;
}

interface DailyDay {
  date: string;
  complete: boolean;
  achieved: {
    outputQty: number;
    outputValue: number;
    grindingQty: number;
    lines: StageLine[];
    materials: MaterialLine[];
    ingredients: MaterialLine[];
  };
  wip: {
    quantity: number;
    value: number;
    lines: Array<MaterialLine & { arm: 'INGREDIENTS' | 'GRINDING' | 'PRODUCTION'; materialId: string | null }>;
  };
}

const qty = (value: number) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });

const money = (value: number) =>
  `₦${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dayLabel = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

/**
 * "Turmeric 200 kg (20 kg × 10 receipts)" — breaks a total back into the
 * receipts/lots it came from.
 */
const breakdown = (lots: LotLine[], unit: string) => {
  if (!lots || lots.length === 0) return '';
  const quantities = lots.map((l) => Number(l.quantity));
  const allSame = quantities.every((q) => Math.abs(q - quantities[0]) < 1e-9);
  if (lots.length > 1 && allSame) return `${qty(quantities[0])} ${unit} × ${lots.length}`;
  return lots.map((l) => `${qty(l.quantity)} ${unit}`).join(' · ');
};

const breakdownLabel = (lots: LotLine[]) => {
  const numbers = lots.map((l) => l.batchNumber).filter((b) => b && b !== '—');
  return [...new Set(numbers)].join(' · ');
};

const ARM_LABEL: Record<string, string> = {
  INGREDIENTS: 'Ingredients',
  GRINDING: 'Grinding',
  PRODUCTION: 'Production',
};

export default function DailyRecords({ searchQuery = '' }: { searchQuery?: string }) {
  const [days, setDays] = useState<DailyDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [viewing, setViewing] = useState<{ day: DailyDay; arm: 'achieved' | 'wip' } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ days: DailyDay[] }>('/production-line/daily-records');
      setDays(res.data.days ?? []);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load daily production records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const q = searchQuery.trim().toLowerCase();
  const filtered = !q
    ? days
    : days.filter(
        (day) =>
          dayLabel(day.date).toLowerCase().includes(q) ||
          day.date.includes(q) ||
          day.achieved.lines.some(
            (l) =>
              l.product.toLowerCase().includes(q) || l.planNumber.toLowerCase().includes(q)
          ) ||
          [...day.achieved.materials, ...day.achieved.ingredients, ...day.wip.lines].some((m) =>
            `${m.name} ${m.sku ?? ''}`.toLowerCase().includes(q)
          )
      );

  return (
    <div className="w-full mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Daily Production Records</h2>
          <PageDescription>
            What each arm achieved per production day, and any remainder carried forward as WIP.
          </PageDescription>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={4} rows={6} hasAvatar={false} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No production recorded yet."
            hint="Days appear here once the grinding and production stations record output."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Production Date</th>
                  <th className="px-4 py-3 font-semibold">Achieved</th>
                  <th className="px-4 py-3 font-semibold">WIP / Carryover</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((day) => {
                  const open = !!expanded[day.date];
                  const achievedSummary = `${qty(day.achieved.outputQty)} output · ${money(day.achieved.outputValue)}`;

                  if (day.complete) {
                    return (
                      <tr key={day.date} className="border-b border-slate-50 bg-emerald-50/60 hover:bg-emerald-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                              <CalendarDays className="w-4 h-4 text-emerald-600" />
                            </span>
                            <span className="text-xs font-bold text-[#171717]">{dayLabel(day.date)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-600">{achievedSummary}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-semibold text-emerald-700">None — day complete</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ViewButton onClick={() => setViewing({ day, arm: 'achieved' })} />
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <Fragment key={day.date}>
                      <tr
                        className="border-b border-slate-100 hover:bg-slate-50/70 cursor-pointer"
                        onClick={() => setExpanded((prev) => ({ ...prev, [day.date]: !prev[day.date] }))}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {open ? (
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span className="w-7 h-7 rounded-lg bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                              <CalendarDays className="w-4 h-4 text-[#EA4335]" />
                            </span>
                            <span className="text-xs font-bold text-[#171717]">{dayLabel(day.date)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-600">{achievedSummary}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-semibold text-amber-600">
                            {day.wip.lines.length} line(s) · {money(day.wip.value)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[9px] text-slate-400">Expand</td>
                      </tr>

                      {open && (
                        <>
                          <tr className="bg-slate-50/60 border-b border-slate-100">
                            <td className="px-4 py-2.5 pl-12">
                              <span className="text-[11px] font-semibold text-slate-600">Achieved</span>
                            </td>
                            <td className="px-4 py-2.5 text-[10px] text-slate-500">
                              {achievedSummary} · {day.achieved.lines.length} record(s)
                            </td>
                            <td />
                            <td className="px-4 py-2.5 text-right">
                              <ViewButton
                                label="View achieved"
                                onClick={() => setViewing({ day, arm: 'achieved' })}
                              />
                            </td>
                          </tr>
                          <tr className="bg-amber-50/40 border-b border-slate-100">
                            <td className="px-4 py-2.5 pl-12">
                              <span className="text-[11px] font-semibold text-amber-700">WIP</span>
                            </td>
                            <td />
                            <td className="px-4 py-2.5 text-[10px] text-amber-700">
                              {day.wip.lines.length} line(s) · {money(day.wip.value)} carried forward
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <ViewButton label="View WIP" onClick={() => setViewing({ day, arm: 'wip' })} />
                            </td>
                          </tr>
                        </>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing && (
        <DetailsModal
          title={dayLabel(viewing.day.date)}
          subtitle={
            viewing.arm === 'achieved'
              ? 'Achieved — what each arm completed'
              : 'WIP — remainder carried to the next day'
          }
          status={
            viewing.day.complete
              ? { label: 'Complete', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
              : { label: 'WIP open', className: 'bg-amber-50 text-amber-700 border-amber-200' }
          }
          onClose={() => setViewing(null)}
          footer={
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="h-8 px-4 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          }
          sections={
            viewing.arm === 'achieved'
              ? [
                  {
                    title: 'Production',
                    fields: [
                      { label: 'Output quantity', value: qty(viewing.day.achieved.outputQty) },
                      { label: 'Output value', value: money(viewing.day.achieved.outputValue) },
                      { label: 'Ground quantity', value: qty(viewing.day.achieved.grindingQty) },
                      { label: 'Records', value: `${viewing.day.achieved.lines.length}` },
                    ],
                  },
                  {
                    title: 'Ingredients issued',
                    fields: [
                      {
                        label: 'Materials',
                        wide: true,
                        value:
                          viewing.day.achieved.ingredients.length === 0 ? (
                            '—'
                          ) : (
                            <div className="space-y-1">
                              {viewing.day.achieved.ingredients.map((line) => (
                                <div
                                  key={line.materialId}
                                  className="flex items-start justify-between gap-3 border-b border-slate-50 pb-1 last:border-0"
                                >
                                  <span className="min-w-0">
                                    <span className="font-semibold">{line.name}</span>
                                    <span className="text-slate-500">
                                      {' '}
                                      {qty(line.quantity)} {line.unit}
                                    </span>
                                    {line.lots.length > 1 && (
                                      <span className="text-slate-400"> ({breakdown(line.lots, line.unit)})</span>
                                    )}
                                  </span>
                                  <span className="shrink-0 font-mono text-slate-500">
                                    {money(Number(line.value ?? 0))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ),
                      },
                    ],
                  },
                  {
                    title: 'Grinding inputs',
                    fields: [
                      {
                        label: 'Materials ground',
                        wide: true,
                        value:
                          viewing.day.achieved.materials.length === 0 ? (
                            '—'
                          ) : (
                            <div className="space-y-1">
                              {viewing.day.achieved.materials.map((line) => (
                                <div key={line.materialId} className="border-b border-slate-50 pb-1 last:border-0">
                                  <span className="font-semibold">{line.name}</span>{' '}
                                  <span className="text-slate-500">
                                    {qty(line.quantity)} {line.unit}
                                  </span>
                                  {line.lots.length > 1 && (
                                    <span className="text-slate-400"> ({breakdown(line.lots, line.unit)})</span>
                                  )}
                                  {breakdownLabel(line.lots) && (
                                    <p className="text-[9px] text-slate-400 font-mono">
                                      {breakdownLabel(line.lots)}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ),
                      },
                    ],
                  },
                  {
                    title: 'Stage records',
                    fields: [
                      {
                        label: 'Expected vs achieved',
                        wide: true,
                        value:
                          viewing.day.achieved.lines.length === 0 ? (
                            '—'
                          ) : (
                            <div className="space-y-1">
                              {viewing.day.achieved.lines.map((line) => (
                                <div
                                  key={line.id}
                                  className="flex items-center justify-between gap-2 border-b border-slate-50 pb-1 last:border-0"
                                >
                                  <span className="min-w-0 truncate">
                                    <span className="text-[9px] font-bold uppercase text-slate-400">
                                      {line.stage}
                                    </span>{' '}
                                    {line.product}
                                  </span>
                                  <span className="shrink-0 text-slate-500">
                                    {qty(line.achieved)} / {qty(line.expected)} {line.unit}
                                    {line.value > 0 && <span className="text-slate-400"> · {money(line.value)}</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ),
                      },
                    ],
                  },
                ]
              : [
                  {
                    title: 'Carried forward',
                    fields: [
                      { label: 'Total quantity', value: qty(viewing.day.wip.quantity) },
                      { label: 'Estimated value', value: money(viewing.day.wip.value) },
                    ],
                  },
                  {
                    title: 'WIP by arm',
                    fields: [
                      {
                        label: 'Remainder lines',
                        wide: true,
                        value:
                          viewing.day.wip.lines.length === 0 ? (
                            <span className="text-emerald-600">Nothing outstanding.</span>
                          ) : (
                            <div className="space-y-1">
                              {viewing.day.wip.lines.map((line, index) => (
                                <div
                                  key={`${line.arm}-${line.materialId ?? line.name}-${index}`}
                                  className="border-b border-slate-50 pb-1 last:border-0"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <span className="min-w-0">
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                        {ARM_LABEL[line.arm]}
                                      </span>{' '}
                                      <span className="font-semibold">{line.name}</span>{' '}
                                      <span className="text-slate-500">
                                        {qty(line.quantity)} {line.unit}
                                      </span>
                                      {line.lots.length > 1 && (
                                        <span className="text-slate-400"> ({breakdown(line.lots, line.unit)})</span>
                                      )}
                                    </span>
                                    <span className="shrink-0 font-mono text-slate-500">{money(Number(line.value ?? 0))}</span>
                                  </div>
                                  {breakdownLabel(line.lots) && (
                                    <p className="text-[9px] text-slate-400 font-mono">{breakdownLabel(line.lots)}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ),
                      },
                    ],
                  },
                ]
          }
        />
      )}
    </div>
  );
}
