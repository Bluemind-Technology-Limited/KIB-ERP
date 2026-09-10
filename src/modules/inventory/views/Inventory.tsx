import { useEffect, useState } from 'react';
import { Boxes, ArrowRightLeft, SlidersHorizontal, History as HistoryIcon, Plus, Trash2, Edit2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';

interface StockRow {
  materialId: string; materialName: string; sku: string; unitOfMeasure: string;
  batchLotId: string | null; batchNumber: string | null;
  warehouseId: string; warehouseName: string; binId: string | null; quantity: number;
  minQuantity?: number | null;
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

  // add stock modal
  const [showAddStock, setShowAddStock] = useState(false);
  const [addStockForm, setAddStockForm] = useState({ name: '', minQuantity: '', unitOfMeasure: 'units' });
  // transfer modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [tr, setTr] = useState({ materialId: '', quantity: '', fromWarehouseId: '', toWarehouseId: '', unitOfMeasure: '' });
  // adjust modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [adj, setAdj] = useState({ materialId: '', quantity: '', warehouseId: '', unitOfMeasure: '', reason: '', operation: 'add' });

  // confirmation states
  const [addStockConfirmation, setAddStockConfirmation] = useState(false);
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
      setMaterials(matRes.data.materials);
      setWarehouses(whRes.data.warehouses);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load inventory. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const doAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStockForm.name) { setError('Product name is required'); return; }
    setAddStockConfirmation(true);
  };

  const confirmAddStock = async () => {
    setSaving(true);
    try {
      await axiosClient.post('/inventory/stock', {
        name: addStockForm.name,
        minQuantity: addStockForm.minQuantity ? Number(addStockForm.minQuantity) : 0,
        unitOfMeasure: addStockForm.unitOfMeasure || 'units'
      });
      setShowAddStock(false);
      setAddStockForm({ name: '', minQuantity: '', unitOfMeasure: 'units' });
      setAddStockConfirmation(false);
      setError('');
      setSuccess('Stock item added successfully.');
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to add stock item');
      setAddStockConfirmation(false);
    } finally {
      setSaving(false);
    }
  };

  const doTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tr.materialId || !tr.quantity || !tr.fromWarehouseId || !tr.toWarehouseId) { setError('Complete all fields'); return; }
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
    setAdjustConfirmation(true);
  };

  const confirmAdjust = async () => {
    setSaving(true);
    try {
      const signedQuantity = adj.operation === 'add' ? Number(adj.quantity) : -Number(adj.quantity);
      const res = await axiosClient.post('/inventory/stock/adjustment', {
        materialId: adj.materialId, quantity: signedQuantity,
        unitOfMeasure: materials.find((m) => m.id === adj.materialId)?.unitOfMeasure || 'units',
        warehouseId: adj.warehouseId, reason: adj.reason,
      });
      setShowAdjust(false);
      setError('');
      setSuccess(res.data.requiresApproval ? 'Adjustment posted (flagged for approval).' : 'Adjustment posted successfully.');
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

  const filtered = stock.filter((s) =>
    s.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.batchNumber ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Inventory Ledger</h2>
          <p className="text-[#737373] text-xs">Derived stock — SUM of all ledger transactions per material/batch/location. No mutable stock columns.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddStock(true)} className="btn-3d px-4 h-9 shrink-0 bg-emerald-600 border-emerald-700 hover:bg-emerald-500">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold whitespace-nowrap">
              <Plus className="w-3.5 h-3.5 shrink-0" /> Add Stock
            </span>
          </button>
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

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-600">{success}</div>}

      {/* 2. Stock table */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton cols={5} rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No stock yet" hint="Post a GRN to create ledger entries." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Material</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 font-semibold">Warehouse</th>
                  <th className="px-4 py-3 font-semibold text-right">Min Qty</th>
                  <th className="px-4 py-3 font-semibold text-right">Qty</th>
                  <th className="px-4 py-3 font-semibold">UoM</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-[#EA4335]/10 flex items-center justify-center shrink-0"><Boxes className="w-3.5 h-3.5 text-[#EA4335]" /></div>
                        <div>
                          <p className="text-xs font-bold text-[#171717] leading-none">{s.materialName}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-mono">{s.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.batchNumber ? <span className="text-[10px] font-mono text-slate-600">{s.batchNumber}</span> : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{s.warehouseName}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500 font-mono">{s.minQuantity ?? 0}</td>
                    <td className={`px-4 py-3 text-right text-sm font-bold ${
                      s.quantity <= (s.minQuantity || 0) 
                        ? 'text-rose-600' 
                        : s.quantity < 0 
                          ? 'text-rose-600' 
                          : 'text-emerald-600'
                    }`}>
                      {s.quantity}
                      {s.quantity <= (s.minQuantity || 0) && (
                        <span className="ml-1 text-[9px] bg-rose-50 text-rose-600 border border-rose-200 px-1 py-0.2 rounded font-semibold uppercase tracking-wider inline-block">Low</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{s.unitOfMeasure}</td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => {
                          setTr({
                            materialId: s.materialId,
                            quantity: '',
                            fromWarehouseId: s.warehouseId || '',
                            toWarehouseId: '',
                            unitOfMeasure: s.unitOfMeasure
                          });
                          setShowTransfer(true);
                        }} 
                        className="h-6 px-2 rounded border border-slate-200 text-[10px] font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                      >
                        Transfer
                      </button>
                      <button 
                        onClick={() => {
                          setAdj({
                            materialId: s.materialId,
                            quantity: '',
                            warehouseId: s.warehouseId || '',
                            unitOfMeasure: s.unitOfMeasure,
                            reason: '',
                            operation: 'add'
                          });
                          setShowAdjust(true);
                        }} 
                        className="h-6 px-2 rounded border border-slate-200 text-[10px] font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                      >
                        Adjust
                      </button>
                      <button 
                        onClick={() => {
                          setEditingStockItem(s);
                          setEditStockForm({ minQuantity: String(s.minQuantity || 0) });
                          setIsEditStockOpen(true);
                        }} 
                        disabled={isEditingSaving}
                        className="h-6 w-6 rounded border border-slate-200 text-[10px] font-semibold text-slate-600 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Edit"
                      >
                        {isEditingSaving ? (
                          <div className="animate-spin">
                            <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full"></div>
                          </div>
                        ) : (
                          <Edit2 className="w-3 h-3" />
                        )}
                      </button>
                      <button 
                        onClick={() => setDeletingEntryId(s.materialId)}
                        disabled={saving}
                        className="h-6 w-6 rounded border border-rose-200 text-[10px] font-semibold text-rose-600 bg-white hover:bg-rose-50 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete"
                      >
                        {saving ? (
                          <div className="animate-spin">
                            <div className="w-3 h-3 border-2 border-rose-300 border-t-rose-600 rounded-full"></div>
                          </div>
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Ledger log list */}
      <div className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <HistoryIcon className="w-4 h-4 text-[#EA4335]" />
          <h3 className="text-xs font-bold text-[#171717]">Ledger Activity</h3>
          <span className="text-[9px] font-semibold text-slate-400 ml-auto">{history.length} entries</span>
        </div>
        {loading ? (
          <TableSkeleton cols={4} rows={6} hasAvatar={false} />
        ) : history.length === 0 ? (
          <EmptyState title="No ledger activity yet." hint="Receipts, transfers and adjustments will show up here." />
        ) : (
          <div className="divide-y divide-slate-50">
            {history.map((h) => {
              const qty = Number(h.quantity);
              const label = EVENT_LABEL[h.eventType] ?? h.eventType.replace(/_/g, ' ');
              return (
                <div key={h.id} className="flex items-start gap-3 px-4 py-3 group hover:bg-slate-50/50 transition-colors">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${qty < 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                    <HistoryIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-[#171717]">{label}</p>
                      <span className={`text-[10px] font-bold ${qty < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {qty > 0 ? '+' : ''}{qty} {h.unitOfMeasure}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {h.material.name} {h.batchLot ? `· Batch ${h.batchLot.batchNumber}` : ''} · {h.warehouse.name}
                    </p>
                    {h.notes && <p className="text-[10px] text-slate-400 mt-0.5">{h.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[9px] text-slate-400">{new Date(h.createdAt).toLocaleString()}</span>
                    <span className="text-[9px] text-slate-300">{h.createdBy.fullName || h.createdBy.email}</span>
                    <button
                      onClick={() => setDeletingEntryId(h.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded border border-rose-200 hover:bg-rose-50 text-rose-600 flex items-center justify-center mt-1"
                      title="Delete this ledger entry"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Stock Modal */}
      {showAddStock && (
        <Modal onClose={() => setShowAddStock(false)}>
          <form onSubmit={doAddStock} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#171717]">
                <Boxes className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">Add New Stock Item</h3>
              </div>
              <button type="button" onClick={() => setShowAddStock(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="text-[11px] text-slate-500">Register a new product directly in the inventory stock list. An ID/SKU will be generated automatically.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Product Name *</label>
                <input 
                  value={addStockForm.name} 
                  onChange={(e) => setAddStockForm({ ...addStockForm, name: e.target.value })} 
                  placeholder="e.g. Tomato Concentrate" 
                  className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" 
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Min Quantity (Alert Limit)</label>
                <input 
                  value={addStockForm.minQuantity} 
                  onChange={(e) => setAddStockForm({ ...addStockForm, minQuantity: e.target.value })} 
                  type="number" 
                  placeholder="e.g. 50" 
                  className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit of Measure *</label>
                <input 
                  value={addStockForm.unitOfMeasure} 
                  onChange={(e) => setAddStockForm({ ...addStockForm, unitOfMeasure: e.target.value })} 
                  placeholder="e.g. kg / bags" 
                  className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" 
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAddStock(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9 bg-emerald-600 border-emerald-700 hover:bg-emerald-500"><span className="text-white text-xs font-semibold whitespace-nowrap">Add to Stock</span></button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Transfer modal */}
      {showTransfer && (
        <Modal onClose={() => setShowTransfer(false)}>
          <form onSubmit={doTransfer} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#171717]">
                <ArrowRightLeft className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">Internal Transfer</h3>
              </div>
              <button type="button" onClick={() => setShowTransfer(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={tr.materialId} onChange={(e) => setTr({ ...tr, materialId: e.target.value })} className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335] md:col-span-2">
                <option value="">Material…</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
              </select>
              <select value={tr.fromWarehouseId} onChange={(e) => setTr({ ...tr, fromWarehouseId: e.target.value })} className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                <option value="">From warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select value={tr.toWarehouseId} onChange={(e) => setTr({ ...tr, toWarehouseId: e.target.value })} className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-xs focus:outline-none focus:border-[#EA4335]">
                <option value="">To warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <input value={tr.quantity} onChange={(e) => setTr({ ...tr, quantity: e.target.value })} type="number" placeholder="Quantity" className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowTransfer(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9"><span className="text-white text-xs font-semibold whitespace-nowrap">Transfer (2 entries)</span></button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Adjustment modal */}
      {showAdjust && (
        <Modal onClose={() => setShowAdjust(false)}>
          <form onSubmit={doAdjust} className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[#171717]">
                  <SlidersHorizontal className="w-4 h-4 text-[#EA4335]" />
                  <h3 className="text-sm font-bold">Inventory Adjustment</h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Add or remove stock from your inventory. All adjustments are recorded with your user ID.</p>
              </div>
              <button type="button" onClick={() => setShowAdjust(false)} className="text-slate-400 hover:text-slate-600 shrink-0">✕</button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <select value={adj.materialId} onChange={(e) => setAdj({ ...adj, materialId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335] pr-10">
                    <option value="">Material…</option>
                    {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
                  </select>
                </div>
                <div className="relative">
                  <select value={adj.warehouseId} onChange={(e) => setAdj({ ...adj, warehouseId: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335] pr-10">
                    <option value="">Warehouse…</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <select value={adj.operation} onChange={(e) => setAdj({ ...adj, operation: e.target.value })} className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335] font-semibold pr-10">
                    <option value="add">➕ Add Stock</option>
                    <option value="subtract">➖ Remove Stock</option>
                  </select>
                </div>
                <input value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value })} type="number" placeholder="Quantity" className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
              </div>
              <input value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} placeholder="Reason (optional)" className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAdjust(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">Cancel</button>
              <button type="submit" className="btn-3d px-4 h-9"><span className="text-white text-xs font-semibold whitespace-nowrap">Post Adjustment</span></button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Stock Confirmation Modal */}
      {addStockConfirmation && (
        <ConfirmationModal
          type="create"
          title="Add Stock Item"
          description="Register this new product in the inventory stock list."
          onConfirm={confirmAddStock}
          onCancel={() => setAddStockConfirmation(false)}
          isLoading={saving}
        />
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
            className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#171717]">
                <Edit2 className="w-4 h-4 text-[#EA4335]" />
                <h3 className="text-sm font-bold">Edit Stock Item</h3>
              </div>
              <button 
                type="button" 
                onClick={() => !isEditingSaving && setIsEditStockOpen(false)} 
                disabled={isEditingSaving}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Material</p>
                <p className="text-xs font-semibold text-[#171717] mt-1">{editingStockItem.materialName}</p>
                <p className="text-[9px] text-slate-400 font-mono">{editingStockItem.sku}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Quantity</p>
                <p className="text-sm font-bold text-emerald-600 mt-1">{editingStockItem.quantity} {editingStockItem.unitOfMeasure}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Min Quantity (Alert Threshold)</label>
                <input 
                  type="number" 
                  value={editStockForm.minQuantity}
                  onChange={(e) => setEditStockForm({ minQuantity: e.target.value })}
                  placeholder="Minimum quantity" 
                  disabled={isEditingSaving}
                  className="h-9 w-full rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335] disabled:opacity-50 disabled:cursor-not-allowed" 
                />
              </div>
              <p className="text-[10px] text-slate-500">Warehouse: <span className="font-semibold text-[#171717]">{editingStockItem.warehouseName}</span></p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button 
                type="button" 
                onClick={() => setIsEditStockOpen(false)}
                disabled={isEditingSaving}
                className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Delete Stock Item Confirmation Modal */}
      {deletingEntryId && (
        <ConfirmationModal
          isOpen={!!deletingEntryId}
          title="Delete Stock Entry"
          message="Are you sure you want to delete this stock entry? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          isLoading={saving}
          onConfirm={() => {
            // In production would call delete API for this stock entry
            setDeletingEntryId(null);
            load();
          }}
          onCancel={() => setDeletingEntryId(null)}
          isDangerous
        />
      )}

      {/* Delete Ledger Entry Confirmation Modal */}
      {deletingEntryId && (
        <ConfirmationModal
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
    </div>
  );
}
