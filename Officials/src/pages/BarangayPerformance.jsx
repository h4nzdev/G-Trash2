import { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, ChevronUp, ChevronDown, Award, RefreshCw, Trash2, ThumbsUp, Leaf, Clock, Wifi, Users, Star, ScanLine, FileText, CheckCircle, X, ChevronRight, Lock, Activity, History } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import ProgressBar from '../components/shared/ProgressBar';
import API from '../config';
import { useAuth } from '../context/AuthContext';

const ROWS_PER_PAGE = 6;

const CATEGORIES = [
  {
    key: 'reportScore',
    label: 'Report Activity',
    subLabel: 'votes & resolutions',
    winnerLabel: 'Most Active Reports',
    icon: ThumbsUp,
    color: 'blue',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    valueColor: 'text-blue-600',
    barColor: 'blue',
  },
  {
    key: 'iotScore',
    label: 'IoT / Air Quality',
    subLabel: 'sensor readings',
    winnerLabel: 'Best Air Quality',
    icon: Wifi,
    color: 'teal',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    valueColor: 'text-teal-600',
    barColor: 'teal',
  },
  {
    key: 'collectionScore',
    label: 'Collections',
    subLabel: 'pickups & verifications',
    winnerLabel: 'Most Trash Collected',
    icon: Trash2,
    color: 'emerald',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    valueColor: 'text-emerald-600',
    barColor: 'emerald',
  },
  {
    key: 'responseScore',
    label: 'Response Time',
    subLabel: 'official action speed',
    winnerLabel: 'Fastest Response',
    icon: Clock,
    color: 'orange',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
    valueColor: 'text-orange-500',
    barColor: 'orange',
  },
];

const PERIOD_OPTIONS = [
  { value: 'month', label: 'This Month' },
  { value: 'all',   label: 'All Time' },
];

