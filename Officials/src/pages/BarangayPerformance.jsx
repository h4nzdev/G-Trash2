import { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, ChevronUp, ChevronDown, Award, RefreshCw, Trash2, ThumbsUp, Leaf } from 'lucide-react';
import ProgressBar from '../components/shared/ProgressBar';
import API from '../config';

const ROWS_PER_PAGE = 6;

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

  // Derive category winners from real data
  const topByPickups = [...rankings].sort((a, b) => (b.pickupCount ?? 0) - (a.pickupCount ?? 0))[0];
  const topByArea = [...rankings].sort((a, b) => (b.areaQualityPts ?? 0) - (a.areaQualityPts ?? 0))[0];
  const topByVotes = [...rankings].sort((a, b) => (b.reportVoteCount ?? 0) - (a.reportVoteCount ?? 0))[0];

  const maxPts = rankings[0]?.points || 1;

  const SortIcon = ({ k }) => (
    <span className="inline-flex flex-col ml-1">
      <ChevronUp className={`w-2.5 h-2.5 -mb-0.5 ${sortKey === k && sortDir === 'asc' ? 'text-emerald-600' : 'text-slate-300'}`} />
      <ChevronDown className={`w-2.5 h-2.5 ${sortKey === k && sortDir === 'desc' ? 'text-emerald-600' : 'text-slate-300'}`} />
    </span>
  );

  const rankBorder = { 0: 'border-l-4 border-yellow-400', 1: 'border-l-4 border-slate-400', 2: 'border-l-4 border-amber-500' };
  const rankBadge = { 0: '🥇', 1: '🥈', 2: '🥉' };

  return (
    <div className="p-6 space-y-6">
      {/* Category Winners */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Most Trash Pickups</p>
            <p className="text-base font-bold text-slate-900">{topByPickups?.barangay || '—'}</p>
            <p className="text-xs text-emerald-600 font-semibold">{topByPickups?.pickupCount ?? 0} confirmed pickups</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Medal className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Cleanest Area</p>
            <p className="text-base font-bold text-slate-900">{topByArea?.barangay || '—'}</p>
            <p className="text-xs text-emerald-600 font-semibold">{topByArea?.areaQualityPts ?? 0} area quality pts</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Most Community Votes</p>
            <p className="text-base font-bold text-slate-900">{topByVotes?.barangay || '—'}</p>
            <p className="text-xs text-blue-600 font-semibold">{topByVotes?.reportVoteCount ?? 0} report votes</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Barangay Leaderboard</h2>
            <p className="text-xs text-slate-500 mt-0.5">Real-time scores — pickups, votes & area quality</p>
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
            <p className="text-xs mt-1">Scores accumulate as residents confirm pickups and cast votes</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {[
                      { key: null, label: 'Rank' },
                      { key: 'barangay', label: 'Barangay' },
                      { key: 'pickupCount', label: 'Pickups' },
                      { key: 'reportVoteCount', label: 'Votes' },
                      { key: 'areaQualityPts', label: 'Area Quality' },
                      { key: 'points', label: 'Total Points' },
                    ].map(({ key, label }) => (
                      <th
                        key={label}
                        onClick={key ? () => handleSort(key) : undefined}
                        className={`px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider select-none ${key ? 'cursor-pointer hover:text-slate-700' : ''}`}
                      >
                        <span className="flex items-center gap-0.5">
                          {label}
                          {key && <SortIcon k={key} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map((b, pageIndex) => {
                    const globalIndex = page * ROWS_PER_PAGE + pageIndex;
                    const originalRank = sorted.findIndex(r => r._id === b._id);
                    const barWidth = Math.round(((b.points || 0) / maxPts) * 100);
                    return (
                      <tr
                        key={b._id || b.barangay}
                        className={`hover:bg-slate-50 transition-colors ${rankBorder[originalRank] || 'border-l-4 border-transparent'}`}
                      >
                        <td className="px-5 py-4">
                          <span className="text-sm font-bold text-slate-600">
                            {rankBadge[originalRank] || `#${originalRank + 1}`}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-900">{b.barangay || '—'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-700">
                            <Trash2 className="w-3.5 h-3.5 text-emerald-600" />
                            {b.pickupCount ?? 0}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-700">
                            <ThumbsUp className="w-3.5 h-3.5 text-blue-500" />
                            {b.reportVoteCount ?? 0}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-700">
                            <Leaf className="w-3.5 h-3.5 text-emerald-500" />
                            {b.areaQualityPts ?? 0}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-emerald-700 w-10">{b.points ?? 0}</span>
                            <div className="w-20">
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
