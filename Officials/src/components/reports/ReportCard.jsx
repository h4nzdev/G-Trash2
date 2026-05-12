import { useState } from 'react';
import { MapPin, Clock, User, Eye, UserCheck, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import Badge from '../shared/Badge';

const priorityDot = { Critical: 'bg-red-500', High: 'bg-red-400', Medium: 'bg-amber-500', Low: 'bg-slate-400' };
const priorityBadge = { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' };

export default function ReportCard({ report, onView, onAssign, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  const urgencyScore = (report.upvotes?.length || 0) - (report.downvotes?.length || 0);
  const isHighUrgency = urgencyScore >= 5;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${isHighUrgency ? 'border-red-200 bg-red-50/10' : 'border-slate-100'} overflow-hidden hover:shadow-md transition-shadow duration-200`}>
      {/* Priority stripe */}
      <div className={`h-1 ${priorityDot[report.priority]} w-full`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${priorityDot[report.priority]}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 leading-snug">{report.title}</h3>
              {isHighUrgency && (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 rounded text-[10px] font-bold text-red-600 animate-pulse">
                  <AlertTriangle className="w-2.5 h-2.5" /> URGENT
                </div>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-2 mt-1.5">
              <Badge variant={report.status} showDot size="xs">
                {report.status === 'in-progress' ? 'In Progress' : report.status.charAt(0).toUpperCase() + report.status.slice(1)}
              </Badge>
              <Badge variant={priorityBadge[report.priority]} size="xs">
                {report.priority}
              </Badge>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${urgencyScore > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {urgencyScore > 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {urgencyScore} Urgency
              </div>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{report.location}, {report.barangay}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {report.reportedBy}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {report.time}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className={`text-xs text-slate-600 leading-relaxed mb-3 ${!expanded ? 'line-clamp-2' : ''}`}>
          {report.description}
        </p>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-emerald-600 font-medium hover:text-emerald-700 mb-4"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Read more</>}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={() => onView?.(report)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>
          {report.status !== 'resolved' && (
            <>
              <button
                onClick={() => onAssign?.(report)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" /> Assign
              </button>
              <button
                onClick={() => onResolve?.(report)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-900 hover:to-emerald-800 rounded-lg transition-colors ml-auto"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Resolve
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
