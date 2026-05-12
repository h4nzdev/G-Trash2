import { useState, useEffect, useRef } from 'react';
import { Scale, Truck, AlertTriangle, TrendingUp, Calendar, ChevronRight, Radio, Wind, Thermometer, Droplets, Gauge, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { io } from 'socket.io-client';
import StatCard from '../components/dashboard/StatCard';
import PollutionChart from '../components/dashboard/PollutionChart';
import RecentAlerts from '../components/dashboard/RecentAlerts';
import BarangayRanking from '../components/dashboard/BarangayRanking';
import { barangays, wasteByBarangay } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import API from '../config';

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2">
      <p className="text-xs font-bold text-slate-700">{label}</p>
      <p className="text-xs text-emerald-600 font-semibold">{payload[0].value.toLocaleString()} kg</p>
    </div>
  );
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OfficialsDashboard() {
  const { official } = useAuth();
  const socketRef = useRef(null);

  // IoT live state
  const [iotSummary, setIotSummary] = useState({ totalSensors: 0, recentReadings: 0, activeAlerts: 0, criticalAlerts: 0 });
  const [pollutionData, setPollutionData] = useState([]);
  const [iotAlerts, setIotAlerts] = useState([]);
  const [latestReadings, setLatestReadings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Existing stats
  const [stats, setStats] = useState({ totalFleet: 0, activeTrucks: 0, totalReports: 0, pendingReports: 0 });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [summaryRes, trendsRes, alertsRes, latestRes, statsRes] = await Promise.all([
        fetch(`${API}/api/iot/summary`).then(r => r.json()),
        fetch(`${API}/api/iot/trends?hours=168`).then(r => r.json()),
        fetch(`${API}/api/iot/alerts?limit=10`).then(r => r.json()),
        fetch(`${API}/api/iot/readings/latest`).then(r => r.json()),
        fetch(`${API}/api/stats`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('gtrash_token')}` }
        }).then(r => r.ok ? r.json() : { totalFleet: 0, activeTrucks: 0, totalReports: 0, pendingReports: 0 }),
      ]);
      setIotSummary(summaryRes);
      setPollutionData(Array.isArray(trendsRes) ? trendsRes : []);
      setIotAlerts(Array.isArray(alertsRes) ? alertsRes : []);
      setLatestReadings(Array.isArray(latestRes) ? latestRes : []);
      setStats(statsRes);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    const socket = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    // Real-time IoT reading updates
    socket.on('iot:reading', (reading) => {
      setLatestReadings(prev => {
        const filtered = prev.filter(r => r.sensorId !== reading.sensorId);
        return [reading, ...filtered];
      });
      setIotSummary(prev => ({ ...prev, recentReadings: prev.recentReadings + 1 }));
    });

    // Real-time IoT alerts
    socket.on('iot:alert', (alert) => {
      setIotAlerts(prev => [alert, ...prev].slice(0, 10));
      setIotSummary(prev => ({
        ...prev,
        activeAlerts: prev.activeAlerts + 1,
        criticalAlerts: alert.severity === 'critical' ? prev.criticalAlerts + 1 : prev.criticalAlerts,
      }));
    });

    // New reports (auto or manual)
    socket.on('report:new', () => {
      setStats(prev => ({ ...prev, totalReports: prev.totalReports + 1, pendingReports: prev.pendingReports + 1 }));
    });

    return () => socket.disconnect();
  }, []);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const weekNum = Math.ceil((new Date().getDate() + new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay()) / 7);

  // Transform IoT alerts for the RecentAlerts component
  const formattedAlerts = iotAlerts.slice(0, 5).map((a, i) => ({
    id: a._id || i,
    location: `${a.location || 'Unknown'}${a.barangay ? `, ${a.barangay}` : ''}`,
    time: timeAgo(a.createdAt),
    severity: a.severity,
    message: a.message,
  }));

  // Air quality indicator
  const worstAQ = latestReadings.reduce((worst, r) => {
    const order = { Hazardous: 4, Unhealthy: 3, Moderate: 2, Good: 1 };
    return (order[r.airQuality] || 0) > (order[worst] || 0) ? r.airQuality : worst;
  }, 'Good');

  const aqColor = { Good: 'green', Moderate: 'amber', Unhealthy: 'red', Hazardous: 'red' };

  return (
    <div className="p-6 space-y-6">
      {/* Date Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {today} · Week {weekNum}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors border border-emerald-200">
            Generate Report <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Radio}
          title="IoT Sensors Active"
          value={iotSummary.totalSensors}
          subtitle={`${iotSummary.recentReadings} readings in last hour`}
          color="blue"
        />
        <StatCard
          icon={Truck}
          title="Active Trucks"
          value={`${stats.activeTrucks}/${stats.totalFleet}`}
          subtitle="On route"
          color="green"
        />
        <StatCard
          icon={AlertTriangle}
          title="Active IoT Alerts"
          value={iotSummary.activeAlerts}
          subtitle={`${iotSummary.criticalAlerts} critical`}
          color={iotSummary.criticalAlerts > 0 ? 'red' : 'amber'}
        />
        <StatCard
          icon={Wind}
          title="Air Quality"
          value={worstAQ}
          subtitle={latestReadings.length > 0 ? `Across ${latestReadings.length} sensor${latestReadings.length > 1 ? 's' : ''}` : 'No sensor data yet'}
          color={aqColor[worstAQ] || 'green'}
        />
      </div>

      {/* Live Sensor Readings Strip */}
      {latestReadings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {latestReadings.map((r) => {
            const aqStyles = {
              Good: 'border-emerald-200 bg-emerald-50/50',
              Moderate: 'border-amber-200 bg-amber-50/50',
              Unhealthy: 'border-red-200 bg-red-50/50',
              Hazardous: 'border-red-300 bg-red-100/60',
            };
            const aqDot = {
              Good: 'bg-emerald-500',
              Moderate: 'bg-amber-500',
              Unhealthy: 'bg-red-500',
              Hazardous: 'bg-red-600 animate-pulse',
            };
            return (
              <div
                key={r.sensorId}
                className={`rounded-xl border p-3.5 transition-all hover:shadow-md ${aqStyles[r.airQuality] || 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-800">{r.sensorId}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${aqDot[r.airQuality]}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      r.airQuality === 'Good' ? 'text-emerald-700' :
                      r.airQuality === 'Moderate' ? 'text-amber-700' : 'text-red-700'
                    }`}>{r.airQuality}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mb-2 truncate">📍 {r.location || 'Unknown Location'}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-medium">NH₃</p>
                    <p className={`text-sm font-bold ${r.ammonia >= 25 ? 'text-red-600' : 'text-slate-800'}`}>{r.ammonia}<span className="text-[9px] text-slate-400 ml-0.5">ppm</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-medium">CH₄</p>
                    <p className={`text-sm font-bold ${r.methane >= 1.5 ? 'text-red-600' : 'text-slate-800'}`}>{r.methane}<span className="text-[9px] text-slate-400 ml-0.5">%</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-medium">Bin</p>
                    <p className={`text-sm font-bold ${r.binLevel >= 70 ? 'text-amber-600' : 'text-slate-800'}`}>{r.binLevel}<span className="text-[9px] text-slate-400 ml-0.5">%</span></p>
                  </div>
                </div>
                {(r.temperature > 0 || r.humidity > 0) && (
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Thermometer className="w-3 h-3" /> {r.temperature}°C
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3" /> {r.humidity}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pollution Trends — LIVE from IoT */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Pollution Trends
                {pollutionData.length > 0 && (
                  <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> LIVE
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {pollutionData.length > 0
                  ? `Ammonia & methane levels — ${pollutionData.length} data points`
                  : 'No IoT sensor data yet — send data via Postman to see trends'}
              </p>
            </div>
          </div>
          {pollutionData.length > 0 ? (
            <PollutionChart data={pollutionData} />
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-slate-400">
              <Gauge className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium">No sensor data yet</p>
              <p className="text-xs mt-1">POST to /api/iot/sensor-data to start tracking</p>
            </div>
          )}
        </div>

        {/* Waste by Barangay */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Waste by Barangay</h2>
              <p className="text-xs text-slate-500 mt-0.5">Top 5 barangays by collection weight</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={wasteByBarangay}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} width={65} />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {wasteByBarangay.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={index === 0 ? '#065f46' : index === 1 ? '#047857' : index === 2 ? '#059669' : index === 3 ? '#10b981' : '#34d399'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* IoT Alerts — LIVE */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                IoT Sensor Alerts
                {iotAlerts.length > 0 && (
                  <span className="text-[10px] font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                    {iotAlerts.filter(a => !a.acknowledged).length} active
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {iotAlerts.length > 0 ? 'Real-time pollution and threshold events' : 'Alerts from IoT sensors will appear here'}
              </p>
            </div>
            <button className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {formattedAlerts.length > 0 ? (
            <RecentAlerts alerts={formattedAlerts} />
          ) : (
            <div className="py-8 text-center text-slate-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No alerts yet</p>
              <p className="text-xs mt-1">Send sensor data with high readings to trigger alerts</p>
            </div>
          )}
        </div>

        {/* Top Barangays */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Top Performing Barangays</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ranked by collection rate and efficiency</p>
            </div>
            <button className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
              Full rankings <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <BarangayRanking data={barangays} />
        </div>
      </div>
    </div>
  );
}
