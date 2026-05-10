import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, UserPlus, Shield, Mail, 
  MapPin, Key, Trash2, CheckCircle, 
  AlertCircle, X 
} from 'lucide-react';
import API from '../../config';

export default function Officials() {
  const [officials, setOfficials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    barangay: 'Lahug'
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchOfficials = async () => {
    try {
      const { data } = await axios.get(`${API}/api/admin/officials`);
      // Since we don't have a specific list endpoint yet, I'll filter them from a general list if possible
      // But for now, let's assume the backend has a way to list them or we just show the new ones
      setOfficials(data);
    } catch (err) {
      console.error('Failed to fetch officials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // For now, we'll just implement the creation part
    setLoading(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API}/api/admin/officials`, formData);
      setToast({ msg: 'Official created successfully!', type: 'success' });
      setShowAdd(false);
      setFormData({ username: '', password: '', name: '', barangay: 'Lahug' });
    } catch (err) {
      setToast({ msg: err.response?.data?.error || 'Failed to create official', type: 'error' });
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

      {/* Grid of existing officials (Mock data for demo) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { name: 'Hanz Christian', username: 'hanz_lahug', barangay: 'Lahug' },
          { name: 'Apas Leader', username: 'apas_official', barangay: 'Apas' },
          { name: 'Guadalupe Admin', username: 'guadalupe_1', barangay: 'Guadalupe' },
        ].map((off, i) => (
          <div key={i} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm group">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                <Shield className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-slate-900 truncate">{off.name}</h4>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <MapPin className="w-3 h-3 text-emerald-500" />
                  {off.barangay}
                </div>
              </div>
            </div>
            
            <div className="space-y-3 pt-4 border-t border-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <Key className="w-3 h-3" /> User
                </div>
                <span className="text-sm font-semibold text-slate-700">{off.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                   Status
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Active</span>
              </div>
            </div>
          </div>
        ))}
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
                <h3 className="text-xl font-bold text-slate-900">New Credentials</h3>
              </div>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
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
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Username</label>
                <input 
                  required
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  placeholder="lahug_admin"
                  className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Default Password</label>
                <input 
                  type="password"
                  required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Create Official Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
