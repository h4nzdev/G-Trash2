import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AlertTriangle, X, Map as MapIcon, Radio, Wind, Thermometer, Megaphone, CheckCircle } from 'lucide-react';
import Sidebar from '../components/sidebar/Sidebar';
import TopBar from '../components/shared/TopBar';
import { useAuth } from '../context/AuthContext';
import API from '../config';

export default function DashboardLayout() {
  const [alerts, setAlerts] = useState([]);
  const navigate = useNavigate();
  const { official } = useAuth();

  useEffect(() => {
    const isScoped = official?.barangay && official.barangay !== 'All' && official?.role !== 'superadmin';
    const userBrgy = official?.barangay?.toLowerCase()?.trim();
    const socket = io(API, { transports: ['websocket', 'polling'] });

    // Truck shift completion toast notification
    socket.on('truck:shift-completed', (data) => {
      if (isScoped && userBrgy && data.barangay && data.barangay.toLowerCase().trim() !== userBrgy) {
        return;
      }
      const alertId = `truck_completed_${data.truckId}`;
      setAlerts(prev => {
        const filtered = prev.filter(a => !(a.type === 'truck-completed' && a.truckId === data.truckId));
        return [{ ...data, id: alertId, type: 'truck-completed', ts: Date.now() }, ...filtered].slice(0, 5);
      });
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }, 15000);
    });

    // Truck off-route alerts (Deduplicated per truck)
    socket.on('truck:off-route', (data) => {
      if (isScoped && userBrgy && data.barangay && data.barangay.toLowerCase().trim() !== userBrgy) {
        return;
      }
      const alertId = `truck_off_route_${data.truckId}`;
      setAlerts(prev => {
        const filtered = prev.filter(a => a.id !== alertId && !(a.type === 'truck-off-route' && a.truckId === data.truckId));
        const updatedAlert = { ...data, id: alertId, type: 'truck-off-route', ts: Date.now() };
        return [updatedAlert, ...filtered].slice(0, 3);
      });
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }, 12000);
    });

    // IoT sensor alerts (critical, moderate, and clean notifications, deduplicated per sensor)
    socket.on('iot:alert', (data) => {
      if (isScoped && userBrgy && data.barangay && data.barangay.toLowerCase().trim() !== userBrgy) {
        return;
      }
      const alertId = `iot_${data.sensorId || data._id}_${data.severity || 'alert'}`;
      setAlerts(prev => {
        // If alert for this sensor & severity already exists, don't create duplicate cards
        const filtered = prev.filter(a => a.id !== alertId);
        const newAlert = { ...data, id: alertId, type: 'iot-alert' };
        return [newAlert, ...filtered].slice(0, 5);
      });
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }, 12000);
    });

    // IoT auto-generated report (unhealthy/hazardous air quality)
    socket.on('report:new', (data) => {
      if (data.reportedBy?.startsWith('IoT Sensor')) {
        if (isScoped && userBrgy && data.barangay && data.barangay.toLowerCase().trim() !== userBrgy) {
          return;
        }
        const alertId = `iot_rep_${data._id || data.title}`;
        setAlerts(prev => {
          if (prev.some(a => a.id === alertId)) return prev;
          const newAlert = {
            id: alertId,
            type: 'iot-report',
            title: data.title,
            priority: data.priority,
            location: data.location,
            barangay: data.barangay,
          };
          return [newAlert, ...prev].slice(0, 5);
        });
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== alertId));
        }, 15000);
      }
    });

    // System announcements from Admin Panel
    socket.on('announcement:new', (data) => {
      const alertId = `ann_${data._id || Date.now()}`;
      setAlerts(prev => [{ ...data, id: alertId, type: 'announcement', annType: data.type }, ...prev].slice(0, 5));
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }, 20000);
    });

    return () => socket.disconnect();
  }, [official]);

  const dismissAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const renderAlert = (alert) => {
    if (alert.type === 'truck-completed') {
      return (
        <div
          key={alert.id}
          className="bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-xl border border-slate-200/90 w-full pointer-events-auto animate-notification-drop flex flex-col gap-2.5"
        >
          {/* Top Row: Icon + Title & Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center flex-shrink-0 text-emerald-600">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  Route Cleared
                </h4>
                {alert.truckId && (
                  <div className="mt-0.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200/80">
                      Truck {alert.truckId}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/60 flex-shrink-0">
              Completed
            </span>
          </div>

          {/* Middle Row: Context */}
          <p className="text-xs text-slate-600 leading-relaxed">
            Truck <strong className="text-emerald-700 font-semibold">{alert.truckId}</strong> has completed all assigned stops and is heading to disposal.
          </p>

          {/* Bottom Row: Address / Details (Left) + Actions (Right) */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 flex-wrap sm:flex-nowrap">
            <div className="min-w-0 flex-1 text-[11px] text-slate-500 truncate">
              <span>📍 {alert.disposalFacility || alert.barangay || 'Waste Facility'}</span>
              {alert.totalWeight && <span className="ml-2">⚖️ {alert.totalWeight} tons</span>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { dismissAlert(alert.id); navigate('/routes'); }}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 transition-colors text-xs font-semibold flex items-center gap-1"
                title="View Monitoring"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 transition-colors text-xs font-semibold"
                title="Close"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (alert.type === 'truck-off-route') {
      return (
        <div
          key={alert.id}
          className="bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-xl border border-rose-200/90 w-full pointer-events-auto animate-notification-drop flex flex-col gap-2.5"
        >
          {/* Top Row: Icon + Title & Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center flex-shrink-0 text-rose-600 animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  Truck Off Route!
                </h4>
                {alert.truckId && (
                  <div className="mt-0.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200/80">
                      Truck {alert.truckId}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200/60 flex-shrink-0">
              🔴 OFF ROUTE
            </span>
          </div>

          {/* Middle Row: Context */}
          <p className="text-xs text-slate-600 leading-relaxed">
            Truck <strong className="text-slate-900">{alert.truckId}</strong> has deviated from its assigned route path.
          </p>

          {/* Bottom Row: Address (Left) + Actions (Right) */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 flex-wrap sm:flex-nowrap">
            <div className="min-w-0 flex-1 text-[11px] text-slate-500 truncate">
              {alert.barangay && <span>📍 {alert.barangay}</span>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { dismissAlert(alert.id); navigate('/routes'); }}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 transition-colors text-xs font-semibold flex items-center gap-1"
                title="Track Truck"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Track</span>
              </button>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 transition-colors text-xs font-semibold"
                title="Close"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (alert.type === 'iot-alert') {
      const isCritical = alert.severity === 'critical';
      const isModerate = alert.severity === 'moderate';
      const isClean = alert.severity === 'clean' || alert.severity === 'info' || (!isCritical && !isModerate);

      const theme = isCritical
        ? {
            title: 'Critical Gas Spike',
            badge: '🔴 CRITICAL',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
            iconBox: 'bg-rose-50 border border-rose-200/80 text-rose-600 animate-pulse',
            buttonClass: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60',
          }
        : isModerate
        ? {
            title: 'Elevated Air Pollution',
            badge: '🟡 MODERATE',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
            iconBox: 'bg-amber-50 border border-amber-200/80 text-amber-600',
            buttonClass: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60',
          }
        : {
            title: 'Clean Air Verified',
            badge: '🟢 CLEAN',
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            iconBox: 'bg-emerald-50 border border-emerald-200/80 text-emerald-600',
            buttonClass: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60',
          };

      return (
        <div
          key={alert.id}
          className="bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-xl border border-slate-200/90 w-full pointer-events-auto animate-notification-drop flex flex-col gap-2.5"
        >
          {/* Top Row: Icon + Title & Sensor ID + Status Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${theme.iconBox}`}>
                <Wind className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  {theme.title}
                </h4>
                {alert.sensorId && (
                  <div className="mt-0.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200/80">
                      <Radio className="w-2.5 h-2.5" /> {alert.sensorId}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Badge (Top Right) */}
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${theme.badgeClass}`}>
              {theme.badge}
            </span>
          </div>

          {/* Middle Row: Context / Message */}
          <p className="text-xs text-slate-600 leading-relaxed">
            {alert.message}
          </p>

          {/* Bottom Row: Address (Left) + Heatmap & Close (Right) */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 flex-wrap sm:flex-nowrap">
            <div className="min-w-0 flex-1">
              {alert.location ? (
                <p className="text-xs font-medium text-slate-500 truncate flex items-center gap-1">
                  <span>📍</span> {alert.location}{alert.barangay ? `, ${alert.barangay}` : ''}
                </p>
              ) : (
                <span />
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { dismissAlert(alert.id); navigate('/heatmap'); }}
                className={`px-3 py-1.5 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1 ${theme.buttonClass}`}
                title="View Heatmap"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Heatmap</span>
              </button>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 transition-colors text-xs font-semibold"
                title="Close"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (alert.type === 'iot-report') {
      const isCrit = alert.priority === 'Critical';
      return (
        <div
          key={alert.id}
          className="bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-xl border border-slate-200/90 w-full pointer-events-auto animate-notification-drop flex flex-col gap-2.5"
        >
          {/* Top Row: Icon + Title & Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-2xl ${isCrit ? 'bg-rose-50 border border-rose-200/80 text-rose-600 animate-pulse' : 'bg-amber-50 border border-amber-200/80 text-amber-600'} flex items-center justify-center flex-shrink-0`}>
                <Thermometer className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  IoT Auto-Report
                </h4>
                {alert.barangay && (
                  <div className="mt-0.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200/80">
                      {alert.barangay}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${isCrit ? 'bg-rose-50 text-rose-700 border-rose-200/60' : 'bg-amber-50 text-amber-700 border-amber-200/60'}`}>
              {alert.priority || 'High'}
            </span>
          </div>

          {/* Middle Row: Context */}
          <p className="text-xs text-slate-600 leading-relaxed truncate">
            {alert.title}
          </p>

          {/* Bottom Row: Address (Left) + Actions (Right) */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 flex-wrap sm:flex-nowrap">
            <div className="min-w-0 flex-1">
              {alert.location && (
                <p className="text-xs font-medium text-slate-500 truncate flex items-center gap-1">
                  <span>📍</span> {alert.location}{alert.barangay ? `, ${alert.barangay}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { dismissAlert(alert.id); navigate('/reports'); }}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 transition-colors text-xs font-semibold flex items-center gap-1"
                title="View Reports"
              >
                <span>Reports</span>
              </button>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 transition-colors text-xs font-semibold"
                title="Close"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (alert.type === 'announcement') {
      const annColors = {
        info:     { border: 'border-sky-200/80',    iconBg: 'bg-sky-50',    iconColor: 'text-sky-600'    },
        success:  { border: 'border-emerald-200/80', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
        warning:  { border: 'border-amber-200/80',   iconBg: 'bg-amber-50',   iconColor: 'text-amber-600'   },
        critical: { border: 'border-rose-200/80',    iconBg: 'bg-rose-50',    iconColor: 'text-rose-600'    },
      };
      const c2 = annColors[alert.annType] ?? annColors.info;
      return (
        <div
          key={alert.id}
          className="bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-xl border border-slate-200/90 w-full pointer-events-auto animate-notification-drop flex flex-col gap-2.5"
        >
          {/* Top Row: Icon + Title & Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-2xl ${c2.iconBg} border ${c2.border} flex items-center justify-center flex-shrink-0 ${c2.iconColor}`}>
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  {alert.title}
                </h4>
                <div className="mt-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200/80">
                    Announcement
                  </span>
                </div>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200/80 flex-shrink-0">
              From {alert.createdBy || 'Admin'}
            </span>
          </div>

          {/* Middle Row: Context */}
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">
            {alert.message}
          </p>

          {/* Bottom Row: Close Button */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
            <button
              onClick={() => dismissAlert(alert.id)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 transition-colors text-xs font-semibold"
              title="Close"
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-[280px] overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto relative">
          <Outlet />

          {/* Floating Alerts Container — Centered at Top with smooth drop animation */}
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[3000] flex flex-col items-center gap-2.5 w-full max-w-lg px-4 pointer-events-none">
            {alerts.map(renderAlert)}
          </div>
        </main>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes notificationSlideDown {
          0% {
            transform: translateY(-24px) scale(0.94);
            opacity: 0;
          }
          60% {
            transform: translateY(3px) scale(1.01);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .animate-notification-drop {
          animation: notificationSlideDown 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
