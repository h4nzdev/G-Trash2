import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Truck, ArrowLeft, MapPin, Package, Archive, Calendar, Clock, CheckCircle, Route, TrendingUp, Phone } from 'lucide-react';
import API from '../config';

function StatCard({ icon: Icon, label, value, sub, color = 'emerald' }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className={`inline-flex p-2.5 rounded-xl border mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
      <p className="text-sm font-semibold text-slate-600 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DriverAnalytics() {
  const { truckId } = useParams();
  const navigate = useNavigate();

  const [driver, setDriver] = useState(null);
  const [route, setRoute] = useState(null);
  const [collections, setCollections] = useState([]);
  const [pickupRuns, setPickupRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!truckId) return;
    setLoading(true);

    Promise.allSettled([
      axios.get(`${API}/api/fleet/${truckId}`),
      axios.get(`${API}/api/collections/truck/${truckId}?period=month`),
      axios.get(`${API}/api/routes/truck/${truckId}`),
      axios.get(`${API}/api/pickup`),
    ]).then(([fleetRes, colRes, routeRes, pickupRes]) => {
      if (fleetRes.status === 'fulfilled') setDriver(fleetRes.value.data);
      else setError('Driver not found');

      if (colRes.status === 'fulfilled') {
        const data = colRes.value.data;
        setCollections(Array.isArray(data) ? data : data?.logs || []);
      }

      if (routeRes.status === 'fulfilled') setRoute(routeRes.value.data);

      if (pickupRes.status === 'fulfilled') {
        const runs = Array.isArray(pickupRes.value.data) ? pickupRes.value.data : [];
        setPickupRuns(runs.filter(r => r.truckId === truckId));
      }
    }).finally(() => setLoading(false));
  }, [truckId]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading driver analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/fleet')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Fleet
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error || 'Driver not found'}</div>
      </div>
    );
  }

  // Derived stats
  const totalWeight = collections.reduce((sum, c) => sum + (c.weight || 0), 0);
  const totalBins = collections.reduce((sum, c) => sum + (c.bins || 0), 0);
  const completedRuns = pickupRuns.filter(r => r.stopsCompleted?.length > 0);
  const avgStops = completedRuns.length > 0
    ? (completedRuns.reduce((s, r) => s + (r.stopsCompleted?.length || 0), 0) / completedRuns.length).toFixed(1)
    : 0;

  const activeDays = new Set(
    pickupRuns.map(r => (r.completedAt || r.createdAt || '').slice(0, 10)).filter(Boolean)
  ).size;

  return (
    <div className="p-6 mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/fleet')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Fleet
      </button>

      {/* Driver Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
            {driver.driverImage ? (
              <img src={driver.driverImage} alt={driver.driverName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Truck className="w-9 h-9" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-800">{driver.driverName}</h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 font-mono font-bold text-sm rounded-lg border border-emerald-100">
                <Truck className="w-3.5 h-3.5" />
                {driver.truckId}
              </span>
              {driver.type === 'shared' ? (
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-full">Shared</span>
              ) : (
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full">Dedicated</span>
              )}
            </div>
            {driver.driverId && (
              <p className="text-sm text-slate-400 mt-1">ID: {driver.driverId}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">
              {(driver.barangay || driver.route) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  {driver.barangay || driver.route}
                </span>
              )}
              {route?.name && (
                <span className="flex items-center gap-1.5">
                  <Route className="w-4 h-4 text-blue-500" />
                  {route.name}
                </span>
              )}
              {driver.driverPhone && (
                <a
                  href={`tel:${driver.driverPhone}`}
                  className="flex items-center gap-1.5 hover:text-emerald-600 font-medium transition-colors"
                  title="Call driver"
                >
                  <Phone className="w-4 h-4 text-emerald-500" />
                  {driver.driverPhone}
                </a>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                Joined {new Date(driver.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon={CheckCircle} label="Pickup Runs" value={pickupRuns.length} sub="This month" color="emerald" />
        <StatCard icon={Archive} label="Total Bins" value={totalBins} sub="This month" color="blue" />
        <StatCard icon={Package} label="Avg Stops/Run" value={avgStops} sub="Completed runs" color="amber" />
        <StatCard icon={Calendar} label="Active Days" value={activeDays} sub="Days with a run" color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Route Info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Route className="w-4 h-4 text-blue-500" /> Assigned Route
          </h2>
          {route ? (
            <div className="space-y-3">
              <div>
                <p className="text-base font-bold text-slate-800">{route.name}</p>
                {route.barangay && (
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {route.barangay}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <span>{route.totalStops || route.waypoints?.length || 0} stops</span>
              </div>
              {route.waypoints?.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {route.waypoints.slice(0, 5).map((wp, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      {wp.name}
                    </div>
                  ))}
                  {route.waypoints.length > 5 && (
                    <p className="text-xs text-slate-400 pl-7">+{route.waypoints.length - 5} more stops</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Route className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No route currently assigned</p>
            </div>
          )}
        </div>

        {/* Pickup Runs History */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Recent Pickup Runs
          </h2>
          {pickupRuns.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No pickup runs recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {pickupRuns.slice(0, 20).map((run) => {
                const date = new Date(run.completedAt || run.createdAt);
                const stopsCount = run.stopsCompleted?.length || 0;
                return (
                  <div key={run._id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{run.routeName || 'Unnamed Route'}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{stopsCount} stops</span>
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-slate-600">{date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                      <p className="text-xs text-slate-400">{date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
