import { useState } from 'react';
import { User, Bell, Shield, Save, Check, Mail, Phone, MapPin, Building2, Key, Eye, EyeOff } from 'lucide-react';
import { officialProfile } from '../../data/mockData';

const tabs = [
  { id: 'profile',       icon: User,    label: 'Profile' },
  { id: 'notifications', icon: Bell,    label: 'Notifications' },
  { id: 'security',      icon: Shield,  label: 'Security' },
];

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-emerald-600' : 'bg-slate-200'}`}
  >
    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

const notificationSettings = [
  { id: 'pollutionAlert', label: 'Pollution alerts', description: 'Get notified when pollution exceeds threshold', group: 'Alerts' },
  { id: 'sensorOffline', label: 'Sensor offline', description: 'Alert when an IoT sensor goes offline', group: 'Alerts' },
  { id: 'collectionComplete', label: 'Collection complete', description: 'Notify when a route is finished', group: 'Collection' },
  { id: 'collectionDelayed', label: 'Collection delayed', description: 'Alert when a route is running late', group: 'Collection' },
  { id: 'newComplaint', label: 'New complaint', description: 'Alert for every new resident complaint', group: 'Reports' },
  { id: 'urgentComplaint', label: 'Urgent complaints only', description: 'Only receive alerts for urgent priority', group: 'Reports' },
  { id: 'weeklyReport', label: 'Weekly summary report', description: 'Receive weekly collection statistics', group: 'Reports' },
  { id: 'emailNotifs', label: 'Email notifications', description: 'Send alerts to your registered email', group: 'Channels' },
  { id: 'pushNotifs', label: 'Push notifications', description: 'Enable browser push notifications', group: 'Channels' },
];

export default function OfficialSettings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [profile, setProfile] = useState({
    name: officialProfile.name,
    email: officialProfile.email,
    phone: officialProfile.phone,
    barangay: officialProfile.barangay,
    position: officialProfile.position,
    city: officialProfile.city,
  });

  const [notifs, setNotifs] = useState({
    pollutionAlert: true,
    sensorOffline: true,
    collectionComplete: false,
    collectionDelayed: true,
    newComplaint: true,
    urgentComplaint: false,
    weeklyReport: true,
    emailNotifs: true,
    pushNotifs: false,
  });

  const [security, setSecurity] = useState({
    current: '', newPass: '', confirm: '',
    twoFactor: true,
    sessionTimeout: '30',
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const groups = [...new Set(notificationSettings.map(n => n.group))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your profile, notifications, and security preferences</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3.5 text-sm text-emerald-700 font-medium">
          <Check className="w-4 h-4" />
          Settings saved successfully!
        </div>
      )}

      <div className="flex gap-4">
        {/* Sidebar tabs */}
        <aside className="w-56 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm p-2 space-y-0.5">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all ${activeTab === id ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>

          {/* Profile card */}
          <div className="mt-4 bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
              {officialProfile.initials}
            </div>
            <p className="text-sm font-semibold text-slate-900">{profile.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{profile.position}</p>
            <p className="text-xs text-slate-400">Brgy. {profile.barangay}</p>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div>
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Personal Information</h2>
                <p className="text-xs text-slate-400 mt-0.5">Update your official profile details</p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { label: 'Full Name', key: 'name', icon: User, placeholder: 'Full name' },
                  { label: 'Email Address', key: 'email', icon: Mail, placeholder: 'Email', type: 'email' },
                  { label: 'Phone Number', key: 'phone', icon: Phone, placeholder: 'Phone number', type: 'tel' },
                  { label: 'Barangay', key: 'barangay', icon: MapPin, placeholder: 'Barangay' },
                  { label: 'Position / Title', key: 'position', icon: Building2, placeholder: 'Position' },
                  { label: 'City / Municipality', key: 'city', icon: MapPin, placeholder: 'City' },
                ].map(({ label, key, icon: Icon, placeholder, type = 'text' }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
                    <div className="relative">
                      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={type}
                        value={profile[key]}
                        onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div>
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Notification Preferences</h2>
                <p className="text-xs text-slate-400 mt-0.5">Choose what alerts and updates you receive</p>
              </div>
              <div className="p-6 space-y-6">
                {groups.map(group => (
                  <div key={group}>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{group}</h3>
                    <div className="space-y-3">
                      {notificationSettings.filter(n => n.group === group).map(setting => (
                        <div key={setting.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <div className="flex-1 mr-4">
                            <p className="text-sm font-medium text-slate-800">{setting.label}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{setting.description}</p>
                          </div>
                          <Toggle
                            checked={notifs[setting.id]}
                            onChange={v => setNotifs(n => ({ ...n, [setting.id]: v }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div>
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Security Settings</h2>
                <p className="text-xs text-slate-400 mt-0.5">Manage your password and authentication</p>
              </div>
              <div className="p-6 space-y-6">
                {/* Change Password */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Change Password</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Current Password', key: 'current', placeholder: '••••••••' },
                      { label: 'New Password', key: 'newPass', placeholder: '••••••••' },
                      { label: 'Confirm New Password', key: 'confirm', placeholder: '••••••••' },
                    ].map(({ label, key, placeholder }) => (
                      <div key={key}>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
                        <div className="relative">
                          <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type={showPass ? 'text' : 'password'}
                            value={security[key]}
                            onChange={e => setSecurity(s => ({ ...s, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                          />
                          <button
                            onClick={() => setShowPass(v => !v)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2FA + Session */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Authentication</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Two-Factor Authentication</p>
                        <p className="text-xs text-slate-400 mt-0.5">Add an extra layer of security to your account</p>
                      </div>
                      <Toggle checked={security.twoFactor} onChange={v => setSecurity(s => ({ ...s, twoFactor: v }))} />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Session Timeout</p>
                        <p className="text-xs text-slate-400 mt-0.5">Auto sign out after inactivity</p>
                      </div>
                      <select
                        value={security.sessionTimeout}
                        onChange={e => setSecurity(s => ({ ...s, sessionTimeout: e.target.value }))}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white outline-none focus:border-emerald-400 cursor-pointer"
                      >
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="120">2 hours</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
            <button className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
              Discard
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
