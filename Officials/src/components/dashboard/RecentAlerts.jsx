import { AlertTriangle, Eye } from 'lucide-react';
import Badge from '../shared/Badge';

export default function RecentAlerts({ alerts }) {
  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
          <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            alert.severity === 'critical' ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            <AlertTriangle className={`w-4 h-4 ${alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-xs font-semibold text-slate-800 leading-snug">{alert.message}</p>
              <Badge variant={alert.severity} size="xs">
                {alert.severity === 'critical' ? 'Critical' : 'Moderate'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-500">{alert.location}</p>
              <span className="text-[11px] text-slate-400">{alert.time}</span>
            </div>
          </div>
          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white text-slate-400 hover:text-emerald-600 flex-shrink-0">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
