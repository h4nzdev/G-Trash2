import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Calendar, AlertTriangle, Wind, Zap, RefreshCw } from 'lucide-react';
import Badge from '../components/shared/Badge';
import { heatmapZones } from '../data/mockData';

const zoneColor = { critical: '#ef4444', moderate: '#f59e0b', clean: '#10b981' };
const zoneBg = { critical: 'bg-red-50 border-red-200', moderate: 'bg-amber-50 border-amber-200', clean: 'bg-emerald-50 border-emerald-200' };
const timeRanges = ['Live', 'Last 24h', 'Last Week', 'This Month'];

export default function HeatmapAnalytics() {
  const [selectedZone, setSelectedZone] = useState(null);
  const [timeRange, setTimeRange] = useState('Live');

  const criticalCt = heatmapZones.filter((z) => z.status === 'critical').length;
  const moderateCt = heatmapZones.filter((z) => z.status === 'moderate').length;
  const cleanCt = heatmapZones.filter((z) => z.status === 'clean').length;

  return (
    <div className="p-6 space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-red-600 font-semibold">
            <span className="w-3 h-3 bg-red-500 rounded-full opacity-80" /> {criticalCt} Critical
          </span>
          <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
            <span className="w-3 h-3 bg-amber-500 rounded-full opacity-80" /> {moderateCt} Moderate
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
            <span className="w-3 h-3 bg-emerald-500 rounded-full opacity-80" /> {cleanCt} Clean
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-0.5 shadow-sm">
            {timeRanges.map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  timeRange === t ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {timeRange === 'Live' && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="h-[420px] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <MapContainer
          center={[10.3157, 123.8854]}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          className="rounded-2xl z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {heatmapZones.map((zone) => (
            <CircleMarker
              key={zone.id}
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
                  <p className="text-xs text-slate-600 mt-1">NH₃: {zone.ammonia}</p>
                  <p className="text-xs text-slate-600">CH₄: {zone.methane}</p>
                  <p className="text-xs text-slate-600">{zone.bins} bins</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-2">
        <span className="text-xs font-semibold text-slate-500">LEGEND:</span>
        {[
          { color: 'bg-red-500', label: 'Critical (>40 ppm NH₃)' },
          { color: 'bg-amber-500', label: 'Moderate (15–40 ppm NH₃)' },
          { color: 'bg-emerald-500', label: 'Clean (<15 ppm NH₃)' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`w-3 h-3 rounded-full opacity-60 ${l.color}`} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Zone Cards */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-4">Zone Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {heatmapZones.map((zone) => (
            <div
              key={zone.id}
              onClick={() => setSelectedZone(zone === selectedZone ? null : zone)}
              className={`bg-white rounded-2xl shadow-sm border p-4 cursor-pointer hover:shadow-md transition-all duration-150 ${
                selectedZone?.id === zone.id ? 'ring-2 ring-emerald-400' : 'border-slate-100'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{zone.name}</p>
                  <Badge variant={zone.status} showDot size="xs" className="mt-1">
                    {zone.status.charAt(0).toUpperCase() + zone.status.slice(1)}
                  </Badge>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  zone.status === 'critical' ? 'bg-red-100' : zone.status === 'moderate' ? 'bg-amber-100' : 'bg-emerald-100'
                }`}>
                  <AlertTriangle className={`w-4 h-4 ${
                    zone.status === 'critical' ? 'text-red-600' : zone.status === 'moderate' ? 'text-amber-600' : 'text-emerald-600'
                  }`} />
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-slate-500"><Wind className="w-3 h-3" /> Ammonia</span>
                  <span className={`font-semibold ${zone.status === 'critical' ? 'text-red-600' : zone.status === 'moderate' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {zone.ammonia}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-slate-500"><Zap className="w-3 h-3" /> Methane</span>
                  <span className="text-slate-700 font-semibold">{zone.methane}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Bins</span>
                  <span className="text-slate-700 font-semibold">{zone.bins} units</span>
                </div>
              </div>

              <button className="w-full py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-900 hover:to-emerald-800 rounded-lg transition-colors">
                Schedule Cleanup
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
