import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailDate, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { formatNumber, formatQty } from '../../../lib/format';
import { Pagination } from '../../../components/ui/Pagination';
import { usePagination } from '../../../hooks/usePagination';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  targetQuantity: number;
  status: string;
  scheduledStart?: string | null;
  createdAt: string;
  planLinked?: boolean;
  planNumber?: string | null;
  bom?: {
    productName: string;
    finishedSku?: { name: string; sku: string } | null;
  } | null;
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
  const [releaseConfirmation, setReleaseConfirmation] = useState(false);

  // Release action state
  const [actingOrder, setActingOrder] = useState<ProductionOrder | null>(null);
  const [actionForm, setActionForm] = useState({ warehouseId: '' });
  const [releaseForm, setReleaseForm] = useState<Array<{ id: string; materialId: string; name: string; sku: string; projectedQuantity: number; releasedQuantity: number; batchLotId: string; batchNumber: string; unit: string }>>([]);
  const [ingredientBatches, setIngredientBatches] = useState<Record<string, Array<{ id: string; batchNumber: string; quantity: number; warehouseName: string; expiryDate?: string }>>>({});
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [pickingIngredientIdx, setPickingIngredientIdx] = useState<number | null>(null);

  // view details modal
  const [viewing, setViewing] = useState<ProductionOrder | null>(null);

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

    setReleaseConfirmation(true);
  };

  const confirmRelease = async () => {
    if (!actingOrder) return;
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
      setReleaseConfirmation(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Release failed');
      setSaving(false);
    }
  };

  const filtered = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.bom?.finishedSku?.name ?? o.bom?.productName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { page, totalPages, total, pageItems, setPage } = usePagination(filtered);

  return (
    <div className="w-full mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Daily Production Release</h2>
          <PageDescription>Review scheduled production plans and release raw materials from inventory.</PageDescription>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>
      )}

      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={7} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No production plans pending release." hint="New plans will appear here once scheduled by production managers." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">Scheduled</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((o) => {
                  const productName = o.bom?.finishedSku?.name ?? o.bom?.productName ?? '—';
                  return (
                  <tr key={o.id} className="border-b border-line hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                          <ClipboardList className="w-3.5 h-3.5 text-[#EA4335]" />
                        </div>
                        <div>
                          <p className="text-[11px] font-mono font-bold text-ink">{o.orderNumber}</p>
                          <p className="text-[9px] text-ink-faint">by {o.createdBy?.fullName ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-ink-2 truncate max-w-[180px]" title={productName}>{productName}</p>
                      <p className="text-[9px] text-ink-faint">{o.bom?.finishedSku?.sku ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-ink-muted">{formatNumber(o.targetQuantity, 2)}</td>
                    <td className="px-4 py-3 text-[11px] text-ink-muted">
                      {o.scheduledStart ? new Date(o.scheduledStart).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-600 text-white">{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <ViewButton onClick={() => setViewing(o)} />
                        {o.planLinked ? (
                          <span
                            className="rounded-md bg-slate-600 px-2.5 py-1 text-[10px] font-semibold text-white"
                            title={`Ingredients for plan ${o.planNumber ?? ''} are issued at the Ingredients Station`}
                          >
                            Issue via Ingredients Station
                          </span>
                        ) : (
                          <button
                            onClick={() => openRelease(o)}
                            className="rounded-md bg-sky-600 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-sky-700"
                          >
                            View Details
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
          </div>
        )}
      </div>

      {actingOrder && (
        <Modal onClose={() => setActingOrder(null)}>
          <div className="bg-surface rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">Production Plan Details</h3>
              <button onClick={() => setActingOrder(null)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            <p className="text-[11px] text-ink-muted">
              <span className="font-mono font-bold text-ink-2">{actingOrder.orderNumber}</span> —{' '}
              {actingOrder.bom?.finishedSku?.name ?? actingOrder.bom?.productName ?? ''}
            </p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Issue raw materials from warehouse *</label>
                <select value={actionForm.warehouseId} onChange={(e) => setActionForm({ ...actionForm, warehouseId: e.target.value })} className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                  <option value="">Select warehouse…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div className="bg-surface border border-line rounded-lg overflow-hidden">
                <div className="bg-surface-2 border-b border-line px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-ink-muted">
                  Pick List (BOM Ingredients)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-surface-2/30 text-[9px] uppercase tracking-wider text-ink-faint">
                        <th className="px-3 py-2 font-semibold">Ingredient</th>
                        <th className="px-3 py-2 font-semibold text-right">Required</th>
                        <th className="px-3 py-2 font-semibold">Selected Batch</th>
                        <th className="px-3 py-2 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {releaseForm.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-surface-2/30">
                          <td className="px-3 py-2.5">
                            <p className="font-bold text-ink-2 leading-tight">{item.name}</p>
                            <p className="text-[9px] text-ink-faint font-mono">{item.sku}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-ink-muted">
                            {formatQty(item.projectedQuantity, item.unit, 2)}
                          </td>
                          <td className="px-3 py-2.5">
                            {item.batchLotId ? (
                              <div className="flex flex-col">
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300">{item.batchNumber}</span>
                                <span className="text-[9px] text-ink-faint">Qty: {formatQty(item.releasedQuantity, item.unit)}</span>
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
                                  ? 'border-line text-ink-muted hover:bg-surface-2' 
                                  : 'bg-indigo-600 text-white'
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

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button onClick={() => setActingOrder(null)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">Cancel</button>
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
          <div className="bg-surface rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Pick from Inventory</h3>
                <p className="text-[10px] text-ink-faint mt-0.5">
                  {releaseForm[pickingIngredientIdx].name} ({releaseForm[pickingIngredientIdx].sku})
                </p>
              </div>
              <button onClick={() => setPickingIngredientIdx(null)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            <div className="bg-surface-2 border border-line rounded-lg p-3 flex items-center justify-between text-xs">
              <span className="text-ink-muted font-medium">Quantity Needed:</span>
              <span className="font-mono font-bold text-ink-2">
                {formatQty(releaseForm[pickingIngredientIdx].projectedQuantity, releaseForm[pickingIngredientIdx].unit, 2)}
              </span>
            </div>

            <div className="bg-surface border border-line rounded-lg overflow-hidden">
              <div className="bg-surface-2/50 border-b border-line px-3 py-2 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">Available Stock Batches</span>
                <span className="text-[9px] font-semibold text-ink-faint">
                  {formatNumber((ingredientBatches[releaseForm[pickingIngredientIdx].materialId] ?? []).length)} batches found
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-surface-2/30 text-[9px] uppercase tracking-wider text-ink-faint">
                      <th className="px-3 py-2 font-semibold">Batch Number</th>
                      <th className="px-3 py-2 font-semibold">Warehouse</th>
                      <th className="px-3 py-2 font-semibold text-right">Available</th>
                      <th className="px-3 py-2 font-semibold">Expiry</th>
                      <th className="px-3 py-2 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {loadingBatches ? (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-ink-faint italic">Loading inventory…</td></tr>
                    ) : (ingredientBatches[releaseForm[pickingIngredientIdx].materialId] ?? []).length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-rose-400 italic">No stock found for this material. Receive goods first.</td></tr>
                    ) : (ingredientBatches[releaseForm[pickingIngredientIdx].materialId] ?? []).map((batch) => (
                      <tr key={batch.id} className="hover:bg-surface-2/50">
                        <td className="px-3 py-2.5 font-mono font-bold text-ink-2">{batch.batchNumber}</td>
                        <td className="px-3 py-2.5 text-ink-muted">{batch.warehouseName}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-300">{formatNumber(batch.quantity, 2)}</td>
                        <td className="px-3 py-2.5 text-ink-faint">
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
              <button onClick={() => setPickingIngredientIdx(null)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {releaseConfirmation && (
        <ConfirmationModal
          type="submit"
          title="Release Ingredients"
          description="Release raw materials from the selected warehouse and move production order to PROCESSING status?"
          onConfirm={confirmRelease}
          onCancel={() => setReleaseConfirmation(false)}
          isLoading={saving}
          confirmText="Release Ingredients"
        />
      )}

      {/* Production order details */}
      {viewing && (
        <DetailsModal
          title={viewing.orderNumber}
          subtitle={viewing.bom?.finishedSku?.name ?? viewing.bom?.productName ?? '—'}
          status={{ label: viewing.status, className: 'bg-slate-600 text-white' }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Overview',
              fields: [
                { label: 'Order Number', value: detailValue(viewing.orderNumber) },
                { label: 'Product', value: detailValue(viewing.bom?.finishedSku?.name ?? viewing.bom?.productName) },
                { label: 'SKU', value: detailValue(viewing.bom?.finishedSku?.sku) },
                { label: 'Target Quantity', value: formatNumber(viewing.targetQuantity, 2) },
              ],
            },
            {
              title: 'Schedule',
              fields: [
                { label: 'Scheduled Start', value: detailDate(viewing.scheduledStart) },
                { label: 'Created By', value: detailValue(viewing.createdBy?.fullName) },
                { label: 'Created At', value: detailDate(viewing.createdAt, true) },
                { label: 'Status', value: detailValue(viewing.status) },
              ],
            },
            {
              title: 'Plan',
              fields: [
                { label: 'Plan Number', value: detailValue(viewing.planNumber) },
                { label: 'Plan Linked', value: viewing.planLinked ? 'Yes — issue via Ingredients Station' : 'No' },
              ],
            },
            {
              title: 'Ingredients',
              fields: [
                {
                  label: 'BOM Ingredients',
                  wide: true,
                  value:
                    (viewing.productionIngredients ?? []).length === 0 ? (
                      '—'
                    ) : (
                      <div className="space-y-1">
                        {(viewing.productionIngredients ?? []).map((ing) => (
                          <div key={ing.id} className="flex items-start justify-between gap-3 border-b border-line pb-1 last:border-0">
                            <span className="min-w-0 truncate">
                              {ing.material.name}{' '}
                              <span className="font-mono text-[9px] text-ink-faint">{ing.material.sku}</span>
                            </span>
                            <span className="shrink-0 font-mono text-ink-muted">
                              {formatQty(ing.projectedQuantity, ing.material.unitOfMeasure, 2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ),
                },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
