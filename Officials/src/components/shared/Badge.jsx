const variantMap = {
  critical: "bg-red-100 text-red-700 border border-red-200",
  moderate: "bg-amber-100 text-amber-700 border border-amber-200",
  clean: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border border-amber-200",
  "in-progress": "bg-blue-100 text-blue-700 border border-blue-200",
  resolved: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  high: "bg-red-100 text-red-700 border border-red-200",
  medium: "bg-amber-100 text-amber-700 border border-amber-200",
  low: "bg-slate-100 text-slate-600 border border-slate-200",
  active: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  delayed: "bg-amber-100 text-amber-700 border border-amber-200",
  stopped: "bg-red-100 text-red-700 border border-red-200",
  partial: "bg-blue-100 text-blue-700 border border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  missed: "bg-red-100 text-red-700 border border-red-200",
};

const dotMap = {
  critical: "bg-red-500",
  moderate: "bg-amber-500",
  clean: "bg-emerald-500",
  pending: "bg-amber-500",
  "in-progress": "bg-blue-500",
  resolved: "bg-emerald-500",
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
  active: "bg-emerald-500",
  delayed: "bg-amber-500",
  stopped: "bg-red-500",
  partial: "bg-blue-500",
  completed: "bg-emerald-500",
  missed: "bg-red-500",
};

export default function Badge({ variant = "clean", children, showDot = false, size = "sm" }) {
  const classes = variantMap[variant] || variantMap.clean;
  const dot = dotMap[variant] || dotMap.clean;
  const sizeClasses = size === "xs" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${classes} ${sizeClasses}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />}
      {children}
    </span>
  );
}
