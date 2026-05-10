import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, CircleMarker } from 'react-leaflet';
import { io } from 'socket.io-client';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Truck, Map as MapIcon, Shield, 
  Layers, Navigation, AlertTriangle 
} from 'lucide-react';
import API from '../../config';

// Fix for default marker icons in Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Truck Icon
const createTruckIcon = (heading = 0) => L.divIcon({
  className: 'custom-truck-icon',
  html: `<div style="transform: rotate(${heading}deg); transition: transform 0.5s ease-in-out;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path>
            <path d="M15 18H9"></path>
            <circle cx="7" cy="18" r="2"></circle>
            <path d="M15 18h5a1 1 0 0 0 1-1v-3.5L18.5 10H15"></path>
            <circle cx="17" cy="18" r="2"></circle>
          </svg>
        </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const BARANGAY_COLORS = {
  "Lahug": "#10B981",
  "Apas": "#3B82F6",
  "Guadalupe": "#8B5CF6",
  "Mabolo": "#F59E0B",
  "Talamban": "#EF4444"
};

export default function MasterMap() {
  const [trucks, setTrucks] = useState({});
  const [routes, setRoutes] = useState([]);
  const [reports, setReports] = useState([]);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  
  const boundaries = {
    "Lahug": [[10.320, 123.880], [10.340, 123.880], [10.340, 123.900], [10.320, 123.900]],
    "Apas": [[10.340, 123.900], [10.360, 123.900], [10.360, 123.920], [10.340, 123.920]],
    "Guadalupe": [[10.310, 123.870], [10.330, 123.870], [10.330, 123.890], [10.310, 123.890]]
  };

  useEffect(() => {
    // Initial data fetch
    const fetchData = async () => {
      try {
        const [trucksRes, routesRes, reportsRes] = await Promise.all([
          axios.get(`${API}/api/trucks`),
          axios.get(`${API}/api/routes`),
          axios.get(`${API}/api/reports`)
        ]);
        
        const truckMap = {};
        trucksRes.data.forEach(t => { truckMap[t.truckId] = t; });
        setTrucks(truckMap);
        setRoutes(routesRes.data);
        setReports(reportsRes.data);
      } catch (err) {
        console.error('Failed to fetch map data:', err);
      }
    };
    fetchData();

    // Socket setup for real-time tracking
    const socket = io(API);
    socket.on('truck:location:update', (update) => {
      setTrucks(prev => ({
        ...prev,
        [update.truckId]: { ...prev[update.truckId], ...update }
      }));
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-6 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <MapIcon className="w-7 h-7 text-emerald-500" />
            Master Control Map
          </h2>
          <p className="text-sm text-slate-500 font-medium italic">God-view perspective of all city waste operations</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setShowRoutes(!showRoutes)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${showRoutes ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Navigation className="w-4 h-4" />
            Routes
          </button>
          <button 
            onClick={() => setShowBoundaries(!showBoundaries)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${showBoundaries ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Shield className="w-4 h-4" />
            Boundaries
          </button>
          <button 
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${showHeatmap ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Layers className="w-4 h-4" />
            Heatmap
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-xl relative group">
        <MapContainer 
          center={[10.330, 123.900]} 
          zoom={14} 
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* Jurisdictional Boundaries */}
          {showBoundaries && Object.entries(boundaries).map(([name, poly]) => (
            <Polygon 
              key={name}
              positions={poly} 
              pathOptions={{ 
                color: BARANGAY_COLORS[name] || '#94a3b8', 
                fillOpacity: 0.05, 
                weight: 2,
                dashArray: '5, 10'
              }}
            >
              <Popup>
                <div className="p-1 font-bold">Barangay {name}</div>
              </Popup>
            </Polygon>
          ))}

          {/* Active Routes */}
          {showRoutes && routes.map(route => (
            <Polyline 
              key={route._id}
              positions={route.routeCoords || []}
              pathOptions={{ 
                color: BARANGAY_COLORS[route.barangay] || '#6366f1', 
                weight: 4,
                opacity: 0.6
              }}
            />
          ))}

          {/* Incident Heatmap (CircleMarkers for now) */}
          {showHeatmap && reports.map(report => (
            <CircleMarker 
              key={report._id}
              center={[report.lat, report.lng]}
              radius={8}
              pathOptions={{ 
                fillColor: report.status === 'resolved' ? '#10B981' : '#EF4444',
                fillOpacity: 0.4,
                stroke: false
              }}
            >
              <Popup>
                <div className="p-2 min-w-[150px]">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{report.category}</p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">{report.title}</p>
                  <div className={`mt-2 px-2 py-1 rounded text-[10px] font-bold w-fit uppercase ${
                    report.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {report.status}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Live Trucks */}
          {Object.values(trucks).map(truck => (
            <Marker 
              key={truck.truckId} 
              position={[truck.lat, truck.lng]}
              icon={createTruckIcon(truck.heading)}
            >
              <Popup className="custom-popup">
                <div className="p-3 w-48 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-emerald-50 rounded-xl">
                      <Truck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Unit ID</p>
                      <p className="text-sm font-black text-slate-900">{truck.truckId}</p>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-400 uppercase">Speed</span>
                      <span className="text-slate-900">{Math.round(truck.speed || 0)} km/h</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-400 uppercase">Status</span>
                      <span className="text-emerald-600 uppercase">Live</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Map Legend */}
        <div className="absolute bottom-6 right-6 z-[1000] bg-white/90 backdrop-blur-md border border-slate-200 p-5 rounded-2xl shadow-2xl space-y-4">
          <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live Map Legend
          </h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-slate-600">Active Trucks</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500 opacity-60" />
              <span className="text-xs font-semibold text-slate-600">Planned Routes</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 opacity-40" />
              <span className="text-xs font-semibold text-slate-600">Incident Heatmap</span>
            </div>
          </div>
        </div>

        {/* Fullscreen Tooltip */}
        <div className="absolute top-6 left-6 z-[1000] bg-slate-900/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
          <p className="text-[10px] font-bold text-slate-900 uppercase">Click markers for details</p>
        </div>
      </div>
    </div>
  );
}
