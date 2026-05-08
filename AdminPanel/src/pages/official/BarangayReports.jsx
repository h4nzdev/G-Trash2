import { useState, useMemo } from 'react';
import { Search, Filter, FileText, X, AlertCircle, CheckCircle2, Clock, ChevronRight, User, MapPin, Tag } from 'lucide-react';
import StatusBadge from '../../components/shared/StatusBadge';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import EmptyState from '../../components/shared/EmptyState';
import { barangayComplaints } from '../../data/mockData';

const types = ['All Types', 'Missed Collection', 'Overflow', 'Illegal Dumping', 'Infrastructure', 'Pollution', 'Other'];
const statuses = ['All Status', 'open', 'in-progress', 'in-review', 'resolved'];
const priorities = ['All Priority', 'urgent', 'high', 'medium', 'low'];

const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
const priorityColors = {
  urgent: { dot: 'bg-red-500',    label: 'bg-red-50 text-red-700' },
  high:   { dot: 'bg-orange-500', label: 'bg-orange-50 text-orange-700' },
  medium: { dot: 'bg-amber-400',  label: 'bg-amber-50 text-amber-700' },
  low:    { dot: 'bg-blue-400',   label: 'bg-blue-50 text-blue-700' },
};

const summaryCards = [
  { label: 'Total', key: null,          icon: FileText,    bg: 'bg-slate-100', text: 'text-slate-600' },
  { label: 'Open',  key: 'open',        icon: AlertCircle, bg: 'bg-orange-50', text: 'text-orange-600' },
  { label: 'Urgent', key: 'urgent',     icon: AlertCircle, bg: 'bg-red-50',    text: 'text-red-600', isPriority: true },
  { label: 'Resolved', key: 'resolved', icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600' },
];

export default function BarangayReports() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [priorityFilter, setPriorityFilter] = useState('All Priority');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [resolvedIds, setResolvedIds] = useState(new Set());

  const complaints = useMemo(() => {
    const base = barangayComplaints.map(c =>
      resolvedIds.has(c.id) ? { ...c, status: 'resolved' } : c
    );
    return base
      .filter(c => {
        if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.reportedBy.toLowerCase().includes(search.toLowerCase())) return false;
        if (typeFilter !== 'All Types' && c.type !== typeFilter) return false;
        if (statusFilter !== 'All Status' && c.status !== statusFilter) return false;
        if (priorityFilter !== 'All Priority' && c.priority !== priorityFilter) return false;
        return true;
      })
      .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));
  }, [search, typeFilter, statusFilter, priorityFilter, resolvedIds]);

  const counts = {
    null: barangayComplaints.length,
    open: barangayComplaints.filter(c => c.status === 'open').length,
    urgent: barangayComplaints.filter(c => c.priority === 'urgent').length,
    resolved: barangayComplaints.filter(c => c.status === 'resolved' || resolvedIds.has(c.id)).length,
  };

  const handleResolve = () => {
    setResolvedIds(s => new Set([...s, confirm.id]));
    if (selected?.id === confirm.id) setSelected(prev => ({ ...prev, status: 'resolved' }));
    setConfirm({ open: false, id: null });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Barangay Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Manage and respond to resident complaints and reports</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map(({ label, key, icon: Icon, bg, text, isPriority }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${text}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{isPriority ? counts.urgent : counts[key]}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Layout */}
      <div className="flex gap-4">
        {/* List Panel */}
        <div className={`flex flex-col bg-white rounded-2xl shadow-sm overflow-hidden transition-all ${selected ? 'w-1/2' : 'w-full'}`}>
          {/* Filters */}
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search complaints..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm text-slate-600 placeholder-slate-400 outline-none flex-1"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white outline-none cursor-pointer"
              >
                {types.map(t => <option key={t}>{t}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white outline-none cursor-pointer"
              >
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white outline-none cursor-pointer"
              >
                {priorities.map(p => <option key={p}>{p}</option>)}
              </select>
              <span className="ml-auto text-xs text-slate-400 flex items-center">{complaints.length} result{complaints.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Complaints List */}
          <div className="divide-y divide-slate-50 overflow-y-auto max-h-[480px]">
            {complaints.length === 0 ? (
              <EmptyState icon={FileText} title="No complaints found" description="Try adjusting your filters." />
            ) : (
              complaints.map(c => {
                const pColors = priorityColors[c.priority] ?? { dot: 'bg-slate-400', label: 'bg-slate-100 text-slate-600' };
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`w-full text-left flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors ${selected?.id === c.id ? 'bg-emerald-50/60 border-l-2 border-emerald-500' : ''}`}
                  >
                    <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${pColors.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-800 truncate">{c.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${pColors.label}`}>
                          {c.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{c.reportedBy} · {c.zone} · {c.date}</p>
                    </div>
                    <StatusBadge status={resolvedIds.has(c.id) ? 'resolved' : c.status} size="xs" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-1/2 bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono text-slate-400">{selected.id}</span>
                <h3 className="font-semibold text-slate-900 mt-0.5">{selected.title}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={resolvedIds.has(selected.id) ? 'resolved' : selected.status} showDot />
                <StatusBadge status={selected.priority} showDot />
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                  <Tag className="w-3 h-3" /> {selected.type}
                </span>
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">Reported by</p>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">{selected.reportedBy}</span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">Zone</p>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">{selected.zone}</span>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Address</p>
                <p className="text-sm text-slate-700">{selected.address}</p>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</p>
                <p className="text-sm text-slate-600 leading-relaxed">{selected.description}</p>
              </div>

              {/* Contact */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Contact</p>
                <p className="text-sm text-slate-700">{selected.contact}</p>
              </div>

              <p className="text-xs text-slate-400 border-t border-slate-100 pt-4">Filed on {selected.date}</p>
            </div>

            {/* Actions */}
            {!resolvedIds.has(selected.id) && selected.status !== 'resolved' && (
              <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                <button className="flex-1 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                  Escalate
                </button>
                <button
                  onClick={() => setConfirm({ open: true, id: selected.id })}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
                >
                  Mark Resolved
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm.open}
        title="Mark as Resolved?"
        message="This will close the complaint and notify the resident."
        confirmText="Yes, resolve"
        variant="primary"
        onConfirm={handleResolve}
        onCancel={() => setConfirm({ open: false, id: null })}
      />
    </div>
  );
}
