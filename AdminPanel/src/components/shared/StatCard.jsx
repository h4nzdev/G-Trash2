import { TrendingUp, TrendingDown } from 'lucide-react';

const colorMap = {
  emerald: { iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
  blue: { iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
  amber: { iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
  teal: { iconBg: 'bg-teal-100', iconText: 'text-teal-600' },
  red: { iconBg: 'bg-red-100', iconText: 'text-red-600' },
  purple: { iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
  slate: { iconBg: 'bg-slate-100', iconText: 'text-slate-500' },
};

export default function StatCard({ icon: Icon, title, value, subtitle, trend, color = 'emerald' }) {
  const colors = colorMap[color] || colorMap.emerald;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 ${colors.iconBg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${colors.iconText}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          </div>
        )}
      </div>
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{title}</p>
      <p className="text-slate-900 text-2xl font-bold mt-1">{value}</p>
      {subtitle && (
        <p className="text-slate-400 text-xs mt-1">{subtitle}</p>
      )}
    </div>
  );
}
