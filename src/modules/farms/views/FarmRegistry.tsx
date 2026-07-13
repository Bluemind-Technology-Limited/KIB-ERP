import { useState, useEffect, useRef } from 'react';
import { MapPin, Sprout, Plus, Home, X } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1Ijoid2F5bmV4IiwiYSI6ImNtcmltcDNsOTBkNHAyd3NjZ3UzbDNlMTIifQ.XMWtUsdyyok9RmDXXOxIjA';

interface FarmRegistryProps {
  searchQuery?: string;
}

export default function FarmRegistry({ searchQuery = '' }: FarmRegistryProps) {
  const [farms, setFarms] = useState([
    { id: 'F-1', name: 'Emerald Valley Ginger Hub', manager: 'John Doe', type: 'Spice Cultivation', lat: 4.824, lng: 7.012 },
    { id: 'F-2', name: 'Westland Organic Chili Fields', manager: 'Sarah Connor', type: 'Spice Cultivation', lat: 5.123, lng: 6.945 },
  ]);

  const filteredFarms = farms.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.manager.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFarm, setNewFarm] = useState({ name: '', manager: '', type: 'Spice Cultivation', lat: '', lng: '' });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!isModalOpen || !mapContainerRef.current) return;

    // Initialize Mapbox map instance
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [7.012, 4.824],
      zoom: 6.5,
    });

    mapRef.current = map;

    // Add navigation controls (zoom buttons)
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Click handler to extract coordinates
    map.on('click', (e) => {
      const { lat, lng } = e.lngLat;
      const computedLat = lat.toFixed(4);
      const computedLng = lng.toFixed(4);

      setNewFarm((prev) => ({ ...prev, lat: computedLat, lng: computedLng }));

      // Create or update marker
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'w-6 h-6 flex items-center justify-center bg-white border-2 border-[#EA4335] rounded-full shadow-md';
        el.innerHTML = '<div class="w-2.5 h-2.5 bg-[#EA4335] rounded-full animate-ping"></div>';

        const marker = new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .addTo(map);
        markerRef.current = marker;
      }
    });

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [isModalOpen]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarm.name || !newFarm.manager) return;

    setFarms([
      ...farms,
      {
        id: `F-${farms.length + 1}`,
        name: newFarm.name,
        manager: newFarm.manager,
        type: newFarm.type,
        lat: parseFloat(newFarm.lat) || 4.8,
        lng: parseFloat(newFarm.lng) || 7.0,
      },
    ]);

    setNewFarm({ name: '', manager: '', type: 'Spice Cultivation', lat: '', lng: '' });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 text-[#171717]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#171717]">Registered Farms Catalog</h2>
          <p className="text-xs text-[#737373]">Add and review registered corporate farm properties and operational types.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-3d h-9 px-4 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Register Property</span>
        </button>
      </div>

      <div className="flex flex-col gap-6 w-full">
        
        {/* Row 1: List of farms (Table representation) */}
        <div className="bg-white border border-[#E9E9E9] rounded-lg p-5">
          <h3 className="text-sm font-bold text-[#313131] mb-4">Locations Directory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                  <th className="py-3.5 px-4 font-semibold">Farm Name</th>
                  <th className="py-3.5 px-3 font-semibold">Manager</th>
                  <th className="py-3.5 px-3 font-semibold">Operational Type</th>
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
                      <span className="text-[10px] bg-indigo-50/10 text-indigo-650 px-2 py-0.5 rounded font-semibold uppercase">
                        {farm.type}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-[#737373] font-mono flex items-center justify-end gap-1">
                      <MapPin className="w-3 h-3 text-[#EA4335] shrink-0" />
                      <span>{farm.lat.toFixed(4)}, {farm.lng.toFixed(4)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E9E9E9] rounded-lg w-full max-w-md p-6 relative flex flex-col gap-4">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#171717] flex items-center gap-2">
              <Sprout className="w-4 h-4 text-[#EA4335]" />
              Register Property
            </h3>
            
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Farm Name</label>
                <input
                  type="text"
                  placeholder="e.g. Valley Orchard"
                  value={newFarm.name}
                  onChange={(e) => setNewFarm({ ...newFarm, name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Manager name</label>
                <input
                  type="text"
                  placeholder="Johnathan Archer"
                  value={newFarm.manager}
                  onChange={(e) => setNewFarm({ ...newFarm, manager: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1">Operational Type</label>
                <select
                  value={newFarm.type}
                  onChange={(e) => setNewFarm({ ...newFarm, type: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171717] focus:outline-none focus:border-[#EA4335]"
                >
                  <option value="Spice Cultivation">Spice Cultivation</option>
                  <option value="Dry Processing">Dry Processing</option>
                  <option value="Milling & Blending">Milling & Blending</option>
                  <option value="Quality Vault">Quality Vault</option>
                </select>
              </div>

              {/* Mapbox Coordinate Marking Container */}
              <div>
                <label className="block text-[10px] font-semibold text-[#737373] uppercase tracking-wider mb-1.5">Mark Property Area (Mapbox GL)</label>
                <div className="relative w-full h-[180px] border border-slate-200 rounded-lg overflow-hidden">
                  <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
                  
                  {/* Coords Overlay */}
                  <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm border border-slate-200/80 px-2 py-0.5 rounded text-[9px] font-mono text-slate-650 pointer-events-none z-10">
                    {newFarm.lat && newFarm.lng ? `LAT: ${newFarm.lat} / LNG: ${newFarm.lng}` : "NO COORDS MARKED - CLICK MAP"}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  className="w-full h-[40px] btn-3d flex items-center justify-center gap-1.5 active:scale-98 transition-transform cursor-pointer text-white font-bold text-xs"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Register Property</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
