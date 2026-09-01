import { TrendingUp, Trash2, ThumbsUp, Leaf } from 'lucide-react';

const rankStyle = {
  0: { badge: "bg-yellow-100 text-yellow-700 border border-yellow-300", label: "🥇" },
  1: { badge: "bg-slate-100 text-slate-600 border border-slate-300", label: "🥈" },
  2: { badge: "bg-amber-100 text-amber-700 border border-amber-300", label: "🥉" },
};

export default function BarangayRanking({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400">
        <TrendingUp className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm font-medium">No rankings yet</p>
        <p className="text-xs mt-1">Scores accumulate as residents confirm pickups and cast votes</p>
      </div>
    );
  }

  const maxPts = data[0]?.points || 1;

  return (
    <div className="space-y-2">
      {data.slice(0, 5).map((b, index) => {
        const rs = rankStyle[index];
        const barWidth = Math.round(((b.points || 0) / maxPts) * 100);
        return (
          <div
            key={b._id || b.barangay}
            className={`flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors ${
              index < 3 ? 'bg-gradient-to-r from-slate-50 to-transparent' : ''
            }`}
          >
            {/* Rank Badge */}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
              rs ? rs.badge : 'bg-slate-50 text-slate-500 border border-slate-200'
            }`}>
              {rs ? rs.label : index + 1}
            </div>

            {/* Name + bar */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{b.barangay || '—'}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium flex-shrink-0">
                  <Trash2 className="w-2.5 h-2.5" />{b.pickupCount ?? 0}
                  <ThumbsUp className="w-2.5 h-2.5 ml-1" />{b.reportVoteCount ?? 0}
                  <Leaf className="w-2.5 h-2.5 ml-1" />{b.areaQualityPts ?? 0}
                </div>
              </div>
            </div>

            {/* Points */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-slate-900">{b.points ?? 0}</p>
              <p className="text-[10px] text-slate-400 font-medium">pts</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
