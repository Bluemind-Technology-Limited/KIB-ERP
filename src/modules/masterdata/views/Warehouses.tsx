import { useEffect, useState } from 'react';
import { Warehouse as WarehouseIcon, ChevronDown, ChevronRight, Plus, MapPin, Boxes, Trash2 } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { DeleteConfirmationModal } from '../../../components/ui/DeleteConfirmationModal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DetailsModal, ViewButton, detailValue } from '../../../components/ui/DetailsModal';
import { PageDescription } from '../../../components/ui/PageDescription';

interface Bin {
  id: string;
  name: string;
  code: string;
  status: string;
}
interface Zone {
  id: string;
  name: string;
  code: string;
  status: string;
  bins: Bin[];
}
interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  status: string;
  zones: Zone[];
}

/** Derived stock row for one material/batch/bin inside a warehouse. */
interface WarehouseStockRow {
  materialId: string;
  materialName: string;
  sku: string;
  unitOfMeasure: string;
  batchLotId: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  binId: string | null;
  quantity: number;
}

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function Warehouses({ searchQuery = '' }: { searchQuery?: string }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedZone, setExpandedZone] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addingZoneTo, setAddingZoneTo] = useState<string | null>(null);
  const [addingBinTo, setAddingBinTo] = useState<string | null>(null);
  const [newWarehouse, setNewWarehouse] = useState({ name: '', code: '', address: '' });
  const [newZone, setNewZone] = useState({ warehouseId: '', name: '', code: '' });
  const [newBin, setNewBin] = useState({ zoneId: '', warehouseId: '', name: '', code: '' });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'warehouse' | 'zone' | 'bin'; id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createConfirmation, setCreateConfirmation] = useState<'warehouse' | 'zone' | 'bin' | null>(null);
  const [saving, setSaving] = useState(false);
  const [stockWarehouse, setStockWarehouse] = useState<Warehouse | null>(null);
  const [viewing, setViewing] = useState<Warehouse | null>(null);
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get<{ warehouses: Warehouse[] }>('/master-data/warehouses');
      setWarehouses(res.data.warehouses);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load warehouses. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = warehouses.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /** Everything currently sitting in a warehouse — stock is the ledger sum, so
   *  it is read from the inventory endpoint rather than the warehouse tables. */
  const viewWarehouseStock = async (w: Warehouse) => {
    setStockWarehouse(w);
    setWarehouseStock([]);
    setStockLoading(true);
    try {
      const res = await axiosClient.get<{ stock: WarehouseStockRow[] }>('/inventory/stock', {
        params: { warehouseId: w.id },
      });
      setWarehouseStock((res.data.stock ?? []).filter((r) => Number(r.quantity) !== 0));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load warehouse stock');
      setStockWarehouse(null);
    } finally {
      setStockLoading(false);
    }
  };

  const addWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarehouse.name || !newWarehouse.code) return;
    setCreateConfirmation('warehouse');
  };

  const confirmAddWarehouse = async () => {
    setSaving(true);
    try {
      await axiosClient.post('/master-data/warehouses', newWarehouse);
      setNewWarehouse({ name: '', code: '', address: '' });
      setShowAdd(false);
      setCreateConfirmation(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create warehouse');
      setCreateConfirmation(null);
    } finally {
      setSaving(false);
    }
  };

  const addZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZone.name || !newZone.code) return;
    setCreateConfirmation('zone');
  };

  const confirmAddZone = async () => {
    setSaving(true);
    try {
      await axiosClient.post('/master-data/zones', newZone);
      setNewZone({ warehouseId: '', name: '', code: '' });
      setAddingZoneTo(null);
      setCreateConfirmation(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create zone');
      setCreateConfirmation(null);
    } finally {
      setSaving(false);
    }
  };

  const addBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBin.name || !newBin.code) return;
    setCreateConfirmation('bin');
  };

  const confirmAddBin = async () => {
    setSaving(true);
    try {
      await axiosClient.post('/master-data/bins', newBin);
      setNewBin({ zoneId: '', warehouseId: '', name: '', code: '' });
      setAddingBinTo(null);
      setCreateConfirmation(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create bin');
      setCreateConfirmation(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteWarehouse = async (id: string) => {
    setDeleteConfirmation({ type: 'warehouse', id });
  };

  const deleteZone = async (id: string) => {
    setDeleteConfirmation({ type: 'zone', id });
  };

  const deleteBin = async (id: string) => {
    setDeleteConfirmation({ type: 'bin', id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      const endpoint = 
        deleteConfirmation.type === 'warehouse' ? `/master-data/warehouses/${deleteConfirmation.id}` :
        deleteConfirmation.type === 'zone' ? `/master-data/zones/${deleteConfirmation.id}` :
        `/master-data/bins/${deleteConfirmation.id}`;
      await axiosClient.delete(endpoint);
      setDeleteConfirmation(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete');
      setDeleteConfirmation(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Warehouse Setup</h2>
          <PageDescription>Warehouses → Zones → Bins spatial hierarchy for stock location tracking.</PageDescription>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(!showAdd)} className="btn-3d px-4 h-9">
            <span className="flex items-center gap-1.5 text-white text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Add Warehouse
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          {error}
        </div>
      )}

      {/* 2. Add Warehouse Form */}
      {showAdd && (
        <form onSubmit={addWarehouse} className="bg-white border border-[#E9E9E9] rounded-xl p-4 space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={newWarehouse.name}
              onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
              placeholder="Warehouse name (e.g. Main Store)"
              className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
            />
            <input
              value={newWarehouse.code}
              onChange={(e) => setNewWarehouse({ ...newWarehouse, code: e.target.value })}
              placeholder="Code (e.g. WH-MAIN)"
              className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
            />
            <input
              value={newWarehouse.address}
              onChange={(e) => setNewWarehouse({ ...newWarehouse, address: e.target.value })}
              placeholder="Address (optional)"
              className="h-9 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">
              Cancel
            </button>
            <button type="submit" className="btn-3d px-4 h-9">
              <span className="text-white text-xs font-semibold">Create Warehouse</span>
            </button>
          </div>
        </form>
      )}

      {/* 3. Warehouse List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-4 h-4" />
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-2 w-12" />
                  <Skeleton className="h-4 w-16 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No warehouses yet." hint="Add one to start mapping your storage locations." />
      ) : (
        <div className="space-y-4">
          {filtered.map((w) => (
            <div key={w.id} className="bg-white border border-[#E9E9E9] rounded-xl overflow-hidden">
              {/* Warehouse row */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpanded({ ...expanded, [w.id]: !expanded[w.id] })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpanded({ ...expanded, [w.id]: !expanded[w.id] });
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {expanded[w.id] ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <div className="w-8 h-8 rounded-lg bg-[#EA4335]/10 flex items-center justify-center">
                    <WarehouseIcon className="w-4 h-4 text-[#EA4335]" />
                  </div>
                  <div>
                    <p title={w.name} className="text-sm font-bold text-[#171717] leading-none max-w-[180px] truncate">{w.name}</p>
                    <p title={w.code} className="text-[10px] text-slate-400 mt-1 font-mono max-w-[180px] truncate">{w.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">{w.zones.length} zones</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      viewWarehouseStock(w);
                    }}
                    className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-[#EA4335] transition-colors px-1.5 py-1 rounded hover:bg-rose-50"
                    title="View materials in this warehouse"
                  >
                    <Boxes className="w-3.5 h-3.5" /> View Stock
                  </button>
                  <ViewButton onClick={() => setViewing(w)} />
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[w.status] || statusBadge.ACTIVE}`}>
                    {w.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWarehouse(w.id);
                    }}
                    className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                    title="Delete warehouse"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Zones */}
              {expanded[w.id] && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Zones</p>
                    <button
                      onClick={() => { setAddingZoneTo(addingZoneTo === w.id ? null : w.id); setNewZone({ ...newZone, warehouseId: w.id }); }}
                      className="flex items-center gap-1 text-[10px] font-semibold text-[#EA4335] hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Add Zone
                    </button>
                  </div>

                  {addingZoneTo === w.id && (
                    <form onSubmit={addZone} className="flex gap-2">
                      <input
                        value={newZone.name}
                        onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                        placeholder="Zone name (e.g. Raw Materials)"
                        className="h-8 flex-1 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                      />
                      <input
                        value={newZone.code}
                        onChange={(e) => setNewZone({ ...newZone, code: e.target.value })}
                        placeholder="Code (e.g. Z-RM)"
                        className="h-8 w-36 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                      />
                      <button type="submit" className="btn-3d px-3 h-8">
                        <span className="text-white text-[10px] font-semibold">Add</span>
                      </button>
                    </form>
                  )}

                  {w.zones.length === 0 && (
                    <p className="text-[10px] text-slate-400 pl-8">No zones in this warehouse.</p>
                  )}

                  {w.zones.map((z) => (
                    <div key={z.id} className="rounded-lg border border-slate-200 bg-white">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedZone({ ...expandedZone, [z.id]: !expandedZone[z.id] })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedZone({ ...expandedZone, [z.id]: !expandedZone[z.id] });
                          }
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {expandedZone[z.id] ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-semibold text-[#171717]">{z.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{z.code}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">{z.bins.length} bins</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteZone(z.id);
                            }}
                            className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                            title="Delete zone"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {expandedZone[z.id] && (
                        <div className="border-t border-slate-100 px-3 py-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bins / Racks</p>
                            <button
                              onClick={() => { setAddingBinTo(addingBinTo === z.id ? null : z.id); setNewBin({ ...newBin, zoneId: z.id, warehouseId: w.id }); }}
                              className="flex items-center gap-1 text-[10px] font-semibold text-[#EA4335] hover:underline"
                            >
                              <Plus className="w-3 h-3" /> Add Bin
                            </button>
                          </div>

                          {addingBinTo === z.id && (
                            <form onSubmit={addBin} className="flex gap-2">
                              <input
                                value={newBin.name}
                                onChange={(e) => setNewBin({ ...newBin, name: e.target.value })}
                                placeholder="Bin name (e.g. Shelf A1)"
                                className="h-8 flex-1 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                              <input
                                value={newBin.code}
                                onChange={(e) => setNewBin({ ...newBin, code: e.target.value })}
                                placeholder="Code (e.g. B-A1)"
                                className="h-8 w-32 rounded-lg border border-[#E9E9E9] px-3 text-xs focus:outline-none focus:border-[#EA4335]"
                              />
                              <button type="submit" className="btn-3d px-3 h-8">
                                <span className="text-white text-[10px] font-semibold">Add</span>
                              </button>
                            </form>
                          )}

                          {z.bins.length === 0 ? (
                            <p className="text-[10px] text-slate-400 pl-6">No bins in this zone.</p>
                          ) : (
                            z.bins.map((b) => (
                              <div key={b.id} className="flex items-center justify-between gap-2 pl-6">
                                <div className="flex items-center gap-2">
                                  <Boxes className="w-3 h-3 text-slate-300" />
                                  <span className="text-[11px] text-slate-600">{b.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{b.code}</span>
                                </div>
                                <button
                                  onClick={() => deleteBin(b.id)}
                                  className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                                  title="Delete bin"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Warehouse details modal */}
      {viewing && (
        <DetailsModal
          title={viewing.name}
          subtitle={<span className="font-mono">{viewing.code}</span>}
          status={{ label: viewing.status, className: statusBadge[viewing.status] || statusBadge.ACTIVE }}
          onClose={() => setViewing(null)}
          sections={[
            {
              title: 'Overview',
              fields: [
                { label: 'Warehouse', value: detailValue(viewing.name) },
                { label: 'Code', value: <span className="font-mono">{viewing.code}</span> },
                { label: 'Zones', value: viewing.zones.length },
                {
                  label: 'Bins',
                  value: viewing.zones.reduce((sum, z) => sum + z.bins.length, 0),
                },
              ],
            },
            {
              title: 'Location',
              fields: [{ label: 'Address', value: detailValue(viewing.address), wide: true }],
            },
            {
              title: `Zones & bins (${viewing.zones.length})`,
              fields: [
                {
                  label: 'Layout',
                  wide: true,
                  value:
                    viewing.zones.length === 0 ? (
                      '—'
                    ) : (
                      <div className="space-y-1.5">
                        {viewing.zones.map((z) => (
                          <div key={z.id} className="rounded-lg border border-[#E9E9E9] px-2 py-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <p title={z.name} className="text-[11px] font-semibold text-[#171717] truncate">{z.name}</p>
                              <span className="text-[9px] font-mono text-slate-400 shrink-0">{z.code}</span>
                            </div>
                            <p
                              title={z.bins.map((b) => b.name).join(', ')}
                              className="text-[10px] text-slate-500 mt-0.5 truncate"
                            >
                              {z.bins.length === 0 ? 'No bins' : z.bins.map((b) => b.name).join(' · ')}
                            </p>
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

      {/* Warehouse stock modal */}
      {stockWarehouse && (
        <Modal onClose={() => setStockWarehouse(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EA4335]/10 flex items-center justify-center">
                  <Boxes className="w-4 h-4 text-[#EA4335]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#171717] leading-none">{stockWarehouse.name}</h3>
                  <p
                    title={`${stockWarehouse.code}${stockWarehouse.address ? ` · ${stockWarehouse.address}` : ''}`}
                    className="text-[10px] text-slate-400 mt-1 max-w-[360px] truncate"
                  >
                    <span className="font-mono">{stockWarehouse.code}</span>
                    {stockWarehouse.address ? ` · ${stockWarehouse.address}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockWarehouse(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Materials in store</span>
              <span className="text-[10px] text-slate-500">
                {new Set(warehouseStock.map((r) => r.materialId)).size} material(s) · {warehouseStock.length} line(s)
              </span>
            </div>

            {stockLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            ) : warehouseStock.length === 0 ? (
              <EmptyState title="No stock in this warehouse." hint="Received goods will show up here once they hit the ledger." />
            ) : (
              <div className="border border-[#E9E9E9] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-[#E9E9E9]">
                    <tr>
                      <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Material</th>
                      <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Batch</th>
                      <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Expiry</th>
                      <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {warehouseStock.map((row, i) => (
                      <tr key={`${row.materialId}-${row.batchLotId ?? 'none'}-${row.binId ?? 'none'}-${i}`} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2">
                          <p title={row.materialName} className="text-[11px] font-semibold text-[#171717] leading-none max-w-[180px] truncate">{row.materialName}</p>
                          <p title={row.sku} className="text-[9px] font-mono text-slate-400 mt-1 max-w-[180px] truncate">{row.sku}</p>
                        </td>
                        <td className="px-3 py-2 text-[10px] font-mono text-slate-500">{row.batchNumber || '—'}</td>
                        <td className="px-3 py-2 text-[10px] text-slate-500">
                          {row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className="text-[11px] font-bold text-[#171717]">{Number(row.quantity).toLocaleString()}</span>{' '}
                          <span className="text-[9px] text-slate-400">{row.unitOfMeasure}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <DeleteConfirmationModal
          title={
            deleteConfirmation.type === 'warehouse' ? 'Delete Warehouse' :
            deleteConfirmation.type === 'zone' ? 'Delete Zone' :
            'Delete Bin'
          }
          description={`This ${deleteConfirmation.type} will be permanently deleted. This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isLoading={isDeleting}
        />
      )}

      {/* Create Warehouse Confirmation Modal */}
      {createConfirmation === 'warehouse' && (
        <ConfirmationModal
          type="create"
          title="Create Warehouse"
          description="Add this new warehouse to the system."
          onConfirm={confirmAddWarehouse}
          onCancel={() => setCreateConfirmation(null)}
          isLoading={saving}
        />
      )}

      {/* Create Zone Confirmation Modal */}
      {createConfirmation === 'zone' && (
        <ConfirmationModal
          type="create"
          title="Create Zone"
          description="Add this new zone to the warehouse."
          onConfirm={confirmAddZone}
          onCancel={() => setCreateConfirmation(null)}
          isLoading={saving}
        />
      )}

      {/* Create Bin Confirmation Modal */}
      {createConfirmation === 'bin' && (
        <ConfirmationModal
          type="create"
          title="Create Bin"
          description="Add this new bin to the zone."
          onConfirm={confirmAddBin}
          onCancel={() => setCreateConfirmation(null)}
          isLoading={saving}
        />
      )}
    </div>
  );
}
