// ============================================================
// === 1. IMPORTS & DEPENDENCIES ==============================
// ============================================================
import { useState, useEffect, useRef, useMemo } from "react";
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
import "leaflet.heat";
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
  Maximize2,
  Flame,
  Grid,
  Palette,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import API from "../config";
import MapTileControl, {
  GOOGLE_MAP_TILES,
} from "../components/route/MapTileControl";

// === CUSTOM IMPORTED ASSETS (SVG ICONS) ===
import gtruck from "../assets/svg/garbage-truck.svg?url";
import trashIcon from "../assets/svg/trash.svg?url";

import {
  CEBU_CENTER,
  WORLD_BOUNDS,
  CEBU_BOUNDS,
  CEBU_CITY_OUTLINE,
  fetchCebuCityBoundary,
} from "../utils/mapBoundary";

// ============================================================
// === 2. MAP ICON MAKERS ======================================
// ============================================================

/**
 * Creates a dynamic, rotating Truck Icon using the imported SVG.
 * - Rotates based on the map heading (offset by -90 degrees to align North).
 * - Pulse effect appears when the truck status is 'online'.
 */
function makeTruckIcon(status, heading = 0, isOffRoute = false) {
  const isOnline = status === "online";
  const pinColor = isOffRoute ? "#dc2626" : isOnline ? "#059669" : "#475569";
  const pulseColor = isOffRoute
    ? "rgba(220, 38, 38, 0.6)"
    : isOnline
      ? "rgba(16, 185, 129, 0.4)"
      : "rgba(100, 116, 139, 0.2)";
  const isMovingWest = heading > 180 && heading < 360;
  const flipStyle = isMovingWest ? "transform: scaleX(-1);" : "";

  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center w-12 h-14 justify-end group">
        ${
          isOffRoute
            ? `<div class="absolute -top-4 px-1.5 py-0.5 rounded bg-red-600 text-white text-[8px] font-black tracking-wider uppercase border border-white shadow-xl z-30 animate-bounce">OFF ROUTE</div>`
            : ""
        }
        <!-- Pulsing Aura Ring for Online / Off-Route Truck -->
        ${
          isOnline || isOffRoute
            ? `<div class="absolute top-1 left-1/2 -translate-x-1/2 w-11 h-11 rounded-full animate-ping pointer-events-none" style="background:${pulseColor};"></div>`
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
        <div class="absolute -top-1 -right-0.5 w-4 h-4 rounded-full ${isOffRoute ? "bg-red-600" : isOnline ? "bg-emerald-500" : "bg-slate-400"} border-2 border-white shadow-md z-20"></div>

        <!-- Pinpoint Target Dot on Road Ground -->
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full ${isOffRoute ? "bg-red-600/40 border-red-600" : "bg-emerald-600/30 border-emerald-600"} border animate-pulse"></div>
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
  const pulseColor = isHighUrgency
    ? "rgba(159, 18, 57, 0.7)"
    : "rgba(225, 29, 72, 0.5)";

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
        ${isCurrent ? '<div class="absolute -inset-1 rounded-full bg-blue-500/40 animate-ping"></div>' : ""}
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

/**
 * Renders Leaflet Heatmap Layer for waste density and truck activity hotspots.
 */
function HeatmapLayer({ points, options }) {
  const map = useMap();
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    if (points && points.length > 0) {
      heatLayerRef.current = L.heatLayer(points, options).addTo(map);
    }
    return () => {
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [map, points, options]);

  return null;
}

/**
 * Creates a distinct green pin icon for completed truck pickup locations.
 */
function makePickupCheckpointIcon() {
  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center w-10 h-12 justify-end group">
        <div class="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-emerald-500/30 animate-ping pointer-events-none"></div>
        <div class="relative z-10 flex flex-col items-center filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]">
          <div class="w-8 h-8 rounded-full border-2 border-white bg-emerald-600 shadow-xl flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-emerald-600 -mt-[1px]"></div>
        </div>
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-black/30 rounded-full blur-[1px]"></div>
      </div>
    `,
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    className: "",
  });
}

/**
 * Creates an animated, fade-in clearing broom pin icon for sitios in active clearing progress.
 */
function makeClearingIcon(sitioName, truckId) {
  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center w-12 h-14 justify-end group transition-all duration-500 ease-out animate-fadeIn">
        <!-- Pulsing Aura Ring -->
        <div class="absolute top-1 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-emerald-500/40 animate-ping pointer-events-none"></div>

        <!-- Teardrop Pin Container -->
        <div class="relative z-10 flex flex-col items-center filter drop-shadow-[0_8px_16px_rgba(16,185,129,0.5)]">
          <div class="w-10 h-10 rounded-full border-[2.5px] border-white bg-emerald-600 shadow-2xl flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </div>
          <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-emerald-600 -mt-[1px]"></div>
        </div>

        <!-- Live Status Pill Badge -->
        <div class="absolute -top-2 px-1.5 py-0.5 rounded-full bg-slate-900 text-emerald-300 text-[9px] font-black tracking-wider uppercase border border-emerald-500/60 shadow-lg z-20 flex items-center gap-1 whitespace-nowrap">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          Clearing
        </div>

        <!-- Ground Shadow -->
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-7 h-1 bg-black/40 rounded-full blur-[1px]"></div>
      </div>
    `,
    iconSize: [48, 56],
    iconAnchor: [24, 56],
    className: "",
  });
}

