import { useState, useEffect } from 'react';
import { db } from '../../../lib/db';
import { Sprout, MapPin, Plus, RefreshCw, Home, X } from 'lucide-react';

interface HarvestTrackerProps {
  searchQuery?: string;
}

export default function HarvestTracker({ searchQuery = '' }: HarvestTrackerProps) {
  const [farms] = useState([
    { id: 'F-1', name: 'Emerald Valley Ginger Hub', manager: 'John Doe', type: 'Spice Cultivation', lat: 4.824, lng: 7.012 },
    { id: 'F-2', name: 'Westland Organic Chili Fields', manager: 'Sarah Connor', type: 'Spice Cultivation', lat: 5.123, lng: 6.945 },
  ]);

  const filteredFarms = farms.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.manager.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [harvests, setHarvests] = useState<any[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [crop, setCrop] = useState('');
  const [quantity, setQuantity] = useState('');
  const [farmId, setFarmId] = useState(farms[0].id);

  const filteredHarvests = harvests.filter(h =>
    h.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.notes.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchHarvests = async () => {
    // Read from IndexedDB visits table (visits stores our offline harvest logs)
    const logs = await db.visits.toArray();
    setHarvests(logs);
  };

  useEffect(() => {
    fetchHarvests();
  }, []);

  const handleLogHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crop || !quantity) return;

    const farm = farms.find(f => f.id === farmId);

    const newLog = {
      localId: crypto.randomUUID(),
      rep_id: 'farm-manager-id',
      customer_name: `Harvest: ${crop}`,
      check_in_lat: farm?.lat || 4.824,
      check_in_lng: farm?.lng || 7.012,
      verified_via_mapbox: true,
      notes: `Yield: ${quantity} kg on farm ${farm?.name}`,
      syncStatus: 'pending_create' as const,
      updatedAt: new Date().toISOString(),
    };

    await db.visits.add(newLog);
    fetchHarvests();

    // Reset Form
    setCrop('');
    setQuantity('');
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6 text-[#171717]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#171717]">Farms Registry &amp; Yield Tracker</h2>
          <p className="text-xs text-[#737373]">Log harvest data in the field and sync instantly to central database modules.</p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="btn-3d h-9 px-4 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Log Yield</span>
        </button>
      </div>

      <div className="flex flex-col gap-6 w-full">
        
        {/* Row 1: Farm Registries (Table representation) */}
        <div className="bg-white border border-[#E9E9E9] rounded-lg p-5">
          <h3 className="text-sm font-bold text-[#313131] flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-[#EA4335]" />
            Registered Farms
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                  <th className="py-3.5 px-4 font-semibold">Farm Name</th>
                  <th className="py-3.5 px-3 font-semibold">Manager</th>
                  <th className="py-3.5 px-3 font-semibold">Operations Type</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Coordinates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E9]">
                {filteredFarms.map((farm) => (
                  <tr key={farm.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 flex items-center gap-2.5">
                      <Home className="w-3.5 h-3.5 text-[#EA4335]" />
                      <span className="font-semibold text-[#313131]">{farm.name}</span>
                    </td>
                    <td className="py-4 px-3 text-[#737373] font-medium">{farm.manager}</td>
                    <td className="py-4 px-3">
                      <span className="text-[10px] bg-indigo-50/15 text-indigo-650 px-2 py-0.5 rounded uppercase font-semibold">
                        {farm.type}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-[#737373] font-mono">{farm.lat.toFixed(4)}, {farm.lng.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 2: Harvest logs */}
        <div className="bg-white border border-[#E9E9E9] rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#313131] flex items-center gap-2">
              <Sprout className="w-4 h-4 text-[#EA4335]" />
              Harvest Records
            </h3>
            <button onClick={fetchHarvests} className="text-slate-400 hover:text-slate-900 transition-colors cursor-pointer" title="Reload Logs">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {filteredHarvests.length === 0 ? (
              <div className="text-center py-12 text-[#737373] text-xs">
                No harvests logged in local IndexedDB. Use "Log Yield" to add one.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                    <th className="py-3.5 px-4 font-semibold">Resource</th>
                    <th className="py-3.5 px-3 font-semibold">Details</th>
                    <th className="py-3.5 px-3 font-semibold">Registered Coords</th>
                    <th className="py-3.5 px-4 text-right font-semibold">Sync State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9E9E9]">
                  {filteredHarvests.map((log) => (
                    <tr key={log.localId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 text-[#313131] font-semibold">{log.customer_name}</td>
                      <td className="py-4 px-3 text-[#737373] font-mono text-[10px]">{log.notes}</td>
                      <td className="py-4 px-3 text-[#737373] font-mono text-[10px]">{log.check_in_lat}, {log.check_in_lng}</td>
                      <td className="py-4 px-4 text-right">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          log.syncStatus === 'synced' ? 'bg-emerald-500/10 text-emerald-650 border border-emerald-555/20' :
                          'bg-amber-500/10 text-amber-650 border border-amber-555/20'
                        }`}>
                          {log.syncStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* Modal Dialog */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E9E9E9] rounded-lg w-full max-w-md p-6 relative">
            <button 
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#171717] mb-4">Log Harvest Yield</h3>
            
            <form onSubmit={handleLogHarvest} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Select Location Farm</label>
                <select
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Crop Yield / Type</label>
                <input 
                  type="text" 
                  placeholder="e.g. Rice, Potatoes" 
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Quantity (kg)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 500" 
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                  required
                />
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  className="w-full h-[40px] btn-3d text-white text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-98 transition-transform cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Log Harvest</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
