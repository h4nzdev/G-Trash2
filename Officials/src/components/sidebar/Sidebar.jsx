import { NavLink, useLocation } from "react-router-dom";
import {
  Leaf,
  LayoutDashboard,
  Truck,
  Trophy,
  FileWarning,
  MapPin,
  History,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  Route,
  CalendarDays,
  ChevronDown,
  Activity,
  Shield,
  Gift,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

const CHD_ALLOWED_PATHS = ['/dashboard', '/heatmap', '/reports', '/history'];

const navGroups = [
  {
    label: "Overview",
    items: [
      { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    ]
  },
  {
    label: "Operations",
    items: [
      { path: "/routes", icon: Activity, label: "Route Monitoring" },
      { path: "/fleet", icon: Truck, label: "Fleet Management" },
      { path: "/route-builder", icon: Route, label: "Route Builder" },
      { path: "/route-manager", icon: Shield, label: "Route Manager" },
      { path: "/schedule", icon: CalendarDays, label: "Schedule Routes" },
    ]
  },
  {
    label: "Analytics",
    items: [
      { path: "/barangays", icon: Trophy, label: "Barangay Rankings" },
      { path: "/reports", icon: FileWarning, label: "Reports", chdLabel: "Reports (View Only)" },
      { path: "/heatmap", icon: MapPin, label: "Heatmap Analytics" },
      { path: "/history", icon: History, label: "Collection History" },
      { path: "/rewards", icon: Gift, label: "Rewards" },
    ]
  },
  {
    label: "System",
    items: [
      { path: "/settings", icon: Settings, label: "Settings" },
    ]
  }
];

export default function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { official, logout } = useAuth();
  const isChd = official?.role === 'chd';

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState({
    Overview: true,
    Operations: true,
    Analytics: true,
    System: true
  });

  const toggleGroup = (label) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Original Emerald Logo Section */}
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

      {/* Grouped Navigation with Original Colors */}
      <nav className="flex-1 px-3 mt-4 space-y-4 overflow-y-auto pb-8 scrollbar-hide">
        {navGroups
          .map(group => ({
            ...group,
            items: isChd
              ? group.items.filter(item => CHD_ALLOWED_PATHS.includes(item.path))
              : group.items,
          }))
          .filter(group => group.items.length > 0)
          .map((group) => (
          <div key={group.label} className="space-y-0.5">
            <button
              onClick={() => toggleGroup(group.label)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
            >
              {group.label}
              <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${expandedGroups[group.label] ? '' : '-rotate-90'}`} />
            </button>

            <div className={`space-y-0.5 overflow-hidden transition-all duration-300 ${expandedGroups[group.label] ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
              {group.items.map(({ path, icon: Icon, label, chdLabel }) => {
                const isActive = location.pathname === path;
                const displayLabel = isChd && chdLabel ? chdLabel : label;
                return (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                      isActive
                        ? "bg-emerald-800 text-emerald-100 font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon
                      className={`w-4.5 h-4.5 flex-shrink-0 transition-colors ${
                        isActive
                          ? "text-emerald-100"
                          : "text-slate-400 group-hover:text-slate-600"
                      }`}
                      size={18}
                    />
                    <span className="text-sm">{displayLabel}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System Status (Original) */}
      <div className="px-6 py-3 mx-3 mb-3 bg-emerald-50 rounded-xl border border-emerald-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-emerald-700">
            System Online
          </span>
        </div>
        <p className="text-[11px] text-emerald-600">
          All sensors operational
        </p>
      </div>

      {/* User Profile (Original style) */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-700 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {official?.name || "Official"}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {official?.role === "chd"
                ? "City Health Dept."
                : official?.barangay === "All"
                ? "Super Admin"
                : `Brgy. ${official?.barangay}`}
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
        className="fixed top-4 left-4 z-[1100] md:hidden p-2 bg-white rounded-lg shadow-md border border-slate-200"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[1055] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop fixed, mobile slide */}
      <aside
        className={`fixed left-0 top-0 h-screen w-[280px] bg-white border-r border-slate-200 flex flex-col z-[1060] transition-transform duration-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
