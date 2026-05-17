import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldAlert, Camera, MapPin,
  User, CheckCircle, XCircle,
  Search, Filter, ExternalLink,
  Brain, Fingerprint, History,
  AlertTriangle, MoreVertical,
  Trash2, ChevronRight
} from 'lucide-react';
import API from '../../config';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedReport, setSelectedReport] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/reports`);
      setReports(data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this post? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/api/reports/${id}`);
      setReports((prev) => prev.filter((r) => r._id !== id));
      if (selectedReport?._id === id) setSelectedReport(null);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete post.');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/api/reports/${id}`, { status });
      fetchReports();
      setSelectedReport(null);
    } catch (err) {
      console.error('Failed to update report:', err);
    }
  };

  const runQualityCheck = async (reportId) => {
    setAnalyzing(true);
    // Mocking an AI / System quality check
    setTimeout(() => {
      setAnalyzing(false);
      // In a real app, this would update the report with a reliability score
    }, 2000);
  };

  const filteredReports = reports.filter(r => filter === 'all' || r.status === filter);

  const getPriorityColor = (p) => {
    switch (p?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-100';
      case 'high':     return 'text-orange-600 bg-orange-50 border-orange-100';
      case 'medium':   return 'text-amber-600 bg-amber-50 border-amber-100';
      default:         return 'text-blue-600 bg-blue-50 border-blue-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Resident Incident Reports</h2>
          <p className="text-sm text-slate-500 font-medium">Verify and manage crowd-sourced waste collection reports</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            {['all', 'pending', 'resolved', 'dismissed'].map(f => (
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reports List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="h-64 flex items-center justify-center bg-white rounded-[32px] border border-slate-100">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="bg-white rounded-[32px] p-12 text-center border border-slate-100">
              <ShieldAlert className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">No reports in this category</p>
            </div>
          ) : (
            filteredReports.map(report => (
              <div 
                key={report._id}
                onClick={() => setSelectedReport(report)}
                className={`p-5 bg-white rounded-[28px] border-2 transition-all cursor-pointer group ${
                  selectedReport?._id === report._id ? 'border-emerald-500 shadow-xl shadow-emerald-500/10' : 'border-transparent hover:border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-5">
                  <div className="w-20 h-20 bg-slate-100 rounded-2xl overflow-hidden shrink-0 border border-slate-100">
                    {report.reportImage ? (
                      <img src={report.reportImage} alt="Report" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getPriorityColor(report.priority)}`}>
                        {report.priority}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(report._id); }}
                          className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete post"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">{report.title}</h4>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold truncate">{report.barangay}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold truncate">{report.reportedBy}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Verification Tools Panel */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-2xl sticky top-24">
            {!selectedReport ? (
              <div className="py-12 text-center opacity-40">
                <ShieldAlert className="w-12 h-12 mx-auto mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">Select a report to verify</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold mb-1">Verification Tools</h3>
                  <p className="text-xs text-slate-400 font-medium italic">Advanced diagnostics to confirm authenticity</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => runQualityCheck(selectedReport._id)}
                    disabled={analyzing}
                    className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                        <Brain className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold">AI Image Scanner</p>
                        <p className="text-[10px] text-slate-500">Check for visual authenticity</p>
                      </div>
                    </div>
                    {analyzing ? <RefreshCcw className="w-4 h-4 text-emerald-400 animate-spin" /> : <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />}
                  </button>

                  <button className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                        <Fingerprint className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold">Metadata Audit</p>
                        <p className="text-[10px] text-slate-500">Verify GPS & Timestamp</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
                  </button>

                  <button className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                        <History className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold">User History</p>
                        <p className="text-[10px] text-slate-500">Reputation: 98% Trusted</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
                  </button>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    <span>Decide Action</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => updateStatus(selectedReport._id, 'resolved')}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold text-sm transition-all active:scale-95"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => updateStatus(selectedReport._id, 'dismissed')}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-xl font-bold text-sm border border-red-600/30 transition-all active:scale-95"
                    >
                      <XCircle className="w-4 h-4" />
                      Dismiss
                    </button>
                  </div>
                  <button
                    onClick={() => handleDelete(selectedReport._id)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-700/20 text-red-400 hover:bg-red-700/30 border border-red-700/30 rounded-xl font-bold text-sm transition-all active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Post Permanently
                  </button>
                </div>

                {/* Analysis Result (Mock) */}
                {analyzing === false && selectedReport && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <AlertTriangle className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Analysis Result</p>
                      <p className="text-xs font-medium text-slate-300">This report is <span className="text-emerald-400 font-bold">92% likely to be accurate</span> based on proximity to active sensors and user history.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const RefreshCcw = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
);
