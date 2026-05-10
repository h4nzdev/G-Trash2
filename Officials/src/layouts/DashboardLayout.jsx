import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AlertTriangle, X, Map as MapIcon } from 'lucide-react';
import Sidebar from '../components/sidebar/Sidebar';
import TopBar from '../components/shared/TopBar';
import API from '../config';

export default function DashboardLayout() {
  const [alerts, setAlerts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const socket = io(API, { transports: ['websocket', 'polling'] });

    socket.on('truck:off-route', (data) => {
      const id = Date.now();
      const newAlert = { ...data, id };
      setAlerts(prev => [newAlert, ...prev]);
      
      // Auto remove after 10 seconds
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id));
      }, 10000);
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-[280px] overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto relative">
          <Outlet />

          {/* Floating Alerts Container */}
          <div className="fixed top-20 right-6 z-[3000] flex flex-col gap-3 w-80 pointer-events-none">
            {alerts.map(alert => (
              <div 
                key={alert.id}
                className="bg-white border-l-4 border-red-500 rounded-xl shadow-2xl p-4 flex gap-4 animate-in slide-in-from-right duration-300 pointer-events-auto"
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
                    onClick={() => {
                      setAlerts(prev => prev.filter(a => a.id !== alert.id));
                      navigate('/routes');
                    }}
                    className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-wider"
                  >
                    <MapIcon className="w-3 h-3" />
                    Open Monitoring
                  </button>
                </div>
                <button 
                  onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
