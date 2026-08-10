import { useEffect, useState } from 'react';
import { Warehouse as WarehouseIcon, ChevronDown, ChevronRight, Plus, MapPin, Boxes } from 'lucide-react';
import { axiosClient } from '../../../lib/axiosClient';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

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

  const addWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarehouse.name || !newWarehouse.code) return;
    try {
      await axiosClient.post('/master-data/warehouses', newWarehouse);
      setNewWarehouse({ name: '', code: '', address: '' });
      setShowAdd(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create warehouse');
    }
  };

  const addZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZone.name || !newZone.code) return;
    try {
      await axiosClient.post('/master-data/zones', newZone);
      setNewZone({ warehouseId: '', name: '', code: '' });
      setAddingZoneTo(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create zone');
    }
  };

  const addBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBin.name || !newBin.code) return;
    try {
      await axiosClient.post('/master-data/bins', newBin);
      setNewBin({ zoneId: '', warehouseId: '', name: '', code: '' });
      setAddingBinTo(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create bin');
    }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* 1. Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#171717]">Warehouse Setup</h2>
          <p className="text-[#737373] text-xs">Warehouses → Zones → Bins spatial hierarchy for stock location tracking.</p>
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
              <button
                onClick={() => setExpanded({ ...expanded, [w.id]: !expanded[w.id] })}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
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
                    <p className="text-sm font-bold text-[#171717] leading-none">{w.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{w.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">{w.zones.length} zones</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge[w.status] || statusBadge.ACTIVE}`}>
                    {w.status}
                  </span>
                </div>
              </button>

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
                      <button
                        onClick={() => setExpandedZone({ ...expandedZone, [z.id]: !expandedZone[z.id] })}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
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
                        <span className="text-[10px] text-slate-400">{z.bins.length} bins</span>
                      </button>

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
                              <div key={b.id} className="flex items-center gap-2 pl-6">
                                <Boxes className="w-3 h-3 text-slate-300" />
                                <span className="text-[11px] text-slate-600">{b.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{b.code}</span>
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
    </div>
  );
}
