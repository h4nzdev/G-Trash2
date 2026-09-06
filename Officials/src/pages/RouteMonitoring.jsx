// ============================================================
// === 1. IMPORTS & DEPENDENCIES ==============================
// ============================================================
import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  Tooltip,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { io } from "socket.io-client";
import axios from "axios";
import {
  RefreshCw,
  Truck,
  MapPin,
  Navigation,
  UserPlus,
  X,
  Check,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Phone,
  Layers,
  Clock,
  User,
  CreditCard,
  ChevronDown,
  Route as RouteIcon,
  Maximize2
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import API from "../config";
import MapTileControl, { GOOGLE_MAP_TILES } from "../components/route/MapTileControl";

// === CUSTOM IMPORTED ASSETS (SVG ICONS) ===
import gtruck from "../assets/svg/garbage-truck.svg?url";
import trashIcon from "../assets/svg/trash.svg?url";

import { CEBU_CENTER, WORLD_BOUNDS, CEBU_BOUNDS, CEBU_CITY_OUTLINE, fetchCebuCityBoundary } from "../utils/mapBoundary";

// ============================================================
// === 2. MAP ICON MAKERS ======================================
// ============================================================

/**
 * Creates a dynamic, rotating Truck Icon using the imported SVG.
 * - Rotates based on the map heading (offset by -90 degrees to align North).
 * - Pulse effect appears when the truck status is 'online'.
 */
function makeTruckIcon(status, heading = 0) {
  const isOnline = status === "online";
  const pinColor = isOnline ? "#059669" : "#475569"; // Emerald green if online, Slate grey if offline
  const pulseColor = isOnline ? "rgba(16, 185, 129, 0.4)" : "rgba(100, 116, 139, 0.2)";
  const isMovingWest = heading > 180 && heading < 360;
  const flipStyle = isMovingWest ? 'transform: scaleX(-1);' : '';

  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center w-12 h-14 justify-end group">
        <!-- Pulsing Aura Ring for Online Truck -->
        ${
          isOnline
            ? `<div class="absolute top-1 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full animate-ping pointer-events-none" style="background:${pulseColor};"></div>`
            : ""
        }

        <!-- Teardrop Pinpoint Container -->
        <div class="relative z-10 flex flex-col items-center filter drop-shadow-[0_8px_12px_rgba(0,0,0,0.4)]">
          <!-- Pin Head Teardrop Body -->
          <div class="w-10 h-10 rounded-[50%_50%_50%_0] -rotate-45 border-[2.5px] border-white shadow-2xl flex items-center justify-center" style="background:${pinColor};">
             <!-- White Inner Core Circle Housing Truck Icon -->
             <div class="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-inner">
               <!-- Truck SVG (Rotated back upright + flipped if moving West) -->
               <div class="rotate-45 w-5 h-5 flex items-center justify-center" style="${flipStyle}">
                 <img src="${gtruck}" class="w-4 h-4 object-contain" alt="Truck" />
               </div>
             </div>
          </div>
          
          <!-- Sharp Downward Pointer Tip -->
          <div class="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] -mt-[2px]" style="border-top-color:${pinColor};"></div>
        </div>

        <!-- Status Dot Badge -->
        <div class="absolute -top-1 -right-0.5 w-4 h-4 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'} border-2 border-white shadow-md z-20"></div>

        <!-- Pinpoint Target Dot on Road Ground -->
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-emerald-600/30 border border-emerald-600 animate-pulse"></div>
      </div>
    `,
    iconSize: [48, 56],
    iconAnchor: [24, 56],
    className: "",
  });
}

/**
 * Creates a sharp, teardrop location pin for the Overflowing Bin.
 * - Points exactly downwards onto the map coordinates.
 * - Includes a pulsing "Area" ring and an urgency score badge.
 */
function makeBinIcon(score) {
  const isHighUrgency = score >= 5;
  const bgColor = isHighUrgency ? "#9f1239" : "#e11d48"; // Rose-Red (#e11d48) or Dark Crimson (#9f1239)
  const pulseColor = isHighUrgency ? "rgba(159, 18, 57, 0.7)" : "rgba(225, 29, 72, 0.5)";

  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center w-12 h-14 justify-end group">
        <!-- Pulsing Red Hazard Aura -->
        <div class="absolute top-1 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full animate-ping pointer-events-none" style="background:${pulseColor};"></div>

        <!-- Teardrop Pin Container -->
        <div class="relative z-10 flex flex-col items-center filter drop-shadow-[0_8px_12px_rgba(0,0,0,0.45)]">
          <!-- Pin Head (Crimson Red with Dark Core) -->
          <div class="w-10 h-10 rounded-[50%_50%_50%_0] -rotate-45 border-[3px] border-white shadow-2xl flex items-center justify-center" style="background:${bgColor};">
             <!-- Dark Contrast Inner Core -->
             <div class="w-7 h-7 rounded-full bg-slate-950 flex items-center justify-center shadow-inner">
               <!-- Rotated back upright SVG Warning Trash Can Icon -->
               <div class="rotate-45 text-amber-400 flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M3 6h18"/>
                   <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                   <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                   <line x1="10" y1="11" x2="10" y2="17"/>
                   <line x1="14" y1="11" x2="14" y2="17"/>
                 </svg>
               </div>
             </div>
          </div>
          
          <!-- Downward Pointer Tip -->
          <div class="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] -mt-[2px]" style="border-top-color:${bgColor};"></div>
        </div>

        <!-- Score / Upvote Badge -->
        <div class="absolute -top-1 -right-1 min-w-[22px] h-5 px-1 bg-amber-400 text-slate-950 rounded-full text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xl z-20">
          ${score}
        </div>
        
        <!-- Ground Shadow -->
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-black/40 rounded-full blur-[1px]"></div>
      </div>
    `,
    iconSize: [48, 56],
    iconAnchor: [24, 56],
    className: "",
  });
}

