import { useEffect, useState } from 'react';
import { ClipboardList, Factory, Eye } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  targetQuantity: number;
  status: string;
  scheduledStart?: string | null;
  createdAt: string;
  bomVersion?: {
    bom?: { productName: string };
    finishedSku?: { name: string; sku: string } | null;
  } | null;
  machine?: { name: string; code: string } | null;
  shift?: { name: string } | null;
  createdBy?: { fullName?: string } | null;
  productionIngredients?: Array<{
    id: string;
    materialId: string;
    projectedQuantity: number;
    releasedQuantity: number;
    material: { name: string; sku: string; unitOfMeasure: string };
  }>;
}

interface Warehouse { id: string; name: string; code: string }

export default function DailyProduction({ searchQuery = '' }: { searchQuery?: string }) {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Release action state
  const [actingOrder, setActingOrder] = useState<ProductionOrder | null>(null);
  const [actionForm, setActionForm] = useState({ warehouseId: '' });
  const [releaseForm, setReleaseForm] = useState<Array<{ id: string; materialId: string; name: string; sku: string; projectedQuantity: number; releasedQuantity: number; batchLotId: string; batchNumber: string; unit: string }>>([]);
  const [ingredientBatches, setIngredientBatches] = useState<Record<string, Array<{ id: string; batchNumber: string; quantity: number; warehouseName: string; expiryDate?: string }>>>({});
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [pickingIngredientIdx, setPickingIngredientIdx] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [orderRes, whRes] = await Promise.all([
        axiosClient.get<{ productionOrders: ProductionOrder[] }>('/production/production-orders'),
        axiosClient.get<{ warehouses: Warehouse[] }>('/master-data/warehouses'),
      ]);
      // Only show SCHEDULED orders for the Store Officer to release
      setOrders(orderRes.data.productionOrders.filter(o => o.status === 'SCHEDULED'));
      setWarehouses(whRes.data.warehouses);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load production orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openRelease = async (order: ProductionOrder) => {
    setActingOrder(order);
    setError('');
    setActionForm({ warehouseId: '' });
    
    const releaseList = (order.productionIngredients ?? []).map(ing => ({
      id: ing.id,
      materialId: ing.materialId,
      name: ing.material.name,
      sku: ing.material.sku,
      projectedQuantity: Number(ing.projectedQuantity),
      releasedQuantity: Number(ing.projectedQuantity),
      batchLotId: '',
      batchNumber: '',
      unit: ing.material.unitOfMeasure
    }));
    setReleaseForm(releaseList);

    setLoadingBatches(true);
    try {
      const batchesData: Record<string, any[]> = {};
      await Promise.all(
        (order.productionIngredients ?? []).map(async (ing) => {
          const res = await axiosClient.get<{ stock: any[] }>(`/inventory/stock?materialId=${ing.materialId}`);
          batchesData[ing.materialId] = res.data.stock.map(s => ({
            id: s.batchLotId,
            batchNumber: s.batchNumber || 'No Batch',
            quantity: s.quantity,
            warehouseName: s.warehouseName,
            expiryDate: s.expiryDate,
          })).filter(b => b.id);
        })
      );
      setIngredientBatches(batchesData);
    } catch (err) {
      console.error('Failed to load ingredient stock batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const submitRelease = async () => {
    if (!actingOrder) return;
    if (!actionForm.warehouseId) {
      setError('Select the warehouse to issue raw materials from');
      return;
    }
    
    // Validate that all ingredients have a batch selected
    const missingBatch = releaseForm.find(r => !r.batchLotId);
    if (missingBatch) {
      setError(`Please select a batch for ${missingBatch.name}`);
      return;
    }

    setSaving(true);
    try {
      await axiosClient.post(`/production/production-orders/${actingOrder.id}/release`, {
        warehouseId: actionForm.warehouseId,
        ingredients: releaseForm.map(r => ({
          id: r.id,
          releasedQuantity: Number(r.releasedQuantity),
          batchLotId: r.batchLotId
        }))
      });
      setActingOrder(null);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Release failed');
    } finally {
      setSaving(false);
    }
  };

  const filtered = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.bomVersion?.finishedSku?.name ?? o.bomVersion?.bom?.productName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Daily Production Release</h2>
          <p className="text-[#737373] text-xs">Review scheduled production plans and release raw materials from inventory.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>
      )}

      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={7} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No production plans pending release." hint="New plans will appear here once scheduled by production managers." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">Machine / Shift</th>
                  <th className="px-4 py-3 font-semibold">Scheduled</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                          <ClipboardList className="w-3.5 h-3.5 text-[#EA4335]" />
                        </div>
                        <div>
                          <p className="text-[11px] font-mono font-bold text-[#171717]">{o.orderNumber}</p>
                          <p className="text-[9px] text-slate-400">by {o.createdBy?.fullName ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-slate-700">{o.bomVersion?.finishedSku?.name ?? o.bomVersion?.bom?.productName ?? '—'}</p>
                      <p className="text-[9px] text-slate-400">{o.bomVersion?.finishedSku?.sku ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{Number(o.targetQuantity).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <p className="text-[11px] text-slate-600 flex items-center gap-1">
                        <Factory className="w-3 h-3 text-slate-400" /> {o.machine?.name ?? '—'}
                      </p>
                      <p className="text-[9px] text-slate-400">{o.shift?.name ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      {o.scheduledStart ? new Date(o.scheduledStart).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200">{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openRelease(o)} className="btn-3d px-3 h-7 bg-indigo-600 border-indigo-700 hover:bg-indigo-50">
                        <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {actingOrder && (
        <Modal onClose={() => setActingOrder(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#171717]">Production Plan Details</h3>
              <button onClick={() => setActingOrder(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-[11px] text-slate-500">
              <span className="font-mono font-bold text-slate-700">{actingOrder.orderNumber}</span> —{' '}
              {actingOrder.bomVersion?.finishedSku?.name ?? actingOrder.bomVersion?.bom?.productName ?? ''}
            </p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Issue raw materials from warehouse *</label>
                <select value={actionForm.warehouseId} onChange={(e) => setActionForm({ ...actionForm, warehouseId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                  <option value="">Select warehouse…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Pick List (BOM Ingredients)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30 text-[9px] uppercase tracking-wider text-slate-400">
                        <th className="px-3 py-2 font-semibold">Ingredient</th>
                        <th className="px-3 py-2 font-semibold text-right">Required</th>
                        <th className="px-3 py-2 font-semibold">Selected Batch</th>
                        <th className="px-3 py-2 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {releaseForm.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/30">
                          <td className="px-3 py-2.5">
                            <p className="font-bold text-slate-700 leading-tight">{item.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono">{item.sku}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                            {item.projectedQuantity.toFixed(2)} {item.unit}
                          </td>
                          <td className="px-3 py-2.5">
                            {item.batchLotId ? (
                              <div className="flex flex-col">
                                <span className="font-mono font-bold text-indigo-600">{item.batchNumber}</span>
                                <span className="text-[9px] text-slate-400">Qty: {item.releasedQuantity} {item.unit}</span>
                              </div>
                            ) : (
                              <span className="text-rose-400 italic">Not picked</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              onClick={() => setPickingIngredientIdx(idx)}
                              className={`h-7 px-3 rounded-lg border text-[10px] font-bold transition-all ${
                                item.batchLotId 
                                  ? 'border-slate-200 text-slate-600 hover:bg-slate-50' 
                                  : 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                              }`}
                            >
                              {item.batchLotId ? 'Change Batch' : 'Pick Batch'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setActingOrder(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={submitRelease} disabled={saving} className="btn-3d px-4 h-9">
                <span className="text-white text-xs font-semibold">
                  {saving ? 'Releasing…' : 'Release Ingredients'}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. Inventory Picker Sub-modal */}
      {pickingIngredientIdx !== null && (
        <Modal onClose={() => setPickingIngredientIdx(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#171717]">Pick from Inventory</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {releaseForm[pickingIngredientIdx].name} ({releaseForm[pickingIngredientIdx].sku})
                </p>
              </div>
              <button onClick={() => setPickingIngredientIdx(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Quantity Needed:</span>
              <span className="font-mono font-bold text-slate-700">
                {releaseForm[pickingIngredientIdx].projectedQuantity.toFixed(2)} {releaseForm[pickingIngredientIdx].unit}
              </span>
            </div>

            <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
              <div className="bg-slate-50/50 border-b border-slate-100 px-3 py-2 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Available Stock Batches</span>
                <span className="text-[9px] font-semibold text-slate-400">
                  {(ingredientBatches[releaseForm[pickingIngredientIdx].materialId] ?? []).length} batches found
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/30 text-[9px] uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2 font-semibold">Batch Number</th>
                      <th className="px-3 py-2 font-semibold">Warehouse</th>
                      <th className="px-3 py-2 font-semibold text-right">Available</th>
                      <th className="px-3 py-2 font-semibold">Expiry</th>
                      <th className="px-3 py-2 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingBatches ? (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400 italic">Loading inventory…</td></tr>
                    ) : (ingredientBatches[releaseForm[pickingIngredientIdx].materialId] ?? []).length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-rose-400 italic">No stock found for this material. Receive goods first.</td></tr>
                    ) : (ingredientBatches[releaseForm[pickingIngredientIdx].materialId] ?? []).map((batch) => (
                      <tr key={batch.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-700">{batch.batchNumber}</td>
                        <td className="px-3 py-2.5 text-slate-500">{batch.warehouseName}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">{Number(batch.quantity).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-slate-400">
                          {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => {
                              const updated = [...releaseForm];
                              updated[pickingIngredientIdx].batchLotId = batch.id;
                              updated[pickingIngredientIdx].batchNumber = batch.batchNumber;
                              // Default to projected quantity, or what's left in the batch
                              updated[pickingIngredientIdx].releasedQuantity = Math.min(
                                updated[pickingIngredientIdx].projectedQuantity,
                                Number(batch.quantity)
                              );
                              setReleaseForm(updated);
                              setPickingIngredientIdx(null);
                            }}
                            className="h-7 px-3 rounded-lg bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-500 transition-colors"
                          >
                            Pick
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setPickingIngredientIdx(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
