import { TrendingUp, TrendingDown } from 'lucide-react';

const colorMap = {
  green: { bg: "bg-emerald-100", icon: "text-emerald-700", badge: "text-emerald-600 bg-emerald-50" },
  blue: { bg: "bg-blue-100", icon: "text-blue-700", badge: "text-blue-600 bg-blue-50" },
  red: { bg: "bg-red-100", icon: "text-red-700", badge: "text-red-600 bg-red-50" },
  amber: { bg: "bg-amber-100", icon: "text-amber-700", badge: "text-amber-600 bg-amber-50" },
};

export default function StatCard({ icon: Icon, title, value, subtitle, trend, trendDirection = "up", color = "green" }) {
  const c = colorMap[color] || colorMap.green;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200 border border-slate-100">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${c.badge}`}>
            {trendDirection === "up"
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
            }
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
        <p className="text-sm text-slate-500 mt-1">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
