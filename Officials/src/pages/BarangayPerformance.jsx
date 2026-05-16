import { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, ChevronUp, ChevronDown, Award, RefreshCw, Trash2, ThumbsUp, Leaf, Clock, Wifi } from 'lucide-react';
import ProgressBar from '../components/shared/ProgressBar';
import API from '../config';

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

export default function BarangayPerformance() {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('points');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);

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

  const SortIcon = ({ k }) => (
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
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {[
                      { key: null,             label: 'Rank' },
                      { key: 'barangay',       label: 'Barangay' },
                      { key: 'reportScore',    label: 'Reports', Icon: ThumbsUp,  iconColor: 'text-blue-500' },
                      { key: 'iotScore',       label: 'IoT',     Icon: Wifi,      iconColor: 'text-teal-500' },
                      { key: 'collectionScore',label: 'Collect', Icon: Trash2,    iconColor: 'text-emerald-600' },
                      { key: 'responseScore',  label: 'Response',Icon: Clock,     iconColor: 'text-orange-500' },
                      { key: 'points',         label: 'Total Pts' },
                    ].map(({ key, label, Icon, iconColor }) => (
                      <th
                        key={label}
                        onClick={key ? () => handleSort(key) : undefined}
                        className={`px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider select-none ${key ? 'cursor-pointer hover:text-slate-700' : ''}`}
                      >
                        <span className="flex items-center gap-1">
                          {Icon && <Icon className={`w-3 h-3 ${iconColor}`} />}
                          {label}
                          {key && <SortIcon k={key} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map((b) => {
                    const originalRank = sorted.findIndex(r => r._id === b._id);
                    const barWidth = Math.round(((b.points || 0) / maxPts) * 100);
                    return (
                      <tr
                        key={b._id || b.barangay}
                        className={`hover:bg-slate-50 transition-colors ${rankBorder[originalRank] || 'border-l-4 border-transparent'}`}
                      >
                        <td className="px-4 py-4">
                          <span className="text-sm font-bold text-slate-600">
                            {rankBadge[originalRank] || `#${originalRank + 1}`}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-slate-900">{b.barangay || '—'}</p>
                          <p className="text-xs text-slate-400">{b.pickupCount ?? 0} pickups · {b.reportVoteCount ?? 0} votes</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-sm ${scoreColorMap(b.reportScore)}`}>{b.reportScore ?? 0}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-sm ${scoreColorMap(b.iotScore)}`}>{b.iotScore ?? 0}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-sm ${scoreColorMap(b.collectionScore)}`}>{b.collectionScore ?? 0}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-sm ${scoreColorMap(b.responseScore)}`}>{b.responseScore ?? 0}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-emerald-700 w-10">{b.points ?? 0}</span>
                            <div className="w-16">
                              <ProgressBar value={barWidth} max={100} color="emerald" />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Showing {page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, rankings.length)} of {rankings.length}
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
          </>
        )}
      </div>
    </div>
  );
}