/**
 * Creates numbered circle markers for waypoints (stops).
 */
function makeStopIcon(n, isFirst, isLast, isCompleted, isCurrent) {
  const bg = isCompleted
    ? "#10b981"
    : isCurrent
      ? "#2563eb"
      : isFirst
        ? "#059669"
        : isLast
          ? "#dc2626"
          : "#64748b";
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center">
        ${isCurrent ? '<div class="absolute -inset-1 rounded-full bg-blue-500/40 animate-ping"></div>' : ''}
        <div class="relative w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-[11px] text-white shadow-lg transition-colors border-2 border-white drop-shadow-md" style="background:${bg}; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
          ${isCompleted ? "✓" : n}
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    className: "",
  });
}

// ============================================================
// === 3. MODALS ===============================================
// ============================================================

// ── Address Popup (Dynamic Reverse Geocoding) ──
function AddressPopup({ wp }) {
  const [address, setAddress] = useState(wp.address || wp.name);
  const [loading, setLoading] = useState(!wp.address && wp.name.startsWith("Stop"));

  useEffect(() => {
    let isMounted = true;
    if (loading) {
      axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${wp.lat}&lon=${wp.lng}&zoom=18&addressdetails=1`)
        .then(res => {
          if (isMounted) {
            setAddress(res.data.display_name || "Unknown Address");
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setAddress("Address unavailable");
            setLoading(false);
          }
        });
    }
    return () => { isMounted = false; };
  }, [wp, loading]);

  return (
    <div className="p-1 min-w-[140px] max-w-[220px] text-center">
      {loading ? (
        <span className="text-xs text-slate-500 animate-pulse">Fetching address...</span>
      ) : (
        <span className="text-xs font-semibold text-slate-800 leading-tight block">{address}</span>
      )}
    </div>
  );
}

// ── Report Details Modal ──
function ReportModal({ report, onClose }) {
  const score = (report.upvotes?.length || 0) - (report.downvotes?.length || 0);
  const isHighUrgency = score >= 5;
  return (
    <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${isHighUrgency ? "bg-red-100" : "bg-amber-100"}`}
            >
              <AlertTriangle
                className={`w-4 h-4 ${isHighUrgency ? "text-red-600" : "text-amber-600"}`}
              />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Overflowing Bin
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Community Urgency
            </span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-bold ${isHighUrgency ? "bg-red-600 text-white animate-pulse" : "bg-amber-100 text-amber-700"}`}
            >
              Score: {score}
            </span>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-800 mb-1">
              {report.description}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin className="w-3.5 h-3.5" />
              <span>{report.location || report.barangay}</span>
            </div>
          </div>
          {report.reportImage && (
            <img
              src={report.reportImage}
              className="w-full h-40 object-cover rounded-xl border border-slate-100"
              alt="Evidence"
            />
          )}
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Reported by {report.reportedBy}</span>
            <span>{new Date(report.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Truck Modal ──
function AssignModal({ route, fleet, onClose, onSave }) {
  const current = fleet.find((f) => f.truckId === route.truckId);
  const [selectedTruckId, setSelectedTruckId] = useState(route.truckId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!selectedTruckId) {
      setError("Select a truck to assign.");
      return;
    }
    const fleetEntry = fleet.find((f) => f.truckId === selectedTruckId);
    setSaving(true);
    setError("");
    try {
      const { data } = await axios.patch(`${API}/api/routes/${route._id}`, {
        truckId: selectedTruckId,
        driverName: fleetEntry?.driverName || "",
      });
      onSave(data);
    } catch {
      setError("Failed to assign. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async () => {
    setSaving(true);
    try {
      const { data } = await axios.patch(`${API}/api/routes/${route._id}`, {
        truckId: null,
        driverName: "",
      });
      onSave(data);
    } catch {
      setError("Failed to unassign. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Assign Truck Driver
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]">
              {route.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Navigation className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">Route</p>
              <p className="text-sm font-bold text-slate-800 truncate">
                {route.name}
              </p>
              <p className="text-xs text-slate-400">{route.totalStops} stops</p>
            </div>
          </div>
          {current && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              Currently assigned to{" "}
              <span className="font-bold text-slate-700">
                {current.truckId} · {current.driverName}
              </span>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Select Truck / Driver
            </label>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
              {fleet.length === 0 && (
                <p className="text-xs text-slate-400 italic py-2">
                  No trucks available.
                </p>
              )}
              {fleet.map((f) => {
                const isShared = f.type === "shared";
                const isSelected = selectedTruckId === f.truckId;
                return (
                  <button
                    key={f.truckId}
                    type="button"
                    onClick={() => setSelectedTruckId(f.truckId)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${isSelected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isShared ? "bg-emerald-100" : "bg-emerald-100"}`}
                    >
                      <Truck
                        className={`w-4 h-4 ${isShared ? "text-emerald-600" : "text-emerald-700"}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-800">
                          {f.truckId}
                        </span>
                        {isShared && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
                            Shared
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {f.driverName}
                        {f.route ? ` · ${f.route}` : ""}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </p>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          {route.truckId && (
            <button
              onClick={handleUnassign}
              disabled={saving}
              className="px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Unassign
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedTruckId}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-colors"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {saving ? "Saving…" : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// === 4. MAIN ROUTE MONITORING COMPONENT ======================
// ============================================================
export default function RouteMonitoring() {
  // ── State Management ──
  const { official } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [trucks, setTrucks] = useState({});
  const [fleet, setFleet] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deviationAlerts, setDeviationAlerts] = useState([]);
  const [activeTileKey, setActiveTileKey] = useState("grayscale");
  const [showReports, setShowReports] = useState(true);
  const socketRef = useRef(null);

  const [cebuCityBoundary, setCebuCityBoundary] = useState(CEBU_CITY_OUTLINE);
  useEffect(() => {
    fetchCebuCityBoundary().then(coords => {
      if (coords) setCebuCityBoundary(coords);
    });
  }, []);

  // ── API Data Fetching ──
  const fetchData = async () => {
    setLoading(true);
    try {
      const [schedulesRes, trucksRes, fleetRes, reportsRes] = await Promise.all([
        axios.get(`${API}/api/schedules/today`),
        axios.get(`${API}/api/trucks`),
        axios.get(`${API}/api/fleet`),
        axios.get(`${API}/api/reports?category=Overflowing Bin`),
      ]);

      // Map dynamic scheduled sitio sequences as routes
      const todayScheds = schedulesRes.data.schedules || [];
      const mappedRoutes = todayScheds.map(sched => {
        const coords = sched.routeCoords && sched.routeCoords.length > 0
          ? sched.routeCoords
          : (sched.sitioTasks || []).map(t => [t.lat, t.lng]);
        const waypoints = (sched.sitioTasks || []).map(t => ({
          name: t.name,
          lat: t.lat,
          lng: t.lng,
          completed: t.completed
        }));
        
        const completedCount = (sched.sitioTasks || []).filter(t => t.completed).length;

        return {
          _id: sched._id,
          name: sched.routeName || sched.barangay || "Collection Duty",
          truckId: sched.truckId,
          driverName: sched.driverName,
          notes: sched.notes,
          isPriority: !!sched.isPriority,
          priorityLevel: sched.priorityLevel || "Normal",
          priorityReason: sched.priorityReason || "",
          barangay: sched.barangay,
          routeCoords: coords,
          waypoints: waypoints,
          currentStopIndex: completedCount,
          status: sched.status
        };
      });

      // Filter routes by LGU official's barangay restriction if set
      const filteredRoutes = (official?.barangay && official.barangay !== 'All')
        ? mappedRoutes.filter(r => r.barangay?.toLowerCase() === official.barangay.toLowerCase())
        : mappedRoutes;

      setRoutes(filteredRoutes);
      setFleet(fleetRes.data);

      // Filter visible trucks by official's barangay restriction
      const officialBrgy = official?.barangay?.toLowerCase();
      const isRestricted = officialBrgy && officialBrgy !== 'all';
      
      const allowedTruckIds = isRestricted
        ? new Set([
            ...fleetRes.data.filter(f => f.barangay?.toLowerCase() === officialBrgy).map(f => f.truckId),
            ...filteredRoutes.map(r => r.truckId).filter(Boolean)
          ])
        : null;

      const truckMap = {};
      trucksRes.data.forEach((t) => {
        if (!allowedTruckIds || allowedTruckIds.has(t.truckId)) {
          truckMap[t.truckId] = t;
        }
      });
      setTrucks(truckMap);
      setReports(reportsRes.data.filter((r) => r.status !== "resolved"));
    } catch (err) {
      console.error("Failed to load route monitoring data:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── WebSocket & Socket Listeners ──
  useEffect(() => {
    fetchData();
    const socket = io(API, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("truck:location:update", (data) => {
      setTrucks((prev) => ({
        ...prev,
        [data.truckId]: {
          ...prev[data.truckId],
          ...data,
          updatedAt: new Date(),
        },
      }));
    });
    socket.on("truck:status", (data) => {
      setTrucks((prev) => ({
        ...prev,
        [data.truckId]: { ...prev[data.truckId], status: data.status },
      }));
    });
    socket.on("route:updated", (updated) => {
      setRoutes((prev) =>
        prev.map((r) => (r._id === updated._id ? updated : r)),
      );
    });
    socket.on("schedule:changed", () => {
      fetchData();
    });
    socket.on("report:new", (newReport) => {
      if (newReport.category === "Overflowing Bin")
        setReports((prev) => [newReport, ...prev]);
    });
    socket.on("report:updated", (updated) => {
      if (updated.status === "resolved")
        setReports((prev) => prev.filter((r) => r._id !== updated._id));
      else
        setReports((prev) =>
          prev.map((r) => (r._id === updated._id ? updated : r)),
        );
    });
    socket.on("truck:off-route", (data) => {
      setDeviationAlerts((prev) => {
        if (
          prev.some((a) => a.truckId === data.truckId && a.type === "off-route")
        )
          return prev;
        return [
          { ...data, id: Date.now(), ts: new Date(), type: "off-route" },
          ...prev,
        ].slice(0, 5);
      });
    });
    socket.on("truck:contact-dispatch", (data) => {
      setDeviationAlerts((prev) => {
        if (
          prev.some((a) => a.truckId === data.truckId && a.type === "contact")
        )
          return prev;
        return [
          { ...data, id: Date.now(), ts: new Date(), type: "contact" },
          ...prev,
        ].slice(0, 5);
      });
    });
    return () => socket.disconnect();
  }, []);

  // ── Handlers ──
  const handleAssignSave = (updatedRoute) => {
    setRoutes((prev) =>
      prev.map((r) => (r._id === updatedRoute._id ? updatedRoute : r)),
    );
    if (selectedRoute?._id === updatedRoute._id) setSelectedRoute(updatedRoute);
    setAssignTarget(null);
  };

  // ── Computed Variables ──
  const mappableRoutes = routes.filter((r) => r.routeCoords?.length > 0);
  const onlineCt = Object.values(trucks).filter(
    (t) => t.status === "online",
  ).length;
  const assignedCt = routes.filter((r) => r.truckId).length;

  // ── Active Route Logic ──
  const activeRoute = selectedRoute || (routes.length > 0 ? routes[0] : null);
  const activeTruck = activeRoute ? trucks[activeRoute.truckId] : null;
  const activeFleet = activeRoute
    ? fleet.find((f) => f.truckId === activeRoute.truckId)
    : null;

  // Determines progress. Defaults to 0 if unassigned.
  const completedStops = activeRoute?.currentStopIndex || 0;
  const totalStops = activeRoute?.waypoints?.length || 0;
  const progress =
    activeRoute && activeRoute.truckId && totalStops > 0
      ? Math.round((completedStops / totalStops) * 100)
      : 0;

  // ── Inline CSS Animations ──
  const animationStyles = `
    @keyframes pulse-truck { 0% { transform: scale(0.95); opacity: 0.7; } 100% { transform: scale(1.4); opacity: 0; } }
    @keyframes pulse-area { 0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; } 50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.5; } 100% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; } }
    @keyframes pop-in { 0% { transform: scale(0); } 100% { transform: scale(1); } }
    .animate-pulse-truck { animation: pulse-truck 1.8s ease-out infinite; }
    .animate-pulse-area { animation: pulse-area 2s ease-in-out infinite; }
    .animate-pop-in { animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  `;

  return (
    <div className="flex flex-col h-screen bg-[#f0f4f8] overflow-hidden relative">
      <style>{animationStyles}</style>

      {/* ── Deviation Alerts (Floating Overlay) ── */}
      {deviationAlerts.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[999] w-full max-w-2xl space-y-2">
          {deviationAlerts.map((alert) => {
            const isContact = alert.type === "contact";
            return (
              <div
                key={alert.id}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border shadow-lg bg-white/95 backdrop-blur-sm ${isContact ? "border-emerald-200" : "border-amber-200"}`}
              >
                {isContact ? (
                  <Phone className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-bold ${isContact ? "text-emerald-800" : "text-amber-800"}`}
                  >
                    {isContact ? "Dispatch Request" : "Off Route Alert"} —{" "}
                    {alert.truckId}
                  </p>
                  <p
                    className={`text-xs ${isContact ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {alert.driverName && `${alert.driverName} · `}
                    {isContact
                      ? alert.message
                      : `~${alert.distanceM}m from assigned route`}
                    {" · "}
                    {new Date(alert.ts).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setDeviationAlerts((prev) =>
                      prev.filter((a) => a.id !== alert.id),
                    )
                  }
                  className={`flex-shrink-0 ${isContact ? "text-emerald-400 hover:text-emerald-600" : "text-amber-400 hover:text-amber-600"}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Main Page Layout (Sidebar + Map) ── */}
      <div className="flex flex-1 overflow-hidden gap-0 p-4 pb-0">
        {/* === LEFT SIDEBAR ================================= */}
        <div className="w-[340px] flex-shrink-0 bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-slate-200 flex flex-col overflow-hidden mr-4 pb-4">
          
          {/* Quick Actions (Replaces original Route Builder tab) */}
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Actions</span>
            <button
              onClick={() => window.location.href = '/route-builder'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
              title="Open Manual Route Builder"
            >
              <RouteIcon className="w-3 h-3" />
              Route Builder
            </button>
          </div>

          {/* 1. Truck Header */}
          <div className="p-5 border-b border-slate-100 pb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Truck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900 leading-tight">
                    {activeRoute
                      ? activeRoute.truckId || "Unassigned"
                      : "No Route Selected"}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-2 h-2 rounded-full ${activeTruck?.status === "online" ? "bg-emerald-500" : "bg-slate-400"}`}
                    ></span>
                    <span className="text-xs font-semibold text-slate-500">
                      {activeTruck?.status === "online"
                        ? "Collecting"
                        : activeTruck?.status || "Offline"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Progress Bar */}
            <div className="mb-4">
              <div className="flex items-end justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Route Progress
                </span>
                <span className="text-2xl font-bold text-emerald-600 leading-none">
                  {progress}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Stops Completed:{" "}
                {activeRoute?.truckId
                  ? `${completedStops} / ${totalStops}`
                  : "—"}
              </p>
            </div>

            {/* 3. Truck Details Grid */}
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex w-full justify-between items-center border-b border-slate-50 pb-1">
                  <span className="text-xs font-medium text-slate-500">
                    Plate No.
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    ABC-1234
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex w-full justify-between items-center border-b border-slate-50 pb-1">
                  <span className="text-xs font-medium text-slate-500">
                    Driver
                  </span>
                  <span className="text-xs font-bold text-slate-800 truncate max-w-[150px]">
                    {activeFleet?.driverName || activeRoute?.driverName || "—"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex w-full justify-between items-center border-b border-slate-50 pb-1">
                  <span className="text-xs font-medium text-slate-500">
                    Barangay
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {official?.barangay || "N/A"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex w-full justify-between items-center border-b border-slate-50 pb-1">
                  <span className="text-xs font-medium text-slate-500">
                    Est. Finish
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    2:30 PM
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Route Stops List */}
          <div className="flex-1 overflow-y-auto px-5 pt-3 pb-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Route Stops ({totalStops})
              </h3>
              {selectedRoute && (
                <button
                  onClick={() => setSelectedRoute(null)}
                  className="text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!activeRoute ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <MapPin className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">
                  Click a route on the map
                </p>
              </div>
            ) : (
              <div className="space-y-0.5 pb-2">
                {activeRoute.waypoints.map((wp, i) => {
                  const isAssigned = !!activeRoute.truckId;
                  const isCompleted = isAssigned && i < completedStops;
                  const isCurrent = isAssigned && i === completedStops;
                  const isUpcoming = !isAssigned || i > completedStops;

                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${isCurrent ? "bg-emerald-50/80 border-l-4 border-emerald-600 pl-2" : "border-l-4 border-transparent pl-2.5"}`}
                    >
                      {/* Dot / Check */}
                      <div className="flex-shrink-0">
                        {isCompleted && (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white shadow-sm">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        {isCurrent && (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] text-white font-bold shadow-sm">
                            {i + 1}
                          </div>
                        )}
                        {isUpcoming && (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-medium bg-white shadow-sm">
                            {i + 1}
                          </div>
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p
                          className={`text-[13px] font-medium truncate ${isCurrent ? "text-emerald-700" : isCompleted ? "text-slate-500" : "text-slate-700"}`}
                        >
                          {i + 1}. {wp.name}
                        </p>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-emerald-600">
                            CURRENT
                          </span>
                        )}
                      </div>

                      {/* Time */}
                      <div className="text-[10px] text-slate-400 font-medium flex-shrink-0">
                        {isCompleted ? "8:05 AM" : isCurrent ? "" : "Upcoming"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-1 text-[9px] text-slate-400 italic border-t border-slate-100 pt-2 pb-4">
              * Times are estimates only
            </div>
          </div>
        </div>

        {/* === RIGHT MAP AREA ================================= */}
        <div className="flex-1 bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden relative flex flex-col">
          {/* ── Top Navigation Bar ── */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white z-20">
            <div className="flex items-center gap-4">
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm hover:bg-slate-50 cursor-pointer">
                <span className="text-sm font-medium text-slate-700">
                  Barangay: {official?.barangay || "All"}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm hover:bg-slate-50 cursor-pointer">
                <Truck className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">
                  All Trucks
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
              <button
                onClick={fetchData}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>

          {/* ── Map Container ── */}
          <div className="flex-1 relative bg-slate-100">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center bg-white">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Loading map data…</p>
                </div>
              </div>
            ) : (
              <MapContainer
                center={CEBU_CENTER}
                zoom={14}
                className="w-full h-full"
                zoomControl={false}
              >
                <TileLayer
                  key={activeTileKey}
                  className={
                    GOOGLE_MAP_TILES[activeTileKey]?.className ||
                    "leaflet-tile-grayscale"
                  }
                  url={
                    GOOGLE_MAP_TILES[activeTileKey]?.url ||
                    GOOGLE_MAP_TILES.grayscale.url
                  }
                  attribution={
                    GOOGLE_MAP_TILES[activeTileKey]?.attribution ||
                    "&copy; OpenStreetMap contributors"
                  }
                />

                {/* Route Polylines */}
                {mappableRoutes.map((route) => {
                  const isSelected = selectedRoute?._id === route._id;
                  const hasDriver = !!route.truckId;
                  const validCoords = (route.routeCoords || []).filter(
                    ([lat, lng]) =>
                      lat != null && lng != null && !isNaN(lat) && !isNaN(lng),
                  );
                  if (validCoords.length === 0) return null;
                  return (
                    <span key={route._id}>
                      {/* High-Contrast Polyline Casing */}
                      <Polyline
                        positions={validCoords}
                        color="#ffffff"
                        weight={isSelected ? 8 : 6}
                        opacity={0.9}
                      />
                      <Polyline
                        positions={validCoords}
                        color={
                          isSelected
                            ? "#059669"
                            : hasDriver
                              ? "#2563eb"
                              : "#64748b"
                        }
                        weight={isSelected ? 5 : 3.5}
                        opacity={1.0}
                        eventHandlers={{
                          click: () =>
                            setSelectedRoute(isSelected ? null : route),
                        }}
                      />
                      {/* Route Waypoints (Always visible) */}
                      {route.waypoints
                          .filter(
                            (wp) =>
                              wp.lat != null &&
                              wp.lng != null &&
                              !isNaN(wp.lat) &&
                              !isNaN(wp.lng),
                          )
                          .map((wp, i) => {
                            const isComp = i < completedStops;
                            const isCurr = i === completedStops;
                            return (
                              <Marker
                                key={i}
                                position={[wp.lat, wp.lng]}
                                icon={makeStopIcon(
                                  i + 1,
                                  i === 0,
                                  i === route.waypoints.length - 1,
                                  isComp,
                                  isCurr,
                                )}
                              >
                                <Popup>
                                  <AddressPopup wp={wp} />
                                </Popup>
                              </Marker>
                            );
                          })}
                    </span>
                  );
                })}

                {/* Truck Markers */}
                {Object.values(trucks)
                  .filter(
                    (t) =>
                      t.lat != null &&
                      t.lng != null &&
                      !isNaN(t.lat) &&
                      !isNaN(t.lng),
                  )
                  .map((truck) => (
                    <Marker
                      key={truck.truckId}
                      position={[truck.lat, truck.lng]}
                      icon={makeTruckIcon(truck.status, truck.heading || 0)}
                    >
                      <Tooltip direction="top" offset={[0, -20]}>
                        <span className="font-bold text-sm">
                          {truck.truckId}
                        </span>
                      </Tooltip>
                    </Marker>
                  ))}

                {/* Overflowing Bin Markers */}
                {showReports &&
                  reports
                    .filter(
                      (r) =>
                        r.lat != null &&
                        r.lng != null &&
                        !isNaN(r.lat) &&
                        !isNaN(r.lng),
                    )
                    .map((r) => (
                      <Marker
                        key={r._id}
                        position={[r.lat, r.lng]}
                        icon={makeBinIcon(
                          (r.upvotes?.length || 0) - (r.downvotes?.length || 0),
                        )}
                        eventHandlers={{ click: () => setSelectedReport(r) }}
                      >
                        <Tooltip direction="top" offset={[0, -20]}>
                          <span className="font-bold text-sm">
                            Overflowing Bin
                          </span>
                        </Tooltip>
                      </Marker>
                    ))}
              </MapContainer>
            )}

            {/* ── MAP OVERLAYS ── */}

            {/* Google Maps Style Control (Top Right) */}
            <MapTileControl
              activeTileKey={activeTileKey}
              onChangeTile={setActiveTileKey}
            />

            {/* Additional Top Right Actions */}
            <div className="absolute top-14 right-3 z-[1000] flex flex-col gap-2">
              <button
                onClick={() => setShowReports((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-lg bg-white/95 backdrop-blur-md text-slate-700 border border-slate-200/80 hover:bg-slate-50 transition-all"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />{" "}
                {showReports ? "Hide Alerts" : "Show Alerts"}
              </button>
            </div>

            {/* LEGEND BOX */}
            <div className="absolute top-28 right-3 z-[1000] bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-200/80 min-w-[150px]">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                Legend
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" /> Truck (Live)
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <div className="w-4 h-1 bg-emerald-600 rounded-full"></div> Selected Route
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <div className="w-4 h-1 bg-blue-600 rounded-full"></div> Active Route
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <div className="w-4 h-1 bg-slate-400 rounded-full"></div> Inactive Route
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full border border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold">✓</div> Completed Stop
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <div className="w-3.5 h-3.5 bg-blue-600 rounded-full border border-white shadow-sm"></div> Current Stop
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <div className="w-3.5 h-3.5 bg-slate-500 rounded-full border border-white shadow-sm"></div> Upcoming Stop
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-rose-700 font-semibold pt-1 border-t border-slate-100 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Waste Report Alert
                </div>
              </div>
            </div>

            {/* Map Zoom Controls */}
            <div className="absolute bottom-6 left-6 z-[1000] flex flex-col bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
              <button className="p-2.5 hover:bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-sm transition-colors">
                +
              </button>
              <button className="p-2.5 hover:bg-slate-50 text-slate-600 font-bold text-sm transition-colors">
                −
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating Modals ── */}
      {assignTarget && (
        <AssignModal
          route={assignTarget}
          fleet={fleet}
          onClose={() => setAssignTarget(null)}
          onSave={handleAssignSave}
        />
      )}
      {selectedReport && (
        <ReportModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}
