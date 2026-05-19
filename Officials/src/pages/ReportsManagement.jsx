import { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  MapPin,
  Clock,
  User,
  CheckCircle,
  AlertTriangle,
  FileText,
  Camera,
  RefreshCw,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  Truck,
  Route,
  Sparkles,
  Zap,
  ChevronRight,
  Heart,
  MessageSquare,
  Send,
  Trash2,
} from "lucide-react";
import ReportCard from "../components/reports/ReportCard";
import ReportFilter from "../components/reports/ReportFilter";
import Badge from "../components/shared/Badge";
import { useAuth } from "../context/AuthContext";
import API from "../config";

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
  const { official } = useAuth();
  const isChd = official?.role === 'chd';

  const [filters, setFilters] = useState({
    search: "",
    status: "All",
    barangay: "All Barangays",
    priority: "All Priorities",
    sortBy: "Newest",
    healthOnly: false,
  });
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportList, setReportList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fleet, setFleet] = useState([]);
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [healthNoteText, setHealthNoteText] = useState("");
  const [healthNoteSaving, setHealthNoteSaving] = useState(false);
  const [flagging, setFlagging] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${API}/api/reports`);
      setReportList(
        data.map((r) => ({
          ...r,
          id: r._id,
          time: timeAgo(r.createdAt),
          urgency: (r.upvotes?.length || 0) - (r.downvotes?.length || 0),
        })),
      );
    } catch (err) {
      setError("Could not load reports. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    axios
      .get(`${API}/api/fleet`)
      .then(({ data }) => setFleet(data))
      .catch(() => {});
  }, []);

  const openReport = (r) => {
    setSelectedReport(r);
    setSelectedTruckId(r.assignedTruck || "");
    setSuggestions([]);
    setSuggestionsLoading(true);
    axios
      .get(`${API}/api/reports/${r._id}/suggestions`)
      .then(({ data }) => setSuggestions(data))
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  };

  const handleSuggestionAction = async (suggestion) => {
    if (suggestion.type === "route") {
      const { routeId, lat, lng, stopName } = suggestion.action;
      try {
        await axios.patch(`${API}/api/routes/${routeId}`, {
          $push: { waypoints: { lat, lng, name: stopName } },
          $inc: { totalStops: 1 },
        });
        setSuggestions((prev) =>
          prev.map((s) => (s === suggestion ? { ...s, done: true } : s)),
        );
      } catch {
        /* silent */
      }
    } else if (suggestion.type === "truck") {
      setSelectedTruckId(suggestion.action.truckId);
    } else if (suggestion.type === "priority") {
      try {
        const { data } = await axios.patch(
          `${API}/api/reports/${selectedReport._id}`,
          {
            priority: suggestion.action.priority,
          },
        );
        setSelectedReport((prev) => ({ ...prev, ...data }));
        setReportList((prev) =>
          prev.map((r) =>
            r._id === selectedReport._id
              ? { ...r, priority: data.priority }
              : r,
          ),
        );
        setSuggestions((prev) =>
          prev.map((s) => (s === suggestion ? { ...s, done: true } : s)),
        );
      } catch {
        /* silent */
      }
    }
  };

  const handleResolve = async (report) => {
    try {
      await axios.patch(`${API}/api/reports/${report._id}`, {
        status: "resolved",
      });
      setReportList((prev) =>
        prev.map((r) =>
          r._id === report._id ? { ...r, status: "resolved" } : r,
        ),
      );
      setSelectedReport(null);
    } catch {
      /* silent */
    }
  };

  const handleAssign = async (report, truckId) => {
    const fleetEntry = fleet.find((f) => f.truckId === truckId);
    try {
      const { data } = await axios.patch(`${API}/api/reports/${report._id}`, {
        status: "in-progress",
        assignedTruck: truckId || null,
        assignedDriver: fleetEntry?.driverName || null,
      });
      setReportList((prev) =>
        prev.map((r) => (r._id === report._id ? { ...r, ...data } : r)),
      );
      setSelectedReport((prev) => (prev ? { ...prev, ...data } : prev));
    } catch {
      /* silent */
    }
  };

  const handleHealthFlag = async (report) => {
    setFlagging(true);
    try {
      const { data } = await axios.patch(`${API}/api/reports/${report._id}/health-flag`);
      setReportList(prev => prev.map(r => r._id === report._id ? { ...r, ...data } : r));
      setSelectedReport(prev => prev ? { ...prev, ...data } : prev);
    } catch {
      /* silent */
    } finally {
      setFlagging(false);
    }
  };

  const handleHealthNote = async () => {
    if (!healthNoteText.trim() || !selectedReport) return;
    setHealthNoteSaving(true);
    try {
      const { data } = await axios.patch(`${API}/api/reports/${selectedReport._id}/health-note`, { text: healthNoteText });
      setReportList(prev => prev.map(r => r._id === selectedReport._id ? { ...r, ...data } : r));
      setSelectedReport(prev => prev ? { ...prev, ...data } : prev);
      setHealthNoteText("");
    } catch {
      /* silent */
    } finally {
      setHealthNoteSaving(false);
    }
  };

  const isIotReport = (r) => r.reportedBy?.toLowerCase().startsWith('iot sensor');

  const handleDeleteIotReport = async (id) => {
    try {
      await axios.delete(`${API}/api/reports/${id}`);
      setReportList(prev => prev.filter(r => r._id !== id));
      if (selectedReport?._id === id) setSelectedReport(null);
    } catch { /* silent */ }
  };

  const [clearingIot, setClearingIot] = useState(false);
  const handleClearAllIot = async () => {
    if (!window.confirm('Delete all IoT auto-generated reports? This cannot be undone.')) return;
    setClearingIot(true);
    try {
      const { data } = await axios.delete(`${API}/api/reports/iot-bulk`);
      setReportList(prev => prev.filter(r => !isIotReport(r)));
      if (selectedReport && isIotReport(selectedReport)) setSelectedReport(null);
    } catch { /* silent */ }
    setClearingIot(false);
  };

  const iotCount = reportList.filter(isIotReport).length;

  const filtered = reportList
    .filter((r) => {
      const statusMatch =
        filters.status === "All" ||
        (filters.status === "In Progress"
          ? r.status === "in-progress"
          : r.status === filters.status.toLowerCase());
      const barangayMatch =
        filters.barangay === "All Barangays" || r.barangay === filters.barangay;
      const priorityMatch =
        filters.priority === "All Priorities" ||
        r.priority === filters.priority;
      const searchMatch =
        !filters.search ||
        r.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.location.toLowerCase().includes(filters.search.toLowerCase());
      const healthMatch = !filters.healthOnly || r.healthConcern;
      return statusMatch && barangayMatch && priorityMatch && searchMatch && healthMatch;
    })
    .sort((a, b) => {
      if (filters.sortBy === "Highest Urgency") return b.urgency - a.urgency;
      if (filters.sortBy === "Oldest")
        return new Date(a.createdAt) - new Date(b.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt); // Newest
    });

  const counts = {
    all: reportList.length,
    pending: reportList.filter((r) => r.status === "pending").length,
    inProgress: reportList.filter((r) => r.status === "in-progress").length,
    resolved: reportList.filter((r) => r.status === "resolved").length,
    escalated: reportList.filter((r) => r.escalated).length,
  };

  return (
    <div className="p-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-800">Reports Management</h1>
          {isChd && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
              <Heart className="w-3 h-3" /> View Only — CHD
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isChd && (
            <button
              onClick={() => setFilters(f => ({ ...f, healthOnly: !f.healthOnly }))}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${
                filters.healthOnly
                  ? 'bg-red-600 text-white border-red-600'
                  : 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'
              }`}
            >
              <Heart className="w-4 h-4" />
              {filters.healthOnly ? 'All Reports' : 'Health Flagged'}
            </button>
          )}
          {iotCount > 0 && !isChd && (
            <button
              onClick={handleClearAllIot}
              disabled={clearingIot}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {clearingIot
                ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                : <Trash2 className="w-4 h-4" />}
              Clear IoT ({iotCount})
            </button>
          )}
          <button
            onClick={fetchReports}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary Bar */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          {
            label: "Total Reports",
            value: counts.all,
            color: "text-slate-700",
            bg: "bg-slate-50 border-slate-200",
          },
          {
            label: "Pending",
            value: counts.pending,
            color: "text-amber-700",
            bg: "bg-amber-50 border-amber-200",
          },
          {
            label: "In Progress",
            value: counts.inProgress,
            color: "text-blue-700",
            bg: "bg-blue-50 border-blue-200",
          },
          {
            label: "Resolved",
            value: counts.resolved,
            color: "text-emerald-700",
            bg: "bg-emerald-50 border-emerald-200",
          },
          {
            label: "Escalated",
            value: counts.escalated,
            color: "text-red-700",
            bg:
              counts.escalated > 0
                ? "bg-red-50 border-red-300 ring-1 ring-red-100"
                : "bg-slate-50 border-slate-200",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {s.label}
            </p>
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
            {reportList.length === 0
              ? "No reports submitted yet"
              : "No reports match your filters"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {reportList.length === 0
              ? "Reports from residents will appear here"
              : "Try adjusting the filter criteria above"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((report) => (
            <ReportCard
              key={report._id}
              report={report}
              onView={openReport}
              onAssign={isChd ? null : handleAssign}
              onResolve={isChd ? null : handleResolve}
              onDelete={!isChd && isIotReport(report) ? handleDeleteIotReport : null}
              isChd={isChd}
            />
          ))}
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={selectedReport.status} showDot size="xs">
                    {selectedReport.status === "in-progress"
                      ? "In Progress"
                      : selectedReport.status.charAt(0).toUpperCase() +
                        selectedReport.status.slice(1)}
                  </Badge>
                  <Badge
                    variant={selectedReport.priority.toLowerCase()}
                    size="xs"
                  >
                    {selectedReport.priority}
                  </Badge>
                  <div
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedReport.urgency > 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}
                  >
                    {selectedReport.urgency} Urgency Score
                  </div>
                  {selectedReport.healthConcern && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-red-600 rounded text-[10px] font-bold text-white">
                      <Heart className="w-2.5 h-2.5" /> Health Concern
                    </div>
                  )}
                </div>
                <h2 className="text-base font-bold text-slate-900 leading-snug">
                  {selectedReport.title}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedReport(null);
                  setSuggestions([]);
                }}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Image Display */}
              {selectedReport.reportImage ? (
                <div className="w-full overflow-hidden rounded-xl border border-slate-100">
                  <img
                    src={selectedReport.reportImage}
                    alt="Report"
                    className="w-full h-auto object-cover max-h-60"
                  />
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
                  <span>
                    {selectedReport.location}, Barangay{" "}
                    {selectedReport.barangay}
                  </span>
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
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Description
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {selectedReport.description}
                </p>
              </div>

              {/* SLA / Escalation indicator */}
              {selectedReport.escalated ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                  <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-xs font-bold text-red-700">
                    ESCALATED — No action within 72h. Barangay lost 10 points.
                  </p>
                </div>
              ) : selectedReport.status === "pending" &&
                selectedReport.deadline ? (
                (() => {
                  const h = slaHoursLeft(selectedReport.deadline);
                  return h !== null && h > 0 ? (
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${h < 12 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}
                    >
                      <Clock
                        className={`w-4 h-4 flex-shrink-0 ${h < 12 ? "text-red-600" : "text-amber-600"}`}
                      />
                      <p
                        className={`text-xs font-bold ${h < 12 ? "text-red-700" : "text-amber-700"}`}
                      >
                        {h}h left to respond — failure deducts 10 points from{" "}
                        {selectedReport.barangay}
                      </p>
                    </div>
                  ) : null;
                })()
              ) : null}

              {/* Resident Verification Status */}
              {selectedReport.resolutionConfirmed && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                    selectedReport.resolutionConfirmed === "confirmed"
                      ? "bg-emerald-50 border-emerald-200"
                      : selectedReport.resolutionConfirmed === "disputed"
                        ? "bg-red-50 border-red-200"
                        : "bg-blue-50 border-blue-200"
                  }`}
                >
                  {selectedReport.resolutionConfirmed === "confirmed" ? (
                    <>
                      <ThumbsUp className="w-4 h-4 text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-700">
                        Resident confirmed fixed — Barangay awarded +20 points
                      </p>
                    </>
                  ) : selectedReport.resolutionConfirmed === "disputed" ? (
                    <>
                      <ThumbsDown className="w-4 h-4 text-red-600" />
                      <p className="text-xs font-bold text-red-700">
                        Resident says issue persists — Report reopened, -15
                        points
                      </p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-blue-600" />
                      <p className="text-xs font-bold text-blue-700">
                        Awaiting resident confirmation of resolution
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Smart Suggestions — hidden for CHD */}
              {!isChd && (suggestionsLoading || suggestions.length > 0) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Smart Suggestions
                    </p>
                  </div>

                  {suggestionsLoading ? (
                    <div className="flex items-center gap-2 px-3 py-3 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-600">
                      <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      Analyzing report and nearby resources…
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {suggestions.map((s, i) => {
                        const meta =
                          {
                            route: {
                              icon: Route,
                              bg: "bg-emerald-50 border-emerald-200",
                              iconColor: "text-emerald-600",
                              btnStyle:
                                "bg-emerald-700 hover:bg-emerald-800 text-white",
                              btnLabel: s.done ? "Added ✓" : "Add Stop",
                            },
                            truck: {
                              icon: Truck,
                              bg: "bg-blue-50 border-blue-200",
                              iconColor: "text-blue-600",
                              btnStyle:
                                "bg-blue-600 hover:bg-blue-700 text-white",
                              btnLabel: "Pre-fill",
                            },
                            priority: {
                              icon: Zap,
                              bg: "bg-red-50 border-red-200",
                              iconColor: "text-red-600",
                              btnStyle:
                                "bg-red-600 hover:bg-red-700 text-white",
                              btnLabel: s.done ? "Escalated ✓" : "Escalate",
                            },
                            ai: {
                              icon: Sparkles,
                              bg: "bg-violet-50 border-violet-100",
                              iconColor: "text-violet-500",
                              btnStyle: null,
                              btnLabel: null,
                            },
                          }[s.type] || {};
                        const Icon = meta.icon;
                        return (
                          <div
                            key={i}
                            className={`flex items-start gap-3 px-3 py-3 rounded-xl border ${meta.bg}`}
                          >
                            <div
                              className={`flex-shrink-0 mt-0.5 ${meta.iconColor}`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 mb-0.5">
                                {s.title}
                              </p>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {s.description}
                              </p>
                            </div>
                            {meta.btnLabel && (
                              <button
                                onClick={() =>
                                  !s.done && handleSuggestionAction(s)
                                }
                                disabled={s.done}
                                className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors disabled:opacity-60 ${meta.btnStyle}`}
                              >
                                {!s.done && (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                                {meta.btnLabel}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Activity Timeline from statusHistory */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Activity Timeline
                </p>
                <div className="space-y-3">
                  {(selectedReport.statusHistory?.length > 0
                    ? selectedReport.statusHistory
                    : [
                        {
                          status: "pending",
                          changedBy: selectedReport.reportedBy,
                          changedAt: selectedReport.createdAt,
                        },
                      ]
                  ).map((entry, i) => {
                    const statusMeta = {
                      pending: {
                        icon: AlertTriangle,
                        color: "text-amber-600 bg-amber-100",
                        label: "Report Submitted",
                      },
                      "in-progress": {
                        icon: Clock,
                        color: "text-blue-600 bg-blue-100",
                        label: "Taken In Progress",
                      },
                      resolved: {
                        icon: CheckCircle,
                        color: "text-emerald-600 bg-emerald-100",
                        label: "Marked Resolved",
                      },
                      escalated: {
                        icon: ShieldAlert,
                        color: "text-red-600 bg-red-100",
                        label: "Auto-Escalated",
                      },
                      confirmed: {
                        icon: CheckCircle,
                        color: "text-emerald-600 bg-emerald-100",
                        label: "Confirmed by Resident",
                      },
                      disputed: {
                        icon: AlertTriangle,
                        color: "text-red-600 bg-red-100",
                        label: "Disputed by Resident",
                      },
                      reopened: {
                        icon: AlertTriangle,
                        color: "text-orange-600 bg-orange-100",
                        label: "Reopened",
                      },
                    };
                    const meta = statusMeta[entry.status] || statusMeta.pending;
                    const Icon = meta.icon;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.color}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {meta.label}
                          </p>
                          <p className="text-xs text-slate-400">
                            {entry.changedBy && (
                              <span className="font-semibold">
                                {entry.changedBy} ·{" "}
                              </span>
                            )}
                            {entry.changedAt
                              ? new Date(entry.changedAt).toLocaleString(
                                  "en-PH",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CHD-only: Health Concern Flag + Health Notes */}
              {isChd && (
                <div className="space-y-4">
                  {/* Flag as Health Concern */}
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5" /> Health Concern Flag
                        </p>
                        <p className="text-xs text-red-600 mt-0.5">
                          {selectedReport.healthConcern
                            ? "This report is flagged as a health concern — visible to LGU officials"
                            : "Flag this report to alert LGU officials of a health risk"}
                        </p>
                      </div>
                      {selectedReport.healthConcern ? (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">
                          <Heart className="w-3.5 h-3.5" /> FLAGGED
                        </span>
                      ) : (
                        <button
                          onClick={() => handleHealthFlag(selectedReport)}
                          disabled={flagging}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {flagging ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Heart className="w-3.5 h-3.5" />
                          )}
                          Flag as Health Concern
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Health Notes */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" /> Health Notes (CHD Internal)
                    </p>
                    {selectedReport.healthNotes?.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {selectedReport.healthNotes.map((note, i) => (
                          <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                            <p className="text-xs text-slate-700">{note.text}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {note.addedBy} · {new Date(note.createdAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a health note…"
                        value={healthNoteText}
                        onChange={e => setHealthNoteText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleHealthNote()}
                        className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 text-slate-700"
                      />
                      <button
                        onClick={handleHealthNote}
                        disabled={!healthNoteText.trim() || healthNoteSaving}
                        className="px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 disabled:opacity-40 transition-colors"
                      >
                        {healthNoteSaving ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Assign Dropdown */}
              {!isChd && selectedReport.status !== "resolved" && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Assign to Collector
                  </p>
                  {selectedReport.assignedTruck && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-2">
                      <Truck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      Currently:{" "}
                      <span className="font-bold text-slate-700">
                        {selectedReport.assignedTruck}
                        {selectedReport.assignedDriver
                          ? ` — ${selectedReport.assignedDriver}`
                          : ""}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <select
                      value={selectedTruckId}
                      onChange={(e) => setSelectedTruckId(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
                    >
                      <option value="">— Select a truck / driver —</option>
                      {fleet.map((f) => (
                        <option key={f.truckId} value={f.truckId}>
                          {f.truckId} — {f.driverName}
                          {f.route ? ` (${f.route})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (selectedTruckId)
                          handleAssign(selectedReport, selectedTruckId);
                      }}
                      disabled={!selectedTruckId}
                      className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 rounded-xl transition-colors"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => {
                  setSelectedReport(null);
                  setSuggestions([]);
                }}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Close
              </button>
              {!isChd && selectedReport.status !== "resolved" && (
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
