import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bug, AlertCircle, CheckCircle, 
  Clock, Filter, MessageSquare, 
  Monitor, Smartphone, ChevronRight,
  ShieldAlert, RefreshCcw
} from 'lucide-react';
import API from '../../config';

export default function BugReports() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updating, setUpdating] = useState(null);

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/bugs`);
      setBugs(data);
    } catch (err) {
      console.error('Failed to fetch bug reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
  }, []);

  const updateStatus = async (id, newStatus) => {
    setUpdating(id);
    try {
      await axios.patch(`${API}/api/bugs/${id}`, { status: newStatus });
      fetchBugs();
    } catch (err) {
      console.error('Failed to update bug status:', err);
    } finally {
      setUpdating(null);
    }
  };

  const filteredBugs = bugs.filter(bug => filter === 'all' || bug.status === filter);

  const getSeverityColor = (sev) => {
    switch (sev) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high':     return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':   return 'bg-amber-100 text-amber-700 border-amber-200';
      default:         return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'in-progress': return <RefreshCcw className="w-4 h-4 text-blue-500 animate-spin-slow" />;
      case 'closed':   return <Clock className="w-4 h-4 text-slate-400" />;
      default:         return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">System Bug Reports</h2>
          <p className="text-sm text-slate-500 font-medium">Monitor and resolve issues reported across all G-TRASH platforms</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          {['all', 'open', 'in-progress', 'resolved'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                filter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-sm font-bold text-slate-400">Analyzing bug database...</p>
          </div>
        ) : filteredBugs.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
              <Bug className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No bugs found</h3>
            <p className="text-slate-500 text-sm">System is currently running stable with no {filter !== 'all' ? filter : ''} reports.</p>
          </div>
        ) : (
          filteredBugs.map(bug => (
            <div key={bug._id} className="bg-white rounded-[28px] border border-slate-200 p-6 hover:shadow-xl hover:shadow-slate-200/40 transition-all group">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getSeverityColor(bug.severity)}`}>
                      {bug.severity}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                      {bug.platform === 'web' ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                      {bug.platform}
                    </span>
                    <div className="h-4 w-px bg-slate-100" />
                    <span className="text-slate-400 text-[11px] font-bold">
                      {new Date(bug.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-emerald-600 transition-colors">{bug.title}</h4>
                    <p className="text-slate-600 text-sm leading-relaxed">{bug.description}</p>
                  </div>

                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <Monitor className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 italic truncate max-w-[200px]">{bug.deviceInfo || 'System Default'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                    {getStatusIcon(bug.status)}
                    <span className="text-xs font-bold text-slate-700 capitalize">{bug.status}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {bug.status === 'open' && (
                      <button 
                        onClick={() => updateStatus(bug._id, 'in-progress')}
                        disabled={updating === bug._id}
                        className="px-4 py-2 bg-blue-600 text-white text-[11px] font-bold rounded-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                      >
                        Start Fix
                      </button>
                    )}
                    {(bug.status === 'open' || bug.status === 'in-progress') && (
                      <button 
                        onClick={() => updateStatus(bug._id, 'resolved')}
                        disabled={updating === bug._id}
                        className="px-4 py-2 bg-emerald-600 text-white text-[11px] font-bold rounded-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Developer Insights Card (Recomendation 1) */}
      <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
          <ShieldAlert className="w-32 h-32" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold">Developer Recommendation</h3>
          </div>
          <p className="text-slate-300 max-w-2xl leading-relaxed">
            Implement a <span className="text-white font-bold underline decoration-emerald-400 underline-offset-4">System Log Viewer</span>. This allows developers to see real-time error logs (500 errors) from the backend directly in this dashboard, significantly reducing time-to-fix for critical production bugs.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-widest border border-white/10">
              High Priority
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-white/10">
              Admin Tool
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
