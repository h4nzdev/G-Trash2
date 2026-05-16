import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, MapPin, Clock, User, CheckCircle, AlertTriangle, FileText, Camera, RefreshCw, ShieldAlert, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReportCard from '../components/reports/ReportCard';
import ReportFilter from '../components/reports/ReportFilter';
import Badge from '../components/shared/Badge';
import API from '../config';

function slaHoursLeft(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline) - Date.now()) / 3600000);
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

export default function ReportsManagement() {
  const [filters, setFilters] = useState({
    search: '',
    status: 'All',
    barangay: 'All Barangays',
    priority: 'All Priorities',
    sortBy: 'Newest',
  });
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportList, setReportList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${API}/api/reports`);
      setReportList(data.map((r) => ({ 
        ...r, 
        id: r._id, 
        time: timeAgo(r.createdAt),
        urgency: (r.upvotes?.length || 0) - (r.downvotes?.length || 0)
      })));
    } catch (err) {
      setError('Could not load reports. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleResolve = async (report) => {
    try {
      await axios.patch(`${API}/api/reports/${report._id}`, { status: 'resolved' });
      setReportList((prev) => prev.map((r) => r._id === report._id ? { ...r, status: 'resolved' } : r));
      setSelectedReport(null);
    } catch { /* silent */ }
  };

  const handleAssign = async (report) => {
    try {
      await axios.patch(`${API}/api/reports/${report._id}`, { status: 'in-progress' });
      setReportList((prev) => prev.map((r) => r._id === report._id ? { ...r, status: 'in-progress' } : r));
    } catch { /* silent */ }
  };

  const filtered = reportList.filter((r) => {
    const statusMatch = filters.status === 'All' ||
      (filters.status === 'In Progress' ? r.status === 'in-progress' : r.status === filters.status.toLowerCase());
    const barangayMatch = filters.barangay === 'All Barangays' || r.barangay === filters.barangay;
    const priorityMatch = filters.priority === 'All Priorities' || r.priority === filters.priority;
    const searchMatch = !filters.search ||
      r.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      r.location.toLowerCase().includes(filters.search.toLowerCase());
    return statusMatch && barangayMatch && priorityMatch && searchMatch;
  }).sort((a, b) => {
    if (filters.sortBy === 'Highest Urgency') return b.urgency - a.urgency;
    if (filters.sortBy === 'Oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    return new Date(b.createdAt) - new Date(a.createdAt); // Newest
  });

  const counts = {
    all: reportList.length,
    pending: reportList.filter((r) => r.status === 'pending').length,
    inProgress: reportList.filter((r) => r.status === 'in-progress').length,
    resolved: reportList.filter((r) => r.status === 'resolved').length,
    escalated: reportList.filter((r) => r.escalated).length,
  };

  return (
    <div className="p-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-slate-800">Reports Management</h1>
        <button
          onClick={fetchReports}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Summary Bar */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Reports', value: counts.all, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
          { label: 'Pending', value: counts.pending, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { label: 'In Progress', value: counts.inProgress, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Resolved', value: counts.resolved, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Escalated', value: counts.escalated, color: 'text-red-700', bg: counts.escalated > 0 ? 'bg-red-50 border-red-300 ring-1 ring-red-100' : 'bg-slate-50 border-slate-200' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <ReportFilter filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-20 text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading reports...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-20 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">
            {reportList.length === 0 ? 'No reports submitted yet' : 'No reports match your filters'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {reportList.length === 0 ? 'Reports from residents will appear here' : 'Try adjusting the filter criteria above'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((report) => (
            <ReportCard
              key={report._id}
              report={report}
              onView={setSelectedReport}
              onAssign={handleAssign}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={selectedReport.status} showDot size="xs">
                    {selectedReport.status === 'in-progress' ? 'In Progress' : selectedReport.status.charAt(0).toUpperCase() + selectedReport.status.slice(1)}
                  </Badge>
                  <Badge variant={selectedReport.priority.toLowerCase()} size="xs">
                    {selectedReport.priority}
                  </Badge>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedReport.urgency > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    {selectedReport.urgency} Urgency Score
                  </div>
                </div>
                <h2 className="text-base font-bold text-slate-900 leading-snug">{selectedReport.title}</h2>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Image Display */}
              {selectedReport.reportImage ? (
                <div className="w-full overflow-hidden rounded-xl border border-slate-100">
                  <img src={selectedReport.reportImage} alt="Report" className="w-full h-auto object-cover max-h-60" />
                </div>
              ) : (
                <div className="w-full h-40 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200">
                  <div className="text-center">
                    <Camera className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                    <p className="text-xs text-slate-400">No images attached</p>
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{selectedReport.location}, Barangay {selectedReport.barangay}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>Reported by {selectedReport.reportedBy}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{selectedReport.time}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed">{selectedReport.description}</p>
              </div>

              {/* SLA / Escalation indicator */}
              {selectedReport.escalated ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                  <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-xs font-bold text-red-700">ESCALATED — No action within 72h. Barangay lost 10 points.</p>
                </div>
              ) : selectedReport.status === 'pending' && selectedReport.deadline ? (
                (() => {
                  const h = slaHoursLeft(selectedReport.deadline);
                  return h !== null && h > 0 ? (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${h < 12 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                      <Clock className={`w-4 h-4 flex-shrink-0 ${h < 12 ? 'text-red-600' : 'text-amber-600'}`} />
                      <p className={`text-xs font-bold ${h < 12 ? 'text-red-700' : 'text-amber-700'}`}>
                        {h}h left to respond — failure deducts 10 points from {selectedReport.barangay}
                      </p>
                    </div>
                  ) : null;
                })()
              ) : null}

              {/* Resident Verification Status */}
              {selectedReport.resolutionConfirmed && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                  selectedReport.resolutionConfirmed === 'confirmed' ? 'bg-emerald-50 border-emerald-200' :
                  selectedReport.resolutionConfirmed === 'disputed'  ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  {selectedReport.resolutionConfirmed === 'confirmed'
                    ? <><ThumbsUp className="w-4 h-4 text-emerald-600" /><p className="text-xs font-bold text-emerald-700">Resident confirmed fixed — Barangay awarded +20 points</p></>
                    : selectedReport.resolutionConfirmed === 'disputed'
                    ? <><ThumbsDown className="w-4 h-4 text-red-600" /><p className="text-xs font-bold text-red-700">Resident says issue persists — Report reopened, -15 points</p></>
                    : <><Clock className="w-4 h-4 text-blue-600" /><p className="text-xs font-bold text-blue-700">Awaiting resident confirmation of resolution</p></>
                  }
                </div>
              )}

              {/* Activity Timeline from statusHistory */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Activity Timeline</p>
                <div className="space-y-3">
                  {(selectedReport.statusHistory?.length > 0 ? selectedReport.statusHistory : [{ status: 'pending', changedBy: selectedReport.reportedBy, changedAt: selectedReport.createdAt }])
                    .map((entry, i) => {
                      const statusMeta = {
                        pending:     { icon: AlertTriangle, color: 'text-amber-600 bg-amber-100',  label: 'Report Submitted' },
                        'in-progress': { icon: Clock,       color: 'text-blue-600 bg-blue-100',    label: 'Taken In Progress' },
                        resolved:    { icon: CheckCircle,   color: 'text-emerald-600 bg-emerald-100', label: 'Marked Resolved' },
                        escalated:   { icon: ShieldAlert,   color: 'text-red-600 bg-red-100',      label: 'Auto-Escalated' },
                        confirmed:   { icon: CheckCircle,   color: 'text-emerald-600 bg-emerald-100', label: 'Confirmed by Resident' },
                        disputed:    { icon: AlertTriangle, color: 'text-red-600 bg-red-100',      label: 'Disputed by Resident' },
                        reopened:    { icon: AlertTriangle, color: 'text-orange-600 bg-orange-100', label: 'Reopened' },
                      };
                      const meta = statusMeta[entry.status] || statusMeta.pending;
                      const Icon = meta.icon;
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{meta.label}</p>
                            <p className="text-xs text-slate-400">
                              {entry.changedBy && <span className="font-semibold">{entry.changedBy} · </span>}
                              {entry.changedAt ? new Date(entry.changedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Assign Dropdown */}
              {selectedReport.status !== 'resolved' && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assign to Collector</p>
                  <select className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700">
                    <option>Select a truck / team</option>
                    <option>GT-401 — Juan Dela Cruz</option>
                    <option>GT-402 — Pedro Santos</option>
                    <option>GT-403 — Maria Reyes</option>
                    <option>GT-404 — Jose Bautista</option>
                  </select>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setSelectedReport(null)}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Close
              </button>
              {selectedReport.status !== 'resolved' && (
                <button
                  onClick={() => handleResolve(selectedReport)}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-900 hover:to-emerald-800 rounded-xl transition-colors"
                >
                  Mark as Resolved
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
