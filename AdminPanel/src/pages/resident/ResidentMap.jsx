import 'leaflet/dist/leaflet.css';
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  CheckCircle2, Clock, Circle, Navigation2, Key,
  Truck, MapPin, Info, TrendingUp,
} from 'lucide-react';
import StatusBadge from '../../components/shared/StatusBadge';
import { barangayRoutes } from '../../data/mockData';

// ── ORS routing ─────────────────────────────────────────────────────────────
const ORS_KEY = import.meta.env.VITE_ORS_API_KEY;
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

async function fetchOrsRoute(stops) {
  if (!ORS_KEY) return null;
  // ORS expects [longitude, latitude]
  const coordinates = stops.map(s => [s.coords[1], s.coords[0]]);
  const res = await fetch(ORS_URL, {
    method: 'POST',
    headers: {
      Authorization: ORS_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/geo+json',
    },
    body: JSON.stringify({ coordinates, instructions: false }),
  });
  if (!res.ok) throw new Error(`ORS ${res.status}`);
  const json = await res.json();
  const feat = json.features[0];
  return {
    // Convert back to [lat, lng] for Leaflet
    coords: feat.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: (feat.properties.summary.distance / 1000).toFixed(1),
    durationMin: Math.round(feat.properties.summary.duration / 60),
  };
}

// ── Custom Leaflet icons ─────────────────────────────────────────────────────
const stopStyles = {
  completed:    { bg: '#10b981', border: '#059669', color: '#fff' },
  'in-progress':{ bg: '#f59e0b', border: '#d97706', color: '#fff' },
  pending:      { bg: '#e2e8f0', border: '#94a3b8', color: '#64748b' },
  depot:        { bg: '#1e293b', border: '#334155', color: '#fff' },
};

function stopIcon(status, label) {
  const s = stopStyles[status] ?? stopStyles.pending;
  const content = status === 'completed' ? '✓' : label;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px;height:30px;
      background:${s.bg};border:2.5px solid ${s.border};
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      font-size:${status === 'completed' ? '15px' : '11px'};
      font-weight:700;color:${s.color};
      box-shadow:0 2px 8px rgba(0,0,0,0.28);cursor:pointer;
    ">${content}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

function truckIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:40px;height:40px;
      background:#1e293b;border:3px solid ${color};
      border-radius:10px;display:flex;align-items:center;justify-content:center;
      font-size:20px;
      box-shadow:0 0 0 6px ${color}40,0 4px 14px rgba(0,0,0,0.4);
    ">🚛</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
}

// ── Helper: fly map to new center ────────────────────────────────────────────
function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.3 });
  }, []); // intentionally run only on mount (key change triggers remount)
  return null;
}

// ── Stop status icon map ─────────────────────────────────────────────────────
const stopIconCfg = {
  completed:    { Icon: CheckCircle2, cls: 'text-emerald-500' },
  'in-progress':{ Icon: Clock,        cls: 'text-amber-500 animate-pulse' },
  pending:      { Icon: Circle,       cls: 'text-slate-300' },
  depot:        { Icon: Navigation2,  cls: 'text-slate-400' },
};

