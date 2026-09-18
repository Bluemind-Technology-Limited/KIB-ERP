import { useMemo, useState } from 'react';
import { AlertCircle, Loader, Save } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Modal } from '../../../components/ui/Modal';

interface PlanItemShape {
  id: string;
  targetQuantity: number | string;
  /** Recorded output from the finishing stage — what the server reconciles against. */
  achievedQuantity?: number | string | null;
  actualYield?: number | string | null;
  bom?: { finishedSku?: { name?: string } | null; productName?: string; yieldUnit?: string } | null;
}

/** Recorded output, preferring the finishing-stage figure the server uses. */
function outputOf(item: PlanItemShape): number {
  if (item.achievedQuantity !== null && item.achievedQuantity !== undefined) {
    return Number(item.achievedQuantity);
  }
  return Number(item.actualYield ?? 0);
}

/**
 * Daily production reconciliation (SOP: planned vs achieved).
 *
 * The figures are NOT typed in here — the server recomputes them from the
 * recorded production, so this form only picks the plan and the date. Anything
 * editable here would be ignored, so there is nothing editable.
 */
export default function DailyReconciliationForm({
  planId,
  plan,
  onClose = () => {},
  onCreated,
}: {
  planId: string;
  plan?: { planNumber?: string; items?: PlanItemShape[] } | null;
  onClose?: () => void;
  onCreated?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const items: PlanItemShape[] = plan?.items ?? [];

  const { planned, achieved, variance, variancePercent } = useMemo(() => {
    const plannedTotal = items.reduce((sum, i) => sum + Number(i.targetQuantity ?? 0), 0);
    const achievedTotal = items.reduce((sum, i) => sum + outputOf(i), 0);
    const diff = achievedTotal - plannedTotal;
    return {
      planned: plannedTotal,
      achieved: achievedTotal,
      variance: diff,
      variancePercent: plannedTotal > 0 ? (diff / plannedTotal) * 100 : 0,
    };
  }, [items]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await axiosClient.post(
        '/supervisor/daily-reconciliations',
        { productionPlanId: planId, reconciliationDate: new Date(date).toISOString() },
        { toast: { success: 'Daily reconciliation created' } }
      );
      setError('');
      onCreated?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create the reconciliation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#171717]">Daily Production Reconciliation</h2>
          <p className="text-xs text-[#737373] mt-1">
            {plan?.planNumber || 'Production plan'} · planned against recorded output
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Reconciliation date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Product</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Planned</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Output</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Variance</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    This plan has no items.
                  </td>
                </tr>
              )}
              {items.map((item) => {
                const unit = item.bom?.yieldUnit ?? '';
                const target = Number(item.targetQuantity ?? 0);
                const hasOutput = item.achievedQuantity !== null && item.achievedQuantity !== undefined;
                const output = outputOf(item);
                const diff = output - target;
                return (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-3 px-3 text-slate-700">
                      {item.bom?.finishedSku?.name ?? item.bom?.productName ?? 'Unknown'}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {target.toFixed(2)} {unit}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {hasOutput ? `${output.toFixed(2)} ${unit}` : '—'}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-semibold ${
                        diff < 0 ? 'text-rose-600' : diff > 0 ? 'text-amber-600' : 'text-green-600'
                      }`}
                    >
                      {diff > 0 ? '+' : ''}
                      {diff.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="py-3 px-3 font-bold text-slate-700">Total</td>
                <td className="py-3 px-3 text-right font-bold text-slate-700">{planned.toFixed(2)}</td>
                <td className="py-3 px-3 text-right font-bold text-slate-700">{achieved.toFixed(2)}</td>
                <td
                  className={`py-3 px-3 text-right font-bold ${
                    variance < 0 ? 'text-rose-600' : variance > 0 ? 'text-amber-600' : 'text-green-600'
                  }`}
                >
                  {variance > 0 ? '+' : ''}
                  {variance.toFixed(2)} ({variancePercent > 0 ? '+' : ''}
                  {variancePercent.toFixed(1)}%)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-slate-400">
          Figures come from the recorded production — they are recalculated on the server when you save,
          so what is stored is the authoritative variance.
        </p>

        <div className="flex gap-3 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || items.length === 0}
            className="btn-3d flex-1 px-4 h-10 disabled:opacity-50"
          >
            <span className="flex items-center justify-center gap-2 text-white text-xs font-semibold whitespace-nowrap">
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Create Reconciliation
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
