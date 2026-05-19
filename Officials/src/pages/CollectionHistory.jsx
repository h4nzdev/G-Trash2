import { useState, useEffect, useMemo } from 'react';
import { Search, Download, Package, Truck, Weight, Archive, Heart, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API from '../config';

const ROWS_PER_PAGE = 10;
const PERIODS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today',    value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
];

const WASTE_COLORS = {
  General:    'bg-slate-100 text-slate-600',
  Recyclable: 'bg-blue-100 text-blue-700',
  Hazardous:  'bg-red-100 text-red-700',
  Organic:    'bg-emerald-100 text-emerald-700',
  Bulky:      'bg-amber-100 text-amber-700',
};

function exportCSV(data) {
  const headers = ['Date', 'Truck ID', 'Stop Name', 'Stop Address', 'Route', 'Waste Type', 'Weight (kg)', 'Bins', 'Completed At'];
  const rows = data.map((r) => [
    r.date,
    r.truckId,
    r.stopName   || '',
    r.stopAddress || '',
    r.routeName  || '',
    r.wasteType  || 'General',
    r.weight     ?? 0,
    r.bins       ?? 0,
    new Date(r.completedAt).toLocaleString(),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `collection-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function CollectionHistory() {
  const { official } = useAuth();
  const isChd = official?.role === 'chd';
  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [period,     setPeriod]     = useState('month');
  const [search,     setSearch]     = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [truckFilter,setTruckFilter]= useState('');
  const [page,       setPage]       = useState(0);
  const [healthAlertOnly, setHealthAlertOnly] = useState(false);

  // Fetch logs whenever period or dateFilter changes
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dateFilter) {
          params.date = dateFilter;
        } else if (period !== 'all') {
          params.period = period;
        }
        if (truckFilter) params.truckId = truckFilter;

        const { data } = await axios.get(`${API}/api/collections`, { params });
        setLogs(data);
      } catch (err) {
        console.error('Failed to fetch collection logs:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [period, dateFilter, truckFilter]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, dateFilter, truckFilter, period]);

  // Unique truck IDs for the filter dropdown
  const truckIds = useMemo(
    () => [...new Set(logs.map((l) => l.truckId))].sort(),
    [logs],
  );

  // Client-side search filter (on top of server-side period/truck filter)
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((r) => {
      const matchSearch = !q ||
        r.truckId?.toLowerCase().includes(q) ||
        r.stopName?.toLowerCase().includes(q) ||
        r.routeName?.toLowerCase().includes(q) ||
        r.wasteType?.toLowerCase().includes(q);
      // CHD health alert filter: show only stops where last collection was > 5 days ago
      const matchHealth = !healthAlertOnly || (daysSince(r.completedAt) > 5);
      return matchSearch && matchHealth;
    });
  }, [logs, search, healthAlertOnly]);

  const paged      = filtered.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);

  // Summary stats — derived from fetched (pre-filtered) logs
  const stats = useMemo(() => {
    const totalWeight = logs.reduce((s, r) => s + (r.weight ?? 0), 0);
    const totalBins   = logs.reduce((s, r) => s + (r.bins   ?? 0), 0);

    const truckCounts = {};
    logs.forEach((r) => { truckCounts[r.truckId] = (truckCounts[r.truckId] || 0) + 1; });
    const mostActive = Object.entries(truckCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return { totalWeight, totalBins, totalStops: logs.length, mostActive };
  }, [logs]);

  const handlePeriodChange = (val) => {
    setPeriod(val);
    setDateFilter(''); // clear specific date when switching period
  };

  const handleDateChange = (val) => {
    setDateFilter(val);
    setPeriod('all'); // clear period when pinning a specific date
  };

  return (
    <div className="p-6 space-y-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: Weight,
            label: 'Total Weight',
            value: loading ? '…' : `${stats.totalWeight.toLocaleString()} kg`,
            color: 'bg-emerald-100 text-emerald-700',
          },
          {
            icon: Package,
            label: 'Total Stops',
            value: loading ? '…' : stats.totalStops.toLocaleString(),
            color: 'bg-blue-100 text-blue-700',
          },
          {
            icon: Truck,
            label: 'Most Active Truck',
            value: loading ? '…' : stats.mostActive,
            color: 'bg-purple-100 text-purple-700',
          },
          {
            icon: Archive,
            label: 'Total Bins',
            value: loading ? '…' : stats.totalBins.toLocaleString(),
            color: 'bg-amber-100 text-amber-700',
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className="text-base font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 space-y-3">

          {/* Title + Export */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Collection Log
                {isChd && <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1"><Heart className="w-3 h-3" /> CHD View</span>}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading ? 'Loading…' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''} found`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isChd && (
                <button
                  onClick={() => setHealthAlertOnly(h => !h)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                    healthAlertOnly
                      ? 'bg-red-600 text-white border-red-600'
                      : 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {healthAlertOnly ? 'Show All' : 'Show Health Alerts'}
                </button>
              )}
              <button
                onClick={() => exportCSV(filtered)}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
          </div>

          {/* Period toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePeriodChange(p.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  period === p.value && !dateFilter
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search stop, route, type…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 w-52"
              />
            </div>

            {/* Truck filter */}
            <select
              value={truckFilter}
              onChange={(e) => setTruckFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
            >
              <option value="">All Trucks</option>
              {truckIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>

            {/* Specific date */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
            />

            {/* Clear date */}
            {dateFilter && (
              <button
                onClick={() => { setDateFilter(''); setPeriod('month'); }}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Clear date
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Date', 'Truck ID', 'Stop Name', 'Route', 'Waste Type', 'Weight', 'Bins', ...(isChd ? ['Days Since'] : [])].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: isChd ? 8 : 7 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3 bg-slate-100 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={isChd ? 8 : 7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-8 h-8 text-slate-300" />
                      <p className="text-sm text-slate-400 font-medium">No collection logs found</p>
                      <p className="text-xs text-slate-400">Try a different period or clear your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((row) => {
                  const days = daysSince(row.completedAt);
                  const isStale = days !== null && days > 5;
                  return (
                  <tr key={row._id} className={`hover:bg-slate-50 transition-colors ${isChd && isStale ? 'bg-red-50/40' : ''}`}>
                    <td className="px-5 py-3.5 text-sm text-slate-700 font-medium whitespace-nowrap">{row.date}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {row.truckId}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-800 font-semibold max-w-[180px] truncate">
                      {row.stopName || <span className="text-slate-400 italic text-xs">No stop name</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 max-w-[160px] truncate">
                      {row.routeName || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${WASTE_COLORS[row.wasteType] ?? WASTE_COLORS.General}`}>
                        {row.wasteType || 'General'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-emerald-700 whitespace-nowrap">
                      {(row.weight ?? 0).toLocaleString()} kg
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">
                      {row.bins ?? 0}
                    </td>
                    {isChd && (
                      <td className="px-5 py-3.5 text-sm font-bold whitespace-nowrap">
                        {days === null ? '—' : (
                          <span className={isStale ? 'text-red-600 flex items-center gap-1' : 'text-slate-500'}>
                            {isStale && <AlertTriangle className="w-3 h-3" />}
                            {days}d ago
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing {page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-8 h-8 text-xs rounded-lg font-semibold transition-colors ${
                    page === i ? 'bg-emerald-700 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