// ── Popup content (inline styles to avoid Tailwind/Leaflet conflicts) ─────────
function StopPopup({ stop, index }) {
  const statusColors = { completed: '#059669', 'in-progress': '#d97706', pending: '#94a3b8', depot: '#475569' };
  return (
    <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 170 }}>
      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
        Stop {index + 1}: {stop.name}
      </p>
      <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0' }}>
        Status:{' '}
        <strong style={{ color: statusColors[stop.status] ?? '#64748b', textTransform: 'capitalize' }}>
          {stop.status.replace('-', ' ')}
        </strong>
      </p>
      <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0' }}>Scheduled: {stop.time}</p>
      <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0', textTransform: 'capitalize' }}>
        Type: {stop.type}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ResidentMap() {
  const [selectedKey, setSelectedKey] = useState('lahug');
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [orsUsed, setOrsUsed] = useState(false);

  const route = barangayRoutes[selectedKey];

  // Fetch road-following route from ORS (or fall back to straight lines)
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setRouteInfo(null);
      setOrsUsed(false);
      try {
        const data = await fetchOrsRoute(route.stops);
        if (!alive) return;
        if (data) {
          setRouteCoords(data.coords);
          setRouteInfo({ distance: data.distanceKm, duration: data.durationMin });
          setOrsUsed(true);
        } else {
          // No API key — straight-line fallback
          setRouteCoords(route.stops.map(s => s.coords));
        }
      } catch {
        if (alive) setRouteCoords(route.stops.map(s => s.coords));
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [selectedKey]);

  // Current truck position = last in-progress or last completed stop
  const truckStop =
    route.stops.find(s => s.status === 'in-progress') ??
    [...route.stops].reverse().find(s => s.status === 'completed') ??
    route.stops[0];

  const completedCount = route.stops.filter(s => s.status === 'completed').length;
  const totalStops = route.stops.length;
  const pct = Math.round((completedCount / totalStops) * 100);

  return (
    <div className="flex h-full min-h-0">

      {/* ─── Left Info Panel ─────────────────────────────────────────────── */}
      <div className="w-80 shrink-0 bg-white border-r border-slate-100 flex flex-col overflow-hidden">

        {/* Barangay Selector */}
        <div className="p-5 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Select Barangay
          </p>
          <div className="space-y-2">
            {Object.entries(barangayRoutes).map(([key, r]) => {
              const done = r.stops.filter(s => s.status === 'completed').length;
              const isActive = key === selectedKey;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left
                    ${isActive
                      ? 'border-slate-700 bg-slate-50 shadow-sm'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: r.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Brgy. {r.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{done}/{r.stops.length} stops done</p>
                  </div>
                  <StatusBadge status={r.truck.status} size="xs" showDot />
                </button>
              );
            })}
          </div>
        </div>

        {/* Truck Info */}
        <div className="p-5 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Active Truck
          </p>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-xl shrink-0">
              🚛
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">{route.truck.id}</p>
              <p className="text-xs text-slate-400 truncate">{route.truck.driver}</p>
            </div>
            <StatusBadge status={route.truck.status} size="xs" showDot />
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500">Route progress</span>
              <span className="font-semibold text-slate-700">{completedCount}/{totalStops} stops · {pct}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: route.color }}
              />
            </div>
          </div>

          {/* ORS route info */}
          {routeInfo ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-base font-bold text-slate-800">{routeInfo.distance} km</p>
                <p className="text-xs text-slate-400 mt-0.5">Road distance</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-base font-bold text-slate-800">~{routeInfo.duration} min</p>
                <p className="text-xs text-slate-400 mt-0.5">Est. duration</p>
              </div>
            </div>
          ) : !loading && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {ORS_KEY
                  ? 'Route data unavailable — showing straight-line path'
                  : 'Straight-line preview. Add VITE_ORS_API_KEY for real road routes.'}
              </span>
            </div>
          )}
        </div>

        {/* Collection Stops List */}
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Collection Stops
          </p>
          <ol className="space-y-0">
            {route.stops.map((stop, i) => {
              const cfg = stopIconCfg[stop.status] ?? stopIconCfg.pending;
              const { Icon } = cfg;
              const isLast = i === route.stops.length - 1;
              return (
                <li key={stop.id} className="flex items-start gap-3">
                  {/* Icon + connector line */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-5 h-5 flex items-center justify-center mt-0.5 ${cfg.cls}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {!isLast && (
                      <div className="w-px flex-1 min-h-6 bg-slate-100 my-1" />
                    )}
                  </div>

                  {/* Stop details */}
                  <div className={`flex-1 min-w-0 pb-4 ${isLast ? '' : ''}`}>
                    <div
                      className={`flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl transition-colors
                        ${stop.status === 'in-progress' ? 'bg-amber-50 border border-amber-100' : 'hover:bg-slate-50'}`}
                    >
                      <div className="min-w-0">
                        <p className={`text-sm font-medium leading-snug ${stop.status === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>
                          {i + 1}. {stop.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> {stop.time}
                          <span className="text-slate-200">·</span>
                          <span className="capitalize">{stop.type}</span>
                        </p>
                      </div>
                      {stop.status === 'in-progress' && (
                        <span className="shrink-0 text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                          Now
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* ─── Map Area ────────────────────────────────────────────────────── */}
      <div className="flex-1 relative min-w-0">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-3 bg-white rounded-2xl shadow-xl px-6 py-3.5 border border-slate-100">
              <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold text-slate-700">Calculating route…</span>
            </div>
          </div>
        )}

        <MapContainer
          center={[10.3157, 123.8854]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          {/* CartoDB Voyager — clean road-visible basemap */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            maxZoom={20}
          />

          {/* Fly to selected barangay — key forces remount on barangay change */}
          <FlyTo key={selectedKey} center={route.center} zoom={route.zoom} />

          {/* Route polyline */}
          {routeCoords && (
            <Polyline
              key={`route-${selectedKey}`}
              positions={routeCoords}
              pathOptions={{
                color: route.color,
                weight: 5,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
                // Dashed only when using fallback straight lines
                dashArray: orsUsed ? undefined : '10 6',
              }}
            />
          )}

          {/* Collection stop markers */}
          {route.stops.map((stop, i) => (
            <Marker
              key={`${selectedKey}-stop-${stop.id}`}
              position={stop.coords}
              icon={stopIcon(stop.status, i + 1)}
            >
              <Popup>
                <StopPopup stop={stop} index={i} />
              </Popup>
            </Marker>
          ))}

          {/* Truck position marker */}
          {truckStop && (
            <Marker
              key={`${selectedKey}-truck`}
              position={truckStop.coords}
              icon={truckIcon(route.color)}
              zIndexOffset={1000}
            >
              <Popup>
                <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 170 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                    🚛 {route.truck.id}
                  </p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0' }}>
                    Driver: {route.truck.driver}
                  </p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0', textTransform: 'capitalize' }}>
                    Status: {route.truck.status.replace('-', ' ')}
                  </p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0' }}>
                    Last stop: {truckStop.name}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* ─ Legend ─ */}
        <div className="absolute bottom-6 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-100 p-4 min-w-40">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Legend</p>
          <div className="space-y-2">
            {[
              { color: '#10b981', label: 'Completed' },
              { color: '#f59e0b', label: 'In progress' },
              { color: '#e2e8f0', label: 'Pending' },
              { color: '#1e293b', label: 'Truck position' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-slate-600">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100 mt-1">
              <div
                className="h-0.5 w-5 rounded shrink-0"
                style={{ backgroundColor: route.color }}
              />
              <span className="text-xs text-slate-600">
                {orsUsed ? 'Road route (ORS)' : 'Route (straight line)'}
              </span>
            </div>
          </div>
        </div>

        {/* ─ ORS key notice — only shown when key is missing ─ */}
        {!ORS_KEY && !loading && (
          <div className="absolute top-4 right-4 z-10 max-w-72">
            <div className="bg-white/95 backdrop-blur-sm border border-amber-200 rounded-2xl shadow-lg p-4">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <Key className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">No ORS API key</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Route shown as straight lines. For real road-following routes, create{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">AdminPanel/.env</code>{' '}
                    and add:
                  </p>
                  <code className="block mt-2 text-xs bg-slate-100 text-slate-700 rounded-lg px-3 py-2 font-mono">
                    VITE_ORS_API_KEY=your_key
                  </code>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Free key at{' '}
                    <span className="text-violet-600 font-medium">openrouteservice.org</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─ ORS success badge ─ */}
        {orsUsed && !loading && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-emerald-200 rounded-full px-3 py-1.5 shadow-sm">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">Road route via ORS</span>
          </div>
        )}
      </div>
    </div>
  );
}
