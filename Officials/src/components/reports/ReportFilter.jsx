import { Search, Filter } from 'lucide-react';

const statuses = ['All', 'Pending', 'In Progress', 'Resolved'];
const barangays = ['All Barangays', 'IT Park', 'Lahug', 'Ayala', 'Banilad', 'Talamban', 'Mabolo', 'Carbon Market', 'Ermita', 'Sto. Niño'];
const priorities = ['All Priorities', 'Critical', 'High', 'Medium', 'Low'];
const sortOptions = ['Newest', 'Oldest', 'Highest Urgency'];

export default function ReportFilter({ filters, onChange }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by location, title..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...filters, status: s })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filters.status === s
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Sort By */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Sort By:</span>
          <select
            value={filters.sortBy}
            onChange={(e) => onChange({ ...filters, sortBy: e.target.value })}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 cursor-pointer"
          >
            {sortOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Barangay */}
        <select
          value={filters.barangay}
          onChange={(e) => onChange({ ...filters, barangay: e.target.value })}
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 cursor-pointer"
        >
          {barangays.map((b) => <option key={b}>{b}</option>)}
        </select>

        {/* Priority */}
        <select
          value={filters.priority}
          onChange={(e) => onChange({ ...filters, priority: e.target.value })}
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 cursor-pointer"
        >
          {priorities.map((p) => <option key={p}>{p}</option>)}
        </select>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
        </div>
      </div>
    </div>
  );
}
