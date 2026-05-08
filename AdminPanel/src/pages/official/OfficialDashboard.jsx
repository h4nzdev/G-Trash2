import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale, Truck, FileWarning, Wind, ChevronRight,
  MapPin, Bell, TrendingUp, TrendingDown, Minus,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import StatCard from '../../components/shared/StatCard';
import StatusBadge from '../../components/shared/StatusBadge';
import {
  barangayStats, collectionSchedule, barangayComplaints,
  barangaySensors, wasteCollectionTrend, complaintsByCategory,
} from '../../data/mockData';

const priorityDot = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-amber-400', low: 'bg-blue-400' };

const quickActions = [
  { label: 'File a Report', icon: FileWarning, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', to: '/official/reports' },
  { label: 'Send Notification', icon: Bell, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', to: '/official/notifications' },
  { label: 'View Heatmap', icon: MapPin, iconBg: 'bg-teal-50', iconColor: 'text-teal-600', to: '/official/heatmap' },
  { label: 'Track Collections', icon: Truck, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', to: '/official/collection' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value} kg</p>
      ))}
    </div>
  );
};

export default function OfficialDashboard() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greeting}, Pedro!</h1>
          <p className="text-slate-500 text-sm mt-1">Barangay Lahug · {dateStr}</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-slate-100">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-slate-600">Live updates</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Scale}
          title="Waste Collected Today"
          value={barangayStats.wasteCollectedToday.value}
          subtitle={`${barangayStats.wasteCollectedToday.change} vs yesterday`}
          trend={barangayStats.wasteCollectedToday.trend}
          color="emerald"
        />
        <StatCard
          icon={Truck}
          title="Active Collectors"
          value={`${barangayStats.activeCollectors.value} / ${barangayStats.activeCollectors.total}`}
          subtitle="1 collector on break"
          color="blue"
        />
        <StatCard
          icon={FileWarning}
          title="Pending Complaints"
          value={barangayStats.pendingComplaints.value}
          subtitle={`${barangayStats.pendingComplaints.urgent} urgent, needs action`}
          color="amber"
        />
        <StatCard
          icon={Wind}
          title="Air Quality Index"
          value={barangayStats.pollutionLevel.value}
          subtitle={`AQI ${barangayStats.pollutionLevel.index} · ${barangayStats.pollutionLevel.change} today`}
          trend={barangayStats.pollutionLevel.trend}
          color="teal"
        />
      </div>

      {/* Charts + Routes */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Waste Collection Trend */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-slate-900">Waste Collection Trend</h2>
              <p className="text-slate-400 text-xs mt-0.5">Last 7 days · Barangay Lahug</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Collected</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-slate-300 inline-block rounded border-dashed" /> Target</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={wasteCollectionTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="target" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4" fill="none" name="Target" />
              <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2.5} fill="url(#gradCollected)" name="Collected" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Today's Routes */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Today's Routes</h2>
            <Link to="/official/collection" className="text-emerald-600 text-xs font-medium hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3 flex-1">
            {collectionSchedule.map(route => {
              const pct = Math.round((route.stopsDone / route.totalStops) * 100);
              return (
                <div key={route.id} className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700 truncate pr-2">{route.collector}</span>
                    <StatusBadge status={route.status} size="xs" />
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{route.route}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full">
                      <div
                        className="h-1.5 bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{route.stopsDone}/{route.totalStops}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Recent Complaints */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Recent Complaints</h2>
            <Link to="/official/reports" className="text-emerald-600 text-xs font-medium hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-1">
            {barangayComplaints.slice(0, 4).map(c => (
              <Link
                key={c.id}
                to="/official/reports"
                className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${priorityDot[c.priority] ?? 'bg-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{c.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.date} · {c.zone}</p>
                </div>
                <StatusBadge status={c.status} size="xs" />
              </Link>
            ))}
          </div>
        </div>

        {/* Sensor Status */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Sensor Status</h2>
            <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-medium">
              {barangaySensors.filter(s => s.status === 'online').length}/{barangaySensors.length} Online
            </span>
          </div>
          <div className="space-y-2.5">
            {barangaySensors.map(sensor => (
              <div
                key={sensor.id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${sensor.status === 'online' ? 'border-emerald-100 bg-emerald-50/40' : 'border-red-100 bg-red-50/40'}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${sensor.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{sensor.location}</p>
                  <p className="text-xs text-slate-400">{sensor.type} · {sensor.lastReading}</p>
                </div>
                <span className={`text-xs font-medium shrink-0 ${sensor.battery < 20 ? 'text-red-500' : 'text-slate-400'}`}>
                  {sensor.battery}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {quickActions.map(action => (
              <Link
                key={action.label}
                to={action.to}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all group"
              >
                <div className={`w-8 h-8 ${action.iconBg} rounded-lg flex items-center justify-center shrink-0`}>
                  <action.icon className={`w-4 h-4 ${action.iconColor}`} />
                </div>
                <span className="text-sm font-medium text-slate-700 flex-1">{action.label}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
