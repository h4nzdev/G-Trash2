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
                    className={`relative flex flex-col items-center justify-center rounded-2xl py-2.5 min-h-[56px] transition-all duration-200 text-sm font-medium border-2
                      ${isSelected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-500 shadow-sm'
                        : isToday
                          ? 'bg-blue-50 text-blue-800 border-blue-200 hover:border-blue-300 font-bold'
                          : 'bg-white text-slate-700 border-transparent hover:border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    {day}
                    {hasSched && (
                      <div className="flex gap-1 mt-1">
                        {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-600' : 'bg-emerald-400'}`} />
                        ))}
                        {count > 3 && <span className={`text-[9px] font-bold ${isSelected ? 'text-emerald-700' : 'text-emerald-500'}`}>+{count - 3}</span>}
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
              <div className="w-3 h-3 rounded-full bg-emerald-400" /> Has schedule
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-3 h-3 rounded-full bg-blue-50 border-2 border-blue-200" /> Today
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-3 h-3 rounded-full bg-emerald-50 border-2 border-emerald-500" /> Selected
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

          <div className="flex-1 overflow-y-auto space-y-3">
            {daySchedules.length === 0 && !scheduleError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm border border-slate-100">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-slate-600">No scheduled routes</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Assign a truck to a route for this date to get started.</p>
              </div>
            ) : daySchedules.length === 0 ? null : (
              daySchedules.map(s => (
                <div key={s._id} className="group relative p-4 bg-white hover:bg-slate-50 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      {/* Top row: Time & Truck Badge */}
                      <div className="flex items-center gap-2">
                        {s.startTime ? (
                          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-bold">{s.startTime}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-md border border-slate-100">Any Time</span>
                        )}
                        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-100 px-2.5 py-1 rounded-md">
                          <Truck className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs font-bold tracking-wide">{s.truckId}</span>
                        </div>
                      </div>
                      
                      {/* Driver & Route Info */}
                      <div>
                        {s.driverName && (
                          <p className="text-sm font-bold text-slate-800 truncate mb-0.5">{s.driverName}</p>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Route className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          <span className="text-xs text-slate-600 font-medium truncate">{s.routeName || <span className="italic text-slate-400">No route assigned</span>}</span>
                        </div>
                      </div>

                      {/* Notes */}
                      {s.notes && (
                        <p className="text-xs text-slate-500 italic bg-amber-50/50 border border-amber-100/50 px-2.5 py-1.5 rounded-lg border-l-2 border-l-amber-300 mt-1">
                          "{s.notes}"
                        </p>
                      )}
                    </div>

                    {/* Delete button (reveals on hover on desktop, always visible on mobile) */}
                    <button
                      onClick={() => handleDelete(s._id)}
                      className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 md:opacity-0 md:group-hover:opacity-100"
                      title="Delete Schedule"
                    >
                      <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 animate-in zoom-in-95 duration-200">
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

            <form onSubmit={handleAddSchedule} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Truck / Driver *</label>
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
                      className="w-full pl-10 pr-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm transition-all appearance-none"
                    >
                      <option value="">— Select truck —</option>
                      {fleet.map(t => (
                        <option key={t.truckId} value={t.truckId}>
                          {t.truckId} — {t.driverName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Route *</label>
                <div className="relative">
                  <Route className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    value={selRoute}
                    onChange={e => setSelRoute(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 shadow-sm transition-all appearance-none"
                  >
                    <option value="">— Select a route —</option>
                    {routes.map(r => (
                      <option key={r._id} value={r._id}>
                        {r.name}{r.truckId ? ` (${r.truckId})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
                <p className="text-[11px] text-slate-400 mt-1.5 leading-tight">Recommended when assigning multiple routes to the same truck on a single day.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes <span className="text-slate-400 lowercase normal-case font-normal">(optional)</span></label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Early shift, holiday route..."
                  rows={2}
                  className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white text-slate-800 placeholder-slate-400 shadow-sm transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selTruck}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
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
