import { TrendingUp, TrendingDown, Medal } from 'lucide-react';

const rankStyle = {
  1: { badge: "bg-yellow-100 text-yellow-700 border border-yellow-300", label: "🥇" },
  2: { badge: "bg-slate-100 text-slate-600 border border-slate-300", label: "🥈" },
  3: { badge: "bg-amber-100 text-amber-700 border border-amber-300", label: "🥉" },
};

export default function BarangayRanking({ data }) {
  return (
    <div className="space-y-2">
      {data.slice(0, 5).map((b) => {
        const rs = rankStyle[b.rank];
        return (
          <div
            key={b.rank}
            className={`flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors ${
              b.rank <= 3 ? 'bg-gradient-to-r from-slate-50 to-transparent' : ''
            }`}
          >
            {/* Rank Badge */}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
              rs ? rs.badge : 'bg-slate-50 text-slate-500 border border-slate-200'
            }`}>
              {rs ? rs.label : b.rank}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{b.name}</p>
              <p className="text-[11px] text-slate-500">{b.collected} collected</p>
            </div>

            {/* Rate */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-slate-900">{b.rate}</p>
              <div className={`flex items-center justify-end gap-0.5 text-[11px] font-medium ${
                b.trend === 'up' ? 'text-emerald-600' : 'text-red-500'
              }`}>
                {b.trend === 'up'
                  ? <TrendingUp className="w-3 h-3" />
                  : <TrendingDown className="w-3 h-3" />
                }
                <span>{b.points} pts</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
