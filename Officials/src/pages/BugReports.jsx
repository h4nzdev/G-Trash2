import { useState, useEffect, useMemo } from 'react';
import { Bug, Search, RefreshCw, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import axios from 'axios';
import API from '../config';

const SEVERITY_STYLES = {
  low:      { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  medium:   { badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  high:     { badge: 'bg-red-100 text-red-700',         dot: 'bg-red-500' },
  critical: { badge: 'bg-purple-100 text-purple-700',   dot: 'bg-purple-600' },
};

const STATUS_STYLES = {
  open:        { badge: 'bg-slate-100 text-slate-600',   icon: AlertTriangle, label: 'Open' },
  'in-progress': { badge: 'bg-blue-100 text-blue-700',   icon: Clock,         label: 'In Progress' },
  resolved:    { badge: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Resolved' },
  closed:      { badge: 'bg-slate-100 text-slate-500',   icon: XCircle,       label: 'Closed' },
};

const STATUS_OPTIONS = ['open', 'in-progress', 'resolved', 'closed'];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function BugReports() {
  const [bugs,     setBugs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [updating, setUpdating] = useState(null);

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/bugs`);
      setBugs(data);
    } catch (err) {
      console.error('Failed to fetch bug reports:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBugs(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bugs.filter((b) => {
      if (filterSeverity && b.severity !== filterSeverity) return false;
      if (filterStatus   && b.status   !== filterStatus)   return false;
      if (q && !(
        b.title?.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q) ||
        b.reportedBy?.toLowerCase().includes(q) ||
        b.platform?.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [bugs, search, filterSeverity, filterStatus]);

  const stats = useMemo(() => ({
    total:      bugs.length,
    open:       bugs.filter((b) => b.status === 'open').length,
    inProgress: bugs.filter((b) => b.status === 'in-progress').length,
    critical:   bugs.filter((b) => b.severity === 'critical').length,
  }), [bugs]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      const { data } = await axios.patch(`${API}/api/bugs/${id}`, { status });
      setBugs((prev) => prev.map((b) => (b._id === id ? data : b)));
    } catch (err) {
      console.error('Failed to update bug status:', err.message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="p-6 space-y-6">

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Reports', value: stats.total,      color: 'bg-slate-100 text-slate-600' },
          { label: 'Open',          value: stats.open,       color: 'bg-amber-100 text-amber-700' },
          { label: 'In Progress',   value: stats.inProgress, color: 'bg-blue-100 text-blue-700' },
          { label: 'Critical',      value: stats.critical,   color: 'bg-purple-100 text-purple-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '…' : value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Bug Reports</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading ? 'Loading…' : `${filtered.length} report${filtered.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              onClick={fetchBugs}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search title, reporter…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 w-52"
              />
            </div>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_STYLES[s]?.label ?? s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Title', 'Severity', 'Status', 'Platform', 'Reporter', 'Submitted', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3 bg-slate-100 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Bug className="w-8 h-8 text-slate-300" />
                      <p className="text-sm text-slate-400 font-medium">No bug reports found</p>
                      <p className="text-xs text-slate-400">Adjust your filters or check back later</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((bug) => {
                  const sev    = SEVERITY_STYLES[bug.severity] ?? SEVERITY_STYLES.medium;
                  const status = STATUS_STYLES[bug.status] ?? STATUS_STYLES.open;
                  const StatusIcon = status.icon;
                  return (
                    <tr key={bug._id} className="hover:bg-slate-50 transition-colors">
                      {/* Title + description */}
                      <td className="px-5 py-3.5 max-w-[220px]">
                        <p className="text-sm font-semibold text-slate-900 truncate">{bug.title}</p>
                        {bug.description && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{bug.description}</p>
                        )}
                      </td>

                      {/* Severity */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${sev.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                          {bug.severity ?? 'medium'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${status.badge}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>

                      {/* Platform */}
                      <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                        {bug.platform || '—'}
                      </td>

                      {/* Reporter */}
                      <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">
                        {bug.reportedBy || 'Anonymous'}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(bug.createdAt)}
                      </td>

                      {/* Status update */}
                      <td className="px-5 py-3.5">
                        <select
                          value={bug.status ?? 'open'}
                          disabled={updating === bug._id}
                          onChange={(e) => updateStatus(bug._id, e.target.value)}
                          className="text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 disabled:opacity-50 cursor-pointer"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{STATUS_STYLES[s]?.label ?? s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
