import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2, Truck, Route, X, RefreshCw, Clock, Search, Phone, Edit3, CheckCircle2, AlertCircle, Check, Leaf, Recycle } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import API from '../config';
import RouteManager from './RouteManager';
import { useAuth } from '../context/AuthContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toYMD(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ScheduleRoute() {
  const { official } = useAuth();
  const now = new Date();
  const [activeTab, setActiveTab] = useState('calendar');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const [schedules, setSchedules] = useState([]);     // all schedules for current month
  const [selectedDate, setSelectedDate] = useState(todayYMD());
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [fleetError, setFleetError] = useState(false);

  // Status update modal state
  const [statusModalSchedule, setStatusModalSchedule] = useState(null);
  const [selectedNewStatus, setSelectedNewStatus] = useState('pending');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Modal form state
  const [modalStep, setModalStep] = useState(1);
  const [selTruck, setSelTruck] = useState('');
  const [wasteType, setWasteType] = useState('Malata');
  const [filterWasteType, setFilterWasteType] = useState('All');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [priorityLevel, setPriorityLevel] = useState('High');
  const [priorityReason, setPriorityReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Location data states
  const [barangayList, setBarangayList] = useState([]);
  const [sitioList, setSitioList] = useState([]);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedSitios, setSelectedSitios] = useState([]);
  const [previewCoords, setPreviewCoords] = useState([]);

  // Fetch real road route coordinates from OSRM / OpenRouteService for modal preview
  useEffect(() => {
    if (selectedSitios.length < 2) {
      setPreviewCoords([]);
      return;
    }
    const wps = selectedSitios.map(name => {
      const s = sitioList.find(s => s.name === name);
      return s ? { lat: s.lat, lng: s.lng } : null;
    }).filter(Boolean);
    
    if (wps.length < 2) {
      setPreviewCoords([]);
      return;
    }

    let isMounted = true;

    async function fetchPreviewRoute() {
      // 1. Try OSRM first (free, no API key limit, returns accurate road geometry)
      try {
        const locStr = wps.map(w => `${w.lng},${w.lat}`).join(';');
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${locStr}?overview=full&geometries=geojson`);
        if (res.ok) {
          const data = await res.json();
          const coords = data.routes?.[0]?.geometry?.coordinates;
          if (coords && coords.length > 0 && isMounted) {
            setPreviewCoords(coords.map(c => [c[1], c[0]]));
            return;
          }
        }
      } catch (osrmErr) {
        console.warn("OSRM preview routing failed, trying ORS fallback:", osrmErr);
      }

      // 2. Try OpenRouteService
      const ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjQ1N2I3YTYyYzZiMTRjZTc5MjI5OTdhNWI3NTIzY2I1IiwiaCI6Im11cm11cjY0In0=';
      try {
        const res = await axios.post(
          'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
          { coordinates: wps.map(w => [w.lng, w.lat]) },
          { headers: { Authorization: ORS_KEY, 'Content-Type': 'application/json' }, timeout: 4000 }
        );
        const coords = res.data.features?.[0]?.geometry?.coordinates;
        if (coords && coords.length > 0 && isMounted) {
          setPreviewCoords(coords.map(c => [c[1], c[0]]));
          return;
        }
      } catch (orsErr) {
        console.warn("OpenRouteService preview routing failed:", orsErr);
      }

      // 3. Fallback to straight lines if both services fail
      if (isMounted) {
        setPreviewCoords(wps.map(w => [w.lat, w.lng]));
      }
    }

    fetchPreviewRoute();

    return () => { isMounted = false; };
  }, [selectedSitios, sitioList]);

  // Add Sitio inline form states
  const [showAddSitioForm, setShowAddSitioForm] = useState(false);
  const [newSitioName, setNewSitioName] = useState('');
  const [newSitioLat, setNewSitioLat] = useState('');
  const [newSitioLng, setNewSitioLng] = useState('');
  const [addingSitio, setAddingSitio] = useState(false);
  const [sitioError, setSitioError] = useState('');

  // Map Searcher states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingMap, setSearchingMap] = useState(false);
  const [searchError, setSearchError] = useState('');

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const fetchAll = async () => {
    setLoading(true);
    setScheduleError('');
    const barangayParam = official?.barangay && official.barangay !== 'All' ? `&barangay=${encodeURIComponent(official.barangay)}` : '';
    const [sRes, fRes] = await Promise.allSettled([
      axios.get(`${API}/api/schedules?month=${monthKey}${barangayParam}`),
      axios.get(`${API}/api/fleet`),
    ]);
    if (sRes.status === 'fulfilled') {
      setSchedules(sRes.value.data);
    } else {
      const msg = sRes.reason?.response?.data?.error || sRes.reason?.message || 'Failed to load schedules';
      setScheduleError(msg);
      console.error('[ScheduleRoute] schedule fetch error:', sRes.reason);
    }
    if (fRes.status === 'fulfilled') { setFleet(fRes.value.data); setFleetError(false); }
    else { setFleetError(true); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [monthKey, official?.barangay]);

  // Load Cebu City barangays from backend API on mount
  useEffect(() => {
    axios.get(`${API}/api/barangays`)
      .then(({ data }) => {
        setBarangayList(data);
      })
      .catch((err) => {
        console.error('Failed to load barangays:', err);
      });
  }, []);

  // Sync selectedBarangay with official's barangay restriction
  useEffect(() => {
    if (official?.barangay && official.barangay !== 'All') {
      setSelectedBarangay(official.barangay);
    }
  }, [official]);

  // Load sitios list whenever selectedBarangay changes
  useEffect(() => {
    if (!selectedBarangay) {
      setSitioList([]);
      return;
    }
    axios.get(`${API}/api/sitios?barangay=${encodeURIComponent(selectedBarangay)}`)
      .then(({ data }) => {
        setSitioList(data);
      })
      .catch((err) => {
        console.error('Failed to load sitios:', err);
        setSitioList([]);
      });

    // Sync map coordinates to new barangay center on barangay change
    const center = getBarangayCenter(selectedBarangay);
    setNewSitioLat(center.lat);
    setNewSitioLng(center.lng);
    setSearchQuery('');
    setSearchError('');
  }, [selectedBarangay]);

  // Calendar helpers
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  // Filter schedules strictly to official's barangay if restricted
  const scopedSchedules = useMemo(() => {
    if (!official?.barangay || official.barangay === 'All' || official.role === 'superadmin') {
      return schedules;
    }
    const target = official.barangay.toLowerCase().trim();
    return schedules.filter(s => {
      const b = (s.barangay || '').toLowerCase().trim();
      if (b) return b === target;
      return (s.routeName || '').toLowerCase().includes(target);
    });
  }, [schedules, official]);

  // Map date → schedules for quick lookup
  const schedulesByDate = useMemo(() => {
    const map = {};
    scopedSchedules.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [scopedSchedules]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const daySchedules = schedulesByDate[selectedDate] || [];

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!selTruck || !selectedBarangay || selectedSitios.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const truck = fleet.find(t => t.truckId === selTruck);
      
      // Auto-heal / sync coverage if truck belongs to this barangay or official
      if (truck && truck.type === 'shared') {
        const currentServiceBarangays = Array.isArray(truck.serviceBarangays) ? truck.serviceBarangays : [];
        const allowed = currentServiceBarangays.map(b => b.toLowerCase());
        if (!allowed.includes(selectedBarangay.toLowerCase())) {
          try {
            const updatedServiceBarangays = [...new Set([...currentServiceBarangays, selectedBarangay])];
            await axios.patch(`${API}/api/fleet/${selTruck}`, {
              serviceBarangays: updatedServiceBarangays
            });
            truck.serviceBarangays = updatedServiceBarangays;
          } catch (patchErr) {
            console.warn('Auto-sync truck coverage failed:', patchErr);
          }
        }
      }      await axios.post(`${API}/api/schedules`, {
        date: selectedDate,
        truckId: selTruck,
        driverName: truck?.driverName || '',
        barangay: selectedBarangay,
        sitios: selectedSitios,
        startTime,
        endTime,
        notes,
        isPriority,
        priorityLevel,
        priorityReason,
        wasteType,
      });

      setShowModal(false);
      setSelTruck('');
      setWasteType('Malata');
      setStartTime('');
      setEndTime('');
      setNotes('');
      setIsPriority(false);
      setPriorityLevel('High');
      setPriorityReason('');
      setSelectedSitios([]);
      await fetchAll();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save schedules. One of the sitios may already be scheduled.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this schedule?')) return;
    try {
      await axios.delete(`${API}/api/schedules/${id}`);
      setSchedules(prev => prev.filter(s => s._id !== id));
    } catch { /* silent */ }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const { data } = await axios.patch(`${API}/api/schedules/${id}/status`, { status });
      setSchedules(prev => prev.map(s => s._id === id ? { ...s, status: data.status } : s));
      return data;
    } catch (err) {
      console.error('Failed to update schedule status:', err);
      throw err;
    }
  };

  const handleSaveStatusModal = async () => {
    if (!statusModalSchedule) return;
    setUpdatingStatus(true);
    try {
      await handleUpdateStatus(statusModalSchedule._id, selectedNewStatus);
      setStatusModalSchedule(null);
    } catch (err) {
      console.error('Failed to update status from modal:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getBarangayCenter = (brgy) => {
    const name = brgy?.toLowerCase() || '';
    if (name.includes('lahug')) return { lat: 10.3292, lng: 123.9015 };
    if (name.includes('guadalupe')) return { lat: 10.3188, lng: 123.8833 };
    if (name.includes('mabolo')) return { lat: 10.3283, lng: 123.9142 };
    return { lat: 10.3157, lng: 123.8854 }; // general Cebu City center fallback
  };

  const handleSearchMap = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchingMap(true);
    setSearchError('');
    try {
      const query = `${searchQuery.trim()}, ${selectedBarangay || 'Cebu City'}, Cebu, Philippines`;
      const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: {
          q: query,
          format: 'json',
          limit: 1
        }
      });
      if (res.data && res.data.length > 0) {
        const { lat, lon } = res.data[0];
        setNewSitioLat(Number(lat).toFixed(6));
        setNewSitioLng(Number(lon).toFixed(6));
      } else {
        setSearchError('Location not found. Try refining search.');
      }
    } catch (err) {
      console.error('Nominatim search failed:', err);
      setSearchError('Failed to contact search service.');
    } finally {
      setSearchingMap(false);
    }
  };

  const handleSaveNewSitio = async (e) => {
    e.preventDefault();
    if (!newSitioName.trim() || !selectedBarangay) return;
    const center = getBarangayCenter(selectedBarangay);
    
    const latVal = newSitioLat ? Number(newSitioLat) : center.lat;
    const lngVal = newSitioLng ? Number(newSitioLng) : center.lng;

    setAddingSitio(true);
    setSitioError('');
    try {
      const response = await axios.post(`${API}/api/sitios`, {
        name: newSitioName.trim(),
        barangay: selectedBarangay,
        lat: latVal,
        lng: lngVal,
      });
      // Append to the list and select it
      setSitioList(prev => [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedSitios(prev => [...prev, response.data.name]);
      
      // Reset form
      setNewSitioName('');
      setNewSitioLat('');
      setNewSitioLng('');
      setShowAddSitioForm(false);
      setSearchQuery('');
      setSearchError('');
    } catch (err) {
      setSitioError(err?.response?.data?.error || 'Failed to save sitio');
    } finally {
      setAddingSitio(false);
    }
  };

  const openModal = () => {
    setModalStep(1);
    setSelTruck('');
    setWasteType('Malata');
    setStartTime('');
    setEndTime('');
    setNotes('');
    setIsPriority(false);
    setPriorityLevel('High');
    setPriorityReason('');
    setError('');
    
    const initialBrgy = (official?.barangay && official.barangay !== 'All') ? official.barangay : '';
    setSelectedBarangay(initialBrgy);
    
    const center = getBarangayCenter(initialBrgy);
    setNewSitioLat(center.lat);
    setNewSitioLng(center.lng);
    
    setSelectedSitios([]);
    setShowAddSitioForm(false);
    setNewSitioName('');
    setSitioError('');
    setSearchQuery('');
    setSearchingMap(false);
    setSearchError('');
    setShowModal(true);
  };

  const formatDisplayDate = (ymd) => {
    const [y, m, d] = ymd.split('-');
    return new Date(+y, +m - 1, +d).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Build calendar cells: nulls for leading empty cells, then day numbers
  const cells = [...Array(firstDayOfWeek).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const today = todayYMD();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Schedule Routes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Assign trucks to routes on specific dates</p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── Full Calendar at the Top ── */}
      <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              {MONTHS[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const now = new Date();
                setYear(now.getFullYear());
                setMonth(now.getMonth());
                setSelectedDate(todayYMD());
              }}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Today
            </button>
            <span className="hidden sm:inline-block text-xs font-medium text-slate-400">
              Click any date to view and manage schedule details below
            </span>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {loading ? (
          <div className="grid grid-cols-7 gap-2 animate-pulse">
            {Array.from({ length: 35 }).map((_, idx) => (
              <div
                key={idx}
                className="h-20 bg-slate-50 border border-slate-100 rounded-2xl p-2 flex flex-col justify-between"
              >
                <div className="h-3 w-5 bg-slate-200 rounded" />
                <div className="h-2 w-full bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="min-h-[72px]" />;
              const ymd = toYMD(year, month, day);
              const dayScheds = schedulesByDate[ymd] || [];
              const hasSched = dayScheds.length > 0;
              const isToday = ymd === today;
              const isSelected = ymd === selectedDate;
              const count = dayScheds.length;

              return (
                <button
                  key={ymd}
                  onClick={() => setSelectedDate(ymd)}
                  className={`relative flex flex-col justify-between p-2 sm:p-2.5 rounded-2xl min-h-[72px] sm:min-h-[82px] transition-all duration-200 text-left border-2 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                      : isToday
                        ? 'bg-blue-50/50 text-blue-900 border-blue-200 hover:border-blue-300 font-bold'
                        : 'bg-white text-slate-700 border-slate-100 hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs'
                  }`}
                >
                  <div className="w-full flex items-center justify-between">
                    <span
                      className={`text-sm font-bold ${
                        isSelected
                          ? 'text-emerald-800'
                          : isToday
                            ? 'text-blue-700'
                            : 'text-slate-800'
                      }`}
                    >
                      {day}
                    </span>
                    {count > 0 && (
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-emerald-200/70 text-emerald-900'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {count} {count === 1 ? 'run' : 'runs'}
                      </span>
                    )}
                  </div>

                  {hasSched ? (
                    <div className="w-full flex flex-wrap gap-1 mt-1 items-center">
                      {dayScheds.slice(0, 4).map((s, i) => {
                        const isDiMalata = s.wasteType === 'Di-Malata';
                        return (
                          <span
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              isDiMalata ? 'bg-blue-500' : 'bg-emerald-500'
                            } ${s.isPriority ? 'ring-1 ring-red-400 animate-pulse' : ''}`}
                            title={`${s.wasteType || 'Waste'} - ${s.driverName || 'Driver'}`}
                          />
                        );
                      })}
                      {count > 4 && (
                        <span
                          className={`text-[9px] font-bold ${
                            isSelected ? 'text-emerald-800' : 'text-slate-500'
                          }`}
                        >
                          +{count - 4}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="h-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Calendar Legend & Month Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Malata (Bio)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Di-Malata (Non-Bio)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-50 border-2 border-blue-200" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-50 border-2 border-emerald-500" />
              <span>Selected Date</span>
            </div>
          </div>
          <p className="text-xs font-semibold text-slate-500">
            <span className="font-bold text-slate-800">{scopedSchedules.length}</span> total schedules in {MONTHS[month]}
          </p>
        </div>
      </div>

      {/* ── Schedule Details at the Bottom ── */}
      <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        {/* Details Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Selected Date Details
              </span>
              <span className="text-xs font-bold text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-500">
                {daySchedules.length} {daySchedules.length === 1 ? 'Route Scheduled' : 'Routes Scheduled'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mt-1">
              {formatDisplayDate(selectedDate)}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Waste Type Filter Toggle */}
            {daySchedules.length > 0 && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                {['All', 'Malata', 'Di-Malata'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterWasteType(t)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      filterWasteType === t
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t === 'All' ? 'All Types' : t === 'Malata' ? '🍃 Malata' : '♻️ Di-Malata'}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={openModal}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Schedule Route
            </button>
          </div>
        </div>

        {scheduleError && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <span className="font-bold shrink-0">Error:</span>
            <span>{scheduleError}</span>
          </div>
        )}

        {/* Schedule Cards Grid */}
        <div>
          {(() => {
            const filteredSchedules = daySchedules.filter((s) => {
              if (filterWasteType === 'All') return true;
              return (s.wasteType || 'Malata') === filterWasteType;
            });

            if (filteredSchedules.length === 0 && !scheduleError) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm border border-slate-100">
                    <Calendar className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-base font-bold text-slate-700">
                    {daySchedules.length > 0
                      ? `No ${filterWasteType} routes scheduled on this date`
                      : `No scheduled routes for ${formatDisplayDate(selectedDate)}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {daySchedules.length > 0
                      ? 'Try selecting another waste category filter.'
                      : 'Assign a truck and driver to a route for this date to begin collection operations.'}
                  </p>
                  <button
                    onClick={openModal}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Schedule Now
                  </button>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSchedules.map((s) => (
                  <div
                    key={s._id}
                    className="group relative p-5 bg-white hover:bg-slate-50/70 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {s.startTime ? (
                            <div className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>{s.startTime}{s.endTime ? ` - ${s.endTime}` : ''}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                              Any Time
                            </span>
                          )}

                          {/* Waste Category Badge */}
                          {s.wasteType === 'Di-Malata' ? (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                              <Recycle className="w-3 h-3 text-blue-600" />
                              Di-Malata
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                              <Leaf className="w-3 h-3 text-emerald-600" />
                              Malata
                            </span>
                          )}

                          {s.isPriority && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              Priority
                            </span>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div>
                          {s.status === 'completed' && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                              Completed
                            </span>
                          )}
                          {s.status === 'accepted' && (
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Accepted
                            </span>
                          )}
                          {s.status === 'missed' && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                              Missed
                            </span>
                          )}
                          {s.status === 'pending' && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Driver & Truck Info */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                              <Truck className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 leading-tight">
                                {s.driverName || 'No Driver Assigned'}
                              </p>
                              <p className="text-[11px] font-mono text-emerald-700 font-bold">
                                {s.truckId}
                              </p>
                            </div>
                          </div>

                          {(s.driverPhone || fleet.find((t) => t.truckId === s.truckId)?.driverPhone) && (
                            <a
                              href={`tel:${s.driverPhone || fleet.find((t) => t.truckId === s.truckId)?.driverPhone}`}
                              className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1 font-medium transition-colors bg-slate-50 hover:bg-emerald-50 px-2 py-1 rounded-lg border border-slate-100"
                              title="Call driver"
                            >
                              <Phone className="w-3 h-3 text-emerald-500" />
                              <span className="text-[11px]">{s.driverPhone || fleet.find((t) => t.truckId === s.truckId)?.driverPhone}</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Route Path */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                          <Route className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-bold truncate">{s.routeName || 'Assigned Route'}</span>
                        </div>
                        {s.barangay && (
                          <p className="text-[11px] text-slate-400 mt-0.5 pl-5">Barangay {s.barangay}</p>
                        )}
                      </div>

                      {/* Notes & Priority Reason */}
                      {s.notes && (
                        <p className="text-xs text-slate-500 italic bg-amber-50/50 border border-amber-100 px-2.5 py-1.5 rounded-lg border-l-2 border-l-amber-400 mb-2">
                          "{s.notes}"
                        </p>
                      )}
                      {s.isPriority && s.priorityReason && (
                        <p className="text-xs text-red-700 font-medium bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg border-l-2 border-l-red-500 mb-2 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>Priority: {s.priorityReason}</span>
                        </p>
                      )}
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStatusModalSchedule(s);
                          setSelectedNewStatus(s.status || 'pending');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                        title="Update Driver Status"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Update Status</span>
                      </button>

                      <button
                        onClick={() => handleDelete(s._id)}
                        className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 cursor-pointer"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Add Schedule Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-240 p-7 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Add Schedule</h3>
                  <p className="text-xs font-medium text-emerald-600">{formatDisplayDate(selectedDate)}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>
            )}

            {/* Tab-by-Tab Step Header Bar */}
            <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 bg-slate-50/80 p-1.5 rounded-xl mb-4 overflow-x-auto custom-green-scrollbar">
              <style>{`
                .custom-green-scrollbar::-webkit-scrollbar { height: 5px; width: 5px; }
                .custom-green-scrollbar::-webkit-scrollbar-track { background: #E2E8F0; border-radius: 10px; }
                .custom-green-scrollbar::-webkit-scrollbar-thumb { background: #059669; border-radius: 10px; }
                .custom-green-scrollbar::-webkit-scrollbar-thumb:hover { background: #047857; }
                .custom-green-scrollbar::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
                .custom-green-scrollbar { scrollbar-width: thin; scrollbar-color: #059669 #E2E8F0; }
              `}</style>
              {[
                { step: 1, label: '1. Area & Sitios' },
                { step: 2, label: '2. Truck & Time' },
                { step: 3, label: '3. Priority & Notes' },
                { step: 4, label: '4. Review & Confirm' },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => {
                    if (s.step === 1 || selectedBarangay) setModalStep(s.step);
                  }}
                  className={`flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all py-2 px-2.5 sm:px-3.5 rounded-lg whitespace-nowrap shrink-0 flex-1 text-center ${
                    modalStep === s.step
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : modalStep > s.step
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'text-slate-500 hover:text-slate-700 bg-white/80 border border-slate-200/60'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddSchedule} className="space-y-5">
              {/* STEP 1: Area & Sitios */}
              {modalStep === 1 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Area / Barangay *</label>
                    <div className="relative">
                      <Route className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      {official?.barangay && official.barangay !== 'All' ? (
                        <div className="w-full pl-10 pr-4 py-3 text-sm font-semibold border border-slate-200 rounded-xl bg-slate-50 text-slate-600 shadow-sm">
                          {official.barangay}
                        </div>
                      ) : (
                        <select
                          value={selectedBarangay}
                          onChange={e => {
                            setSelectedBarangay(e.target.value);
                            setSelectedSitios([]);
                          }}
                          required
                          className="w-full pl-10 pr-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm transition-all appearance-none"
                        >
                          <option value="">— Select Barangay —</option>
                          {barangayList.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div>
                    {!showAddSitioForm ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Sitios / Sub-areas *</label>
                          {selectedBarangay && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddSitioForm(true);
                                setSitioError('');
                              }}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                            >
                              + Add New Sitio
                            </button>
                          )}
                        </div>
                        
                        <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                          {!selectedBarangay ? (
                            <p className="text-xs text-slate-400 italic text-center py-2">Select a barangay to view sitios.</p>
                          ) : sitioList.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-2">No sitios verified under this barangay.</p>
                          ) : (
                            sitioList.map(s => {
                              const isChecked = selectedSitios.includes(s.name);
                              return (
                                <label key={s._id} className="flex items-center gap-2.5 py-1 px-1 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedSitios(prev => prev.filter(name => name !== s.name));
                                      } else {
                                        setSelectedSitios(prev => [...prev, s.name]);
                                      }
                                    }}
                                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                                  />
                                  <span className="text-sm font-medium text-slate-700">{s.name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>

                        {/* Live Route Preview Map */}
                        {selectedSitios.length > 0 && (
                          <div className="w-full h-40 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative z-10 mt-3">
                            <MapContainer
                              center={[
                                sitioList.find(s => s.name === selectedSitios[0])?.lat || getBarangayCenter(selectedBarangay).lat,
                                sitioList.find(s => s.name === selectedSitios[0])?.lng || getBarangayCenter(selectedBarangay).lng
                              ]}
                              zoom={14}
                              style={{ height: '100%', width: '100%' }}
                              zoomControl={false}
                            >
                              <TileLayer
                                className="leaflet-tile-grayscale"
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; OpenStreetMap contributors'
                              />
                              {selectedSitios.map((name, index) => {
                                const s = sitioList.find(s => s.name === name);
                                if (!s) return null;
                                return (
                                  <CircleMarker
                                    key={s._id}
                                    center={[s.lat, s.lng]}
                                    pathOptions={{
                                      color: index === 0 ? '#10B981' : index === selectedSitios.length - 1 ? '#EF4444' : '#F59E0B',
                                      fillColor: index === 0 ? '#10B981' : index === selectedSitios.length - 1 ? '#EF4444' : '#F59E0B',
                                      fillOpacity: 0.8
                                    }}
                                    radius={6}
                                  />
                                );
                              })}
                              {previewCoords.length > 1 && (
                                <RoutePolyline positions={previewCoords} />
                              )}
                              <MapController
                                center={[
                                  sitioList.find(s => s.name === selectedSitios[selectedSitios.length - 1])?.lat || getBarangayCenter(selectedBarangay).lat,
                                  sitioList.find(s => s.name === selectedSitios[selectedSitios.length - 1])?.lng || getBarangayCenter(selectedBarangay).lng
                                ]}
                              />
                            </MapContainer>
                            <div className="absolute bottom-2 right-2 bg-slate-900/70 text-[9px] text-white px-2 py-1 rounded font-mono z-[1000] pointer-events-none">
                              Route Preview ({selectedSitios.length} stops)
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in duration-200">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Add New Sitio</h4>
                        
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Sitio name (e.g. La Guardia)"
                            value={newSitioName}
                            onChange={e => setNewSitioName(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-slate-800 shadow-sm transition-all"
                          />
                          
                          <div className="space-y-2 pt-1">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Search location on map..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSearchMap();
                                  }
                                }}
                                className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={handleSearchMap}
                                disabled={searchingMap || !searchQuery.trim()}
                                className="px-3.5 py-2 text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 rounded-xl transition-colors flex items-center gap-1 shadow-sm"
                              >
                                <Search className="w-3.5 h-3.5" />
                                {searchingMap ? 'Searching...' : 'Search'}
                              </button>
                            </div>
                            {searchError && <p className="text-[10px] text-red-600 font-medium">{searchError}</p>}

                            <div className="w-full h-40 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative z-10 mt-1">
                              <MapContainer
                                center={[newSitioLat || 10.3157, newSitioLng || 123.8854]}
                                zoom={15}
                                style={{ height: '100%', width: '100%' }}
                                zoomControl={false}
                              >
                                <TileLayer
                                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                  attribution='&copy; OpenStreetMap contributors'
                                />
                                <CircleMarker
                                  center={[newSitioLat || 10.3157, newSitioLng || 123.8854]}
                                  pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.9 }}
                                  radius={8}
                                />
                                <MapClickHandler onClick={(e) => {
                                  setNewSitioLat(Number(e.latlng.lat).toFixed(6));
                                  setNewSitioLng(Number(e.latlng.lng).toFixed(6));
                                }} />
                                <MapController center={[newSitioLat, newSitioLng]} />
                              </MapContainer>
                              <div className="absolute bottom-2 right-2 bg-slate-900/70 text-[9px] text-white px-2 py-1 rounded font-mono z-[1000] pointer-events-none">
                                {Number(newSitioLat).toFixed(5)}, {Number(newSitioLng).toFixed(5)}
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-normal">
                              🔍 Search above, or **click anywhere on the map** to place the sitio pin.
                            </p>
                          </div>
                          
                          {sitioError && <p className="text-[11px] font-medium text-red-600 mb-2">{sitioError}</p>}
                          
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddSitioForm(false);
                                setSitioError('');
                              }}
                              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveNewSitio}
                              disabled={addingSitio || !newSitioName.trim()}
                              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-lg transition-colors"
                            >
                              {addingSitio ? 'Saving...' : 'Save Sitio'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: Truck & Time */}
              {modalStep === 2 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Waste Category Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Waste Category *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setWasteType('Malata')}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                          wasteType === 'Malata'
                            ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-sm ring-1 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${wasteType === 'Malata' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Leaf className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold flex items-center gap-1.5">
                            Malata
                            {wasteType === 'Malata' && <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Active</span>}
                          </div>
                          <p className="text-[11px] text-slate-500">Biodegradable / Organics</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWasteType('Di-Malata')}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                          wasteType === 'Di-Malata'
                            ? 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-sm ring-1 ring-blue-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${wasteType === 'Di-Malata' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Recycle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold flex items-center gap-1.5">
                            Di-Malata
                            {wasteType === 'Di-Malata' && <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-bold">Active</span>}
                          </div>
                          <p className="text-[11px] text-slate-500">Non-Bio / Recyclables</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Truck / Driver Assignment *</label>
                      <span className="text-[11px] font-medium text-slate-400">
                        Targeting: <strong className={wasteType === 'Di-Malata' ? 'text-blue-600' : 'text-emerald-600'}>{wasteType}</strong>
                      </span>
                    </div>
                    {fleetError ? (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                        Could not load fleet. Make sure the backend is running and you are logged in.
                      </div>
                    ) : (
                      <div className="relative">
                        <Truck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select
                          value={selTruck}
                          onChange={e => setSelTruck(e.target.value)}
                          required
                          disabled={!selectedBarangay}
                          className="w-full pl-10 pr-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm transition-all appearance-none"
                        >
                          <option value="">— Select truck —</option>
                          {fleet.filter(t => {
                            if (!selectedBarangay) return true;
                            if (t.barangay && t.barangay.toLowerCase() === selectedBarangay.toLowerCase()) return true;
                            if (t.type === 'shared' && t.serviceBarangays && t.serviceBarangays.map(b => b.toLowerCase()).includes(selectedBarangay.toLowerCase())) return true;
                            if (!t.barangay && (!t.serviceBarangays || t.serviceBarangays.length === 0)) return true;
                            return false;
                          }).map(t => {
                            const truckWaste = t.wasteType || 'Both';
                            const tag = truckWaste === 'Both' ? '' : ` [${truckWaste}]`;
                            return (
                              <option key={t.truckId} value={t.truckId}>
                                {t.truckId} — {t.driverName}{t.driverPhone ? ` (${t.driverPhone})` : ''}{tag}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Start Time <span className="text-slate-400 lowercase normal-case font-normal">(optional)</span></label>
                        <div className="relative">
                          <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <input
                            type="time"
                            value={startTime}
                            onChange={e => setStartTime(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">End Time <span className="text-slate-400 lowercase normal-case font-normal">(optional)</span></label>
                        <div className="relative">
                          <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <input
                            type="time"
                            value={endTime}
                            onChange={e => setEndTime(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm transition-all"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-tight">Recommended when assigning multiple routes to the same truck. Missing the end time will auto-generate an alert.</p>
                  </div>
                </div>
              )}

              {/* STEP 3: Priority & Notes */}
              {modalStep === 3 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Operational Notes <span className="text-slate-400 lowercase normal-case font-normal">(optional)</span></label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. Early shift, holiday route..."
                      rows={3}
                      className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 placeholder-slate-400 shadow-sm transition-all resize-none"
                    />
                  </div>

                  {/* Priority Area Toggle & Options */}
                  <div className="p-4 bg-red-50/60 border border-red-200/60 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-xs font-bold text-slate-800">Set as Priority Area</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isPriority}
                          onChange={e => setIsPriority(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                      </label>
                    </div>

                    {isPriority && (
                      <div className="space-y-3.5 pt-2 border-t border-red-200/40 animate-in fade-in duration-150">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Priority Level</label>
                          <select
                            value={priorityLevel}
                            onChange={e => setPriorityLevel(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-semibold border border-red-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                          >
                            <option value="High">🔴 High Priority</option>
                            <option value="Critical">🚨 Critical Hazard</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Priority Reason / Dispatch Note</label>
                          <input
                            type="text"
                            placeholder="e.g. Toxic odor / High waste accumulation report"
                            value={priorityReason}
                            onChange={e => setPriorityReason(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-medium border border-red-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: Review & Confirm */}
              {modalStep === 4 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Collection Dispatch Summary</h4>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium">Barangay:</span>
                        <span className="font-bold text-slate-800">{selectedBarangay || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Date:</span>
                        <span className="font-bold text-slate-800">{formatDisplayDate(selectedDate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Assigned Truck:</span>
                        <span className="font-bold text-emerald-700">{selTruck || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Waste Category:</span>
                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-xs mt-0.5 ${
                          wasteType === 'Di-Malata' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {wasteType === 'Di-Malata' ? '♻️ Di-Malata (Non-Bio)' : '🍃 Malata (Bio)'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block font-medium">Sitios Covered:</span>
                        <span className="font-bold text-slate-800">{selectedSitios.length} sitio stops</span>
                      </div>
                      {(startTime || endTime) && (
                        <div className="col-span-2">
                          <span className="text-slate-400 block font-medium">Time Window:</span>
                          <span className="font-bold text-slate-800">{startTime || 'Anytime'} — {endTime || 'End of Shift'}</span>
                        </div>
                      )}
                      {isPriority && (
                        <div className="col-span-2 bg-red-100/80 text-red-800 p-2.5 rounded-xl border border-red-200">
                          <span className="font-bold">🚨 Priority Area ({priorityLevel}):</span> {priorityReason || 'Immediate collection priority requested'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step Navigation Controls Footer */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                {modalStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setModalStep(prev => prev - 1)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    ← Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-100 rounded-xl transition-colors ml-auto"
                >
                  Cancel
                </button>
                {modalStep < 4 ? (
                  <button
                    type="button"
                    disabled={modalStep === 1 ? !selectedBarangay || selectedSitios.length === 0 : modalStep === 2 ? !selTruck : false}
                    onClick={() => setModalStep(prev => prev + 1)}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-emerald-600/20"
                  >
                    Next Step →
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting || !selTruck}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Save & Dispatch Schedule
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Update Status Modal ── */}
      {statusModalSchedule && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-7 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Update Status</h3>
                  <p className="text-xs text-slate-500">Change driver status for this route</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalSchedule(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Driver & Schedule Context Box */}
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl mb-5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  {statusModalSchedule.driverName || 'No Driver Assigned'}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-200">
                  {statusModalSchedule.truckId}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium truncate">
                <Route className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span className="truncate">{statusModalSchedule.routeName || 'No route specified'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {statusModalSchedule.date} • {statusModalSchedule.startTime ? `${statusModalSchedule.startTime}${statusModalSchedule.endTime ? ` - ${statusModalSchedule.endTime}` : ''}` : 'Any Time'}
                </span>
              </div>
            </div>

            {/* Status Selection Options */}
            <div className="space-y-2.5 mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Select Status
              </label>

              {/* Option: Pending */}
              <button
                type="button"
                onClick={() => setSelectedNewStatus('pending')}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                  selectedNewStatus === 'pending'
                    ? 'border-amber-400 bg-amber-50/50 shadow-sm ring-2 ring-amber-400/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">Pending</span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded uppercase">Scheduled</span>
                    </div>
                    <p className="text-xs text-slate-500">Awaiting driver shift start or route confirmation</p>
                  </div>
                </div>
                {selectedNewStatus === 'pending' && <Check className="w-5 h-5 text-amber-600" />}
              </button>

              {/* Option: Accepted */}
              <button
                type="button"
                onClick={() => setSelectedNewStatus('accepted')}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                  selectedNewStatus === 'accepted'
                    ? 'border-blue-400 bg-blue-50/50 shadow-sm ring-2 ring-blue-400/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">Accepted</span>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded uppercase">In Progress</span>
                    </div>
                    <p className="text-xs text-slate-500">Driver started shift and accepted route</p>
                  </div>
                </div>
                {selectedNewStatus === 'accepted' && <Check className="w-5 h-5 text-blue-600" />}
              </button>

              {/* Option: Completed */}
              <button
                type="button"
                onClick={() => setSelectedNewStatus('completed')}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                  selectedNewStatus === 'completed'
                    ? 'border-emerald-400 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-400/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">Completed</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded uppercase">Finished</span>
                    </div>
                    <p className="text-xs text-slate-500">Waste collection route successfully completed</p>
                  </div>
                </div>
                {selectedNewStatus === 'completed' && <Check className="w-5 h-5 text-emerald-600" />}
              </button>

              {/* Option: Missed */}
              <button
                type="button"
                onClick={() => setSelectedNewStatus('missed')}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                  selectedNewStatus === 'missed'
                    ? 'border-red-400 bg-red-50/50 shadow-sm ring-2 ring-red-400/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">Missed</span>
                      <span className="text-[10px] font-bold text-red-700 bg-red-100/80 px-1.5 py-0.5 rounded uppercase">Overdue</span>
                    </div>
                    <p className="text-xs text-slate-500">Collection was not completed within designated window</p>
                  </div>
                </div>
                {selectedNewStatus === 'missed' && <Check className="w-5 h-5 text-red-600" />}
              </button>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStatusModalSchedule(null)}
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={handleSaveStatusModal}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {updatingStatus ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e);
    }
  });
  return null;
}

function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, 15);
    }
  }, [center, map]);
  return null;
}

function RoutePolyline({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 1) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [positions, map]);

  return <Polyline positions={positions} pathOptions={{ color: '#006A3B', weight: 4, opacity: 0.8 }} />;
}
