import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, ChevronDown, User, Settings, LogOut, CheckCircle } from 'lucide-react';

const pageTitles = {
  '/dashboard': 'Dashboard Overview',
  '/routes': 'Route Monitoring',
  '/barangays': 'Barangay Rankings',
  '/reports': 'Reports Management',
  '/heatmap': 'Heatmap Analytics',
  '/history': 'Collection History',
  '/settings': 'Settings',
};

const subTitles = {
  '/dashboard': 'Monitor waste collection across all barangays',
  '/routes': 'Live truck tracking and route efficiency',
  '/barangays': 'Performance leaderboard and comparisons',
  '/reports': 'User-submitted issues and incident tracking',
  '/heatmap': 'Pollution levels and zone risk analysis',
  '/history': 'Historical data logs and collection records',
  '/settings': 'Account and system preferences',
};

export default function TopBar() {
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const title = pageTitles[location.pathname] || 'Dashboard';
  const subtitle = subTitles[location.pathname] || '';

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-[1998]">
      <div>
        <h1 className="text-lg font-bold text-slate-900 leading-tight">{title}</h1>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search barangay, truck, report..."
            className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                <span className="text-xs text-emerald-600 font-medium cursor-pointer hover:underline">Mark all read</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {[
                  { msg: "Critical ammonia level at Carbon Market", time: "10m ago", dot: "bg-red-500" },
                  { msg: "GT-403 delayed on IT Corridor route", time: "25m ago", dot: "bg-amber-500" },
                  { msg: "3 new reports submitted in Ermita", time: "1h ago", dot: "bg-blue-500" },
                ].map((n, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800">{n.msg}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 text-center">
                <span className="text-xs text-emerald-600 font-medium cursor-pointer hover:underline">View all notifications</span>
              </div>
            </div>
          )}
        </div>

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-800 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-800 hidden sm:block">Engr. Santos</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-12 w-52 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">Engr. Santos</p>
                <p className="text-xs text-slate-500">Waste Management Officer</p>
              </div>
              {[
                { icon: User, label: "View Profile" },
                { icon: Settings, label: "Settings" },
              ].map(({ icon: Icon, label }) => (
                <button key={label} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  <Icon className="w-4 h-4 text-slate-400" />
                  {label}
                </button>
              ))}
              <div className="border-t border-slate-100 mt-1">
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
