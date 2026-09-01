import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, ChevronDown, User, Settings, LogOut, Radio, Wind, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import API from '../../config';

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

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TopBar() {
  const location = useLocation();
  const { official, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  const title = pageTitles[location.pathname] || 'Dashboard';
  const subtitle = location.pathname === '/dashboard' && official?.barangay && official.barangay !== 'All' && official?.role !== 'superadmin'
    ? `Monitor waste collection for Barangay ${official.barangay}`
    : (subTitles[location.pathname] || '');

  // Fetch existing IoT alerts on mount + listen for new ones
  useEffect(() => {
    // Load existing alerts
    fetch(`${API}/api/iot/alerts?limit=20`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const notifs = data.map(a => ({
            id: a._id,
            msg: a.message,
            time: a.createdAt,
            severity: a.severity,
            location: a.location,
            barangay: a.barangay,
            sensorId: a.sensorId,
            acknowledged: a.acknowledged,
            type: 'iot',
          }));
          setNotifications(notifs);
          setUnreadCount(notifs.filter(n => !n.acknowledged).length);
        }
      })
      .catch(() => {});

    // Real-time listener
    const socket = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('iot:alert', (alert) => {
      const notif = {
        id: alert._id,
        msg: alert.message,
        time: alert.createdAt,
        severity: alert.severity,
        location: alert.location,
        barangay: alert.barangay,
        sensorId: alert.sensorId,
        acknowledged: false,
        type: 'iot',
      };
      setNotifications(prev => [notif, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
    });

    socket.on('report:new', (report) => {
      if (report.reportedBy?.startsWith('IoT Sensor')) {
        const notif = {
          id: report._id,
          msg: report.title,
          time: report.createdAt,
          severity: report.priority === 'Critical' ? 'critical' : 'moderate',
          location: report.location,
          barangay: report.barangay,
          acknowledged: false,
          type: 'report',
        };
        setNotifications(prev => [notif, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);
      }
    });

    return () => socket.disconnect();
  }, []);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, acknowledged: true })));
    setUnreadCount(0);
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-[1050]">
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
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold px-1 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{unreadCount} new</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={markAllRead} className="text-[11px] text-emerald-600 font-semibold hover:underline flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Mark read
                  </button>
                  <button onClick={clearAll} className="text-[11px] text-slate-400 font-semibold hover:text-red-500 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No notifications yet</p>
                    <p className="text-xs text-slate-300 mt-1">IoT alerts will appear here</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const dotColor = n.severity === 'critical' ? 'bg-red-500' : n.severity === 'moderate' ? 'bg-amber-500' : 'bg-blue-500';
                    const IconComp = n.type === 'iot' ? Wind : n.type === 'report' ? AlertTriangle : Radio;
                    return (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 transition-colors ${!n.acknowledged ? 'bg-emerald-50/30' : ''}`}
                      >
                        <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${n.severity === 'critical' ? 'bg-red-100' : 'bg-amber-100'}`}>
                          <IconComp className={`w-3.5 h-3.5 ${n.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug ${!n.acknowledged ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>
                            {n.msg}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {n.location && (
                              <span className="text-[10px] text-slate-400 truncate">📍 {n.location}</span>
                            )}
                            <span className="text-[10px] text-slate-400">{timeAgo(n.time)}</span>
                          </div>
                        </div>
                        {!n.acknowledged && <span className={`mt-2 w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />}
                      </div>
                    );
                  })
                )}
              </div>
              {notifications.length > 0 && (
                <div className="p-3 text-center border-t border-slate-100 bg-slate-50/50">
                  <span className="text-xs text-slate-500">
                    Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''} from IoT sensors
                  </span>
                </div>
              )}
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
            <span className="text-sm font-semibold text-slate-800 hidden sm:block">{official?.name || 'Official'}</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-12 w-52 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">{official?.name || 'Official'}</p>
                <p className="text-xs text-slate-500">{official?.barangay || 'Waste Management'}</p>
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
                <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
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
