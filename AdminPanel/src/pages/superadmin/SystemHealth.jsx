import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  Activity, Server, Database, Wifi, AlertTriangle,
  CheckCircle2, XCircle, Clock, RefreshCcw, ChevronDown,
  ChevronUp, Shield, Users, Cpu, MemoryStick, Globe,
  BarChart3, Filter, X, AlertCircle, Info, Zap
} from 'lucide-react';
import API from '../../config';

// ─── helpers ────────────────────────────────────────────────────────────────

function statusColor(status) {
  if (status === 'online' || status === 'connected') return 'emerald';
  if (status === 'degraded' || status === 'connecting') return 'amber';
  return 'red';
}

function errRateColor(rate) {
  if (rate < 1) return 'emerald';
  if (rate < 5) return 'amber';
  return 'red';
}

function memColor(pct) {
  if (pct < 60) return '#10b981';
  if (pct < 85) return '#f59e0b';
  return '#ef4444';
}

function severityStyle(sev) {
  switch (sev) {
    case 'error':   return 'bg-red-100 text-red-700 border border-red-200';
    case 'warning': return 'bg-amber-100 text-amber-700 border border-amber-200';
    default:        return 'bg-blue-100 text-blue-700 border border-blue-200';
  }
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Circular gauge ─────────────────────────────────────────────────────────

function Gauge({ value, label, unit = '%' }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const dash = (pct / 100) * circ;
  const color = memColor(pct);
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="55" cy="55" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="55" y="50" textAnchor="middle" className="font-black" style={{ fontSize: 18, fontWeight: 800, fill: '#0f172a' }}>
          {pct.toFixed(1)}
        </text>
        <text x="55" y="65" textAnchor="middle" style={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}>
          {unit}
        </text>
      </svg>
      <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">{label}</p>
    </div>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const c = statusColor(status);
  const Icon = status === 'online' || status === 'connected' ? CheckCircle2 : status === 'degraded' ? AlertTriangle : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-${c}-100 text-${c}-700`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SystemHealth() {
  const [health, setHealth] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logFilter, setLogFilter] = useState({ severity: '', resolved: '' });
  const [expandedLog, setExpandedLog] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [alerts, setAlerts] = useState([]); // threshold banners
  const [sortCol, setSortCol] = useState('requests');
  const [sortDir, setSortDir] = useState('desc');
  const [seeding, setSeeding] = useState(false);
  const socketRef = useRef(null);

  const fetchHealth = useCallback(async () => {
    try {
      const [hRes, sRes] = await Promise.all([
        axios.get(`${API}/api/admin/system-health`),
        axios.get(`${API}/api/admin/active-sessions`),
      ]);
      setHealth(hRes.data);
      setSessions(sRes.data);
      setLastUpdated(new Date());
      checkThresholds(hRes.data);
    } catch (err) {
      console.error('Health fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const params = { page: logsPage, limit: 15 };
      if (logFilter.severity) params.severity = logFilter.severity;
      if (logFilter.resolved !== '') params.resolved = logFilter.resolved;
      const { data } = await axios.get(`${API}/api/admin/error-logs`, { params });
      setLogs(data.logs);
      setLogsTotal(data.total);
    } catch (err) {
      console.error('Logs fetch failed', err);
    }
  }, [logsPage, logFilter]);

  function checkThresholds(h) {
    const newAlerts = [];
    if (h.server.memoryUsage.percentage > 85)
      newAlerts.push({ id: 'mem', msg: `Memory critical: ${h.server.memoryUsage.percentage}%`, color: 'red' });
    if (h.server.cpuUsage.percentage > 90)
      newAlerts.push({ id: 'cpu', msg: `CPU critical: ${h.server.cpuUsage.percentage}%`, color: 'red' });
    if (h.api.errorRate24h > 5)
      newAlerts.push({ id: 'err', msg: `API error rate critical: ${h.api.errorRate24h}%`, color: 'red' });
    if (h.database.status !== 'connected')
      newAlerts.push({ id: 'db', msg: 'Database connection issue!', color: 'red' });
    Object.entries(h.externalServices || {}).forEach(([svc, info]) => {
      if (info.status === 'down')
        newAlerts.push({ id: svc, msg: `${svc} is down`, color: 'amber' });
    });
    setAlerts(newAlerts);
  }

  useEffect(() => {
    fetchHealth();
    fetchLogs();

    // Real-time socket
    const socket = io(API);
    socketRef.current = socket;
    socket.emit('session:register', { role: 'superadmin' });

    socket.on('system:health:update', (data) => {
      setHealth(data);
      setLastUpdated(new Date());
      checkThresholds(data);
    });
    socket.on('system:error:new', (log) => {
      setLogs(prev => [log, ...prev].slice(0, 15));
      setLogsTotal(prev => prev + 1);
    });

    // Poll every 30s as fallback
    const interval = setInterval(fetchHealth, 30000);
    return () => { socket.disconnect(); clearInterval(interval); };
  }, [fetchHealth]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const resolveLog = async (id) => {
    setResolving(id);
    try {
      const { data } = await axios.patch(`${API}/api/admin/error-logs/${id}/resolve`);
      setLogs(prev => prev.map(l => l._id === id ? data : l));
    } catch (err) {
      console.error(err);
    } finally {
      setResolving(null);
    }
  };

  const seedLogs = async () => {
    setSeeding(true);
    try {
      await axios.post(`${API}/api/admin/error-logs/seed`);
      fetchLogs();
    } catch (err) { console.error(err); }
    finally { setSeeding(false); }
  };

  // Sort API endpoints table
  const sortedEndpoints = [...(health?.api?.endpoints || [])].sort((a, b) => {
    const va = typeof a[sortCol] === 'string' ? parseInt(a[sortCol]) : a[sortCol];
    const vb = typeof b[sortCol] === 'string' ? parseInt(b[sortCol]) : b[sortCol];
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />;
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { server, database, api, externalServices } = health || {};

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Threshold Alert Banners */}
      {alerts.map(a => (
        <div key={a.id} className={`flex items-center gap-3 px-5 py-3 rounded-2xl border font-bold text-sm ${
          a.color === 'red' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="flex-1">{a.msg}</span>
          <button onClick={() => setAlerts(prev => prev.filter(x => x.id !== a.id))}>
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Health</h2>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Real-time platform monitoring · Last updated {lastUpdated ? timeAgo(lastUpdated) : '—'}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ── Status Overview Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Server */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
              <Server className="w-4 h-4" /> Server
            </div>
            <StatusBadge status={server?.status} />
          </div>
          <p className="text-2xl font-black text-slate-900">{server?.uptime || '—'}</p>
          <p className="text-xs text-slate-400 font-medium">Uptime · {server?.nodeVersion}</p>
        </div>

        {/* Database */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
              <Database className="w-4 h-4" /> Database
            </div>
            <StatusBadge status={database?.status} />
          </div>
          <p className="text-2xl font-black text-slate-900">{database?.latency || '—'}</p>
          <p className="text-xs text-slate-400 font-medium">Latency · MongoDB</p>
        </div>

        {/* API Health */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
              <Activity className="w-4 h-4" /> API
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-${errRateColor(api?.errorRate24h || 0)}-100 text-${errRateColor(api?.errorRate24h || 0)}-700`}>
              {api?.errorRate24h ?? '—'}% errors
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900">{api?.averageResponseTime || '—'}</p>
          <p className="text-xs text-slate-400 font-medium">{api?.totalRequests24h?.toLocaleString() || 0} requests / 24h</p>
        </div>

        {/* Active Users */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
              <Users className="w-4 h-4" /> Sessions
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Live</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{sessions?.total ?? '—'}</p>
          <p className="text-xs text-slate-400 font-medium">Active socket connections</p>
        </div>
      </div>

      {/* ── Resources + Sessions ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Memory + CPU gauges */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Cpu className="w-4 h-4" /> System Resources
            <span className="ml-auto text-[10px] text-slate-400 font-medium normal-case">Updates every 30s</span>
          </h3>
          <div className="flex items-center justify-around">
            <Gauge value={server?.memoryUsage?.percentage} label="Memory" />
            <div className="text-center px-6 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Memory</p>
              <p className="text-sm font-bold text-slate-800">{server?.memoryUsage?.used} / {server?.memoryUsage?.total}</p>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{ width: `${server?.memoryUsage?.percentage || 0}%`, backgroundColor: memColor(server?.memoryUsage?.percentage || 0) }}
                />
              </div>
            </div>
            <Gauge value={server?.cpuUsage?.percentage} label="CPU" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Safe', color: '#10b981', range: '0–60%' },
              { label: 'Warning', color: '#f59e0b', range: '60–85%' },
              { label: 'Critical', color: '#ef4444', range: '85–100%' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                {l.label} ({l.range})
              </div>
            ))}
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Wifi className="w-4 h-4" /> Active Sessions
          </h3>
          <div className="space-y-3">
            {[
              { icon: '📱', label: 'Residents', key: 'residents' },
              { icon: '🚛', label: 'Drivers', key: 'drivers' },
              { icon: '🏛️', label: 'Officials', key: 'officials' },
              { icon: '⚙️', label: 'Admins', key: 'admins' },
              { icon: '🏥', label: 'CHD', key: 'chd' },
            ].map(r => (
              <div key={r.key} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">{r.icon} {r.label}</span>
                <span className="text-sm font-black text-slate-900">{sessions?.[r.key] ?? 0}</span>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Total</span>
              <span className="text-lg font-black text-emerald-600">{sessions?.total ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── External Services ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4" /> External Services
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: 'cloudinary', label: 'Cloudinary', icon: '☁️' },
            { key: 'groqApi', label: 'Groq AI', icon: '🤖' },
            { key: 'geminiApi', label: 'Gemini AI', icon: '✨' },
            { key: 'socketio', label: 'Socket.io', icon: '⚡' },
          ].map(svc => {
            const info = externalServices?.[svc.key] || {};
            const isUp = info.status === 'connected';
            return (
              <div key={svc.key} className={`rounded-xl border p-4 ${isUp ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{svc.icon}</span>
                  {isUp
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    : <XCircle className="w-4 h-4 text-red-600" />}
                </div>
                <p className="text-sm font-bold text-slate-900">{svc.label}</p>
                <p className={`text-xs font-medium mt-0.5 ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
                  {info.status || 'unknown'}
                  {info.latency && info.latency !== 'N/A' ? ` · ${info.latency}` : ''}
                  {info.activeConnections != null ? ` · ${info.activeConnections} conns` : ''}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── API Performance Table ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> API Performance (24h)
          </h3>
          <span className="text-xs text-slate-400 font-medium">Click column to sort</span>
        </div>
        {sortedEndpoints.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Activity className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No API traffic recorded yet. Make some requests to populate this table.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Endpoint</th>
                  {[
                    { col: 'requests', label: 'Requests' },
                    { col: 'avgTime', label: 'Avg Time' },
                    { col: 'errors', label: 'Errors' },
                    { col: 'errorRate', label: 'Error Rate' },
                  ].map(h => (
                    <th key={h.col}
                      onClick={() => toggleSort(h.col)}
                      className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                    >
                      <span className="flex items-center gap-1">{h.label}<SortIcon col={h.col} /></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedEndpoints.map((ep, i) => {
                  const highErr = ep.errorRate > 5;
                  return (
                    <tr key={i} className={highErr ? 'bg-red-50/60' : 'hover:bg-slate-50'}>
                      <td className="px-6 py-3">
                        <span className="mr-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{ep.method}</span>
                        <span className="font-mono text-slate-700 text-xs">{ep.path}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">{ep.requests.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-600">{ep.avgTime}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{ep.errors}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          ep.errorRate > 5 ? 'bg-red-100 text-red-700' : ep.errorRate > 1 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {ep.errorRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Error Logs ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2 mr-auto">
            <AlertCircle className="w-4 h-4" /> Error Logs
            <span className="ml-2 text-xs font-medium text-slate-400 normal-case">{logsTotal} total</span>
          </h3>

          {/* Severity filter */}
          <select
            value={logFilter.severity}
            onChange={e => { setLogFilter(f => ({ ...f, severity: e.target.value })); setLogsPage(1); }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-600 bg-white"
          >
            <option value="">All Severities</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          {/* Resolved filter */}
          <select
            value={logFilter.resolved}
            onChange={e => { setLogFilter(f => ({ ...f, resolved: e.target.value })); setLogsPage(1); }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-600 bg-white"
          >
            <option value="">All Status</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
          </select>

          <button
            onClick={seedLogs}
            disabled={seeding}
            className="text-xs px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            {seeding ? 'Seeding…' : '+ Seed Test Logs'}
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Shield className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No logs found. Use "Seed Test Logs" to populate sample data.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {logs.map(log => (
              <div key={log._id} className={`${log.resolved ? 'opacity-60' : ''}`}>
                <div
                  className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}
                >
                  <span className={`mt-0.5 text-[10px] font-bold px-2 py-1 rounded-full uppercase shrink-0 ${severityStyle(log.severity)}`}>
                    {log.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-slate-500">{log.source}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{timeAgo(log.timestamp)}</span>
                    </div>
                    <p className="text-sm text-slate-800 font-medium truncate">{log.message}</p>
                    {expandedLog === log._id && log.stack && (
                      <pre className="mt-3 text-xs font-mono bg-slate-900 text-emerald-300 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">
                        {log.stack}
                      </pre>
                    )}
                    {expandedLog === log._id && log.resolved && (
                      <p className="mt-2 text-xs text-emerald-600 font-medium">
                        ✓ Resolved by {log.resolvedBy || 'Admin'} · {timeAgo(log.resolvedAt)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {log.resolved ? (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                      </span>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); resolveLog(log._id); }}
                        disabled={resolving === log._id}
                        className="text-xs font-bold px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-all"
                      >
                        {resolving === log._id ? 'Resolving…' : 'Resolve'}
                      </button>
                    )}
                    {expandedLog === log._id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {logsTotal > 15 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">
              Page {logsPage} of {Math.ceil(logsTotal / 15)}
            </p>
            <div className="flex gap-2">
              <button
                disabled={logsPage === 1}
                onClick={() => setLogsPage(p => p - 1)}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <button
                disabled={logsPage >= Math.ceil(logsTotal / 15)}
                onClick={() => setLogsPage(p => p + 1)}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
