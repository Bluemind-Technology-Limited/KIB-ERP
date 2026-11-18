import { useEffect, useMemo, useState } from 'react';
import { PackageCheck, Truck } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailDate } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { formatNumber, formatQty } from '../../../lib/format';

interface StockLine {
  batchLotId: string;
  batchNumber: string;
  batchStatus: string;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  orderNumber: string | null;
  qtyIn: number;
  qtyOut: number;
  onHand: number;
}

interface StockDay {
  date: string;
  produced: number;
  qtyIn: number;
  qtyOut: number;
  net: number;
  closingBalance: number;
  lines: StockLine[];
}

interface ProductStock {
  materialId: string;
  materialName: string;
  sku: string;
  unitOfMeasure: string;
  producedTotal: number;
  currentStock: number;
  latestDate: string | null;
  batches: StockLine[];
  days: StockDay[];
}

interface Warehouse { id: string; name: string; code: string }

const batchStatusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  QUARANTINE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  REJECTED: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  EXPIRED: 'bg-surface-3 text-ink-muted border-line',
};

const dayLabel = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function FinishedGoods({ searchQuery = '' }: { searchQuery?: string }) {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // day detail modal
  const [viewing, setViewing] = useState<{ product: ProductStock; day: StockDay } | null>(null);
  // current stock (batch list) modal
  const [stockProduct, setStockProduct] = useState<ProductStock | null>(null);
  // dispatch modal
  const [dispatchTarget, setDispatchTarget] = useState<{ product: ProductStock; line: StockLine } | null>(null);
  const [dispatchForm, setDispatchForm] = useState({ toWarehouseId: '', quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [dispatchConfirmation, setDispatchConfirmation] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [fgRes, whRes] = await Promise.all([
        axiosClient.get<{ products: ProductStock[] }>('/inventory/finished-goods/daily'),
        axiosClient.get<{ warehouses: Warehouse[] }>('/master-data/warehouses'),
      ]);
      setProducts(fgRes.data.products);
      setWarehouses(whRes.data.warehouses);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load finished goods. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const query = searchQuery.trim().toLowerCase();

  const rows = useMemo(() => {
    const out: Array<{ product: ProductStock; day: StockDay; current: boolean }> = [];
    for (const product of products) {
      const productMatch =
        !query ||
        product.materialName.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query);
      product.days.forEach((day, i) => {
        const dayMatch =
          productMatch ||
          dayLabel(day.date).toLowerCase().includes(query) ||
          day.date.includes(query) ||
          day.lines.some(
            (l) =>
              l.batchNumber.toLowerCase().includes(query) ||
              (l.orderNumber ?? '').toLowerCase().includes(query) ||
              l.warehouseName.toLowerCase().includes(query)
          );
        if (dayMatch) out.push({ product, day, current: i === 0 });
      });
    }
    return out;
  }, [products, query]);

  const openDispatch = (product: ProductStock, line: StockLine) => {
    setStockProduct(null);
    setDispatchTarget({ product, line });
    setDispatchForm({ toWarehouseId: '', quantity: '', notes: '' });
    setError('');
  };

  const submitDispatch = () => {
    if (!dispatchTarget) return;
    if (!dispatchForm.toWarehouseId || !dispatchForm.quantity) {
      setError('Destination warehouse and quantity are required');
      return;
    }
    if (dispatchForm.toWarehouseId === dispatchTarget.line.warehouseId) {
      setError('Destination warehouse must differ from the source');
      return;
    }
    setDispatchConfirmation(true);
  };

  const confirmDispatch = async () => {
    if (!dispatchTarget) return;
    setSaving(true);
    try {
      await axiosClient.post('/inventory/stock/transfer', {
        materialId: dispatchTarget.product.materialId,
        batchLotId: dispatchTarget.line.batchLotId,
        quantity: Number(dispatchForm.quantity),
        unitOfMeasure: dispatchTarget.product.unitOfMeasure,
        fromWarehouseId: dispatchTarget.line.warehouseId,
        toWarehouseId: dispatchForm.toWarehouseId,
        notes: dispatchForm.notes || `Dispatch ${dispatchTarget.line.batchNumber}`,
      });
      setDispatchTarget(null);
      setDispatchConfirmation(false);
      setError('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Dispatch failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Finished Goods</h2>
          <PageDescription>Daily production output, movement and running balance per product.</PageDescription>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>
      )}

      {/* 2. Daily stock ledger */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={7} rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState title="No finished goods stock yet." hint="Complete and QA-release a batch first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Produced</th>
                  <th className="px-4 py-3 font-semibold">Out</th>
                  <th className="px-4 py-3 font-semibold">Closing Balance</th>
                  <th className="px-4 py-3 font-semibold">Current Stock</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product, day, current }, idx) => (
                  <tr
                    key={`${product.materialId}-${day.date}-${idx}`}
                    className={`border-b border-line hover:bg-surface-2/50 ${current ? 'bg-emerald-50/30' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0">
                          <PackageCheck className="w-3.5 h-3.5 text-[#EA4335]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-ink leading-none truncate max-w-[180px]" title={product.materialName}>
                            {product.materialName}
                          </p>
                          <p className="text-[9px] font-mono text-ink-faint mt-0.5 truncate max-w-[180px]" title={product.sku}>{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-ink-muted">{dayLabel(day.date)}</span>
                        {current && (
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                            Latest
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      {day.produced ? `+${formatNumber(day.produced)}` : <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono font-bold text-rose-600 dark:text-rose-300">
                      {day.qtyOut ? `-${formatNumber(day.qtyOut)}` : <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono font-bold text-ink-2">
                      {formatQty(day.closingBalance, product.unitOfMeasure)}
                    </td>
                    <td className="px-4 py-3">
                      {current ? (
                        <span className="text-xs font-mono font-bold text-ink">
                          {formatQty(product.currentStock, product.unitOfMeasure)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <ViewButton onClick={() => setViewing({ product, day })} />
                        {current && product.batches.length > 0 && (
                          <button onClick={() => setStockProduct(product)} className="btn-3d px-3 h-7">
                            <span className="flex items-center gap-1 text-white text-[10px] font-semibold">
                              <Truck className="w-3 h-3" /> Stock
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Day detail */}
      {viewing && (
        <DetailsModal
          title={viewing.product.materialName}
          subtitle={`${dayLabel(viewing.day.date)} · ${viewing.product.sku}`}
          status={{ label: 'Daily stock', className: 'bg-surface-3 text-ink-muted border-line' }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Day Summary',
              fields: [
                { label: 'Produced', value: formatQty(viewing.day.produced, viewing.product.unitOfMeasure) },
                { label: 'Out', value: formatQty(viewing.day.qtyOut, viewing.product.unitOfMeasure) },
                { label: 'Received In', value: formatQty(viewing.day.qtyIn, viewing.product.unitOfMeasure) },
                { label: 'Closing Balance', value: formatQty(viewing.day.closingBalance, viewing.product.unitOfMeasure) },
                { label: 'Current Stock', value: formatQty(viewing.product.currentStock, viewing.product.unitOfMeasure) },
                { label: 'Total Produced', value: formatQty(viewing.product.producedTotal, viewing.product.unitOfMeasure) },
              ],
            },
            {
              title: `Batches (${formatNumber(viewing.day.lines.length)})`,
              fields: viewing.day.lines.map((line) => ({
                label: `${line.batchNumber} · ${line.warehouseCode || line.warehouseName}`,
                wide: true,
                value: (
                  <span className="font-mono text-[10px]">
                    In {formatNumber(line.qtyIn)} · Out {formatNumber(line.qtyOut)} · On hand {formatNumber(line.onHand)}
                    {line.orderNumber ? ` · ${line.orderNumber}` : ''}
                    {line.expiryDate ? ` · Exp ${detailDate(line.expiryDate)}` : ''}
                  </span>
                ),
              })),
            },
          ]}
        />
      )}

      {/* 4. Current stock per batch */}
      {stockProduct && (
        <Modal onClose={() => setStockProduct(null)}>
          <div className="bg-surface rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-ink leading-none truncate">{stockProduct.materialName}</h3>
                <p className="text-[10px] text-ink-faint mt-1.5">
                  Current stock {formatQty(stockProduct.currentStock, stockProduct.unitOfMeasure)} · {formatNumber(stockProduct.batches.length)} batch
                  {stockProduct.batches.length === 1 ? '' : 'es'}
                </p>
              </div>
              <button onClick={() => setStockProduct(null)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            <div className="border border-line rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-[9px] uppercase tracking-wider text-ink-faint">
                    <th className="px-3 py-2 font-semibold">Batch</th>
                    <th className="px-3 py-2 font-semibold">Warehouse</th>
                    <th className="px-3 py-2 font-semibold">On Hand</th>
                    <th className="px-3 py-2 font-semibold">Expiry</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stockProduct.batches.map((line) => (
                    <tr key={`${line.batchLotId}-${line.warehouseId}`} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 text-[10px] font-mono font-bold text-ink-muted">{line.batchNumber}</td>
                      <td className="px-3 py-2 text-[10px] text-ink-muted">
                        {line.warehouseName} <span className="text-[9px] text-ink-faint">({line.warehouseCode})</span>
                      </td>
                      <td className="px-3 py-2 text-[11px] font-mono font-bold text-ink-2">
                        {formatQty(line.onHand, stockProduct.unitOfMeasure)}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-ink-muted">{detailDate(line.expiryDate)}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${batchStatusBadge[line.batchStatus] ?? batchStatusBadge.ACTIVE}`}>
                          {line.batchStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {line.batchStatus === 'ACTIVE' && line.onHand > 0 ? (
                          <button onClick={() => openDispatch(stockProduct, line)} className="btn-3d px-2.5 h-6">
                            <span className="flex items-center gap-1 text-white text-[9px] font-semibold">
                              <Truck className="w-2.5 h-2.5" /> Dispatch
                            </span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-ink-faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. Dispatch modal */}
      {dispatchTarget && (
        <Modal onClose={() => setDispatchTarget(null)}>
          <div className="bg-surface rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">Dispatch Finished Goods</h3>
              <button onClick={() => setDispatchTarget(null)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>

            <p className="text-[11px] text-ink-muted">
              <span className="font-mono font-bold text-ink-2">{dispatchTarget.line.batchNumber}</span> — {dispatchTarget.product.materialName} ·{' '}
              {dispatchTarget.line.warehouseName} ({formatQty(dispatchTarget.line.onHand, dispatchTarget.product.unitOfMeasure)} on hand)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Destination Warehouse *</label>
                <select
                  value={dispatchForm.toWarehouseId}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, toWarehouseId: e.target.value })}
                  className="h-9 w-full rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="">Select warehouse…</option>
                  {warehouses.filter((w) => w.id !== dispatchTarget.line.warehouseId).map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Quantity *</label>
                <input
                  value={dispatchForm.quantity}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, quantity: e.target.value })}
                  type="number"
                  step="0.0001"
                  placeholder={`Max ${formatNumber(dispatchTarget.line.onHand)}`}
                  className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Notes</label>
                <textarea
                  value={dispatchForm.notes}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-line px-3 py-2 text-xs focus:outline-none focus:border-[#EA4335]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDispatchTarget(null)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">Cancel</button>
              <button onClick={submitDispatch} disabled={saving} className="btn-3d px-4 h-9">
                <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
                  <Truck className="w-3.5 h-3.5" /> {saving ? 'Dispatching…' : 'Dispatch'}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {dispatchConfirmation && (
        <ConfirmationModal
          type="submit"
          title="Dispatch Finished Goods"
          description="Transfer this finished goods batch to the destination warehouse?"
          onConfirm={confirmDispatch}
          onCancel={() => setDispatchConfirmation(false)}
          isLoading={saving}
          confirmText="Dispatch"
        />
      )}
    </div>
  );
}
