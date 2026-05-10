import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import {
  Route, Trash2, Save, MapPin, Truck, Navigation,
  CheckCircle, AlertCircle, X, RotateCcw, Undo2
} from 'lucide-react';
import API from '../config';
import { useAuth } from '../context/AuthContext';
const ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjQ1N2I3YTYyYzZiMTRjZTc5MjI5OTdhNWI3NTIzY2I1IiwiaCI6Im11cm11cjY0In0=';
const CEBU_CENTER = [10.3157, 123.8854];

const BARANGAY_BOUNDARIES = {
  "Lahug": [
    [10.320, 123.880],
    [10.340, 123.880],
    [10.340, 123.900],
    [10.320, 123.900]
  ],
  "Apas": [
    [10.340, 123.900],
    [10.360, 123.900],
    [10.360, 123.920],
    [10.340, 123.920]
  ],
  "Guadalupe": [
    [10.310, 123.870],
    [10.330, 123.870],
    [10.330, 123.890],
    [10.310, 123.890]
  ]
};

function isInsidePolygon(point, polygon) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Numbered marker for each waypoint
function makeWaypointIcon(n, isFirst, isLast) {
  const bg = isFirst ? '#059669' : isLast ? '#DC2626' : '#2563EB';
  return L.divIcon({
    html: `<div style="background:${bg};color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);">${n}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    className: '',
  });
}

// Attaches a click listener to the map without re-mounting on every render
function MapClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick(e.latlng) });
  return null;
}

async function fetchORSRoute(waypoints) {
  if (waypoints.length < 2) return null;
  try {
    const res = await axios.post(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      { coordinates: waypoints.map(w => [w.lng, w.lat]) },
      { headers: { Authorization: ORS_KEY, 'Content-Type': 'application/json' } },
    );
    const coords = res.data.features?.[0]?.geometry?.coordinates;
    return coords ? coords.map(c => [c[1], c[0]]) : null;
  } catch {
    return null;
  }
}

export default function RouteBuilder() {
  const { official } = useAuth();
  const [waypoints, setWaypoints] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [assignedTruck, setAssignedTruck] = useState('');
  const [fleet, setFleet] = useState([]);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { msg, type: 'success'|'error' }

  // Stable ref so handleMapClick never goes stale
  const waypointsRef = useRef(waypoints);
  useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);

  useEffect(() => {
    axios.get(`${API}/api/fleet`).then(r => setFleet(r.data)).catch(() => {});
    loadSavedRoutes();

    // Keyboard shortcut for Undo (Ctrl+Z)
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadSavedRoutes = async () => {
    try {
      const { data } = await axios.get(`${API}/api/routes`);
      setSavedRoutes(data);
    } catch { /* silent */ }
  };

  // Re-calculate ORS driving route whenever waypoints change
  useEffect(() => {
    if (waypoints.length < 2) { setRouteCoords([]); return; }
    let cancelled = false;
    setRouteLoading(true);
    fetchORSRoute(waypoints).then(coords => {
      if (cancelled) return;
      setRouteCoords(coords || []);
      setRouteLoading(false);
    });
    return () => { cancelled = true; };
  }, [waypoints]);

  const handleUndo = useCallback(() => {
    setWaypoints(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
  }, []);

  const handleMapClick = useCallback((latlng) => {
    // Jurisdiction Check
    const brgy = official?.barangay;
    if (brgy && BARANGAY_BOUNDARIES[brgy]) {
      const isOk = isInsidePolygon([latlng.lat, latlng.lng], BARANGAY_BOUNDARIES[brgy]);
      if (!isOk) {
        setToast({ msg: `Outside ${brgy} jurisdiction!`, type: 'error' });
        return;
      }
    }

    const n = waypointsRef.current.length + 1;
    setWaypoints(prev => [...prev, { lat: latlng.lat, lng: latlng.lng, name: `Stop ${n}` }]);
  }, [official]);

  const removeWaypoint = (idx) => {
    setWaypoints(prev => {
      const next = prev.filter((_, i) => i !== idx);
      // Rename remaining stops to keep numbers sequential
      return next.map((w, i) => ({ ...w, name: `Stop ${i + 1}` }));
    });
  };

  const renameWaypoint = (idx, name) => {
    setWaypoints(prev => prev.map((w, i) => i === idx ? { ...w, name } : w));
  };

  const clearAll = () => {
    setWaypoints([]);
    setRouteCoords([]);
  };

  const handleSave = async () => {
    if (!routeName.trim()) { showToast('Enter a route name.', 'error'); return; }
    if (waypoints.length < 2) { showToast('Add at least 2 waypoints.', 'error'); return; }
    setSaving(true);
    try {
      const truckEntry = fleet.find(f => f.truckId === assignedTruck);
      await axios.post(`${API}/api/routes`, {
        name: routeName.trim(),
        truckId: assignedTruck || null,
        driverName: truckEntry?.driverName || '',
        waypoints,
        routeCoords,
        totalStops: waypoints.length,
      });
      showToast('Route saved successfully!', 'success');
      setRouteName('');
      setAssignedTruck('');
      clearAll();
      loadSavedRoutes();
    } catch {
      showToast('Failed to save route. Check connection.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoute = async (id) => {
    try {
      await axios.delete(`${API}/api/routes/${id}`);
      setSavedRoutes(prev => prev.filter(r => r._id !== id));
    } catch { /* silent */ }
  };

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const n = waypoints.length;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">

      {/* ── Map area ─────────────────────────────── */}
      <div className="flex-1 relative">
        {/* Route calculating badge */}
        {routeLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-white border border-emerald-200 shadow-md rounded-full px-4 py-2 flex items-center gap-2 text-sm text-emerald-700 font-medium">
            <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            Calculating driving route…
          </div>
        )}

        <MapContainer
          center={CEBU_CENTER}
          zoom={14}
          className="w-full h-full"
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution=""
          />
          
          {/* Jurisdiction boundary line */}
          {official?.barangay && BARANGAY_BOUNDARIES[official.barangay] && (
            <Polygon
              positions={BARANGAY_BOUNDARIES[official.barangay]}
              pathOptions={{ 
                color: '#DC2626', 
                fillColor: '#DC2626', 
                fillOpacity: 0.05, 
                weight: 2, 
                dashArray: '8, 8' 
              }}
            />
          )}

          <MapClickHandler onClick={handleMapClick} />

          {/* Waypoint markers */}
          {waypoints.map((wp, i) => (
            <Marker
              key={i}
              position={[wp.lat, wp.lng]}
              icon={makeWaypointIcon(i + 1, i === 0, i === n - 1)}
            />
          ))}

          {/* ORS driving route polyline */}
          {routeCoords.length > 0 && (
            <Polyline
              positions={routeCoords}
              color="#059669"
              weight={5}
              opacity={0.82}
            />
          )}
        </MapContainer>

        {/* Click hint overlay when no waypoints */}
        {waypoints.length === 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[400] bg-slate-900/80 backdrop-blur-sm text-white text-sm rounded-xl px-5 py-3 flex items-center gap-2 pointer-events-none">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            Click anywhere on the map to place stops
          </div>
        )}
      </div>

      {/* ── Control panel ────────────────────────── */}
      <div className="w-[320px] bg-white border-l border-slate-200 flex flex-col overflow-hidden shadow-sm">

        {/* Panel header */}
        <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Route className="w-4 h-4 text-emerald-700" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Route Builder</h2>
          </div>
          <p className="text-xs text-slate-500 ml-10">Click the map to place collection stops</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Route name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Route Name
            </label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="e.g. Lahug North – Morning Run"
              value={routeName}
              onChange={e => setRouteName(e.target.value)}
            />
          </div>

          {/* Assign to truck */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Assign to Truck
            </label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition"
              value={assignedTruck}
              onChange={e => setAssignedTruck(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {fleet.map(f => (
                <option key={f.truckId} value={f.truckId}>
                  {f.truckId} · {f.driverName}
                </option>
              ))}
            </select>
          </div>

          {/* Waypoints list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Waypoints ({n})
              </span>
              {n > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleUndo}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <Undo2 className="w-3 h-3" /> Undo
                  </button>
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear all
                  </button>
                </div>
              )}
            </div>

            {n === 0 ? (
              <div className="flex flex-col items-center py-7 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                <Navigation className="w-7 h-7 mb-2 opacity-30" />
                <p className="text-sm">No stops added yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {waypoints.map((wp, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 group">
                    {/* Number badge */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: i === 0 ? '#059669' : i === n - 1 ? '#DC2626' : '#2563EB' }}
                    >
                      {i + 1}
                    </div>
                    {/* Editable name */}
                    <input
                      className="flex-1 text-sm text-slate-700 bg-transparent border-none outline-none min-w-0"
                      value={wp.name}
                      onChange={e => renameWaypoint(i, e.target.value)}
                    />
                    <button
                      onClick={() => removeWaypoint(i)}
                      className="text-slate-300 hover:text-red-500 flex-shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || n < 2 || !routeName.trim()}
            className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-colors shadow-sm"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Save className="w-4 h-4" />
            }
            {saving ? 'Saving…' : 'Save Route'}
          </button>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Saved routes */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              Saved Routes ({savedRoutes.length})
            </h3>
            {savedRoutes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-5">No routes saved yet</p>
            ) : (
              <div className="space-y-2">
                {savedRoutes.map(r => (
                  <div key={r._id} className="bg-slate-50 hover:bg-slate-100 rounded-xl p-3.5 transition-colors group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{r.name}</p>
                      <button
                        onClick={() => handleDeleteRoute(r._id)}
                        className="text-slate-300 hover:text-red-500 flex-shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {r.totalStops} stops
                      </span>
                      {r.truckId ? (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <Truck className="w-3 h-3" />
                          {r.truckId}
                          {r.driverName ? ` · ${r.driverName}` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Toast notification */}
        {toast && (
          <div
            className={`mx-4 mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium flex-shrink-0 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {toast.type === 'success'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />
            }
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}
