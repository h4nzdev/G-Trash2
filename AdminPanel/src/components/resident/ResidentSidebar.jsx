import { NavLink } from 'react-router-dom';
import { Map, FileText, Bell, Leaf, X } from 'lucide-react';

const navItems = [
  { to: '/resident/map', icon: Map, label: 'Route Map' },
  { to: '/resident/reports', icon: FileText, label: 'My Reports' },
  { to: '/resident/notifications', icon: Bell, label: 'Notifications' },
];

const residentProfile = {
  name: 'Jane Doe',
  barangay: 'Lahug',
  initials: 'JD',
};

export default function ResidentSidebar({ open, onToggle }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={onToggle} />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 flex flex-col
          w-64 bg-slate-900 shrink-0
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center shrink-0">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none tracking-tight">G-TRASH</p>
              <span className="inline-block mt-1 text-xs font-semibold bg-violet-600/25 text-violet-400 px-2 py-0.5 rounded-full">
                RESIDENT
              </span>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="lg:hidden p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest px-4 mb-3">Navigation</p>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all relative
                ${isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-violet-500 rounded-r-full" />
                  )}
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Profile */}
        <div className="px-3 pb-4 border-t border-slate-800 pt-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800">
            <div className="w-9 h-9 bg-violet-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
              {residentProfile.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{residentProfile.name}</p>
              <p className="text-slate-400 text-xs truncate">Resident · Brgy. {residentProfile.barangay}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
