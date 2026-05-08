import { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, Plus, Trash2, RefreshCw, Copy, Check, X } from 'lucide-react';

const API = 'http://localhost:4000';

export default function FleetManagement() {
  const [fleet, setFleet] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [driverName, setDriverName] = useState('');
  const [route, setRoute] = useState('');

  // Success modal
  const [generatedEntry, setGeneratedEntry] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchFleet = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fleetRes, routesRes] = await Promise.all([
        axios.get(`${API}/api/fleet`),
        axios.get(`${API}/api/routes`),
      ]);
      setFleet(fleetRes.data);
      setRoutes(routesRes.data);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        setError('Session expired. Please log out and log in again.');
      } else if (!status) {
        setError('Cannot reach the backend at localhost:4000. Make sure it is running.');
      } else {
        setError(`Server error (${status}). Check the backend console.`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFleet(); }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!driverName.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/api/fleet`, {
        driverName: driverName.trim(),
        route,
      });
      setGeneratedEntry(data);
      setFleet((prev) => [data, ...prev]);
      setDriverName('');
      setRoute('');
    } catch (err) {
      alert(err?.response?.data?.error || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (truckId) => {
    if (!confirm(`Remove ${truckId} from the fleet?`)) return;
    try {
      await axios.delete(`${API}/api/fleet/${truckId}`);
      setFleet((prev) => prev.filter((t) => t.truckId !== truckId));
    } catch { /* silent */ }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedEntry.truckId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Fleet Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Register truck drivers and generate their access IDs</p>
        </div>
        <button
          onClick={fetchFleet}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
      {routes.length === 0 && !loading && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          No routes found. Create routes in the Route Builder first, then assign them here.
        </div>
      )}

      {/* Registration Form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Register New Driver</h2>
        <form onSubmit={handleRegister} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Driver Name *</label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              required
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-800 placeholder-slate-400"
            />
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Assigned Route</label>
            <select
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-700"
            >
              <option value="">— Select route —</option>
              {routes.map((r) => (
                <option key={r._id} value={r.name}>
                  {r.name}{r.truckId ? ` (${r.truckId})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting || !driverName.trim()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-colors"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Register & Generate ID
          </button>
        </form>
      </div>

      {/* Fleet List */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Registered Fleet</h2>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{fleet.length} trucks</span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-7 h-7 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading fleet...</p>
          </div>
        ) : fleet.length === 0 ? (
          <div className="py-16 text-center">
            <Truck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500">No trucks registered yet</p>
            <p className="text-xs text-slate-400 mt-1">Use the form above to register your first driver</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-3">Truck ID</th>
                <th className="px-6 py-3">Driver Name</th>
                <th className="px-6 py-3">Route</th>
                <th className="px-6 py-3">Registered</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fleet.map((t) => (
                <tr key={t._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 font-mono font-bold text-sm rounded-lg border border-emerald-100">
                      <Truck className="w-3.5 h-3.5" />
                      {t.truckId}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">{t.driverName}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{t.route || <span className="text-slate-300">—</span>}</td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(t.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(t.truckId)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Success Modal */}
      {generatedEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Driver Registered!</h3>
              <button onClick={() => setGeneratedEntry(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4 text-center">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Generated Truck ID</p>
              <p className="text-4xl font-black text-emerald-800 font-mono tracking-widest mb-1">{generatedEntry.truckId}</p>
              <p className="text-sm text-slate-500">{generatedEntry.driverName}</p>
              {generatedEntry.route && <p className="text-xs text-slate-400 mt-0.5">{generatedEntry.route}</p>}
            </div>

            <p className="text-xs text-slate-500 text-center mb-4">
              Share this ID with the driver. They will enter it in the G-TRASH Collector app to access the system.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy ID'}
              </button>
              <button
                onClick={() => setGeneratedEntry(null)}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
