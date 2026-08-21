import { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, Filter, CheckCircle, Clock, ShieldAlert, AlertCircle, Search, RefreshCw } from 'lucide-react';
import API from '../config';

export default function AlertsManagement() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, unacknowledged, acknowledged

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/iot/alerts?limit=500`);
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleAcknowledge = async (id) => {
    try {
      await axios.patch(`${API}/api/iot/alerts/${id}/acknowledge`);
      // Update local state
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, acknowledged: true } : a));
    } catch (err) {
      console.error('Failed to acknowledge alert', err);
    }
  };

  // Filter Logic
  const filtered = alerts.filter(a => {
    const matchesSearch = 
      (a.sensorId && a.sensorId.toLowerCase().includes(search.toLowerCase())) ||
      (a.message && a.message.toLowerCase().includes(search.toLowerCase())) ||
      (a.location && a.location.toLowerCase().includes(search.toLowerCase()));
      
    const matchesSev = severityFilter === 'all' || a.severity === severityFilter;
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'acknowledged' && a.acknowledged) ||
      (statusFilter === 'unacknowledged' && !a.acknowledged);

    return matchesSearch && matchesSev && matchesStatus;
  });

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    unack: alerts.filter(a => !a.acknowledged).length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shadow-sm border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          System Alerts & Monitoring
        </h1>
        <p className="text-slate-500 text-xs mt-1 ml-12">Track, filter, and resolve automated IoT and system notifications.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Alerts</p>
            <p className="text-2xl font-black text-slate-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-red-500 font-bold uppercase tracking-wider">Critical</p>
            <p className="text-2xl font-black text-red-700">{stats.critical}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">Requires Action</p>
            <p className="text-2xl font-black text-amber-700">{stats.unack}</p>
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-full max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search alerts..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={severityFilter} 
                onChange={e => setSeverityFilter(e.target.value)}
                className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="moderate">Moderate</option>
                <option value="low">Low</option>
              </select>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Statuses</option>
                <option value="unacknowledged">Unacknowledged</option>
                <option value="acknowledged">Acknowledged</option>
              </select>
            </div>
          </div>
          
          <button 
            onClick={fetchAlerts}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Table List */}
        <div className="flex-1 overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-emerald-600" />
              <p className="text-sm font-semibold">Loading alerts...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mb-4" />
              <p className="text-sm font-bold text-slate-800">All Clear!</p>
              <p className="text-xs mt-1 max-w-sm">No alerts match your current filters. Everything is running smoothly.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Severity</th>
                  <th className="px-6 py-4">Location / Sensor</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(alert => (
                  <tr key={alert._id} className={`hover:bg-slate-50 transition-colors ${!alert.acknowledged ? 'bg-orange-50/30' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-bold text-slate-900">{new Date(alert.createdAt).toLocaleDateString()}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{new Date(alert.createdAt).toLocaleTimeString()}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        alert.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${alert.severity === 'critical' ? 'bg-red-500' : alert.severity === 'moderate' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">{alert.location || 'Unknown Area'}</p>
                      <p className="text-xs text-slate-500 font-medium font-mono">{alert.sensorId}</p>
                    </td>
                    <td className="px-6 py-4 min-w-[250px]">
                      <p className={`text-sm font-semibold ${!alert.acknowledged ? 'text-slate-900' : 'text-slate-600'}`}>{alert.message}</p>
                      {alert.gasType && (
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold text-slate-500">
                          <span className="uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 rounded">{alert.gasType}</span>
                          <span>Value: {alert.value}</span>
                          <span className="text-slate-300">|</span>
                          <span>Threshold: {alert.threshold}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {alert.acknowledged ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 px-3 py-1.5">
                          <CheckCircle className="w-4 h-4" /> Resolved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAcknowledge(alert._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
