import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, CircleMarker } from 'react-leaflet';
import { io } from 'socket.io-client';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Truck, Map as MapIcon, Shield,
  Layers, Navigation, AlertTriangle, Wifi
} from 'lucide-react';
import API from '../../config';
import truckIconImg from '../../../assets/truck-icon.png';

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

// Custom Truck Icon using the PNG asset
const createTruckIcon = () => L.divIcon({
  className: 'custom-truck-icon',
  html: `<div style="transition: transform 0.4s ease-out;">
          <img src="${truckIconImg}" style="width: 42px; height: 42px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));" />
        </div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21]
});

const BARANGAY_COLORS = {
  "Lahug": "#10B981",
  "Apas": "#3B82F6",
  "Guadalupe": "#8B5CF6",
  "Mabolo": "#F59E0B",
  "Talamban": "#EF4444"
};

const CEBU_CITY_OUTLINE = [
  [10.4215, 123.8572], [10.4198, 123.8712], [10.4148, 123.8825],
  [10.4062, 123.8945], [10.3945, 123.9068], [10.3835, 123.9152],
  [10.3712, 123.9212], [10.3582, 123.9248], [10.3448, 123.9232],
  [10.3318, 123.9195], [10.3188, 123.9148], [10.3062, 123.9085],
  [10.2945, 123.9025], [10.2828, 123.8962], [10.2712, 123.8885],
  [10.2598, 123.8798], [10.2492, 123.8698], [10.2395, 123.8595],
  [10.2302, 123.8478], [10.2225, 123.8352], [10.2168, 123.8218],
  [10.2142, 123.8072], [10.2148, 123.7928], [10.2188, 123.7802],
  [10.2268, 123.7702], [10.2385, 123.7638], [10.2525, 123.7602],
  [10.2678, 123.7598], [10.2835, 123.7632], [10.2988, 123.7702],
  [10.3128, 123.7782], [10.3262, 123.7868], [10.3395, 123.7968],
  [10.3528, 123.8058], [10.3658, 123.8152], [10.3788, 123.8252],
  [10.3908, 123.8358], [10.4015, 123.8452], [10.4108, 123.8512],
  [10.4215, 123.8572],
];

async function fetchCebuCityBoundary() {
  try {
    const query = `[out:json][timeout:15];relation["name"="Cebu City"]["admin_level"~"^[67]$"];out geom;`;
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const rel = data.elements?.[0];
    if (!rel?.members) return null;
    const outer = rel.members.filter(m => m.type === 'way' && m.role === 'outer');
    const coords = outer.flatMap(m => (m.geometry || []).map(pt => [pt.lat, pt.lon]));
    return coords.length > 3 ? coords : null;
  } catch {
    return null;
  }
}

export default function MasterMap() {
  const [trucks, setTrucks] = useState({});
  const [routes, setRoutes] = useState([]);
  const [reports, setReports] = useState([]);
  const [garbageAreas, setGarbageAreas] = useState([]);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showCityBoundary, setShowCityBoundary] = useState(true);
  const [cebuCityBoundary, setCebuCityBoundary] = useState(CEBU_CITY_OUTLINE);
  const [dbBoundaries, setDbBoundaries] = useState([]);
  const [isSatellite, setIsSatellite] = useState(false);
  
  const boundaries = {
    "Lahug": [[10.320, 123.880], [10.340, 123.880], [10.340, 123.900], [10.320, 123.900]],
    "Apas": [[10.340, 123.900], [10.360, 123.900], [10.360, 123.920], [10.340, 123.920]],
    "Guadalupe": [[10.310, 123.870], [10.330, 123.870], [10.330, 123.890], [10.310, 123.890]]
  };

  useEffect(() => {
    fetchCebuCityBoundary().then(coords => { if (coords) setCebuCityBoundary(coords); });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trucksRes, routesRes, reportsRes, boundariesRes, areasRes] = await Promise.all([
          axios.get(`${API}/api/trucks`),
          axios.get(`${API}/api/routes`),
          axios.get(`${API}/api/reports`),
          axios.get(`${API}/api/barangays/boundaries`),
          axios.get(`${API}/api/garbage-areas`),
        ]);
        const truckMap = {};
        trucksRes.data.forEach(t => { truckMap[t.truckId] = t; });
        setTrucks(truckMap);
        setRoutes(routesRes.data);
        setReports(reportsRes.data.filter(r => r.lat && r.lng));
        setDbBoundaries(boundariesRes.data);
        setGarbageAreas(areasRes.data);
      } catch (err) {
        console.error('Failed to fetch map data:', err);
      }
    };
    fetchData();

    const socket = io(API);
    socket.on('truck:location:update', (update) => {
      setTrucks(prev => ({
        ...prev,
        [update.truckId]: { ...prev[update.truckId], ...update },
      }));
    });
    socket.on('garbage-area:updated', (area) => {
      setGarbageAreas(prev => {
        const idx = prev.findIndex(a => a._id === area._id);
        return idx >= 0 ? prev.map((a, i) => (i === idx ? area : a)) : [...prev, area];
      });
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-6 animate-in fade-in duration-700">
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
            onClick={() => setShowReports(!showReports)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${showReports ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <AlertTriangle className="w-4 h-4" />
            Incident Reports
          </button>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${showHeatmap ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Wifi className="w-4 h-4" />
            IoT Heatmap
          </button>

          <div className="w-px h-6 bg-slate-200 mx-1" />
          
          <button
            onClick={() => setShowCityBoundary(!showCityBoundary)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${showCityBoundary ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Layers className="w-4 h-4" />
            City Outline
          </button>

          <button
            onClick={() => setIsSatellite(!isSatellite)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${isSatellite ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <MapIcon className="w-4 h-4" />
            {isSatellite ? 'Satellite' : 'Standard'}
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
          {isSatellite ? (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            />
          ) : (
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
          )}

          {/* Jurisdictional Boundaries */}
          {showBoundaries && dbBoundaries.map(db => (
            <Polygon 
              key={db._id}
              positions={db.boundary} 
              pathOptions={{ 
                color: db.color || '#3B82F6', 
                fillOpacity: 0.05, 
                weight: 2,
                dashArray: '5, 10'
              }}
            >
              <Popup>
                <div className="p-1 font-bold">Barangay {db.barangay}</div>
              </Popup>
            </Polygon>
          ))}

          {/* Active Routes — prefer routeCoords, fall back to waypoints */}
          {showRoutes && routes.map(route => {
            const coords = route.routeCoords?.length > 1
              ? route.routeCoords
              : route.waypoints?.length >= 2
                ? route.waypoints.map(wp => [wp.lat, wp.lng])
                : null;
            if (!coords) return null;
            return (
              <Polyline
                key={route._id}
                positions={coords}
                pathOptions={{
                  color: BARANGAY_COLORS[route.barangay] || '#6366f1',
                  weight: 4,
                  opacity: 0.6,
                }}
              />
            );
          })}

          {/* Incident Reports */}
          {showReports && reports.map(report => (
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

          {/* Cebu City Boundary */}
          {showCityBoundary && cebuCityBoundary.length > 2 && (
            <Polyline
              positions={cebuCityBoundary}
              pathOptions={{ color: '#2563EB', weight: 2, opacity: 0.55, dashArray: '10, 7' }}
            />
          )}

          {/* IoT Air Quality Heatmap */}
          {showHeatmap && garbageAreas.map(area => {
            const color = area.status === 'critical' ? '#E53935' : area.status === 'moderate' ? '#FDD835' : '#4CAF50';
            const fillOp = area.status === 'critical' ? 0.35 : area.status === 'moderate' ? 0.25 : 0.15;
            const radius = 180 + Math.round((area.intensity || 0.5) * 120);
            return (
              <CircleMarker
                key={area._id}
                center={[area.lat, area.lng]}
                radius={12}
                pathOptions={{ color, fillColor: color, fillOpacity: fillOp, weight: 2, opacity: 0.8 }}
              >
                <Popup>
                  <div className="p-2 min-w-[140px]">
                    <p className="text-sm font-bold text-slate-900">{area.name}</p>
                    <p className="text-[10px] font-bold uppercase mt-0.5" style={{ color }}>{area.status}</p>
                    {area.barangay && <p className="text-[10px] text-slate-400 mt-1">Brgy. {area.barangay}</p>}
                    <div className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                      <p>NH₃: {area.ammonia || 'N/A'}</p>
                      <p>CH₄: {area.methane || 'N/A'}</p>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Live Trucks — only render when lat/lng are valid */}
          {Object.values(trucks).filter(t => t.lat && t.lng).map(truck => (
            <Marker
              key={truck.truckId}
              position={[truck.lat, truck.lng]}
              icon={createTruckIcon()}
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
              <div className="w-3 h-3 rounded-full bg-indigo-500 opacity-60" />
              <span className="text-xs font-semibold text-slate-600">Planned Routes</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 opacity-40" />
              <span className="text-xs font-semibold text-slate-600">Incident Reports</span>
            </div>
            <div className="border-t border-slate-100 pt-2 mt-1 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IoT Air Quality</p>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs font-semibold text-slate-600">Critical</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="text-xs font-semibold text-slate-600">Moderate</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs font-semibold text-slate-600">Clean</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-0 border-t-2 border-blue-600 border-dashed" />
              <span className="text-xs font-semibold text-slate-600">City Boundary</span>
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