function PickupCheckpointPopupContent({ pickup }) {
  const timeFormatted = pickup.completedAt
    ? new Date(pickup.completedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recently";

  return (
    <div className="p-3 bg-white rounded-xl w-[260px] text-slate-800 space-y-2">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span className="text-xs font-bold text-slate-900 truncate">
            {pickup.stopName || pickup.sitioName || "Waste Pickup Location"}
          </span>
        </div>
        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex-shrink-0">
          Picked Up
        </span>
      </div>

      <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 space-y-1 text-xs">
        <div className="flex items-center justify-between text-slate-600">
          <span className="font-semibold text-slate-500">Truck ID:</span>
          <span className="font-bold text-slate-800">{pickup.truckId}</span>
        </div>
        {pickup.driverName && (
          <div className="flex items-center justify-between text-slate-600">
            <span className="font-semibold text-slate-500">Driver:</span>
            <span className="font-semibold text-slate-800">
              {pickup.driverName}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-slate-600">
          <span className="font-semibold text-slate-500">Arrival Time:</span>
          <span className="font-bold text-emerald-700">{timeFormatted}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
          <span>{timeAgo(pickup.completedAt)}</span>
          {pickup.lat && pickup.lng && (
            <span>
              {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Computes polygon coordinates for a group of route waypoints.
 */
function computeZonePolygon(waypoints) {
  if (!waypoints || waypoints.length === 0) return null;
  const valid = waypoints.filter(
    (w) => w.lat != null && w.lng != null && !isNaN(w.lat) && !isNaN(w.lng),
  );
  if (valid.length === 0) return null;

  if (valid.length === 1) {
    const { lat, lng } = valid[0];
    const offset = 0.0035;
    return [
      [lat + offset, lng - offset],
      [lat + offset, lng + offset],
      [lat - offset, lng + offset],
      [lat - offset, lng - offset],
    ];
  }

  if (valid.length === 2) {
    const minLat = Math.min(valid[0].lat, valid[1].lat) - 0.003;
    const maxLat = Math.max(valid[0].lat, valid[1].lat) + 0.003;
    const minLng = Math.min(valid[0].lng, valid[1].lng) - 0.003;
    const maxLng = Math.max(valid[0].lng, valid[1].lng) + 0.003;
    return [
      [maxLat, minLng],
      [maxLat, maxLng],
      [minLat, maxLng],
      [minLat, minLng],
    ];
  }

  return valid.map((w) => [w.lat, w.lng]);
}

/**
 * Computes centroid [lat, lng] for zone badges.
 */
function computeCentroid(coords) {
  if (!coords || coords.length === 0) return null;
  let sumLat = 0,
    sumLng = 0;
  coords.forEach(([lat, lng]) => {
    sumLat += lat;
    sumLng += lng;
  });
  return [sumLat / coords.length, sumLng / coords.length];
}

/**
 * Creates numbered zone badge pin icons matching the reference screenshot.
 */
function makeZoneBadgeIcon(number, color = "#059669") {
  const label = typeof number === "number" ? `Z${number}` : number;
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)]">
        <div class="px-2 py-0.5 rounded-lg border-2 border-white shadow-2xl flex items-center justify-center font-black text-[11px] text-white tracking-wider" style="background:${color}; text-shadow:0 1px 2px rgba(0,0,0,0.6);">
          <div class="absolute -inset-1 rounded-lg border border-emerald-400/40 animate-pulse pointer-events-none"></div>
          ${label}
        </div>
      </div>
    `,
    iconSize: [38, 24],
    iconAnchor: [19, 12],
    className: "",
  });
}

// ============================================================
// === 3. MODALS ===============================================
// ============================================================

// ── Address Popup (Dynamic Reverse Geocoding) ──
function AddressPopup({ wp }) {
  const [address, setAddress] = useState(wp.address || wp.name);
  const [loading, setLoading] = useState(
    !wp.address && wp.name.startsWith("Stop"),
  );

  useEffect(() => {
    let isMounted = true;
    if (loading) {
      axios
        .get(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${wp.lat}&lon=${wp.lng}&zoom=18&addressdetails=1`,
        )
        .then((res) => {
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
    return () => {
      isMounted = false;
    };
  }, [wp, loading]);

  return (
    <div className="p-1 min-w-[140px] max-w-[220px] text-center">
      {loading ? (
        <span className="text-xs text-slate-500 animate-pulse">
          Fetching address...
        </span>
      ) : (
        <span className="text-xs font-semibold text-slate-800 leading-tight block">
          {address}
        </span>
      )}
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Inline Report Leaflet Popup Content ──
function ReportPopupContent({ report, onStatusUpdate }) {
  const [updating, setUpdating] = useState(false);
  const score = (report.upvotes?.length || 0) - (report.downvotes?.length || 0);
  const isHighUrgency = score >= 5;
  const status = report.status?.toLowerCase() || "pending";

  const handleAction = async (newStatus) => {
    setUpdating(true);
    try {
      await onStatusUpdate(report._id, newStatus);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-2xl w-[310px] sm:w-[330px] text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isHighUrgency
                ? "bg-rose-100 text-rose-600"
                : "bg-amber-100 text-amber-600"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 leading-tight truncate">
              {report.title || "Overflowing Bin"}
            </h4>
            <span className="text-[10px] text-slate-500 font-medium block truncate">
              {report.category || "Waste Report"}
            </span>
          </div>
        </div>

        {/* Urgency Score Badge */}
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex-shrink-0 ${
            isHighUrgency
              ? "bg-rose-600 text-white animate-pulse shadow-sm shadow-rose-600/30"
              : "bg-amber-100 text-amber-800 border border-amber-200"
          }`}
        >
          Score: {score}
        </span>
      </div>

      {/* Description & Location */}
      <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100 space-y-1.5">
        <p className="text-xs font-semibold text-slate-800 leading-relaxed">
          {report.description}
        </p>
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60 flex-wrap gap-1">
          <span className="flex items-center gap-1 font-medium truncate max-w-[170px]">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            {report.sitio
              ? `Sitio ${report.sitio}`
              : report.location || report.barangay || "Barangay Area"}
          </span>
          <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">
            {timeAgo(report.createdAt)}
          </span>
        </div>
      </div>

      {/* Image Evidence Preview if present */}
      {report.reportImage && (
        <div className="mb-3 rounded-xl overflow-hidden border border-slate-100 bg-slate-100">
          <img
            src={report.reportImage}
            alt="Report Evidence"
            className="w-full h-32 object-cover hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      {/* Status Badge & Official Quick Actions */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 mt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Status:
          </span>
          {status === "acknowledged" ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              Acknowledged
            </span>
          ) : status === "in_progress" || status === "in-progress" ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              In Progress
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              Pending
            </span>
          )}
        </div>

        {/* Quick Action Button */}
        {status === "pending" ? (
          <button
            onClick={() => handleAction("acknowledged")}
            disabled={updating}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {updating ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            Acknowledge
          </button>
        ) : status === "acknowledged" ||
          status === "in_progress" ||
          status === "in-progress" ? (
          <button
            onClick={() => handleAction("resolved")}
            disabled={updating}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {updating ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Mark Resolved
          </button>
        ) : null}
      </div>

      <div className="mt-2 text-[10px] text-slate-400 text-right font-medium">
        Reported by {report.reportedBy || "Resident"}
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
  const [collections, setCollections] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deviationAlerts, setDeviationAlerts] = useState([]);
  const [activeTileKey, setActiveTileKey] = useState("grayscale");
  const [showReports, setShowReports] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [selectedColorHex, setSelectedColorHex] = useState("#059669");
  const [selectedBarangay, setSelectedBarangay] = useState(
    official?.barangay || "All",
  );
  const [barangayList, setBarangayList] = useState([]);
  const [clearingSites, setClearingSites] = useState({});
  const [completedRouteAlert, setCompletedRouteAlert] = useState(null);
  const socketRef = useRef(null);

  function FitBoundsToRoutes({ routes }) {
    const map = useMap();

    useEffect(() => {
      if (!routes || routes.length === 0) return;

      // Collect all valid coordinates from routes
      const allCoords = [];

      routes.forEach((route) => {
        // Add route waypoints
        if (route.waypoints) {
          route.waypoints.forEach((wp) => {
            if (
              wp.lat != null &&
              wp.lng != null &&
              !isNaN(wp.lat) &&
              !isNaN(wp.lng)
            ) {
              allCoords.push([wp.lat, wp.lng]);
            }
          });
        }

        // Add route polyline coordinates
        if (route.routeCoords) {
          route.routeCoords.forEach(([lat, lng]) => {
            if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
              allCoords.push([lat, lng]);
            }
          });
        }
      });

      if (allCoords.length === 0) return;

      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }, [routes, map]);

    return null;
  }

  // Sync selectedBarangay with official's barangay restriction
  useEffect(() => {
    if (official?.barangay && official.barangay !== "All") {
      setSelectedBarangay(official.barangay);
    }
  }, [official]);

  // Fetch list of Barangays
  useEffect(() => {
    axios
      .get(`${API}/api/barangays`)
      .then(({ data }) => setBarangayList(data))
      .catch(() => {});
  }, []);

  // Filter reports by selected Barangay
  const filteredReports = useMemo(() => {
    const activeBrgy = selectedBarangay?.toLowerCase();
    if (!activeBrgy || activeBrgy === "all") return reports;
    return reports.filter((r) => r.barangay?.toLowerCase() === activeBrgy);
  }, [reports, selectedBarangay]);

  // Filter routes by selected Barangay
  const visibleRoutes = useMemo(() => {
    const activeBrgy = selectedBarangay?.toLowerCase();
    if (!activeBrgy || activeBrgy === "all") return routes;
    return routes.filter((r) => r.barangay?.toLowerCase() === activeBrgy);
  }, [routes, selectedBarangay]);

  // Dynamic Heatmap Points calculation for report clusters & truck activity
  const heatmapPoints = useMemo(() => {
    const pts = [];
    filteredReports.forEach((r) => {
      if (r.lat != null && r.lng != null && !isNaN(r.lat) && !isNaN(r.lng)) {
        const score = (r.upvotes?.length || 0) - (r.downvotes?.length || 0);
        const intensity = Math.min(1.0, Math.max(0.4, (score + 2) / 6));
        pts.push([r.lat, r.lng, intensity]);
      }
    });
    Object.values(trucks).forEach((t) => {
      if (t.lat != null && t.lng != null && !isNaN(t.lat) && !isNaN(t.lng)) {
        pts.push([t.lat, t.lng, t.status === "online" ? 0.9 : 0.4]);
      }
    });
    visibleRoutes.forEach((rt) => {
      (rt.waypoints || []).forEach((wp) => {
        if (
          wp.lat != null &&
          wp.lng != null &&
          !isNaN(wp.lat) &&
          !isNaN(wp.lng)
        ) {
          pts.push([wp.lat, wp.lng, 0.4]);
        }
      });
    });
    return pts;
  }, [filteredReports, trucks, visibleRoutes]);

  const [cebuCityBoundary, setCebuCityBoundary] = useState(CEBU_CITY_OUTLINE);
  useEffect(() => {
    fetchCebuCityBoundary().then((coords) => {
      if (coords) setCebuCityBoundary(coords);
    });
  }, []);

  // ── API Data Fetching ──
  const fetchData = async () => {
    setLoading(true);
    setLoading(true);
    try {
      const [schedulesRes, trucksRes, fleetRes, reportsRes, collectionsRes] =
        await Promise.all([
          axios.get(`${API}/api/schedules/today`),
          axios.get(`${API}/api/trucks`),
          axios.get(`${API}/api/fleet`),
          axios.get(`${API}/api/reports?category=Overflowing Bin`),
          axios.get(`${API}/api/collections?period=today`),
        ]);

      // Map dynamic scheduled sitio sequences as routes
      const todayScheds = schedulesRes.data.schedules || [];
      const mappedRoutes = todayScheds.map((sched) => {
        const coords =
          sched.routeCoords && sched.routeCoords.length > 0
            ? sched.routeCoords
            : (sched.sitioTasks || []).map((t) => [t.lat, t.lng]);
        const waypoints = (sched.sitioTasks || []).map((t) => ({
          name: t.name,
          lat: t.lat,
          lng: t.lng,
          completed: t.completed,
        }));

        const completedCount = (sched.sitioTasks || []).filter(
          (t) => t.completed,
        ).length;

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
          status: sched.status,
        };
      });

      // Filter routes by LGU official's barangay restriction if set
      const filteredRoutes =
        official?.barangay && official.barangay !== "All"
          ? mappedRoutes.filter(
              (r) =>
                r.barangay?.toLowerCase() === official.barangay.toLowerCase(),
            )
          : mappedRoutes;

      setRoutes(filteredRoutes);
      setFleet(fleetRes.data);

      // Filter visible trucks by official's barangay restriction
      const officialBrgy = official?.barangay?.toLowerCase();
      const isRestricted = officialBrgy && officialBrgy !== "all";

      const allowedTruckIds = isRestricted
        ? new Set([
            ...fleetRes.data
              .filter((f) => f.barangay?.toLowerCase() === officialBrgy)
              .map((f) => f.truckId),
            ...filteredRoutes.map((r) => r.truckId).filter(Boolean),
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
      setCollections(
        (collectionsRes.data || []).filter(
          (c) => c.lat != null && c.lng != null,
        ),
      );
    } catch (err) {
      console.error("Failed to load route monitoring data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReportStatusUpdate = async (reportId, newStatus) => {
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem("gtrash_token")}`,
      };
      const { data } = await axios.patch(
        `${API}/api/reports/${reportId}`,
        { status: newStatus },
        { headers },
      );
      if (newStatus === "resolved") {
        setReports((prev) => prev.filter((r) => r._id !== reportId));
      } else {
        setReports((prev) =>
          prev.map((r) =>
            r._id === reportId ? { ...r, status: newStatus, ...data } : r,
          ),
        );
      }
    } catch (err) {
      console.error("Failed to update report status:", err);
    }
  };

  // ── WebSocket & Socket Listeners ──
  useEffect(() => {
    fetchData();
    const socket = io(API, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("truck:location:update", (data) => {
      setTrucks((prev) => {
        const existing = prev[data.truckId] || {};
        const isOff =
          data.isOffRoute !== undefined ? data.isOffRoute : existing.isOffRoute;
        return {
          ...prev,
          [data.truckId]: {
            ...existing,
            ...data,
            isOffRoute: isOff,
            updatedAt: new Date(),
          },
        };
      });
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
    socket.on("collection:new", (newLog) => {
      if (newLog.lat != null && newLog.lng != null) {
        setCollections((prev) => [newLog, ...prev]);
      }
    });
    socket.on("schedule:task:completed", (data) => {
      if (data.lat != null && data.lng != null) {
        setCollections((prev) => [
          {
            _id: `${data.scheduleId}_${Date.now()}`,
            truckId: data.truckId,
            driverName: data.driverName,
            stopName: data.sitioName,
            lat: data.lat,
            lng: data.lng,
            completedAt: data.completedAt,
            barangay: data.barangay,
          },
          ...prev,
        ]);
      }
      setClearingSites((prev) => {
        const next = { ...prev };
        delete next[data.sitioName];
        return next;
      });
    });
    socket.on("truck:clearing:update", (data) => {
      setClearingSites((prev) => {
        const next = { ...prev };
        if (data.status === "clearing") {
          next[data.sitioName] = data;
        } else {
          delete next[data.sitioName];
        }
        return next;
      });
    });
    socket.on("route:completed", (data) => {
      setCompletedRouteAlert(data);
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
      setTrucks((prev) => ({
        ...prev,
        [data.truckId]: {
          ...prev[data.truckId],
          isOffRoute: true,
          offRouteDistance: data.distanceM,
          driverName: data.driverName || prev[data.truckId]?.driverName,
          lat: data.lat || prev[data.truckId]?.lat,
          lng: data.lng || prev[data.truckId]?.lng,
        },
      }));
      setDeviationAlerts((prev) => {
        const filtered = prev.filter(
          (a) => a.truckId !== data.truckId || a.type !== "off-route",
        );
        return [
          {
            ...data,
            id: `offroute_${data.truckId}`,
            ts: new Date(),
            type: "off-route",
          },
          ...filtered,
        ].slice(0, 3);
      });
    });
    socket.on("truck:shift-completed", (data) => {
      setTrucks((prev) => ({
        ...prev,
        [data.truckId]: {
          ...prev[data.truckId],
          status: "completed",
          isShiftCompleted: true,
          driverName: data.driverName || prev[data.truckId]?.driverName,
        },
      }));
      setDeviationAlerts((prev) => {
        const filtered = prev.filter(
          (a) => a.truckId !== data.truckId || a.type !== "completed",
        );
        return [
          {
            ...data,
            id: `completed_${data.truckId}`,
            ts: new Date(),
            type: "completed",
          },
          ...filtered,
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
  const mappableRoutes = visibleRoutes.filter((r) => r.routeCoords?.length > 0);
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

      {/* ── Deviation & Off-Route Banner Alerts (Floating Header Overlay) ── */}
      {deviationAlerts.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1500] w-full max-w-xl space-y-2 px-4 pointer-events-auto">
          {deviationAlerts.map((alert) => {
            const isCompleted = alert.type === "completed";
            const isContact = alert.type === "contact";
            return (
              <div
                key={alert.id}
                className={`flex items-center gap-3.5 rounded-2xl p-3.5 border-2 shadow-2xl backdrop-blur-md transition-all ${
                  isCompleted || isContact
                    ? "bg-emerald-950/95 border-emerald-400 text-white"
                    : "bg-red-950/95 border-red-500 text-white animate-pulse"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isCompleted || isContact
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-red-500/30 text-red-400 animate-bounce"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  ) : isContact ? (
                    <Phone className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isCompleted || isContact
                          ? "bg-emerald-500/30 text-emerald-200"
                          : "bg-red-500/40 text-red-200"
                      }`}
                    >
                      {isCompleted
                        ? "SHIFT & PICKUP COMPLETED"
                        : isContact
                          ? "📞 DISPATCH REQUEST"
                          : "⚠️ DRIVER NOT ON ROUTE"}
                    </span>
                    <span className="text-xs font-bold text-slate-200 truncate">
                      Truck {alert.truckId}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-100 mt-1 truncate">
                    {alert.driverName ? `${alert.driverName} · ` : ""}
                    {isCompleted
                      ? `Completed shift & waste pickups for ${alert.routeName || "the route"}`
                      : isContact
                        ? alert.message
                        : `Deviated ~${alert.distanceM || 100}m away from assigned path`}
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
                  className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
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
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Quick Actions
            </span>
            <button
              onClick={() => (window.location.href = "/route-builder")}
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
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeTruck?.isOffRoute ? "bg-red-100 text-red-600" : "bg-emerald-500/10 text-emerald-600"}`}
                >
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900 leading-tight">
                    {activeRoute
                      ? activeRoute.truckId || "Unassigned"
                      : "No Route Selected"}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {activeTruck?.isOffRoute ? (
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black tracking-wider uppercase flex items-center gap-1 animate-pulse shadow-sm">
                        <AlertTriangle className="w-3 h-3 text-white" />
                        OFF ROUTE
                      </span>
                    ) : (
                      <>
                        <span
                          className={`w-2 h-2 rounded-full ${activeTruck?.status === "online" ? "bg-emerald-500" : "bg-slate-400"}`}
                        ></span>
                        <span className="text-xs font-semibold text-slate-500">
                          {activeTruck?.status === "online"
                            ? "Collecting"
                            : activeTruck?.status || "Offline"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Off-Route Alert Card in Sidebar */}
            {activeTruck?.isOffRoute && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-2.5 animate-pulse shadow-sm">
                <AlertTriangle className="w-4.5 h-4.5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-black text-red-800 tracking-wide uppercase">
                    DRIVER NOT ON ROUTE
                  </p>
                  <p className="text-[11px] font-semibold text-red-600 mt-0.5 leading-snug">
                    Truck has deviated ~{activeTruck.offRouteDistance || 100}m
                    away from the assigned collection path!
                  </p>
                </div>
              </div>
            )}

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
              <div className="relative bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-700 shrink-0">
                  Barangay:
                </span>
                {official?.barangay && official.barangay !== "All" ? (
                  <span className="text-sm font-bold text-slate-800">
                    {official.barangay}
                  </span>
                ) : (
                  <select
                    value={selectedBarangay}
                    onChange={(e) => setSelectedBarangay(e.target.value)}
                    className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none cursor-pointer pr-4 appearance-none"
                  >
                    <option value="All">All Barangays</option>
                    {(barangayList.length > 0
                      ? barangayList
                      : Array.from(
                          new Set(
                            reports.map((r) => r.barangay).filter(Boolean),
                          ),
                        )
                    ).map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                )}
                {(!official?.barangay || official.barangay === "All") && (
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-2" />
                )}
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
              <div className="w-full h-full bg-slate-100 animate-pulse flex flex-col justify-between p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="h-6 w-48 bg-slate-200 rounded-lg" />
                    <div className="h-4 w-32 bg-slate-200 rounded" />
                  </div>
                  <div className="h-10 w-40 bg-slate-200 rounded-xl" />
                </div>
                <div className="h-48 w-full max-w-sm bg-white/70 backdrop-blur rounded-2xl p-4 space-y-3 self-end shadow-sm">
                  <div className="h-5 w-36 bg-slate-200 rounded" />
                  <div className="h-10 bg-slate-200 rounded-xl" />
                  <div className="h-10 bg-slate-200 rounded-xl" />
                </div>
              </div>
            ) : (
              <MapContainer
                center={CEBU_CENTER}
                zoom={14}
                className="w-full h-full"
                zoomControl={false}
              >
                <FitBoundsToRoutes routes={mappableRoutes} />
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

                {/* Heatmap Layer */}
                {showHeatmap && (
                  <HeatmapLayer
                    points={heatmapPoints}
                    options={{
                      radius: 30,
                      blur: 20,
                      maxZoom: 17,
                      gradient: {
                        0.2: "#2563eb",
                        0.4: "#06b6d4",
                        0.6: "#10b981",
                        0.8: "#eab308",
                        1.0: "#ef4444",
                      },
                    }}
                  />
                )}

                {/* Zone Polygons & Numbered Centroid Badges */}
                {showZones &&
                  visibleRoutes.map((route, rIdx) => {
                    const poly = computeZonePolygon(route.waypoints);
                    if (!poly) return null;
                    const centroid = computeCentroid(poly);
                    return (
                      <span key={`zone-${route._id || rIdx}`}>
                        <Polygon
                          positions={poly}
                          pathOptions={{
                            fillColor: selectedColorHex,
                            fillOpacity: 0.22,
                            color: selectedColorHex,
                            weight: 2.5,
                            dashArray: "6, 6",
                          }}
                        />
                        {centroid && (
                          <Marker
                            position={centroid}
                            icon={makeZoneBadgeIcon(rIdx + 1, selectedColorHex)}
                          >
                            <Tooltip direction="top" offset={[0, -10]}>
                              <span className="font-bold text-xs">
                                Zone {rIdx + 1}: {route.name}
                              </span>
                            </Tooltip>
                          </Marker>
                        )}
                      </span>
                    );
                  })}

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
                      icon={makeTruckIcon(
                        truck.status,
                        truck.heading || 0,
                        truck.isOffRoute,
                      )}
                    >
                      <Popup className="custom-report-popup" minWidth={240}>
                        <div className="p-3 bg-white rounded-xl text-slate-800 space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="font-bold text-sm text-slate-900">
                              {truck.truckId}
                            </span>
                            {truck.isOffRoute ? (
                              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-black animate-pulse border border-red-200">
                                ⚠️ OFF ROUTE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                {truck.status === "online"
                                  ? "Online"
                                  : truck.status || "Active"}
                              </span>
                            )}
                          </div>
                          {truck.driverName && (
                            <p className="text-xs text-slate-600">
                              Driver:{" "}
                              <strong className="text-slate-900">
                                {truck.driverName}
                              </strong>
                            </p>
                          )}
                          {truck.isOffRoute && (
                            <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                              ⚠️ Deviated ~{truck.offRouteDistance || 100}m from
                              assigned collection path!
                            </div>
                          )}
                        </div>
                      </Popup>
                      <Tooltip direction="top" offset={[0, -20]}>
                        <span
                          className={`font-bold text-xs ${truck.isOffRoute ? "text-red-600 font-black" : "text-slate-800"}`}
                        >
                          {truck.truckId}{" "}
                          {truck.isOffRoute ? "⚠️ (OFF ROUTE)" : ""}
                        </span>
                      </Tooltip>
                    </Marker>
                  ))}

                {/* Overflowing Bin Markers */}
                {showReports &&
                  filteredReports
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
                      >
                        <Popup
                          className="custom-report-popup"
                          minWidth={310}
                          maxWidth={340}
                        >
                          <ReportPopupContent
                            report={r}
                            onStatusUpdate={handleReportStatusUpdate}
                          />
                        </Popup>
                        <Tooltip direction="top" offset={[0, -20]}>
                          <span className="font-bold text-sm">
                            Overflowing Bin
                          </span>
                        </Tooltip>
                      </Marker>
                    ))}

                {/* Completed Pickup Location Checkpoints */}
                {collections
                  .filter(
                    (c) =>
                      c.lat != null &&
                      c.lng != null &&
                      !isNaN(c.lat) &&
                      !isNaN(c.lng) &&
                      (!selectedBarangay ||
                        selectedBarangay.toLowerCase() === "all" ||
                        c.barangay?.toLowerCase() ===
                          selectedBarangay.toLowerCase()),
                  )
                  .map((c) => (
                    <Marker
                      key={
                        c._id || `${c.truckId}-${c.stopName}-${c.completedAt}`
                      }
                      position={[c.lat, c.lng]}
                      icon={makePickupCheckpointIcon()}
                    >
                      <Popup
                        className="custom-report-popup"
                        minWidth={260}
                        maxWidth={280}
                      >
                        <PickupCheckpointPopupContent pickup={c} />
                      </Popup>
                      <Tooltip direction="top" offset={[0, -20]}>
                        <span className="font-bold text-xs text-emerald-800">
                          ✓ Pickup: {c.stopName || "Cleaned"} ({c.truckId})
                        </span>
                      </Tooltip>
                    </Marker>
                  ))}

                {/* Live Clearing In Progress Markers */}
                {Object.values(clearingSites)
                  .filter(
                    (cs) =>
                      cs.lat != null &&
                      cs.lng != null &&
                      !isNaN(cs.lat) &&
                      !isNaN(cs.lng),
                  )
                  .map((cs) => (
                    <Marker
                      key={`clearing-${cs.sitioName}-${cs.truckId}`}
                      position={[cs.lat, cs.lng]}
                      icon={makeClearingIcon(cs.sitioName, cs.truckId)}
                    >
                      <Popup minWidth={220}>
                        <div className="p-2.5 bg-slate-900 text-white rounded-xl space-y-1">
                          <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
                            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                              Clearing In Progress
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {cs.truckId}
                            </span>
                          </div>
                          <p className="text-xs font-extrabold text-slate-100">
                            {cs.sitioName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Driver: {cs.driverName || "Collector"}
                          </p>
                        </div>
                      </Popup>
                      <Tooltip direction="top" offset={[0, -20]}>
                        <span className="font-bold text-xs text-emerald-700">
                          🧹 Clearing: {cs.sitioName} ({cs.truckId})
                        </span>
                      </Tooltip>
                    </Marker>
                  ))}
              </MapContainer>
            )}

            {/* ── MAP OVERLAYS ── */}

            {/* Live Clearing In Progress Banner Alert */}
            {Object.keys(clearingSites).length > 0 && (
              <div className="absolute top-3 right-3 z-[1000] bg-slate-900/95 backdrop-blur-md text-slate-100 px-4 py-2.5 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center gap-3 animate-fadeIn">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
                <div>
                  <p className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                    🧹 Clearing In Progress
                  </p>
                  <p className="text-xs font-bold text-slate-200">
                    {Object.values(clearingSites)
                      .map((c) => `${c.sitioName} (${c.truckId})`)
                      .join(", ")}
                  </p>
                </div>
              </div>
            )}

            {/* Live Route Completed Banner Alert */}
            {completedRouteAlert && (
              <div className="absolute top-3 right-3 z-[1000] bg-emerald-950/95 backdrop-blur-md text-slate-100 px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500 flex items-center gap-3 animate-fadeIn">
                <div className="w-8 h-8 rounded-full bg-emerald-600/40 border border-emerald-400 flex items-center justify-center flex-shrink-0 text-emerald-300">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div className="pr-2">
                  <p className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    Route Completed 100%
                  </p>
                  <p className="text-xs font-bold text-slate-100">
                    {completedRouteAlert.routeName ||
                      `${completedRouteAlert.barangay} Collection Route`}
                  </p>
                  <p className="text-[10px] text-emerald-300/80">
                    Truck: {completedRouteAlert.truckId} · Driver:{" "}
                    {completedRouteAlert.driverName || "Collector"}
                  </p>
                </div>
                <button
                  onClick={() => setCompletedRouteAlert(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Top-Left Floating Map Control Bar (Matching Reference UI) */}
            <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-slate-200/90">
              {/* Route Color Selector Dropdown */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/90 rounded-xl">
                <Palette className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">
                  Route Color:
                </span>
                <div className="flex items-center gap-1.5 ml-1">
                  {[
                    { name: "Emerald", hex: "#059669" },
                    { name: "Ocean", hex: "#2563eb" },
                    { name: "Sunset", hex: "#f59e0b" },
                    { name: "Crimson", hex: "#ef4444" },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setSelectedColorHex(c.hex)}
                      title={c.name}
                      className={`w-4 h-4 rounded-full transition-transform ${selectedColorHex === c.hex ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : "hover:scale-110 opacity-70"}`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="w-px h-5 bg-slate-200"></div>

              {/* Heatmap Toggle Button */}
              <button
                onClick={() => setShowHeatmap((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  showHeatmap
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Flame
                  className={`w-4 h-4 ${showHeatmap ? "animate-pulse text-amber-300" : "text-slate-400"}`}
                />
                Heatmap
              </button>

              {/* Zones Toggle Button */}
              <button
                onClick={() => setShowZones((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  showZones
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Grid className="w-4 h-4" />
                Zones
              </button>

              {/* Reports Alert Toggle Button */}
              <button
                onClick={() => setShowReports((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  showReports
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                Alerts ({filteredReports.length})
              </button>
            </div>

            {/* Google Maps Style Control (Top Right) */}
            <MapTileControl
              activeTileKey={activeTileKey}
              onChangeTile={setActiveTileKey}
            />

            {/* LEGEND BOX */}
            <div className="absolute top-14 right-3 z-[1000] bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-200/80 min-w-[160px]">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                Legend
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" /> Truck
                  (Live)
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: selectedColorHex }}
                  >
                    1
                  </div>{" "}
                  Zone Boundary
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <div
                    className="w-4 h-1 rounded-full"
                    style={{ backgroundColor: selectedColorHex }}
                  ></div>{" "}
                  Route Path
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-rose-500 opacity-80"></div>{" "}
                  Heatmap Glow
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full border border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold">
                    ✓
                  </div>{" "}
                  Completed Stop
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-medium">
                  <div className="w-3.5 h-3.5 bg-blue-600 rounded-full border border-white shadow-sm"></div>{" "}
                  Current Stop
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-rose-700 font-semibold pt-1 border-t border-slate-100 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Waste
                  Report Alert
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
    </div>
  );
}
