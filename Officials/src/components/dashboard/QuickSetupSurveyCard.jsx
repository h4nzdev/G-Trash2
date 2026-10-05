import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  ClipboardList,
  RefreshCw,
  Bell,
  MapPin,
  Target,
  CheckCircle,
  Smartphone,
  Users,
  Home,
  Megaphone,
  Trophy,
  Building2,
  Calendar,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import API from '../../config';

const PURPOSE_META = {
  household: {
    label: 'Household Waste',
    icon: Home,
    color: '#006A3B',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  reporting: {
    label: 'Community Reports',
    icon: Megaphone,
    color: '#0284C7',
    bg: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  rewards: {
    label: 'Eco Rewards',
    icon: Trophy,
    color: '#D97706',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  commercial: {
    label: 'Commercial Ops',
    icon: Building2,
    color: '#7C3AED',
    bg: 'bg-purple-50 text-purple-800 border-purple-200',
  },
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

export default function QuickSetupSurveyCard({ defaultBarangay = '' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [barangay, setBarangay] = useState(defaultBarangay);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period && period !== 'all') params.set('period', period);
      if (barangay && barangay !== 'All') params.set('barangay', barangay);
      const res = await axios.get(`${API}/api/survey/quick-setup/results?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.warn('Failed to load quick setup survey results:', err);
    } finally {
      setLoading(false);
    }
  }, [period, barangay]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const total = data?.total ?? 0;
  const totalResidents = data?.totalResidents ?? 0;
  const completionRate = data?.completionRate ?? 0;
  const notifications = data?.notifications ?? { enabled: 0, skipped: 0, optInRate: 0 };
  const byPurpose = data?.byPurpose ?? [];
  const byBarangay = data?.byBarangay ?? [];
  const timeline = data?.timeline ?? [];
  const recent = data?.recent ?? [];

  // Chart 1: Purpose Distribution Data
  const purposeChartData = useMemo(() => {
    return byPurpose.map((p) => {
      const meta = PURPOSE_META[p.purpose] || { label: p.purpose, color: '#006A3B' };
      return {
        name: meta.label,
        count: p.count,
        percentage: p.percentage,
        color: meta.color,
      };
    });
  }, [byPurpose]);

  // Chart 2: Notification Opt-in Donut Data
  const notifChartData = useMemo(() => {
    if (total === 0) return [];
    return [
      { name: 'Enabled', value: notifications.enabled, color: '#006A3B' },
      { name: 'Skipped', value: notifications.skipped, color: '#CBD5E1' },
    ];
  }, [total, notifications]);

  // Chart 3: Barangay Distribution Data (Top 5)
  const barangayChartData = useMemo(() => {
    return byBarangay.slice(0, 5).map((b) => ({
      name: b.barangay.replace('Barangay ', ''),
      fullName: b.barangay,
      count: b.count,
      percentage: b.percentage,
    }));
  }, [byBarangay]);

  const topPurpose = byPurpose[0];
  const topPurposeMeta = topPurpose ? (PURPOSE_META[topPurpose.purpose] || { label: topPurpose.purpose }) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-4">
      {/* Top Header & Filters (Compact) */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 leading-snug">
                Onboarding &amp; Quick Setup Analytics
              </h2>
              <span className="text-[9px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                Live Data
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Telemetry from resident mobile setup (Area, Purpose, Notifications &amp; Privacy)
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/70 p-0.5 text-xs font-semibold">
            {[
              { id: 'all', label: 'All' },
              { id: 'month', label: '30D' },
              { id: 'week', label: '7D' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 rounded-md transition-all text-xs cursor-pointer ${
                  period === p.id
                    ? 'bg-white text-emerald-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Barangay filter */}
          <select
            value={barangay}
            onChange={(e) => setBarangay(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="All">All Barangays</option>
            <option value="Basak San Nicolas">Basak San Nicolas</option>
            <option value="Guadalupe">Guadalupe</option>
            <option value="Lahug">Lahug</option>
            <option value="Mabolo">Mabolo</option>
            <option value="Banilad">Banilad</option>
            <option value="Talamban">Talamban</option>
            <option value="Labangon">Labangon</option>
          </select>

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchResults}
            disabled={loading}
            title="Refresh analytics"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Compact Metric Cards (Single-line grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span className="font-semibold">Survey Submissions</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900">{total}</span>
            <span className="text-[10px] text-slate-400">
              / {totalResidents} registered
            </span>
          </div>
          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            {completionRate}% resident onboard rate
          </div>
        </div>

        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span className="font-semibold">Notification Opt-In</span>
            <Bell className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900">
              {notifications.optInRate}%
            </span>
            <span className="text-[10px] text-slate-400">
              ({notifications.enabled} enabled)
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {notifications.skipped} skipped during setup
          </div>
        </div>

        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span className="font-semibold">Privacy Policy Agreed</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-700">100%</span>
            <span className="text-[10px] text-slate-400">
              ({total} accepted)
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            R.A. 10173 full compliance
          </div>
        </div>

        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span className="font-semibold">Top Purpose Selected</span>
            <Target className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5 truncate">
            <span className="text-sm font-extrabold text-slate-800 truncate">
              {topPurposeMeta?.label || 'None yet'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {topPurpose ? `${topPurpose.count} selections (${topPurpose.percentage}%)` : 'Awaiting responses'}
          </div>
        </div>
      </div>

      {/* Visual Graphs Section (Compact 3-column charts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Graph 1: Purpose Distribution Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-700" />
              <h3 className="text-xs font-bold text-slate-800">
                Purpose Distribution
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Actual counts</span>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            {purposeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={purposeChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748B' }} />
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
              <div className="text-center text-slate-400 text-xs py-8">
                <Target className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <span>No survey purpose data recorded yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Graph 2: Push Notifications Donut Chart */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <PieIcon className="w-3.5 h-3.5 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800">
                Notification Opt-in
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Enabled vs Skipped</span>
          </div>

          <div className="h-44 w-full relative flex items-center justify-center">
            {total > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={notifChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {notifChartData.map((entry, i) => (
                        <Cell key={`notif-${i}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0];
                        return (
                          <div className="bg-slate-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-md">
                            <span className="font-bold">{item.name}: </span>
                            <span>{item.value} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)</span>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center metric */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-extrabold text-slate-800 leading-none">
                    {notifications.optInRate}%
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">Opt-in</span>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-400 text-xs py-8">
                <Bell className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <span>No notification records yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Graph 3: Submissions Timeline Trend */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-700" />
              <h3 className="text-xs font-bold text-slate-800">
                Onboarding Activity Trend
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Daily submissions</span>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            {timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-md">
                          <p className="font-bold">{item.date}</p>
                          <p>Total: {item.total} responses</p>
                          <p className="text-emerald-300">Push Opt-in: {item.notifications}</p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#006A3B"
                    strokeWidth={2}
                    fill="#DCFCE7"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 text-xs py-8">
                <TrendingUp className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <span>No daily timeline data recorded yet</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Top Barangays & Recent Submissions (Compact Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
        {/* Top Barangays List (5 cols) */}
        <div className="lg:col-span-5 bg-slate-50/60 rounded-xl p-3 border border-slate-200/70">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
              Barangay Distribution
            </h3>
            <span className="text-[10px] text-slate-400">
              {byBarangay.length} active barangays
            </span>
          </div>

          {byBarangay.length > 0 ? (
            <div className="space-y-2">
              {byBarangay.slice(0, 5).map((b, idx) => (
                <div key={b.barangay} className="text-xs">
                  <div className="flex items-center justify-between text-slate-700 font-medium mb-1">
                    <span className="truncate pr-2">
                      <span className="text-slate-400 text-[10px] mr-1.5">#{idx + 1}</span>
                      {b.barangay}
                    </span>
                    <span className="text-slate-900 font-bold flex-shrink-0">
                      {b.count} <span className="text-[10px] font-normal text-slate-400">({b.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(4, b.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-400 text-xs py-6">
              No barangay onboarding records yet.
            </div>
          )}
        </div>

        {/* Recent Submissions Feed (7 cols) */}
        <div className="lg:col-span-7 bg-slate-50/60 rounded-xl p-3 border border-slate-200/70 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-slate-600" />
              Recent Mobile Onboardings (Latest 10)
            </h3>
            <span className="text-[10px] text-slate-400">Actual telemetry</span>
          </div>

          {recent.length > 0 ? (
            <div className="divide-y divide-slate-200/60 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="pb-1.5 font-semibold">Barangay</th>
                    <th className="pb-1.5 font-semibold">Purposes</th>
                    <th className="pb-1.5 font-semibold text-center">Push</th>
                    <th className="pb-1.5 font-semibold text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.slice(0, 5).map((row) => (
                    <tr key={row._id} className="hover:bg-white/80 transition-colors">
                      <td className="py-1.5 font-semibold text-slate-800 max-w-[130px] truncate">
                        {row.barangay || '—'}
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {row.purposes?.map((p) => {
                            const meta = PURPOSE_META[p];
                            return (
                              <span
                                key={p}
                                className={`text-[9px] px-1.5 py-0.5 rounded font-medium border ${
                                  meta?.bg || 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {meta?.label || p}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-1.5 text-center">
                        {row.notificationsEnabled ? (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                            ON
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                            OFF
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right text-[11px] text-slate-400 whitespace-nowrap">
                        {timeAgo(row.submittedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-slate-400 text-xs py-6">
              No recent onboarding events recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
