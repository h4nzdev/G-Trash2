import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AlertTriangle, X, Map as MapIcon, Radio, Wind, Thermometer } from 'lucide-react';
import Sidebar from '../components/sidebar/Sidebar';
import TopBar from '../components/shared/TopBar';
import API from '../config';

export default function DashboardLayout() {
  const [alerts, setAlerts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const socket = io(API, { transports: ['websocket', 'polling'] });

    // Truck off-route alerts
    socket.on('truck:off-route', (data) => {
      const id = Date.now();
      const newAlert = { ...data, id, type: 'truck-off-route' };
      setAlerts(prev => [newAlert, ...prev]);
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }, 10000);
    });

    // IoT sensor alerts (critical/moderate threshold breaches)
    socket.on('iot:alert', (data) => {
      const id = Date.now() + Math.random();
      const newAlert = { ...data, id, type: 'iot-alert' };
      setAlerts(prev => [newAlert, ...prev].slice(0, 5));
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }, 12000);
    });

    // IoT auto-generated report (unhealthy/hazardous air quality)
    socket.on('report:new', (data) => {
      if (data.reportedBy?.startsWith('IoT Sensor')) {
        const id = Date.now() + Math.random();
        const newAlert = {
          id,
          type: 'iot-report',
          title: data.title,
          priority: data.priority,
          location: data.location,
          barangay: data.barangay,
        };
        setAlerts(prev => [newAlert, ...prev].slice(0, 5));
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== id));
        }, 15000);
      }
    });

    return () => socket.disconnect();
  }, []);

  const dismissAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const renderAlert = (alert) => {
    if (alert.type === 'truck-off-route') {
      return (
        <div
          key={alert.id}
          className="bg-white border-l-4 border-red-500 rounded-xl shadow-2xl p-4 flex gap-4 pointer-events-auto"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-slate-900">Truck Off Route!</h4>
            <p className="text-xs text-slate-600 mt-1">
              Truck <span className="font-bold">{alert.truckId}</span> has deviated from its path.
            </p>
            <button
              onClick={() => { dismissAlert(alert.id); navigate('/routes'); }}
              className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-wider"
            >
              <MapIcon className="w-3 h-3" />
              Open Monitoring
            </button>
          </div>
          <button onClick={() => dismissAlert(alert.id)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    if (alert.type === 'iot-alert') {
      const isCritical = alert.severity === 'critical';
      return (
        <div
          key={alert.id}
          className={`bg-white border-l-4 ${isCritical ? 'border-red-500' : 'border-amber-500'} rounded-xl shadow-2xl p-4 flex gap-3 pointer-events-auto`}
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          <div className={`w-10 h-10 ${isCritical ? 'bg-red-100' : 'bg-amber-100'} rounded-full flex items-center justify-center flex-shrink-0 ${isCritical ? 'animate-pulse' : ''}`}>
            <Wind className={`w-5 h-5 ${isCritical ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {isCritical ? '🔴 CRITICAL' : '🟡 WARNING'}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Radio className="w-3 h-3" /> {alert.sensorId}
              </span>
            </div>
            <p className="text-xs text-slate-800 font-medium leading-snug">{alert.message}</p>
            {alert.location && (
              <p className="text-[11px] text-slate-500 mt-1">📍 {alert.location}{alert.barangay ? `, ${alert.barangay}` : ''}</p>
            )}
            <button
              onClick={() => { dismissAlert(alert.id); navigate('/heatmap'); }}
              className={`mt-2 flex items-center gap-1.5 text-[10px] font-bold ${isCritical ? 'text-red-600 hover:text-red-700' : 'text-amber-600 hover:text-amber-700'} uppercase tracking-wider`}
            >
              <MapIcon className="w-3 h-3" />
              View Heatmap
            </button>
          </div>
          <button onClick={() => dismissAlert(alert.id)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    if (alert.type === 'iot-report') {
      const isCrit = alert.priority === 'Critical';
      return (
        <div
          key={alert.id}
          className={`bg-gradient-to-r ${isCrit ? 'from-red-50 to-white border-l-4 border-red-500' : 'from-amber-50 to-white border-l-4 border-amber-500'} rounded-xl shadow-2xl p-4 flex gap-3 pointer-events-auto`}
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          <div className={`w-10 h-10 ${isCrit ? 'bg-red-100' : 'bg-amber-100'} rounded-full flex items-center justify-center flex-shrink-0 animate-pulse`}>
            <Thermometer className={`w-5 h-5 ${isCrit ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isCrit ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                IoT Auto-Report
              </span>
            </div>
            <p className="text-xs text-slate-800 font-medium leading-snug truncate">{alert.title}</p>
            {alert.location && (
              <p className="text-[11px] text-slate-500 mt-1">📍 {alert.location}{alert.barangay ? `, ${alert.barangay}` : ''}</p>
            )}
            <button
              onClick={() => { dismissAlert(alert.id); navigate('/reports'); }}
              className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 uppercase tracking-wider"
            >
              View Reports
            </button>
          </div>
          <button onClick={() => dismissAlert(alert.id)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
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

          {/* Floating Alerts Container */}
          <div className="fixed top-20 right-6 z-[3000] flex flex-col gap-3 w-96 pointer-events-none">
            {alerts.map(renderAlert)}
          </div>
        </main>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
