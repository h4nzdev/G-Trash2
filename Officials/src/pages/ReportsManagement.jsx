import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, MapPin, Clock, User, CheckCircle, AlertTriangle, FileText, Camera, RefreshCw } from 'lucide-react';
import ReportCard from '../components/reports/ReportCard';
import ReportFilter from '../components/reports/ReportFilter';
import Badge from '../components/shared/Badge';
import API from '../config';

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
      setReportList(data.map((r) => ({ ...r, id: r._id, time: timeAgo(r.createdAt) })));
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
  });

  const counts = {
    all: reportList.length,
    pending: reportList.filter((r) => r.status === 'pending').length,
    inProgress: reportList.filter((r) => r.status === 'in-progress').length,
    resolved: reportList.filter((r) => r.status === 'resolved').length,
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
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Reports', value: counts.all, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
          { label: 'Pending', value: counts.pending, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { label: 'In Progress', value: counts.inProgress, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Resolved', value: counts.resolved, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
                </div>
                <h2 className="text-base font-bold text-slate-900 leading-snug">{selectedReport.title}</h2>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Image Placeholder */}
              <div className="w-full h-40 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200">
                <div className="text-center">
                  <Camera className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">No images attached</p>
                </div>
              </div>

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

              {/* Action Timeline */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Activity Timeline</p>
                <div className="space-y-3">
                  {[
                    { icon: AlertTriangle, label: 'Report Submitted', time: selectedReport.time, color: 'text-amber-600 bg-amber-100' },
                    ...(selectedReport.status !== 'pending' ? [{ icon: CheckCircle, label: 'Assigned to Response Team', time: '5 mins ago', color: 'text-blue-600 bg-blue-100' }] : []),
                    ...(selectedReport.status === 'resolved' ? [{ icon: CheckCircle, label: 'Issue Resolved', time: '1 hour ago', color: 'text-emerald-600 bg-emerald-100' }] : []),
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${item.color}`}>
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-400">{item.time}</p>
                      </div>
                    </div>
                  ))}
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
