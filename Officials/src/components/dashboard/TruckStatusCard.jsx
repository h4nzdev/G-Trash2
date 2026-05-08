import { MapPin, Clock, Navigation } from 'lucide-react';
import Badge from '../shared/Badge';
import ProgressBar from '../shared/ProgressBar';

const statusColor = { active: 'emerald', delayed: 'amber', stopped: 'red' };

export default function TruckStatusCard({ truck, onClick, selected }) {
  const color = statusColor[truck.status] || 'emerald';
  const pct = Math.round((truck.stopsCompleted / truck.totalStops) * 100);

  return (
    <div
      onClick={() => onClick?.(truck)}
      className={`flex-shrink-0 w-60 bg-white rounded-xl border p-4 cursor-pointer transition-all duration-150 hover:shadow-md ${
        selected ? 'border-emerald-400 shadow-md ring-2 ring-emerald-100' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-800 to-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{truck.id.split('-')[1]}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{truck.id}</p>
            <p className="text-[11px] text-slate-500">{truck.driver}</p>
          </div>
        </div>
        <Badge variant={truck.status} showDot size="xs">
          {truck.status.charAt(0).toUpperCase() + truck.status.slice(1)}
        </Badge>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate">{truck.currentLocation}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Navigation className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate">{truck.route}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>ETA: {truck.eta}</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
          <span>Stops completed</span>
          <span className="font-semibold text-slate-700">{truck.stopsCompleted}/{truck.totalStops}</span>
        </div>
        <ProgressBar value={truck.stopsCompleted} max={truck.totalStops} color={color} />
      </div>
    </div>
  );
}
