import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Home, ZoomIn, MapPin } from 'lucide-react';

mapboxgl.accessToken = 'pk.eyJ1Ijoid2F5bmV4IiwiYSI6ImNtcmltcDNsOTBkNHAyd3NjZ3UzbDNlMTIifQ.XMWtUsdyyok9RmDXXOxIjA';

interface MapRouteViewProps {
  searchQuery?: string;
}

export default function MapRouteView({ searchQuery = '' }: MapRouteViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Registered properties data
  const farms = [
    { id: 'F-1', name: 'Emerald Valley Ginger Hub', manager: 'John Doe', type: 'Spice Cultivation', lat: 4.824, lng: 7.012, state: 'Rivers State, Nigeria' },
    { id: 'F-2', name: 'Westland Organic Chili Fields', manager: 'Sarah Connor', type: 'Spice Cultivation', lat: 5.123, lng: 6.945, state: 'Imo State, Nigeria' },
  ];

  const filteredFarms = farms.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.manager.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Mapbox map instance centered on general farms area
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [6.98, 4.97], // Midpoint coordinates
      zoom: 8.5,
    });

    mapRef.current = map;

    // Add controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Setup ResizeObserver to trigger map.resize() whenever the container width changes
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    // Add markers for each farm
    farms.forEach((farm) => {
      // Create popup
      const popup = new mapboxgl.Popup({ 
        offset: 38,
        closeButton: false,
        closeOnClick: false 
      })
        .setHTML(`
          <div class="p-2 font-sans min-w-[140px]">
            <h4 class="text-xs font-bold text-[#171717]">${farm.name}</h4>
            <p class="text-[10px] text-[#737373] mt-0.5">Manager: ${farm.manager}</p>
            <p class="text-[9px] text-[#737373] mt-0.5">${farm.state}</p>
            <p class="text-[9px] bg-slate-100 text-slate-650 px-1.5 py-0.5 rounded inline-block uppercase mt-1.5 font-bold">${farm.type}</p>
          </div>
        `);

      // Add default marker
      const marker = new mapboxgl.Marker()
        .setLngLat([farm.lng, farm.lat])
        .setPopup(popup)
        .addTo(map);

      const markerEl = marker.getElement();
      markerEl.style.cursor = 'pointer';

      // Bind hover events
      markerEl.addEventListener('mouseenter', () => {
        if (!popup.isOpen()) {
          marker.togglePopup();
        }
      });
      markerEl.addEventListener('mouseleave', () => {
        if (popup.isOpen()) {
          marker.togglePopup();
        }
      });

      markersRef.current.push(marker);
    });

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const locateFarm = (lng: number, lat: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 12,
        essential: true,
      });
    }
  };

  return (
    <div className="space-y-6 text-[#171717]">
      <div>
        <h2 className="text-xl font-bold text-[#171717]">Properties Map</h2>
        <p className="text-xs text-[#737373]">Locate registered properties, farm lands, and facilities across the ecosystem using Mapbox GL.</p>
      </div>

      <div className="flex flex-col gap-6 w-full">
        
        {/* Map Viewport Card */}
        <div className="bg-white border border-[#E9E9E9] rounded-lg overflow-hidden flex flex-col h-[400px]">
          {/* Canvas Map Container */}
          <div className="flex-1 relative bg-slate-50">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
          </div>
        </div>

        {/* Properties Directory List */}
        <div className="bg-white border border-[#E9E9E9] rounded-lg p-5">
          <h3 className="text-sm font-bold text-[#313131] flex items-center gap-2 mb-4">
            <Home className="w-4 h-4 text-[#EA4335]" />
            Registered Locations Index
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F2F2F2] border-b border-[#E9E9E9] text-[#313131]">
                  <th className="py-3.5 px-4 font-semibold">Farm Property</th>
                  <th className="py-3.5 px-3 font-semibold">Manager</th>
                  <th className="py-3.5 px-3 font-semibold">Operational Type</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E9]">
                {filteredFarms.map((farm) => (
                  <tr key={farm.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 flex items-center gap-2.5">
                      <MapPin className="w-3.5 h-3.5 text-[#EA4335]" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#313131]">{farm.name}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">{farm.state}</span>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-[#737373] font-medium">{farm.manager}</td>
                    <td className="py-4 px-3">
                      <span className="text-[10px] bg-indigo-50/10 text-indigo-650 px-2 py-0.5 rounded font-semibold uppercase">
                        {farm.type}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => locateFarm(farm.lng, farm.lat)}
                        className="btn-3d h-7 px-3 text-white text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer ml-auto"
                      >
                        <ZoomIn className="w-3 h-3 text-white" />
                        <span>Locate</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