function TopResidentsPanel({ barangay, onClose, onOpenHistory }) {
  const { official } = useAuth();
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [selected, setSelected] = useState(null);

  const fetchTopResidents = useCallback(async (p) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/barangays/${encodeURIComponent(barangay)}/top-residents?period=${p}`);
      const data = await res.json();
      setResidents(data.topResidents || []);
    } catch { setResidents([]); }
    finally { setLoading(false); }
  }, [barangay]);

  useEffect(() => { fetchTopResidents(period); }, [period, fetchTopResidents]);

  const MEDAL = ['🥇', '🥈', '🥉'];
  const sortField = period === 'month' ? 'monthlyPoints' : 'totalPoints';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Top Residents</h2>
            <p className="text-xs text-slate-500">Brgy. {barangay}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onOpenHistory(barangay)}
              className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
              title="View Points History"
            >
              <History className="w-4 h-4" /> History
            </button>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : residents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
              <Users className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-medium">No resident activity yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {residents.map((r, i) => (
                <button
                  key={r.residentId}
                  onClick={() => setSelected(selected?.residentId === r.residentId ? null : r)}
                  className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl w-8 flex-shrink-0">{MEDAL[i] || `#${i + 1}`}</span>
                    <div className="w-9 h-9 bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
                      {r.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{r.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <ScanLine className="w-3 h-3" />{r.stats?.correctScans ?? 0}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <FileText className="w-3 h-3" />{r.stats?.reportsSubmitted ?? 0}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <CheckCircle className="w-3 h-3" />{r.stats?.resolutionsVerified ?? 0}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-emerald-700">{r[sortField] ?? 0}</p>
                      <p className="text-[10px] text-slate-400">pts</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${selected?.residentId === r.residentId ? 'rotate-90' : ''}`} />
                  </div>

                  {/* Expanded detail */}
                  {selected?.residentId === r.residentId && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-4 text-left cursor-default" onClick={e => e.stopPropagation()}>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex gap-4">
                        <div className="flex-1">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Resident Profile</h4>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-slate-400"/> Total Lifetime Points</span>
                              <span className="font-bold text-slate-900">{r.totalPoints} pts</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-slate-400"/> Monthly Points</span>
                              <span className="font-bold text-slate-900">{r.monthlyPoints} pts</span>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                              <span className="text-slate-500 flex items-center gap-1.5"><ScanLine className="w-3.5 h-3.5 text-blue-500"/> Valid Smart Bin Scans</span>
                              <span className="font-bold text-slate-900">{r.stats?.correctScans ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-orange-500"/> Reports Submitted</span>
                              <span className="font-bold text-slate-900">{r.stats?.reportsSubmitted ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 flex items-center gap-1.5"><ThumbsUp className="w-3.5 h-3.5 text-emerald-500"/> Helpful Upvotes Received</span>
                              <span className="font-bold text-slate-900">{r.stats?.reportsUpvoted ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-teal-500"/> Official Resolutions Verified</span>
                              <span className="font-bold text-slate-900">{r.stats?.resolutionsVerified ?? 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {official?.barangay === 'All' || official?.barangay === barangay ? (
                        <div className="flex gap-2">
                          <a
                            href={`/rewards?prefill=${encodeURIComponent(JSON.stringify({ recipientId: r.residentId, recipientName: r.name, barangay }))}`}
                            className="flex items-center justify-center gap-2 flex-1 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                            onClick={e => e.stopPropagation()}
                          >
                            <Award className="w-4 h-4" /> Issue Reward
                          </a>
                        </div>
                      ) : null}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const PointsHistoryModal = ({ barangay, onClose }) => {
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    useEffect(() => {
      fetch(`${API}/api/barangay-points-history?barangay=${encodeURIComponent(barangay)}`)
        .then(r => r.json())
        .then(d => { setHistory(d); setLoadingHistory(false); })
        .catch(() => setLoadingHistory(false));
    }, [barangay]);

    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                {barangay} Points History
              </h2>
              <p className="text-xs text-slate-500 mt-1">Recent point activities and score updates</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            {loadingHistory ? (
              <p className="text-sm text-slate-500 text-center py-10">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">No recent points history.</p>
            ) : (
              <div className="space-y-4">
                {history.map((h, i) => (
                  <div key={i} className="flex items-start gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${h.points > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {h.points > 0 ? '+' : ''}{h.points}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{h.description}</p>
                      <p className="text-xs text-slate-400 mt-1 flex justify-between items-center w-full gap-4">
                        <span className="uppercase tracking-wider font-bold">{h.category}</span>
                        <span>{new Date(h.createdAt).toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

export default function BarangayPerformance() {
  const { official } = useAuth();
  const [rankings, setRankings] = useState([]);
  const [drillDown, setDrillDown] = useState(null);
  const [restrictedAlert, setRestrictedAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('points');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const [historyModal, setHistoryModal] = useState(null);

  

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/leaderboard`);
      const data = await res.json();
      setRankings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Leaderboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRankings(); }, [fetchRankings]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  };

  const sorted = [...rankings].sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
  });

  const paged = sorted.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);
  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const maxPts = Math.max(...rankings.map(r => r.points || 0), 1);

  const renderSortIcon = (k) => (
    <span className="inline-flex flex-col ml-1">
      <ChevronUp className={`w-2.5 h-2.5 -mb-0.5 ${sortKey === k && sortDir === 'asc' ? 'text-emerald-600' : 'text-slate-300'}`} />
      <ChevronDown className={`w-2.5 h-2.5 ${sortKey === k && sortDir === 'desc' ? 'text-emerald-600' : 'text-slate-300'}`} />
    </span>
  );

  const rankBorder = { 0: 'border-l-4 border-yellow-400', 1: 'border-l-4 border-slate-400', 2: 'border-l-4 border-amber-500' };
  const rankBadge = { 0: '🥇', 1: '🥈', 2: '🥉' };

  const scoreColorMap = (score) => {
    if (score >= 30) return 'text-emerald-700 font-bold';
    if (score >= 10) return 'text-slate-700';
    if (score < 0) return 'text-red-500';
    return 'text-slate-500';
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl text-white min-w-[220px]">
          <p className="font-bold text-base mb-1">{label} <span className="text-slate-400 font-normal text-xs ml-1">(Click point to view residents)</span></p>
          <div className="flex items-end gap-2 mb-3 pb-3 border-b border-slate-700">
            <span className="text-3xl font-black text-emerald-400">{data.points}</span>
            <span className="text-xs text-slate-400 mb-1">Total Pts</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center"><span className="text-slate-400 flex items-center gap-1.5"><ThumbsUp className="w-3 h-3 text-blue-400" /> Reports:</span> <span className="font-semibold text-blue-400">{data.reportScore || 0}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-400 flex items-center gap-1.5"><Wifi className="w-3 h-3 text-teal-400" /> IoT / Air Quality:</span> <span className="font-semibold text-teal-400">{data.iotScore || 0}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-400 flex items-center gap-1.5"><Trash2 className="w-3 h-3 text-emerald-400" /> Collections:</span> <span className="font-semibold text-emerald-400">{data.collectionScore || 0}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-400 flex items-center gap-1.5"><Clock className="w-3 h-3 text-orange-400" /> Response Time:</span> <span className="font-semibold text-orange-400">{data.responseScore || 0}</span></div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Category Winners — 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => {
          const winner = [...rankings].sort((a, b) => (b[cat.key] ?? 0) - (a[cat.key] ?? 0))[0];
          const Icon = cat.icon;
          return (
            <div key={cat.key} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
              <div className={`w-12 h-12 ${cat.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-6 h-6 ${cat.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium">{cat.winnerLabel}</p>
                <p className="text-sm font-bold text-slate-900 truncate">{winner?.barangay || '—'}</p>
                <p className={`text-xs font-semibold ${cat.valueColor}`}>{winner?.[cat.key] ?? 0} pts</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Score Breakdown Cards */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Scoring Breakdown</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-500">
          <div className="space-y-1">
            <p className="font-semibold text-blue-600 uppercase tracking-wide">Reports</p>
            <p>Upvote: +1 pt</p>
            <p>Resolution confirmed: +20 pts</p>
            <p>Disputed by resident: -15 pts</p>
            <p>SLA escalated: -10 pts</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-teal-600 uppercase tracking-wide">IoT / Air Quality</p>
            <p>Good reading: +3 pts</p>
            <p>Moderate reading: +1 pt</p>
            <p>Unhealthy reading: -2 pts</p>
            <p>Hazardous reading: -5 pts</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-emerald-600 uppercase tracking-wide">Collections</p>
            <p>Pickup completed: +5 pts</p>
            <p>Resident confirms: +10 pts</p>
            <p>Resident disputes: -5 pts</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-orange-500 uppercase tracking-wide">Response Time</p>
            <p>Under 6 hours: +15 pts</p>
            <p>6–24 hours: +10 pts</p>
            <p>24–48 hours: +5 pts</p>
            <p>Over 48 hours: 0 pts</p>
          </div>
        </div>
      </div>

      
      {/* Current Barangay Highlight Card */}
      {(() => {
        if (!official?.barangay || official.barangay === 'All') return null;
        const myRankIdx = sorted.findIndex(r => r.barangay === official.barangay);
        if (myRankIdx === -1) return null;
        const myData = sorted[myRankIdx];
        
        return (
          <div className="bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl p-6 text-white shadow-lg border border-blue-400/50 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-inner">
                <Trophy className="w-8 h-8 text-yellow-300 drop-shadow-md" />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight">{myData.barangay}</h3>
                <p className="text-blue-100 font-medium text-sm flex items-center gap-1.5 mt-0.5">
                  Your Barangay's Current Standing
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-8 relative z-10">
              <div className="text-center md:text-right">
                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mb-1">Current Rank</p>
                <div className="flex items-baseline gap-1 justify-center md:justify-end">
                  <span className="text-3xl font-black">#{myRankIdx + 1}</span>
                  <span className="text-blue-200 font-medium text-sm">of {sorted.length}</span>
                </div>
              </div>
              <div className="w-px h-12 bg-blue-400/50 hidden md:block"></div>
              <div className="text-center md:text-right">
                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mb-1">Total Points</p>
                <span className="text-3xl font-black text-yellow-300 drop-shadow-sm">{myData.points ?? 0}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Table */}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Barangay Leaderboard</h2>
            <p className="text-xs text-slate-500 mt-0.5">Real-time scores across reports, IoT, collections & response time</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{rankings.length} barangay{rankings.length !== 1 ? 's' : ''}</span>
            <button
              onClick={fetchRankings}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-spin" />
            <p className="text-sm font-medium">Loading rankings...</p>
          </div>
        ) : rankings.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Trophy className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">No rankings yet</p>
            <p className="text-xs mt-1">Scores accumulate as reports are resolved, trucks complete pickups, and IoT sensors report readings</p>
          </div>
        ) : (
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4 w-20 text-center">Rank</th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('barangay')}>
                    Barangay {renderSortIcon('barangay')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => handleSort('points')}>
                    Total Pts {renderSortIcon('points')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => handleSort('reportScore')}>
                    Reports {renderSortIcon('reportScore')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => handleSort('iotScore')}>
                    IoT {renderSortIcon('iotScore')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => handleSort('collectionScore')}>
                    Collections {renderSortIcon('collectionScore')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors text-right" onClick={() => handleSort('responseScore')}>
                    Response {renderSortIcon('responseScore')}
                  </th>
                  <th className="px-6 py-4 text-right">
                    Insights
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((row, i) => {
                  const actualRank = page * ROWS_PER_PAGE + i;
                  const isTop3 = actualRank < 3 && sortKey === 'points' && sortDir === 'desc';
                  return (
                    <tr 
                      key={row.barangay} 
                      className={`hover:bg-slate-50 transition-colors ${isTop3 ? 'bg-amber-50/30' : ''}`}
                    >
                      <td className={`px-6 py-4 text-center ${isTop3 ? rankBorder[actualRank] : ''}`}>
                        {isTop3 ? (
                          <span className="text-xl" title={`Rank ${actualRank + 1}`}>{rankBadge[actualRank]}</span>
                        ) : (
                          <span className="text-sm font-bold text-slate-400">#{actualRank + 1}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-900">{row.barangay}</span>
                        {official?.barangay === row.barangay && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">You</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-base ${scoreColorMap(row.points)}`}>{row.points ?? 0}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-600 font-medium">{row.reportScore ?? 0}</td>
                      <td className="px-6 py-4 text-right text-sm text-slate-600 font-medium">{row.iotScore ?? 0}</td>
                      <td className="px-6 py-4 text-right text-sm text-slate-600 font-medium">{row.collectionScore ?? 0}</td>
                      <td className="px-6 py-4 text-right text-sm text-slate-600 font-medium">{row.responseScore ?? 0}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setHistoryModal(row.barangay); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors shadow-sm"
                            title="View Points History"
                          >
                            <History className="w-3.5 h-3.5" /> Log
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation();
                              const canView = official?.barangay === 'All' || official?.barangay === row.barangay;
                              if (canView) setDrillDown(row.barangay);
                              else setRestrictedAlert(row.barangay);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors shadow-sm"
                            title="View Participating Residents"
                          >
                            <Users className="w-3.5 h-3.5" /> Residents
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="text-xs text-slate-500 font-medium">
                  Showing {page * ROWS_PER_PAGE + 1} to {Math.min((page + 1) * ROWS_PER_PAGE, sorted.length)} of {sorted.length} entries
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="w-4 h-4 -rotate-90" />
                  </button>
                  <span className="text-sm font-bold text-slate-700 min-w-[32px] text-center">{page + 1}</span>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="w-4 h-4 -rotate-90" />
                  </button>
                </div>
              </div>
            )}
          </div>

        )}
      </div>

      {drillDown && (
        <TopResidentsPanel barangay={drillDown} onClose={() => setDrillDown(null)} onOpenHistory={setHistoryModal} />
      )}

      {/* Restricted access modal */}
      {restrictedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setRestrictedAlert(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full mx-4 flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
              <Lock className="w-7 h-7 text-red-500" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 mb-1">Access Restricted</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                You can only view resident performance for{' '}
                <span className="font-semibold text-slate-700">Brgy. {official?.barangay}</span>.
                Contact your administrator if you need access to{' '}
                <span className="font-semibold text-slate-700">Brgy. {restrictedAlert}</span>.
              </p>
            </div>
            <button
              onClick={() => setRestrictedAlert(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {historyModal && (
        <PointsHistoryModal barangay={historyModal} onClose={() => setHistoryModal(null)} />
      )}
    </div>
  );
}
