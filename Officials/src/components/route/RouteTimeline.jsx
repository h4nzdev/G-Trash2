import { CheckCircle, Clock, Circle, MapPin } from 'lucide-react';

const stops = {
  'GT-401': ['Lahug Market', 'Gaisano Country Mall', 'Lahug Avenue', 'JY Square', 'Escario St.', 'USC Campus'],
  'GT-402': ['SM City Cebu', 'Ayala Center', 'Mandaue Market', 'Mantawi District', 'NRA Road', 'Tipolo', 'Alang-alang', 'Subangdaku'],
  'GT-403': ['IT Park Gate 1', 'IT Park Sector 4', 'Cebu IT Tower', 'Northgate Cyberzone', 'Asia Town'],
  'GT-404': ['Banilad Market', 'Sacred Heart School', 'Banilad Rd.', 'Talamban Rd.', 'JY Square', 'Loon Rd.', 'Kasambagan'],
  'GT-405': ['Carbon Entrance', 'Carbon West', 'Carbon East', 'Osmena Blvd.'],
  'GT-406': ['Colon St. North', 'Colon St. Central', 'Palacio Del Sur', 'Colon Terminal', 'Jones Ave.', 'Sto. Niño', 'Lakandula St.', 'P. Del Rosario', 'D. Jakosalem'],
  'GT-407': ['Talamban Heights', 'Talamban Market', 'Pit-os', 'Busay Rd.', 'SRP North', 'Capitol Hills'],
  'GT-408': ['Mabolo Church', 'Mabolo Market', 'Oakridge', 'Mabolo Rotunda', 'Borromeo St.', 'Maria Luisa Rd.', 'Lahug Extension'],
};

export default function RouteTimeline({ truck }) {
  if (!truck) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Select a truck to view its route timeline
      </div>
    );
  }

  const truckStops = stops[truck.id] || [];

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
        <div className="w-9 h-9 bg-gradient-to-br from-emerald-800 to-emerald-600 rounded-xl flex items-center justify-center">
          <span className="text-sm font-bold text-white">{truck.id.split('-')[1]}</span>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{truck.id} — {truck.route}</p>
          <p className="text-xs text-slate-500">{truck.driver} · ETA: {truck.eta}</p>
        </div>
      </div>

      <div className="relative">
        {truckStops.map((stop, idx) => {
          const done = idx < truck.stopsCompleted;
          const current = idx === truck.stopsCompleted;
          return (
            <div key={idx} className="flex items-start gap-3 mb-3 last:mb-0">
              <div className="relative flex flex-col items-center flex-shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                  done ? 'bg-emerald-500' : current ? 'bg-blue-500' : 'bg-slate-200'
                }`}>
                  {done
                    ? <CheckCircle className="w-3.5 h-3.5 text-white" />
                    : current
                      ? <Clock className="w-3.5 h-3.5 text-white" />
                      : <Circle className="w-3 h-3 text-slate-400" />
                  }
                </div>
                {idx < truckStops.length - 1 && (
                  <div className={`w-0.5 h-6 mt-1 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                )}
              </div>
              <div className={`pb-3 flex-1 ${idx < truckStops.length - 1 ? 'border-b border-slate-50' : ''}`}>
                <p className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : current ? 'text-blue-700 font-semibold' : 'text-slate-700'}`}>
                  {stop}
                </p>
                {current && (
                  <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Currently here
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
