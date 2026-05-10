import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { Calendar, AlertTriangle, Wind, Zap, RefreshCw, Plus, Save, X, Trash2, MapPin, ShieldAlert } from 'lucide-react';
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

  return (
    <div className="p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Garbage Areas & Heatmap</h1>
          <p className="text-xs text-slate-500">Mark collection hotspots and monitor environmental impact</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 font-bold">{criticalCt}</div>
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
            <CircleMarker
              key={zone._id}
              center={[zone.lat, zone.lng]}
              radius={zone.status === 'critical' ? 30 : zone.status === 'moderate' ? 22 : 15}
              pathOptions={{
                fillColor: zoneColor[zone.status],
                fillOpacity: 0.35,
                color: zoneColor[zone.status],
                weight: 2,
                opacity: 0.7,
              }}
              eventHandlers={{ click: () => setSelectedZone(zone) }}
            >
              <Popup>
                <div className="p-1 min-w-[140px]">
                  <p className="font-bold text-slate-900 text-sm">{zone.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: zoneColor[zone.status] }} />
                    <span className="text-xs capitalize font-semibold" style={{ color: zoneColor[zone.status] }}>{zone.status}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Added {new Date(zone.createdAt).toLocaleDateString()}</p>
                  <button 
                    onClick={() => handleDeleteArea(zone._id)}
                    className="mt-3 flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" /> DELETE AREA
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {newArea && (
            <CircleMarker 
              center={[newArea.lat, newArea.lng]}
              radius={20}
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
            </CircleMarker>
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Legend</span>
        {[
          { color: 'bg-red-500', label: 'Critical' },
          { color: 'bg-amber-500', label: 'Moderate' },
          { color: 'bg-emerald-500', label: 'Clean Zone' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <span className={`w-3 h-3 rounded-full opacity-60 ${l.color}`} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
