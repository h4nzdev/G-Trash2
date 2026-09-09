import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, MapPin, ThumbsUp, Clock, CheckCircle2, ChevronRight, Eye, Loader2 } from 'lucide-react';
import axios from 'axios';
import API from '../../config';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getStatusBadge(status) {
  switch (status?.toLowerCase()) {
    case 'acknowledged':
      return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Acknowledged</span>;
    case 'in-progress':
    case 'in_progress':
      return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> In Progress</span>;
    case 'resolved':
      return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Resolved</span>;
    case 'pending':
    default:
      return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending</span>;
  }
}

export default function RecentReportsWidget({ reports = [], onReportUpdated }) {
  const navigate = useNavigate();
  const [updatingId, setUpdatingId] = useState(null);

  const handleAcknowledge = async (reportId) => {
    setUpdatingId(reportId);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('gtrash_token')}` };
      await axios.patch(`${API}/api/reports/${reportId}`, { status: 'acknowledged' }, { headers });
      if (onReportUpdated) onReportUpdated();
    } catch (err) {
      console.error('Failed to acknowledge report:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResolve = async (reportId) => {
    setUpdatingId(reportId);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('gtrash_token')}` };
      await axios.patch(`${API}/api/reports/${reportId}`, { status: 'resolved' }, { headers });
      if (onReportUpdated) onReportUpdated();
    } catch (err) {
      console.error('Failed to resolve report:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const activeReports = reports.slice(0, 5);
  const pendingCount = reports.filter(r => r.status === 'pending').length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-fit">
      {/* Widget Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Resident Waste Reports
              {pendingCount > 0 && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {pendingCount} Needs Action
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">Live community report feed & resolution status</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/reports')}
          className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1 transition-colors"
        >
          View All <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Widget Content */}
      {activeReports.length === 0 ? (
        <div className="min-h-[160px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
          <p className="text-sm font-bold text-slate-700">All clear!</p>
          <p className="text-xs text-slate-500 mt-0.5 text-center">No active resident reports requiring official action in your barangay.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeReports.map((report) => {
            const upvotesCount = report.upvotes?.length || report.urgency || 0;
            const isUpdating = updatingId === (report._id || report.id);
            const status = report.status?.toLowerCase() || 'pending';

            return (
              <div
                key={report._id || report.id}
                className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/60 transition-all group"
              >
                {/* Image thumbnail or placeholder icon */}
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-200">
                  {report.reportImage ? (
                    <img src={report.reportImage} alt={report.title} className="w-full h-full object-cover" />
                  ) : (
                    <FileText className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                {/* Main details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {report.category || 'General'}
                    </span>
                    {getStatusBadge(status)}
                  </div>

                  <h3 className="text-xs font-bold text-slate-800 leading-snug truncate">
                    {report.title || report.description}
                  </h3>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {report.sitio ? `Sitio ${report.sitio}` : (report.location || report.barangay || 'Barangay Area')}
                    </span>
                    {upvotesCount > 0 && (
                      <span className="flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        <ThumbsUp className="w-3 h-3" /> {upvotesCount}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" /> {timeAgo(report.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Quick Action Button */}
                <div className="flex flex-col items-end justify-between self-stretch flex-shrink-0">
                  {status === 'pending' ? (
                    <button
                      onClick={() => handleAcknowledge(report._id || report.id)}
                      disabled={isUpdating}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Acknowledge'}
                    </button>
                  ) : status === 'acknowledged' || status === 'in-progress' ? (
                    <button
                      onClick={() => handleResolve(report._id || report.id)}
                      disabled={isUpdating}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Mark Resolved'}
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/reports')}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" /> Details
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
