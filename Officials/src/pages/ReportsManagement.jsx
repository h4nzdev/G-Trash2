import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
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
  List,
  LayoutGrid,
  Calendar,
  ShieldCheck,
  Megaphone,
} from "lucide-react";
import ReportCard from "../components/reports/ReportCard";
import ReportFilter from "../components/reports/ReportFilter";
import ResidentDisposalTable from "../components/reports/ResidentDisposalTable";
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
  const isChd = official?.role === "chd";
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "disposal" ? "disposal" : "incidents",
  );

  const [filters, setFilters] = useState({
    search: "",
    status: "All",
    barangay: "All Barangays",
    sitio: "All Sitios",
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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: null,
    target: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [resolutionProofImage, setResolutionProofImage] = useState("");
  const [resolving, setResolving] = useState(false);
  const [schedulesList, setSchedulesList] = useState([]);
  const [dispatchMode, setDispatchMode] = useState("next_schedule");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [dispatchingImmediate, setDispatchingImmediate] = useState(false);
  const [applyingSchedule, setApplyingSchedule] = useState(false);
  const [notifyCommunity, setNotifyCommunity] = useState(true);

  const upcomingSchedules = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (schedulesList || [])
      .filter((s) => s.date >= today && s.status !== "completed")
      .sort((a, b) =>
        a.date === b.date
          ? (a.startTime || "").localeCompare(b.startTime || "")
          : a.date.localeCompare(b.date),
      );
  }, [schedulesList]);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${API}/api/reports`);
      const mapped = data.map((r) => ({
        ...r,
        id: r._id,
        time: timeAgo(r.createdAt),
        urgency: (r.upvotes?.length || 0) - (r.downvotes?.length || 0),
      }));
      setReportList(mapped);

      const urlReportId = searchParams.get("openReportId");
      if (urlReportId) {
        const found = mapped.find((r) => r._id === urlReportId || r.id === urlReportId);
        if (found) {
          openReport(found);
          // clear param without reloading
          setSearchParams(new URLSearchParams());
        }
      }
    } catch (err) {
      setError("Could not load reports. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedulesList = () => {
    const token = localStorage.getItem("gtrash_token");
    const config = token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {};
    axios
      .get(`${API}/api/schedules`, config)
      .then(({ data }) => {
        if (Array.isArray(data)) setSchedulesList(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchReports();
    fetchSchedulesList();
    axios
      .get(`${API}/api/fleet`)
      .then(({ data }) => setFleet(data))
      .catch(() => {});

    const socket = io(API, { transports: ["websocket", "polling"] });

    socket.on("schedule:changed", () => {
      fetchSchedulesList();
    });

    socket.on("report:deleted", ({ id }) => {
      setReportList((prev) => prev.filter((r) => r._id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSelectedReport((prev) => (prev?._id === id ? null : prev));
    });

    socket.on("reports:batch-deleted", (payload) => {
      if (payload?.isIotBulk) {
        setReportList((prev) =>
          prev.filter(
            (r) => !r.reportedBy?.toLowerCase().startsWith("iot sensor"),
          ),
        );
      } else if (Array.isArray(payload?.ids)) {
        const idSet = new Set(payload.ids);
        setReportList((prev) => prev.filter((r) => !idSet.has(r._id)));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          payload.ids.forEach((id) => next.delete(id));
          return next;
        });
        setSelectedReport((prev) =>
          prev && idSet.has(prev._id) ? null : prev,
        );
      }
    });

    socket.on("report:new", () => {
      fetchReports();
    });

    socket.on("report:updated", () => {
      fetchReports();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (official?.barangay && official.barangay !== "All") {
      setFilters((prev) => ({ ...prev, barangay: official.barangay }));
    }
  }, [official]);

  const openReport = (r) => {
    setSelectedReport(r);
    setSelectedTruckId(r.assignedTruck || "");
    setSelectedScheduleId(r.priorityScheduleId || "");
    setResolutionProofImage(r.resolutionImage || "");
    setDispatchMode("next_schedule");
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
      if (suggestion.action.directAssign) {
        await handleAssignImmediate(selectedReport, suggestion.action.truckId);
        setSuggestions((prev) =>
          prev.map((s) => (s === suggestion ? { ...s, done: true } : s)),
        );
      }
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
    const proof = resolutionProofImage || report?.resolutionImage;
    if (!proof) {
      if (!selectedReport || selectedReport._id !== report._id) {
        openReport(report);
      }
      alert(
        "A clean-up proof photo is required before marking this report as resolved. Please attach a photo.",
      );
      return;
    }
    setResolving(true);
    try {
      const token = localStorage.getItem("gtrash_token");
      const config = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};
      const payload = {
        status: "resolved",
        resolutionImage: proof,
        notifyCommunity,
      };
      const { data } = await axios.patch(
        `${API}/api/reports/${report._id}`,
        payload,
        config,
      );
      setReportList((prev) =>
        prev.map((r) =>
          r._id === report._id ? { ...r, ...data, status: "resolved" } : r,
        ),
      );
      setSelectedReport(null);
      setResolutionProofImage("");
    } catch (err) {
      alert(
        "Failed to resolve report: " +
          (err.response?.data?.error || err.message),
      );
    } finally {
      setResolving(false);
    }
  };

  const handleResolutionPhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setResolutionProofImage(reader.result);
    };
    reader.readAsDataURL(file);
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

  const handleApplyNextSchedule = async (report, scheduleId) => {
    setApplyingSchedule(true);
    try {
      const token = localStorage.getItem("gtrash_token");
      const config = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};
      const { data } = await axios.post(
        `${API}/api/reports/${report._id}/apply-next-schedule`,
        { scheduleId: scheduleId || undefined },
        config,
      );
      const updated = data.report || data;
      setReportList((prev) =>
        prev.map((r) => (r._id === report._id ? { ...r, ...updated } : r)),
      );
      setSelectedReport((prev) => (prev ? { ...prev, ...updated } : prev));
      fetchSchedulesList();
      alert(
        data.schedule
          ? `✅ Report location added to collection schedule for ${data.schedule.date} (Truck ${data.schedule.truckId})!`
          : `✅ Report queued for next collection schedule!`,
      );
    } catch (err) {
      alert(
        "Failed to apply to schedule: " +
          (err.response?.data?.error || err.message),
      );
    } finally {
      setApplyingSchedule(false);
    }
  };

  const handleAssignImmediate = async (report, truckId) => {
    if (!truckId) {
      alert("Please select an active truck to dispatch.");
      return;
    }
    setDispatchingImmediate(true);
    try {
      const token = localStorage.getItem("gtrash_token");
      const config = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};
      const { data } = await axios.post(
        `${API}/api/reports/${report._id}/assign-priority`,
        {
          truckId,
          priorityLevel: "High",
          reason: `Immediate Priority Pickup: ${report.title || "Report"}`,
        },
        config,
      );
      if (data.report || data) {
        const updated = data.report || data;
        setReportList((prev) =>
          prev.map((r) => (r._id === report._id ? { ...r, ...updated } : r)),
        );
        setSelectedReport((prev) => (prev ? { ...prev, ...updated } : prev));
        alert(
          `🚨 Truck ${truckId} dispatched immediately! Notification pushed to driver.`,
        );
      }
    } catch (err) {
      alert(
        "Failed to dispatch truck immediately: " +
          (err.response?.data?.error || err.message),
      );
    } finally {
      setDispatchingImmediate(false);
    }
  };

  const handleAssignPriority = handleAssignImmediate;

  const handleHealthFlag = async (report) => {
    setFlagging(true);
    try {
      const { data } = await axios.patch(
        `${API}/api/reports/${report._id}/health-flag`,
      );
      setReportList((prev) =>
        prev.map((r) => (r._id === report._id ? { ...r, ...data } : r)),
      );
      setSelectedReport((prev) => (prev ? { ...prev, ...data } : prev));
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
      const { data } = await axios.patch(
        `${API}/api/reports/${selectedReport._id}/health-note`,
        { text: healthNoteText },
      );
      setReportList((prev) =>
        prev.map((r) => (r._id === selectedReport._id ? { ...r, ...data } : r)),
      );
      setSelectedReport((prev) => (prev ? { ...prev, ...data } : prev));
      setHealthNoteText("");
    } catch {
      /* silent */
    } finally {
      setHealthNoteSaving(false);
    }
  };

  const isIotReport = (r) =>
    r.reportedBy?.toLowerCase().startsWith("iot sensor");

  const handleDeleteIotReport = async (id) => {
    try {
      await axios.delete(`${API}/api/reports/${id}`);
      setReportList((prev) => prev.filter((r) => r._id !== id));
      if (selectedReport?._id === id) setSelectedReport(null);
    } catch {
      /* silent */
    }
  };

  const [viewMode, setViewMode] = useState("list");
  const [clearingIot, setClearingIot] = useState(false);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const confirmDeleteSingle = (report, e) => {
    if (e) e.stopPropagation();
    setDeleteModal({ isOpen: true, type: "single", target: report });
  };

  const confirmDeleteBatch = () => {
    if (selectedIds.size === 0) return;
    setDeleteModal({
      isOpen: true,
      type: "batch",
      target: Array.from(selectedIds),
    });
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("gtrash_token");
      const config = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};

      if (deleteModal.type === "single") {
        const reportId = deleteModal.target?._id || deleteModal.target?.id;
        await axios.delete(`${API}/api/reports/${reportId}`, config);
        setReportList((prev) => prev.filter((r) => r._id !== reportId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(reportId);
          return next;
        });
        if (selectedReport?._id === reportId) {
          setSelectedReport(null);
        }
      } else if (deleteModal.type === "batch") {
        const ids = deleteModal.target;
        await axios.post(
          `${API}/api/reports/batch-delete`,
          { reportIds: ids },
          config,
        );
        const idSet = new Set(ids);
        setReportList((prev) => prev.filter((r) => !idSet.has(r._id)));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        if (selectedReport && idSet.has(selectedReport._id)) {
          setSelectedReport(null);
        }
      }
      setDeleteModal({ isOpen: false, type: null, target: null });
    } catch (err) {
      alert(
        "Failed to delete report(s): " +
          (err.response?.data?.error || err.message),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllIot = async () => {
    if (
      !window.confirm(
        "Delete all IoT auto-generated reports? This cannot be undone.",
      )
    )
      return;
    setClearingIot(true);
    try {
      const token = localStorage.getItem("gtrash_token");
      const config = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};
      const { data } = await axios.delete(
        `${API}/api/reports/iot-bulk`,
        config,
      );
      setReportList((prev) => prev.filter((r) => !isIotReport(r)));
      if (selectedReport && isIotReport(selectedReport))
        setSelectedReport(null);
    } catch {
      /* silent */
    }
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
      const sitioMatch =
        filters.sitio === "All Sitios" || r.sitio === filters.sitio;
      const priorityMatch =
        filters.priority === "All Priorities" ||
        r.priority === filters.priority;
      const searchMatch =
        !filters.search ||
        r.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.location.toLowerCase().includes(filters.search.toLowerCase());
      const healthMatch = !filters.healthOnly || r.healthConcern;
      return (
        statusMatch &&
        barangayMatch &&
        sitioMatch &&
        priorityMatch &&
        searchMatch &&
        healthMatch
      );
    })
    .sort((a, b) => {
      if (filters.sortBy === "Highest Urgency") return b.urgency - a.urgency;
      if (filters.sortBy === "Oldest")
        return new Date(a.createdAt) - new Date(b.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt); // Newest
    });

  const isAllVisibleSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.has(r._id));

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r._id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.add(r._id));
        return next;
      });
    }
  };

  const counts = {
    all: reportList.length,
    pending: reportList.filter((r) => r.status === "pending").length,
    inProgress: reportList.filter((r) => r.status === "in-progress").length,
    resolved: reportList.filter((r) => r.status === "resolved").length,
    escalated: reportList.filter((r) => r.escalated).length,
  };

  const uniqueSitios = useMemo(() => {
    const filteredReports = reportList.filter(
      (r) =>
        filters.barangay === "All Barangays" || r.barangay === filters.barangay,
    );
    const list = filteredReports.map((r) => r.sitio).filter(Boolean);
    return ["All Sitios", ...new Set(list)];
  }, [reportList, filters.barangay]);

  return (
    <div className="p-6">
      {/* Top Level Reports Category Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4 mb-6">
        <button
          onClick={() => {
            setActiveTab("incidents");
            setSearchParams({ tab: "incidents" });
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === "incidents"
              ? "bg-emerald-700 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          Citizen Incident Reports
          <span
            className={`ml-1 px-2 py-0.5 text-[10px] rounded-full font-bold ${
              activeTab === "incidents"
                ? "bg-emerald-800 text-emerald-100"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {counts.all}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("disposal");
            setSearchParams({ tab: "disposal" });
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === "disposal"
              ? "bg-emerald-700 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          <Camera className="w-4 h-4" />
          Resident Disposal Photos
          <span
            className={`ml-1 px-2 py-0.5 text-[10px] rounded-full font-bold ${
              activeTab === "disposal"
                ? "bg-emerald-800 text-emerald-100"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            Live Table
          </span>
        </button>
      </div>

      {activeTab === "disposal" ? (
        <ResidentDisposalTable official={official} />
      ) : (
        <>
          {/* Header with refresh */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-slate-800">
                Reports Management
              </h1>
              {isChd && (
                <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                  <Heart className="w-3 h-3" /> View Only — CHD
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isChd && (
                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, healthOnly: !f.healthOnly }))
                  }
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${
                    filters.healthOnly
                      ? "bg-red-600 text-white border-red-600"
                      : "text-red-600 bg-red-50 border-red-200 hover:bg-red-100"
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  {filters.healthOnly ? "All Reports" : "Health Flagged"}
                </button>
              )}
              {iotCount > 0 && !isChd && (
                <button
                  onClick={handleClearAllIot}
                  disabled={clearingIot}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  {clearingIot ? (
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Clear IoT ({iotCount})
                </button>
              )}
              <button
                onClick={fetchReports}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  title="List view"
                  className={`flex items-center px-2.5 py-1.5 transition-colors ${
                    viewMode === "list"
                      ? "bg-emerald-700 text-white"
                      : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  title="Grid view"
                  className={`flex items-center px-2.5 py-1.5 transition-colors border-l border-slate-200 ${
                    viewMode === "grid"
                      ? "bg-emerald-700 text-white"
                      : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
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

          <ReportFilter
            filters={filters}
            onChange={setFilters}
            sitios={uniqueSitios}
            official={official}
          />

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between p-4 gap-4"
                >
                  <div className="flex items-center gap-3.5 w-1/3">
                    <div className="w-10 h-10 bg-slate-200 rounded-xl flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-32 bg-slate-200 rounded" />
                      <div className="h-3 w-24 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-28 bg-slate-200 rounded" />
                  <div className="h-6 w-20 bg-slate-100 rounded-full" />
                  <div className="h-8 w-24 bg-slate-200 rounded-xl" />
                </div>
              ))}
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
          ) : viewMode === "list" ? (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {/* List header */}
              <div className="grid grid-cols-[36px_1fr_2fr_1fr_80px_88px_56px_72px] gap-3 items-center px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <div className="flex items-center justify-center">
                  {!isChd && (
                    <input
                      type="checkbox"
                      checked={isAllVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      title={
                        isAllVisibleSelected
                          ? "Deselect all visible"
                          : "Select all visible"
                      }
                    />
                  )}
                </div>
                <span>Status</span>
                <span>Report</span>
                <span className="hidden md:block">Reporter</span>
                <span className="hidden lg:block">Time</span>
                <span>Priority</span>
                <span className="text-right">Score</span>
                <span className="text-right">Actions</span>
              </div>

              {/* List rows */}
              <div className="divide-y divide-slate-50">
                {filtered.map((report) => {
                  const statusDot =
                    {
                      pending: "bg-amber-400",
                      "in-progress": "bg-blue-500",
                      resolved: "bg-emerald-500",
                    }[report.status] ?? "bg-slate-300";

                  const statusLabel =
                    report.status === "in-progress"
                      ? "In Progress"
                      : report.status.charAt(0).toUpperCase() +
                        report.status.slice(1);

                  const priorityColor =
                    {
                      High: "text-red-600 bg-red-50 border-red-200",
                      Medium: "text-amber-600 bg-amber-50 border-amber-200",
                      Low: "text-slate-500 bg-slate-50 border-slate-200",
                    }[report.priority] ??
                    "text-slate-500 bg-slate-50 border-slate-200";

                  const isRowSelected = selectedIds.has(report._id);

                  return (
                    <div
                      key={report._id}
                      onClick={() => openReport(report)}
                      className={`grid grid-cols-[36px_1fr_2fr_1fr_80px_88px_56px_72px] gap-3 items-center px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors group ${
                        isRowSelected ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      {/* Row Checkbox */}
                      <div
                        className="flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!isChd && (
                          <input
                            type="checkbox"
                            checked={isRowSelected}
                            onChange={() => toggleSelect(report._id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        )}
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`}
                        />
                        <span className="text-xs font-medium text-slate-600 truncate">
                          {statusLabel}
                        </span>
                        {report.escalated && (
                          <ShieldAlert className="w-3 h-3 text-red-500 flex-shrink-0" />
                        )}
                      </div>

                      {/* Title + location */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {report.title}
                          </p>
                          {report.healthConcern && (
                            <Heart className="w-3 h-3 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {report.location}
                          {report.barangay ? `, Brgy. ${report.barangay}` : ""}
                        </p>
                      </div>

                      {/* Reporter */}
                      <p className="hidden md:block text-xs text-slate-500 truncate">
                        {report.reportedBy}
                      </p>

                      {/* Time */}
                      <p className="hidden lg:block text-xs text-slate-400 truncate">
                        {report.time}
                      </p>

                      {/* Priority */}
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border w-fit ${priorityColor}`}
                      >
                        {report.priority}
                      </span>

                      {/* Urgency score */}
                      <span
                        className={`text-xs font-bold text-right ${report.urgency > 0 ? "text-emerald-600" : "text-slate-400"}`}
                      >
                        {report.urgency > 0 ? "+" : ""}
                        {report.urgency}
                      </span>

                      {/* Actions */}
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!isChd && (
                          <button
                            onClick={(e) => confirmDeleteSingle(report, e)}
                            title="Delete report"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openReport(report)}
                          className="p-1 rounded-lg text-slate-300 group-hover:text-emerald-600 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {filtered.length} report{filtered.length !== 1 ? "s" : ""}
                </p>
                {!isChd && selectedIds.size > 0 && (
                  <p className="text-xs font-semibold text-emerald-700">
                    {selectedIds.size} selected
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((report) => (
                <ReportCard
                  key={report._id}
                  report={report}
                  onView={openReport}
                  onAssign={isChd ? null : (r) => openReport(r)}
                  onResolve={isChd ? null : (r) => openReport(r)}
                  onDelete={!isChd ? (r) => confirmDeleteSingle(r) : null}
                  isSelected={selectedIds.has(report._id)}
                  onToggleSelect={!isChd ? toggleSelect : null}
                  isChd={isChd}
                />
              ))}
            </div>
          )}

          {/* Report Detail Modal */}
          {selectedReport && (
            <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-8 animate-notification-drop flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 leading-tight">
                        Official Incident Response
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Manage dispatch, attach photo proof, and notify the resident community.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedReport(null);
                      setSuggestions([]);
                      setResolutionProofImage("");
                    }}
                    className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                  {/* Status Badges Row */}
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
                  <h2 className="text-base font-bold text-slate-900 leading-snug mb-4">
                    {selectedReport.title}
                  </h2>
                  {/* Photo Evidence & Image Validation Audit */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Photo Evidence & Verification Audit
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {/* 1. Original Report Photo */}
                      <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                        <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700">
                            1. Original Report
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Resident
                          </span>
                        </div>
                        {selectedReport.reportImage ? (
                          <img
                            src={selectedReport.reportImage}
                            alt="Original Report"
                            className="w-full h-36 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() =>
                              window.open(selectedReport.reportImage, "_blank")
                            }
                            title="Click to view full photo"
                          />
                        ) : (
                          <div className="h-36 flex flex-col items-center justify-center text-slate-400 text-xs">
                            <Camera className="w-6 h-6 mb-1 text-slate-300" />
                            No initial photo
                          </div>
                        )}
                      </div>

                      {/* 2. Official Resolution Clean-up Proof */}
                      <div className="rounded-xl border border-emerald-200 overflow-hidden bg-emerald-50/30">
                        <div className="px-3 py-1.5 bg-emerald-100/70 border-b border-emerald-200 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-800">
                            2. Clean-up Proof
                          </span>
                          <span className="text-[10px] text-emerald-700 font-semibold">
                            Barangay
                          </span>
                        </div>
                        {selectedReport.resolutionImage ? (
                          <img
                            src={selectedReport.resolutionImage}
                            alt="Clean-up Proof"
                            className="w-full h-36 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() =>
                              window.open(
                                selectedReport.resolutionImage,
                                "_blank",
                              )
                            }
                            title="Click to view full photo"
                          />
                        ) : (
                          <div className="h-36 flex flex-col items-center justify-center text-slate-400 text-xs p-2 text-center">
                            <CheckCircle className="w-6 h-6 mb-1 text-slate-300" />
                            No clean-up photo uploaded
                          </div>
                        )}
                      </div>

                      {/* 3. Resident Dispute Photo Proof */}
                      {selectedReport.disputeImage ? (
                        <div className="rounded-xl border border-red-300 overflow-hidden bg-red-50/30">
                          <div className="px-3 py-1.5 bg-red-100 border-b border-red-200 flex items-center justify-between">
                            <span className="text-[11px] font-bold text-red-800">
                              3. Resident Dispute Photo
                            </span>
                            <span className="text-[10px] text-red-700 font-semibold">
                              Validation Proof
                            </span>
                          </div>
                          <img
                            src={selectedReport.disputeImage}
                            alt="Dispute Photo Proof"
                            className="w-full h-36 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() =>
                              window.open(selectedReport.disputeImage, "_blank")
                            }
                            title="Click to view full photo"
                          />
                          {selectedReport.disputeReason && (
                            <div className="p-2 text-[11px] text-red-700 bg-red-50 border-t border-red-100">
                              <strong>Note:</strong>{" "}
                              {selectedReport.disputeReason}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-100 overflow-hidden bg-slate-50/50 hidden md:block">
                          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                            <span className="text-[11px] font-medium text-slate-400">
                              3. Dispute Verification
                            </span>
                          </div>
                          <div className="h-36 flex flex-col items-center justify-center text-slate-300 text-xs p-2 text-center">
                            No dispute raised
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

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
                      {selectedReport.reportedBy
                        ?.toLowerCase()
                        .startsWith("truck") ? (
                        <Truck className="w-4 h-4 text-emerald-600 animate-pulse flex-shrink-0" />
                      ) : (
                        <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                      {selectedReport.reportedBy
                        ?.toLowerCase()
                        .startsWith("truck") ? (
                        <span>
                          Reported by{" "}
                          <span className="font-bold text-emerald-700">
                            {selectedReport.reportedBy}
                          </span>
                        </span>
                      ) : (
                        <span>Reported by {selectedReport.reportedBy}</span>
                      )}
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

                  {/* SLA / Escalation / Dispute indicator */}
                  {selectedReport.resolutionConfirmed === "disputed" ? (
                    <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-xl">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-red-800">
                          📸 RESIDENT DISPUTED RESOLUTION — Photo Proof Provided
                        </p>
                        <p className="text-[11px] text-red-600 mt-0.5">
                          The resident verified that the waste was not properly
                          cleared and provided photo proof above. Report has
                          been reopened.
                        </p>
                      </div>
                    </div>
                  ) : selectedReport.escalated ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                      <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <p className="text-xs font-bold text-red-700">
                        OVERDUE SLA — Exceeded 72h response limit. Barangay
                        penalised -10 pts.
                      </p>
                    </div>
                  ) : selectedReport.status === "pending" &&
                    selectedReport.deadline ? (
                    (() => {
                      const h = slaHoursLeft(selectedReport.deadline);
                      return h !== null && h > 0 ? (
                        <div
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                            h < 12
                              ? "bg-red-50/70 border-red-200 text-red-700"
                              : "bg-slate-50 border-slate-200 text-slate-600"
                          }`}
                        >
                          <Clock
                            className={`w-4 h-4 flex-shrink-0 ${h < 12 ? "text-red-500" : "text-slate-400"}`}
                          />
                          <p className="text-xs font-medium">
                            {h}h left to respond — failure deducts 10 points
                            from {selectedReport.barangay}
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
                          ? "bg-slate-50 border-slate-200 text-slate-700"
                          : selectedReport.resolutionConfirmed === "disputed"
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      {selectedReport.resolutionConfirmed === "confirmed" ? (
                        <>
                          <ThumbsUp className="w-4 h-4 text-slate-600" />
                          <p className="text-xs font-semibold text-slate-700">
                            Resident confirmed fixed — Barangay awarded +20
                            points
                          </p>
                        </>
                      ) : selectedReport.resolutionConfirmed === "disputed" ? (
                        <>
                          <ThumbsDown className="w-4 h-4 text-red-600" />
                          <p className="text-xs font-semibold text-red-700">
                            Resident says issue persists with photo proof (-15
                            pts)
                          </p>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-slate-500" />
                          <p className="text-xs font-semibold text-slate-600">
                            Awaiting resident confirmation of resolution
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Smart Suggestions — hidden for CHD */}
                  {!isChd && (suggestionsLoading || suggestions.length > 0) && (
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Smart Suggestions
                        </p>
                      </div>

                      {suggestionsLoading ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                          <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          Analyzing report and nearby resources…
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {suggestions.map((s, i) => {
                            const meta =
                              {
                                route: {
                                  icon: Route,
                                  bg: "bg-slate-50 border-slate-200",
                                  iconColor: "text-slate-600",
                                  btnStyle:
                                    "bg-slate-900 hover:bg-slate-800 text-white",
                                  btnLabel: s.done
                                    ? "Added ✓"
                                    : s.btnLabel || "Add Stop",
                                },
                                truck: {
                                  icon: Truck,
                                  bg: "bg-slate-50 border-slate-200",
                                  iconColor: "text-slate-600",
                                  btnStyle:
                                    "bg-slate-900 hover:bg-slate-800 text-white",
                                  btnLabel: s.done
                                    ? "Assigned ✓"
                                    : s.btnLabel || "Direct Assign",
                                },
                                priority: {
                                  icon: Zap,
                                  bg: "bg-slate-50 border-slate-200",
                                  iconColor: "text-slate-600",
                                  btnStyle:
                                    "bg-slate-900 hover:bg-slate-800 text-white",
                                  btnLabel: s.done ? "Escalated ✓" : "Escalate",
                                },
                                ai: {
                                  icon: Sparkles,
                                  bg: "bg-slate-50 border-slate-200",
                                  iconColor: "text-slate-400",
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
                                  <p className="text-xs font-semibold text-slate-800 mb-0.5">
                                    {s.title}
                                  </p>
                                  <p className="text-xs text-slate-500 leading-relaxed">
                                    {s.description}
                                  </p>
                                </div>
                                {meta.btnLabel && (
                                  <button
                                    onClick={() =>
                                      !s.done && handleSuggestionAction(s)
                                    }
                                    disabled={s.done}
                                    className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 ${meta.btnStyle}`}
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
                            color: "text-slate-600 bg-slate-100",
                            label: "Report Submitted",
                          },
                          "in-progress": {
                            icon: Clock,
                            color: "text-slate-700 bg-slate-100",
                            label: "Taken In Progress",
                          },
                          resolved: {
                            icon: CheckCircle,
                            color: "text-slate-700 bg-slate-100",
                            label: "Marked Resolved",
                          },
                          escalated: {
                            icon: ShieldAlert,
                            color: "text-red-700 bg-red-50",
                            label: "Auto-Escalated",
                          },
                          confirmed: {
                            icon: CheckCircle,
                            color: "text-slate-700 bg-slate-100",
                            label: "Confirmed by Resident",
                          },
                          disputed: {
                            icon: AlertTriangle,
                            color: "text-red-700 bg-red-50",
                            label: "Disputed by Resident",
                          },
                          reopened: {
                            icon: AlertTriangle,
                            color: "text-slate-700 bg-slate-100",
                            label: "Reopened",
                          },
                        };
                        const meta =
                          statusMeta[entry.status] || statusMeta.pending;
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
                              <Heart className="w-3.5 h-3.5" /> Health Concern
                              Flag
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
                          <MessageSquare className="w-3.5 h-3.5" /> Health Notes
                          (CHD Internal)
                        </p>
                        {selectedReport.healthNotes?.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {selectedReport.healthNotes.map((note, i) => (
                              <div
                                key={i}
                                className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5"
                              >
                                <p className="text-xs text-slate-700">
                                  {note.text}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {note.addedBy} ·{" "}
                                  {new Date(note.createdAt).toLocaleString(
                                    "en-PH",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
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
                            onChange={(e) => setHealthNoteText(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleHealthNote()
                            }
                            className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 text-slate-700"
                          />
                          <button
                            onClick={handleHealthNote}
                            disabled={
                              !healthNoteText.trim() || healthNoteSaving
                            }
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

                  {/* Collection Dispatch Options: Apply on Next Schedule OR Pick Up Immediately */}
                  {!isChd && selectedReport.status !== "resolved" && (
                    <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-slate-500" />
                            Collection Dispatch Options
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Choose whether to queue this report for the next
                            regular schedule or dispatch a truck immediately.
                          </p>
                        </div>
                        {selectedReport.assignedTruck && (
                          <span className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs">
                            <Truck className="w-3 h-3 text-slate-500" />
                            {selectedReport.isPriorityArea
                              ? "Immediate: "
                              : "Assigned: "}
                            {selectedReport.assignedTruck}
                            {selectedReport.assignedDriver
                              ? ` — ${selectedReport.assignedDriver}`
                              : ""}
                          </span>
                        )}
                      </div>

                      {/* Mode Selector Tabs */}
                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/50 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setDispatchMode("next_schedule")}
                          className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                            dispatchMode === "next_schedule"
                              ? "bg-white text-slate-900 shadow-xs border border-slate-200/60 font-semibold"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>Apply on Next Schedule</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDispatchMode("immediate")}
                          className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                            dispatchMode === "immediate"
                              ? "bg-white text-slate-900 shadow-xs border border-slate-200/60 font-semibold"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 text-slate-500" />
                          <span>Pick Up Immediately</span>
                        </button>
                      </div>

                      {/* Tab 1: Apply on Next Schedule */}
                      {dispatchMode === "next_schedule" && (
                        <div className="space-y-2.5 pt-0.5">
                          <div className="text-[11.5px] text-slate-600 bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-2.5 shadow-xs">
                            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-slate-800">
                                Queue for Regular Collection Schedule
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                Appends this report location (
                                {selectedReport.sitio ||
                                  selectedReport.location ||
                                  "Report site"}
                                ) as a designated stop on the next collection
                                schedule route.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <select
                              value={selectedScheduleId}
                              onChange={(e) =>
                                setSelectedScheduleId(e.target.value)
                              }
                              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-700 font-medium"
                            >
                              <option value="">
                                Next Available Earliest Schedule (Auto-detect)
                              </option>
                              {upcomingSchedules.map((s) => (
                                <option key={s._id} value={s._id}>
                                  {s.date} • Truck {s.truckId} —{" "}
                                  {s.routeName ||
                                    s.barangay ||
                                    "Scheduled Route"}{" "}
                                  ({s.startTime || "Regular Shift"})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                handleApplyNextSchedule(
                                  selectedReport,
                                  selectedScheduleId,
                                )
                              }
                              disabled={applyingSchedule}
                              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-all flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                            >
                              {applyingSchedule ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Calendar className="w-3.5 h-3.5 text-slate-300" />
                              )}
                              <span>Apply to Schedule</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Directly Assign to Truck (Pick Up Immediately) */}
                      {dispatchMode === "immediate" && (
                        <div className="space-y-2.5 pt-0.5">
                          <div className="text-[11.5px] text-slate-600 bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-2.5 shadow-xs">
                            <Zap className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-slate-800">
                                Direct Immediate Pickup Dispatch
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                Immediately dispatches an active truck to
                                collect this waste. Sets high priority and sends
                                a real-time push alert directly to the driver's
                                device.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <select
                              value={selectedTruckId}
                              onChange={(e) =>
                                setSelectedTruckId(e.target.value)
                              }
                              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-700 font-medium"
                            >
                              <option value="">
                                — Select an active truck / driver —
                              </option>
                              {fleet.map((f) => (
                                <option key={f.truckId} value={f.truckId}>
                                  {f.truckId} — {f.driverName}{" "}
                                  {f.status
                                    ? `[${f.status.toUpperCase()}]`
                                    : ""}{" "}
                                  {f.route ? `(${f.route})` : ""}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                handleAssignImmediate(
                                  selectedReport,
                                  selectedTruckId,
                                )
                              }
                              disabled={
                                !selectedTruckId || dispatchingImmediate
                              }
                              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-all flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                            >
                              {dispatchingImmediate ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Zap className="w-3.5 h-3.5 text-slate-300" />
                              )}
                              <span>Dispatch Immediately</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resolution Proof Upload Section */}
                  {!isChd && selectedReport.status !== "resolved" && (
                    <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-slate-500" />
                            Clean-up Proof Photo (Resolution Evidence)
                            {!resolutionProofImage &&
                            !selectedReport.resolutionImage ? (
                              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-200/70 text-slate-600 border border-slate-300/60">
                                Required to Resolve
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-200/70 text-slate-800 border border-slate-300/60">
                                Proof Attached ✓
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Attach a photo of the cleaned area as verifiable
                            evidence. Photo proof is strictly required before
                            marking this report as resolved.
                          </p>
                        </div>
                        {resolutionProofImage && (
                          <button
                            onClick={() => setResolutionProofImage("")}
                            className="text-xs text-slate-500 hover:text-slate-800 hover:underline font-medium"
                          >
                            Remove photo
                          </button>
                        )}
                      </div>

                      {resolutionProofImage ||
                      selectedReport.resolutionImage ? (
                        <div className="relative w-full h-36 rounded-lg overflow-hidden border border-slate-200">
                          <img
                            src={
                              resolutionProofImage ||
                              selectedReport.resolutionImage
                            }
                            alt="Clean-up Proof Preview"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-slate-900/80 text-white text-[10px] rounded font-medium backdrop-blur-sm">
                            Clean-up Photo Attached ✓
                          </span>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-1.5 p-4 bg-white border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-center gap-2 text-slate-700 font-medium text-xs">
                            <Camera className="w-4 h-4 text-slate-400" />
                            <span>Upload Clean-up Photo Proof (Required)</span>
                          </div>
                          <span className="text-[10.5px] text-slate-400">
                            PNG, JPG, or WEBP up to 10MB
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleResolutionPhotoUpload}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {/* Post to Community Feed Checkbox */}
                  {!isChd && selectedReport.status !== "resolved" && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 mt-4">
                      <input
                        type="checkbox"
                        id="notifyCommunityCheck"
                        checked={notifyCommunity}
                        onChange={(e) => setNotifyCommunity(e.target.checked)}
                        className="mt-1 w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                      <label
                        htmlFor="notifyCommunityCheck"
                        className="text-xs text-slate-800 cursor-pointer select-none leading-relaxed"
                      >
                        <strong className="font-bold text-slate-900 flex items-center gap-1">
                          <Megaphone className="w-3.5 h-3.5 text-amber-600" />
                          Post Update to Resident Community Feed & Send Notification
                        </strong>
                        Broadcast this resolution update to all residents in{" "}
                        <strong className="font-semibold text-slate-900">
                          {selectedReport.barangay || "the Barangay"}
                        </strong>
                        . Residents will see your response notes and action photo proof in their live feed.
                      </label>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3 flex-shrink-0">
                  {!isChd && (
                    <button
                      onClick={() => confirmDeleteSingle(selectedReport)}
                      className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                      title="Permanently delete this report"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedReport(null);
                      setSuggestions([]);
                      setResolutionProofImage("");
                    }}
                    className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                  {!isChd && selectedReport.status !== "resolved" && (
                    <div className="flex-1 flex flex-col items-stretch">
                      <button
                        onClick={() => handleResolve(selectedReport)}
                        disabled={
                          resolving ||
                          (!resolutionProofImage &&
                            !selectedReport.resolutionImage)
                        }
                        className="w-full py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        title={
                          !resolutionProofImage &&
                          !selectedReport.resolutionImage
                            ? "Please upload a clean-up proof photo first"
                            : "Mark report as resolved"
                        }
                      >
                        {resolving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            <span>Resolving...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Mark as Resolved</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Floating Batch Action Bar */}
          {!isChd && selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-slate-900 font-bold text-xs">
                  {selectedIds.size}
                </span>
                <span className="text-sm font-medium">
                  {selectedIds.size === 1
                    ? "1 report selected"
                    : `${selectedIds.size} reports selected`}
                </span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <button
                onClick={confirmDeleteBatch}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </button>
              <button
                onClick={clearSelection}
                className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Deselect All
              </button>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteModal.isOpen && (
            <div className="fixed inset-0 bg-black/60 z-[2100] flex items-center justify-center p-4 backdrop-blur-xs">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {deleteModal.type === "single"
                        ? "Delete Report"
                        : "Delete Selected Reports"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      This action cannot be undone
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  {deleteModal.type === "single" ? (
                    <>
                      Are you sure you want to permanently delete the report{" "}
                      <strong className="text-slate-900 font-semibold">
                        "{deleteModal.target?.title}"
                      </strong>
                      ?
                    </>
                  ) : (
                    <>
                      Are you sure you want to delete{" "}
                      <strong className="text-slate-900 font-semibold">
                        {deleteModal.target?.length || selectedIds.size}{" "}
                        selected reports
                      </strong>
                      ?
                    </>
                  )}
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() =>
                      setDeleteModal({
                        isOpen: false,
                        type: null,
                        target: null,
                      })
                    }
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={executeDelete}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isDeleting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {isDeleting ? "Deleting..." : "Delete Permanently"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
