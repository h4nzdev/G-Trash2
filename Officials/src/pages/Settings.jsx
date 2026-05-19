import { useState, useRef, useEffect, useCallback } from 'react';
import { User, Bell, Globe, Lock, Sliders, Camera, Edit2, Save, ChevronRight, PenLine, Trash2, CheckCircle, Users, Plus, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API from '../config';

const sections = [
  { id: 'profile', icon: User, label: 'Profile' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
  { id: 'language', icon: Globe, label: 'Language & Region' },
  { id: 'security', icon: Lock, label: 'Security' },
  { id: 'system', icon: Sliders, label: 'System Preferences' },
  { id: 'signature', icon: PenLine, label: 'E-Signature' },
];

function SignaturePad({ official }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);
  const [savedUrl, setSavedUrl] = useState(official?.signatureUrl || null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawn(true);
  }, []);

  const stopDraw = () => { isDrawing.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!hasDrawn) return;
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const { data: uploadData } = await axios.post(`${API}/api/upload`, { data: dataUrl });
      await axios.patch(`${API}/api/officials/signature`, { signatureUrl: uploadData.url });
      setSavedUrl(uploadData.url);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Failed to save signature. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-900">E-Signature</h2>
        <p className="text-sm text-slate-500 mt-1">
          Draw your signature below. It will appear on certificates you issue to residents.
        </p>
      </div>

      {/* Saved signature preview */}
      {savedUrl && (
        <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Current Saved Signature</p>
          <img src={savedUrl} alt="Saved signature" className="max-h-20 object-contain" />
        </div>
      )}

      {/* Canvas pad */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          {savedUrl ? 'Draw New Signature' : 'Draw Your Signature'}
        </p>
        <div className="relative border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-slate-50 cursor-crosshair">
          <canvas
            ref={canvasRef}
            width={560}
            height={180}
            className="w-full touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          {!hasDrawn && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-300 pointer-events-none select-none">
              Sign here
            </p>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">Use your mouse or trackpad to draw your signature</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={clearCanvas}
          disabled={!hasDrawn}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" /> Clear
        </button>
        <button
          onClick={saveSignature}
          disabled={!hasDrawn || saving}
          className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-40"
        >
          {saving ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle className="w-4 h-4" /> Saved!</>
          ) : (
            <><Save className="w-4 h-4" /> Save Signature</>
          )}
        </button>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <p className="font-semibold mb-1">How it works</p>
        <p className="text-xs leading-5">
          Your saved e-signature will automatically appear on any <strong>Certificate</strong> reward you issue to residents.
          The resident will see it on the certificate in their G-TRASH app.
        </p>
      </div>
    </div>
  );
}

const ROLE_LABELS = { official: 'Official', superadmin: 'Super Admin', chd: 'City Health Dept.' };
const ROLE_COLORS = { official: 'bg-emerald-100 text-emerald-700', superadmin: 'bg-violet-100 text-violet-700', chd: 'bg-red-100 text-red-700' };

function OfficialsManager() {
  const [officials, setOfficials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', barangay: '', role: 'official' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchOfficials = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/officials`);
      setOfficials(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOfficials(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await axios.post(`${API}/api/officials`, form);
      setShowForm(false);
      setForm({ name: '', email: '', password: '', barangay: '', role: 'official' });
      fetchOfficials();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create official');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (id, role) => {
    try {
      await axios.patch(`${API}/api/officials/${id}/role`, { role });
      setOfficials(prev => prev.map(o => o._id === id ? { ...o, role } : o));
    } catch {
      /* silent */
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Officials Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Create and manage official accounts including CHD users</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${showForm ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-700 text-white hover:bg-emerald-800'}`}
        >
          {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> New Official</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Create New Official Account</h3>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Full Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Dr. Maria Santos" className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="chd@cebucity.gov.ph" className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required placeholder="••••••••" className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Barangay / Area</label>
              <input value={form.barangay} onChange={e => setForm(f => ({ ...f, barangay: e.target.value }))} placeholder="All (for CHD) or Lahug" className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="official">Official (LGU / Barangay)</option>
                <option value="chd">City Health Department (CHD)</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white text-sm font-bold rounded-xl hover:bg-emerald-800 disabled:opacity-50 transition-colors">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Create Account
          </button>
        </form>
      )}

      {loading ? (
        <div className="py-8 text-center">
          <div className="w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="space-y-2">
          {officials.map(o => (
            <div key={o._id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {o.name?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{o.name}</p>
                <p className="text-xs text-slate-500 truncate">{o.email} · {o.barangay === 'All' ? 'All Barangays' : `Brgy. ${o.barangay}`}</p>
              </div>
              <select
                value={o.role}
                onChange={e => handleRoleChange(o._id, e.target.value)}
                className={`text-xs font-bold px-2 py-1 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${ROLE_COLORS[o.role] || 'bg-slate-100 text-slate-600'}`}
              >
                <option value="official">Official</option>
                <option value="chd">CHD</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { official } = useAuth();
  const isSuperAdmin = official?.role === 'superadmin';
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
            {[...sections, ...(isSuperAdmin ? [{ id: 'officials', icon: Users, label: 'Manage Officials' }] : [])].map(({ id, icon: Icon, label }) => (
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

          {/* E-Signature */}
          {activeSection === 'signature' && <SignaturePad official={official} />}

          {/* Officials Management — superadmin only */}
          {activeSection === 'officials' && <OfficialsManager />}

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
