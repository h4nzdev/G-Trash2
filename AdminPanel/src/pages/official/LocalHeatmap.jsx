import { useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Wind, Wifi, WifiOff,
  AlertTriangle, CheckCircle2, Info, RefreshCw,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import StatusBadge from '../../components/shared/StatusBadge';
import { pollutionZones, barangaySensors, pollutionTrend } from '../../data/mockData';

const timeFilters = ['Live', 'Last Hour', 'Today', 'This Week'];
const gasTypes = ['Both', 'Ammonia', 'Methane'];

const levelConfig = {
  low:      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle2, label: 'Good' },
  moderate: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',   icon: Info,         label: 'Moderate' },
  high:     { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500',  icon: AlertTriangle, label: 'High' },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500',     icon: AlertTriangle, label: 'Critical' },
};

const TrendIcon = ({ trend }) => {
  if (trend === 'up')     return <TrendingUp className="w-3.5 h-3.5 text-red-500" />;
  if (trend === 'down')   return <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="flex items-center gap-1.5" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          {p.name}: <strong>{p.value} ppm</strong>
        </p>
      ))}
    </div>
  );
};

export default function LocalHeatmap() {
  const [timeFilter, setTimeFilter] = useState('Live');
  const [gasType, setGasType] = useState('Both');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const onlineCount = barangaySensors.filter(s => s.status === 'online').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Heatmap View</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time pollution monitoring across Barangay Lahug zones</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-100">
            {timeFilters.map(t => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${timeFilter === t ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-100">
            {gasTypes.map(g => (
              <button
                key={g}
                onClick={() => setGasType(g)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${gasType === g ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {g}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            className={`p-2 bg-white rounded-xl border border-slate-100 shadow-sm text-slate-500 hover:text-emerald-600 transition-all ${refreshing ? 'animate-spin text-emerald-600' : ''}`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3.5 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
        <div>
          <span className="text-sm font-semibold text-orange-800">High pollution detected in Zone B</span>
          <span className="text-sm text-orange-700"> — Ammonia at 45 ppm, exceeding warning threshold (40 ppm)</span>
        </div>
      </div>

      {/* Zone Grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Zone Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pollutionZones.map(zone => {
            const cfg = levelConfig[zone.level] ?? levelConfig.low;
            const LevelIcon = cfg.icon;
            return (
              <div
                key={zone.zone}
                className={`rounded-2xl border-2 p-5 ${cfg.bg} ${cfg.border} relative overflow-hidden`}
              >
                {/* Background zone indicator */}
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full ${cfg.dot} opacity-5 -translate-y-6 translate-x-6`} />

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                      <h3 className={`font-bold text-base ${cfg.text}`}>{zone.zone}</h3>
                    </div>
                    <p className="text-xs text-slate-500">{zone.area}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <TrendIcon trend={zone.trend} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(gasType === 'Both' || gasType === 'Ammonia') && (
                    <div className="bg-white/60 rounded-xl p-3 text-center">
                      <p className={`text-2xl font-bold ${cfg.text}`}>{zone.ammonia}</p>
                      <p className="text-xs text-slate-500 mt-0.5">ppm Ammonia</p>
                    </div>
                  )}
                  {(gasType === 'Both' || gasType === 'Methane') && (
                    <div className="bg-white/60 rounded-xl p-3 text-center">
                      <p className={`text-2xl font-bold ${cfg.text}`}>{zone.methane}</p>
                      <p className="text-xs text-slate-500 mt-0.5">ppm Methane</p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                  <Wind className="w-3 h-3" /> Updated {zone.updated}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pollution Trend + Sensors */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-slate-900">Pollution Trend</h2>
              <p className="text-xs text-slate-400 mt-0.5">Hourly readings — all zones averaged</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={pollutionTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit=" ppm" />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={40} stroke="#f97316" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Warning', position: 'right', fontSize: 10, fill: '#f97316' }} />
              <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Caution', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
              {(gasType === 'Both' || gasType === 'Ammonia') && (
                <Line type="monotone" dataKey="ammonia" stroke="#f97316" strokeWidth={2.5} dot={false} name="Ammonia" />
              )}
              {(gasType === 'Both' || gasType === 'Methane') && (
                <Line type="monotone" dataKey="methane" stroke="#6366f1" strokeWidth={2.5} dot={false} name="Methane" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sensor List */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Sensors</h2>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${onlineCount === barangaySensors.length ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {onlineCount}/{barangaySensors.length} Online
            </span>
          </div>
          <div className="space-y-3 flex-1">
            {barangaySensors.map(sensor => (
              <div
                key={sensor.id}
                className={`p-3.5 rounded-xl border ${sensor.status === 'online' ? 'border-emerald-100 bg-emerald-50/30' : 'border-red-100 bg-red-50/30'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {sensor.status === 'online'
                      ? <Wifi className="w-4 h-4 text-emerald-500" />
                      : <WifiOff className="w-4 h-4 text-red-500" />
                    }
                    <span className="text-sm font-semibold text-slate-700">{sensor.id}</span>
                  </div>
                  <StatusBadge status={sensor.status} size="xs" showDot />
                </div>
                <p className="text-xs text-slate-600 font-medium">{sensor.location}</p>
                <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                  <span>{sensor.type}</span>
                  <span>{sensor.lastReading}</span>
                  <span className={sensor.battery < 20 ? 'text-red-500 font-medium' : ''}>{sensor.battery}% batt</span>
                </div>
                {sensor.status === 'offline' && (
                  <button className="mt-2.5 w-full py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                    Troubleshoot
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Thresholds */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Alert Thresholds</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-amber-600 font-medium flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Warning</span>
                <span className="text-slate-600">NH₃ &gt; 20 ppm</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-orange-600 font-medium flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" /> Critical</span>
                <span className="text-slate-600">NH₃ &gt; 40 ppm</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
