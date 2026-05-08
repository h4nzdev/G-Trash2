import { useState } from 'react';
import { Trophy, Medal, TrendingUp, TrendingDown, ChevronUp, ChevronDown, Award } from 'lucide-react';
import Badge from '../components/shared/Badge';
import ProgressBar from '../components/shared/ProgressBar';
import { barangays, categoryWinners } from '../data/mockData';

const ROWS_PER_PAGE = 6;

export default function BarangayPerformance() {
  const [sortKey, setSortKey] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const sorted = [...barangays].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
  });

  const paged = sorted.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);
  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);

  const SortIcon = ({ k }) => (
    <span className="inline-flex flex-col ml-1">
      <ChevronUp className={`w-2.5 h-2.5 -mb-0.5 ${sortKey === k && sortDir === 'asc' ? 'text-emerald-600' : 'text-slate-300'}`} />
      <ChevronDown className={`w-2.5 h-2.5 ${sortKey === k && sortDir === 'desc' ? 'text-emerald-600' : 'text-slate-300'}`} />
    </span>
  );

  const rankBorder = { 1: 'border-l-4 border-yellow-400', 2: 'border-l-4 border-slate-400', 3: 'border-l-4 border-amber-500' };
  const rankBadge = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div className="p-6 space-y-6">
      {/* Category Winners */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Best in Segregation</p>
            <p className="text-base font-bold text-slate-900">{categoryWinners.bestSegregation.name}</p>
            <p className="text-xs text-emerald-600 font-semibold">{categoryWinners.bestSegregation.score}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Medal className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Most Trash Collected</p>
            <p className="text-base font-bold text-slate-900">{categoryWinners.mostCollected.name}</p>
            <p className="text-xs text-emerald-600 font-semibold">{categoryWinners.mostCollected.weight}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Most Improved</p>
            <p className="text-base font-bold text-slate-900">{categoryWinners.mostImproved.name}</p>
            <p className="text-xs text-blue-600 font-semibold">{categoryWinners.mostImproved.percentage}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Barangay Leaderboard</h2>
            <p className="text-xs text-slate-500 mt-0.5">Sorted by performance metrics — May 2025</p>
          </div>
          <span className="text-xs text-slate-400">{barangays.length} barangays</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[
                  { key: 'rank', label: 'Rank' },
                  { key: 'name', label: 'Barangay' },
                  { key: 'collectedNum', label: 'Total Collected' },
                  { key: 'rateNum', label: 'Collection Rate' },
                  { key: 'efficiency', label: 'Efficiency Score' },
                  { key: 'trend', label: 'Trend' },
                  { key: 'points', label: 'Points' },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                  >
                    <span className="flex items-center gap-0.5">{label}<SortIcon k={key} /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paged.map((b) => (
                <tr
                  key={b.rank}
                  className={`hover:bg-slate-50 transition-colors ${rankBorder[b.rank] || 'border-l-4 border-transparent'}`}
                >
                  <td className="px-5 py-4">
                    <span className="text-sm font-bold text-slate-600">
                      {rankBadge[b.rank] || `#${b.rank}`}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-slate-900">{b.name}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-700">{b.collected}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900 w-10">{b.rate}</span>
                      <div className="w-24">
                        <ProgressBar value={b.rateNum} max={100} color={b.rateNum >= 90 ? 'emerald' : b.rateNum >= 75 ? 'amber' : 'red'} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900 w-8">{b.efficiency}</span>
                      <div className="w-20">
                        <ProgressBar value={b.efficiency} max={100} color={b.efficiency >= 85 ? 'emerald' : b.efficiency >= 70 ? 'amber' : 'red'} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`flex items-center gap-1 text-xs font-semibold ${b.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {b.trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {b.trend === 'up' ? 'Improving' : 'Declining'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-bold text-emerald-700">{b.points}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, barangays.length)} of {barangays.length}
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
      </div>
    </div>
  );
}
