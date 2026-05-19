import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Popup, useMapEvents, Polygon, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Calendar, AlertTriangle, Wind, Zap, RefreshCw, Plus, Save, X, Trash2, MapPin, ShieldAlert, Radio, Thermometer, Droplets, Gauge, Heart, Cpu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import API from '../config';

const zoneColor = { critical: '#ef4444', moderate: '#f59e0b', clean: '#10b981' };

function parseAmmoniaPpm(ammoniaStr) {
  if (!ammoniaStr) return 0;
  return parseFloat(String(ammoniaStr).replace(/[^0-9.]/g, '')) || 0;
}

function healthRiskColor(ammoniaPpm) {
  if (ammoniaPpm > 100) return '#ef4444'; // Critical — red
  if (ammoniaPpm > 50)  return '#f97316'; // High — orange
  if (ammoniaPpm >= 25) return '#f59e0b'; // Moderate — yellow
  return '#10b981';                       // Safe — green
}

function healthRiskLabel(ammoniaPpm) {
  if (ammoniaPpm > 100) return 'Critical';
  if (ammoniaPpm > 50)  return 'High Risk';
  if (ammoniaPpm >= 25) return 'Moderate';
  return 'Safe';
}

const CEBU_CITY_OUTLINE = [
  // North border with Consolacion, west coast start
  [10.3565, 123.8808], [10.3592, 123.8842], [10.3610, 123.8882], [10.3620, 123.8925],
  [10.3624, 123.8972], [10.3618, 123.9018], [10.3600, 123.9065], [10.3568, 123.9112],
  // NE — eastern mountain ridge
  [10.3525, 123.9158], [10.3475, 123.9200], [10.3420, 123.9235], [10.3362, 123.9262],
  [10.3302, 123.9278], [10.3242, 123.9284], [10.3182, 123.9278], [10.3124, 123.9260],
  [10.3068, 123.9234], [10.3015, 123.9202], [10.2965, 123.9165], [10.2918, 123.9124],
  [10.2874, 123.9080], [10.2834, 123.9032], [10.2798, 123.8982], [10.2766, 123.8928],
  // SE — southern boundary with Talisay
  [10.2740, 123.8868], [10.2720, 123.8805], [10.2708, 123.8740], [10.2703, 123.8675],
  [10.2706, 123.8612], [10.2718, 123.8555],
  // SW corner
  [10.2738, 123.8508], [10.2770, 123.8472], [10.2806, 123.8452], [10.2844, 123.8445],
  [10.2878, 123.8452], [10.2908, 123.8465], [10.2936, 123.8480],
  // West coast — reclamation area near-straight run
  [10.2965, 123.8488], [10.2995, 123.8493], [10.3025, 123.8496], [10.3055, 123.8500],
  [10.3085, 123.8506], [10.3115, 123.8515], [10.3145, 123.8528], [10.3172, 123.8545],
  // North Reclamation Area / port zone
  [10.3196, 123.8558], [10.3220, 123.8568], [10.3246, 123.8573], [10.3272, 123.8576],
  [10.3300, 123.8580], [10.3328, 123.8588], [10.3358, 123.8600], [10.3388, 123.8616],
  [10.3415, 123.8636], [10.3440, 123.8660], [10.3464, 123.8686], [10.3487, 123.8714],
  [10.3508, 123.8742], [10.3526, 123.8770], [10.3544, 123.8792], [10.3558, 123.8802],
  [10.3565, 123.8808],
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
    const coords = outer
      .flatMap(m => (m.geometry || []).map(pt => [pt.lat, pt.lon]))
      .filter(([lat, lon]) => lat != null && lon != null && !isNaN(lat) && !isNaN(lon));
    return coords.length > 3 ? coords : null;
  } catch {
    return null;
  }
}

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
  const isChd = official?.role === 'chd';
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newArea, setNewArea] = useState(null);
  const [saving, setSaving] = useState(false);
  const [boundary, setBoundary] = useState(null);
  const [outOfBoundsError, setOutOfBoundsError] = useState(false);
  const [iotFlash, setIotFlash] = useState(null);
  const [cleanedFlash, setCleanedFlash] = useState(null);
  const [cebuCityBoundary, setCebuCityBoundary] = useState(CEBU_CITY_OUTLINE);
  const [showCityBoundary, setShowCityBoundary] = useState(true);
  const [healthRiskView, setHealthRiskView] = useState(false);
  const [showSensorForm, setShowSensorForm] = useState(false);
  const [sensorForm, setSensorForm] = useState({ sensorId: '', location: '', barangay: '', lat: '', lng: '' });
  const [sensorSaving, setSensorSaving] = useState(false);
  const [sensorMsg, setSensorMsg] = useState(null);
  const [sensorZones, setSensorZones] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchCebuCityBoundary().then(coords => { if (coords) setCebuCityBoundary(coords); });
  }, []);

  const fetchZonesAndBoundary = async () => {
    setLoading(true);
    try {
      const [zonesRes, boundaryRes, sensorRes] = await Promise.all([
        axios.get(`${API}/api/garbage-areas`),
        official?.barangay ? axios.get(`${API}/api/barangays/${official.barangay}/boundary`) : Promise.resolve({ data: { boundary: [] } }),
        axios.get(`${API}/api/sensor-zones`),
      ]);
      setZones(zonesRes.data);
      setSensorZones(sensorRes.data);
      if (boundaryRes.data.boundary?.length > 0) {
        setBoundary(boundaryRes.data.boundary);
      }
    } catch (err) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSensor = async (e) => {
    e.preventDefault();
    const { sensorId, location, barangay, lat, lng } = sensorForm;
    if (!sensorId || !lat || !lng) return;
    setSensorSaving(true);
    setSensorMsg(null);
    try {
      const { data } = await axios.post(`${API}/api/sensor-zones`, {
        sensorId: sensorId.trim().toUpperCase(),
        location: location.trim() || sensorId.trim().toUpperCase(),
        barangay: barangay.trim(),
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      });
      setSensorZones(prev => {
        const exists = prev.find(z => z.sensorId === data.sensorId);
        return exists ? prev.map(z => z.sensorId === data.sensorId ? data : z) : [data, ...prev];
      });
      setZones(prev => {
        const exists = prev.find(z => z._id === data._id);
        return exists ? prev.map(z => z._id === data._id ? data : z) : [data, ...prev];
      });
      setSensorMsg({ type: 'ok', text: `Sensor "${data.sensorId}" registered at (${data.lat.toFixed(5)}, ${data.lng.toFixed(5)})` });
      setSensorForm({ sensorId: '', location: '', barangay: '', lat: '', lng: '' });
      setTimeout(() => setSensorMsg(null), 5000);
    } catch (err) {
      setSensorMsg({ type: 'err', text: err?.response?.data?.error || 'Failed to register sensor' });
    } finally {
      setSensorSaving(false);
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
        if (exists) return prev.map(z => z._id === updatedArea._id ? updatedArea : z);
        return [updatedArea, ...prev];
      });
      if (updatedArea.sensorId) {
        setSensorZones(prev => {
          const exists = prev.find(z => z._id === updatedArea._id);
          if (exists) return prev.map(z => z._id === updatedArea._id ? updatedArea : z);
          return [updatedArea, ...prev];
        });
      }

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

    // When a zone changes status (collection, IoT, report)
    socket.on('zone:status:update', (update) => {
      // Update zone in local state
      setZones(prev => prev.map(z =>
        (z._id === String(update.areaId) || z._id === String(update.zoneId))
          ? { ...z, status: update.newStatus }
          : z
      ));
      // Show cleaned flash notification for collection events
      if (update.reason === 'collection_completed') {
        setCleanedFlash({
          name: update.name,
          barangay: update.barangay,
          collectedBy: update.changedBy,
          weight: update.weight,
          previousStatus: update.previousStatus,
          newStatus: update.newStatus,
        });
        setTimeout(() => setCleanedFlash(null), 6000);
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
          {/* Health Risk View toggle — available to CHD and officials */}
          <button
            onClick={() => setHealthRiskView(!healthRiskView)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${healthRiskView ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            <Heart className="w-4 h-4" />
            Health Risk View
          </button>

          <button
            onClick={() => setShowCityBoundary(!showCityBoundary)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${showCityBoundary ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="5 3"/></svg>
            City Outline
          </button>

          <button
            onClick={fetchZonesAndBoundary}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {!isChd && (
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
          )}
        </div>
      </div>

      {/* IoT Sensor Registration Panel */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowSensorForm(!showSensorForm)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-blue-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Cpu className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800">IoT Sensor Zones</p>
              <p className="text-xs text-slate-500">
                {sensorZones.length} registered sensor{sensorZones.length !== 1 ? 's' : ''} — zones auto-update when sensor sends data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sensorZones.map(z => (
              <span key={z.sensorId} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                z.status === 'clean' ? 'bg-emerald-100 text-emerald-700' :
                z.status === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${z.status === 'clean' ? 'bg-emerald-500' : z.status === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                {z.sensorId}
              </span>
            ))}
            <span className="text-xs font-bold text-blue-600">{showSensorForm ? '▲ Hide' : '▼ Register Sensor'}</span>
          </div>
        </button>

        {showSensorForm && (
          <form onSubmit={handleRegisterSensor} className="border-t border-blue-100 px-5 py-4 space-y-3">
            <p className="text-xs text-slate-500">
              Enter the sensor ID exactly as sent by ESP32, and the GPS coordinates of where the sensor is physically installed.
              The sensor will then auto-update its heatmap circle when it sends readings.
            </p>
            {sensorMsg && (
              <div className={`px-3 py-2 rounded-lg text-xs font-medium ${sensorMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {sensorMsg.text}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <input
                required
                placeholder="Sensor ID (e.g. IR-SENSOR-001)"
                value={sensorForm.sensorId}
                onChange={e => setSensorForm(f => ({ ...f, sensorId: e.target.value }))}
                className="col-span-2 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
              />
              <input
                placeholder="Location name"
                value={sensorForm.location}
                onChange={e => setSensorForm(f => ({ ...f, location: e.target.value }))}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
              />
              <input
                required
                placeholder="Latitude (e.g. 10.3254)"
                type="number"
                step="any"
                value={sensorForm.lat}
                onChange={e => setSensorForm(f => ({ ...f, lat: e.target.value }))}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
              />
              <input
                required
                placeholder="Longitude (e.g. 123.9110)"
                type="number"
                step="any"
                value={sensorForm.lng}
                onChange={e => setSensorForm(f => ({ ...f, lng: e.target.value }))}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                placeholder="Barangay (optional)"
                value={sensorForm.barangay}
                onChange={e => setSensorForm(f => ({ ...f, barangay: e.target.value }))}
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
              />
              <button
                type="submit"
                disabled={sensorSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {sensorSaving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Cpu className="w-3 h-3" />}
                {sensorSaving ? 'Registering...' : 'Register Sensor'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Stats row */}
      {healthRiskView ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-red-200 ring-1 ring-red-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center font-bold text-red-600">
              {zones.filter(z => parseAmmoniaPpm(z.ammonia) > 100).length}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Critical Risk</p>
              <p className="text-xs text-slate-600">NH₃ &gt; 100 ppm</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-orange-200 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center font-bold text-orange-600">
              {zones.filter(z => { const p = parseAmmoniaPpm(z.ammonia); return p > 50 && p <= 100; }).length}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">High Risk</p>
              <p className="text-xs text-slate-600">NH₃ 50–100 ppm</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center font-bold text-amber-600">
              {zones.filter(z => { const p = parseAmmoniaPpm(z.ammonia); return p >= 25 && p <= 50; }).length}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Moderate</p>
              <p className="text-xs text-slate-600">NH₃ 25–50 ppm</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center font-bold text-emerald-600">
              {zones.filter(z => parseAmmoniaPpm(z.ammonia) < 25).length}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Safe Zones</p>
              <p className="text-xs text-slate-600">NH₃ &lt; 25 ppm</p>
            </div>
          </div>
        </div>
      ) : (
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
      )}

      {/* Map */}
      <div className="relative h-[600px] bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden ring-1 ring-slate-200">
        {isAdding && !newArea && !outOfBoundsError && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] bg-emerald-950 text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl flex items-center gap-3 border border-emerald-400/30">
            <MapPin className="w-4 h-4 animate-bounce text-emerald-400" />
            Click inside {official?.barangay || 'your barangay'} to mark a hotspot
          </div>
        )}

        {/* Floating save card — appears immediately after placing a pin */}
        {newArea && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-2xl shadow-2xl border border-slate-200 px-5 py-4 flex items-center gap-4 min-w-[280px]">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">New Hotspot Placed</p>
              <p className="text-xs text-slate-500">{newArea.lat.toFixed(5)}, {newArea.lng.toFixed(5)}</p>
            </div>
            <button
              disabled={saving}
              onClick={handleSaveArea}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-sm font-bold rounded-xl hover:bg-emerald-800 disabled:opacity-50 transition-colors shrink-0"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save Area'}
            </button>
            <button
              onClick={() => { setNewArea(null); }}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {outOfBoundsError && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] bg-red-600 text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl flex items-center gap-3 animate-bounce border border-red-400">
            <ShieldAlert className="w-5 h-5" />
            OUT OF JURISDICTION: You can only mark areas inside {official?.barangay}!
          </div>
        )}

        {/* Zone Cleaned Flash Notification */}
        {cleanedFlash && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1001] px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-3 bg-emerald-600 text-white border border-emerald-400 max-w-md" style={{ animation: 'fadeInDown 0.4s ease-out' }}>
            <span className="text-xl">✅</span>
            <div className="flex-1 min-w-0">
              <p className="font-black truncate">Zone cleaned: {cleanedFlash.name}</p>
              <p className="text-xs font-medium opacity-90">
                {cleanedFlash.collectedBy} • {cleanedFlash.weight || 'Weight not logged'}
                {cleanedFlash.previousStatus && (
                  <span className="ml-2 capitalize">
                    ({cleanedFlash.previousStatus} → {cleanedFlash.newStatus})
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* IoT Real-time Flash Notification */}
        {iotFlash && !cleanedFlash && (
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
          
          {/* Cebu City Boundary */}
          {showCityBoundary && (
            <Polyline
              positions={cebuCityBoundary}
              pathOptions={{ color: '#2563EB', weight: 2, opacity: 0.55, dashArray: '10, 7' }}
            />
          )}

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

          {zones.map((zone) => {
            const ammoniaPpm = parseAmmoniaPpm(zone.ammonia);
            const circleColor = healthRiskView ? healthRiskColor(ammoniaPpm) : zoneColor[zone.status];
            const riskLabel = healthRiskView ? healthRiskLabel(ammoniaPpm) : zone.status;
            const isIotZone = !!zone.sensorId;
            return (
            <Circle
              key={zone._id}
              center={[zone.lat, zone.lng]}
              radius={zone.status === 'critical' ? 200 : zone.status === 'moderate' ? 130 : 70}
              pathOptions={{
                fillColor: circleColor,
                fillOpacity: zone.status === 'critical' ? 0.5 : 0.35,
                color: isIotZone ? '#2563eb' : circleColor,
                weight: isIotZone ? 3 : (zone.status === 'critical' ? 3 : 2),
                opacity: 0.9,
              }}
              eventHandlers={{ click: () => setSelectedZone(zone) }}
            >
              <Popup>
                <div className="p-1 min-w-[200px]">
                  <p className="font-bold text-slate-900 text-sm">{zone.name}</p>
                  {isIotZone && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: '#dbeafe', borderRadius: '12px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#1d4ed8' }}>📡 LIVE IoT — {zone.sensorId}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: circleColor }} />
                    <span className="text-xs capitalize font-semibold" style={{ color: circleColor }}>{riskLabel}</span>
                    {!healthRiskView && sourceBadge(zone.source || 'iot')}
                    {healthRiskView && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700">❤️ Health View</span>}
                  </div>

                  {healthRiskView ? (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#fff5f5', borderRadius: '8px', border: '1px solid #fecaca' }}>
                      <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#dc2626', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        🏥 Health Risk Assessment
                      </p>
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
                        <div>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>NH₃: </span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: circleColor }}>{zone.ammonia || '0 ppm'}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>CH₄: </span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>{zone.methane || '0 ppm'}</span>
                        </div>
                      </div>
                      <div style={{ padding: '6px', background: circleColor + '22', borderRadius: '6px', marginBottom: '6px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 'bold', color: circleColor }}>Risk Level: {riskLabel}</p>
                        <p style={{ fontSize: '10px', color: '#64748b' }}>
                          {ammoniaPpm > 100 ? 'Immediate health intervention required' :
                           ammoniaPpm > 50 ? 'High risk — monitor closely' :
                           ammoniaPpm >= 25 ? 'Moderate — schedule inspection' :
                           'Safe levels — no action needed'}
                        </p>
                      </div>
                      {zone.barangay && (
                        <p style={{ fontSize: '10px', color: '#94a3b8' }}>📍 {zone.barangay}</p>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        📊 Composite Score
                      </p>
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
                  )}

                  {!healthRiskView && zone.barangay && (
                    <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>📍 {zone.barangay}</p>
                  )}
                  <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                    Updated {timeAgo(zone.updatedAt || zone.createdAt)}
                  </p>
                  {!isChd && (
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
                  )}
                </div>
              </Popup>
            </Circle>
            );
          })}

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
        {healthRiskView ? (
          <>
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5">
              <Heart className="w-3 h-3" /> Health Risk View — Ammonia (NH₃) Levels
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {[
                { color: 'bg-emerald-500', label: 'Safe — NH₃ < 25 ppm' },
                { color: 'bg-amber-500', label: 'Moderate — NH₃ 25–50 ppm' },
                { color: 'bg-orange-500', label: 'High Risk — NH₃ 50–100 ppm' },
                { color: 'bg-red-500', label: 'Critical — NH₃ > 100 ppm' },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <span className={`w-3 h-3 rounded-full opacity-80 ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
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
              <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <span className="w-6 border-t-2 border-blue-600 border-dashed inline-block" />
                Cebu City boundary
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <span className="w-6 border-t-2 border-emerald-600 border-dashed inline-block" />
                Barangay jurisdiction
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Sources</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700"><Zap className="w-2.5 h-2.5" /> IoT Sensor Only</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-700"><AlertTriangle className="w-2.5 h-2.5" /> Resident Reports Only</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-700"><Zap className="w-2.5 h-2.5" /> IoT + Reports Combined</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IoT Zones</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <span className="w-4 h-4 rounded-full border-2 border-blue-600 bg-emerald-200 inline-block" />
                Blue border = live IoT sensor zone (auto-updates)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <Cpu className="w-3.5 h-3.5 text-blue-600" />
                Register sensors in the panel above
              </span>
            </div>
          </>
        )}
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
