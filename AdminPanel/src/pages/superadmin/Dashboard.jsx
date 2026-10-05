import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  Truck, Users, ShieldAlert, Award, 
  TrendingUp, Activity, BarChart3, 
  Clock, MapPin, CheckCircle2, AlertCircle,
  PieChart as PieIcon, LineChart as LineIcon,
  Bell, ClipboardList, RefreshCw, Target,
  ShieldCheck, Smartphone, Layers
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, PieChart, Pie
} from 'recharts';
import API from '../../config';

const PURPOSE_LABELS = {
  household: { label: 'Household Waste', color: '#006A3B' },
  reporting: { label: 'Community Reports', color: '#0284C7' },
  rewards: { label: 'Eco Rewards', color: '#D97706' },
  commercial: { label: 'Commercial Ops', color: '#7C3AED' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [surveyData, setSurveyData] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [statsRes, reportsRes, surveyRes] = await Promise.all([
        axios.get(`${API}/api/admin/stats`).catch(() => ({ data: null })),
        axios.get(`${API}/api/reports?limit=10`).catch(() => ({ data: [] })),
        axios.get(`${API}/api/survey/quick-setup/results`).catch(() => ({ data: null })),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (Array.isArray(reportsRes.data)) setRecentReports(reportsRes.data);
      if (surveyRes.data) setSurveyData(surveyRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Purpose distribution chart data
  const purposeChartData = useMemo(() => {
    if (!surveyData?.byPurpose?.length) return [];
    return surveyData.byPurpose.map((p) => {
      const meta = PURPOSE_LABELS[p.purpose] || { label: p.purpose, color: '#006A3B' };
      return {
        name: meta.label,
        count: p.count,
        percentage: p.percentage,
        color: meta.color,
      };
    });
  }, [surveyData]);

  // Push notifications donut data
  const notifChartData = useMemo(() => {
    const total = surveyData?.total || 0;
    if (total === 0) return [];
    const notifs = surveyData?.notifications || { enabled: 0, skipped: 0 };
    return [
      { name: 'Opted In', value: notifs.enabled, color: '#006A3B' },
      { name: 'Skipped', value: notifs.skipped, color: '#CBD5E1' },
    ];
  }, [surveyData]);

  // Reporting trends chart data
  const trendsChartData = useMemo(() => {
    if (!stats?.trends?.length) return [];
    return stats.trends.map((t) => ({
      date: new Date(t._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: t.count,
    }));
  }, [stats]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cards = [
    {
      title: 'Fleet Size',
      value: stats?.summary?.trucks || 0,
      sub: 'Assigned trucks',
      icon: Truck,
      color: 'emerald',
    },
    {
      title: 'Active Reports',
      value: stats?.summary?.reports || 0,
      sub: `${stats?.summary?.resolutionRate || 0}% resolved`,
      icon: ShieldAlert,
      color: 'amber',
    },
    {
      title: 'Citizens Registered',
      value: stats?.summary?.residents || 0,
      sub: 'Verified residents',
      icon: Users,
      color: 'blue',
    },
    {
      title: 'Official Personnel',
      value: stats?.summary?.officials || 0,
      sub: 'Barangay officers',
      icon: Award,
      color: 'purple',
    },
    {
      title: 'Quick Setup Surveys',
      value: surveyData?.total || 0,
      sub: `${surveyData?.completionRate || 0}% resident rate`,
      icon: ClipboardList,
      color: 'teal',
    },
    {
      title: 'Push Notifications',
      value: `${surveyData?.notifications?.optInRate || 0}%`,
      sub: `${surveyData?.notifications?.enabled || 0} residents opted in`,
      icon: Bell,
      color: 'indigo',
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Compact Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Developer &amp; Admin City Intelligence
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live Operations
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time telemetry from Cebu City waste management, fleet routing, and resident onboarding
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 text-xs font-semibold">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>System Online</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold">
            Resolution: {stats?.summary?.resolutionRate || 0}%
          </div>
          <button
            type="button"
            onClick={fetchData}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 6 Compact Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card, i) => {
          const Icon = card.icon;
          const colors = {
            emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
            amber: 'bg-amber-50 text-amber-700 border-amber-100',
            blue: 'bg-blue-50 text-blue-700 border-blue-100',
            purple: 'bg-purple-50 text-purple-700 border-purple-100',
            teal: 'bg-teal-50 text-teal-700 border-teal-100',
            indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
          };
          return (
            <div
              key={i}
              className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-xl ${colors[card.color]} border`}>
                  <Icon className="w-4 h-4" />
                </div>
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  {card.title}
                </p>
                <h3 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </h3>
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                  {card.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4 Interactive Compact Graphs Grid (2x2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Graph 1: Community Incident Reports Trend */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <LineIcon className="w-4 h-4 text-emerald-700" />
                Incident Reports Timeline
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Daily citizen submissions (Actual data)</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Past 7 Days</span>
          </div>

          <div className="h-48 w-full">
            {trendsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendsChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminColorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#006A3B" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#006A3B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700 }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#006A3B" strokeWidth={2.5} fillOpacity={1} fill="url(#adminColorCount)" name="Reports" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <AlertCircle className="w-6 h-6 mb-1 opacity-40" />
                <span>No report trend activity recorded in this period</span>
              </div>
            )}
          </div>
        </div>

        {/* Graph 2: Quick Setup Purpose Distribution */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Quick Setup Purpose Distribution
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Resident purpose selection during onboarding</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Total: {surveyData?.total || 0}</span>
          </div>

          <div className="h-48 w-full">
            {purposeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={purposeChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-md">
                          <p className="font-bold">{item.name}</p>
                          <p>{item.count} residents ({item.percentage}%)</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                    {purposeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Target className="w-6 h-6 mb-1 opacity-40" />
                <span>No mobile quick setup submissions recorded yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Graph 3: Waste Incident Composition */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <PieIcon className="w-4 h-4 text-purple-600" />
                Incident Report Categories
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Breakdown of reported community issues</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">{stats?.composition?.length || 0} categories</span>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            {stats?.composition?.length > 0 ? (
              <div className="w-full h-full flex items-center">
                <div className="w-1/2 h-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.composition}
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="count"
                        nameKey="_id"
                      >
                        {stats.composition.map((entry, index) => (
                          <Cell
                            key={`cat-${index}`}
                            fill={['#006A3B', '#0284C7', '#D97706', '#9333EA', '#EF4444'][index % 5]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-base font-black text-slate-800 leading-none">
                      {stats.composition.reduce((acc, c) => acc + c.count, 0)}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Total</span>
                  </div>
                </div>

                <div className="w-1/2 space-y-1.5 pl-3">
                  {stats.composition.slice(0, 4).map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ['#006A3B', '#0284C7', '#D97706', '#9333EA', '#EF4444'][i % 5] }}
                        />
                        <span className="text-slate-600 font-medium truncate">{c._id}</span>
                      </div>
                      <span className="font-bold text-slate-800 ml-2">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 text-xs">
                <AlertCircle className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <span>No category records available</span>
              </div>
            )}
          </div>
        </div>

        {/* Graph 4: Push Notification Opt-In Donut */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-emerald-700" />
                Notification Opt-In Telemetry
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Resident mobile notification permissions</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Opt-In: {surveyData?.notifications?.optInRate || 0}%</span>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            {surveyData?.total > 0 ? (
              <div className="w-full h-full flex items-center">
                <div className="w-1/2 h-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={notifChartData}
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                      >
                        {notifChartData.map((entry, index) => (
                          <Cell key={`notif-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-base font-black text-slate-800 leading-none">
                      {surveyData.notifications?.optInRate}%
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Enabled</span>
                  </div>
                </div>

                <div className="w-1/2 space-y-2.5 pl-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between text-slate-600 mb-0.5">
                      <span className="font-semibold text-emerald-700">● Enabled</span>
                      <span className="font-bold">{surveyData.notifications?.enabled || 0}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${surveyData.notifications?.optInRate || 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-slate-500 mb-0.5">
                      <span>● Skipped</span>
                      <span className="font-bold">{surveyData.notifications?.skipped || 0}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-300 rounded-full"
                        style={{ width: `${100 - (surveyData.notifications?.optInRate || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 text-xs">
                <Bell className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <span>No notification records recorded yet</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Dual Telemetry Feeds (Rankings + Recent Onboardings & Reports) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Barangay Rankings & Onboarding Adoption (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-700" />
              Barangay Performance Leaderboard
            </h3>
            <span className="text-[10px] text-slate-400">Actual Points</span>
          </div>

          <div className="space-y-2.5">
            {stats?.leaderboard?.length > 0 ? (
              stats.leaderboard.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] font-black text-slate-400 w-4">#{i + 1}</span>
                    <span className="font-semibold text-slate-700 truncate">{b._id}</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                    {b.count} pts
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">No leaderboard data recorded yet</p>
            )}
          </div>

          {/* Barangay Onboarding Breakdown if any */}
          {surveyData?.byBarangay?.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <h4 className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Mobile Onboarding by Barangay
              </h4>
              <div className="space-y-2">
                {surveyData.byBarangay.slice(0, 4).map((b, idx) => (
                  <div key={idx} className="text-xs">
                    <div className="flex items-center justify-between text-slate-600 mb-1">
                      <span className="truncate">{b.barangay}</span>
                      <span className="font-bold text-slate-800">{b.count} ({b.percentage}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${Math.max(4, b.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Recent Mobile Setup & Citizen Reports (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-700" />
              Recent Mobile Onboardings &amp; Telemetry
            </h3>
            <span className="text-[10px] text-slate-400">Latest Live Submissions</span>
          </div>

          {/* Quick Setup Recent Submissions */}
          {surveyData?.recent?.length > 0 ? (
            <div className="divide-y divide-slate-100 text-xs">
              {surveyData.recent.slice(0, 4).map((item) => (
                <div key={item._id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">
                      {item.barangay || 'All Areas'}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                      {item.purposes?.map((p) => (
                        <span
                          key={p}
                          className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium"
                        >
                          {PURPOSE_LABELS[p]?.label || p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-right">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        item.notificationsEnabled
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      Push: {item.notificationsEnabled ? 'ON' : 'OFF'}
                    </span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {timeAgo(item.submittedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-400">
              No recent onboarding events recorded yet.
            </div>
          )}

          {/* Live Incident Reports Preview */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              Latest Citizen Incident Reports
            </h4>

            {recentReports.length > 0 ? (
              <div className="space-y-2">
                {recentReports.slice(0, 3).map((report) => (
                  <div key={report._id} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          report.status === 'resolved' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <span className="font-semibold text-slate-800 truncate">{report.title}</span>
                      <span className="text-[10px] text-slate-400">({report.barangay})</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        report.status === 'resolved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">No citizen reports recorded yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
