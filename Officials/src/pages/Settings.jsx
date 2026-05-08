import { useState } from 'react';
import { User, Bell, Globe, Lock, Sliders, Camera, Edit2, Save, ChevronRight } from 'lucide-react';

const sections = [
  { id: 'profile', icon: User, label: 'Profile' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
  { id: 'language', icon: Globe, label: 'Language & Region' },
  { id: 'security', icon: Lock, label: 'Security' },
  { id: 'system', icon: Sliders, label: 'System Preferences' },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState('profile');
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: 'Engr. Manuel Santos',
    email: 'manuel.santos@cebucity.gov.ph',
    role: 'Waste Management Officer',
    department: 'City Environment & Natural Resources Office',
    phone: '+63 912 345 6789',
  });
  const [notifs, setNotifs] = useState({
    critical: true, moderate: true, truckAlerts: true,
    reports: true, weekly: false, email: true, sms: false,
  });
  const [language, setLanguage] = useState('English');
  const [showPwForm, setShowPwForm] = useState(false);
  const [sysPrefs, setSysPrefs] = useState({
    autoRefresh: true, darkMode: false, compactView: false, showAnimations: true,
  });

  return (
    <div className="p-6">
      <div className="flex gap-6">
        {/* Settings Sidebar */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {sections.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm text-left transition-colors border-l-[3px] ${
                  activeSection === id
                    ? 'bg-emerald-50 text-emerald-800 font-semibold border-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50 border-transparent hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${activeSection === id ? 'text-emerald-700' : 'text-slate-400'}`} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 min-w-0">
          {/* Profile */}
          {activeSection === 'profile' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Profile Information</h2>
                <button
                  onClick={() => setEditing(!editing)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                    editing
                      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {editing ? <><Save className="w-4 h-4" /> Save Changes</> : <><Edit2 className="w-4 h-4" /> Edit Profile</>}
                </button>
              </div>

              {/* Avatar */}
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-800 to-emerald-500 rounded-2xl flex items-center justify-center">
                    <User className="w-10 h-10 text-white" />
                  </div>
                  {editing && (
                    <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-700 rounded-full flex items-center justify-center border-2 border-white hover:bg-emerald-800 transition-colors">
                      <Camera className="w-3.5 h-3.5 text-white" />
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{profile.name}</p>
                  <p className="text-sm text-slate-500">{profile.role}</p>
                  <span className="inline-flex items-center mt-1 px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
                    Government Official
                  </span>
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Full Name', key: 'name' },
                  { label: 'Email Address', key: 'email' },
                  { label: 'Role / Title', key: 'role' },
                  { label: 'Department', key: 'department' },
                  { label: 'Phone Number', key: 'phone' },
                ].map(({ label, key }) => (
                  <div key={key} className={key === 'department' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
                    {editing ? (
                      <input
                        type="text"
                        value={profile[key]}
                        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                      />
                    ) : (
                      <p className="text-sm text-slate-800 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">{profile[key]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-900">Notification Preferences</h2>
              <p className="text-sm text-slate-500">Choose what alerts and updates you receive.</p>

              {[
                { key: 'critical', label: 'Critical Alerts', desc: 'Immediate notification for high-priority pollution events' },
                { key: 'moderate', label: 'Moderate Alerts', desc: 'Notify when zone pollution reaches moderate levels' },
                { key: 'truckAlerts', label: 'Truck Delays', desc: 'Alert when garbage trucks are delayed or stopped' },
                { key: 'reports', label: 'New Reports', desc: 'Notify when residents submit new waste reports' },
                { key: 'weekly', label: 'Weekly Summary', desc: 'Receive a weekly summary of collection performance' },
                { key: 'email', label: 'Email Notifications', desc: 'Send notifications to your registered email address' },
                { key: 'sms', label: 'SMS Alerts', desc: 'Receive text message alerts for critical events' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifs({ ...notifs, [key]: !notifs[key] })}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${notifs[key] ? 'bg-emerald-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                      style={{ transform: notifs[key] ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Language */}
          {activeSection === 'language' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-900">Language & Region</h2>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Interface Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                >
                  {['English', 'Filipino', 'Cebuano'].map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Timezone</label>
                <select className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900">
                  <option>Asia/Manila (UTC+8)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date Format</label>
                <select className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900">
                  <option>MM/DD/YYYY</option>
                  <option>DD/MM/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          )}

          {/* Security */}
          {activeSection === 'security' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-900">Security Settings</h2>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-3">
                <Lock className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Password last changed</p>
                  <p className="text-xs text-emerald-600">30 days ago — recommend changing every 90 days</p>
                </div>
              </div>

              <button
                onClick={() => setShowPwForm(!showPwForm)}
                className="flex items-center justify-between w-full p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <span className="text-sm font-semibold text-slate-900">Change Password</span>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showPwForm ? 'rotate-90' : ''}`} />
              </button>

              {showPwForm && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  {['Current Password', 'New Password', 'Confirm New Password'].map((label) => (
                    <div key={label}>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ))}
                  <button className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-800 to-emerald-700 rounded-xl hover:from-emerald-900 hover:to-emerald-800 transition-colors mt-2">
                    Update Password
                  </button>
                </div>
              )}
            </div>
          )}

          {/* System Preferences */}
          {activeSection === 'system' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-900">System Preferences</h2>
              <p className="text-sm text-slate-500">Customize how the dashboard behaves and appears.</p>

              {[
                { key: 'autoRefresh', label: 'Auto Refresh Data', desc: 'Automatically refresh dashboard data every 30 seconds' },
                { key: 'darkMode', label: 'Dark Mode', desc: 'Use a dark color scheme for the interface (coming soon)' },
                { key: 'compactView', label: 'Compact View', desc: 'Reduce spacing to fit more data on screen' },
                { key: 'showAnimations', label: 'Show Animations', desc: 'Enable transition and loading animations' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => setSysPrefs({ ...sysPrefs, [key]: !sysPrefs[key] })}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${sysPrefs[key] ? 'bg-emerald-600' : 'bg-slate-300'}`}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                      style={{ transform: sysPrefs[key] ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
