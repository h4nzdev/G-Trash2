import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Scale, Truck, AlertTriangle, TrendingUp, Calendar, ChevronRight, Radio, Wind, Thermometer, Droplets, Gauge, RefreshCw, Heart, ShieldAlert, Activity, MapPin, X, MessageSquare, Users, CheckCircle, Navigation, Lightbulb, Eye } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line,
} from 'recharts';
import { io } from 'socket.io-client';
import StatCard from '../components/dashboard/StatCard';
import PollutionChart from '../components/dashboard/PollutionChart';
import RecentAlerts from '../components/dashboard/RecentAlerts';
import BarangayRanking from '../components/dashboard/BarangayRanking';
import { useAuth } from '../context/AuthContext';
import API from '../config';

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2">
      <p className="text-xs font-bold text-slate-700">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-xs font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()} {entry.name === 'Bins' ? 'bins' : ''}
        </p>
      ))}
    </div>
  );
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ChdDashboard() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/iot/health-summary`)
      .then(r => r.json())
      .then(data => { setHealthData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const riskCounts = healthData?.riskCounts || { high: 0, moderate: 0, low: 0 };
  const recentAlerts = healthData?.recentAlerts || [];
  const barangaysAtRisk = healthData?.barangaysAtRisk || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Health Risk Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">City Health Department — Environmental health monitoring</p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetch(`${API}/api/iot/health-summary`).then(r => r.json()).then(data => { setHealthData(data); setLoading(false); }).catch(() => setLoading(false));
          }}
          className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors border border-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Health Risk Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`bg-white rounded-2xl border p-5 flex items-center gap-4 ${riskCounts.high > 0 ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-100'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-red-600 bg-red-100 text-xl font-bold ${riskCounts.high > 0 ? 'animate-pulse' : ''}`}>
            🔴
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{loading ? '–' : riskCounts.high}</p>
            <p className="text-xs font-semibold text-slate-700">High Risk Zones</p>
            <p className="text-[10px] text-slate-400">NH₃ &gt;50ppm or CH₄ &gt;25% LEL</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-amber-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-amber-600 bg-amber-100 text-xl font-bold">
            🟡
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{loading ? '–' : riskCounts.moderate}</p>
            <p className="text-xs font-semibold text-slate-700">Moderate Risk Zones</p>
            <p className="text-[10px] text-slate-400">NH₃ 25–50ppm or CH₄ 10–25%</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-100 text-xl font-bold">
            🟢
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{loading ? '–' : riskCounts.low}</p>
            <p className="text-xs font-semibold text-slate-700">Low Risk Zones</p>
            <p className="text-[10px] text-slate-400">NH₃ &lt;25ppm — Safe levels</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Health Alerts */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              Recent Health Alerts
              {recentAlerts.length > 0 && (
                <span className="text-[10px] font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                  Last 7 days
                </span>
              )}
            </h2>
          </div>
          {loading ? (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : recentAlerts.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No alerts in the last 7 days</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentAlerts.slice(0, 6).map((alert, i) => (
                <div key={alert._id || i} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${
                  alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
                  alert.severity === 'moderate' ? 'bg-amber-50 border-amber-200' :
                  'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    alert.severity === 'critical' ? 'bg-red-500 animate-pulse' :
                    alert.severity === 'moderate' ? 'bg-amber-500' : 'bg-slate-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{alert.message}</p>
                    <p className="text-[10px] text-slate-400">
                      {alert.location && `📍 ${alert.location}`}{alert.barangay && `, ${alert.barangay}`} · {timeAgo(alert.createdAt)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    alert.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{alert.severity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Barangays Requiring Attention */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" />
              Barangays Requiring Attention
            </h2>
          </div>
          {loading ? (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : barangaysAtRisk.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <Heart className="w-8 h-8 mx-auto mb-2 text-emerald-300" />
              <p className="text-sm font-medium">All barangays are within safe limits</p>
            </div>
          ) : (
            <div className="space-y-2">
              {barangaysAtRisk.map((b, i) => {
                const isHigh = b.maxAmmonia > 50 || b.maxMethane > 25;
                return (
                  <div key={b.name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${isHigh ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <span className="text-sm w-6 text-center font-bold text-slate-500">#{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{b.name}</p>
                      <p className="text-[10px] text-slate-500">
                        NH₃: <span className={`font-bold ${b.maxAmmonia > 50 ? 'text-red-600' : 'text-amber-600'}`}>{b.maxAmmonia.toFixed(1)} ppm</span>
                        {' · '}CH₄: <span className={`font-bold ${b.maxMethane > 25 ? 'text-red-600' : 'text-amber-600'}`}>{b.maxMethane.toFixed(1)}%</span>
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isHigh ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isHigh ? 'HIGH RISK' : 'MODERATE'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">📊 CHD Data Access</p>
        <p className="text-xs text-blue-700">
          You have full access to <strong>Heatmap Analytics</strong> and <strong>Collection History</strong>.
          You can view and flag health concerns in <strong>Reports</strong>.
          Use the sidebar to navigate to these sections.
        </p>
      </div>
    </div>
  );
}

const PIE_COLORS = ['#065f46', '#10b981', '#6ee7b7', '#d1fae5'];

const ANSWER_LABELS = {
  'I want my barangay to win': 'Win for Barangay',
  'I want to earn points': 'Earn Points',
  'I just want to keep my area clean': 'Keep Area Clean',
  'Other': 'Other',
};

function SurveyResultsCard({ data, period, context, onPeriodChange, onContextChange }) {
  const total = data?.totalResponses ?? 0;
  const results = data?.results ?? [];

  const gamificationPct = total > 0
    ? results
        .filter(r => r.answer === 'I want my barangay to win' || r.answer === 'I want to earn points')
        .reduce((sum, r) => sum + r.count, 0) / total * 100
    : 0;

  const pieData = results.map((r, i) => ({
    name: ANSWER_LABELS[r.answer] ?? r.answer,
    value: r.count,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const periodBtns = [
    { key: 'all', label: 'All Time' },
    { key: 'month', label: 'This Month' },
    { key: 'week', label: 'This Week' },
  ];

  const contextBtns = [
    { key: 'all', label: 'All' },
    { key: 'after_scan', label: 'After Scan' },
    { key: 'after_report', label: 'After Report' },
    { key: 'viewing_leaderboard', label: 'Leaderboard' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">User Feedback — Gamification Survey</h2>
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
            {total} responses
          </span>
        </div>
        {/* Period filters */}
        <div className="flex items-center gap-1.5">
          {periodBtns.map(b => (
            <button
              key={b.key}
              onClick={() => onPeriodChange(b.key)}
              className={`text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors ${
                period === b.key
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Context filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Trigger:</span>
        {contextBtns.map(b => (
          <button
            key={b.key}
            onClick={() => onContextChange(b.key)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors border ${
              context === b.key
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium">No survey responses yet</p>
          <p className="text-xs mt-1">Responses appear after residents submit the in-app survey</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie chart */}
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{value}</span>}
                />
                <Tooltip
                  formatter={(value, name) => [`${value} responses`, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Stats + insight */}
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={r.answer} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{r.answer}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${r.percentage}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 w-8 text-right">{r.percentage}%</span>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-slate-400 w-6 text-right">{r.count}</span>
              </div>
            ))}

            {/* Key insight */}
            <div className={`mt-4 rounded-xl p-3.5 ${gamificationPct >= 50 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
              <p className={`text-xs font-bold mb-1 ${gamificationPct >= 50 ? 'text-emerald-800' : 'text-amber-800'}`}>
                {gamificationPct >= 50 ? '✅ Gamification is working!' : '📊 Gamification insight'}
              </p>
              <p className={`text-[11px] leading-relaxed ${gamificationPct >= 50 ? 'text-emerald-700' : 'text-amber-700'}`}>
                <strong>{Math.round(gamificationPct)}%</strong> of residents are motivated by gamification
                (winning + points). {gamificationPct >= 50
                  ? 'The majority of users are driven by the leaderboard and rewards system.'
                  : 'More responses needed to confirm gamification effectiveness.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OfficialsDashboard() {
  const { official } = useAuth();
  const location = useLocation();
  const socketRef = useRef(null);
  const isChd = official?.role === 'chd';

  // Shared state — toast for access denied redirect
  const [accessDeniedToast, setAccessDeniedToast] = useState(false);

  // Officials-only state (always declared, skipped when CHD)
  const [iotSummary, setIotSummary] = useState({ totalSensors: 0, recentReadings: 0, activeAlerts: 0, criticalAlerts: 0 });
  const [pollutionData, setPollutionData] = useState([]);
  const [iotAlerts, setIotAlerts] = useState([]);
  const [latestReadings, setLatestReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalFleet: 0, activeTrucks: 0, totalReports: 0, pendingReports: 0 });
  const [rankings, setRankings] = useState([]);
  const [surveyData, setSurveyData] = useState(null);
  const [surveyPeriod, setSurveyPeriod] = useState('all');
  const [surveyContext, setSurveyContext] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState('week');
  const [collectionStats, setCollectionStats] = useState([]);

  useEffect(() => {
    if (location.state?.chdAccessDenied) {
      setAccessDeniedToast(true);
      setTimeout(() => setAccessDeniedToast(false), 4000);
    }
  }, [location.state]);

  const fetchSurvey = async (period = surveyPeriod, ctx = surveyContext) => {
    try {
      const params = new URLSearchParams();
      if (period !== 'all') params.set('period', period);
      if (ctx !== 'all') params.set('context', ctx);
      const res = await fetch(`${API}/api/survey/results?${params}`);
      const data = await res.json();
      setSurveyData(data);
    } catch {}
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [summaryRes, trendsRes, alertsRes, latestRes, statsRes, rankingsRes, collectionRes] = await Promise.all([
        fetch(`${API}/api/iot/summary`).then(r => r.json()),
        fetch(`${API}/api/iot/trends?hours=168`).then(r => r.json()),
        fetch(`${API}/api/iot/alerts?limit=10`).then(r => r.json()),
        fetch(`${API}/api/iot/readings/latest`).then(r => r.json()),
        fetch(`${API}/api/stats`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('gtrash_token')}` }
        }).then(r => r.ok ? r.json() : { totalFleet: 0, activeTrucks: 0, totalReports: 0, pendingReports: 0 }),
        fetch(`${API}/api/leaderboard`).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/analytics/collection-stats`).then(r => r.ok ? r.json() : []),
      ]);
      setIotSummary(summaryRes);
      setPollutionData(Array.isArray(trendsRes) ? trendsRes : []);
      setIotAlerts(Array.isArray(alertsRes) ? alertsRes : []);
      setLatestReadings(Array.isArray(latestRes) ? latestRes : []);
      setStats(statsRes);
      setRankings(Array.isArray(rankingsRes) ? rankingsRes : []);
      setCollectionStats(Array.isArray(collectionRes) ? collectionRes : []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
    fetchSurvey();
  };

  useEffect(() => {
    if (isChd) return; // CHD uses its own data source in ChdDashboard

    fetchAll();

    const socket = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('iot:reading', (reading) => {
      setLatestReadings(prev => {
        const filtered = prev.filter(r => r.sensorId !== reading.sensorId);
        return [reading, ...filtered];
      });
      setIotSummary(prev => ({ ...prev, recentReadings: prev.recentReadings + 1 }));
    });

    socket.on('iot:alert', (alert) => {
      setIotAlerts(prev => [alert, ...prev].slice(0, 10));
      setIotSummary(prev => ({
        ...prev,
        activeAlerts: prev.activeAlerts + 1,
        criticalAlerts: alert.severity === 'critical' ? prev.criticalAlerts + 1 : prev.criticalAlerts,
      }));
    });

    socket.on('report:new', () => {
      setStats(prev => ({ ...prev, totalReports: prev.totalReports + 1, pendingReports: prev.pendingReports + 1 }));
    });

    socket.on('truck:status', () => {
      fetch(`${API}/api/stats`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('gtrash_token')}` }
      }).then(r => r.ok ? r.json() : null).then(data => {
        if (data) setStats(data);
      });
    });

    socket.on('collection:new', () => {
      fetch(`${API}/api/analytics/collection-stats`).then(r => r.ok ? r.json() : []).then(data => {
        if (Array.isArray(data)) setCollectionStats(data);
      });
    });

    return () => socket.disconnect();
  }, [isChd]);

  // Access denied toast element (shared)
  const accessDeniedBanner = accessDeniedToast && (
    <div className="fixed top-4 right-4 z-[2000] flex items-center gap-3 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg">
      <ShieldAlert className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-semibold">Access Denied — CHD does not have access to that page</span>
      <button onClick={() => setAccessDeniedToast(false)} className="ml-2 hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  // CHD sees a health-focused dashboard
  if (isChd) {
    return (
      <>
        {accessDeniedBanner}
        <ChdDashboard />
      </>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const weekNum = Math.ceil((new Date().getDate() + new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay()) / 7);

  const formattedAlerts = iotAlerts.slice(0, 5).map((a, i) => ({
    id: a._id || i,
    location: `${a.location || 'Unknown'}${a.barangay ? `, ${a.barangay}` : ''}`,
    time: timeAgo(a.createdAt),
    severity: a.severity,
    message: a.message,
  }));

  const worstAQ = latestReadings.reduce((worst, r) => {
    const order = { Hazardous: 4, Unhealthy: 3, Moderate: 2, Good: 1 };
    return (order[r.airQuality] || 0) > (order[worst] || 0) ? r.airQuality : worst;
  }, 'Good');

  const aqColor = { Good: 'green', Moderate: 'amber', Unhealthy: 'red', Hazardous: 'red' };

  const getFilteredCollectionData = () => {
    if (!collectionStats.length) return [];
    
    let filtered = collectionStats;
    if (collectionFilter === 'week') {
      filtered = collectionStats.slice(-7);
    } else if (collectionFilter === 'month') {
      filtered = collectionStats.slice(-30);
    } else if (collectionFilter === 'year') {
      const byMonth = {};
      collectionStats.forEach(d => {
        const month = d.date.substring(0, 7);
        byMonth[month] = (byMonth[month] || 0) + d.binsCleared;
      });
      return Object.entries(byMonth).map(([m, val]) => ({ name: m, Bins: val }));
    } else if (collectionFilter === 'today') {
      const today = new Date().toISOString().substring(0,10);
      const todayData = collectionStats.find(d => d.date === today);
      return [{ name: today, Bins: todayData ? todayData.binsCleared : 0 }];
    }
    
    return filtered.map(d => ({
      name: d.date.substring(5), // MM-DD
      Bins: d.binsCleared
    }));
  };

  // Generate top 5 polluted barangays for grouped bar chart
  const pollutionByArea = latestReadings
    .map(r => ({
      name: r.barangay || r.location || 'Unknown',
      NH3: r.ammonia || 0,
      CH4: r.methane || 0,
      score: (r.ammonia || 0) + (r.methane * 10 || 0) // weight CH4 heavier for sorting
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* Date Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {today} · Week {weekNum}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors border border-emerald-200">
            Generate Report <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Truck}
          title="Active Trucks"
          value={`${stats.activeTrucks}/${stats.totalFleet}`}
          subtitle="On route today"
          color="blue"
        />
        <StatCard
          icon={Radio}
          title="IoT Sensors Integrated"
          value={iotSummary.totalSensors}
          subtitle={`${iotSummary.recentReadings} readings in last hour`}
          color="emerald"
        />
        <StatCard
          icon={CheckCircle}
          title="Barangays Collected"
          value="12 / 80"
          subtitle="Estimated 15% completion"
          color="emerald"
        />
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Lightbulb className="w-16 h-16 text-amber-500" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Navigation className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Route Recommendation</h3>
              </div>
              <p className="text-base font-bold text-amber-600 leading-tight">Priority: Lahug</p>
            </div>
            <p className="text-xs font-medium text-slate-600 mt-2 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100/50">
              Bin levels at 95% in sector 4.
            </p>
          </div>
        </div>
      </div>

      {/* Core Analytics: Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection History Line Graph */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" /> Waste Collected
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Total volume collected across all routes</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {['today', 'week', 'month', 'year'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setCollectionFilter(filter)}
                  className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-md transition-all ${
                    collectionFilter === filter ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const chartData = getFilteredCollectionData();
            if (chartData.length === 0) {
              return (
                <div className="h-[260px] flex flex-col items-center justify-center text-slate-400">
                  <TrendingUp className="w-10 h-10 mb-3 text-slate-300" />
                  <p className="text-sm font-medium">No collection data available</p>
                  <p className="text-xs mt-1">No waste collections recorded for this period</p>
                </div>
              );
            }
            return (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<BarTooltip />} />
                    <Line type="monotone" dataKey="Bins" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>

        {/* Pollution by Area Grouped Bar Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Wind className="w-4 h-4 text-emerald-500" /> Pollution by Area
                <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> LIVE
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Top 5 barangays with highest gas levels</p>
            </div>
          </div>
          {pollutionByArea.length > 0 ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pollutionByArea} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#475569' }} />
                  <Bar dataKey="NH3" name="Ammonia (ppm)" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="CH4" name="Methane (%)" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center text-slate-400">
              <Gauge className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium">No pollution data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Actionable Data: Detailed IoT Alerts Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Active IoT Alerts
              {iotAlerts.length > 0 && (
                <span className="text-[10px] font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {iotAlerts.filter(a => !a.acknowledged).length} Requires Action
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Real-time alerts requiring official response</p>
          </div>
          <button className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
            View All Alerts
          </button>
        </div>
        <div className="overflow-x-auto">
          {formattedAlerts.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Severity</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Sensor ID / Location</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Issue Details</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Time</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {formattedAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-700 border border-red-200' :
                        alert.severity === 'moderate' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {alert.severity === 'critical' && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />}
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">IR-SENSOR-0{alert.id % 9 + 1}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {alert.location}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 min-w-[250px]">
                      <p className="text-xs font-medium text-slate-700 leading-snug">{alert.message}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[11px] font-medium text-slate-500">{alert.time}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 bg-white border border-slate-200 shadow-sm hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all opacity-0 group-hover:opacity-100">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-slate-400 bg-slate-50/30">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No active alerts</p>
              <p className="text-xs mt-1">Systems are operating within normal parameters.</p>
            </div>
          )}
        </div>
      </div>


      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pollution Trends Line Chart (moved to secondary data) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Pollution Trends Over Time
                {pollutionData.length > 0 && (
                  <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> LIVE
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {pollutionData.length > 0
                  ? `Ammonia & methane levels — ${pollutionData.length} data points`
                  : 'No IoT sensor data yet — send data via Postman to see trends'}
              </p>
            </div>
          </div>
          {pollutionData.length > 0 ? (
            <PollutionChart data={pollutionData} />
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-slate-400">
              <Gauge className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium">No sensor data yet</p>
              <p className="text-xs mt-1">POST to /api/iot/sensor-data to start tracking</p>
            </div>
          )}
        </div>

        {/* Top Barangays */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Top Performing Barangays
                {rankings.length > 0 && (
                  <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> LIVE
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Ranked by total points earned</p>
            </div>
          </div>
          <BarangayRanking data={rankings} />
        </div>
      </div>

      {/* Survey Results */}
      <SurveyResultsCard
        data={surveyData}
        period={surveyPeriod}
        context={surveyContext}
        onPeriodChange={(p) => { setSurveyPeriod(p); fetchSurvey(p, surveyContext); }}
        onContextChange={(c) => { setSurveyContext(c); fetchSurvey(surveyPeriod, c); }}
      />
    </div>
  );
}
