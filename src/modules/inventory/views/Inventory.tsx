import { useEffect, useMemo, useState } from 'react';
import { Boxes, ArrowRightLeft, SlidersHorizontal, History as HistoryIcon, Edit2, Loader2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';
import { PackQuantityPreview } from '../../../components/ui/PackQuantityPreview';
import { formatNumber, formatQty, quantityWeightLabel } from '../../../lib/format';
import { Pagination } from '../../../components/ui/Pagination';
import { usePagination } from '../../../hooks/usePagination';

interface StockRow {
  materialId: string; materialName: string; sku: string; unitOfMeasure: string;
  batchLotId: string | null; batchNumber: string | null;
  lotCode?: string | null;
  batchStatus?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  warehouseId: string; warehouseName: string; binId: string | null; quantity: number;
  minQuantity?: number | null;
}

interface MaterialGroup {
  materialId: string;
  materialName: string;
  sku: string;
  unitOfMeasure: string;
  minQuantity: number;
  totalQuantity: number;
  sets: StockRow[];
  warehouseCount: number;
  earliestExpiry: string | null;
}

interface HistoryEntry {
  id: string;
  eventType: string;
  quantity: string;
  unitOfMeasure: string;
  referenceType: string | null;
  notes: string | null;
  createdAt: string;
  material: { name: string; sku: string };
  batchLot: { batchNumber: string } | null;
  warehouse: { name: string };
  createdBy: { fullName: string | null; email: string | null };
  approvedBy: { fullName: string | null } | null;
}

const EVENT_LABEL: Record<string, string> = {
  RECEIPT: 'Goods Received',
  TRANSFER_OUT: 'Transfer Out',
  TRANSFER_IN: 'Transfer In',
  ADJUSTMENT: 'Adjustment',
  PRODUCTION_OUT: 'Consumed in Production',
  FINISHED_IN: 'Finished Goods In',
  WASTE: 'Waste',
};

export default function Inventory({ searchQuery = '' }: { searchQuery?: string }) {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  // transfer modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [tr, setTr] = useState({ materialId: '', quantity: '', fromWarehouseId: '', toWarehouseId: '', unitOfMeasure: '' });
  // adjust modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [adj, setAdj] = useState({ materialId: '', quantity: '', warehouseId: '', unitOfMeasure: '', reason: '', operation: 'add' });

  // confirmation states
  const [transferConfirmation, setTransferConfirmation] = useState(false);
  const [adjustConfirmation, setAdjustConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // delete confirmation state
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  
  // edit stock item state
  const [editingStockItem, setEditingStockItem] = useState<StockRow | null>(null);
  const [isEditStockOpen, setIsEditStockOpen] = useState(false);
  const [editStockForm, setEditStockForm] = useState({ minQuantity: '' });
  const [isEditingSaving, setIsEditingSaving] = useState(false);

  // view details modal
  const [viewing, setViewing] = useState<StockRow | null>(null);
  // grouped material sets modal
  const [viewingGroup, setViewingGroup] = useState<MaterialGroup | null>(null);
  /** Movement history for the item open in the View modal. */
  const [viewingHistory, setViewingHistory] = useState<HistoryEntry[]>([]);
  const [viewingHistoryLoading, setViewingHistoryLoading] = useState(false);
  const [viewingHistoryError, setViewingHistoryError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [stockRes, histRes, matRes, whRes] = await Promise.all([
        axiosClient.get<{ stock: StockRow[] }>('/inventory/stock'),
        axiosClient.get<{ history: HistoryEntry[] }>('/inventory/stock/history'),
        axiosClient.get<{ materials: any[] }>('/master-data/materials'),
        axiosClient.get<{ warehouses: any[] }>('/master-data/warehouses'),
      ]);
      setStock(stockRes.data.stock);
      setHistory(histRes.data.history);
      setMaterials(matRes.data.materials.filter((m: any) => m.type !== 'FINISHED'));
      setWarehouses(whRes.data.warehouses);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load inventory. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /**
   * Opens the item modal and loads every receipt, transfer and usage of that
   * ingredient from the ledger (per batch when the row is batch-specific).
   */
  const openView = async (row: StockRow) => {
    setViewing(row);
    setViewingHistory([]);
    setViewingHistoryError('');
    setViewingHistoryLoading(true);
    try {
      const res = await axiosClient.get<{ history: HistoryEntry[] }>('/inventory/stock/history', {
        params: {
          materialId: row.materialId,
          ...(row.batchLotId ? { batchLotId: row.batchLotId } : {}),
        },
        toast: false,
      });
      setViewingHistory(res.data.history);
    } catch (err: any) {
      setViewingHistoryError(err?.response?.data?.error || 'Failed to load the movement history.');
    } finally {
      setViewingHistoryLoading(false);
    }
  };

  /** Available quantity for a material in a warehouse (sums its batches). */
  const availableIn = (materialId: string, warehouseId: string) =>
    stock
      .filter((s) => s.materialId === materialId && s.warehouseId === warehouseId)
      .reduce((sum, s) => sum + Number(s.quantity), 0);

  const transferAvailable = tr.materialId && tr.fromWarehouseId
    ? availableIn(tr.materialId, tr.fromWarehouseId)
    : null;

  const doTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tr.materialId || !tr.quantity || !tr.fromWarehouseId || !tr.toWarehouseId) { setError('Complete all fields'); return; }
    const available = availableIn(tr.materialId, tr.fromWarehouseId);
    if (available <= 0) {
      setError('There is no stock left to transfer from the source warehouse.');
      return;
    }
    if (Number(tr.quantity) <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }
    if (Number(tr.quantity) > available) {
      setError(`Only ${available} ${tr.unitOfMeasure || 'units'} available in the source warehouse.`);
      return;
    }
    setError('');
    setTransferConfirmation(true);
  };

  const confirmTransfer = async () => {
    setSaving(true);
    try {
      await axiosClient.post('/inventory/stock/transfer', {
        materialId: tr.materialId, quantity: Number(tr.quantity),
        unitOfMeasure: materials.find((m) => m.id === tr.materialId)?.unitOfMeasure || 'units',
        fromWarehouseId: tr.fromWarehouseId, toWarehouseId: tr.toWarehouseId,
      });
      setShowTransfer(false);
      setTr({ materialId: '', quantity: '', fromWarehouseId: '', toWarehouseId: '', unitOfMeasure: '' });
      setTransferConfirmation(false);
      setError('');
      setSuccess('Transfer completed successfully.');
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (err: any) { 
      setError(err?.response?.data?.error || 'Transfer failed'); 
      setTransferConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  const doAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adj.materialId || !adj.quantity || !adj.warehouseId) { setError('Complete all fields'); return; }
    if (adj.operation === 'subtract') {
      const available = availableIn(adj.materialId, adj.warehouseId);
      if (available <= 0) {
        setError('There is no stock in that warehouse to remove.');
        return;
      }
      if (Number(adj.quantity) > available) {
        setError(`Only ${available} ${adj.unitOfMeasure || 'units'} available — stock cannot go below zero.`);
        return;
      }
    }
    setError('');
    setAdjustConfirmation(true);
  };

  const confirmAdjust = async () => {
    setSaving(true);
    try {
      const signedQuantity = adj.operation === 'add' ? Number(adj.quantity) : -Number(adj.quantity);
      await axiosClient.post('/inventory/stock/adjustment', {
        materialId: adj.materialId, quantity: signedQuantity,
        unitOfMeasure: materials.find((m) => m.id === adj.materialId)?.unitOfMeasure || 'units',
        warehouseId: adj.warehouseId, reason: adj.reason,
      });
      setShowAdjust(false);
      setError('');
      setSuccess('Adjustment posted successfully.');
      setTimeout(() => setSuccess(''), 3000);
      setAdj({ materialId: '', quantity: '', warehouseId: '', unitOfMeasure: '', reason: '', operation: 'add' });
      setAdjustConfirmation(false);
      load();
    } catch (err: any) { 
      setError(err?.response?.data?.error || 'Adjustment failed'); 
      setAdjustConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    setSaving(true);
    try {
      await axiosClient.delete(`/inventory/stock/history/${entryId}`);
      setError('');
      setDeletingEntryId(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete ledger entry');
      setDeletingEntryId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleEditStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStockItem) return;
    
    setIsEditingSaving(true);
    try {
      await axiosClient.put(`/inventory/stock/${editingStockItem.materialId}`, {
        minQuantity: Number(editStockForm.minQuantity) || 0,
      });
      setError('');
      setIsEditStockOpen(false);
      setEditingStockItem(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update stock item');
    } finally {
      setIsEditingSaving(false);
    }
  };

  const groups = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    const map = new Map<string, MaterialGroup>();

    for (const row of stock) {
      let group = map.get(row.materialId);
      if (!group) {
        group = {
          materialId: row.materialId,
          materialName: row.materialName,
          sku: row.sku,
          unitOfMeasure: row.unitOfMeasure,
          minQuantity: Number(row.minQuantity ?? 0),
          totalQuantity: 0,
          sets: [],
          warehouseCount: 0,
          earliestExpiry: null,
        };
        map.set(row.materialId, group);
      }

      group.totalQuantity = Number((group.totalQuantity + Number(row.quantity)).toFixed(4));
      if (row.batchLotId || Number(row.quantity) !== 0) group.sets.push(row);
      if (
        row.expiryDate &&
        (!group.earliestExpiry ||
          new Date(row.expiryDate).getTime() < new Date(group.earliestExpiry).getTime())
      ) {
        group.earliestExpiry = row.expiryDate;
      }
    }

    const list = [...map.values()].map((group) => ({
      ...group,
      warehouseCount: new Set(group.sets.map((set) => set.warehouseId)).size,
    }));

    const matches = !term
      ? list
      : list.filter(
          (group) =>
            group.materialName.toLowerCase().includes(term) ||
            group.sku.toLowerCase().includes(term) ||
            group.sets.some(
              (set) =>
                (set.batchNumber ?? '').toLowerCase().includes(term) ||
                (set.lotCode ?? '').toLowerCase().includes(term)
            )
        );

    return matches.sort((a, b) => a.materialName.localeCompare(b.materialName));
  }, [stock, searchQuery]);

  const { page, totalPages, total, pageItems, setPage } = usePagination(groups);

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">Inventory Ledger</h2>
          <PageDescription>Derived stock for raw and packaging materials. Finished goods are tracked separately under Inventory → Finished Goods.</PageDescription>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTransfer(true)} className="btn-3d px-4 h-9 shrink-0">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap">
              <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" /> Transfer
            </span>
          </button>
          <button onClick={() => setShowAdjust(true)} className="btn-3d px-4 h-9 shrink-0">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap">
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" /> Adjustment
            </span>
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{success}</div>}

      {/* 2. Stock table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={5} rows={6} />
        ) : groups.length === 0 ? (
          <EmptyState title="No stock yet" hint="Post a GRN to create ledger entries." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">Sets</th>
                  <th className="px-4 py-3 font-semibold">Warehouses</th>
                  <th className="px-4 py-3 font-semibold text-right">Min Qty</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Qty</th>
                  <th className="px-4 py-3 font-semibold">UoM</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((g) => {
                  const low = g.minQuantity > 0 && g.totalQuantity <= g.minQuantity;
                  const firstSet = g.sets.find((set) => Number(set.quantity) > 0) ?? g.sets[0] ?? null;
                  const editTarget: StockRow =
                    firstSet ?? {
                      materialId: g.materialId,
                      materialName: g.materialName,
                      sku: g.sku,
                      unitOfMeasure: g.unitOfMeasure,
                      batchLotId: null,
                      batchNumber: null,
                      warehouseId: '',
                      warehouseName: '',
                      binId: null,
                      quantity: 0,
                      minQuantity: g.minQuantity,
                    };

                  return (
                    <tr
                      key={g.materialId}
                      onClick={() => setViewingGroup(g)}
                      className="cursor-pointer border-b border-line hover:bg-surface-2/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0"><Boxes className="w-3.5 h-3.5 text-[#EA4335]" /></div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-ink leading-none truncate max-w-[180px]" title={g.materialName}>{g.materialName}</p>
                            <p className="text-[9px] text-ink-faint mt-0.5 font-mono truncate max-w-[180px]" title={g.sku}>{g.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[11px] font-semibold text-ink-2">
                          {formatNumber(g.sets.length)} set{g.sets.length === 1 ? '' : 's'}
                        </p>
                        {g.earliestExpiry && (
                          <p className="text-[9px] text-amber-600 dark:text-amber-300">
                            Earliest expiry {new Date(g.earliestExpiry).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">
                        {formatNumber(g.warehouseCount)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-ink-muted font-mono">{formatNumber(g.minQuantity)}</td>
                      <td className={`px-4 py-3 text-right text-sm font-bold ${low ? 'text-rose-600 dark:text-rose-300' : g.totalQuantity < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                        {formatNumber(g.totalQuantity)}
                        {low && (
                          <span className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ml-1 bg-rose-600 text-white">Low</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-faint">
                        {g.unitOfMeasure}
                        {quantityWeightLabel(g.totalQuantity, g.unitOfMeasure) && (
                          <p className="text-[9px] text-ink-faint">= {quantityWeightLabel(g.totalQuantity, g.unitOfMeasure)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingGroup(g)}
                            className="h-6 px-2 rounded border border-line text-[10px] font-semibold text-ink-muted bg-surface hover:bg-surface-2 transition-colors"
                            title="View the sets for this material"
                          >
                            Sets
                          </button>
                          <button
                            onClick={() => {
                              setTr({
                                materialId: g.materialId,
                                quantity: '',
                                fromWarehouseId: editTarget.warehouseId || '',
                                toWarehouseId: '',
                                unitOfMeasure: g.unitOfMeasure,
                              });
                              setShowTransfer(true);
                            }}
                            disabled={g.totalQuantity <= 0}
                            title={g.totalQuantity <= 0 ? 'No stock to transfer' : 'Transfer stock'}
                            className="h-6 px-2 rounded border border-line text-[10px] font-semibold text-ink-muted bg-surface hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Transfer
                          </button>
                          <button
                            onClick={() => {
                              setAdj({
                                materialId: g.materialId,
                                quantity: '',
                                warehouseId: editTarget.warehouseId || '',
                                unitOfMeasure: g.unitOfMeasure,
                                reason: '',
                                operation: 'add',
                              });
                              setShowAdjust(true);
                            }}
                            className="h-6 px-2 rounded border border-line text-[10px] font-semibold text-ink-muted bg-surface hover:bg-surface-2 transition-colors"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => {
                              setEditingStockItem(editTarget);
                              setEditStockForm({ minQuantity: String(g.minQuantity || 0) });
                              setIsEditStockOpen(true);
                            }}
                            disabled={isEditingSaving}
                            className="h-6 rounded-md bg-sky-600 px-2 text-[10px] font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Edit minimum quantity"
                          >
                            {isEditingSaving ? 'Saving…' : 'Edit'}
                          </button>
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

      {/* 3. Ledger log list */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <HistoryIcon className="w-4 h-4 text-[#EA4335]" />
          <h3 className="text-xs font-bold text-ink">Ledger Activity</h3>
          <span className="text-[9px] font-semibold text-ink-faint ml-auto">{history.length} entries</span>
        </div>
        {loading ? (
          <TableSkeleton cols={4} rows={6} hasAvatar={false} />
        ) : history.length === 0 ? (
          <EmptyState title="No ledger activity yet." hint="Receipts, transfers and adjustments will show up here." />
        ) : (
          <div className="divide-y divide-line">
            {history.map((h) => {
              const qty = Number(h.quantity);
              const label = EVENT_LABEL[h.eventType] ?? h.eventType.replace(/_/g, ' ');
              return (
                <div key={h.id} className="flex items-start gap-3 px-4 py-3 group hover:bg-surface-2/50 transition-colors">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${qty < 0 ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    <HistoryIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-ink">{label}</p>
                      <span className={`text-[10px] font-bold ${qty < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                        {qty > 0 ? '+' : ''}{formatQty(qty, h.unitOfMeasure)}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-faint mt-0.5 truncate">
                      {h.material.name} {h.batchLot ? `· Batch ${h.batchLot.batchNumber}` : ''} · {h.warehouse.name}
                    </p>
                    {h.notes && <p className="text-[10px] text-ink-faint mt-0.5">{h.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[9px] text-ink-faint">{new Date(h.createdAt).toLocaleString()}</span>
                    <span className="text-[9px] text-ink-faint">{h.createdBy.fullName || h.createdBy.email}</span>
                    <button
                      onClick={() => setDeletingEntryId(h.id)}
                      className="mt-1 rounded-md bg-rose-600 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-rose-700"
                      title="Delete this ledger entry"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3b. Material sets modal — one row per material, sets on click */}
      {viewingGroup && (
        <Modal onClose={() => setViewingGroup(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-surface p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">
                  Material stock
                </p>
                <h3 className="truncate text-sm font-bold text-ink">
                  {viewingGroup.materialName}
                </h3>
                <p className="font-mono text-[10px] text-ink-faint">{viewingGroup.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingGroup(null)}
                className="text-ink-faint hover:text-ink-muted"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-line bg-surface-2/70 px-3 py-2">
                <p className="text-[8px] font-bold uppercase tracking-wider text-ink-faint">Total qty</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-ink">
                  {formatNumber(viewingGroup.totalQuantity)} {viewingGroup.unitOfMeasure}
                </p>
              </div>
              <div className="rounded-lg border border-line bg-surface-2/70 px-3 py-2">
                <p className="text-[8px] font-bold uppercase tracking-wider text-ink-faint">Sets</p>
                <p className="mt-0.5 text-sm font-bold text-ink">{formatNumber(viewingGroup.sets.length)}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface-2/70 px-3 py-2">
                <p className="text-[8px] font-bold uppercase tracking-wider text-ink-faint">Warehouses</p>
                <p className="mt-0.5 text-sm font-bold text-ink">{formatNumber(viewingGroup.warehouseCount)}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface-2/70 px-3 py-2">
                <p className="text-[8px] font-bold uppercase tracking-wider text-ink-faint">Min qty</p>
                <p className="mt-0.5 text-sm font-bold text-ink">{formatNumber(viewingGroup.minQuantity)}</p>
              </div>
            </div>

            {viewingGroup.sets.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[11px] text-ink-faint">
                No stock sets recorded for this material yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left">
                    <thead className="bg-surface-2">
                      <tr className="text-[8px] uppercase tracking-wider text-ink-faint">
                        <th className="px-3 py-2 font-semibold">Set / batch</th>
                        <th className="px-3 py-2 font-semibold">Warehouse</th>
                        <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                        <th className="px-3 py-2 font-semibold">Expiry</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 text-right font-semibold">History</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingGroup.sets.map((set) => (
                        <tr key={`${set.batchLotId ?? 'none'}-${set.warehouseId}-${set.binId ?? 'bin'}`} className="border-t border-line">
                          <td className="px-3 py-2">
                            <p className="font-mono text-[10px] font-semibold text-ink-2">
                              {set.lotCode ?? set.batchNumber ?? 'No lot'}
                            </p>
                            {set.lotCode && set.batchNumber && set.lotCode !== set.batchNumber && (
                              <p className="font-mono text-[9px] text-ink-faint">{set.batchNumber}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[10px] text-ink-muted">{set.warehouseName}</td>
                          <td className="px-3 py-2 text-right text-[11px] font-bold text-ink">
                            {formatNumber(set.quantity)}
                          </td>
                          <td className="px-3 py-2 text-[10px] text-ink-muted">
                            {set.expiryDate ? new Date(set.expiryDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded-full inline-block text-center min-w-[78px] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-600 text-white">
                              {set.batchStatus ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setViewingGroup(null);
                                openView(set);
                              }}
                              className="h-6 px-2 rounded border border-line text-[9px] font-semibold text-ink-muted hover:bg-surface-2"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 4. Transfer modal */}
      {showTransfer && (
        <Modal onClose={() => setShowTransfer(false)}>
          <form onSubmit={doTransfer} className="bg-surface rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink">
                <ArrowRightLeft className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">Internal Transfer</h3>
              </div>
              <button type="button" onClick={() => setShowTransfer(false)} className="text-ink-faint hover:text-ink-muted">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={tr.materialId} onChange={(e) => setTr({ ...tr, materialId: e.target.value })} className="h-9 rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335] md:col-span-2">
                <option value="">Material…</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
              </select>
              <select value={tr.fromWarehouseId} onChange={(e) => setTr({ ...tr, fromWarehouseId: e.target.value })} className="h-9 rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                <option value="">From warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select value={tr.toWarehouseId} onChange={(e) => setTr({ ...tr, toWarehouseId: e.target.value })} className="h-9 rounded-lg border border-line px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                <option value="">To warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <div className="space-y-1">
                <input value={tr.quantity} onChange={(e) => setTr({ ...tr, quantity: e.target.value })} type="number" min="0.0001" step="any" placeholder="Quantity" className="h-9 rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
                <PackQuantityPreview
                  quantity={tr.quantity}
                  unit={materials.find((m) => m.id === tr.materialId)?.unitOfMeasure}
                />
              </div>
            </div>
            {transferAvailable !== null && (
              <p className={`text-[10px] ${transferAvailable <= 0 ? 'text-rose-600 dark:text-rose-300' : 'text-ink-muted'}`}>
                Available in source warehouse: <span className="font-semibold">{formatNumber(transferAvailable)}</span>{' '}
                {materials.find((m) => m.id === tr.materialId)?.unitOfMeasure ?? ''}
                {transferAvailable <= 0 ? ' — nothing can be transferred from here.' : ''}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowTransfer(false)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9"><span className="text-white text-xs font-semibold whitespace-nowrap">Transfer (2 entries)</span></button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Adjustment modal */}
      {showAdjust && (
        <Modal onClose={() => setShowAdjust(false)}>
          <form onSubmit={doAdjust} className="bg-surface rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-ink">
                  <SlidersHorizontal className="w-4 h-4 text-[#EA4335]" />
                  <h3 className="text-sm font-bold">Inventory Adjustment</h3>
                </div>
                <p className="text-[11px] text-ink-muted mt-1">Add or remove stock from your inventory. All adjustments are recorded with your user ID.</p>
              </div>
              <button type="button" onClick={() => setShowAdjust(false)} className="text-ink-faint hover:text-ink-muted shrink-0">✕</button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <select value={adj.materialId} onChange={(e) => setAdj({ ...adj, materialId: e.target.value })} className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335] pr-10">
                    <option value="">Material…</option>
                    {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
                  </select>
                </div>
                <div className="relative">
                  <select value={adj.warehouseId} onChange={(e) => setAdj({ ...adj, warehouseId: e.target.value })} className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335] pr-10">
                    <option value="">Warehouse…</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <select value={adj.operation} onChange={(e) => setAdj({ ...adj, operation: e.target.value })} className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335] font-semibold pr-10">
                    <option value="add">➕ Add Stock</option>
                    <option value="subtract">➖ Remove Stock</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <input value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value })} type="number" min="0.0001" step="any" placeholder="Quantity" className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
                  <PackQuantityPreview
                    quantity={adj.quantity}
                    unit={materials.find((m) => m.id === adj.materialId)?.unitOfMeasure}
                  />
                </div>
              </div>
              <input value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} placeholder="Reason (optional)" className="h-9 rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAdjust(false)} className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9"><span className="text-white text-xs font-semibold whitespace-nowrap">Post Adjustment</span></button>
            </div>
          </form>
        </Modal>
      )}

      {/* Transfer Confirmation Modal */}
      {transferConfirmation && (
        <ConfirmationModal
          type="submit"
          title="Transfer Stock"
          description="Transfer this quantity between warehouses."
          onConfirm={confirmTransfer}
          onCancel={() => setTransferConfirmation(false)}
          isLoading={saving}
          confirmText="Transfer"
        />
      )}

      {/* Adjust Confirmation Modal */}
      {adjustConfirmation && (
        <ConfirmationModal
          type="submit"
          title="Post Adjustment"
          description="Record this stock adjustment in the inventory ledger."
          onConfirm={confirmAdjust}
          onCancel={() => setAdjustConfirmation(false)}
          isLoading={saving}
          confirmText="Post"
        />
      )}

      {/* Edit Stock Item Modal */}
      {isEditStockOpen && editingStockItem && (
        <Modal onClose={() => !isEditingSaving && setIsEditStockOpen(false)}>
          <form 
            onSubmit={handleEditStockSubmit}
            className="bg-surface rounded-xl w-full max-w-lg p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink">
                <Edit2 className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">Edit Stock Item</h3>
              </div>
              <button 
                type="button" 
                onClick={() => !isEditingSaving && setIsEditStockOpen(false)} 
                disabled={isEditingSaving}
                className="text-ink-faint hover:text-ink-muted disabled:opacity-50"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-surface-2 rounded-lg border border-line">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Material</p>
                <p className="text-xs font-semibold text-ink mt-1">{editingStockItem.materialName}</p>
                <p className="text-[9px] text-ink-faint font-mono">{editingStockItem.sku}</p>
              </div>
              <div className="p-3 bg-surface-2 rounded-lg border border-line">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Current Quantity</p>
                <p className="text-sm font-bold text-emerald-600 mt-1 dark:text-emerald-300">{formatQty(editingStockItem.quantity, editingStockItem.unitOfMeasure)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Min Quantity (Alert Threshold)</label>
                <input 
                  type="number" 
                  value={editStockForm.minQuantity}
                  onChange={(e) => setEditStockForm({ minQuantity: e.target.value })}
                  placeholder="Minimum quantity" 
                  disabled={isEditingSaving}
                  className="h-9 w-full rounded-lg border border-line px-3 text-xs focus:outline-none focus:border-[#EA4335] disabled:opacity-50 disabled:cursor-not-allowed" 
                />
              </div>
              <p className="text-[10px] text-ink-muted">Warehouse: <span className="font-semibold text-ink">{editingStockItem.warehouseName}</span></p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button 
                type="button" 
                onClick={() => setIsEditStockOpen(false)}
                disabled={isEditingSaving}
                className="h-9 px-4 rounded-lg border border-line text-xs font-semibold text-ink-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isEditingSaving}
                className="btn-3d px-4 h-9 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                {isEditingSaving ? (
                  <>
                    <div className="animate-spin">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full"></div>
                    </div>
                    <span className="text-white text-xs font-semibold whitespace-nowrap">Saving…</span>
                  </>
                ) : (
                  <span className="text-white text-xs font-semibold whitespace-nowrap">Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Ledger Entry Confirmation Modal */}
      {deletingEntryId && (
        <ConfirmationModal
          type="delete"
          isOpen={!!deletingEntryId}
          title="Delete Ledger Entry"
          message="Are you sure you want to delete this inventory transaction? This action cannot be undone and will revert the stock count."
          confirmText="Delete"
          cancelText="Cancel"
          isLoading={saving}
          onConfirm={() => handleDeleteEntry(deletingEntryId)}
          onCancel={() => setDeletingEntryId(null)}
          isDangerous
        />
      )}

      {/* Stock item details */}
      {viewing && (
        <DetailsModal
          title={viewing.materialName}
          subtitle={viewing.sku}
          status={
            viewing.quantity <= (viewing.minQuantity || 0)
              ? { label: viewing.quantity < 0 ? 'Negative' : 'Low Stock', className: 'bg-rose-600 text-white' }
              : { label: 'In Stock', className: 'bg-emerald-600 text-white' }
          }
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Overview',
              fields: [
                { label: 'Material', value: detailValue(viewing.materialName) },
                { label: 'SKU', value: detailValue(viewing.sku) },
                { label: 'Batch Number', value: detailValue(viewing.batchNumber) },
                { label: 'Lot Code', value: detailValue(viewing.lotCode) },
                { label: 'Batch Status', value: detailValue(viewing.batchStatus) },
                { label: 'Warehouse', value: detailValue(viewing.warehouseName) },
              ],
            },
            {
              title: 'Stock',
              fields: [
                { label: 'On Hand', value: formatQty(viewing.quantity, viewing.unitOfMeasure) },
                { label: 'Minimum Quantity', value: formatNumber(viewing.minQuantity ?? 0) },
                { label: 'Unit of Measure', value: detailValue(viewing.unitOfMeasure) },
                { label: 'Bin', value: detailValue(viewing.binId) },
              ],
            },
            {
              title: `Transaction History ${viewingHistoryLoading ? '' : ` ( ${viewingHistory.length})`}`,
              fields: [
                {
                  label: viewing.batchLotId ? 'Movements for this batch' : 'Movements for this material',
                  wide: true,
                  value: viewingHistoryLoading ? (
                    <div className="flex items-center gap-2 py-3 text-ink-faint">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-[11px]">Loading movements…</span>
                    </div>
                  ) : viewingHistoryError ? (
                    <p className="text-[11px] text-rose-600 dark:text-rose-300">{viewingHistoryError}</p>
                  ) : viewingHistory.length === 0 ? (
                    <p className="text-[11px] text-ink-faint">No movements recorded yet.</p>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto rounded-lg border border-line divide-y divide-line">
                      {viewingHistory.map((h) => {
                        const qty = Number(h.quantity);
                        const label = EVENT_LABEL[h.eventType] ?? h.eventType.replace(/_/g, ' ');
                        return (
                          <div key={h.id} className="flex items-start justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-ink">{label}</p>
                              <p className="text-[9px] text-ink-faint truncate">
                                {new Date(h.createdAt).toLocaleString()} · {h.warehouse.name}
                                {h.batchLot ? ` · ${h.batchLot.batchNumber}` : ''}
                                {h.referenceType ? ` · ${h.referenceType}` : ''}
                              </p>
                              <p className="text-[9px] text-ink-faint truncate">
                                by {h.createdBy.fullName || h.createdBy.email || '—'}
                                {h.notes ? ` — ${h.notes}` : ''}
                              </p>
                            </div>
                            <span className={`shrink-0 text-[11px] font-mono font-bold ${qty < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                              {qty > 0 ? '+' : ''}{formatQty(qty, h.unitOfMeasure)}
                            </span>
                          </div>
                        );
                      })}
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
