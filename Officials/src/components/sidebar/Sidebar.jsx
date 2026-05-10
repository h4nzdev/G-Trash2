import { NavLink, useLocation } from 'react-router-dom';
import {
  Leaf, LayoutDashboard, Truck, Trophy, FileWarning,
  MapPin, History, Settings, LogOut, User, Menu, X, Route, CalendarDays,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/routes', icon: Truck, label: 'Route Monitoring' },
  { path: '/fleet', icon: Truck, label: 'Fleet Management' },
  { path: '/route-builder', icon: Route, label: 'Route Builder' },
  { path: '/schedule', icon: CalendarDays, label: 'Schedule Routes' },
  { path: '/barangays', icon: Trophy, label: 'Barangay Rankings' },
  { path: '/reports', icon: FileWarning, label: 'Reports' },
  { path: '/heatmap', icon: MapPin, label: 'Heatmap Analytics' },
  { path: '/history', icon: History, label: 'Collection History' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { official, logout } = useAuth();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-900 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold bg-gradient-to-r from-emerald-800 to-emerald-500 bg-clip-text text-transparent tracking-tight">
            G-TRASH
          </span>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200 tracking-wide">
          OFFICIALS PANEL
        </span>
      </div>

      {/* Nav Label */}
      <div className="px-6 pt-5 pb-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Navigation</span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                isActive
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-[3px] border-emerald-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-[3px] border-transparent'
              }`}
            >
              <Icon
                className={`w-4.5 h-4.5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                }`}
                size={18}
              />
              <span className="text-sm">{label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 bg-emerald-600 rounded-full" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status */}
      <div className="px-6 py-3 mx-3 mb-3 bg-emerald-50 rounded-xl border border-emerald-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-emerald-700">System Online</span>
        </div>
        <p className="text-[11px] text-emerald-600">All sensors operational · 8/12 trucks active</p>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{official?.name || '—'}</p>
            <p className="text-xs text-slate-500 truncate">
              {official?.barangay === 'All' ? 'Super Admin' : `Brgy. ${official?.barangay}`}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <button
        className="fixed top-4 left-4 z-[2001] md:hidden p-2 bg-white rounded-lg shadow-md border border-slate-200"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[1999] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop fixed, mobile slide */}
      <aside
        className={`fixed left-0 top-0 h-screen w-[280px] bg-white border-r border-slate-200 flex flex-col z-[2000] transition-transform duration-200 shadow-sm
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
