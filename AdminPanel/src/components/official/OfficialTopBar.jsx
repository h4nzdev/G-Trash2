import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Menu, Bell, Search, ChevronDown, LogOut, User, Settings } from 'lucide-react';
import { notifications, officialProfile } from '../../data/mockData';

const routeTitles = {
  '/official/dashboard':     'Dashboard',
  '/official/collection':    'Collection Tracking',
  '/official/reports':       'Barangay Reports',
  '/official/heatmap':       'Heatmap View',
  '/official/notifications': 'Notifications',
  '/official/settings':      'Settings',
};

const unreadCount = notifications.filter(n => !n.read).length;

export default function OfficialTopBar({ onMenuClick }) {
  const { pathname } = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const title = routeTitles[pathname] ?? 'Official Panel';

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0 z-10">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-400">Barangay {officialProfile.barangay} · {officialProfile.city}</p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-52">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm text-slate-600 placeholder-slate-400 outline-none flex-1"
          />
        </div>

        {/* Notifications */}
        <Link
          to="/official/notifications"
          className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </Link>

        {/* Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {officialProfile.initials}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-slate-800 leading-none">{officialProfile.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{officialProfile.position}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20">
                <Link
                  to="/official/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <User className="w-4 h-4" />
                  Profile
                </Link>
                <Link
                  to="/official/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <div className="border-t border-slate-100 my-1" />
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
