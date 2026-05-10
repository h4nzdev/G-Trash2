import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import axios from 'axios';
import { RefreshCw, Truck, MapPin, Navigation, UserPlus, X, Check, AlertCircle, AlertTriangle, Phone, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import API from '../config';
import truckIconUrl from '../../assets/truck-icon.png';
const CEBU_CENTER = [10.3157, 123.8854];

function makeTruckIcon(status) {
  const isOnline = status === 'online';
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;${isOnline ? '' : 'opacity:0.55;'}">
      <div style="background:#fff;border-radius:12px;padding:4px;box-shadow:0 3px 12px rgba(0,0,0,0.22);border:2.5px solid ${isOnline ? '#059669' : '#94a3b8'};${isOnline ? '' : 'filter:grayscale(100%);'}">
        <img src="${truckIconUrl}" style="width:38px;height:38px;object-fit:contain;display:block;" />
      </div>
    </div>`,
    iconSize: [46, 50],
    iconAnchor: [23, 50],
    className: '',
  });
}

function makeStopIcon(n, isFirst, isLast) {
  const bg = isFirst ? '#059669' : isLast ? '#DC2626' : '#64748b';
  return L.divIcon({
    html: `<div style="background:${bg};color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.25);">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    className: '',
  });
}

// ── Assign Truck Modal ─────────────────────────────────────
function AssignModal({ route, fleet, onClose, onSave }) {
  const current = fleet.find(f => f.truckId === route.truckId);
  const [selectedTruckId, setSelectedTruckId] = useState(route.truckId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!selectedTruckId) { setError('Select a truck to assign.'); return; }
    const fleetEntry = fleet.find(f => f.truckId === selectedTruckId);
    setSaving(true);
    setError('');
    try {
      const { data } = await axios.patch(`${API}/api/routes/${route._id}`, {
        truckId: selectedTruckId,
        driverName: fleetEntry?.driverName || '',
      });
      onSave(data);
    } catch {
      setError('Failed to assign. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async () => {
    setSaving(true);
    try {
      const { data } = await axios.patch(`${API}/api/routes/${route._id}`, {
        truckId: null,
        driverName: '',
      });
      onSave(data);
    } catch {
      setError('Failed to unassign. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Assign Truck Driver</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]">{route.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Route info */}
          <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Navigation className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">Route</p>
              <p className="text-sm font-bold text-slate-800 truncate">{route.name}</p>
              <p className="text-xs text-slate-400">{route.totalStops} stops</p>
            </div>
          </div>

          {/* Current assignment */}
          {current && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              Currently assigned to <span className="font-bold text-slate-700">{current.truckId} · {current.driverName}</span>
            </div>
          )}

          {/* Truck selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Truck / Driver</label>
            <select
              value={selectedTruckId}
              onChange={e => setSelectedTruckId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-700"
            >
              <option value="">— Select a truck —</option>
              {fleet.map(f => (
                <option key={f.truckId} value={f.truckId}>
                  {f.truckId} · {f.driverName}{f.route ? ` (${f.route})` : ''}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />{error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          {route.truckId && (
            <button
              onClick={handleUnassign}
              disabled={saving}
              className="px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Unassign
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedTruckId}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-colors"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Check className="w-4 h-4" />
            }
            {saving ? 'Saving…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────
export default function RouteMonitoring() {
  const { official } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [trucks, setTrucks] = useState({});
  const [fleet, setFleet] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null); // route to assign
  const [loading, setLoading] = useState(true);
  const [deviationAlerts, setDeviationAlerts] = useState([]);
  const [isSatellite, setIsSatellite] = useState(false);
  const socketRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [routesRes, trucksRes, fleetRes] = await Promise.all([
        axios.get(`${API}/api/routes`),
        axios.get(`${API}/api/trucks`),
        axios.get(`${API}/api/fleet`),
      ]);
      setRoutes(routesRes.data);
      const truckMap = {};
      trucksRes.data.forEach(t => { truckMap[t.truckId] = t; });
      setTrucks(truckMap);
      setFleet(fleetRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();

    const socket = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('truck:location:update', data => {
      setTrucks(prev => ({ ...prev, [data.truckId]: { ...prev[data.truckId], ...data, updatedAt: new Date() } }));
    });
    socket.on('truck:status', data => {
      setTrucks(prev => ({ ...prev, [data.truckId]: { ...prev[data.truckId], status: data.status } }));
    });
    socket.on('route:updated', updated => {
      setRoutes(prev => prev.map(r => r._id === updated._id ? updated : r));
    });
    socket.on('truck:off-route', data => {
      setDeviationAlerts(prev =>
        [{ ...data, id: Date.now(), ts: new Date(), type: 'off-route' }, ...prev].slice(0, 5)
      );
    });
    socket.on('truck:contact-dispatch', data => {
      setDeviationAlerts(prev =>
        [{ ...data, id: Date.now(), ts: new Date(), type: 'contact' }, ...prev].slice(0, 5)
      );
    });

    return () => socket.disconnect();
  }, []);

  const handleAssignSave = (updatedRoute) => {
    setRoutes(prev => prev.map(r => r._id === updatedRoute._id ? updatedRoute : r));
    if (selectedRoute?._id === updatedRoute._id) setSelectedRoute(updatedRoute);
    setAssignTarget(null);
  };

  // All routes with a polyline (can be on map)
  const mappableRoutes = routes.filter(r => r.routeCoords?.length > 0);
  const onlineCt = Object.values(trucks).filter(t => t.status === 'online').length;
  const assignedCt = routes.filter(r => r.truckId).length;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="px-6 pt-6 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold text-slate-700">Route Monitoring</span>
          {official?.barangay !== 'All' && (
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
              Brgy. {official?.barangay}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />{onlineCt} Online
          </span>
          <span className="flex items-center gap-1.5 text-slate-500 font-medium">
            <Navigation className="w-3.5 h-3.5" /> {assignedCt}/{routes.length} Assigned
          </span>
          <button onClick={fetchData} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Deviation / dispatch alerts */}
      {deviationAlerts.length > 0 && (
        <div className="px-6 pb-2 space-y-2">
          {deviationAlerts.map(alert => {
            const isContact = alert.type === 'contact';
            return (
              <div
                key={alert.id}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                  isContact
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                {isContact
                  ? <Phone className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${isContact ? 'text-blue-800' : 'text-amber-800'}`}>
                    {isContact ? 'Dispatch Request' : 'Off Route Alert'} — {alert.truckId}
                  </p>
                  <p className={`text-xs ${isContact ? 'text-blue-600' : 'text-amber-600'}`}>
                    {alert.driverName && `${alert.driverName} · `}
                    {isContact
                      ? alert.message
                      : `~${alert.distanceM}m from assigned route`
                    }
                    {' · '}{new Date(alert.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button
                  onClick={() => setDeviationAlerts(prev => prev.filter(a => a.id !== alert.id))}
                  className={`flex-shrink-0 ${isContact ? 'text-blue-400 hover:text-blue-600' : 'text-amber-400 hover:text-amber-600'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 px-6 pb-6 flex flex-col gap-4 min-h-0">

        {/* Map */}
        <div className="flex-1 min-h-[400px] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-500">Loading map data…</p>
              </div>
            </div>
          ) : (
            <>
            <MapContainer center={CEBU_CENTER} zoom={13} className="w-full h-full" zoomControl>
              <TileLayer
                key={isSatellite ? 'satellite' : 'street'}
                url={isSatellite
                  ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                  : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
                }
                attribution=""
              />

              {mappableRoutes.map(route => {
                const isSelected = selectedRoute?._id === route._id;
                const hasDriver = !!route.truckId;
                return (
                  <span key={route._id}>
                    <Polyline
                      positions={route.routeCoords}
                      color={isSelected ? '#059669' : hasDriver ? '#3b82f6' : '#94a3b8'}
                      weight={isSelected ? 5 : 3}
                      opacity={isSelected ? 0.9 : 0.55}
                      eventHandlers={{ click: () => setSelectedRoute(isSelected ? null : route) }}
                    />
                    {isSelected && route.waypoints.map((wp, i) => (
                      <Marker
                        key={i}
                        position={[wp.lat, wp.lng]}
                        icon={makeStopIcon(i + 1, i === 0, i === route.waypoints.length - 1)}
                      >
                        <Tooltip permanent={false} direction="top" offset={[0, -14]}>{wp.name}</Tooltip>
                      </Marker>
                    ))}
                  </span>
                );
              })}

              {Object.values(trucks).filter(t => t.lat && t.lng).map(truck => (
                <Marker key={truck.truckId} position={[truck.lat, truck.lng]} icon={makeTruckIcon(truck.status)}>
                  <Tooltip direction="top" offset={[0, -18]}><span className="font-bold">{truck.truckId}</span></Tooltip>
                </Marker>
              ))}
            </MapContainer>

            {/* Satellite toggle button — floats over map top-right */}
            <button
              onClick={() => setIsSatellite(prev => !prev)}
              className={`absolute top-3 right-3 z-[1000] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-md border transition-all ${
                isSatellite
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {isSatellite ? 'Street View' : 'Satellite'}
            </button>
            </>
          )}
        </div>

        {/* Map legend */}
        <div className="flex items-center gap-4 px-1 -mt-1 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-6 h-1 bg-emerald-500 rounded" /> Selected</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-1 bg-blue-400 rounded" /> Assigned</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-1 bg-slate-300 rounded" /> Unassigned</span>
        </div>

        {/* Bottom Panel */}
        <div className="flex gap-4 h-[240px]">
          {/* Route cards */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <Navigation className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-800">All Routes ({routes.length})</span>
            </div>

            {routes.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <MapPin className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No routes created yet</p>
                  <p className="text-xs text-slate-300 mt-0.5">Use Route Builder to create routes</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 flex-1">
                {routes.map(route => {
                  const truck = trucks[route.truckId];
                  const fleetEntry = fleet.find(f => f.truckId === route.truckId);
                  const isSelected = selectedRoute?._id === route._id;
                  const isAssigned = !!route.truckId;

                  return (
                    <div
                      key={route._id}
                      onClick={() => setSelectedRoute(isSelected ? null : route)}
                      className={`flex-shrink-0 w-56 rounded-xl border p-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <p className="text-sm font-bold text-slate-800 truncate leading-tight">{route.name}</p>
                        {isAssigned
                          ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">Active</span>
                          : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">Free</span>
                        }
                      </div>

                      {isAssigned ? (
                        <div className="mb-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                              truck?.status === 'online' ? 'bg-emerald-100 text-emerald-700'
                              : truck?.status === 'offline' ? 'bg-slate-100 text-slate-500'
                              : 'bg-amber-100 text-amber-700'
                            }`}>
                              {truck?.status || 'offline'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">{route.truckId}</span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {fleetEntry?.driverName || route.driverName || '—'}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic mb-2">No driver assigned</p>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                          <MapPin className="w-3 h-3 inline mr-0.5" />{route.totalStops} stops
                        </p>
                        <button
                          onClick={e => { e.stopPropagation(); setAssignTarget(route); }}
                          className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
                        >
                          <UserPlus className="w-3 h-3" />
                          {isAssigned ? 'Reassign' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stop list for selected route */}
          {selectedRoute && (
            <div className="w-60 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 overflow-y-auto flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stops</p>
                <button onClick={() => setSelectedRoute(null)} className="text-slate-300 hover:text-slate-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm font-bold text-slate-800 mb-3 leading-snug">{selectedRoute.name}</p>
              <div className="space-y-2">
                {selectedRoute.waypoints.map((wp, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: i === 0 ? '#059669' : i === selectedRoute.waypoints.length - 1 ? '#DC2626' : '#64748b' }}
                    >
                      {i + 1}
                    </div>
                    <p className="text-xs text-slate-700 truncate">{wp.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign modal */}
      {assignTarget && (
        <AssignModal
          route={assignTarget}
          fleet={fleet}
          onClose={() => setAssignTarget(null)}
          onSave={handleAssignSave}
        />
      )}
    </div>
  );
}
