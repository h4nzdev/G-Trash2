export default function ProgressBar({ value, max = 100, color = "emerald", height = "h-2", showLabel = false }) {
  const pct = Math.min(100, Math.round((value / max) * 100));

  const colorMap = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    slate: "bg-slate-400",
  };

  const barColor = colorMap[color] || colorMap.emerald;

  return (
    <div className="w-full">
      <div className={`w-full ${height} bg-slate-100 rounded-full overflow-hidden`}>
        <div
          className={`${height} ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-500 mt-1">{pct}%</span>
      )}
    </div>
  );
}
