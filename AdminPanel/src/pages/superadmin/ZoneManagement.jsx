import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import axios from 'axios';
import {
  MapPin, RefreshCw, Trash2, RotateCcw, Edit3,
  CheckCircle, AlertTriangle, XCircle, X, ChevronDown, Radio
} from 'lucide-react';
import API from '../../config';

const STATUS_COLOR = { critical: '#ef4444', moderate: '#f59e0b', clean: '#10b981' };
const STATUS_FILL  = { critical: '#fef2f2', moderate: '#fffbeb', clean: '#f0fdf4' };
const STATUS_RING  = { critical: 'ring-red-200 border-red-200', moderate: 'ring-amber-200 border-amber-200', clean: 'ring-emerald-200 border-emerald-200' };
const STATUS_TEXT  = { critical: 'text-red-700', moderate: 'text-amber-700', clean: 'text-emerald-700' };
const STATUS_BG    = { critical: 'bg-red-100', moderate: 'bg-amber-100', clean: 'bg-emerald-100' };

const STATUS_ICON = {
  critical: <XCircle className="w-3.5 h-3.5" />,
  moderate: <AlertTriangle className="w-3.5 h-3.5" />,
  clean:    <CheckCircle className="w-3.5 h-3.5" />,
};

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_BG[status]} ${STATUS_TEXT[status]}`}>
      {STATUS_ICON[status]}
      {status}
    </span>
  );
}

export default function ZoneManagement() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(null);
  const [overrideModal, setOverrideModal] = useState(null);
  const [overrideStatus, setOverrideStatus] = useState('clean');
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [liveEvent, setLiveEvent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const socketRef = useRef(null);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/garbage-areas`);
      setZones(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();

    const socket = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('zone:status:update', (update) => {
      const id = String(update.areaId || update.zoneId);
      setZones(prev => prev.map(z =>
        String(z._id) === id ? { ...z, status: update.newStatus, intensity: update.newStatus === 'critical' ? 0.8 : update.newStatus === 'moderate' ? 0.5 : 0.2 } : z
      ));
      setLiveEvent({
        name: update.name,
        barangay: update.barangay,
        previousStatus: update.previousStatus,
        newStatus: update.newStatus,
        reason: update.reason,
        changedBy: update.changedBy,
        weight: update.weight,
        timestamp: update.timestamp,
      });
      setTimeout(() => setLiveEvent(null), 6000);
    });

    socket.on('garbage-area:updated', (area) => {
      setZones(prev => {
        const idx = prev.findIndex(z => String(z._id) === String(area._id));
        if (idx >= 0) return prev.map((z, i) => i === idx ? area : z);
        return [area, ...prev];
      });
    });

    return () => socket.disconnect();
  }, []);

  const handleRecalculate = async (zoneId) => {
    setRecalculating(zoneId);
    try {
      await axios.post(`${API}/api/zones/${zoneId}/recalculate`, { triggeredBy: 'Admin' });
    } catch {
      // silent — socket event will update state
    } finally {
      setRecalculating(null);
    }
  };

  const handleBulkRecalculate = async () => {
    setLoading(true);
    try {
      await Promise.all(zones.map(z => axios.post(`${API}/api/zones/${z._id}/recalculate`, { triggeredBy: 'Admin' })));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideSave = async () => {
    if (!overrideModal) return;
    setOverrideSaving(true);
    try {
      await axios.patch(`${API}/api/zones/${overrideModal._id}/status`, {
        status: overrideStatus,
        changedBy: 'Admin Override',
      });
      setOverrideModal(null);
    } catch {
      // silent
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleDelete = async (zoneId) => {
    try {
      await axios.delete(`${API}/api/garbage-areas/${zoneId}`);
      setZones(prev => prev.filter(z => z._id !== zoneId));
      setDeleteConfirm(null);
    } catch {
      // silent
    }
  };

  const filtered = zones.filter(z => {
    const matchesSearch = !searchQuery || z.name?.toLowerCase().includes(searchQuery.toLowerCase()) || z.barangay?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || z.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const criticalCt = zones.filter(z => z.status === 'critical').length;
  const moderateCt = zones.filter(z => z.status === 'moderate').length;
  const cleanCt    = zones.filter(z => z.status === 'clean').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Zone Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">Monitor and override garbage zone statuses — live updates via Socket.io</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkRecalculate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Recalculate All
          </button>
          <button
            onClick={fetchZones}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Live event toast */}
      {liveEvent && (
        <div className="flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-medium border border-emerald-400 animate-in slide-in-from-top duration-300">
          <Radio className="w-4 h-4 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-black">{liveEvent.name}</span>
            <span className="mx-1 opacity-70">·</span>
            <span className="capitalize opacity-90">{liveEvent.previousStatus}</span>
            <span className="mx-1">→</span>
            <span className="font-bold uppercase">{liveEvent.newStatus}</span>
            {liveEvent.reason && <span className="ml-2 text-xs opacity-75">({liveEvent.reason.replace(/_/g, ' ')})</span>}
          </div>
          <button onClick={() => setLiveEvent(null)}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Critical', count: criticalCt, color: 'red' },
          { label: 'Moderate', count: moderateCt, color: 'amber' },
          { label: 'Clean',    count: cleanCt,    color: 'emerald' },
        ].map(({ label, count, color }) => (
          <div key={label} className={`bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 ${count > 0 && label === 'Critical' ? 'ring-1 ring-red-100 border-red-100' : ''}`}>
            <div className={`w-10 h-10 bg-${color}-100 rounded-xl flex items-center justify-center font-bold text-${color}-600 text-lg`}>{count}</div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label} Zones</p>
              <p className="text-xs text-slate-600">{((count / (zones.length || 1)) * 100).toFixed(0)}% of total</p>
            </div>
          </div>
        ))}
      </div>

      {/* Map + Table split */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Map */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden h-[480px] shadow">
          <MapContainer center={[10.3157, 123.8854]} zoom={13} style={{ width: '100%', height: '100%' }} className="z-0">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
            {zones.map(z => z.lat && z.lng ? (
              <Circle
                key={z._id}
                center={[z.lat, z.lng]}
                radius={150}
                pathOptions={{
                  color: STATUS_COLOR[z.status] || '#f59e0b',
                  fillColor: STATUS_COLOR[z.status] || '#f59e0b',
                  fillOpacity: z.intensity || 0.5,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1 min-w-[160px]">
                    <p className="font-bold text-slate-900">{z.name}</p>
                    <p className="text-slate-500">{z.barangay}</p>
                    <StatusBadge status={z.status || 'moderate'} />
                    {z.ammonia && <p>NH₃: {z.ammonia}</p>}
                    {z.methane && <p>CH₄: {z.methane}</p>}
                    {z.reportCount > 0 && <p>Reports: {z.reportCount}</p>}
                  </div>
                </Popup>
              </Circle>
            ) : null)}
          </MapContainer>
        </div>

        {/* Zone list */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow flex flex-col overflow-hidden h-[480px]">
          {/* Filters */}
          <div className="flex items-center gap-2 p-4 border-b border-slate-100 shrink-0">
            <input
              type="text"
              placeholder="Search zones..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <div className="relative">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 pr-7 focus:outline-none focus:ring-2 focus:ring-emerald-400 appearance-none bg-white"
              >
                <option value="all">All ({zones.length})</option>
                <option value="critical">Critical ({criticalCt})</option>
                <option value="moderate">Moderate ({moderateCt})</option>
                <option value="clean">Clean ({cleanCt})</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Zone rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading zones...</div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">No zones match your filters.</div>
            ) : filtered.map(zone => (
              <div key={zone._id} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group ${STATUS_FILL[zone.status]}`}>
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLOR[zone.status] || '#f59e0b' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{zone.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{zone.barangay} · Reports: {zone.reportCount || 0} · {timeAgo(zone.lastCollectionAt || zone.updatedAt)}</p>
                </div>
                <StatusBadge status={zone.status || 'moderate'} />
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    title="Force recalculate"
                    onClick={() => handleRecalculate(zone._id)}
                    disabled={recalculating === zone._id}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${recalculating === zone._id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    title="Override status"
                    onClick={() => { setOverrideModal(zone); setOverrideStatus(zone.status || 'clean'); }}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Delete zone"
                    onClick={() => setDeleteConfirm(zone)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-slate-900 text-base">Override Zone Status</h3>
              <button onClick={() => setOverrideModal(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm font-bold text-slate-700 truncate">{overrideModal.name}</p>
              <p className="text-xs text-slate-500">{overrideModal.barangay}</p>
              <p className="text-xs text-slate-500 mt-1">Current: <StatusBadge status={overrideModal.status || 'moderate'} /></p>
            </div>
            <div className="space-y-2 mb-6">
              {['clean', 'moderate', 'critical'].map(s => (
                <button
                  key={s}
                  onClick={() => setOverrideStatus(s)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-sm font-bold ${overrideStatus === s ? `${STATUS_BG[s]} ${STATUS_TEXT[s]} border-current` : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {STATUS_ICON[s]}
                  <span className="capitalize">{s}</span>
                  {s === 'clean' && <span className="ml-auto text-[10px] font-normal opacity-60">No active reports, sensors normal</span>}
                  {s === 'moderate' && <span className="ml-auto text-[10px] font-normal opacity-60">1-2 reports or elevated readings</span>}
                  {s === 'critical' && <span className="ml-auto text-[10px] font-normal opacity-60">3+ reports or hazardous readings</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOverrideModal(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleOverrideSave}
                disabled={overrideSaving || overrideStatus === overrideModal.status}
                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {overrideSaving ? 'Saving...' : 'Apply Override'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-black text-slate-900 text-base mb-1">Delete Zone?</h3>
            <p className="text-sm text-slate-600 mb-6">
              <span className="font-bold">{deleteConfirm.name}</span> will be permanently removed from the heatmap.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm._id)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
