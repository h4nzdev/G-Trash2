import { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  Camera,
  UploadCloud,
  Send,
  Loader2,
  AlertTriangle,
  Megaphone,
  ShieldCheck,
  Eye,
  Trash2,
} from "lucide-react";
import API from "../../config";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ReportActionModal({
  report,
  isOpen,
  onClose,
  onSuccess,
  defaultAction = "acknowledged", // "acknowledged" or "resolved"
}) {
  const [actionStatus, setActionStatus] = useState(defaultAction);
  const [actionNotes, setActionNotes] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [notifyCommunity, setNotifyCommunity] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(false);

  useEffect(() => {
    if (isOpen && report) {
      const initialAction =
        defaultAction ||
        (report.status === "pending" ? "acknowledged" : "resolved");
      setActionStatus(initialAction);
      setActionNotes(
        initialAction === "resolved"
          ? "Barangay response team has cleared and sanitized the reported site."
          : "Barangay personnel dispatched to address this waste report."
      );
      setProofImage(report.resolutionImage || "");
      setNotifyCommunity(true);
      setError(null);
      setPreviewZoom(false);
    }
  }, [isOpen, report, defaultAction]);

  if (!isOpen || !report) return null;

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size exceeds 10MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProofImage(reader.result);
      setError(null);
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (actionStatus === "resolved" && !proofImage && !report.resolutionImage) {
      setError("Clean-up photo evidence is required before marking this report as resolved.");
      setSubmitting(false);
      return;
    }

    try {
      const token = localStorage.getItem("gtrash_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const payload = {
        status: actionStatus,
        actionNote: actionNotes.trim(),
        resolutionImage: proofImage || report.resolutionImage || null,
        postToCommunity: notifyCommunity,
        notifyCommunity: notifyCommunity,
      };

      const { data } = await axios.patch(
        `${API}/api/reports/${report._id || report.id}`,
        payload,
        { headers }
      );

      if (onSuccess) {
        onSuccess(data);
      }
      onClose();
    } catch (err) {
      console.error("Failed to submit official report action:", err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to submit official action. Please check your connection."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const priorityColor =
    report.priority === "Critical"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : report.priority === "High"
      ? "bg-orange-50 text-orange-700 border-orange-200"
      : report.priority === "Medium"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden my-8 animate-notification-drop">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Official Incident Response
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Take corrective action, attach photo proof, and notify the resident community.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Report Summary Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 border border-slate-300/50">
                  {report.category || "Waste Incident"}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${priorityColor}`}
                >
                  {report.priority || "Medium"}
                </span>
              </div>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {timeAgo(report.createdAt)}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                {report.title || report.description}
              </h3>
              {report.description && report.description !== report.title && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {report.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-200/60 flex-wrap">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {report.sitio
                  ? `Sitio ${report.sitio}, ${report.barangay || "Barangay"}`
                  : report.location || report.barangay || "Barangay Area"}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {report.reportedBy || "Resident Reporter"}
              </span>
            </div>

            {/* Resident submitted image thumbnail */}
            {report.reportImage && (
              <div className="pt-2">
                <p className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" /> Citizen Photo Evidence:
                </p>
                <div className="relative inline-block group">
                  <img
                    src={report.reportImage}
                    alt="Resident report"
                    className="w-24 h-20 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer group-hover:opacity-90 transition-opacity"
                    onClick={() => setPreviewZoom(true)}
                  />
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-xl transition-opacity text-xs font-semibold gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Zoom
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Official Action Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setActionStatus("acknowledged");
                  if (!actionNotes || actionNotes.includes("cleared")) {
                    setActionNotes(
                      "Barangay personnel dispatched to address this waste report."
                    );
                  }
                }}
                className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                  actionStatus === "acknowledged"
                    ? "border-blue-600 bg-blue-50/50 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    actionStatus === "acknowledged"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Acknowledge & Dispatch
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Action underway / Team dispatched
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActionStatus("resolved");
                  if (!actionNotes || actionNotes.includes("dispatched")) {
                    setActionNotes(
                      "Barangay response team has cleared and sanitized the reported site."
                    );
                  }
                }}
                className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                  actionStatus === "resolved"
                    ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    actionStatus === "resolved"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Mark as Resolved
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Issue fixed & cleared on-site
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Action Remarks / Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Official Remarks & Action Notes
            </label>
            <textarea
              rows={3}
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder="Describe the action taken by the barangay (e.g. dispatched crew, cleared 2 bins, sanitized ground)..."
              className="w-full text-xs text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-400 leading-relaxed"
            />
          </div>

          {/* Action / Proof Photo Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Official Action Photo / Proof of Resolution</span>
              {proofImage && (
                <button
                  type="button"
                  onClick={() => setProofImage("")}
                  className="text-rose-600 hover:text-rose-700 text-[11px] font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Remove Photo
                </button>
              )}
            </label>

            {proofImage ? (
              <div className="relative rounded-2xl overflow-hidden border border-emerald-200 bg-emerald-50/30 p-2 flex items-center gap-4">
                <img
                  src={proofImage}
                  alt="Action Proof"
                  className="w-24 h-24 object-cover rounded-xl border border-emerald-300 shadow-sm flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Photo Attached Successfully
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    This photo will be displayed to residents as proof of the official action taken.
                  </p>
                  <label className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer">
                    <Camera className="w-3.5 h-3.5" /> Replace Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 transition-colors mb-2">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                  Upload Action / Resolution Proof Photo
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  PNG, JPG, WebP up to 10MB (Take photo or select from files)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Post to Community Feed Checkbox */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
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
                {report.barangay || "the Barangay"}
              </strong>
              . Residents will see your response notes and action photo proof in their live feed.
            </label>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {actionStatus === "resolved" && !proofImage && !report.resolutionImage ? (
              <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Proof photo required to resolve
              </span>
            ) : <span />}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || (actionStatus === "resolved" && !proofImage && !report.resolutionImage)}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  actionStatus === "resolved"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 active:bg-emerald-800"
                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 active:bg-blue-800"
                }`}
              >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting & Posting…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {actionStatus === "resolved"
                    ? "Resolve & Post to Community"
                    : "Acknowledge & Notify Community"}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
      </div>

      {/* Image Zoom Lightbox */}
      {previewZoom && report.reportImage && (
        <div
          className="fixed inset-0 z-[5000] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewZoom(false)}
        >
          <div className="relative max-w-3xl w-full">
            <img
              src={report.reportImage}
              alt="Report Full Preview"
              className="w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setPreviewZoom(false)}
              className="absolute top-3 right-3 text-white bg-black/50 p-2 rounded-full hover:bg-black/80"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
