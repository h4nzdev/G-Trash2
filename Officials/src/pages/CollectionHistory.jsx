import { useState } from 'react';
import { Search, Download, Calendar, Package, Truck, Star } from 'lucide-react';
import Badge from '../components/shared/Badge';
import { collectionHistory, summaryStats } from '../data/mockData';

const ROWS_PER_PAGE = 8;

export default function CollectionHistory() {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(0);

  const filtered = collectionHistory.filter((row) => {
    const searchMatch = !search ||
      row.barangay.toLowerCase().includes(search.toLowerCase()) ||
      row.truckId.toLowerCase().includes(search.toLowerCase()) ||
      row.route.toLowerCase().includes(search.toLowerCase());
    const dateMatch = !dateFilter || row.date === dateFilter;
    const statusMatch = statusFilter === 'All' || row.status === statusFilter.toLowerCase();
    return searchMatch && dateMatch && statusMatch;
  });

  const paged = filtered.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);
  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);

  const totalWeight = collectionHistory
    .reduce((sum, r) => sum + parseFloat(r.weight.replace('kg', '')), 0)
    .toFixed(0);

  return (
    <div className="p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Package, label: 'Total This Month', value: summaryStats.monthlyCollected, color: 'bg-emerald-100 text-emerald-700' },
          { icon: Calendar, label: 'Avg Daily Collection', value: summaryStats.avgDailyCollection, color: 'bg-blue-100 text-blue-700' },
          { icon: Truck, label: 'Most Active Truck', value: summaryStats.mostActiveTruck, color: 'bg-purple-100 text-purple-700' },
          { icon: Star, label: 'Peak Day', value: summaryStats.peakDay, color: 'bg-amber-100 text-amber-700' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className="text-base font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-sm font-bold text-slate-900">Collection Log</h2>
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} records found</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 w-44"
              />
            </div>

            {/* Date */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
            />

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
            >
              {['All', 'Completed', 'Partial', 'Missed'].map((s) => <option key={s}>{s}</option>)}
            </select>

            {/* Export */}
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Date', 'Barangay', 'Truck ID', 'Route', 'Weight', 'Type', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paged.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-slate-700 font-medium">{row.date}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-slate-900">{row.barangay}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{row.truckId}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{row.route}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-emerald-700">{row.weight}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">{row.type}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={row.status} showDot size="xs">
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </Badge>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-slate-400">No records match your filters</td>
                </tr>
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
    </div>
  );
}
