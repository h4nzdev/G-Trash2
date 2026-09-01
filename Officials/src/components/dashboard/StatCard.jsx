import { TrendingUp, TrendingDown } from 'lucide-react';

const colorMap = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600", badge: "text-blue-700 bg-blue-50" },
  purple: { bg: "bg-purple-50", icon: "text-purple-600", badge: "text-purple-700 bg-purple-50" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", badge: "text-emerald-700 bg-emerald-50" },
  green: { bg: "bg-emerald-50", icon: "text-emerald-600", badge: "text-emerald-700 bg-emerald-50" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600", badge: "text-amber-700 bg-amber-50" },
  red: { bg: "bg-red-50", icon: "text-red-600", badge: "text-red-700 bg-red-50" },
  slate: { bg: "bg-slate-100", icon: "text-slate-700", badge: "text-slate-700 bg-slate-100" },
};

export default function StatCard({ icon: Icon, title, value, subtitle, trend, trendDirection = "up", color = "blue" }) {
  const c = colorMap[color] || colorMap.blue;

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
