import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Popup, useMapEvents, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Calendar, AlertTriangle, Wind, Zap, RefreshCw, Plus, Save, X, Trash2, MapPin, ShieldAlert, Radio, Thermometer, Droplets, Gauge } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import API from '../config';

const zoneColor = { critical: '#ef4444', moderate: '#f59e0b', clean: '#10b981' };

// Simple Point-in-Polygon check (Ray Casting Algorithm)
function isPointInPolygon(point, vs) {
  const x = point.lat, y = point.lng;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function HeatmapAnalytics() {
  const { official } = useAuth();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newArea, setNewArea] = useState(null);
  const [saving, setSaving] = useState(false);
  const [boundary, setBoundary] = useState(null);
  const [outOfBoundsError, setOutOfBoundsError] = useState(false);
  const [iotFlash, setIotFlash] = useState(null); // flash notification for real-time updates
  const socketRef = useRef(null);

  const fetchZonesAndBoundary = async () => {
    setLoading(true);
    try {
      const [zonesRes, boundaryRes] = await Promise.all([
        axios.get(`${API}/api/garbage-areas`),
        official?.barangay ? axios.get(`${API}/api/barangays/${official.barangay}/boundary`) : Promise.resolve({ data: { boundary: [] } })
      ]);
      setZones(zonesRes.data);
      if (boundaryRes.data.boundary?.length > 0) {
        setBoundary(boundaryRes.data.boundary);
      }
    } catch (err) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZonesAndBoundary();

    // Connect Socket.IO for live IoT heatmap updates
    const socket = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    // When IoT sensor updates a garbage area, update the heatmap in real-time
    socket.on('garbage-area:updated', (updatedArea) => {
      setZones(prev => {
        const exists = prev.find(z => z._id === updatedArea._id);
        if (exists) {
          return prev.map(z => z._id === updatedArea._id ? updatedArea : z);
        } else {
          return [updatedArea, ...prev];
        }
      });

      // Flash notification
      setIotFlash({
        name: updatedArea.name,
        status: updatedArea.status,
        ammonia: updatedArea.ammonia,
        methane: updatedArea.methane,
      });
      setTimeout(() => setIotFlash(null), 5000);
    });

    // When a new IoT alert arrives, flash it
    socket.on('iot:alert', (alert) => {
      if (alert.severity === 'critical') {
        setIotFlash({
          name: alert.location || alert.sensorId,
          status: 'critical',
          message: alert.message,
        });
        setTimeout(() => setIotFlash(null), 6000);
      }
    });

    return () => socket.disconnect();
  }, [official]);

  const handleMapClick = (latlng) => {
    if (!isAdding) return;
    
    // Check if within jurisdiction
    if (boundary && !isPointInPolygon(latlng, boundary)) {
      setOutOfBoundsError(true);
      setNewArea(null);
      setTimeout(() => setOutOfBoundsError(false), 3000);
      return;
    }

    setOutOfBoundsError(false);
    setNewArea(latlng);
  };

  const handleSaveArea = async () => {
    if (!newArea) return;
    setSaving(true);
    try {
      const payload = {
        name: `${official?.barangay || 'Area'} Hotspot ${zones.length + 1}`,
        lat: newArea.lat,
        lng: newArea.lng,
        status: 'moderate',
        intensity: 0.5,
        barangay: official?.barangay || 'Unknown'
      };
      const { data } = await axios.post(`${API}/api/garbage-areas`, payload);
      setZones([data, ...zones]);
      setNewArea(null);
      setIsAdding(false);
    } catch (err) {
      alert('Failed to save area');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArea = async (id) => {
    if (!window.confirm('Delete this garbage area?')) return;
    try {
      await axios.delete(`${API}/api/garbage-areas/${id}`);
      setZones(zones.filter(z => z._id !== id));
      setSelectedZone(null);
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const criticalCt = zones.filter((z) => z.status === 'critical').length;
  const moderateCt = zones.filter((z) => z.status === 'moderate').length;
  const cleanCt = zones.filter((z) => z.status === 'clean').length;
  const totalReports = zones.reduce((sum, z) => sum + (z.reportCount || 0), 0);
  const iotSourced = zones.filter(z => z.source === 'iot').length;
  const reportSourced = zones.filter(z => z.source === 'reports').length;
  const bothSourced = zones.filter(z => z.source === 'both').length;

  const sourceBadge = (source) => {
    if (source === 'iot') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 uppercase"><Zap className="w-2.5 h-2.5" />IoT</span>;
    if (source === 'reports') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-700 uppercase"><AlertTriangle className="w-2.5 h-2.5" />Reports</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-700 uppercase"><Zap className="w-2.5 h-2.5" />IoT + Reports</span>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Garbage Areas & Heatmap</h1>
          <p className="text-xs text-slate-500">Mark collection hotspots and monitor environmental impact — <span className="text-emerald-600 font-medium">auto-updated by IoT sensors</span></p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchZonesAndBoundary}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => {
              setIsAdding(!isAdding);
              setNewArea(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all ${
              isAdding 
                ? 'bg-red-50 text-red-600 border border-red-200' 
                : 'bg-emerald-700 text-white hover:bg-emerald-800'
            }`}
          >
            {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isAdding ? 'Cancel' : 'Mark Garbage Area'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all ${criticalCt > 0 ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-100'}`}>
          <div className={`w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 font-bold ${criticalCt > 0 ? 'animate-pulse' : ''}`}>{criticalCt}</div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Critical Areas</p>
            <p className="text-xs text-slate-600">Immediate attention needed</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 font-bold">{moderateCt}</div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Moderate Areas</p>
            <p className="text-xs text-slate-600">Scheduled collection active</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 font-bold">{cleanCt}</div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clean Zones</p>
            <p className="text-xs text-slate-600">Successfully maintained</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 font-bold">{totalReports}</div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Linked Reports</p>
            <p className="text-xs text-slate-600">{bothSourced} zones with IoT + Reports</p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="relative h-[600px] bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden ring-1 ring-slate-200">
        {isAdding && !newArea && !outOfBoundsError && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] bg-emerald-950 text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl flex items-center gap-3 border border-emerald-400/30">
            <MapPin className="w-4 h-4 animate-bounce text-emerald-400" />
            Click inside {official?.barangay || 'your barangay'} to mark a hotspot
          </div>
        )}

        {outOfBoundsError && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] bg-red-600 text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl flex items-center gap-3 animate-bounce border border-red-400">
            <ShieldAlert className="w-5 h-5" />
            OUT OF JURISDICTION: You can only mark areas inside {official?.barangay}!
          </div>
        )}

        {/* IoT Real-time Flash Notification */}
        {iotFlash && (
          <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-full text-sm font-bold shadow-2xl flex items-center gap-3 border ${
            iotFlash.status === 'critical'
              ? 'bg-red-600 text-white border-red-400'
              : iotFlash.status === 'moderate'
              ? 'bg-amber-500 text-white border-amber-400'
              : 'bg-emerald-600 text-white border-emerald-400'
          }`} style={{ animation: 'fadeInDown 0.4s ease-out' }}>
            <Radio className="w-4 h-4 animate-pulse" />
            <span>
              IoT Update: <span className="font-black">{iotFlash.name}</span> → {' '}
              <span className="uppercase">{iotFlash.status}</span>
              {iotFlash.ammonia && <span className="ml-2 text-xs opacity-80">NH₃: {iotFlash.ammonia}</span>}
            </span>
          </div>
        )}

        <MapContainer
          center={[10.3157, 123.8854]}
          zoom={14}
          style={{ width: '100%', height: '100%' }}
          className="z-0"
        >
          {/* Base Layer: Esri World Topo */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri"
          />
          
          <TileLayer
            url="https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png"
            opacity={0.3}
            attribution=""
          />

          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
            opacity={0.8}
          />
          
          {/* Jurisdictional Boundary */}
          {boundary && (
            <Polygon
              positions={boundary}
              pathOptions={{
                color: '#059669',
                weight: 3,
                fillColor: '#059669',
                fillOpacity: 0.05,
                dashArray: '10, 10'
              }}
            />
          )}

          <MapClickHandler onMapClick={handleMapClick} />

          {zones.map((zone) => (
            <Circle
              key={zone._id}
              center={[zone.lat, zone.lng]}
              radius={zone.status === 'critical' ? 200 : zone.status === 'moderate' ? 130 : 70}
              pathOptions={{
                fillColor: zoneColor[zone.status],
                fillOpacity: zone.status === 'critical' ? 0.5 : 0.35,
                color: zoneColor[zone.status],
                weight: zone.status === 'critical' ? 3 : 2,
                opacity: 0.7,
              }}
              eventHandlers={{ click: () => setSelectedZone(zone) }}
            >
              <Popup>
                <div className="p-1 min-w-[200px]">
                  <p className="font-bold text-slate-900 text-sm">{zone.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: zoneColor[zone.status] }} />
                    <span className="text-xs capitalize font-semibold" style={{ color: zoneColor[zone.status] }}>{zone.status}</span>
                    {sourceBadge(zone.source || 'iot')}
                  </div>

                  {/* Composite Score Breakdown */}
                  <div style={{ marginTop: '8px', padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      📊 Composite Score
                    </p>
                    
                    {/* IoT Data */}
                    {(zone.ammonia && zone.ammonia !== '0 ppm') || (zone.methane && zone.methane !== '0 ppm') ? (
                      <div style={{ marginBottom: '6px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '3px' }}>🔬 IoT SENSOR</p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>NH₃: </span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>{zone.ammonia}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>CH₄: </span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>{zone.methane}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Report Data */}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                      <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#f97316', marginBottom: '3px' }}>📋 RESIDENT REPORTS</p>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>Count: </span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>{zone.reportCount || 0}</span>
                        </div>
                        {zone.lastReportAt && (
                          <div>
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>Last: </span>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#334155' }}>{timeAgo(zone.lastReportAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {zone.barangay && (
                    <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>📍 {zone.barangay}</p>
                  )}
                  <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                    Updated {timeAgo(zone.updatedAt || zone.createdAt)}
                  </p>
                  <button 
                    onClick={() => handleDeleteArea(zone._id)}
                    style={{
                      marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: '10px', fontWeight: 'bold', color: '#dc2626', cursor: 'pointer',
                      background: 'none', border: 'none', padding: 0
                    }}
                  >
                    <Trash2 className="w-3 h-3" /> DELETE AREA
                  </button>
                </div>
              </Popup>
            </Circle>
          ))}

          {newArea && (
            <Circle
              center={[newArea.lat, newArea.lng]}
              radius={130}
              pathOptions={{ fillColor: '#059669', fillOpacity: 0.6, color: '#fff', weight: 2 }}
            >
              <Popup>
                <div className="p-2 text-center">
                  <p className="text-xs font-bold text-slate-900 mb-2">New Garbage Area</p>
                  <button
                    disabled={saving}
                    onClick={handleSaveArea}
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 bg-emerald-700 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {saving ? 'SAVING...' : <><Save className="w-3 h-3" /> SAVE AREA</>}
                  </button>
                </div>
              </Popup>
            </Circle>
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Legend — Composite Scoring</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {[
            { color: 'bg-red-500', label: 'Critical — IoT hazardous + 5+ reports' },
            { color: 'bg-amber-500', label: 'Moderate — Elevated readings or 2+ reports' },
            { color: 'bg-emerald-500', label: 'Clean — Safe levels, no reports' },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <span className={`w-3 h-3 rounded-full opacity-60 ${l.color}`} />
              {l.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Sources</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700"><Zap className="w-2.5 h-2.5" /> IoT Sensor Only</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-700"><AlertTriangle className="w-2.5 h-2.5" /> Resident Reports Only</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-700"><Zap className="w-2.5 h-2.5" /> IoT + Reports Combined</span>
        </div>
      </div>

      {/* CSS for flash animation */}
      <style>{`
        @keyframes fadeInDown {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to   { transform: translate(-50%, 0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}
