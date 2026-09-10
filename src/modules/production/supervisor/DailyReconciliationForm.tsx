import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Save, Loader } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Modal } from '../../../components/ui/Modal';

interface ReconciliationItem {
  productionOrderId: string;
  productName: string;
  plannedQuantity: number;
  actualQuantity: number;
  variance: number;
  unit: string;
}

export default function DailyReconciliationForm({ onClose = () => {} }: { onClose?: () => void }) {
  const { planId } = useParams<{ planId: string }>();
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [planDetails, setPlanDetails] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!planId) return;
      try {
        // Get plan details
        const planRes = await axiosClient.get(`/api/supervisor/production-plans/${planId}`);
        setPlanDetails(planRes.data.plan);

        // Get allocated batches to build reconciliation items
        const allocRes = await axiosClient.get(`/api/supervisor/batch-allocations`, {
          params: { planId },
        });

        const reconciliationItems: ReconciliationItem[] = allocRes.data.allocations.map((alloc: any) => ({
          productionOrderId: alloc.productionOrderId,
          productName: alloc.productionOrder?.bom?.finishedSku?.name || 'Unknown',
          plannedQuantity: alloc.productionOrder?.quantity || 0,
          actualQuantity: alloc.productionOrder?.quantity || 0,
          variance: 0,
          unit: alloc.productionOrder?.bom?.yieldUnit || 'kg',
        }));

        setItems(reconciliationItems);
        setError('');
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load reconciliation data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [planId]);

  const handleActualQuantityChange = (index: number, value: number) => {
    const newItems = [...items];
    newItems[index].actualQuantity = value;
    newItems[index].variance = value - newItems[index].plannedQuantity;
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!planId) return;

    setSaving(true);
    try {
      // Create reconciliation
      await axiosClient.post('/api/supervisor/daily-reconciliations', {
        productionPlanId: planId,
        reconciliationDate: new Date(),
      });

      setError('');
      onClose?.();
      // Show success message or reload
      alert('Reconciliation saved successfully');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save reconciliation');
    } finally {
      setSaving(false);
    }
  };

  const totalPlanned = items.reduce((sum, item) => sum + item.plannedQuantity, 0);
  const totalActual = items.reduce((sum, item) => sum + item.actualQuantity, 0);
  const totalVariance = totalActual - totalPlanned;
  const variancePercent = totalPlanned > 0 ? (totalVariance / totalPlanned) * 100 : 0;

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#171717]">Daily Production Reconciliation</h2>
          <p className="text-xs text-[#737373] mt-1">{planDetails?.planNumber || 'Production Plan'}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-semibold text-slate-600">Product</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Planned</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Actual</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const isNegative = item.variance < 0;
                    const isPositive = item.variance > 0;
                    return (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-3 text-slate-700">{item.productName}</td>
                        <td className="py-3 px-3 text-right text-slate-600">
                          {item.plannedQuantity.toFixed(2)} {item.unit}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            value={item.actualQuantity}
                            onChange={(e) => handleActualQuantityChange(idx, parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 text-right border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:border-[#AA3BFF]"
                          />
                          <span className="ml-1 text-slate-500">{item.unit}</span>
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-semibold ${
                            isNegative ? 'text-rose-600' : isPositive ? 'text-amber-600' : 'text-green-600'
                          }`}
                        >
                          {item.variance > 0 ? '+' : ''}{item.variance.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Totals Row */}
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="py-3 px-3 font-bold text-slate-700">Total</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-700">
                      {totalPlanned.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-700">
                      {totalActual.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-bold ${
                        totalVariance < 0 ? 'text-rose-600' : totalVariance > 0 ? 'text-amber-600' : 'text-green-600'
                      }`}
                    >
                      {totalVariance > 0 ? '+' : ''}{totalVariance.toFixed(2)} ({variancePercent > 0 ? '+' : ''}
                      {variancePercent.toFixed(1)}%)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Variance Alert */}
            {Math.abs(variancePercent) > 5 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-700">
                  <p className="font-semibold">Variance threshold exceeded</p>
                  <p>Variance of {Math.abs(variancePercent).toFixed(1)}% exceeds 5% threshold and will be flagged for review</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#AA3BFF] text-white font-semibold rounded-lg hover:bg-[#9a2ff5] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Reconciliation
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
