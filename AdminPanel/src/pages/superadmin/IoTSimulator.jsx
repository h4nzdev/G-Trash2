import { useState } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Zap, Send, RefreshCw, CheckCircle, AlertTriangle,
  Thermometer, Droplets, Wind, Gauge, Radio, Clock,
  MapPin, MousePointer2
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

const BARANGAYS = ['Lahug', 'Apas', 'Guadalupe', 'Mabolo', 'Talamban', 'Banilad', 'IT Park', 'Mandaue'];

const THRESHOLDS = {
  ammonia:  { moderate: 25, critical: 45, max: 100, unit: 'ppm' },
  methane:  { moderate: 1.5, critical: 2.5, max: 5, unit: '% LEL' },
  binLevel: { moderate: 70, critical: 90, max: 100, unit: '%' },
  co2:      { moderate: 800, critical: 1500, max: 3000, unit: 'ppm' },
};

const PRESETS = [
  {
    label: 'All Clear',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    dot: 'bg-emerald-500',
    values: { ammonia: 5, methane: 0.3, hydrogen: 5, co2: 400, temperature: 28, humidity: 65, binLevel: 20 },
  },
  {
    label: 'Moderate Warning',
    color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    dot: 'bg-amber-500',
    values: { ammonia: 30, methane: 1.8, hydrogen: 20, co2: 900, temperature: 32, humidity: 72, binLevel: 78 },
  },
  {
    label: 'Critical Alert',
    color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    dot: 'bg-red-500',
    values: { ammonia: 55, methane: 3.2, hydrogen: 60, co2: 1800, temperature: 35, humidity: 85, binLevel: 96 },
  },
  {
    label: 'Bin Full Only',
    color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    dot: 'bg-orange-500',
    values: { ammonia: 8, methane: 0.5, hydrogen: 5, co2: 500, temperature: 29, humidity: 60, binLevel: 93 },
  },
];

const AQ_STYLE = {
  Good:       { pill: 'bg-emerald-100 text-emerald-700', label: 'Good' },
  Moderate:   { pill: 'bg-yellow-100 text-yellow-700',  label: 'Moderate' },
  Unhealthy:  { pill: 'bg-orange-100 text-orange-700',  label: 'Unhealthy' },
  Hazardous:  { pill: 'bg-red-100 text-red-700',        label: 'Hazardous' },
};

function sliderColor(field, value) {
  const t = THRESHOLDS[field];
  if (!t) return 'accent-slate-500';
  if (value >= t.critical) return 'accent-red-500';
  if (value >= t.moderate) return 'accent-amber-500';
  return 'accent-emerald-500';
}

function ThresholdBar({ field, value }) {
  const t = THRESHOLDS[field];
  if (!t) return null;
  const pct = Math.min((value / t.max) * 100, 100);
  const modPct = (t.moderate / t.max) * 100;
  const critPct = (t.critical / t.max) * 100;
  return (
    <div className="relative h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-visible">
      <div
        className={`h-full rounded-full transition-all ${value >= t.critical ? 'bg-red-500' : value >= t.moderate ? 'bg-amber-400' : 'bg-emerald-400'}`}
        style={{ width: `${pct}%` }}
      />
      <div className="absolute top-0 h-full flex items-center" style={{ left: `${modPct}%` }}>
        <div className="w-px h-3 bg-amber-400 -mt-0.5" title={`Moderate: ${t.moderate}`} />
      </div>
      <div className="absolute top-0 h-full flex items-center" style={{ left: `${critPct}%` }}>
        <div className="w-px h-3 bg-red-500 -mt-0.5" title={`Critical: ${t.critical}`} />
      </div>
    </div>
  );
}

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Map Event Handler Component
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng.lat, e.latlng.lng);
    },
  });

  return position ? <Marker position={position} /> : null;
}

