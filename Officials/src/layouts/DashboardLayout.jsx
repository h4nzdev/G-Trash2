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
          className="bg-white/95 backdrop-blur-md px-5 py-3.5 rounded-2xl shadow-xl border border-slate-200/90 flex items-start sm:items-center gap-3.5 w-full pointer-events-auto animate-notification-drop"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center flex-shrink-0 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900">Route Cleared</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/60">
                To Waste Processing
              </span>
              {alert.barangay && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200/60">
                  {alert.barangay}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Truck <strong className="text-emerald-700 font-semibold">{alert.truckId}</strong> has completed all assigned stops.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
              <span>📍 {alert.disposalFacility || 'Waste Processing Facility'}</span>
              {alert.totalWeight && <span>⚖️ {alert.totalWeight} {alert.weightUnit || 'tons'}</span>}
              <span>👤 {alert.driverName || 'Collector'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 self-start sm:self-center">
            <button
              onClick={() => { dismissAlert(alert.id); navigate('/routes'); }}
              className="p-1.5 px-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-xs font-semibold flex items-center gap-1"
              title="View Monitoring"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View</span>
            </button>
            <button
              onClick={() => dismissAlert(alert.id)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    if (alert.type === 'truck-off-route') {
      return (
        <div
          key={alert.id}
          className="bg-white/95 backdrop-blur-md px-5 py-3.5 rounded-2xl shadow-xl border border-rose-200/90 flex items-start sm:items-center gap-3.5 w-full pointer-events-auto animate-notification-drop"
        >
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center flex-shrink-0 text-rose-600 animate-pulse">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900">Truck Off Route!</span>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200/60">
                {alert.truckId}
              </span>
              {alert.barangay && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200/60">
                  {alert.barangay}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Truck <strong className="text-slate-900">{alert.truckId}</strong> has deviated from its assigned path.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 self-start sm:self-center">
            <button
              onClick={() => { dismissAlert(alert.id); navigate('/routes'); }}
              className="p-1.5 px-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors text-xs font-semibold flex items-center gap-1"
              title="Open Monitoring"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Track</span>
            </button>
            <button
              onClick={() => dismissAlert(alert.id)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
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
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/60',
            iconBox: 'bg-rose-50 border border-rose-200/80 text-rose-600 animate-pulse',
            buttonClass: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
          }
        : isModerate
        ? {
            title: 'Elevated Air Pollution',
            badge: '🟡 MODERATE',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/60',
            iconBox: 'bg-amber-50 border border-amber-200/80 text-amber-600',
            buttonClass: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
          }
        : {
            title: 'Clean Air Verified',
            badge: '🟢 CLEAN',
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
            iconBox: 'bg-emerald-50 border border-emerald-200/80 text-emerald-600',
            buttonClass: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
          };

      return (
        <div
          key={alert.id}
          className="bg-white/95 backdrop-blur-md px-5 py-3.5 rounded-2xl shadow-xl border border-slate-200/90 flex items-start sm:items-center gap-3.5 w-full pointer-events-auto animate-notification-drop"
        >
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${theme.iconBox}`}>
            <Wind className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900">
                {theme.title}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${theme.badgeClass}`}>
                {theme.badge}
              </span>
              {alert.sensorId && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200/60 flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5" /> {alert.sensorId}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">{alert.message}</p>
            {alert.location && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                📍 {alert.location}{alert.barangay ? `, ${alert.barangay}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 self-start sm:self-center">
            <button
              onClick={() => { dismissAlert(alert.id); navigate('/heatmap'); }}
              className={`p-1.5 px-2.5 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1 ${theme.buttonClass}`}
              title="View Heatmap"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Heatmap</span>
            </button>
            <button
              onClick={() => dismissAlert(alert.id)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    if (alert.type === 'iot-report') {
      const isCrit = alert.priority === 'Critical';
      return (
        <div
          key={alert.id}
          className="bg-white/95 backdrop-blur-md px-5 py-3.5 rounded-2xl shadow-xl border border-slate-200/90 flex items-start sm:items-center gap-3.5 w-full pointer-events-auto animate-notification-drop"
        >
          <div className={`w-10 h-10 rounded-2xl ${isCrit ? 'bg-rose-50 border border-rose-200/80 text-rose-600 animate-pulse' : 'bg-amber-50 border border-amber-200/80 text-amber-600'} flex items-center justify-center flex-shrink-0`}>
            <Thermometer className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900">IoT Auto-Report</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${isCrit ? 'bg-rose-50 text-rose-700 border-rose-200/60' : 'bg-amber-50 text-amber-700 border-amber-200/60'}`}>
                {alert.priority || 'High'}
              </span>
              {alert.barangay && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200/60">
                  {alert.barangay}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5 truncate">{alert.title}</p>
            {alert.location && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                📍 {alert.location}{alert.barangay ? `, ${alert.barangay}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 self-start sm:self-center">
            <button
              onClick={() => { dismissAlert(alert.id); navigate('/reports'); }}
              className="p-1.5 px-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-xs font-semibold flex items-center gap-1"
              title="View Reports"
            >
              <span>Reports</span>
            </button>
            <button
              onClick={() => dismissAlert(alert.id)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
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
          className="bg-white/95 backdrop-blur-md px-5 py-3.5 rounded-2xl shadow-xl border border-slate-200/90 flex items-start sm:items-center gap-3.5 w-full pointer-events-auto animate-notification-drop"
        >
          <div className={`w-10 h-10 rounded-2xl ${c2.iconBg} border ${c2.border} flex items-center justify-center flex-shrink-0 ${c2.iconColor}`}>
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900">{alert.title}</span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200/80">
                Announcement
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">{alert.message}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">From: {alert.createdBy || 'Admin'}</p>
          </div>
          <button
            onClick={() => dismissAlert(alert.id)}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors ml-auto self-start sm:self-center"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
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
