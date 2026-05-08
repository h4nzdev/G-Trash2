const statusConfig = {
  'active':       { label: 'Active',       bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'in-progress':  { label: 'In Progress',  bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  'completed':    { label: 'Completed',    bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'pending':      { label: 'Pending',      bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  'open':         { label: 'Open',         bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  'resolved':     { label: 'Resolved',     bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400' },
  'in-review':    { label: 'In Review',    bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  'fixed':        { label: 'Fixed',        bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'delayed':      { label: 'Delayed',      bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  'maintenance':  { label: 'Maintenance',  bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400' },
  'online':       { label: 'Online',       bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'offline':      { label: 'Offline',      bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  'urgent':       { label: 'Urgent',       bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  'high':         { label: 'High',         bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  'medium':       { label: 'Medium',       bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  'low':          { label: 'Low',          bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  'critical':     { label: 'Critical',     bg: 'bg-red-100',    text: 'text-red-800',     dot: 'bg-red-600' },
  'sent':         { label: 'Sent',         bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'draft':        { label: 'Draft',        bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400' },
  'normal':       { label: 'Normal',       bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400' },
};

export default function StatusBadge({ status, showDot = false, size = 'sm' }) {
  const key = status?.toLowerCase?.() ?? '';
  const config = statusConfig[key] ?? { label: status ?? '—', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
  const sizeClass = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap ${config.bg} ${config.text} ${sizeClass}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
      {config.label}
    </span>
  );
}
