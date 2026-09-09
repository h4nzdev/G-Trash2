import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Scale, Truck, AlertTriangle, TrendingUp, Calendar, ChevronRight, Radio, Wind, RefreshCw, Heart, ShieldAlert, Activity, MapPin, X, MessageSquare, Users, CheckCircle, Navigation, Lightbulb, Eye, FileText, Layers, LayoutDashboard, BarChart3, Map, Layers3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line,
} from 'recharts';
import { io } from 'socket.io-client';
import StatCard from '../components/dashboard/StatCard';
import PollutionChart from '../components/dashboard/PollutionChart';
import RecentAlerts from '../components/dashboard/RecentAlerts';
import BarangayRanking from '../components/dashboard/BarangayRanking';
import RecentReportsWidget from '../components/dashboard/RecentReportsWidget';
import SensorStatusWidget from '../components/dashboard/SensorStatusWidget';
import ProgressBar from '../components/shared/ProgressBar';
import { useAuth } from '../context/AuthContext';
import API from '../config';

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2">
      <p className="text-xs font-bold text-slate-700">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-xs font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()} {entry.name === 'Bins' ? 'bins cleared' : ''}
        </p>
      ))}
    </div>
  );
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
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
            <p className="text-[10px] text-slate-400">Raw ADC &ge; 700</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-amber-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-amber-600 bg-amber-100 text-xl font-bold">
            🟡
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{loading ? '–' : riskCounts.moderate}</p>
            <p className="text-xs font-semibold text-slate-700">Moderate Risk Zones</p>
            <p className="text-[10px] text-slate-400">Raw ADC 400 – 699</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-100 text-xl font-bold">
            🟢
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{loading ? '–' : riskCounts.low}</p>
            <p className="text-xs font-semibold text-slate-700">Low Risk Zones</p>
            <p className="text-[10px] text-slate-400">Raw ADC &lt; 400 — Clean air</p>
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
                const isHigh = b.maxRawValue !== undefined ? b.maxRawValue >= 700 : (b.maxAmmonia > 50 || b.maxMethane > 25);
                const rawVal = b.maxRawValue ?? 0;
                const voltageVal = (rawVal * 3.3) / 4095.0;
                return (
                  <div key={b.name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${isHigh ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <span className="text-sm w-6 text-center font-bold text-slate-500">#{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{b.name}</p>
                      <p className="text-[10px] text-slate-500">
                        Raw ADC: <span className={`font-bold ${isHigh ? 'text-red-600' : 'text-amber-600'}`}>{rawVal}</span>
                        {' · '}Voltage: <span className={`font-bold ${isHigh ? 'text-red-600' : 'text-amber-600'}`}>{voltageVal.toFixed(2)}V</span>
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

const PIE_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#94a3b8'];

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">User Feedback — Gamification Survey</h2>
          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
            {total} responses
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {periodBtns.map(b => (
            <button
              key={b.key}
              onClick={() => onPeriodChange(b.key)}
              className={`text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors ${
                period === b.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Trigger:</span>
        {contextBtns.map(b => (
          <button
            key={b.key}
            onClick={() => onContextChange(b.key)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors border ${
              context === b.key
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
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

            <div className={`mt-4 rounded-xl p-3.5 ${gamificationPct >= 50 ? 'bg-indigo-50 border border-indigo-200' : 'bg-amber-50 border border-amber-200'}`}>
              <p className={`text-xs font-bold mb-1 ${gamificationPct >= 50 ? 'text-indigo-800' : 'text-amber-800'}`}>
                {gamificationPct >= 50 ? '✅ Gamification is working!' : '📊 Gamification insight'}
              </p>
              <p className={`text-[11px] leading-relaxed ${gamificationPct >= 50 ? 'text-indigo-700' : 'text-amber-700'}`}>
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

function ChdDashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-56 bg-slate-200 rounded-lg" />
          <div className="h-3 w-48 bg-slate-100 rounded" />
        </div>
        <div className="h-8 w-24 bg-slate-200 rounded-lg" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-200" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-12 bg-slate-200 rounded" />
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 space-y-4">
            <div className="h-5 w-44 bg-slate-200 rounded" />
            <div className="space-y-3">
              {[1, 2, 3].map(j => (
                <div key={j} className="h-12 bg-slate-50 rounded-xl border border-slate-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="space-y-2">
          <div className="h-5 w-72 bg-slate-200 rounded-lg" />
          <div className="h-3 w-44 bg-slate-100 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-slate-200 rounded-xl" />
          <div className="h-8 w-32 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-slate-200 rounded" />
              <div className="w-8 h-8 bg-slate-100 rounded-xl" />
            </div>
            <div className="h-7 w-24 bg-slate-200 rounded-lg" />
            <div className="h-3 w-36 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div className="h-5 w-44 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-100 rounded" />
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-slate-50 rounded-xl border border-slate-100 flex items-center p-3 gap-3">
              <div className="w-10 h-10 bg-slate-200 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-1/2 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="h-4 w-36 bg-slate-200 rounded" />
            <div className="h-6 w-48 bg-slate-200 rounded" />
            <div className="h-10 bg-slate-100 rounded-xl" />
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="h-5 w-40 bg-slate-200 rounded" />
            <div className="h-32 bg-slate-50 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OfficialsDashboard() {
  const { official } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const isChd = official?.role === 'chd';

  // Shared state — toast for access denied redirect
  const [accessDeniedToast, setAccessDeniedToast] = useState(false);

  // Active view tab state: 'operations' (default) vs 'analytics'
  const [activeTab, setActiveTab] = useState('operations');

  // Officials-only state
  const [iotSummary, setIotSummary] = useState({ totalSensors: 0, recentReadings: 0, activeAlerts: 0, criticalAlerts: 0 });
  const [pollutionData, setPollutionData] = useState([]);
  const [iotAlerts, setIotAlerts] = useState([]);
  const [latestReadings, setLatestReadings] = useState([]);
  const [reportsList, setReportsList] = useState([]);
  const [sitioDistribution, setSitioDistribution] = useState([]);
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
      const headers = { Authorization: `Bearer ${localStorage.getItem('gtrash_token')}` };
      const todayStr = new Date().toISOString().substring(0, 10);
      const currentMonth = todayStr.substring(0, 7);

      const [summaryRes, trendsRes, alertsRes, latestRes, statsRes, rankingsRes, collectionRes, fleetRes, schedulesRes, collectionsRes, reportsRes] = await Promise.all([
        fetch(`${API}/api/iot/summary`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/api/iot/trends?hours=168`, { headers }).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/iot/alerts?limit=10`, { headers }).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/iot/readings/latest`, { headers }).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/stats`, { headers }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
        fetch(`${API}/api/leaderboard`).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/analytics/collection-stats`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API}/api/fleet`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API}/api/schedules?month=${currentMonth}`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API}/api/collections`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API}/api/reports`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);

      setIotSummary(summaryRes || {});
      setPollutionData(Array.isArray(trendsRes) ? trendsRes : []);
      setRankings(Array.isArray(rankingsRes) ? rankingsRes : []);

      // Calculate scoped & accurate stats
      const isScoped = official?.barangay && official.barangay !== 'All' && official.role !== 'superadmin';
      const userBrgy = official?.barangay?.toLowerCase()?.trim();

      // Scoped IoT Readings & Alerts
      let scopedReadings = Array.isArray(latestRes) ? latestRes : [];
      let scopedAlerts = Array.isArray(alertsRes) ? alertsRes : [];
      if (isScoped && userBrgy) {
        scopedReadings = scopedReadings.filter(r => r.barangay && r.barangay.toLowerCase().trim() === userBrgy);
        scopedAlerts = scopedAlerts.filter(a => a.barangay && a.barangay.toLowerCase().trim() === userBrgy);
      }
      setLatestReadings(scopedReadings);
      setIotAlerts(scopedAlerts);

      // Scoped resident reports
      let allReports = Array.isArray(reportsRes) ? reportsRes : [];
      if (isScoped && userBrgy) {
        allReports = allReports.filter(r => r.barangay?.toLowerCase() === userBrgy);
      }
      setReportsList(allReports);

      // Fleet scoping
      let scopedFleet = Array.isArray(fleetRes) ? fleetRes : [];
      if (isScoped && userBrgy) {
        scopedFleet = scopedFleet.filter(t => 
          t.barangay?.toLowerCase() === userBrgy || 
          (t.type === 'shared' && Array.isArray(t.serviceBarangays) && t.serviceBarangays.some(b => b.toLowerCase() === userBrgy))
        );
      }
      const totalFleet = scopedFleet.length;
      const activeTrucks = scopedFleet.filter(t => t.status === 'online' || t.status === 'on-route' || t.isOnline).length || (totalFleet > 0 ? 1 : 0);

      // Schedules & Stops Cleared scoping
      const allSchedules = Array.isArray(schedulesRes) ? schedulesRes : [];
      const todaySchedules = allSchedules.filter(s => 
        s.date === todayStr && (!isScoped || s.barangay?.toLowerCase() === userBrgy)
      );

      const allCollections = Array.isArray(collectionsRes) ? collectionsRes : [];
      const todayCollections = allCollections.filter(c => {
        const cDate = (c.createdAt || c.date || '').substring(0, 10);
        return cDate === todayStr && (!isScoped || c.route?.toLowerCase()?.includes(userBrgy) || c.barangay?.toLowerCase() === userBrgy);
      });

      // Calculate Sitio collection distribution
      const sitioCounts = {};
      allCollections.forEach(c => {
        const sName = c.stopName || c.sitio || c.location || 'Central Area';
        if (isScoped && userBrgy && c.barangay && c.barangay.toLowerCase() !== userBrgy) return;
        sitioCounts[sName] = (sitioCounts[sName] || 0) + (c.bins || 1);
      });

      // Default sitio fallback if no collection logs yet
      if (Object.keys(sitioCounts).length === 0) {
        sitioCounts['Sitio Upper Apas'] = 14;
        sitioCounts['Sitio Central'] = 10;
        sitioCounts['Sitio Driveway'] = 6;
        sitioCounts['Sitio Lahug Border'] = 4;
      }

      const totalDistributionBins = Object.values(sitioCounts).reduce((a, b) => a + b, 0);
      const formattedSitioDist = Object.entries(sitioCounts)
        .map(([name, count]) => ({
          name,
          count,
          percentage: totalDistributionBins > 0 ? Math.round((count / totalDistributionBins) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setSitioDistribution(formattedSitioDist);

      let totalTasks = 0;
      let completedTasks = 0;

      if (todaySchedules.length > 0) {
        todaySchedules.forEach(s => {
          if (s.sitioTasks && s.sitioTasks.length > 0) {
            totalTasks += s.sitioTasks.length;
            completedTasks += s.sitioTasks.filter(t => t.completed).length;
          } else if (s.sitios && s.sitios.length > 0) {
            totalTasks += s.sitios.length;
            const completedCount = s.sitios.filter(st => 
              todayCollections.some(c => c.stopName?.toLowerCase() === st.toLowerCase())
            ).length;
            completedTasks += Math.max(completedCount, s.status === 'completed' ? s.sitios.length : 0);
          } else {
            totalTasks += 1;
            if (s.status === 'completed' || todayCollections.length > 0) completedTasks += 1;
          }
        });
      }

      if (todayCollections.length > completedTasks) {
        completedTasks = todayCollections.length;
        if (completedTasks > totalTasks) totalTasks = completedTasks;
      }

      // Priority Route Recommendation
      let priorityArea = isScoped ? official.barangay : (statsRes?.priorityArea || 'All Areas');
      let priorityReason = 'All areas operating under standard parameters.';
      if (todaySchedules.length > 0 && completedTasks < totalTasks) {
        priorityReason = `${totalTasks - completedTasks} scheduled stop(s) remaining for today.`;
      } else if (todaySchedules.length > 0 && completedTasks >= totalTasks && totalTasks > 0) {
        priorityReason = `All ${totalTasks} scheduled stops completed today.`;
      }

      // Today's total bins cleared volume
      const totalBinsToday = todayCollections.reduce((sum, c) => sum + (c.bins || 1), 0);

      setStats({
        totalFleet,
        activeTrucks,
        totalTasks,
        completedTasks,
        totalReports: allReports.length,
        pendingReports: allReports.filter(r => r.status === 'pending').length,
        acknowledgedReports: allReports.filter(r => r.status === 'acknowledged' || r.status === 'in-progress').length,
        totalBinsToday,
        priorityArea,
        priorityReason,
      });

      // Collections chart scoping
      if (Array.isArray(collectionRes) && collectionRes.length > 0) {
        setCollectionStats(collectionRes);
      } else if (allCollections.length > 0) {
        const byDay = {};
        allCollections.forEach(c => {
          const d = (c.createdAt || c.date || '').substring(0, 10);
          if (d) byDay[d] = (byDay[d] || 0) + (c.bins || 1);
        });
        const generatedStats = Object.entries(byDay).map(([date, binsCleared]) => ({ date, binsCleared }));
        setCollectionStats(generatedStats);
      } else {
        setCollectionStats([]);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
    fetchSurvey();
  };

  useEffect(() => {
    if (isChd) return;

    fetchAll();

    const socket = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('iot:reading', (reading) => {
      const isScoped = official?.barangay && official.barangay !== 'All' && official.role !== 'superadmin';
      const userBrgy = official?.barangay?.toLowerCase()?.trim();
      if (isScoped && userBrgy && reading.barangay && reading.barangay.toLowerCase().trim() !== userBrgy) {
        return;
      }
      setLatestReadings(prev => {
        const filtered = prev.filter(r => r.sensorId !== reading.sensorId);
        return [reading, ...filtered];
      });
      setIotSummary(prev => ({ ...prev, recentReadings: (prev.recentReadings || 0) + 1 }));
    });

    socket.on('iot:alert', (alert) => {
      const isScoped = official?.barangay && official.barangay !== 'All' && official.role !== 'superadmin';
      const userBrgy = official?.barangay?.toLowerCase()?.trim();
      if (isScoped && userBrgy && alert.barangay && alert.barangay.toLowerCase().trim() !== userBrgy) {
        return;
      }
      setIotAlerts(prev => [alert, ...prev].slice(0, 10));
      setIotSummary(prev => ({
        ...prev,
        activeAlerts: (prev.activeAlerts || 0) + 1,
        criticalAlerts: alert.severity === 'critical' ? (prev.criticalAlerts || 0) + 1 : prev.criticalAlerts,
      }));
    });

    socket.on('report:new', () => { fetchAll(); });
    socket.on('report:updated', () => { fetchAll(); });
    socket.on('truck:status', () => { fetchAll(); });
    socket.on('schedule:changed', () => { fetchAll(); });
    socket.on('collection:new', () => { fetchAll(); });

    return () => socket.disconnect();
  }, [isChd]);

  const accessDeniedBanner = accessDeniedToast && (
    <div className="fixed top-4 right-4 z-[2000] flex items-center gap-3 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg">
      <ShieldAlert className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-semibold">Access Denied — CHD does not have access to that page</span>
      <button onClick={() => setAccessDeniedToast(false)} className="ml-2 hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  if (isChd) {
    if (loading) {
      return (
        <>
          {accessDeniedBanner}
          <ChdDashboardSkeleton />
        </>
      );
    }
    return (
      <>
        {accessDeniedBanner}
        <ChdDashboard />
      </>
    );
  }

  if (loading && !reportsList.length && !collectionStats.length) {
    return (
      <>
        {accessDeniedBanner}
        <DashboardSkeleton />
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
        const month = (d.date || '').substring(0, 7);
        byMonth[month] = (byMonth[month] || 0) + d.binsCleared;
      });
      return Object.entries(byMonth).map(([m, val]) => ({ name: m, Bins: val }));
    } else if (collectionFilter === 'today') {
      const today = new Date().toISOString().substring(0,10);
      const todayData = collectionStats.find(d => (d.date || '').substring(0,10) === today);
      return [{ name: today, Bins: todayData ? todayData.binsCleared : 0 }];
    }
    
    return filtered.map(d => ({
      name: (d.date || '').substring(5),
      Bins: d.binsCleared
    }));
  };

  const currentBarangayName = official?.barangay && official.barangay !== 'All' ? official.barangay : 'Cebu City';

  const chartData = getFilteredCollectionData();
  const totalBinsInChart = chartData.reduce((sum, d) => sum + (d.Bins || 0), 0);
  const avgBinsPerPeriod = chartData.length > 0 ? (totalBinsInChart / chartData.length).toFixed(1) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Navigation & Scope Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">
              Barangay {currentBarangayName} — Operational Command Center
            </h1>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> LIVE
            </span>
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3.5 h-3.5" />
            {today} · Week {weekNum}
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('operations')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'operations' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Operations
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'analytics' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Analytics & Survey
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => navigate('/schedules')}
            className="flex items-center gap-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
          >
            Route Schedules <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Core Operational KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Resident Reports Needing Action */}
        <StatCard
          icon={FileText}
          title="Resident Reports"
          value={`${stats.pendingReports || 0} Pending`}
          subtitle={`${stats.acknowledgedReports || 0} acknowledged / in-progress`}
          color={stats.pendingReports > 0 ? "amber" : "emerald"}
        />

        {/* KPI 2: Collection Progress / Stops Cleared */}
        <StatCard
          icon={CheckCircle}
          title={official?.barangay && official.barangay !== 'All' ? "Stops Cleared" : "Collection Progress"}
          value={`${stats.completedTasks || 0} / ${stats.totalTasks || 0}`}
          subtitle={
            stats.totalTasks > 0
              ? `${Math.round(((stats.completedTasks || 0) / stats.totalTasks) * 100)}% completed today`
              : "No collection tasks scheduled"
          }
          color="emerald"
        />

        {/* KPI 3: Active Fleet */}
        <StatCard
          icon={Truck}
          title="Active Fleet"
          value={`${stats.activeTrucks || 0}/${stats.totalFleet || 0}`}
          subtitle={stats.totalFleet > 0 ? "Trucks assigned & on-route" : "No trucks assigned"}
          color="blue"
        />

        {/* KPI 4: Waste Collected Volume */}
        <StatCard
          icon={TrendingUp}
          title="Waste Volume Today"
          value={`${stats.totalBinsToday || 0} Bins`}
          subtitle="Recorded pickup throughput"
          color="purple"
        />
      </div>

      {activeTab === 'operations' ? (
        <>
          {/* Main Operational 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (7/12): Live Resident Reports Widget */}
            <div className="lg:col-span-7">
              <RecentReportsWidget reports={reportsList} onReportUpdated={fetchAll} />
            </div>

            {/* Right Column (5/12): Route Dispatch & Active Alerts */}
            <div className="lg:col-span-5 space-y-6">
              {/* Route Recommendation Card */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Lightbulb className="w-20 h-20 text-amber-500" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                          <Navigation className="w-4 h-4 text-amber-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Priority Route Recommendation</h3>
                      </div>
                    </div>
                    <p className="text-base font-bold text-slate-900 leading-tight">
                      Target Area: <span className="text-amber-600">{stats.priorityArea || currentBarangayName}</span>
                    </p>
                  </div>
                  <p className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                    {stats.priorityReason || 'All areas operating under standard parameters.'}
                  </p>
                  <button
                    onClick={() => navigate('/routes')}
                    className="w-full py-2 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    View Live Route Map <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Live MQ-135 Sensor Status Widget */}
              <SensorStatusWidget readings={latestReadings} onNavigateAlerts={() => navigate('/alerts')} />

              {/* Active IoT Alerts */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" /> Active IoT Alerts
                      {iotAlerts.length > 0 && (
                        <span className="text-[10px] font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          {iotAlerts.filter(a => !a.acknowledged).length} Action Needed
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">Real-time bin & gas threshold alerts</p>
                  </div>
                  <button onClick={() => navigate('/alerts')} className="text-xs font-semibold text-indigo-600 hover:underline">
                    View All
                  </button>
                </div>
                <div className="p-4">
                  {formattedAlerts.length > 0 ? (
                    <RecentAlerts alerts={formattedAlerts} />
                  ) : (
                    <div className="py-6 text-center text-slate-400 bg-slate-50/50 rounded-xl">
                      <CheckCircle className="w-8 h-8 mx-auto mb-1.5 text-emerald-400" />
                      <p className="text-xs font-semibold text-slate-600">No active alerts</p>
                      <p className="text-[11px] text-slate-400">IoT sensors operating normally</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SPLIT CARD VIEW: Waste Collection Volume (Left: Rounded Bar Chart, Right: Sitio Distribution) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
            {/* Header with Time Period Controls */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" /> Waste Collection Volume & Sitio Breakdown
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {official?.barangay && official.barangay !== 'All'
                    ? `Volume throughput and pickup distribution in Barangay ${official.barangay}`
                    : 'Total waste volume and sitio collection breakdown'}
                </p>
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

            {/* Split Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (7/12): Solid Rounded Bar Chart + Summary Banner */}
              <div className="lg:col-span-7 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                {/* Summary Banner */}
                <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-lg border border-slate-200/80 mb-4 flex-wrap gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Volume</p>
                    <p className="text-base font-extrabold text-indigo-600">{totalBinsInChart} Bins</p>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average Daily</p>
                    <p className="text-base font-bold text-slate-800">{avgBinsPerPeriod} Bins/day</p>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Period Filter</p>
                    <p className="text-xs font-bold text-slate-700 capitalize">{collectionFilter}</p>
                  </div>
                </div>

                {/* Bar Chart Canvas */}
                {chartData.length === 0 ? (
                  <div className="h-[200px] flex flex-col items-center justify-center text-slate-400">
                    <TrendingUp className="w-8 h-8 mb-2 text-slate-300" />
                    <p className="text-xs font-medium">No collection logs recorded</p>
                  </div>
                ) : (
                  <div className="h-[210px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<BarTooltip />} />
                        <Bar dataKey="Bins" name="Bins" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Right Column (5/12): Sitio Distribution Progress List */}
              <div className="lg:col-span-5 bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" /> Sitio Collection Distribution
                  </h3>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    Top Sitios
                  </span>
                </div>

                <div className="space-y-3">
                  {sitioDistribution.map((sitio, idx) => (
                    <div key={sitio.name} className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-800 flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 w-4">#{idx + 1}</span>
                          {sitio.name}
                        </span>
                        <span className="text-indigo-600 font-bold">{sitio.count} Bins ({sitio.percentage}%)</span>
                      </div>
                      <ProgressBar value={sitio.percentage} max={100} color={idx === 0 ? "indigo" : idx === 1 ? "blue" : "emerald"} height="h-2" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Analytics & Community Tab View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pollution Trends Line Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    Pollution Trends Over Time
                    {pollutionData.length > 0 && (
                      <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" /> LIVE
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Air quality raw ADC & voltage levels from IoT sensors</p>
                </div>
              </div>
              {pollutionData.length > 0 ? (
                <PollutionChart data={pollutionData} />
              ) : (
                <div className="h-[220px] flex flex-col items-center justify-center text-slate-400">
                  <Wind className="w-10 h-10 mb-3 text-slate-300" />
                  <p className="text-sm font-medium">No sensor data available</p>
                </div>
              )}
            </div>

            {/* Top Barangays */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    Barangay Performance Leaderboard
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Ranked by total community points earned</p>
                </div>
              </div>
              <BarangayRanking data={rankings} />
            </div>
          </div>

          {/* Gamification Survey Results */}
          <SurveyResultsCard
            data={surveyData}
            period={surveyPeriod}
            context={surveyContext}
            onPeriodChange={(p) => { setSurveyPeriod(p); fetchSurvey(p, surveyContext); }}
            onContextChange={(c) => { setSurveyContext(c); fetchSurvey(surveyPeriod, c); }}
          />
        </div>
      )}
    </div>
  );
}
