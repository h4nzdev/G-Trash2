import { useState, useEffect, useMemo } from 'react';
import { Search, Download, Package, Truck, Archive, Heart, AlertTriangle, Camera, X } from 'lucide-react';
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
  const headers = ['Date', 'Truck ID', 'Driver Name', 'Stop Name', 'Stop Address', 'Route', 'Waste Type', 'Bins', 'Completed At'];
  const rows = data.map((r) => [
    r.date,
    r.truckId,
    r.driverName  || '',
    r.stopName   || '',
    r.stopAddress || '',
    r.routeName  || '',
    r.wasteType  || 'General',
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
  const [selectedLogProof, setSelectedLogProof] = useState(null);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
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
                {['Date', 'Truck ID', 'Driver', 'Stop Name', 'Route', 'Waste Type', 'Bins', ...(isChd ? ['Days Since'] : []), 'Verification'].map((h) => (
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
                    {Array.from({ length: isChd ? 9 : 8 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3 bg-slate-100 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={isChd ? 9 : 8} className="px-5 py-16 text-center">
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
                    <td className="px-5 py-3.5 text-sm text-slate-700 font-medium whitespace-nowrap">
                      <div>{row.date}</div>
                      {row.completedAt && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(row.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {row.truckId}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">
                      {row.driverName || '—'}
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
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {row.beforeImage || row.afterImage ? (
                        <button
                          onClick={() => setSelectedLogProof(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          View Proof
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic">No photos</span>
                      )}
                    </td>
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

      {/* Proof Modal */}
      {selectedLogProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-black text-slate-900">Collection Verification Proof</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Stop: <span className="font-bold text-slate-700">{selectedLogProof.stopName || 'Unknown Stop'}</span> · Route: {selectedLogProof.routeName || '—'}
                </p>
              </div>
              <button
                onClick={() => setSelectedLogProof(null)}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Meta information row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-semibold text-slate-600">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Truck / Driver</span>
                  <span className="text-slate-800 font-bold">{selectedLogProof.truckId}</span>
                  <span className="text-slate-500 block font-normal">{selectedLogProof.driverName || 'Collector'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Waste Type</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full font-bold uppercase text-[10px] mt-0.5 ${WASTE_COLORS[selectedLogProof.wasteType] ?? WASTE_COLORS.General}`}>
                    {selectedLogProof.wasteType || 'General'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Bins Cleared</span>
                  <span className="text-slate-800 font-black text-sm">{selectedLogProof.bins ?? 0} bins</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Status</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full font-bold uppercase text-[10px] mt-0.5 ${
                    selectedLogProof.status === 'clean' ? 'bg-emerald-100 text-emerald-700' :
                    selectedLogProof.status === 'moderate' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {selectedLogProof.status || 'Clean'}
                  </span>
                </div>
              </div>

              {/* Side by side Before/After Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Before Image */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">BEFORE CLEARING</span>
                  <div className="aspect-[4/3] bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center relative group">
                    {selectedLogProof.beforeImage ? (
                      <img
                        src={selectedLogProof.beforeImage}
                        alt="Before clearing"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <Camera className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                        <span className="text-xs text-slate-400 font-medium">No photo logged</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* After Image */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center text-emerald-600">AFTER CLEARING</span>
                  <div className="aspect-[4/3] bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center relative group">
                    {selectedLogProof.afterImage ? (
                      <img
                        src={selectedLogProof.afterImage}
                        alt="After clearing"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <Camera className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                        <span className="text-xs text-slate-400 font-medium">No photo logged</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Address / Notes */}
              {selectedLogProof.stopAddress && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1">Notes / Address Reference</span>
                  <p className="text-sm font-semibold text-slate-700 leading-relaxed">{selectedLogProof.stopAddress}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setSelectedLogProof(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
              >
                Close Proof
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
