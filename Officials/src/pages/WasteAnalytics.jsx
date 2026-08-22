import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, MapPin, TrendingUp, AlertTriangle, Truck } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import API from '../config';
import { useAuth } from '../context/AuthContext';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl px-4 py-3">
      <p className="text-sm font-bold text-slate-800 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600 font-medium">{entry.name}:</span>
          <span className="text-slate-900 font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function WasteAnalytics() {
  const { official } = useAuth();
  const [trends, setTrends] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [stats, setStats] = useState([]);
  const [sitios, setSitios] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const brgyParam = official?.barangay && official.barangay !== 'All' ? `?barangay=${encodeURIComponent(official.barangay)}` : '';
      const [trendsRes, hotspotsRes, statsRes, sitiosRes] = await Promise.all([
        fetch(`${API}/api/analytics/report-trends${brgyParam}`),
        fetch(`${API}/api/analytics/hotspots${brgyParam}`),
        fetch(`${API}/api/analytics/collection-stats${brgyParam}`),
        fetch(`${API}/api/analytics/sitios${brgyParam}`)
      ]);

      setTrends(await trendsRes.json());
      setHotspots(await hotspotsRes.json());
      setStats(await statsRes.json());
      setSitios(await sitiosRes.json());
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [official]);

  const totalReports = trends.reduce((acc, curr) => {
    const vals = Object.values(curr).filter(v => typeof v === 'number');
    return acc + vals.reduce((a, b) => a + b, 0);
  }, 0);

  const totalStops = stats.reduce((acc, curr) => acc + (curr.stopsCleared || 0), 0);
  const topHotspot = hotspots.length > 0 ? hotspots[0] : null;

  return (
    <div className="p-6 mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-emerald-600" />
            Waste Intelligence
          </h1>
          <p className="text-sm text-slate-500 mt-1">Automated tracking of community waste problems and collection efficiency</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl shadow-sm transition-all active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-white to-rose-50/50 rounded-2xl border border-rose-100 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <AlertTriangle className="w-24 h-24 text-rose-600" />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{loading ? '...' : totalReports}</p>
            <p className="text-sm font-semibold text-slate-600">Total Problem Reports</p>
            <p className="text-xs text-rose-500 font-medium mt-1">Last 30 Days</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-emerald-50/50 rounded-2xl border border-emerald-100 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Truck className="w-24 h-24 text-emerald-600" />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
              <Truck className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{loading ? '...' : totalStops}</p>
            <p className="text-sm font-semibold text-slate-600">Collection Stops Cleared</p>
            <p className="text-xs text-emerald-500 font-medium mt-1">Last 30 Days</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-amber-50/50 rounded-2xl border border-amber-100 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <MapPin className="w-24 h-24 text-amber-600" />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-xl font-bold text-slate-900 truncate">{loading ? '...' : (topHotspot ? topHotspot.barangay : 'None')}</p>
            <p className="text-sm font-semibold text-slate-600">Top Chronic Hotspot</p>
            <p className="text-xs text-amber-600 font-medium mt-1">{loading ? '...' : (topHotspot ? `${topHotspot.reportCount} reports` : '')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Report Trends Chart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            Resident Reports Trend
          </h2>
          <div className="h-72">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : trends.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOverflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDumping" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                  <Area type="monotone" dataKey="Overflowing Bin" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorOverflow)" />
                  <Area type="monotone" dataKey="Illegal Dumping" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorDumping)" />
                  <Area type="monotone" dataKey="Other" stroke="#f59e0b" strokeWidth={3} fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Collection Stats Chart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-500" />
            Collection Output
          </h2>
          <div className="h-72">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : stats.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                  <Bar dataKey="stopsCleared" name="Stops Cleared" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                  <Bar dataKey="binsCleared" name="Bins Cleared" fill="#34d399" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Hotspots Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Chronic Hotspots (Last 30 Days)
          </h2>
          <p className="text-sm text-slate-500 mt-1">Areas with the highest concentration of community reports.</p>
        </div>
        
        {loading ? (
          <div className="py-12 flex justify-center">
             <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hotspots.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No hotspots identified.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold">
                <tr>
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Barangay</th>
                  <th className="px-6 py-4">Location / Street</th>
                  <th className="px-6 py-4 text-right">Report Count</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hotspots.map((hotspot, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-400">#{index + 1}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{hotspot.barangay}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{hotspot.location}</td>
                    <td className="px-6 py-4 text-sm font-bold text-rose-600 text-right">{hotspot.reportCount}</td>
                    <td className="px-6 py-4">
                      {index < 3 ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">Critical</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Elevated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sitio Analytics Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-6">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            Sitio Environmental Intelligence
          </h2>
          <p className="text-sm text-slate-500 mt-1">Real-time status of IoT gas sensors and community reports by Sitio.</p>
        </div>
        
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sitios.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No Sitios active in this barangay.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold">
                <tr>
                  <th className="px-6 py-4">Sitio</th>
                  <th className="px-6 py-4 text-center">IoT Gas Sensor</th>
                  <th className="px-6 py-4 text-center">Ammonia (NH₃)</th>
                  <th className="px-6 py-4 text-center">Methane (CH₄)</th>
                  <th className="px-6 py-4 text-center">Active Reports</th>
                  <th className="px-6 py-4 text-center">Resolved Reports</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sitios.map((s, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{s.sitio}</td>
                    <td className="px-6 py-4 text-center">
                      {s.hasSensor ? (
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                          s.status === 'critical' 
                            ? 'bg-rose-100 text-rose-700' 
                            : s.status === 'moderate' 
                              ? 'bg-amber-100 text-amber-700' 
                              : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-400">No Sensor</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 text-center font-semibold">{s.ammonia}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 text-center font-semibold">{s.methane}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-bold ${s.pendingReports > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {s.pendingReports}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-emerald-600">{s.resolvedReports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
