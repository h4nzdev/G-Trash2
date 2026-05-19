import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  UserPlus, Shield,
  MapPin, Key, CheckCircle,
  AlertCircle, X, MoreVertical,
  Edit, UserX, Trash2, UserCircle,
  Truck, Navigation, Clipboard, Contact, Filter
} from 'lucide-react';
import API from '../../config';

const DEPT_OPTIONS = [
  { value: 'barangay',    label: 'Barangay Official',               badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  { value: 'ccenro',      label: 'CCENRO (Environment)',            badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'dps',         label: 'DPS (Public Service)',            badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'lgu_general', label: 'LGU General Administration',      badge: 'bg-amber-100 text-amber-800 border-amber-200' },
];

function DeptBadge({ dept }) {
  const opt = DEPT_OPTIONS.find(o => o.value === dept) || DEPT_OPTIONS[0];
  const short = { barangay: 'BRGY', ccenro: 'CCENRO', dps: 'DPS', lgu_general: 'LGU' };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${opt.badge}`}>
      {short[dept] || dept?.toUpperCase()}
    </span>
  );
}

export default function Officials() {
  const navigate = useNavigate();
  const [officials, setOfficials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [deptFilter, setDeptFilter] = useState('all');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    barangay: 'Lahug',
    department: 'barangay',
    departmentPosition: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchOfficials = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/admin/officials`);
      setOfficials(data);
    } catch (err) {
      console.error('Failed to fetch officials:', err);
      setToast({ msg: 'Failed to load officials', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficials();
  }, []);

  const handleStatusToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'revoked' : 'active';
    try {
      await axios.patch(`${API}/api/admin/officials/${id}/status`, { status: newStatus });
      setToast({ msg: `Access ${newStatus === 'active' ? 'restored' : 'revoked'} successfully`, type: 'success' });
      fetchOfficials();
    } catch (err) {
      setToast({ msg: 'Failed to update status', type: 'error' });
    } finally {
      setActiveDropdown(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this official? This action cannot be undone.')) return;
    try {
      await axios.delete(`${API}/api/admin/officials/${id}`);
      setToast({ msg: 'Official deleted successfully', type: 'success' });
      fetchOfficials();
    } catch (err) {
      setToast({ msg: 'Failed to delete official', type: 'error' });
    } finally {
      setActiveDropdown(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleEdit = (off) => {
    setFormData({
      email: off.email,
      password: '',
      name: off.name,
      barangay: off.barangay,
      department: off.department || 'barangay',
      departmentPosition: off.departmentPosition || '',
    });
    setSelectedId(off._id);
    setIsEditing(true);
    setShowAdd(true);
    setActiveDropdown(null);
  };

  const handleViewProfile = (off) => {
    setActiveDropdown(null);
    navigate(`/admin/officials/${off._id}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEditing) {
        await axios.put(`${API}/api/admin/officials/${selectedId}`, formData);
        setToast({ msg: 'Official updated successfully!', type: 'success' });
        fetchOfficials();
      } else {
        await axios.post(`${API}/api/admin/officials`, formData);
        setToast({ msg: 'Official created successfully!', type: 'success' });
        fetchOfficials();
      }
      setShowAdd(false);
      setFormData({ email: '', password: '', name: '', barangay: 'Lahug', department: 'barangay', departmentPosition: '' });
      setIsEditing(false);
      setSelectedId(null);
    } catch (err) {
      setToast({ msg: err.response?.data?.error || 'Operation failed', type: 'error' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Official Management</h2>
          <p className="text-sm text-slate-500 font-medium">Create and manage credentials for barangay leaders</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all active:scale-[0.98]"
        >
          <UserPlus className="w-4 h-4" />
          Add New Official
        </button>
      </div>

      {toast && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="text-sm font-bold">{toast.msg}</p>
        </div>
      )}

      {/* Department Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        {[{ value: 'all', label: 'All Departments' }, ...DEPT_OPTIONS].map(opt => (
          <button
            key={opt.value}
            onClick={() => setDeptFilter(opt.value)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
              deptFilter === opt.value
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Officials Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest rounded-tl-2xl">Official</th>
              <th className="text-left px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Department</th>
              <th className="text-left px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Barangay</th>
              <th className="text-left px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
              <th className="text-left px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="text-right px-6 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest rounded-tr-2xl">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {officials
              .filter(o => deptFilter === 'all' || o.department === deptFilter || (!o.department && deptFilter === 'barangay'))
              .length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium">
                  {loading ? 'Loading officials...' : 'No officials found. Add your first official above.'}
                </td>
              </tr>
            ) : officials
              .filter(o => deptFilter === 'all' || o.department === deptFilter || (!o.department && deptFilter === 'barangay'))
              .map((off, i) => (
              <tr key={off._id} className={`hover:bg-slate-50 transition-colors ${activeDropdown === i ? 'relative z-50' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900 block">{off.name}</span>
                      {off.departmentPosition && <span className="text-xs text-slate-400">{off.departmentPosition}</span>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <DeptBadge dept={off.department || 'barangay'} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="font-medium">{off.barangay}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Key className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-sm font-medium">{off.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                    off.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {off.status || 'Active'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right relative">
                  <button 
                    onClick={() => setActiveDropdown(activeDropdown === i ? null : i)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeDropdown === i && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setActiveDropdown(null)}
                      />
                      <div className="absolute right-6 top-12 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 py-2 animate-in fade-in zoom-in-95 duration-150">
                        <button 
                          onClick={() => handleViewProfile(off)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <UserCircle className="w-4 h-4" />
                          View Profile
                        </button>
                        <button 
                          onClick={() => handleEdit(off)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Edit className="w-4 h-4 text-slate-400" />
                          Update Official
                        </button>
                        <button 
                          onClick={() => handleStatusToggle(off._id, off.status)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition-colors ${
                            off.status === 'active' ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                        >
                          <UserX className="w-4 h-4" />
                          {off.status === 'active' ? 'Revoke Access' : 'Restore Access'}
                        </button>
                        <div className="h-px bg-slate-100 my-1 mx-2" />
                        <button 
                          onClick={() => handleDelete(off._id)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{isEditing ? 'Update Credentials' : 'New Credentials'}</h3>
              </div>
              <button onClick={() => { setShowAdd(false); setIsEditing(false); }} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Barangay</label>
                  <select 
                    value={formData.barangay}
                    onChange={e => setFormData({...formData, barangay: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                  >
                    <option>Lahug</option>
                    <option>Apas</option>
                    <option>Guadalupe</option>
                    <option>Mabolo</option>
                    <option>Talamban</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="official@gtrash.com"
                  disabled={isEditing}
                  className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">{isEditing ? 'New Password (Optional)' : 'Default Password'}</label>
                <input
                  type="password"
                  required={!isEditing}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                  >
                    {DEPT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Position Title</label>
                  <input
                    value={formData.departmentPosition}
                    onChange={e => setFormData({...formData, departmentPosition: e.target.value})}
                    placeholder="e.g. Fleet Supervisor"
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                  />
                </div>
              </div>

              {formData.department && (
                <p className="text-xs text-slate-400 px-1">
                  {DEPT_OPTIONS.find(o => o.value === formData.department)?.label}
                  {formData.department === 'ccenro' && ' — Environmental monitoring & policy'}
                  {formData.department === 'dps' && ' — Waste collection & fleet operations'}
                  {formData.department === 'lgu_general' && ' — Overall waste management oversight'}
                  {formData.department === 'barangay' && ' — Local community waste management'}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (isEditing ? 'Update Account' : 'Create Official Account')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
