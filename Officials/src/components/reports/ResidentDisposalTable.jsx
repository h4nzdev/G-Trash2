import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import {
  Camera,
  Calendar,
  Clock,
  MapPin,
  User,
  Search,
  RefreshCw,
  Eye,
  X,
  Flame,
  CheckCircle2,
  Filter,
  Sparkles,
  ExternalLink,
  ShieldCheck,
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

function formatDate(dateStr) {
  if (!dateStr) return "–";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ResidentDisposalTable({ official }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [selectedBarangay, setSelectedBarangay] = useState(
    official?.barangay && official.barangay !== "All" ? official.barangay : "All"
  );
  const [selectedSitio, setSelectedSitio] = useState("All");
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPhotos = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const params = { period };
      if (selectedBarangay !== "All") params.barangay = selectedBarangay;
      if (selectedSitio !== "All") params.sitio = selectedSitio;
      if (search.trim()) params.search = search.trim();

      const { data } = await axios.get(`${API}/api/disposal/photos`, { params });
      setPhotos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching resident disposal photos:", err);
      setError("Could not load resident disposal photos. Please try again.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [period, selectedBarangay, selectedSitio]);

  // Real-time socket listener for incoming resident photos
  useEffect(() => {
    const socket = io(API, { transports: ["websocket", "polling"] });

    socket.on("disposal:photo:new", (newRecord) => {
      if (!newRecord) return;
      setPhotos((prev) => {
        // Prevent duplicate addition
        if (prev.some((p) => p._id === newRecord._id)) return prev;
        return [newRecord, ...prev];
      });
    });

    return () => socket.disconnect();
  }, []);

  // Filtered list by search keyword if applied locally as well
  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (p.residentName && p.residentName.toLowerCase().includes(q)) ||
        (p.barangay && p.barangay.toLowerCase().includes(q)) ||
        (p.sitio && p.sitio.toLowerCase().includes(q))
      );
    });
  }, [photos, search]);

  // Derived metrics
  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const todayCount = photos.filter(
      (p) => new Date(p.createdAt).getTime() >= startOfToday
    ).length;

    const uniqueResidents = new Set(photos.map((p) => p.residentName || p.residentId)).size;
    const maxStreak = photos.reduce((max, p) => Math.max(max, p.streakCount || 0), 0);

    return {
      total: photos.length,
      today: todayCount,
      uniqueResidents,
      maxStreak,
    };
  }, [photos]);

  // Available sitios for dropdown based on loaded photos
  const availableSitios = useMemo(() => {
    const sSet = new Set();
    photos.forEach((p) => {
      if (selectedBarangay === "All" || p.barangay === selectedBarangay) {
        if (p.sitio) sSet.add(p.sitio);
      }
    });
    return ["All", ...Array.from(sSet).sort()];
  }, [photos, selectedBarangay]);

  return (
    <div className="space-y-6">
      {/* Top Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-600" />
            Resident Disposal Photos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified resident waste preparation reports and curbside disposal proof (1 snap per resident per day).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPhotos}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Total Photos</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2">{stats.total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Verified submissions</p>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-800">Submitted Today</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">{stats.today}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Daily 1-snap records</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Active Residents</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2">{stats.uniqueResidents}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Unique household submitters</p>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/20 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-800">Highest Streak</p>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2">{stats.maxStreak} Days</p>
          <p className="text-[11px] text-amber-600 mt-0.5 font-medium">Consistent daily sorting</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search resident, sitio, barangay..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Period Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {[
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "week", label: "This Week" },
              { id: "month", label: "This Month" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPeriod(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  period === tab.id
                    ? "bg-white text-emerald-800 font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Barangay Dropdown */}
          {(!official?.barangay || official.barangay === "All") && (
            <select
              value={selectedBarangay}
              onChange={(e) => {
                setSelectedBarangay(e.target.value);
                setSelectedSitio("All");
              }}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 font-medium"
            >
              <option value="All">All Barangays</option>
              <option value="Apas">Apas</option>
              <option value="Lahug">Lahug</option>
              <option value="Mabolo">Mabolo</option>
              <option value="Banilad">Banilad</option>
              <option value="Talamban">Talamban</option>
            </select>
          )}

          {/* Sitio Dropdown */}
          {availableSitios.length > 1 && (
            <select
              value={selectedSitio}
              onChange={(e) => setSelectedSitio(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 font-medium"
            >
              <option value="All">All Sitios</option>
              {availableSitios.filter((s) => s !== "All").map((sitio) => (
                <option key={sitio} value={sitio}>
                  {sitio}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchPhotos} className="underline font-bold ml-2">
            Retry
          </button>
        </div>
      )}

      {/* Resident Photos Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse flex items-center px-4 gap-4">
                <div className="w-12 h-12 bg-slate-200 rounded-lg flex-shrink-0" />
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-4 w-40 bg-slate-100 rounded" />
                <div className="h-6 w-20 bg-slate-200 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Camera className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Resident Disposal Photos</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No photo submissions match your current filters. As residents snap their daily garbage disposal photos, they will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Resident</th>
                  <th className="py-3.5 px-4">Location (Sitio / Brgy)</th>
                  <th className="py-3.5 px-4">Disposal Photo</th>
                  <th className="py-3.5 px-4">Streak</th>
                  <th className="py-3.5 px-4">Daily Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPhotos.map((item) => {
                  const initial = item.residentName ? item.residentName.charAt(0).toUpperCase() : "R";
                  return (
                    <tr
                      key={item._id || item.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(item.createdAt)}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-medium ml-5">
                          {timeAgo(item.createdAt)}
                        </span>
                      </td>

                      {/* Resident Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {initial}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">
                              {item.residentName || "Resident"}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {item.truckId ? `Unit: ${item.truckId}` : "Self-Reported"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span>{item.sitio || "Curbside"}</span>
                        </div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          Brgy. {item.barangay || "Apas"}
                        </span>
                      </td>

                      {/* Disposal Photo Thumbnail */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          onClick={() => setPreviewPhoto(item)}
                          className="relative group/thumb block rounded-xl overflow-hidden border border-slate-200 shadow-2xs hover:border-emerald-500 transition-all cursor-pointer"
                          title="Click to zoom photo"
                        >
                          <img
                            src={item.photoUrl}
                            alt="Resident Disposal Proof"
                            className="w-16 h-12 object-cover transition-transform duration-200 group-hover/thumb:scale-105"
                            onError={(e) => {
                              e.target.src = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=300&q=80";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        </button>
                      </td>

                      {/* Streak */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          {item.streakCount || 1} {item.streakCount === 1 ? "Day" : "Days"}
                        </span>
                      </td>

                      {/* Daily Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Verified Snap (1/day)
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => setPreviewPhoto(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Photo
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  {previewPhoto.residentName?.charAt(0) || "R"}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {previewPhoto.residentName || "Resident Disposal Report"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Barangay {previewPhoto.barangay} • {previewPhoto.sitio || "Curbside"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image Display */}
            <div className="p-6 bg-slate-900 flex items-center justify-center">
              <img
                src={previewPhoto.photoUrl}
                alt="Disposal Proof High Resolution"
                className="max-h-[60vh] w-auto max-w-full object-contain rounded-xl shadow-lg"
                onError={(e) => {
                  e.target.src = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&q=80";
                }}
              />
            </div>

            {/* Modal Metadata Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 text-slate-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {formatDate(previewPhoto.createdAt)} ({timeAgo(previewPhoto.createdAt)})
                </span>
                <span className="flex items-center gap-1.5 font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  {previewPhoto.streakCount || 1}-Day Streak
                </span>
                {previewPhoto.pointsAwarded > 0 && (
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    +{previewPhoto.pointsAwarded} pts awarded
                  </span>
                )}
              </div>

              <button
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
