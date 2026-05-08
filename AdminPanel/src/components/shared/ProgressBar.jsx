const colorClasses = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  teal: 'bg-teal-500',
  purple: 'bg-purple-500',
  slate: 'bg-slate-400',
};

const sizeClasses = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };

export default function ProgressBar({ value, max = 100, color = 'emerald', showLabel = false, label, size = 'md', className = '' }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const bar = colorClasses[color] ?? colorClasses.emerald;
  const height = sizeClasses[size] ?? sizeClasses.md;

  return (
    <div className={className}>
      {(label || showLabel) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs text-slate-500">{label}</span>}
          {showLabel && <span className="text-xs font-semibold text-slate-700">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full ${height}`}>
        <div
          className={`${bar} ${height} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
