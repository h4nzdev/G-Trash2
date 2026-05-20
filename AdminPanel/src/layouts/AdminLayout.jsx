import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Map as MapIcon,
  ClipboardList, Settings, LogOut, ShieldAlert,
  AlertTriangle, X, Bug, ShieldCheck, Megaphone, HeartPulse, Layers
} from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import API from '../config';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const socket = io(API);

    socket.on('truck:off-route', (data) => {
      const newAlert = {
        id: Date.now(),
        type: 'danger',
        title: 'Off-Route Alert!',
        message: `Truck ${data.truckId} has deviated from its assigned path!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        truckId: data.truckId
      };
      setAlerts(prev => [newAlert, ...prev].slice(0, 3));
      
      // Auto-remove after 10 seconds
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
      }, 10000);
    });

    return () => socket.disconnect();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Officials', path: '/admin/officials', icon: Users },
    { name: 'Master Map', path: '/admin/map', icon: MapIcon },
    { name: 'Bug Reports',   path: '/admin/bugs',          icon: Bug },
    { name: 'Reports',       path: '/admin/reports',        icon: ShieldAlert },
    { name: 'Jurisdiction',  path: '/admin/jurisdiction',   icon: ShieldCheck },
    { name: 'Announcements', path: '/admin/announcements',  icon: Megaphone },
    { name: 'System Health', path: '/admin/system-health',  icon: HeartPulse },
    { name: 'Zone Mgmt',     path: '/admin/zones',          icon: Layers },
    { name: 'Settings',      path: '/admin/settings',       icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldAlert className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight">AdminPanel</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Superadmin Mode</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                  : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-emerald-400'}`} />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Floating Alerts Container */}
        <div className="fixed top-20 right-8 z-[100] space-y-4 w-96">
          {alerts.map(alert => (
            <div 
              key={alert.id} 
              className="bg-white border-l-4 border-red-500 shadow-2xl rounded-2xl p-4 flex items-start gap-4 animate-in slide-in-from-right-full duration-300"
            >
              <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-black text-slate-900 text-sm">{alert.title}</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{alert.time}</span>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {alert.message}
                </p>
                <button 
                  onClick={() => navigate('/admin/map')}
                  className="mt-3 text-[10px] font-bold text-red-600 uppercase tracking-widest hover:underline"
                >
                  Locate Truck on Master Map
                </button>
              </div>
              <button 
                onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                className="text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-slate-900 capitalize">
            {location.pathname.split('/').pop()}
          </h2>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full uppercase tracking-wider">
              System Online
            </div>
          </div>
        </header>

        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
