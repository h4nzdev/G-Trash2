import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Shield, MapPin, Truck, Navigation, 
  Clipboard, Contact, ChevronLeft, 
  UserCircle, Calendar, ArrowRight,
  TrendingUp, AlertCircle, CheckCircle
} from 'lucide-react';
import API from '../../config';

export default function OfficialDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [official, setOfficial] = useState(null);
  const [data, setData] = useState({
    trucks: [],
    routes: [],
    logs: [],
    drivers: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Official details
        const offRes = await axios.get(`${API}/api/admin/officials`);
        const targetOff = offRes.data.find(o => o._id === id);
        
        if (!targetOff) {
          console.error('Official not found');
          return;
        }
        setOfficial(targetOff);

        // 2. Fetch related data filtered by barangay
        const [trucksRes, routesRes, logsRes, fleetRes] = await Promise.all([
          axios.get(`${API}/api/trucks`),
          axios.get(`${API}/api/routes`),
          axios.get(`${API}/api/collection-logs`),
          axios.get(`${API}/api/fleet`)
        ]);

        const brgy = targetOff.barangay;
        setData({
          trucks: (trucksRes.data || []).filter(t => t.barangay === brgy),
          routes: (routesRes.data || []).filter(r => r.barangay === brgy),
          logs: (logsRes.data || []).filter(l => l.barangay === brgy),
          drivers: (fleetRes.data || []).filter(f => f.barangay === brgy || true) // Mock filtering for now
        });
      } catch (err) {
        console.error('Failed to fetch official profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [id]);

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading Profile Data...</p>
      </div>
    );
  }

  if (!official) {
    return (
      <div className="p-12 text-center bg-white rounded-[40px] border border-slate-200">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900">Official Not Found</h3>
        <button onClick={() => navigate('/admin/officials')} className="mt-4 text-emerald-600 font-bold hover:underline">Return to list</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/admin/officials')}
            className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <ChevronLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl font-black text-slate-900">{official.name}</h2>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                official.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}>
                {official.status}
              </span>
            </div>
            <p className="text-slate-500 font-bold flex items-center gap-1.5 uppercase text-xs tracking-widest">
              <MapPin className="w-4 h-4 text-emerald-500" />
              Barangay {official.barangay} Operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right px-4 py-2 bg-white border border-slate-100 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Joined On</p>
            <p className="text-sm font-bold text-slate-900">{new Date(official.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Deployed Trucks', value: data.trucks.length, icon: Truck, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Active Routes', value: data.routes.length, icon: Navigation, color: 'bg-blue-50 text-blue-600' },
          { label: 'Total Collections', value: data.logs.length, icon: Clipboard, color: 'bg-amber-50 text-amber-600' },
          { label: 'Assigned Drivers', value: data.drivers.length, icon: Contact, color: 'bg-indigo-50 text-indigo-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all">
            <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center mb-4`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Fleet Details */}
        <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <Truck className="w-5 h-5 text-emerald-600" />
              </div>
              Barangay Fleet
            </h3>
            <span className="text-xs font-bold text-slate-400 uppercase">{data.trucks.length} Units Deployed</span>
          </div>
          <div className="p-8 space-y-4">
            {data.trucks.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-bold text-slate-400">No trucks currently deployed in this area.</p>
              </div>
            ) : data.trucks.map(t => (
              <div key={t.truckId} className="group p-5 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-3xl transition-all flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-emerald-500 group-hover:text-white transition-all">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">{t.truckId}</p>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Active Status</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{t.speed || 0} km/h</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Current Speed</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Route Management */}
        <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl">
                <Navigation className="w-5 h-5 text-blue-600" />
              </div>
              Assigned Routes
            </h3>
            <span className="text-xs font-bold text-slate-400 uppercase">{data.routes.length} Active Routes</span>
          </div>
          <div className="p-8 space-y-4">
            {data.routes.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-bold text-slate-400">No active collection routes found.</p>
              </div>
            ) : data.routes.map(r => (
              <div key={r._id} className="p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 hover:bg-white transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-base font-black text-slate-900">{r.name}</h4>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{r.totalStops} Scheduled Stops</p>
                  </div>
                  <div className="px-3 py-1 bg-white rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100">
                    ID: {r._id.slice(-6)}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-200/50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center border border-slate-100">
                      <Contact className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-600">Driver: <span className="text-slate-900">{r.driverName || 'Unassigned'}</span></p>
                  </div>
                  <button className="text-blue-600 hover:underline text-xs font-bold flex items-center gap-1">
                    View Path <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Collection History */}
        <div className="lg:col-span-2 bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-xl">
                <Clipboard className="w-5 h-5 text-amber-600" />
              </div>
              Recent Collection Logs
            </h3>
            <span className="text-xs font-bold text-slate-400 uppercase">{data.logs.length} Total Records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                  <th className="px-8 py-4 text-left">Timestamp</th>
                  <th className="px-8 py-4 text-left">Truck ID</th>
                  <th className="px-8 py-4 text-left">Stop Address</th>
                  <th className="px-8 py-4 text-left">Waste Type</th>
                  <th className="px-8 py-4 text-right">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-8 py-12 text-center text-slate-400 font-bold italic">No collection logs available for this barangay.</td>
                  </tr>
                ) : data.logs.slice(0, 10).map((log, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 font-bold text-slate-600">
                      {new Date(log.completedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-8 py-4 font-black text-slate-900">{log.truckId}</td>
                    <td className="px-8 py-4 text-slate-500 font-medium">{log.stopAddress}</td>
                    <td className="px-8 py-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-black uppercase">
                        {log.wasteType}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right font-black text-emerald-600">{log.weight} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const ExternalLink = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
);
