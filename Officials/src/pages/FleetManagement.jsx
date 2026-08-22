import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Truck, Plus, Trash2, RefreshCw, Copy, Check, X, Share2, BarChart2 } from 'lucide-react';
import API from '../config';

export default function FleetManagement() {
  const navigate = useNavigate();
  const [fleet, setFleet] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Modal & Tab state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('driver'); // 'driver' or 'truck'

  // Driver Form state
  const [driverName, setDriverName] = useState('');
  const [driverId, setDriverId] = useState('');
  const [driverImage, setDriverImage] = useState(null);
  const [assignedTruck, setAssignedTruck] = useState(''); // New: select existing truck

  // Truck Form state
  const [truckModel, setTruckModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [fuelType, setFuelType] = useState('Diesel');
  const [capacity, setCapacity] = useState('');
  
  // Shared Truck Form state (moved from driver)
  const [route, setRoute] = useState('');
  const [truckType, setTruckType] = useState('dedicated');
  const [serviceBarangays, setServiceBarangays] = useState([]);

  // Success modal
  const [generatedEntry, setGeneratedEntry] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchFleet = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fleetRes, barangaysRes] = await Promise.all([
        axios.get(`${API}/api/fleet`),
        axios.get(`${API}/api/barangays`),
      ]);
      setFleet(fleetRes.data);
      setBarangays(barangaysRes.data);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        setError('Session expired. Please log out and log in again.');
      } else if (!status) {
        setError(`Cannot reach the backend at ${API}. Make sure it is running.`);
      } else {
        setError(`Server error (${status}). Check the backend console.`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFleet(); }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDriverImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // List of barangays for shared truck assignment
  const routeBarangays = [...new Set(barangays)].sort();

  const toggleServiceBarangay = (brgy) => {
    setServiceBarangays(prev =>
      prev.includes(brgy) ? prev.filter(b => b !== brgy) : [...prev, brgy]
    );
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      let payload = {};
      
      if (modalTab === 'driver') {
        if (!driverName.trim()) throw new Error('Driver name is required');
        payload = {
          registrationType: 'driver',
          driverName: driverName.trim(),
          driverId: driverId.trim(),
          driverImage,
          assignedTruck,
        };
      } else {
        if (!plateNumber.trim()) throw new Error('Plate number is required');
        if (truckType === 'shared' && serviceBarangays.length === 0) {
          throw new Error('Please select at least one barangay this shared truck will serve.');
        }
        payload = {
          registrationType: 'truck',
          truckModel: truckModel.trim(),
          plateNumber: plateNumber.trim(),
          fuelType,
          capacity: capacity.trim(),
          route,
          type: truckType,
          serviceBarangays: truckType === 'shared' ? serviceBarangays : [],
        };
      }

      // We send to the same endpoint for now, but payload differentiates them
      const { data } = await axios.post(`${API}/api/fleet`, payload);
      
      setGeneratedEntry(data);
      setFleet((prev) => [data, ...prev]);
      
      // Reset forms
      setDriverName(''); setDriverId(''); setDriverImage(null); setAssignedTruck('');
      setTruckModel(''); setPlateNumber(''); setCapacity('');
      setRoute(''); setTruckType('dedicated'); setServiceBarangays([]);
      setIsModalOpen(false);
      
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Registration failed');
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
    <div className="p-6 mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Fleet Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Register truck drivers and generate their access IDs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFleet}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add / Register
          </button>
        </div>
      </div>


      {/* Main Table View */}
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
                <th className="px-6 py-3 text-left">Truck ID</th>
                <th className="px-6 py-3 text-left">Driver</th>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">Coverage</th>
                <th className="px-6 py-3">Registered</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fleet.map((t) => (
                <tr
                  key={t._id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/fleet/${t.truckId}`)}
                >
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 font-mono font-bold text-sm rounded-lg border border-emerald-100">
                      <Truck className="w-3.5 h-3.5" />
                      {t.truckId}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
                        {t.driverImage ? (
                          <img src={t.driverImage} alt={t.driverName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Truck className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{t.driverName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {t.type === 'shared' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-full">
                        <Share2 className="w-3 h-3" /> Shared
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full">
                        <Truck className="w-3 h-3" /> Dedicated
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {t.type === 'shared' && t.serviceBarangays?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.serviceBarangays.map(b => (
                          <span key={b} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">{b}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">{t.barangay || t.route || <span className="text-slate-300">—</span>}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(t.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/fleet/${t.truckId}`)}
                        className="p-1.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="View analytics"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.truckId)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Add to Fleet</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="px-6 pt-4 border-b border-slate-100 flex gap-6">
              <button
                onClick={() => setModalTab('driver')}
                className={`pb-3 text-sm font-bold transition-all border-b-2 ${
                  modalTab === 'driver' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                Register Driver
              </button>
              <button
                onClick={() => setModalTab('truck')}
                className={`pb-3 text-sm font-bold transition-all border-b-2 ${
                  modalTab === 'truck' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                Register Truck
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleRegister} className="space-y-5">
                
                {/* --- DRIVER TAB --- */}
                {modalTab === 'driver' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Driver Name *</label>
                      <input
                        type="text"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder="e.g. Juan Dela Cruz"
                        required
                        className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Driver ID (Optional)</label>
                        <input
                          type="text"
                          value={driverId}
                          onChange={(e) => setDriverId(e.target.value)}
                          placeholder="e.g. DRV-772"
                          className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assign to Truck</label>
                        <select
                          value={assignedTruck}
                          onChange={(e) => setAssignedTruck(e.target.value)}
                          className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                        >
                          <option value="">— Select a truck (Optional) —</option>
                          {fleet.map((t) => (
                            <option key={t.truckId || t._id} value={t.truckId}>
                              {t.truckId} {t.plateNumber ? `(${t.plateNumber})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Driver ID Picture</label>
                      <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* --- TRUCK TAB --- */}
                {modalTab === 'truck' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Truck Model *</label>
                        <input
                          type="text"
                          value={truckModel}
                          onChange={(e) => setTruckModel(e.target.value)}
                          placeholder="e.g. Isuzu Elf"
                          required
                          className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Plate Number *</label>
                        <input
                          type="text"
                          value={plateNumber}
                          onChange={(e) => setPlateNumber(e.target.value)}
                          placeholder="e.g. ABC 1234"
                          required
                          className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm uppercase"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fuel Type</label>
                        <select
                          value={fuelType}
                          onChange={(e) => setFuelType(e.target.value)}
                          className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                        >
                          <option value="Diesel">Diesel</option>
                          <option value="Gasoline">Gasoline</option>
                          <option value="Electric">Electric</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Capacity (Tons)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={capacity}
                          onChange={(e) => setCapacity(e.target.value)}
                          placeholder="e.g. 2.5"
                          className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                        />
                      </div>
                    </div>

                    <hr className="border-slate-100 my-2" />

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Truck Type</label>
                      <div className="flex rounded-xl overflow-hidden border border-slate-200 p-1 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => { setTruckType('dedicated'); setServiceBarangays([]); }}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${truckType === 'dedicated' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Dedicated
                        </button>
                        <button
                          type="button"
                          onClick={() => setTruckType('shared')}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${truckType === 'shared' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Shared
                        </button>
                      </div>
                    </div>

                    {truckType === 'shared' && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">
                          Service Barangays <span className="text-red-500">*</span>
                        </label>
                        {routeBarangays.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {routeBarangays.map(brgy => (
                              <button
                                key={brgy}
                                type="button"
                                onClick={() => toggleServiceBarangay(brgy)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                  serviceBarangays.includes(brgy)
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                                }`}
                              >
                                {serviceBarangays.includes(brgy) && <Check className="w-3 h-3 inline-block mr-1 -mt-0.5" />}
                                {brgy}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                            No routes with barangay assignments found. Create routes in Route Builder first.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || (modalTab === 'driver' && !driverName.trim()) || (modalTab === 'truck' && !plateNumber.trim())}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    {submitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {modalTab === 'driver' ? 'Register Driver' : 'Register Truck'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
