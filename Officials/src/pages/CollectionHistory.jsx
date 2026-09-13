import { useState, useEffect, useMemo } from 'react';
import {
  Search, Download, Package, Truck, Archive, Heart, AlertTriangle, Camera, X, Clock,
  Scale, Edit3, Check, TrendingUp, BarChart3, PieChart as PieIcon, Building2,
  ChevronDown, ChevronUp, Activity, Sparkles, Layers, ArrowUpRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
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

const WASTE_HEX_COLORS = {
  Organic:    '#10b981',
  Recyclable: '#3b82f6',
  General:    '#64748b',
  Hazardous:  '#ef4444',
  Bulky:      '#f59e0b',
  Other:      '#8b5cf6',
};

const HistoryAnalyticsTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-700/60 text-xs min-w-[180px]">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2 mb-2">
          <span className="font-bold text-slate-100">{data?.date || label}</span>
          {data?.fullDate && (
            <span className="text-[10px] text-slate-400 font-mono">
              {data.fullDate}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Weight:
            </span>
            <span className="font-extrabold text-white text-sm">
              {data?.weightTons ?? 0} Tons
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Bins Cleared:
            </span>
            <span className="font-bold text-white">
              {data?.bins ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Stops Cleared:
            </span>
            <span className="font-bold text-white">
              {data?.stops ?? 0}
            </span>
          </div>
          {data?.truckCount > 0 && (
            <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Active Trucks:</span>
              <span className="font-medium text-emerald-400">{data.truckCount} deployed</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const TruckBarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-700/60 text-xs min-w-[180px]">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2 mb-2">
          <span className="font-bold text-slate-100">{data?.truckId}</span>
          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold rounded">
            {data?.driverName || 'Driver'}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-300">Weight Hauled:</span>
            <span className="font-extrabold text-emerald-400 text-sm">{data?.weightTons} Tons</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-300">Stops Cleared:</span>
            <span className="font-bold text-white">{data?.stops} stops</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-300">Bins Cleared:</span>
            <span className="font-bold text-white">{data?.bins} bins</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function formatDuration(mins) {
  if (mins === undefined || mins === null || isNaN(mins) || mins <= 0) mins = 30;
  if (mins < 60) return `${mins} mins`;
  const hrs = (mins / 60).toFixed(1);
  return `${hrs.endsWith('.0') ? Math.floor(mins / 60) : hrs} hrs`;
}

function exportCSV(data) {
  const headers = ['Date', 'Truck ID', 'Driver Name', 'Stop Name', 'Stop Address', 'Route', 'Waste Type', 'Weight', 'Disposal Facility', 'Bins', 'Duration', 'Completed At'];
  const rows = data.map((r) => [
    r.date,
    r.truckId,
    r.driverName  || '',
    r.stopName   || '',
    r.stopAddress || '',
    r.routeName  || '',
    r.wasteType  || 'General',
    r.weight ? `${r.weight} ${r.weightUnit || 'kg'}` : '—',
    r.disposalFacility || '—',
    r.bins       ?? 0,
    formatDuration(r.durationMinutes || r.duration || 30),
    new Date(r.completedAt).toLocaleString(),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `collection-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Days elapsed since date string / ISO
function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function CollectionHistory() {
  const { official } = useAuth();
  const isChd = official?.role === 'city_health' || official?.role === 'superadmin';

  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [period,     setPeriod]     = useState('month');
  const [dateFilter, setDateFilter] = useState('');
  const [truckFilter,setTruckFilter]= useState('');
  const [page,       setPage]       = useState(0);
  const [healthAlertOnly, setHealthAlertOnly] = useState(false);
  const [selectedLogProof, setSelectedLogProof] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [trendMetric, setTrendMetric] = useState('weight'); // 'weight' | 'bins' | 'stops'

  // Weighbridge / weight logging state
  const [editingLogWeight, setEditingLogWeight] = useState(null);
  const [editWeightVal, setEditWeightVal] = useState('');
  const [editWeightUnit, setEditWeightUnit] = useState('kg');
  const [editFacility, setEditFacility] = useState('Binaliw Sanitary Landfill (ARN)');
  const [applyToWholeRoute, setApplyToWholeRoute] = useState(true);
  const [isSavingWeight, setIsSavingWeight] = useState(false);

  const handleOpenEditWeight = (log) => {
    setEditingLogWeight(log);
    setEditWeightVal(log.weight ? String(log.weight) : '');
    setEditWeightUnit(log.weightUnit || 'kg');
    setEditFacility(log.disposalFacility || 'Binaliw Sanitary Landfill (ARN)');
    setApplyToWholeRoute(true);
  };

  const handleSaveWeight = async (e) => {
    e?.preventDefault();
    if (!editingLogWeight) return;
    setIsSavingWeight(true);
    try {
      const parsedWeight = parseFloat(editWeightVal) || 0;
      await axios.patch(`${API}/api/collections/${editingLogWeight._id}`, {
        weight: parsedWeight,
        weightUnit: editWeightUnit,
        disposalFacility: editFacility,
        applyToRoute: applyToWholeRoute,
      });

      // Update state locally
      setLogs((prev) =>
        prev.map((l) => {
          const isMatch =
            l._id === editingLogWeight._id ||
            (applyToWholeRoute &&
              ((l.routeId && editingLogWeight.routeId && l.routeId === editingLogWeight.routeId) ||
                (l.truckId === editingLogWeight.truckId && l.date === editingLogWeight.date)));
          if (isMatch) {
            return {
              ...l,
              weight: parsedWeight,
              weightUnit: editWeightUnit,
              disposalFacility: editFacility,
            };
          }
          return l;
        })
      );
      setEditingLogWeight(null);
    } catch (err) {
      console.error('Failed to save weight:', err.message);
    } finally {
      setIsSavingWeight(false);
    }
  };

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

  // Summary stats — derived from fetched (pre-filtered) logs with unit normalization
  const stats = useMemo(() => {
    const getWeightInKg = (r) => {
      const w = Number(r.weight) || 0;
      return r.weightUnit === 'tons' ? w * 1000 : w;
    };
    const totalWeightKg = logs.reduce((s, r) => s + getWeightInKg(r), 0);
    const totalBins   = logs.reduce((s, r) => s + (r.bins   ?? 0), 0);
    const totalDurationMins = logs.reduce((s, r) => s + (r.durationMinutes || r.duration || 30), 0);
    const avgDurationMins = logs.length > 0 ? Math.round(totalDurationMins / logs.length) : 0;

    const truckCounts = {};
    logs.forEach((r) => { truckCounts[r.truckId] = (truckCounts[r.truckId] || 0) + 1; });
    const mostActive = Object.entries(truckCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return { totalWeight: totalWeightKg, totalBins, totalStops: logs.length, mostActive, totalDurationMins, avgDurationMins };
  }, [logs]);

  // Analytics calculations based on current dataset (filtered)
  const analyticsData = useMemo(() => {
    const dataSet = filtered;

    const timeMap = {};
    const streamMap = {};
    let totalKg = 0;
    const truckMap = {};
    const facilityMap = {};

    const getWeightInKg = (r) => {
      const w = Number(r.weight) || 0;
      return r.weightUnit === 'tons' ? w * 1000 : w;
    };

    dataSet.forEach((r) => {
      const kg = getWeightInKg(r);
      const bins = Number(r.bins) || 0;
      totalKg += kg;

      // Timeline by date
      const dateKey = r.date || (r.completedAt ? r.completedAt.slice(0, 10) : 'Unknown');
      if (!timeMap[dateKey]) {
        timeMap[dateKey] = { dateKey, weightKg: 0, bins: 0, stops: 0, trucks: new Set() };
      }
      timeMap[dateKey].weightKg += kg;
      timeMap[dateKey].bins += bins;
      timeMap[dateKey].stops += 1;
      if (r.truckId) timeMap[dateKey].trucks.add(r.truckId);

      // Waste stream
      const stream = r.wasteType || 'General';
      if (!streamMap[stream]) {
        streamMap[stream] = { name: stream, weightKg: 0, bins: 0, count: 0 };
      }
      streamMap[stream].weightKg += kg;
      streamMap[stream].bins += bins;
      streamMap[stream].count += 1;

      // Truck performance
      const tid = r.truckId || 'Unknown';
      if (!truckMap[tid]) {
        truckMap[tid] = { truckId: tid, weightKg: 0, stops: 0, bins: 0, driverName: r.driverName || '—' };
      }
      truckMap[tid].weightKg += kg;
      truckMap[tid].stops += 1;
      truckMap[tid].bins += bins;
      if (r.driverName && r.driverName !== '—') truckMap[tid].driverName = r.driverName;

      // Facility
      const fac = r.disposalFacility || 'Unassigned / Local MRF';
      if (!facilityMap[fac]) {
        facilityMap[fac] = { name: fac, weightKg: 0, stops: 0 };
      }
      facilityMap[fac].weightKg += kg;
      facilityMap[fac].stops += 1;
    });

    const sortedTimeline = Object.keys(timeMap).sort().map((key) => {
      const item = timeMap[key];
      let displayDate = key;
      try {
        const parts = key.split('-');
        if (parts.length === 3) {
          const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
          displayDate = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      } catch (_) {}
      return {
        date: displayDate,
        fullDate: key,
        weightTons: parseFloat((item.weightKg / 1000).toFixed(2)),
        weightKg: Math.round(item.weightKg),
        bins: item.bins,
        stops: item.stops,
        truckCount: item.trucks.size,
      };
    });

    const streamList = Object.values(streamMap).map((s) => {
      const pct = totalKg > 0
        ? Math.round((s.weightKg / totalKg) * 100)
        : (dataSet.length > 0 ? Math.round((s.count / dataSet.length) * 100) : 0);
      return {
        ...s,
        weightTons: parseFloat((s.weightKg / 1000).toFixed(2)),
        percentage: pct,
        color: WASTE_HEX_COLORS[s.name] || '#94a3b8',
      };
    }).sort((a, b) => b.weightKg - a.weightKg);

    const truckList = Object.values(truckMap).map((t) => ({
      ...t,
      weightTons: parseFloat((t.weightKg / 1000).toFixed(2)),
    })).sort((a, b) => b.weightTons - a.weightTons || b.stops - a.stops).slice(0, 6);

    const facilityList = Object.values(facilityMap).map((f) => {
      const pct = totalKg > 0
        ? Math.round((f.weightKg / totalKg) * 100)
        : (dataSet.length > 0 ? Math.round((f.stops / dataSet.length) * 100) : 0);
      return {
        ...f,
        weightTons: parseFloat((f.weightKg / 1000).toFixed(2)),
        percentage: pct,
      };
    }).sort((a, b) => b.weightKg - a.weightKg || b.stops - a.stops);

    return {
      timeline: sortedTimeline,
      streams: streamList,
      trucks: truckList,
      facilities: facilityList,
      totalWeightTons: parseFloat((totalKg / 1000).toFixed(2)),
      totalRecords: dataSet.length,
    };
  }, [filtered]);

  const timelineKPIs = useMemo(() => {
    const list = analyticsData.timeline;
    if (!list || list.length === 0) {
      return { peakDate: '—', peakVal: '—', dailyAvg: '—', activeDays: 0 };
    }
    let maxVal = 0;
    let maxDate = '—';
    let sum = 0;

    list.forEach((d) => {
      const val = trendMetric === 'weight' ? d.weightTons : (trendMetric === 'bins' ? d.bins : d.stops);
      if (val > maxVal) {
        maxVal = val;
        maxDate = d.date;
      }
      sum += val;
    });

    const avg = (sum / list.length).toFixed(trendMetric === 'weight' ? 2 : 0);
    const unitLabel = trendMetric === 'weight' ? 'Tons' : (trendMetric === 'bins' ? 'bins' : 'stops');

    return {
      peakDate: maxDate,
      peakVal: `${maxVal} ${unitLabel}`,
      dailyAvg: `${avg} ${unitLabel}`,
      activeDays: list.length,
    };
  }, [analyticsData.timeline, trendMetric]);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            icon: Package,
            label: 'Total Stops',
            value: loading ? <span className="h-5 w-16 bg-slate-200 rounded inline-block animate-pulse mt-0.5" /> : stats.totalStops.toLocaleString(),
            sub: '',
            color: 'bg-blue-100 text-blue-700',
          },
          {
            icon: Scale,
            label: 'Total Waste Weighed',
            value: loading ? <span className="h-5 w-20 bg-slate-200 rounded inline-block animate-pulse mt-0.5" /> : (
              stats.totalWeight >= 1000 
                ? `${(stats.totalWeight / 1000).toFixed(2)} Tons`
                : `${stats.totalWeight.toLocaleString()} kg`
            ),
            sub: loading ? '' : `${(stats.totalWeight / 1000).toFixed(2)} Tons reported`,
            color: 'bg-teal-100 text-teal-700',
          },
          {
            icon: Truck,
            label: 'Most Active Truck',
            value: loading ? <span className="h-5 w-24 bg-slate-200 rounded inline-block animate-pulse mt-0.5" /> : stats.mostActive,
            sub: '',
            color: 'bg-purple-100 text-purple-700',
          },
          {
            icon: Archive,
            label: 'Total Bins',
            value: loading ? <span className="h-5 w-16 bg-slate-200 rounded inline-block animate-pulse mt-0.5" /> : stats.totalBins.toLocaleString(),
            sub: '',
            color: 'bg-amber-100 text-amber-700',
          },
          {
            icon: Clock,
            label: 'Total Collection Time',
            value: loading ? <span className="h-5 w-20 bg-slate-200 rounded inline-block animate-pulse mt-0.5" /> : formatDuration(stats.totalDurationMins),
            sub: loading ? '' : `Avg ${formatDuration(stats.avgDurationMins)} / stop`,
            color: 'bg-emerald-100 text-emerald-700',
          },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className="text-base font-bold text-slate-900">{value}</p>
              {sub ? <p className="text-[11px] text-slate-400 font-medium mt-0.5">{sub}</p> : null}
            </div>
          </div>
        ))}
      </div>

      {/* Analytics & Operational Trends Section */}
      <div className="space-y-4">
        {/* Section Header with Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white px-6 py-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 flex-shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Collection Analytics & Trends</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Visual Analytics
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Performance trends across {filtered.length} log{filtered.length !== 1 ? 's' : ''} {truckIds.length > 0 ? `(${truckIds.length} trucks)` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Metric Switcher */}
            {showAnalytics && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTrendMetric('weight')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    trendMetric === 'weight'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Weight (Tons)
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMetric('bins')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    trendMetric === 'bins'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Bins Cleared
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMetric('stops')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    trendMetric === 'stops'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Stops Cleared
                </button>
              </div>
            )}

            {/* Collapse/Expand toggle */}
            <button
              type="button"
              onClick={() => setShowAnalytics((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              {showAnalytics ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Hide Charts</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Show Charts</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Charts Body */}
        {showAnalytics && (
          loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm h-80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Generating analytics charts…</p>
                </div>
              </div>
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm h-80 flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm text-center">
              <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No Collection Records to Analyze</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No collection records match your current filters. Adjust your period, clear search queries, or select another truck to view operational trends.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Row 1: Timeline Trend (Left 8) + Waste Stream Breakdown (Right 4) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Timeline Chart */}
                <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-600" />
                          Collection Output Over Time
                        </h3>
                        <p className="text-xs text-slate-500">
                          {trendMetric === 'weight' && 'Daily waste tonnage weighed at municipal disposal facilities'}
                          {trendMetric === 'bins' && 'Daily volume of waste receptacles emptied across routes'}
                          {trendMetric === 'stops' && 'Daily scheduled collection points serviced and verified'}
                        </p>
                      </div>

                      {/* Quick KPIs */}
                      <div className="flex items-center gap-2">
                        <div className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-right">
                          <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Peak Output</p>
                          <p className="text-xs font-bold text-emerald-800">{timelineKPIs.peakVal}</p>
                        </div>
                        <div className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-right">
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Daily Avg</p>
                          <p className="text-xs font-bold text-slate-700">{timelineKPIs.dailyAvg}</p>
                        </div>
                        <div className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-right hidden sm:block">
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Active Days</p>
                          <p className="text-xs font-bold text-slate-700">{timelineKPIs.activeDays} d</p>
                        </div>
                      </div>
                    </div>

                    {/* Area Chart */}
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analyticsData.timeline} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                            </linearGradient>
                            <linearGradient id="colorBins" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                            </linearGradient>
                            <linearGradient id="colorStops" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35}/>
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            dy={5}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                          />
                          <Tooltip content={<HistoryAnalyticsTooltip />} />
                          {trendMetric === 'weight' && (
                            <Area
                              type="monotone"
                              dataKey="weightTons"
                              name="Weight"
                              stroke="#10b981"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#colorWeight)"
                              dot={{ r: 3, fill: '#10b981', strokeWidth: 1, stroke: '#fff' }}
                              activeDot={{ r: 5, fill: '#10b981' }}
                            />
                          )}
                          {trendMetric === 'bins' && (
                            <Area
                              type="monotone"
                              dataKey="bins"
                              name="Bins"
                              stroke="#3b82f6"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#colorBins)"
                              dot={{ r: 3, fill: '#3b82f6', strokeWidth: 1, stroke: '#fff' }}
                              activeDot={{ r: 5, fill: '#3b82f6' }}
                            />
                          )}
                          {trendMetric === 'stops' && (
                            <Area
                              type="monotone"
                              dataKey="stops"
                              name="Stops"
                              stroke="#8b5cf6"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#colorStops)"
                              dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 1, stroke: '#fff' }}
                              activeDot={{ r: 5, fill: '#8b5cf6' }}
                            />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Waste Stream Donut Chart */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <PieIcon className="w-4 h-4 text-emerald-600" />
                        Waste Stream Breakdown
                      </h3>
                      <span className="text-[11px] font-bold text-slate-400">By Classification</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      Distribution of waste types cleared across all stops
                    </p>

                    {/* Donut Chart */}
                    <div className="h-44 w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsData.streams}
                            dataKey="weightKg"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={72}
                            paddingAngle={3}
                          >
                            {analyticsData.streams.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const item = payload[0].payload;
                                return (
                                  <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl border border-slate-700/60 text-xs">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                      <span className="font-bold">{item.name} Waste</span>
                                    </div>
                                    <p className="text-slate-300">
                                      Weight: <strong className="text-white">{item.weightTons} Tons</strong> ({item.percentage}%)
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                      {item.bins} bins · {item.count} collection stops
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center Donut Label */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-base font-black text-slate-800 leading-tight">
                          {analyticsData.totalWeightTons}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Tons Total
                        </span>
                      </div>
                    </div>

                    {/* Stream legend pills */}
                    <div className="space-y-1.5 mt-2">
                      {analyticsData.streams.slice(0, 4).map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="font-medium text-slate-700">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-slate-500 font-medium">{item.weightTons} T</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {item.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Fleet Productivity by Truck (Left 6) + Disposal Facility Allocation (Right 6) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Truck Productivity Chart */}
                <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-emerald-600" />
                        Fleet Collection Performance
                      </h3>
                      <p className="text-xs text-slate-500">Tonnage hauled and serviced by deployed trucks</p>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      Top {analyticsData.trucks.length} Vehicles
                    </span>
                  </div>

                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.trucks} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="truckId"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          dy={5}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <Tooltip content={<TruckBarTooltip />} cursor={{ fill: '#f8fafc' }} />
                        <Bar
                          dataKey="weightTons"
                          name="Weight (Tons)"
                          fill="#0d9488"
                          radius={[6, 6, 0, 0]}
                          barSize={26}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Disposal Facility Allocation */}
                <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-teal-600" />
                          Disposal Facility Routing
                        </h3>
                        <p className="text-xs text-slate-500">Municipal weighbridge destination allocation</p>
                      </div>
                      <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                        {analyticsData.facilities.length} Facilities
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {analyticsData.facilities.slice(0, 4).map((f) => (
                        <div key={f.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <Building2 className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                              <span className="font-semibold text-slate-800 truncate" title={f.name}>{f.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 font-mono">
                              <span className="text-slate-600 font-bold">{f.weightTons} Tons</span>
                              <span className="text-slate-400 text-[11px]">({f.stops} stops)</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                {f.percentage}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(4, f.percentage))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Compliant with City Solid Waste Management Routing</span>
                    <span className="font-semibold text-slate-600">{analyticsData.totalRecords} Stops Tracked</span>
                  </div>
                </div>

              </div>
            </div>
          )
        )}
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
                {['Date', 'Truck ID', 'Driver', 'Stop Name', 'Route', 'Waste Type', 'Weight', 'Disposal Facility', 'Bins', 'Duration', ...(isChd ? ['Days Since'] : []), 'Verification'].map((h) => (
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
                    {Array.from({ length: isChd ? 12 : 11 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3 bg-slate-100 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={isChd ? 12 : 11} className="px-5 py-16 text-center">
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
                      {row.routeName || row.route || (row.barangay ? `${row.barangay} Route` : '—')}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${WASTE_COLORS[row.wasteType] ?? WASTE_COLORS.General}`}>
                        {row.wasteType || 'General'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-slate-800 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {row.weight ? (
                          <span className="inline-flex items-center gap-1 text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md text-xs font-black">
                            <Scale className="w-3 h-3 text-teal-600" />
                            {row.weight} {row.weightUnit || 'kg'}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal text-xs">—</span>
                        )}
                        <button
                          onClick={() => handleOpenEditWeight(row)}
                          title="Log or edit weighbridge weight"
                          className="p-1 hover:bg-teal-50 text-slate-400 hover:text-teal-700 rounded transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 max-w-[150px] truncate">
                      {row.disposalFacility ? (
                        <span className="font-semibold text-slate-700" title={row.disposalFacility}>
                          {row.disposalFacility.replace(' (ARN)', '').replace('Materials Recovery (MRF)', 'MRF')}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleOpenEditWeight(row)}
                          className="text-amber-600 hover:text-amber-700 italic text-xs flex items-center gap-1 hover:underline"
                        >
                          <span>Pending disposal</span>
                          <Edit3 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">
                      {row.bins ?? 0}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-emerald-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{formatDuration(row.durationMinutes || row.duration || 30)}</span>
                      </div>
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
                      {row.beforeImage || row.afterImage || row.proofImage || row.photo || row.image ? (
                        <button
                          onClick={() => setSelectedLogProof(row)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          <Camera className="w-3.5 h-3.5 text-emerald-600" />
                          View Proof
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic font-medium">No photos</span>
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
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-semibold text-slate-600">
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
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Scale Weight</span>
                  <span className="text-teal-700 font-black text-sm flex items-center gap-1 mt-0.5">
                    <Scale className="w-3.5 h-3.5 text-teal-600" />
                    {selectedLogProof.weight ? `${selectedLogProof.weight} ${selectedLogProof.weightUnit || 'kg'}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Bins Cleared</span>
                  <span className="text-slate-800 font-black text-sm">{selectedLogProof.bins ?? 0} bins</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Duration</span>
                  <span className="text-emerald-700 font-bold text-xs flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    {formatDuration(selectedLogProof.durationMinutes || selectedLogProof.duration || 30)}
                  </span>
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

              {/* Disposal Facility & Weighbridge Slip Banner */}
              {(selectedLogProof.disposalFacility || selectedLogProof.disposalPhoto) && (
                <div className="bg-teal-50/80 border border-teal-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-teal-600 uppercase font-black tracking-wider block">
                      Disposal Facility & Weighbridge Tonnage
                    </span>
                    <p className="text-sm font-bold text-teal-950 flex items-center gap-1.5">
                      📍 {selectedLogProof.disposalFacility || 'Binaliw Sanitary Landfill (ARN)'}
                    </p>
                    <p className="text-xs text-teal-700">
                      Verified Weight: <span className="font-extrabold">{selectedLogProof.weight || '—'} {selectedLogProof.weightUnit || 'kg'}</span>
                    </p>
                  </div>
                  {selectedLogProof.disposalPhoto && (
                    <a
                      href={selectedLogProof.disposalPhoto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      View Scale Ticket
                    </a>
                  )}
                </div>
              )}

              {/* Side by side Before/After Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Before Image */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">BEFORE CLEARING</span>
                  <div className="aspect-[4/3] bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center relative group">
                    {selectedLogProof.beforeImage || selectedLogProof.proofImage || selectedLogProof.photo || selectedLogProof.image ? (
                      <img
                        src={selectedLogProof.beforeImage || selectedLogProof.proofImage || selectedLogProof.photo || selectedLogProof.image}
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
                    {selectedLogProof.afterImage || selectedLogProof.beforeImage || selectedLogProof.proofImage ? (
                      <img
                        src={selectedLogProof.afterImage || selectedLogProof.beforeImage || selectedLogProof.proofImage}
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

      {/* Weighbridge / Weight Edit Modal */}
      {editingLogWeight && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Weighbridge Data</h3>
                  <p className="text-xs text-slate-500">
                    {editingLogWeight.truckId} • {editingLogWeight.stopName || editingLogWeight.date}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingLogWeight(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWeight} className="p-6 space-y-4">
              {/* Weight & Unit */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Verified Waste Weight
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editWeightVal}
                      onChange={(e) => setEditWeightVal(e.target.value)}
                      placeholder="e.g. 2400 or 2.4"
                      className="w-full px-4 py-2.5 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      required
                      autoFocus
                    />
                  </div>
                  <select
                    value={editWeightUnit}
                    onChange={(e) => setEditWeightUnit(e.target.value)}
                    className="px-3 py-2.5 text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="kg">kg</option>
                    <option value="tons">tons</option>
                  </select>
                </div>
              </div>

              {/* Disposal Facility Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Disposal / Weighbridge Facility
                </label>
                <select
                  value={editFacility}
                  onChange={(e) => setEditFacility(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm text-slate-800 font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                >
                  <option value="Binaliw Sanitary Landfill (ARN)">Binaliw Sanitary Landfill (ARN)</option>
                  <option value="Inayawan Transfer Station">Inayawan Transfer Station</option>
                  <option value="Barangay Materials Recovery (MRF)">Barangay Materials Recovery (MRF)</option>
                  <option value="Consolacion Waste Facility">Consolacion Waste Facility</option>
                  <option value="Green Loop Composting Site">Green Loop Composting Site</option>
                </select>
              </div>

              {/* Apply to route checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-teal-50/60 border border-teal-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToWholeRoute}
                    onChange={(e) => setApplyToWholeRoute(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-teal-900 block">Apply to entire truck route</span>
                    <span className="text-teal-700 font-medium">
                      Updates all collection stops for {editingLogWeight.truckId} on {editingLogWeight.date}
                    </span>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingLogWeight(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingWeight || !editWeightVal}
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-700/20 flex items-center gap-1.5 transition-all"
                >
                  {isSavingWeight ? (
                    'Saving...'
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save Weighbridge Record
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
