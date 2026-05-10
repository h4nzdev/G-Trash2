import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2, Truck, Route, X, RefreshCw, Clock } from 'lucide-react';
import API from '../config';

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
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const [schedules, setSchedules] = useState([]);     // all schedules for current month
  const [selectedDate, setSelectedDate] = useState(todayYMD());
  const [fleet, setFleet] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [fleetError, setFleetError] = useState(false);

  // Modal form state
  const [selTruck, setSelTruck] = useState('');
  const [selRoute, setSelRoute] = useState('');
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const fetchAll = async () => {
    setLoading(true);
    setScheduleError('');
    const [sRes, fRes, rRes] = await Promise.allSettled([
      axios.get(`${API}/api/schedules?month=${monthKey}`),
      axios.get(`${API}/api/fleet`),
      axios.get(`${API}/api/routes`),
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
    if (rRes.status === 'fulfilled') setRoutes(rRes.value.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [monthKey]);

  // Calendar helpers
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  // Map date → schedules for quick lookup
  const schedulesByDate = {};
  schedules.forEach(s => {
    if (!schedulesByDate[s.date]) schedulesByDate[s.date] = [];
    schedulesByDate[s.date].push(s);
  });

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
    if (!selTruck || !selRoute) return;
    setSubmitting(true);
    setError('');
    try {
      const truck = fleet.find(t => t.truckId === selTruck);
      const route = routes.find(r => r._id === selRoute);
      await axios.post(`${API}/api/schedules`, {
        date: selectedDate,
        truckId: selTruck,
        driverName: truck?.driverName || '',
        routeId: selRoute || '',
        routeName: route?.name || '',
        startTime,
        notes,
      });
      setShowModal(false);
      setSelTruck('');
      setSelRoute('');
      setStartTime('');
      setNotes('');
      await fetchAll();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save schedule');
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

  const openModal = () => {
    setSelTruck('');
    setSelRoute('');
    setStartTime('');
    setNotes('');
    setError('');
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Calendar ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-800">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-1.5">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <div className="w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} />;
                const ymd = toYMD(year, month, day);
                const hasSched = (schedulesByDate[ymd] || []).length > 0;
                const isToday = ymd === today;
                const isSelected = ymd === selectedDate;
                const count = (schedulesByDate[ymd] || []).length;
                return (
                  <button
                    key={ymd}
                    onClick={() => setSelectedDate(ymd)}
                    className={`relative flex flex-col items-center justify-center rounded-xl py-2.5 min-h-[52px] transition-all text-sm font-medium border
                      ${isSelected
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-md'
                        : isToday
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                          : 'text-slate-700 border-transparent hover:bg-slate-50'
                      }`}
                  >
                    {day}
                    {hasSched && (
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : 'bg-emerald-500'}`} />
                        ))}
                        {count > 3 && <span className={`text-[9px] font-bold ${isSelected ? 'text-white/80' : 'text-emerald-600'}`}>+{count - 3}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-5 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-3 h-3 rounded-full bg-emerald-500" /> Has schedule
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-300" /> Today
            </div>
          </div>
        </div>

        {/* ── Day Panel ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Selected Date</p>
              <h3 className="text-sm font-bold text-slate-800 leading-tight">{formatDisplayDate(selectedDate)}</h3>
            </div>
            <button
              onClick={openModal}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Schedule
            </button>
          </div>

          {scheduleError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <span className="font-bold shrink-0">Error:</span>
              <span>{scheduleError}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2">
            {daySchedules.length === 0 && !scheduleError ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Calendar className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm font-semibold text-slate-400">No schedules</p>
                <p className="text-xs text-slate-300 mt-0.5">Click + Schedule to add one</p>
              </div>
            ) : daySchedules.length === 0 ? null : (
              daySchedules.map(s => (
                <div key={s._id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Truck className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                        <span className="text-xs font-bold text-emerald-800 font-mono">{s.truckId}</span>
                      </div>
                      {s.driverName && (
                        <p className="text-xs text-slate-600 font-medium truncate">{s.driverName}</p>
                      )}
                      {s.routeName ? (
                        <div className="flex items-center gap-1 mt-1">
                          <Route className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500 truncate">{s.routeName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 italic">No route assigned</span>
                      )}
                      {s.startTime && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-400">{s.startTime}</span>
                        </div>
                      )}
                      {s.notes && <p className="text-xs text-slate-400 mt-1 italic">"{s.notes}"</p>}
                    </div>
                    <button
                      onClick={() => handleDelete(s._id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Month summary */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              <span className="font-bold text-slate-600">{schedules.length}</span> total schedules in {MONTHS[month]}
            </p>
          </div>
        </div>
      </div>

      {/* ── Add Schedule Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-800">Add Schedule</h3>
                <p className="text-xs text-slate-500 mt-0.5">{formatDisplayDate(selectedDate)}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>
            )}

            <form onSubmit={handleAddSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Truck / Driver *</label>
                {fleetError ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    Could not load fleet. Make sure the backend is running and you are logged in.
                  </div>
                ) : (
                  <select
                    value={selTruck}
                    onChange={e => setSelTruck(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-700"
                  >
                    <option value="">— Select truck —</option>
                    {fleet.map(t => (
                      <option key={t.truckId} value={t.truckId}>
                        {t.truckId} — {t.driverName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Route *</label>
                <select
                  value={selRoute}
                  onChange={e => setSelRoute(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-700"
                >
                  <option value="">— Select a route —</option>
                  {routes.map(r => (
                    <option key={r._id} value={r._id}>
                      {r.name}{r.truckId ? ` (${r.truckId})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Start Time (optional)</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">Required when assigning multiple routes to the same truck on the same day.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Early shift, holiday route..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selTruck}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-colors"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
