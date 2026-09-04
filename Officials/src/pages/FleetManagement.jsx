import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Truck, Plus, Trash2, RefreshCw, Copy, Check, X, Share2, BarChart2,
  ChevronDown, Search, UserPlus, ArrowRight, ArrowLeft, UserCheck, Shield, Edit3, Phone
} from 'lucide-react';
import API from '../config';
import { useAuth } from '../context/AuthContext';

export default function FleetManagement() {
  const navigate = useNavigate();
  const { official } = useAuth();
  const [fleet, setFleet] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Add Truck Modal & Tab state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('truck'); // 'truck' or 'driver'

  // Truck Form state
  const [truckModel, setTruckModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [fuelType, setFuelType] = useState('Diesel');
  const [capacity, setCapacity] = useState('');
  
  // Shared Truck Form state
  const [route, setRoute] = useState('');
  const [truckType, setTruckType] = useState('dedicated');
  const [serviceBarangays, setServiceBarangays] = useState([]);
  const [brgySearch, setBrgySearch] = useState('');
  const [isBrgyDropdownOpen, setIsBrgyDropdownOpen] = useState(false);
  const brgyDropdownRef = useRef(null);

  // Driver Form state (within Add Truck or standalone)
  const [driverName, setDriverName] = useState('');
  const [driverId, setDriverId] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverImage, setDriverImage] = useState(null);

  // Assign Driver Modal for existing trucks
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTruckForAssignment, setSelectedTruckForAssignment] = useState(null);
  const [assignDriverName, setAssignDriverName] = useState('');
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignDriverPhone, setAssignDriverPhone] = useState('');
  const [assignDriverImage, setAssignDriverImage] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Edit Truck Modal for existing trucks
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);
  const [editModel, setEditModel] = useState('');
  const [editPlateNumber, setEditPlateNumber] = useState('');
  const [editFuelType, setEditFuelType] = useState('Diesel');
  const [editCapacity, setEditCapacity] = useState('');
  const [editTruckType, setEditTruckType] = useState('dedicated');
  const [editServiceBarangays, setEditServiceBarangays] = useState([]);
  const [editBrgySearch, setEditBrgySearch] = useState('');
  const [isEditBrgyDropdownOpen, setIsEditBrgyDropdownOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const editBrgyDropdownRef = useRef(null);

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

  const handleImageChange = (e, target = 'main') => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'assign') {
          setAssignDriverImage(reader.result);
        } else {
          setDriverImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // List of barangays for shared truck assignment
  const routeBarangays = [...new Set(barangays)].sort();
  const filteredBarangays = routeBarangays.filter(b =>
    b.toLowerCase().includes(brgySearch.toLowerCase())
  );
  const editFilteredBarangays = routeBarangays.filter(b =>
    b.toLowerCase().includes(editBrgySearch.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (brgyDropdownRef.current && !brgyDropdownRef.current.contains(e.target)) {
        setIsBrgyDropdownOpen(false);
      }
      if (editBrgyDropdownRef.current && !editBrgyDropdownRef.current.contains(e.target)) {
        setIsEditBrgyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleServiceBarangay = (brgy) => {
    setServiceBarangays(prev =>
      prev.includes(brgy) ? prev.filter(b => b !== brgy) : [...prev, brgy]
    );
  };

  const toggleEditServiceBarangay = (brgy) => {
    setEditServiceBarangays(prev =>
      prev.includes(brgy) ? prev.filter(b => b !== brgy) : [...prev, brgy]
    );
  };

  const openAddTruckModal = () => {
    setModalTab('truck');
    setTruckModel('');
    setPlateNumber('');
    setFuelType('Diesel');
    setCapacity('');
    setTruckType('dedicated');
    setServiceBarangays(official?.barangay && official.barangay !== 'All' ? [official.barangay] : []);
    setDriverName('');
    setDriverId('');
    setDriverPhone('');
    setDriverImage(null);
    setBrgySearch('');
    setIsModalOpen(true);
  };

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    
    try {
      if (!plateNumber.trim() && !truckModel.trim()) {
        throw new Error('Plate number or truck model is required');
      }
      if (truckType === 'shared' && serviceBarangays.length === 0) {
        throw new Error('Please select at least one barangay this shared truck will serve.');
      }

      let finalServiceBarangays = truckType === 'shared' ? [...serviceBarangays] : [];
      if (truckType === 'shared' && official?.barangay && official.barangay !== 'All') {
        if (!finalServiceBarangays.map(b => b.toLowerCase()).includes(official.barangay.toLowerCase())) {
          finalServiceBarangays.unshift(official.barangay);
        }
      }

      const payload = {
        registrationType: 'truck',
        driverName: driverName.trim() || 'Unassigned',
        driverId: driverId.trim() || '',
        driverPhone: driverPhone.trim() || '',
        driverImage: driverImage || null,
        truckModel: truckModel.trim(),
        plateNumber: plateNumber.trim(),
        fuelType,
        capacity: capacity ? Number(capacity) : 0,
        route,
        type: truckType,
        serviceBarangays: finalServiceBarangays,
      };

      const { data } = await axios.post(`${API}/api/fleet`, payload);
      
      setGeneratedEntry(data);
      setFleet((prev) => [data, ...prev]);
      
      // Reset forms
      setDriverName(''); setDriverId(''); setDriverPhone(''); setDriverImage(null);
      setTruckModel(''); setPlateNumber(''); setCapacity('');
      setRoute(''); setTruckType('dedicated'); setServiceBarangays([]);
      setBrgySearch(''); setIsBrgyDropdownOpen(false);
      setModalTab('truck');
      setIsModalOpen(false);
      
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const openAssignDriverModal = (truck) => {
    setSelectedTruckForAssignment(truck);
    setAssignDriverName(truck.driverName && truck.driverName !== 'Unassigned' ? truck.driverName : '');
    setAssignDriverId(truck.driverId || '');
    setAssignDriverPhone(truck.driverPhone || '');
    setAssignDriverImage(truck.driverImage || null);
    setIsAssignModalOpen(true);
  };

  const handleAssignDriver = async (e) => {
    if (e) e.preventDefault();
    if (!assignDriverName.trim()) {
      alert('Driver name is required');
      return;
    }
    setAssignSubmitting(true);
    try {
      const { data } = await axios.patch(`${API}/api/fleet/${selectedTruckForAssignment.truckId}`, {
        driverName: assignDriverName.trim(),
        driverId: assignDriverId.trim(),
        driverPhone: assignDriverPhone.trim(),
        driverImage: assignDriverImage,
      });
      setFleet((prev) => prev.map((t) => (t.truckId === data.truckId ? data : t)));
      setIsAssignModalOpen(false);
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to assign driver');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const openEditTruckModal = (truck) => {
    setEditingTruck(truck);
    setEditModel(truck.model || '');
    setEditPlateNumber(truck.plateNumber || '');
    setEditFuelType(truck.fuelType || 'Diesel');
    setEditCapacity(truck.capacity || '');
    setEditTruckType(truck.type || 'dedicated');
    
    let sList = Array.isArray(truck.serviceBarangays) ? [...truck.serviceBarangays] : [];
    if (truck.barangay && !sList.map(b => b.toLowerCase()).includes(truck.barangay.toLowerCase())) {
      sList.unshift(truck.barangay);
    }
    setEditServiceBarangays(sList);
    setEditBrgySearch('');
    setIsEditModalOpen(true);
  };

  const handleSaveEditTruck = async (e) => {
    if (e) e.preventDefault();
    setEditSubmitting(true);
    try {
      let finalServiceBarangays = editTruckType === 'shared' ? [...editServiceBarangays] : [];
      if (editTruckType === 'shared' && editingTruck.barangay && !finalServiceBarangays.map(b => b.toLowerCase()).includes(editingTruck.barangay.toLowerCase())) {
        finalServiceBarangays.unshift(editingTruck.barangay);
      }

      const { data } = await axios.patch(`${API}/api/fleet/${editingTruck.truckId}`, {
        model: editModel.trim(),
        plateNumber: editPlateNumber.trim().toUpperCase(),
        fuelType: editFuelType,
        capacity: editCapacity ? Number(editCapacity) : 0,
        type: editTruckType,
        serviceBarangays: finalServiceBarangays,
      });

      setFleet((prev) => prev.map((t) => (t.truckId === data.truckId ? data : t)));
      setIsEditModalOpen(false);
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to update truck');
    } finally {
      setEditSubmitting(false);
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
          <p className="text-sm text-slate-500 mt-0.5">Register garbage trucks and manage your fleet</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFleet}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={openAddTruckModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Truck / Driver
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
            <p className="text-xs text-slate-400 mt-1">Click Add Truck / Driver to register your first vehicle</p>
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
                    {(t.plateNumber || t.model) && (
                      <p className="text-xs text-slate-500 font-semibold mt-1">
                        {t.plateNumber}{t.model ? ` · ${t.model}` : ''}
                      </p>
                    )}
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
                      {t.driverName && t.driverName !== 'Unassigned' ? (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-800">{t.driverName}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAssignDriverModal(t);
                              }}
                              className="text-slate-400 hover:text-emerald-600 p-0.5 rounded transition-colors"
                              title="Edit assigned driver"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {t.driverId && <span className="text-[10px] text-slate-400 font-mono">ID: {t.driverId}</span>}
                          {t.driverPhone && (
                            <a
                              href={`tel:${t.driverPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-slate-500 hover:text-emerald-600 font-medium flex items-center gap-1 mt-0.5 transition-colors"
                              title="Call driver"
                            >
                              <Phone className="w-3 h-3 text-slate-400" />
                              {t.driverPhone}
                            </a>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAssignDriverModal(t);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold rounded-xl transition-colors shadow-sm"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Assign Driver
                        </button>
                      )}
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
                        onClick={() => openEditTruckModal(t)}
                        className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit truck specifications & coverage"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
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

      {/* Unified Add Truck & Driver Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add New Garbage Truck</h2>
                <p className="text-xs text-slate-500 mt-0.5">Configure truck specifications and optionally assign a driver</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Steps / Tabs */}
            <div className="px-6 pt-4 border-b border-slate-100 flex gap-6 bg-slate-50/30">
              <button
                type="button"
                onClick={() => setModalTab('truck')}
                className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
                  modalTab === 'truck' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                  modalTab === 'truck' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>1</span>
                Truck Details
              </button>
              <button
                type="button"
                onClick={() => setModalTab('driver')}
                className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
                  modalTab === 'driver' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                  modalTab === 'driver' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>2</span>
                Driver&apos;s Details
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  driverName.trim() ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {driverName.trim() ? 'Assigned' : 'Optional'}
                </span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleRegister} className="space-y-5">
                
                {/* --- TAB 1: TRUCK DETAILS --- */}
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

                    <hr className="border-slate-100 my-1" />

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
                      <div className="space-y-2" ref={brgyDropdownRef}>
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Service Barangays <span className="text-red-500">*</span>
                          </label>
                          {serviceBarangays.length > 0 && (
                            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                              {serviceBarangays.length} selected
                            </span>
                          )}
                        </div>

                        {/* Searchable Multi-Select Box */}
                        <div className="relative">
                          <div
                            onClick={() => setIsBrgyDropdownOpen(true)}
                            className="min-h-[46px] w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500 flex flex-wrap items-center gap-1.5 cursor-text shadow-sm"
                          >
                            {/* Selected Chips */}
                            {serviceBarangays.map(b => (
                              <span
                                key={b}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200"
                              >
                                {b}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleServiceBarangay(b);
                                  }}
                                  className="hover:text-red-600 transition-colors ml-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}

                            {/* Search Input */}
                            <div className="flex-1 min-w-[150px] flex items-center gap-2">
                              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <input
                                type="text"
                                value={brgySearch}
                                onChange={(e) => {
                                  setBrgySearch(e.target.value);
                                  setIsBrgyDropdownOpen(true);
                                }}
                                onFocus={() => setIsBrgyDropdownOpen(true)}
                                placeholder={serviceBarangays.length === 0 ? "Search barangays..." : "Type to add more..."}
                                className="w-full text-sm bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 py-1"
                              />
                            </div>

                            {/* Dropdown Chevron */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsBrgyDropdownOpen(prev => !prev);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isBrgyDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                          </div>

                          {/* Dropdown Menu */}
                          {isBrgyDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto p-2">
                              <div className="flex items-center justify-between px-3 py-1.5 mb-1 text-xs text-slate-400 border-b border-slate-100 pb-2">
                                <span>{filteredBarangays.length} barangay(s) found</span>
                                <div className="flex items-center gap-3">
                                  {serviceBarangays.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setServiceBarangays([])}
                                      className="text-xs text-red-500 font-bold hover:underline"
                                    >
                                      Clear All
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setServiceBarangays(routeBarangays)}
                                    className="text-xs text-blue-600 font-bold hover:underline"
                                  >
                                    Select All
                                  </button>
                                </div>
                              </div>

                              {filteredBarangays.length === 0 ? (
                                <div className="py-6 text-center text-xs text-slate-400">
                                  No barangays match &ldquo;{brgySearch}&rdquo;
                                </div>
                              ) : (
                                filteredBarangays.map(brgy => {
                                  const isSelected = serviceBarangays.includes(brgy);
                                  return (
                                    <div
                                      key={brgy}
                                      onClick={() => toggleServiceBarangay(brgy)}
                                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${
                                        isSelected
                                          ? 'bg-blue-50 text-blue-800 font-bold'
                                          : 'text-slate-700 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span>{brgy}</span>
                                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                                        isSelected
                                          ? 'bg-blue-600 border-blue-600 text-white'
                                          : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Driver Assignment Card / Action Banner */}
                    <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
                          <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {driverName.trim() ? `Assigned Driver: ${driverName.trim()}` : "Assign a Driver (Optional)"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {driverName.trim() ? "Driver info configured. Click to modify." : "You can assign a driver now or leave it unassigned."}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalTab('driver')}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        {driverName.trim() ? "Edit Driver" : "+ Assign Driver"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalTab('driver')}
                        className="flex-1 py-3 text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        Assign Driver (Tab 2)
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || (!plateNumber.trim() && !truckModel.trim())}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
                      >
                        {submitting ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {driverName.trim() ? 'Register with Driver' : 'Register Truck'}
                      </button>
                    </div>
                  </>
                )}

                {/* --- TAB 2: DRIVER'S DETAILS --- */}
                {modalTab === 'driver' && (
                  <>
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-1">
                        <Shield className="w-4 h-4 text-emerald-600" />
                        Driver Information (Optional)
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Assign a driver to this truck ({truckModel || 'Vehicle'}{plateNumber ? ` - ${plateNumber}` : ''}) now, or submit to leave it unassigned.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Driver Name</label>
                      <input
                        type="text"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder="e.g. Juan Dela Cruz (Optional)"
                        className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Driver ID / License Number (Optional)</label>
                      <input
                        type="text"
                        value={driverId}
                        onChange={(e) => setDriverId(e.target.value)}
                        placeholder="e.g. DRV-772"
                        className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Driver Contact Number / Phone (Optional)</label>
                      <input
                        type="tel"
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        placeholder="e.g. 0917 123 4567"
                        className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Driver Picture / ID Photo</label>
                      <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageChange(e, 'main')}
                          className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setModalTab('truck')}
                        className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Truck Details
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || (!plateNumber.trim() && !truckModel.trim())}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
                      >
                        {submitting ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {driverName.trim() ? 'Register Truck & Driver' : 'Register Truck'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assign Driver Modal (for existing unassigned trucks) */}
      {isAssignModalOpen && selectedTruckForAssignment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Assign Driver</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Truck {selectedTruckForAssignment.truckId} ({selectedTruckForAssignment.plateNumber || selectedTruckForAssignment.model || 'Vehicle'})
                </p>
              </div>
              <button onClick={() => setIsAssignModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleAssignDriver} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Driver Name *</label>
                  <input
                    type="text"
                    value={assignDriverName}
                    onChange={(e) => setAssignDriverName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    required
                    className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Driver ID / License Number (Optional)</label>
                  <input
                    type="text"
                    value={assignDriverId}
                    onChange={(e) => setAssignDriverId(e.target.value)}
                    placeholder="e.g. DRV-1029"
                    className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Driver Contact Number / Phone (Optional)</label>
                  <input
                    type="tel"
                    value={assignDriverPhone}
                    onChange={(e) => setAssignDriverPhone(e.target.value)}
                    placeholder="e.g. 0917 123 4567"
                    className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Driver Picture / ID Photo</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange(e, 'assign')}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assignSubmitting || !assignDriverName.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    {assignSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Save Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Truck Modal */}
      {isEditModalOpen && editingTruck && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Truck Specifications & Coverage</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Truck {editingTruck.truckId} · Home Barangay: {editingTruck.barangay || 'City Wide'}
                </p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSaveEditTruck} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Truck Model *</label>
                    <input
                      type="text"
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      placeholder="e.g. Isuzu Elf"
                      required
                      className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white text-slate-800 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Plate Number *</label>
                    <input
                      type="text"
                      value={editPlateNumber}
                      onChange={(e) => setEditPlateNumber(e.target.value)}
                      placeholder="e.g. ABC 1234"
                      required
                      className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white text-slate-800 shadow-sm uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fuel Type</label>
                    <select
                      value={editFuelType}
                      onChange={(e) => setEditFuelType(e.target.value)}
                      className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white text-slate-800 shadow-sm"
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
                      value={editCapacity}
                      onChange={(e) => setEditCapacity(e.target.value)}
                      placeholder="e.g. 2.5"
                      className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white text-slate-800 shadow-sm"
                    />
                  </div>
                </div>

                <hr className="border-slate-100 my-1" />

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Truck Type</label>
                  <div className="flex rounded-xl overflow-hidden border border-slate-200 p-1 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => { setEditTruckType('dedicated'); setEditServiceBarangays([]); }}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${editTruckType === 'dedicated' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Dedicated
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditTruckType('shared');
                        if (editingTruck.barangay && !editServiceBarangays.includes(editingTruck.barangay)) {
                          setEditServiceBarangays(prev => [editingTruck.barangay, ...prev]);
                        }
                      }}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${editTruckType === 'shared' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Shared
                    </button>
                  </div>
                </div>

                {editTruckType === 'shared' && (
                  <div className="space-y-2" ref={editBrgyDropdownRef}>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Service Barangays <span className="text-red-500">*</span>
                      </label>
                      {editServiceBarangays.length > 0 && (
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                          {editServiceBarangays.length} selected
                        </span>
                      )}
                    </div>

                    {/* Searchable Multi-Select Box */}
                    <div className="relative">
                      <div
                        onClick={() => setIsEditBrgyDropdownOpen(true)}
                        className="min-h-[46px] w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500 flex flex-wrap items-center gap-1.5 cursor-text shadow-sm"
                      >
                        {/* Selected Chips */}
                        {editServiceBarangays.map(b => (
                          <span
                            key={b}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200"
                          >
                            {b}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEditServiceBarangay(b);
                              }}
                              className="hover:text-red-600 transition-colors ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}

                        {/* Search Input */}
                        <div className="flex-1 min-w-[150px] flex items-center gap-2">
                          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <input
                            type="text"
                            value={editBrgySearch}
                            onChange={(e) => {
                              setEditBrgySearch(e.target.value);
                              setIsEditBrgyDropdownOpen(true);
                            }}
                            onFocus={() => setIsEditBrgyDropdownOpen(true)}
                            placeholder={editServiceBarangays.length === 0 ? "Search barangays..." : "Type to add more..."}
                            className="w-full text-sm bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 py-1"
                          />
                        </div>

                        {/* Dropdown Chevron */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditBrgyDropdownOpen(prev => !prev);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isEditBrgyDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* Dropdown Menu */}
                      {isEditBrgyDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto p-2">
                          <div className="flex items-center justify-between px-3 py-1.5 mb-1 text-xs text-slate-400 border-b border-slate-100 pb-2">
                            <span>{editFilteredBarangays.length} barangay(s) found</span>
                            <div className="flex items-center gap-3">
                              {editServiceBarangays.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setEditServiceBarangays([])}
                                  className="text-xs text-red-500 font-bold hover:underline"
                                >
                                  Clear All
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditServiceBarangays(routeBarangays)}
                                className="text-xs text-blue-600 font-bold hover:underline"
                              >
                                Select All
                              </button>
                            </div>
                          </div>

                          {editFilteredBarangays.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                              No barangays match &ldquo;{editBrgySearch}&rdquo;
                            </div>
                          ) : (
                            editFilteredBarangays.map(brgy => {
                              const isSelected = editServiceBarangays.includes(brgy);
                              return (
                                <div
                                  key={brgy}
                                  onClick={() => toggleEditServiceBarangay(brgy)}
                                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50 text-blue-800 font-bold'
                                      : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span>{brgy}</span>
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                                    isSelected
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}>
                                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting || (!editPlateNumber.trim() && !editModel.trim())}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-lg shadow-blue-600/20 transition-all"
                  >
                    {editSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {generatedEntry && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4">
              <Truck className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Truck Successfully Registered</h3>
            <p className="text-xs text-slate-500 mb-4">
              Share this Truck ID with the driver to log into the mobile collector app.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between mb-4">
              <span className="font-mono text-xl font-black text-emerald-800 tracking-wider">{generatedEntry.truckId}</span>
              <button
                onClick={handleCopy}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 transition-colors shadow-sm"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={() => setGeneratedEntry(null)}
              className="w-full py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
