import { ArrowRight, CheckCircle2, Clock3, Loader2, TriangleAlert } from 'lucide-react';
import { formatNumber } from '../../../lib/format';

export type StationCode = 'INGREDIENT' | 'GRINDING' | 'PRODUCTION';

export interface StationBalance {
  station: StationCode;
  label: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
  expectedQuantity: number | string;
  receivedQuantity: number | string;
  processedQuantity: number | string;
  transferredQuantity: number | string;
  outstandingQuantity: number | string;
  variance: number | string;
  unitOfMeasure: string;
}

const SHORT_LABEL: Record<StationCode, string> = {
  INGREDIENT: 'Ingredients',
  GRINDING: 'Grinding',
  PRODUCTION: 'Production',
};

const statusStyles: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
};

function statusLabel(status: string) {
  return status.replace('_', ' ').toLowerCase();
}

function metric(label: string, value: number | string, unit: string, tone?: string) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[9px] uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-[11px] font-semibold ${tone ?? 'text-slate-700'}`}>
        {formatNumber(value)} {unit}
      </span>
    </div>
  );
}

/**
 * Three-station expected vs actual strip. Reads the work orders returned with the
 * plan queue so every station page shows the same source of truth.
 */
export function StationFlowPanel({
  stations,
  activeStation,
}: {
  stations?: StationBalance[] | null;
  activeStation: StationCode;
}) {
  if (!stations || stations.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Three-station flow · expected vs actual
        </p>
        <p className="text-[9px] text-slate-400">
          Ingredient Station <ArrowRight className="inline h-2.5 w-2.5" /> Grinding Station{' '}
          <ArrowRight className="inline h-2.5 w-2.5" /> Production Station
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {stations.map((station) => {
          const active = station.station === activeStation;
          const variance = Number(station.variance ?? 0);
          const StatusIcon =
            station.status === 'COMPLETED'
              ? CheckCircle2
              : station.status === 'IN_PROGRESS'
                ? Loader2
                : Clock3;
          return (
            <div
              key={station.station}
              className={`rounded-lg border bg-white p-3 ${
                active ? 'border-[#00B4D8] ring-1 ring-[#00B4D8]/30' : 'border-slate-200'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-slate-800">
                  {SHORT_LABEL[station.station] ?? station.label}
                  {active && <span className="ml-1 text-[9px] font-semibold text-[#00B4D8]">you</span>}
                </p>
                <span
                  className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                    statusStyles[station.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <StatusIcon
                    className={`h-2.5 w-2.5 ${station.status === 'IN_PROGRESS' ? 'animate-spin' : ''}`}
                  />
                  {statusLabel(station.status)}
                </span>
              </div>
              <div className="space-y-1">
                {metric('Expected', station.expectedQuantity, station.unitOfMeasure)}
                {metric('Received', station.receivedQuantity, station.unitOfMeasure)}
                {metric('Processed', station.processedQuantity, station.unitOfMeasure, 'text-[#00B4D8]')}
                {metric('Transferred', station.transferredQuantity, station.unitOfMeasure)}
                {metric(
                  'Outstanding',
                  station.outstandingQuantity,
                  station.unitOfMeasure,
                  Number(station.outstandingQuantity) > 0 ? 'text-amber-600' : 'text-emerald-600'
                )}
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1">
                  <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-400">
                    {variance < 0 && <TriangleAlert className="h-2.5 w-2.5 text-amber-500" />}
                    Variance
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      variance < 0 ? 'text-amber-600' : variance > 0 ? 'text-blue-600' : 'text-emerald-600'
                    }`}
                  >
                    {variance > 0 ? '+' : ''}
                    {formatNumber(variance)} {station.unitOfMeasure}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StationFlowPanel;