export default function IoTSimulator() {
  const [form, setForm] = useState({
    sensorId: 'SENSOR-001',
    deviceType: 'ESP32',
    location: 'Lahug Garbage Area A',
    barangay: 'Lahug',
    lat: 10.328,
    lng: 123.891,
    ammonia: 5,
    methane: 0.3,
    hydrogen: 5,
    co2: 400,
    temperature: 28,
    humidity: 65,
    binLevel: 20,
  });

  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [log, setLog] = useState([]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const applyPreset = (preset) => setForm(prev => ({ ...prev, ...preset.values }));

  const sendReading = async () => {
    setSending(true);
    try {
      const { data } = await axios.post(`${API}/api/iot/sensor-data`, {
        ...form,
        ammonia:  Number(form.ammonia),
        methane:  Number(form.methane),
        hydrogen: Number(form.hydrogen),
        co2:      Number(form.co2),
        temperature: Number(form.temperature),
        humidity: Number(form.humidity),
        binLevel: Number(form.binLevel),
        lat: Number(form.lat),
        lng: Number(form.lng),
      });
      const entry = {
        time: timeNow(),
        sensorId: form.sensorId,
        location: form.location,
        barangay: form.barangay,
        airQuality: data.airQuality,
        alerts: data.alerts?.length || 0,
        autoReport: !!data.autoReport,
      };
      setLastResult(data);
      setLog(prev => [entry, ...prev].slice(0, 15));
    } catch (err) {
      setLastResult({ error: err.response?.data?.error || 'Failed to send reading' });
    } finally {
      setSending(false);
    }
  };

  const aqStyle = lastResult?.airQuality ? AQ_STYLE[lastResult.airQuality] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">IoT Sensor Simulator</h2>
          <p className="text-sm text-slate-500 font-medium">
            Simulate ESP32 sensor readings — updates heatmap and triggers alerts in real-time
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
          <Radio className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Live Mode</span>
        </div>
      </div>

      {/* Preset Scenarios */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Presets</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${p.color}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.dot}`} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-3 space-y-5">

          {/* Sensor Identity */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Sensor Identity</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Sensor ID</label>
                <input
                  value={form.sensorId}
                  onChange={e => set('sensorId', e.target.value)}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-mono border-none outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Device Type</label>
                <select
                  value={form.deviceType}
                  onChange={e => set('deviceType', e.target.value)}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm border-none outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option>ESP32</option>
                  <option>Arduino</option>
                  <option>Raspberry Pi</option>
                  <option>Simulator</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Location Name</label>
                <input
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="e.g. Lahug Garbage Area A"
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm border-none outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Barangay</label>
                <select
                  value={form.barangay}
                  onChange={e => set('barangay', e.target.value)}
                  className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-sm border-none outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {BARANGAYS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    Sensor Location Picker
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-md">
                      <span className="text-[10px] font-bold text-slate-400">LAT:</span>
                      <span className="text-[10px] font-mono font-bold text-slate-600">{Number(form.lat).toFixed(4)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-md">
                      <span className="text-[10px] font-bold text-slate-400">LNG:</span>
                      <span className="text-[10px] font-mono font-bold text-slate-600">{Number(form.lng).toFixed(4)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-64 w-full rounded-2xl border-2 border-slate-100 overflow-hidden relative group">
                  <MapContainer 
                    center={[form.lat, form.lng]} 
                    zoom={15} 
                    className="h-full w-full z-0"
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; OpenStreetMap'
                    />
                    <LocationMarker 
                      position={[form.lat, form.lng]} 
                      setPosition={(lat, lng) => {
                        set('lat', lat);
                        set('lng', lng);
                      }} 
                    />
                  </MapContainer>
                  
                  {/* Overlay instructions */}
                  <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm pointer-events-none group-hover:opacity-0 transition-opacity">
                    <p className="text-[10px] font-bold text-slate-600 flex items-center gap-2">
                      <MousePointer2 className="w-3 h-3 text-emerald-500" />
                      Click anywhere on map to reposition sensor
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gas Readings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Gas Readings (MQ-135)</p>

            {[
              { field: 'ammonia', label: 'Ammonia (NH₃)', icon: Wind, min: 0, max: 100, step: 1 },
              { field: 'methane', label: 'Methane (CH₄)', icon: Zap, min: 0, max: 5, step: 0.1 },
              { field: 'co2', label: 'CO₂', icon: Wind, min: 0, max: 3000, step: 10 },
              { field: 'hydrogen', label: 'Hydrogen (H₂)', icon: Wind, min: 0, max: 100, step: 1 },
            ].map(({ field, label, icon: Icon, min, max, step }) => (
              <div key={field}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <label className="text-xs font-semibold text-slate-600">{label}</label>
                  </div>
                  <div className="flex items-center gap-2">
                    {THRESHOLDS[field] && (
                      <span className="text-[10px] text-slate-400">
                        mod: {THRESHOLDS[field].moderate} · crit: {THRESHOLDS[field].critical}
                      </span>
                    )}
                    <span className={`text-sm font-bold tabular-nums w-16 text-right ${
                      THRESHOLDS[field] && form[field] >= THRESHOLDS[field].critical ? 'text-red-600'
                      : THRESHOLDS[field] && form[field] >= THRESHOLDS[field].moderate ? 'text-amber-600'
                      : 'text-slate-700'
                    }`}>
                      {form[field]} {THRESHOLDS[field]?.unit || ''}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={form[field]}
                  onChange={e => set(field, Number(e.target.value))}
                  className={`w-full h-2 rounded-full cursor-pointer ${sliderColor(field, form[field])}`}
                />
                <ThresholdBar field={field} value={Number(form[field])} />
              </div>
            ))}
          </div>

          {/* Environment */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Environment (DHT11 + Ultrasonic)</p>

            {[
              { field: 'temperature', label: 'Temperature', icon: Thermometer, min: 15, max: 50, step: 0.5, unit: '°C' },
              { field: 'humidity', label: 'Humidity', icon: Droplets, min: 0, max: 100, step: 1, unit: '%' },
              { field: 'binLevel', label: 'Bin Fill Level', icon: Gauge, min: 0, max: 100, step: 1, unit: '%' },
            ].map(({ field, label, icon: Icon, min, max, step, unit }) => (
              <div key={field}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <label className="text-xs font-semibold text-slate-600">{label}</label>
                  </div>
                  <div className="flex items-center gap-2">
                    {THRESHOLDS[field] && (
                      <span className="text-[10px] text-slate-400">
                        mod: {THRESHOLDS[field].moderate}{unit} · crit: {THRESHOLDS[field].critical}{unit}
                      </span>
                    )}
                    <span className={`text-sm font-bold tabular-nums w-16 text-right ${
                      THRESHOLDS[field] && form[field] >= THRESHOLDS[field].critical ? 'text-red-600'
                      : THRESHOLDS[field] && form[field] >= THRESHOLDS[field].moderate ? 'text-amber-600'
                      : 'text-slate-700'
                    }`}>
                      {form[field]}{unit}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={form[field]}
                  onChange={e => set(field, Number(e.target.value))}
                  className={`w-full h-2 rounded-full cursor-pointer ${sliderColor(field, form[field])}`}
                />
                <ThresholdBar field={field} value={Number(form[field])} />
              </div>
            ))}
          </div>

          {/* Send Button */}
          <button
            onClick={sendReading}
            disabled={sending}
            className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-slate-900/10"
          >
            {sending
              ? <><RefreshCw className="w-5 h-5 animate-spin" /> Sending to Backend...</>
              : <><Send className="w-5 h-5" /> Send Sensor Reading</>
            }
          </button>
        </div>

        {/* Right: Response + Log */}
        <div className="lg:col-span-2 space-y-5">

          {/* Last Response */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Last Response</p>

            {!lastResult && (
              <div className="text-center py-10 text-slate-300">
                <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-slate-400">Send a reading to see the result</p>
              </div>
            )}

            {lastResult?.error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {lastResult.error}
              </div>
            )}

            {lastResult?.airQuality && (
              <div className="space-y-4">
                {/* Air Quality */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Air Quality</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${aqStyle?.pill}`}>
                    {aqStyle?.label}
                  </span>
                </div>

                {/* Alert count */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Alerts Triggered</span>
                  <span className={`text-lg font-black ${lastResult.alerts?.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {lastResult.alerts?.length || 0}
                  </span>
                </div>

                {/* Auto Report */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Auto-Report Created</span>
                  {lastResult.autoReport
                    ? <span className="flex items-center gap-1 text-xs font-bold text-orange-600"><AlertTriangle className="w-3.5 h-3.5" />Yes</span>
                    : <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle className="w-3.5 h-3.5" />No</span>
                  }
                </div>

                {/* Alert list */}
                {lastResult.alerts?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alert Details</p>
                    {lastResult.alerts.map((a, i) => (
                      <div key={i} className={`p-3 rounded-xl text-xs font-medium leading-relaxed border ${
                        a.severity === 'critical'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        <span className="font-black uppercase mr-1">[{a.severity}]</span>
                        {a.message}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Heatmap updated · Socket.IO broadcast sent
                </div>
              </div>
            )}
          </div>

          {/* Session Log */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Session Log</p>
              {log.length > 0 && (
                <button onClick={() => setLog([])} className="text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-widest transition-colors">
                  Clear
                </button>
              )}
            </div>

            {log.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
                No readings sent yet
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {log.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                      entry.airQuality === 'Hazardous' ? 'bg-red-500'
                      : entry.airQuality === 'Unhealthy' ? 'bg-orange-500'
                      : entry.airQuality === 'Moderate' ? 'bg-amber-400'
                      : 'bg-emerald-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 truncate">{entry.location}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{entry.time}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-500">{entry.sensorId}</span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className={`text-[10px] font-bold ${
                          entry.airQuality === 'Hazardous' ? 'text-red-600'
                          : entry.airQuality === 'Unhealthy' ? 'text-orange-600'
                          : entry.airQuality === 'Moderate' ? 'text-amber-600'
                          : 'text-emerald-600'
                        }`}>{entry.airQuality}</span>
                        {entry.alerts > 0 && (
                          <span className="text-[10px] text-red-500 font-bold">· {entry.alerts} alert{entry.alerts > 1 ? 's' : ''}</span>
                        )}
                        {entry.autoReport && (
                          <span className="text-[10px] text-orange-500 font-bold">· report created</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Threshold Reference */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Threshold Reference</p>
            <div className="space-y-2 text-xs">
              {Object.entries(THRESHOLDS).map(([field, t]) => (
                <div key={field} className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600 capitalize">{field}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-amber-600 font-mono">≥{t.moderate} {t.unit}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-red-600 font-mono font-bold">≥{t.critical} {t.unit}</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-200 space-y-1 text-[10px] text-slate-400">
                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-amber-400 rounded-full inline-block" /> Amber = Moderate warning</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full inline-block" /> Red = Critical — triggers alert + auto-report</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
