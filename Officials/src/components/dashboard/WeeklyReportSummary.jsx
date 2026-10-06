import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  MapPin,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  BarChart3,
  PieChart as PieIcon,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import API from '../../config';
import ProgressBar from '../shared/ProgressBar';

const CATEGORY_COLORS = [
  '#4f46e5', // Indigo
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#64748b', // Slate
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3.5 py-2.5 z-50">
      <p className="text-xs font-bold text-slate-800 mb-1">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs font-semibold">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="text-slate-900 font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function WeeklyReportSummary({ barangay, onNavigateToReports }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(7);
  const [chartView, setChartView] = useState('daily'); // 'daily' | 'categories'

  const fetchSummary = async (days = periodDays) => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('gtrash_token')}` };
      const brgyParam = barangay && barangay !== 'All' ? `&barangay=${encodeURIComponent(barangay)}` : '';
      const res = await fetch(`${API}/api/reports/weekly-summary?days=${days}${brgyParam}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching weekly report summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(periodDays);
  }, [barangay, periodDays]);

  const totalThisWeek = data?.totalThisWeek || 0;
  const resolvedThisWeek = data?.resolvedThisWeek || 0;
  const pendingThisWeek = data?.pendingThisWeek || 0;
  const resolutionRate = data?.resolutionRate || 0;
  const percentChange = data?.percentChange || 0;
  const avgResolutionHours = data?.avgResolutionHours || 0;
  const categoryBreakdown = data?.categoryBreakdown || [];
  const sitioHotspots = data?.sitioHotspots || [];
  const dailyTrend = data?.dailyTrend || [];
  const highlights = data?.highlights || [];
  const healthConcernsThisWeek = data?.healthConcernsThisWeek || 0;

  // Pie chart formatted data
  const pieCategoryData = categoryBreakdown.map((cat, idx) => ({
    name: cat.category,
    value: cat.count,
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
  }));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Weekly Reports Intelligence & Analysis</h2>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
                {periodDays === 7 ? 'Last 7 Days' : `Past ${periodDays} Days`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive breakdown of community waste issues, resolution speed, and hotspot areas
            </p>
          </div>
        </div>

        {/* Controls: Time Period & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setPeriodDays(7)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                periodDays === 7 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setPeriodDays(14)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                periodDays === 14 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              14 Days
            </button>
            <button
              onClick={() => setPeriodDays(30)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                periodDays === 30 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              30 Days
            </button>
          </div>

          <button
            onClick={() => fetchSummary(periodDays)}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Analysis"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Reports + WoW Change */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Reports Logged</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-slate-900">{totalThisWeek}</p>
            <div className="flex items-center gap-1 mt-1">
              {percentChange !== 0 && (
                <span
                  className={`text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                    percentChange < 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {percentChange < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <TrendingUp className="w-3 h-3" />
                  )}
                  {Math.abs(percentChange)}% vs last period
                </span>
              )}
              {percentChange === 0 && (
                <span className="text-[10px] text-slate-400 font-medium">Equal to last period</span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 2: Resolution Rate */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Resolution Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-emerald-600">{resolutionRate}%</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-1">
              {resolvedThisWeek} of {totalThisWeek} resolved
            </p>
          </div>
        </div>

        {/* Metric 3: Pending Action */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Awaiting Action</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-amber-600">{pendingThisWeek}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-1">
              {pendingThisWeek === 0 ? 'All caught up' : 'Needs official review'}
            </p>
          </div>
        </div>

        {/* Metric 4: Turnaround Time */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Resolution</span>
            <Zap className="w-4 h-4 text-violet-500" />
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-slate-900">
              {avgResolutionHours > 0 ? `${avgResolutionHours} hrs` : '< 24 hrs'}
            </p>
            <p className="text-[10px] font-semibold text-slate-500 mt-1">
              Submission to resolution
            </p>
          </div>
        </div>
      </div>

      {/* Main Analysis Visual Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Visual Column (7/12): Trend Chart or Category Donut */}
        <div className="lg:col-span-7 bg-slate-50/50 rounded-2xl border border-slate-100 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                {chartView === 'daily' ? 'Daily Report Volume & Resolution Trend' : 'Report Type Distribution'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {chartView === 'daily' ? 'Submitted vs resolved complaints per day' : 'Percentage breakdown by category'}
              </p>
            </div>

            {/* View Switcher */}
            <div className="flex items-center bg-white border border-slate-200/80 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                onClick={() => setChartView('daily')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  chartView === 'daily' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily Trend
              </button>
              <button
                onClick={() => setChartView('categories')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  chartView === 'categories' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Categories
              </button>
            </div>
          </div>

          {/* Chart Rendering */}
          {loading ? (
            <div className="h-[210px] flex items-center justify-center">
              <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : totalThisWeek === 0 ? (
            <div className="h-[210px] flex flex-col items-center justify-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-400" />
              <p className="text-xs font-bold text-slate-700">No Reports Logged</p>
              <p className="text-[11px] text-slate-400">The barangay has had no reported waste issues in this period.</p>
            </div>
          ) : chartView === 'daily' ? (
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="reports" name="Submitted" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[210px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieCategoryData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} reports`, name]}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right Details Column (5/12): Issue Breakdown & Hotspot Sitios */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          {/* Issue Categories Progress Breakdown */}
          <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <PieIcon className="w-3.5 h-3.5 text-indigo-600" /> What Reports Are About
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Causes</span>
            </div>

            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">No categories recorded</p>
            ) : (
              <div className="space-y-2.5">
                {categoryBreakdown.slice(0, 4).map((cat, idx) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-700 flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                        />
                        {cat.category}
                      </span>
                      <span className="text-slate-900 font-bold flex-shrink-0">
                        {cat.count} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sitio Problem Hotspots */}
          <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" /> Hotspot Sitios / Locations
              </h3>
              <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100">
                Most Reported
              </span>
            </div>

            {sitioHotspots.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">No location hotspots recorded</p>
            ) : (
              <div className="space-y-1.5">
                {sitioHotspots.slice(0, 3).map((hotspot, idx) => (
                  <div
                    key={hotspot.sitio}
                    className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200/70 text-xs"
                  >
                    <span className="font-semibold text-slate-800 flex items-center gap-2 truncate">
                      <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                      {hotspot.sitio}
                    </span>
                    <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg flex-shrink-0">
                      {hotspot.count} {hotspot.count === 1 ? 'report' : 'reports'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Executive Key Highlights & Action Summary Card */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-indigo-50/30 to-purple-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
              Executive Weekly Takeaways & Insights
            </h3>
          </div>
          <button
            onClick={() => (onNavigateToReports ? onNavigateToReports() : navigate('/reports'))}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
          >
            Manage Reports <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-indigo-900/90 font-medium">
          {highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/70 backdrop-blur-xs p-2.5 rounded-xl border border-indigo-100/60">
              <span className="text-indigo-600 font-bold">•</span>
              <span className="leading-snug">{h}</span>
            </div>
          ))}
        </div>

        {healthConcernsThisWeek > 0 && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200/80 p-2.5 rounded-xl text-xs text-rose-800 font-semibold mt-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>
              {healthConcernsThisWeek} report(s) flagged for potential health hazards. Coordinate with City Health or dispatch emergency collection.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
