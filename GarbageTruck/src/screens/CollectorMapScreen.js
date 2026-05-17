import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  ScrollView,
  Dimensions,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  TextInput,
  AppState,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";
import TRUCK_B64 from "../constants/truckBase64";

const TRACKING_SERVER = API_URL;

// ═══════════════════════════════════════════════════════════
// ORS API KEY – same as resident app
// ═══════════════════════════════════════════════════════════
const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjQ1N2I3YTYyYzZiMTRjZTc5MjI5OTdhNWI3NTIzY2I1IiwiaCI6Im11cm11cjY0In0=";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const COLLAPSED_HEIGHT = 80;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.48;

// Formats a stop schedule time from a zero-based index (08:00, 08:45, 09:30, …)
function formatStopTime(index) {
  const totalMinutes = 8 * 60 + index * 45;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Converts backend route waypoints to the stops shape used in this screen
function waypointsToStops(waypoints) {
  const types = ['General', 'Recyclables', 'Mixed'];
  return waypoints.map((wp, i) => ({
    id: i + 1,
    name: wp.name,
    address: wp.name,
    lat: wp.lat,
    lng: wp.lng,
    time: formatStopTime(i),
    status: i === 0 ? 'in-progress' : 'upcoming',
    bins: (i % 3) + 2,
    weight: null,
    type: types[i % 3],
  }));
}

function getTodayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


// ── Heatmap helpers ──────────────────────────────────────
const STATUS_META = {
  critical: {
    color: "#E53935",
    level: "High Pollution",
    riskLevel: "High",
    recommendation: "Immediate collection needed. Schedule additional pickup.",
  },
  moderate: {
    color: "#FDD835",
    level: "Moderate Pollution",
    riskLevel: "Medium",
    recommendation: "Monitor closely. Standard collection schedule adequate.",
  },
  clean: {
    color: "#4CAF50",
    level: "Safe Levels",
    riskLevel: "Low",
    recommendation: "Area well maintained. Continue regular monitoring.",
  },
};

function formatRelativeTime(date) {
  if (!date) return "Unknown";
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs !== 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
}

// Maps a raw GarbageArea document to the shape expected by the zone card UI
function formatGarbageArea(area) {
  const meta = STATUS_META[area.status] || STATUS_META.moderate;
  return {
    id: area._id || area.id,
    name: area.name,
    lat: area.lat,
    lng: area.lng,
    status: area.status,
    color: meta.color,
    level: meta.level,
    riskLevel: meta.riskLevel,
    recommendation: meta.recommendation,
    ammonia: area.ammonia || "0 ppm",
    methane: area.methane || "0 ppm",
    bins: area.bins ?? 0,
    intensity: area.intensity ?? 0.5,
    barangay: area.barangay || "",
    reportCount: area.reportCount ?? 0,
    lastUpdated: formatRelativeTime(area.lastReportAt || area.updatedAt || area.createdAt),
  };
}

// ── Leaflet HTML ───────────────────────────────────────────
function buildLeafletHTML(truckB64) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { height:100%; width:100%; overflow:hidden; }
    #map-perspective {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #e8ede8;
    }
    #map {
      width: 100%;
      height: 100%;
    }
    @keyframes pulse-red {
      0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
      100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
    }
  </style>
</head>
<body>
  <div id="map-perspective">
    <div id="map"></div>
  </div>
  <script>
    (function() {
      var map, routeLayer, currentMarker;

      var southWest = new L.LatLng(10.275, 123.845);
      var northEast = new L.LatLng(10.355, 123.925);
      var cebuBounds = new L.LatLngBounds(southWest, northEast);

      map = new L.Map('map', {
        zoomControl: false, attributionControl: false, dragging: true,
        scrollWheelZoom: false, doubleClickZoom: true, touchZoom: true,
        minZoom: 10, maxZoom: 18,
        inertia: true, inertiaDeceleration: 3000,
      });
      map.setView([10.325, 123.893], 14);

      var tileLayer, hillshadeLayer, labelsLayer;
      function setTileLayer(style) {
        if (tileLayer) map.removeLayer(tileLayer);
        if (hillshadeLayer) map.removeLayer(hillshadeLayer);
        if (labelsLayer) map.removeLayer(labelsLayer);

        if (style === 'satellite') {
          tileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 18, minZoom: 10, attribution: '' }
          );
        } else if (style === 'topographic') {
          tileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 18, minZoom: 10, attribution: '' }
          );
          hillshadeLayer = L.tileLayer(
            'https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png',
            { opacity: 0.25, maxZoom: 18 }
          ).addTo(map);
          labelsLayer = L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
            { opacity: 0.7, maxZoom: 18 }
          ).addTo(map);
        } else {
          tileLayer = L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            { opacity: 0.9, maxZoom: 17, minZoom: 13 }
          );
        }
        tileLayer.addTo(map);
      }
      setTileLayer('topographic');
      window.setMapStyle = setTileLayer;

      var CEBU_OUTLINE = [[10.4215,123.8572],[10.4198,123.8712],[10.4148,123.8825],[10.4062,123.8945],[10.3945,123.9068],[10.3835,123.9152],[10.3712,123.9212],[10.3582,123.9248],[10.3448,123.9232],[10.3318,123.9195],[10.3188,123.9148],[10.3062,123.9085],[10.2945,123.9025],[10.2828,123.8962],[10.2712,123.8885],[10.2598,123.8798],[10.2492,123.8698],[10.2395,123.8595],[10.2302,123.8478],[10.2225,123.8352],[10.2168,123.8218],[10.2142,123.8072],[10.2148,123.7928],[10.2188,123.7802],[10.2268,123.7702],[10.2385,123.7638],[10.2525,123.7602],[10.2678,123.7598],[10.2835,123.7632],[10.2988,123.7702],[10.3128,123.7782],[10.3262,123.7868],[10.3395,123.7968],[10.3528,123.8058],[10.3658,123.8152],[10.3788,123.8252],[10.3908,123.8358],[10.4015,123.8452],[10.4108,123.8512],[10.4215,123.8572]];
      var cityOutlineLayer = null;
      window.toggleCityOutline = function(show) {
        if (show && !cityOutlineLayer) {
          cityOutlineLayer = L.polyline(CEBU_OUTLINE, { color: '#2563EB', weight: 2, opacity: 0.55, dashArray: '10, 7', interactive: false }).addTo(map);
        } else if (!show && cityOutlineLayer) {
          map.removeLayer(cityOutlineLayer);
          cityOutlineLayer = null;
        }
      };
      window.toggleCityOutline(true);

      // Report marker icons
      function makeBinHtml(score) {
        var isHigh = score >= 5;
        var color = isHigh ? '#EF4444' : '#F59E0B';
        return '<div style="position:relative;display:flex;flex-direction:column;align-items:center;">' +
          '<div style="background:#fff;padding:2px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:1px solid #e2e8f0;'+(isHigh ? 'animation:pulse-red 2s infinite;' : '')+'">' +
            '<div style="background:'+color+';width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 -1px 0 rgba(0,0,0,0.15);">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>' +
            '</div>' +
          '</div>' +
          '<div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:6px solid #fff;margin-top:-2px;"></div>' +
          (isHigh ? '<div style="position:absolute;top:-4px;right:-4px;background:#EF4444;color:#fff;width:14px;height:14px;border-radius:7px;font-size:7px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.2);z-index:2;">' + score + '</div>' : '') +
        '</div>';
      }
 
      var reportMarkers = [];
      window.clearReportMarkers = function() {
        reportMarkers.forEach(function(m) { map.removeLayer(m); });
        reportMarkers = [];
      };
      window.addReportMarkers = function(reportsJson) {
        window.clearReportMarkers();
        var arr = JSON.parse(reportsJson);
        arr.forEach(function(r) {
          var icon = L.divIcon({ html: makeBinHtml(r.score), iconSize:[20,26], iconAnchor:[10,26], className:'' });
          var m = L.marker([r.lat, r.lng], { icon: icon });
          m.on('click', function() { window.ReactNativeWebView.postMessage('report:' + r.id); });
          m.addTo(map);
          reportMarkers.push(m);
        });
      };

      // ── Dynamic heatmap zones (injected from React Native) ──
      var heatmapLayers = [];

      window.clearHeatmapZones = function() {
        heatmapLayers.forEach(function(l) { map.removeLayer(l); });
        heatmapLayers = [];
      };

      // Each zone: { id, lat, lng, status, intensity }
      // Uses L.circle (meter-based radius) so size is geographically correct
      // and does NOT change with CSS transforms — only scales with real zoom.
      window.updateHeatmapZones = function(zonesJson) {
        window.clearHeatmapZones();
        var zones;
        try { zones = JSON.parse(zonesJson); } catch(e) { return; }
        zones.forEach(function(zone) {
          if (zone.lat == null || zone.lng == null) return;
          var color = zone.status === 'critical' ? '#E53935'
                    : zone.status === 'moderate'  ? '#FDD835'
                    : '#4CAF50';
          var fillOpacity = zone.status === 'critical' ? 0.38
                          : zone.status === 'moderate'  ? 0.28
                          : 0.2;
          // radius in METERS — intensity (0–1) scales coverage from 80 m to 450 m
          var radius = Math.max(80, Math.min(450, (zone.intensity || 0.5) * 450));
          var circle = L.circle([zone.lat, zone.lng], {
            radius: radius,
            color: color,
            fillColor: color,
            fillOpacity: fillOpacity,
            weight: 2,
            opacity: 0.9,
            interactive: true,
          });
          circle.on('click', function() {
            window.ReactNativeWebView.postMessage('heatmap:' + zone.id);
          });
          circle.addTo(map);
          heatmapLayers.push(circle);
        });
      };

      // Stop marker icons
      var completedIcon = L.divIcon({ html:'<div style="background:#006E1C;width:14px;height:14px;border-radius:7px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2);"></div>', iconSize:[14,14], iconAnchor:[7,7], className:'' });
      var activeIcon = L.divIcon({ html:'<div style="background:#006A3B;width:20px;height:20px;border-radius:10px;border:3px solid white;box-shadow:0 2px 8px rgba(0,106,59,0.4);"></div>', iconSize:[20,20], iconAnchor:[10,10], className:'' });
      var upcomingIcon = L.divIcon({ html:'<div style="background:#BECABE;width:12px;height:12px;border-radius:6px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.15);"></div>', iconSize:[12,12], iconAnchor:[6,6], className:'' });

      // Dynamic stop markers — injected from React Native when route loads
      var stopMarkers = [];
      window.clearStopMarkers = function() {
        stopMarkers.forEach(function(m) { map.removeLayer(m); });
        stopMarkers = [];
      };
      window.addStopMarkers = function(stopsJson) {
        window.clearStopMarkers();
        var arr = JSON.parse(stopsJson);
        arr.forEach(function(s) {
          var icon = s.status === 'completed' ? completedIcon : s.status === 'in-progress' ? activeIcon : upcomingIcon;
          var m = L.marker([s.lat, s.lng], { icon: icon });
          m.addTo(map);
          stopMarkers.push(m);
        });
      };

      // Dynamic route layer
      window.updateTruckRoute = function(coordsJson) {
        if (routeLayer) { map.removeLayer(routeLayer); }
        var coords = JSON.parse(coordsJson);
        if (coords && coords.length > 0) {
          routeLayer = L.polyline(coords, {
            color: '#006A3B',
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);
          map.fitBounds(routeLayer.getBounds().pad(0.1));
        }
      };

      var TB = '${truckB64}';

      // Navigation Arrow (Directional Triangle)
      function createArrowMarker(lat, lng, bearing) {
        var arrowHtml =
          '<div style="transform: rotate(' + (bearing || 0) + 'deg); filter: drop-shadow(0 4px 10px rgba(0,106,59,0.3));">' +
            '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M20 5L32 32L20 26L8 32L20 5Z" fill="#2196F3" stroke="white" stroke-width="2.5" stroke-linejoin="round" />' +
            '</svg>' +
          '</div>';
        var navIcon = L.divIcon({
          html: arrowHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          className: ''
        });
        return L.marker([lat, lng], { icon: navIcon, zIndexOffset: 2000 });
      }

      function getBearing(lat1, lng1, lat2, lng2) {
        var dLon = (lng2 - lng1) * Math.PI / 180;
        var y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
        var x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
        var brng = Math.atan2(y, x) * 180 / Math.PI;
        return (brng + 360) % 360;
      }

      var followMode = false;

      // Moves the arrow to the driver's real GPS position
      window.updateDriverPosition = function(lat, lng, bearing) {
        if (currentMarker) { map.removeLayer(currentMarker); }
        currentMarker = createArrowMarker(lat, lng, bearing || 0);
        currentMarker.addTo(map);
        if (followMode) {
          map.panTo([lat, lng], { animate: true, duration: 0.5 });
        }
      };

      // Called when navigation starts — zooms in and enables auto-follow
      window.startFollow = function(lat, lng, heading) {
        followMode = true;
        if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
        currentMarker = createArrowMarker(lat, lng, heading || 0);
        currentMarker.addTo(map);
        map.flyTo([lat, lng], 17, { duration: 1.2, easeLinearity: 0.25 });
      };

      // Called when navigation ends — disables auto-follow
      window.stopFollow = function() {
        followMode = false;
      };

      // Gray idle navigation arrow
      window.showIdleTruck = function(lat, lng) {
        if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
        var idleHtml =
          '<div style="opacity:0.6; filter: grayscale(100%);">' +
            '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M20 5L32 32L20 26L8 32L20 5Z" fill="#9CA3AF" stroke="white" stroke-width="2.5" stroke-linejoin="round" />' +
            '</svg>' +
          '</div>';
        var idleIcon = L.divIcon({ html: idleHtml, iconSize: [40, 40], iconAnchor: [20, 20], className: '' });
        currentMarker = L.marker([lat, lng], { icon: idleIcon, zIndexOffset: 2000 });
        currentMarker.addTo(map);
      };

      window.centerMap = function(lat, lng) {
        map.flyTo([lat, lng], 16, {
          duration: 1.5,
          easeLinearity: 0.25
        });
      };

      window.stopNavigation = function(lat, lng) {
        if (currentMarker) { map.removeLayer(currentMarker); currentMarker = null; }
        if (lat !== undefined && lng !== undefined) {
          window.showIdleTruck(lat, lng);
        }
      };

      setTimeout(function() { 
        map.invalidateSize(); 
        window.ReactNativeWebView.postMessage('map_ready');
      }, 200);
    })();
  </script>
</body>
</html>`;
}

// ── Route deviation helpers ───────────────────────────────
function toRad(deg) { return deg * Math.PI / 180; }
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function pointToSegmentM(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLat - aLat, dy = bLng - aLng;
  if (dx === 0 && dy === 0) return haversineM(pLat, pLng, aLat, aLng);
  const t = Math.max(0, Math.min(1,
    ((pLat - aLat) * dx + (pLng - aLng) * dy) / (dx * dx + dy * dy)));
  return haversineM(pLat, pLng, aLat + t * dx, aLng + t * dy);
}
function minDistToPolyline(lat, lng, coords) {
  if (!coords || coords.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = pointToSegmentM(lat, lng, coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    if (d < min) min = d;
  }
  return min;
}

// ── ORS fetch helper (unchanged) ──────────────────────────
async function fetchORSRoute(waypoints) {
  if (!ORS_API_KEY || ORS_API_KEY === "YOUR_ORS_API_KEY") return null;
  try {
    const response = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json, application/geo+json",
        },
        body: JSON.stringify({ coordinates: waypoints }),
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data.features?.[0]?.geometry?.coordinates) {
      return data.features[0].geometry.coordinates.map((c) => [c[1], c[0]]);
    }
    return null;
  } catch (e) {
    console.warn("ORS fetch failed:", e.message);
    return null;
  }
}

// ── Main Component (identical to yours) ──────────────────
export default function CollectorMapScreen() {
  const { user } = useAuth();
  // Helper for distance calculation
  const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const TRUCK_ID = user?.truckId ?? 'GT-000';
  const { bottom: bottomInset } = useSafeAreaInsets();
  const [stops, setStops] = useState([]);
  const [routeAssigned, setRouteAssigned] = useState(false);
  const [assignedRouteName, setAssignedRouteName] = useState('');
  const [assignedRouteBarangay, setAssignedRouteBarangay] = useState('');
  const [todaySchedules, setTodaySchedules] = useState(null); // null=loading, []=not scheduled
  const [activeScheduleId, setActiveScheduleId] = useState(null);
  const [isPreferredRoute, setIsPreferredRoute] = useState(false);

  // Fetch all of today's scheduled routes for this truck
  const fetchTodaySchedules = useCallback(() => {
    const today = getTodayYMD();
    const truckIdUpper = TRUCK_ID.toUpperCase();
    const url = `${TRACKING_SERVER}/api/schedules/truck/${truckIdUpper}/today?date=${today}`;
    console.log(`[App] Fetching schedules from: ${url}`);
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.timeout = 6000;
    xhr.onload = () => {
      console.log(`[App] Schedule response status: ${xhr.status}`);
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          console.log(`[App] Received schedules:`, data);
          const list = Array.isArray(data.schedules)
            ? data.schedules
            : data.schedule
              ? [data.schedule]
              : [];
          
          setTodaySchedules(list);
          
          setActiveScheduleId(prev => {
            const next = (prev && list.find(s => s._id === prev)) ? prev : (list[0]?._id || null);
            console.log(`[App] Setting activeScheduleId: ${next} (was: ${prev})`);
            return next;
          });
        } catch (e) {
          console.error(`[App] Parse error in schedules:`, e);
          setTodaySchedules([]);
          setRouteAssigned(false);
        }
      } else {
        console.warn(`[App] Non-200 status for schedules: ${xhr.status}`);
        setTodaySchedules([]);
        setRouteAssigned(false);
      }
    };
    xhr.onerror = (e) => { console.error(`[App] XHR Error (Schedules):`, e); setTodaySchedules([]); setRouteAssigned(false); };
    xhr.ontimeout = () => { console.warn(`[App] XHR Timeout (Schedules)`); setTodaySchedules([]); setRouteAssigned(false); };
    xhr.send();
  }, [TRUCK_ID]);

  useEffect(() => {
    console.log(`[App] Route Effect Triggered. activeScheduleId: ${activeScheduleId}, hasTodaySchedules: ${!!todaySchedules}`);
    if (!activeScheduleId || !todaySchedules) {
      if (todaySchedules && todaySchedules.length === 0) {
        // No schedule — try preferred route from AsyncStorage
        AsyncStorage.getItem('@truck_route_preference').then((val) => {
          if (!val) { setRouteAssigned(false); setStops([]); routeCoordsRef.current = []; return; }
          const pref = JSON.parse(val);
          if (!pref?.id) { setRouteAssigned(false); setStops([]); routeCoordsRef.current = []; return; }
          console.log(`[App] No schedule — loading preferred route: ${pref.name}`);
          const xhr = new XMLHttpRequest();
          xhr.open('GET', `${TRACKING_SERVER}/api/routes/${pref.id}`);
          xhr.timeout = 6000;
          xhr.onload = () => {
            if (xhr.status === 200) {
              try {
                const route = JSON.parse(xhr.responseText);
                if (route.waypoints?.length >= 1) {
                  setStops(waypointsToStops(route.waypoints));
                  setRouteAssigned(true);
                  setIsPreferredRoute(true);
                  setAssignedRouteName(route.name || '');
                  setAssignedRouteBarangay(route.barangay || '');
                  routeCoordsRef.current = route.routeCoords?.length > 1
                    ? route.routeCoords
                    : route.waypoints.map(wp => [wp.lat, wp.lng]);
                } else {
                  setRouteAssigned(false); setStops([]); routeCoordsRef.current = [];
                }
              } catch { setRouteAssigned(false); setStops([]); routeCoordsRef.current = []; }
            } else {
              setRouteAssigned(false); setStops([]); routeCoordsRef.current = [];
            }
          };
          xhr.onerror = () => { setRouteAssigned(false); setStops([]); routeCoordsRef.current = []; };
          xhr.ontimeout = () => { setRouteAssigned(false); setStops([]); routeCoordsRef.current = []; };
          xhr.send();
        }).catch(() => { setRouteAssigned(false); setStops([]); routeCoordsRef.current = []; });

        routeCoordsRef.current = [];
      }
      return;
    }
    const sched = todaySchedules.find(s => s._id === activeScheduleId);
    console.log(`[App] Found schedule in list:`, sched);
    
    if (!sched?.routeId) {
      console.warn(`[App] Schedule has no routeId!`);
      setRouteAssigned(false);
      setStops([]);
      routeCoordsRef.current = [];
      return;
    }
    
    const url = `${TRACKING_SERVER}/api/routes/${sched.routeId}`;
    console.log(`[App] Fetching route waypoints from: ${url}`);
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.timeout = 6000;
    xhr.onload = () => {
      console.log(`[App] Route response status: ${xhr.status}`);
      if (xhr.status === 200) {
        try {
          const route = JSON.parse(xhr.responseText);
          console.log(`[App] Received route data:`, route);
          if (route.waypoints?.length >= 1) {
            setStops(waypointsToStops(route.waypoints));
            setRouteAssigned(true);
            setIsPreferredRoute(false);
            setAssignedRouteName(route.name || '');
            setAssignedRouteBarangay(route.barangay || '');
            routeCoordsRef.current = route.routeCoords?.length > 1
              ? route.routeCoords
              : route.waypoints.map(wp => [wp.lat, wp.lng]);
            console.log(`[App] Route successfully assigned: ${route.name}`);
          } else {
            console.warn(`[App] Route has no waypoints!`);
            setRouteAssigned(false);
            setStops([]);
            routeCoordsRef.current = [];
          }
        } catch (e) {
          console.error(`[App] Parse error in route:`, e);
          setRouteAssigned(false);
          setStops([]);
          routeCoordsRef.current = [];
        }
      } else {
        console.warn(`[App] Non-200 status for route: ${xhr.status}`);
        setRouteAssigned(false);
        setStops([]);
        routeCoordsRef.current = [];
      }
    };
    xhr.onerror = (e) => { console.error(`[App] XHR Error (Route):`, e); setRouteAssigned(false); setStops([]); routeCoordsRef.current = []; };
    xhr.ontimeout = () => { console.warn(`[App] XHR Timeout (Route)`); setRouteAssigned(false); setStops([]); routeCoordsRef.current = []; };
    xhr.send();
    return () => xhr.abort();
  }, [activeScheduleId, todaySchedules]);

  // Initial fetch on mount (updates also come via socket events)
  useEffect(() => { fetchTodaySchedules(); }, [fetchTodaySchedules]);

  // Fetch today's bin preparation counts whenever barangay is known
  useEffect(() => {
    if (!assignedRouteBarangay) return;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${TRACKING_SERVER}/api/bin/status?barangay=${encodeURIComponent(assignedRouteBarangay)}`);
    xhr.timeout = 6000;
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          setBinStatus({ preparedCount: data.preparedCount || 0, pickedUpCount: data.pickedUpCount || 0 });
        } catch (_) {}
      }
    };
    xhr.send();
  }, [assignedRouteBarangay]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapStyle, setMapStyle] = useState('topographic');
  const [showSuccess, setShowSuccess] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [heatmapZones, setHeatmapZones] = useState([]); // live from /api/garbage-areas
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showTrashBins, setShowTrashBins] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showCityOutline, setShowCityOutline] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Fetch overflowing bin reports
  const fetchReports = useCallback(() => {
    const url = `${TRACKING_SERVER}/api/reports?category=Overflowing Bin`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          setReports(data.filter(r => r.status !== 'resolved'));
        } catch (e) {}
      }
    };
    xhr.send();
  }, []);

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 30000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  // Fetch live garbage-area heatmap data
  const fetchGarbageAreas = useCallback(() => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${TRACKING_SERVER}/api/garbage-areas`);
    xhr.timeout = 8000;
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          const areas = Array.isArray(data) ? data : (data.areas || []);
          setHeatmapZones(areas.map(formatGarbageArea));
        } catch (e) {}
      }
    };
    xhr.send();
  }, []);

  useEffect(() => {
    fetchGarbageAreas();
    const interval = setInterval(fetchGarbageAreas, 30000);
    return () => clearInterval(interval);
  }, [fetchGarbageAreas]);

  // Inject heatmap zones into WebView whenever zones update
  useEffect(() => {
    if (!webViewReady.current || heatmapZones.length === 0) return;
    const json = JSON.stringify(heatmapZones).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webViewRef.current?.injectJavaScript(`window.updateHeatmapZones('${json}'); true;`);
  }, [heatmapZones]);

  // Inject report markers into WebView
  useEffect(() => {
    if (webViewReady.current) {
      if (!showTrashBins || reports.length === 0) {
        webViewRef.current?.injectJavaScript(`window.clearReportMarkers(); true;`);
        return;
      }
      const payload = reports.map(r => ({
        id: r._id,
        lat: r.lat,
        lng: r.lng,
        score: (r.upvotes?.length || 0) - (r.downvotes?.length || 0)
      }));
      const json = JSON.stringify(payload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(`window.addReportMarkers('${json}'); true;`);
    }
  }, [reports, showTrashBins]);
  const [navigationActive, setNavigationActive] = useState(false);
  const [elapsedDisplay, setElapsedDisplay] = useState("00:00");
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [weightModalStop, setWeightModalStop] = useState(null);
  const [weightInput, setWeightInput] = useState("");
  const [deviationAlert, setDeviationAlert] = useState(false);
  const [deviationInfo, setDeviationInfo] = useState(null);

  const [binStatus, setBinStatus] = useState({ preparedCount: 0, pickedUpCount: 0 });

  const isExpandedRef = useRef(false);
  const navigationActiveRef = useRef(false);
  const lastGpsRef = useRef(null);
  const shiftStartRef = useRef(null);
  const offRouteCountRef = useRef(0);
  const stopArrivalRef = useRef({});
  const routeCoordsRef = useRef([]);
  const successAnim = useRef(new Animated.Value(0)).current;
  const zoneCardAnim = useRef(new Animated.Value(0)).current;
  const socketRef = useRef(null);
  const webViewRef = useRef(null);
  const webViewReady = useRef(false);

  // ── Real-time location tracking ────────────────────────
  useEffect(() => {
    const socket = io(TRACKING_SERVER, { transports: ["polling", "websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🔌 Socket connected:", socket.id);
    });
    socket.on("disconnect", (reason) => {
      console.log("🔌 Socket disconnected:", reason);
    });
    socket.on("connect_error", (err) => {
      console.log("🔌 Socket connect_error:", err.message);
    });

    // Real-time updates pushed by the Officials backend through the relay
    socket.on("schedule:changed", ({ truckId }) => {
      if (truckId === TRUCK_ID) fetchTodaySchedules();
    });
    socket.on("route:assigned", ({ truckId }) => {
      if (truckId === TRUCK_ID) fetchTodaySchedules();
    });
    socket.on("garbage-area:updated", (updated) => {
      setHeatmapZones(prev => {
        const formatted = formatGarbageArea(updated);
        const idx = prev.findIndex(z => z.id === formatted.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = formatted;
          return next;
        }
        return [...prev, formatted];
      });
    });

    socket.on("bin:status:update", ({ barangay, preparedCount, pickedUpCount }) => {
      if (barangay === assignedRouteBarangay || !assignedRouteBarangay) {
        setBinStatus({ preparedCount, pickedUpCount });
      }
    });

    // Receive the offline echo back from server (io.emit broadcasts to all, including self)
    socket.on("truck:status", ({ truckId, status }) => {
      if (truckId === TRUCK_ID && status === "offline") {
        // Local state was already set by stopNavigation() — just ensure the map marker is idle
        const pos = lastGpsRef.current;
        if (pos && webViewRef.current) {
          webViewRef.current?.injectJavaScript(
            `window.showIdleTruck(${pos.lat}, ${pos.lng}); true;`,
          );
        }
      }
    });

    let locationSub = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // Grab an immediate fix so Start Navigation has a position right away
      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude, heading } = initial.coords;
        lastGpsRef.current = { lat: latitude, lng: longitude, heading: heading || 0 };
      } catch (_) {}

      locationSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        ({ coords }) => {
          const { latitude, longitude, heading, speed } = coords;

          lastGpsRef.current = { lat: latitude, lng: longitude, heading: heading || 0 };
          setCurrentLocation({ lat: latitude, lng: longitude });

          // Only stream while navigating
          if (navigationActiveRef.current) {
            setCurrentSpeed(Math.round((speed || 0) * 3.6)); // m/s → km/h
            socket.emit("truck:location", {
              truckId: TRUCK_ID,
              lat: latitude,
              lng: longitude,
              heading: heading || 0,
              speed: speed || 0,
            });

            webViewRef.current?.injectJavaScript(
              `window.updateDriverPosition(${latitude}, ${longitude}, ${heading || 0}); true;`,
            );

            // Record arrival time at in-progress stop (once, when within 50 m)
            setStops((prev) => {
              const inProgress = prev.find((s) => s.status === 'in-progress');
              if (inProgress && !stopArrivalRef.current[inProgress.id]) {
                const d = haversineM(latitude, longitude, inProgress.lat, inProgress.lng);
                if (d <= 50) stopArrivalRef.current[inProgress.id] = Date.now();
              }
              return prev;
            });

            // Off-route deviation check — requires 3 consecutive updates > 150 m
            const dist = minDistToPolyline(latitude, longitude, routeCoordsRef.current);
            if (dist > 150) {
              offRouteCountRef.current += 1;
              if (offRouteCountRef.current >= 3) {
                offRouteCountRef.current = 0;
                setDeviationInfo({ distance: Math.round(dist) });
                setDeviationAlert(true);
                socket.emit('truck:off-route', {
                  truckId: TRUCK_ID,
                  lat: latitude,
                  lng: longitude,
                  distanceM: Math.round(dist),
                  driverName: user?.driverName || '',
                });
              }
            } else {
              offRouteCountRef.current = 0;
            }
          }
        },
      );
    })();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if ((nextState === 'background' || nextState === 'inactive') && navigationActiveRef.current) {
        socket.emit('truck:offline', { truckId: TRUCK_ID });
      }
    });

    return () => {
      appStateSub.remove();
      socket.emit("truck:offline", { truckId: TRUCK_ID });
      socket.disconnect();
      locationSub?.remove();
    };
  }, [fetchTodaySchedules]);
  // Shift elapsed timer — updates every 15 s while navigating
  useEffect(() => {
    if (!navigationActive) return;
    const interval = setInterval(() => {
      if (!shiftStartRef.current) return;
      const mins = Math.floor((Date.now() - shiftStartRef.current) / 60000);
      const hrs = Math.floor(mins / 60);
      setElapsedDisplay(`${String(hrs).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`);
    }, 15000);
    return () => clearInterval(interval);
  }, [navigationActive]);

  const sheetTotalHeight = EXPANDED_HEIGHT + bottomInset;
  const translateCollapsed = sheetTotalHeight - COLLAPSED_HEIGHT;
  const sheetAnim = useRef(new Animated.Value(translateCollapsed)).current;

  const currentStopIndex = stops.findIndex((s) => s.status === "in-progress");
  const completedCount = stops.filter((s) => s.status === "completed").length;
  const remainingCount = stops.length - completedCount;
  const truckStop = currentStopIndex >= 0 ? stops[currentStopIndex] : null;
  const progressPercent =
    stops.length > 0 ? (completedCount / stops.length) * 100 : 0;
  const totalCollected = stops
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + parseInt(s.weight || "0", 10), 0);

  useEffect(() => {
    if (!routeAssigned || stops.length === 0) {
      webViewRef.current?.injectJavaScript(`window.updateTruckRoute('${JSON.stringify([])}'); window.clearStopMarkers(); true;`);
      return;
    }
    let cancelled = false;
    (async () => {
      setRouteLoading(true);
      
      // Filter only upcoming and in-progress stops
      const activeStops = stops.filter(s => s.status !== 'completed');
      if (activeStops.length === 0) {
        setRouteLoading(false);
        return;
      }

      let waypoints = activeStops.map((s) => [s.lng, s.lat]);
      
      // If navigation is active, prepend the truck's current GPS location
      if (navigationActive && lastGpsRef.current) {
        const { lat, lng } = lastGpsRef.current;
        waypoints = [[lng, lat], ...waypoints];
      }

      const coords = await fetchORSRoute(waypoints);
      if (cancelled) return;
      
      const finalCoords = coords || [];
      setRouteLoading(false);
      webViewRef.current?.injectJavaScript(
        `window.updateTruckRoute('${JSON.stringify(finalCoords)}'); true;`,
      );
      
      const markersPayload = stops.map((s) => ({ lat: s.lat, lng: s.lng, status: s.status, name: s.name }));
      const markersJson = JSON.stringify(markersPayload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(`window.addStopMarkers('${markersJson}'); true;`);
    })();
    return () => { cancelled = true; };
  }, [stops, routeAssigned, navigationActive]);

  const handleWebViewMessage = (event) => {
    const message = event.nativeEvent.data;
    if (message === 'map_ready') {
      webViewReady.current = true;
      if (reports.length > 0) {
        const payload = reports.map(r => ({
          id: r._id, lat: r.lat, lng: r.lng,
          score: (r.upvotes?.length || 0) - (r.downvotes?.length || 0)
        }));
        const json = JSON.stringify(payload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        webViewRef.current?.injectJavaScript(`window.addReportMarkers('${json}'); true;`);
      }
      if (heatmapZones.length > 0) {
        const zonesJson = JSON.stringify(heatmapZones).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        webViewRef.current?.injectJavaScript(`window.updateHeatmapZones('${zonesJson}'); true;`);
      }
      return;
    }

    if (message.startsWith("heatmap:")) {
      const zoneId = message.replace("heatmap:", "");
      const zone = heatmapZones.find((z) => z.id === zoneId);
      if (zone) {
        setSelectedZone(zone);
        Animated.spring(zoneCardAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }).start();
      }
    } else if (message.startsWith("report:")) {
      const reportId = message.replace("report:", "");
      const report = reports.find(r => r._id === reportId);
      if (report) {
        setSelectedReport(report);
      }
    }
  };

  const dismissZoneCard = () => {
    Animated.timing(zoneCardAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSelectedZone(null));
  };

  const expandSheet = useCallback(() => {
    isExpandedRef.current = true;
    setIsExpanded(true);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 150,
    }).start();
  }, [sheetAnim]);

  const collapseSheet = useCallback(() => {
    isExpandedRef.current = false;
    setIsExpanded(false);
    Animated.spring(sheetAnim, {
      toValue: translateCollapsed,
      useNativeDriver: true,
      damping: 20,
      stiffness: 150,
    }).start();
  }, [sheetAnim, translateCollapsed]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.locationY < 60,
      onMoveShouldSetPanResponder: (evt, gs) =>
        Math.abs(gs.dy) > Math.abs(gs.dx) &&
        Math.abs(gs.dy) > 15 &&
        evt.nativeEvent.locationY < 80,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -40 && !isExpandedRef.current) expandSheet();
        else if (gs.dy > 40 && isExpandedRef.current) collapseSheet();
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  const triggerSuccessAnimation = (stopId) => {
    setShowSuccess(stopId);
    successAnim.setValue(0);
    Animated.sequence([
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(successAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setShowSuccess(null));
  };

  const handleMarkCleaned = (stopId) => {
    setWeightInput("");
    setWeightModalStop(stopId);
  };

  const confirmCleanWithWeight = (weight) => {
    const stopId = weightModalStop;
    const kg = parseInt(weight, 10) || Math.floor(Math.random() * 40 + 20);
    const arrivalTs = stopArrivalRef.current[stopId];
    const dwellSeconds = arrivalTs ? Math.round((Date.now() - arrivalTs) / 1000) : null;
    const dwellLabel = dwellSeconds != null
      ? dwellSeconds < 60 ? `${dwellSeconds}s` : `${Math.floor(dwellSeconds / 60)}m ${dwellSeconds % 60}s`
      : null;
    setWeightModalStop(null);
    setStops((prev) => {
      const idx = prev.findIndex((s) => s.id === stopId);
      return prev.map((s, i) => {
        if (i === idx) return { ...s, status: "completed", weight: `${kg}kg`, dwellLabel };
        if (i === idx + 1 && s.status === "upcoming") return { ...s, status: "in-progress" };
        return s;
      });
    });
    triggerSuccessAnimation(stopId);
  };

  const handleReportIssue = () => {
    Alert.alert("Report Issue", "What issue are you encountering?", [
      { text: "Overflowing Bin" },
      { text: "Hazardous Waste" },
      { text: "Road Blocked" },
      { text: "Other" },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const startNavigation = () => {
    if (todaySchedules !== null && todaySchedules.length === 0) {
      Alert.alert(
        'Not Scheduled Today',
        "You don't have a scheduled collection run for today. Please contact your supervisor if you believe this is an error.",
        [{ text: 'OK' }]
      );
      return;
    }
    console.log("🚛 [startNavigation] button pressed");
    navigationActiveRef.current = true;
    setNavigationActive(true);
    shiftStartRef.current = Date.now();
    setElapsedDisplay("00:00");

    const pos = lastGpsRef.current;
    const lat = pos?.lat ?? truckStop?.lat ?? 10.325;
    const lng = pos?.lng ?? truckStop?.lng ?? 123.893;
    const heading = pos?.heading ?? 0;

    console.log(`🚛 [startNavigation] lat=${lat} lng=${lng} heading=${heading}`);
    console.log(`🚛 [startNavigation] server=${TRACKING_SERVER}`);

    // Zoom to driver position and enable auto-follow
    webViewRef.current?.injectJavaScript(
      `window.startFollow(${lat}, ${lng}, ${heading}); true;`,
    );

    // Upload location to MongoDB via XHR (more reliable than fetch on Android)
    const url = `${TRACKING_SERVER}/api/trucks/location`;
    console.log(`🚛 [startNavigation] XHR POST → ${url}`);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.timeout = 8000;
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        console.warn(`🚛 [startNavigation] upload failed HTTP ${xhr.status}`);
      }
    };
    xhr.onerror = () => console.warn('🚛 [startNavigation] network error');
    xhr.ontimeout = () => console.warn('🚛 [startNavigation] timeout');
    xhr.send(JSON.stringify({ truckId: TRUCK_ID, lat, lng, heading, speed: 0 }));
  };

  const completeRoute = () => {
    Alert.alert(
      'Complete Route',
      'Mark this entire route as completed? Residents in the area will be notified and asked to confirm pickup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => {
            const completedStops = stops
              .filter(s => s.status === 'completed')
              .map(s => ({ name: s.name, weight: parseInt(s.weight || '0', 10) }));
            const totalKg = completedStops.reduce((sum, s) => sum + (s.weight || 0), 0);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${TRACKING_SERVER}/api/pickup/complete`);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.timeout = 10000;
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                triggerSuccessAnimation('route-done');
                stopNavigation();
              } else {
                Alert.alert('Error', 'Could not submit route completion. Please try again.');
              }
            };
            xhr.onerror = () => Alert.alert('Error', 'Network error. Please try again.');
            xhr.send(JSON.stringify({
              truckId: TRUCK_ID,
              driverName: user?.driverName || '',
              routeId: activeScheduleId || '',
              routeName: assignedRouteName || '',
              barangay: assignedRouteBarangay || '',
              stops: completedStops,
              totalWeight: totalKg,
            }));
          },
        },
      ]
    );
  };

  const handleWebViewLoad = useCallback(() => {
    webViewReady.current = true;
  }, []);

  const stopNavigation = () => {
    const pos = lastGpsRef.current;
    navigationActiveRef.current = false;
    setNavigationActive(false);
    shiftStartRef.current = null;
    setElapsedDisplay("00:00");
    setCurrentSpeed(0);
    // Broadcast offline so Resident map shows idle truck
    socketRef.current?.emit('truck:offline', { truckId: TRUCK_ID });
    // Disable auto-follow and show idle gray marker at last known position
    if (pos) {
      webViewRef.current?.injectJavaScript(
        `window.stopFollow(); window.stopNavigation(${pos.lat}, ${pos.lng}); true;`
      );
    } else {
      webViewRef.current?.injectJavaScript('window.stopFollow(); window.stopNavigation(); true;');
    }
  };

  const listOpacity = sheetAnim.interpolate({
    inputRange: [translateCollapsed * 0.5, translateCollapsed],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const zoneCardScale = zoneCardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
    extrapolate: "clamp",
  });
  const zoneCardOpacity = zoneCardAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor="transparent" translucent />
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: buildLeafletHTML(TRUCK_B64) }}
          style={styles.webView}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          onLoad={handleWebViewLoad}
          onMessage={handleWebViewMessage}
        />

        {/* Loading modal */}
        <Modal
          visible={routeLoading}
          transparent
          statusBarTranslucent
          animationType="fade"
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ActivityIndicator size="large" color="#006A3B" />
              <Text style={styles.modalTitle}>Updating Route</Text>
              <Text style={styles.modalSubtitle}>
                Recalculating the best path...
              </Text>
            </View>
          </View>
        </Modal>

        {/* Top info bar — mutually exclusive: not-scheduled > progress card > no-route */}
        {!isFocusMode && (
          <>
            {todaySchedules === null ? (
              <View style={styles.loadingBanner}>
                <ActivityIndicator size="small" color="#006A3B" />
                <Text style={styles.loadingBannerText}>Checking for today's routes...</Text>
              </View>
            ) : todaySchedules.length === 0 ? (
              <View style={styles.notScheduledBanner}>
                <MaterialIcons name="event-busy" size={15} color="#7F1D1D" />
                <Text style={styles.notScheduledText}>Not scheduled today — navigation locked</Text>
              </View>
            ) : (routeAssigned && !navigationActive) ? (
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <MaterialIcons name="route" size={16} color="#006A3B" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.progressTitle} numberOfLines={1}>
                      {assignedRouteName || 'Route Progress'}
                    </Text>
                    {assignedRouteBarangay ? (
                      <Text style={styles.progressBarangay} numberOfLines={1}>
                        Serving: {assignedRouteBarangay}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.progressPercent}>
                    {Math.round(progressPercent)}%
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${progressPercent}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>
                  Collection in progress...
                </Text>
              </View>
            ) : (
              <View style={styles.noRouteBanner}>
                <MaterialIcons name="info-outline" size={15} color="#92400E" />
                <Text style={styles.noRouteBannerText}>No route assigned</Text>
              </View>
            )}
          </>
        )}

        {/* Floating Actions */}
        {!isFocusMode ? (
          <View style={styles.floatingActions}>
            <TouchableOpacity
              style={[styles.floatingBtn, showTools && styles.activeFloatingBtn]}
              onPress={() => setShowTools(!showTools)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="build" size={20} color={showTools ? "#006A3B" : "#1B1C1C"} />
            </TouchableOpacity>

            {showTools && (
              <View style={styles.toolsMenu}>
                <TouchableOpacity
                  style={styles.toolItem}
                  onPress={() => { setShowTrashBins(!showTrashBins); setShowTools(false); }}
                >
                  <MaterialIcons name={showTrashBins ? "visibility-off" : "visibility"} size={18} color="#6F7A70" />
                  <Text style={styles.toolText}>{showTrashBins ? "Hide Bins" : "Show Bins"}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolItem}
                  onPress={() => {
                    const next = !showCityOutline;
                    setShowCityOutline(next);
                    webViewRef.current?.injectJavaScript(`window.toggleCityOutline(${next}); true;`);
                    setShowTools(false);
                  }}
                >
                  <MaterialIcons name="crop-free" size={18} color={showCityOutline ? "#2563EB" : "#6F7A70"} />
                  <Text style={styles.toolText}>{showCityOutline ? "Hide City Outline" : "City Outline"}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolItem}
                  onPress={() => { setIsFocusMode(true); setShowTools(false); }}
                >
                  <MaterialIcons name="fullscreen" size={18} color="#6F7A70" />
                  <Text style={styles.toolText}>Focus Mode</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.toolItem, { borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 4 }]}
                  onPress={() => { 
                    setShowTools(false);
                    Alert.alert("Report Hazard", "Identify a road hazard at your location:", [
                      { text: "Road Blocked", onPress: () => Alert.alert("Reported", "Road blockage reported to command center.") },
                      { text: "Illegal Parking", onPress: () => Alert.alert("Reported", "Illegal parking reported.") },
                      { text: "Accident", onPress: () => Alert.alert("Reported", "Accident reported.") },
                      { text: "Cancel", style: "cancel" }
                    ]);
                  }}
                >
                  <MaterialIcons name="warning" size={18} color="#EF4444" />
                  <Text style={[styles.toolText, { color: '#EF4444' }]}>Report Hazard</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.floatingBtn, (mapStyle !== 'voyager') && styles.activeFloatingBtn]}
              activeOpacity={0.7}
              onPress={() => {
                setMapStyle(prev => {
                  let next;
                  if (prev === 'topographic') next = 'satellite';
                  else if (prev === 'satellite') next = 'voyager';
                  else next = 'topographic';
                  webViewRef.current?.injectJavaScript(`window.setMapStyle('${next}'); true;`);
                  return next;
                });
              }}
            >
              <MaterialIcons
                name={mapStyle === 'satellite' ? "map" : mapStyle === 'topographic' ? "satellite-alt" : "terrain"}
                size={22}
                color={(mapStyle !== 'voyager') ? "#006A3B" : "#1B1C1C"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.floatingBtn}
              activeOpacity={0.7}
              onPress={() => {
                if (lastGpsRef.current && webViewReady.current) {
                  webViewRef.current.injectJavaScript(
                    `window.centerMap(${lastGpsRef.current.lat}, ${lastGpsRef.current.lng}); true;`
                  );
                }
              }}
            >
              <MaterialIcons name="gps-fixed" size={22} color="#006A3B" />
            </TouchableOpacity>

            {navigationActive ? (
              <TouchableOpacity
                style={[styles.floatingBtn, styles.activeNavBtn]}
                onPress={stopNavigation}
                activeOpacity={0.7}
              >
                <MaterialIcons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.floatingBtn}
                activeOpacity={0.7}
                onPress={startNavigation}
              >
                <MaterialIcons name="navigation" size={22} color="#1B1C1C" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.floatingActions}>
            <TouchableOpacity
              style={[styles.floatingBtn, styles.activeNavBtn]}
              onPress={() => setIsFocusMode(false)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="fullscreen-exit" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Legend */}
        {!isFocusMode && (
          <View style={styles.legendCard}>
            <Text style={styles.legendTitle}>Air Quality</Text>
            {Object.entries(STATUS_META).map(([status, meta]) => {
              const sample = heatmapZones.find(z => z.status === status);
              return (
                <TouchableOpacity
                  key={status}
                  style={styles.legendRow}
                  onPress={() => {
                    if (sample) {
                      setSelectedZone(sample);
                      Animated.spring(zoneCardAnim, {
                        toValue: 1,
                        useNativeDriver: true,
                        damping: 20,
                        stiffness: 150,
                      }).start();
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
                  <Text style={styles.legendText}>{meta.level}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Zone overlay (unchanged) */}
        {selectedZone && (
          <Animated.View
            style={[
              styles.zoneOverlay,
              {
                opacity: zoneCardOpacity,
                transform: [{ scale: zoneCardScale }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.zoneBackdrop}
              onPress={dismissZoneCard}
              activeOpacity={1}
            />
            <View
              style={[styles.zoneCard, { borderColor: selectedZone.color }]}
            >
              <View style={styles.zoneHeader}>
                <View
                  style={[
                    styles.zoneStatusDot,
                    { backgroundColor: selectedZone.color },
                  ]}
                />
                <Text style={styles.zoneStatusText}>
                  {selectedZone.status.toUpperCase()}
                </Text>
                <TouchableOpacity
                  style={styles.zoneCloseBtn}
                  onPress={dismissZoneCard}
                >
                  <MaterialIcons name="close" size={20} color="#6F7A70" />
                </TouchableOpacity>
              </View>
              <Text style={styles.zoneName}>{selectedZone.name}</Text>
              <Text style={styles.zoneLevel}>{selectedZone.level}</Text>
              <View style={styles.zoneMetrics}>
                <View style={styles.zoneMetric}>
                  <Text style={styles.zoneMetricValue}>
                    {selectedZone.ammonia}
                  </Text>
                  <Text style={styles.zoneMetricLabel}>Ammonia</Text>
                </View>
                <View style={styles.zoneMetricDivider} />
                <View style={styles.zoneMetric}>
                  <Text style={styles.zoneMetricValue}>
                    {selectedZone.methane}
                  </Text>
                  <Text style={styles.zoneMetricLabel}>Methane</Text>
                </View>
                <View style={styles.zoneMetricDivider} />
                <View style={styles.zoneMetric}>
                  <Text style={styles.zoneMetricValue}>
                    {selectedZone.bins}
                  </Text>
                  <Text style={styles.zoneMetricLabel}>Bins</Text>
                </View>
              </View>
              <View style={styles.zoneInfoRow}>
                <MaterialIcons name="access-time" size={14} color="#6F7A70" />
                <Text style={styles.zoneInfoText}>
                  Updated: {selectedZone.lastUpdated}
                </Text>
              </View>
              <View style={styles.zoneInfoRow}>
                <MaterialIcons
                  name="warning"
                  size={14}
                  color={selectedZone.color}
                />
                <Text style={styles.zoneInfoText}>
                  Risk Level:{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {selectedZone.riskLevel}
                  </Text>
                </Text>
              </View>
              <View style={styles.zoneRecommendation}>
                <MaterialIcons name="lightbulb" size={16} color="#F59E0B" />
                <Text style={styles.zoneRecommendationText}>
                  {selectedZone.recommendation}
                </Text>
              </View>
              <View style={styles.zoneActions}>
                <TouchableOpacity
                  style={[
                    styles.zoneActionBtn,
                    { backgroundColor: selectedZone.color },
                  ]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="navigation" size={16} color="#FFFFFF" />
                  <Text style={styles.zoneActionBtnText}>Navigate Here</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.zoneActionBtnOutline}
                  onPress={dismissZoneCard}
                  activeOpacity={0.8}
                >
                  <Text style={styles.zoneActionBtnOutlineText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Navigation Overlay System */}
        <View style={styles.navOverlayContainer} pointerEvents="box-none">
          {!navigationActive ? (
            /* Discovery Mode */
            <View style={styles.discoveryMode} pointerEvents="box-none">
              {!isExpanded && (
                <TouchableOpacity 
                  style={[styles.bigStartBtn, todaySchedules?.length === 0 && { opacity: 0.5 }]} 
                  onPress={startNavigation}
                  activeOpacity={0.9}
                >
                  <Text style={styles.bigStartBtnText}>START</Text>
                  <MaterialIcons name="navigation" size={24} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* Active Guidance Mode */
            <View style={styles.guidanceMode} pointerEvents="box-none">
              {isFocusMode && (
                <View style={styles.focusGuidanceBanner}>
                  <View style={styles.focusGuidanceTop}>
                    <View style={styles.focusTurnIconBox}>
                      <MaterialIcons name="navigation" size={32} color="#FFF" style={{ transform: [{ rotate: '45deg' }] }} />
                    </View>
                    <View style={styles.focusGuidanceText}>
                      <Text style={styles.focusDistanceText}>150m</Text>
                      <Text style={styles.focusStreetText}>Next Stop: {truckStop?.name || 'Assigned Area'}</Text>
                    </View>
                  </View>
                  <View style={styles.focusGuidanceDivider} />
                  <View style={styles.focusGuidanceBottom}>
                    <View style={styles.focusStatsBox}>
                      <Text style={styles.focusStatLabel}>ETA</Text>
                      <Text style={styles.focusStatValue}>3 min</Text>
                    </View>
                    <View style={styles.focusStatDivider} />
                    <View style={styles.focusStatsBox}>
                      <Text style={styles.focusStatLabel}>DISTANCE</Text>
                      <Text style={styles.focusStatValue}>0.8 km</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.focusStopBtn}
                      onPress={stopNavigation}
                    >
                      <Text style={styles.focusStopBtnText}>EXIT</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Success toast */}
        {showSuccess && (
          <Animated.View
            style={[
              styles.successToast,
              {
                opacity: successAnim,
                transform: [
                  {
                    translateY: successAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
            <Text style={styles.successText}>Area marked as cleaned!</Text>
          </Animated.View>
        )}
      </View>

      {/* Bottom Sheet – exactly as in your code */}
      {!isFocusMode && (
        <Animated.View
          style={[
            styles.bottomSheet,
            { height: sheetTotalHeight, transform: [{ translateY: sheetAnim }] },
          ]}
        >
          <View {...panResponder.panHandlers}>
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.sheetTitle}>
                  {routeAssigned ? 'Pickup Locations' : 'No Route Assigned'}
                </Text>
                {isPreferredRoute && (
                  <View style={styles.prefBadge}>
                    <MaterialIcons name="star" size={10} color="#92400E" />
                    <Text style={styles.prefBadgeText}>Preferred</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sheetSub}>
                {routeAssigned
                  ? isPreferredRoute
                    ? `Preferred: ${assignedRouteName}`
                    : 'Swipe up for details'
                  : 'Waiting for route assignment'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() =>
                isExpandedRef.current ? collapseSheet() : expandSheet()
              }
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={isExpanded ? "expand-more" : "expand-less"}
                size={20}
                color="#6F7A70"
              />
            </TouchableOpacity>
          </View>
          {!isExpanded && (
            <View style={styles.swipeHint}>
              <MaterialIcons
                name="keyboard-arrow-up"
                size={16}
                color="#BECABE"
              />
              <Text style={styles.swipeHintText}>
                {routeAssigned ? 'Swipe up to see all stops' : 'Swipe up for details'}
              </Text>
            </View>
          )}

          {/* Route switcher — only visible when more than one route is scheduled today */}
          {todaySchedules && todaySchedules.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.routeSwitcherScroll}
              contentContainerStyle={styles.routeSwitcherContent}
            >
              {todaySchedules.map(s => {
                const isActive = s._id === activeScheduleId;
                return (
                  <TouchableOpacity
                    key={s._id}
                    style={[styles.routeSwitchPill, isActive && styles.routeSwitchPillActive]}
                    onPress={() => setActiveScheduleId(s._id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.routeSwitchDot, isActive && styles.routeSwitchDotActive]} />
                    <Text style={[styles.routeSwitchText, isActive && styles.routeSwitchTextActive]} numberOfLines={1}>
                      {s.routeName || 'Route'}
                    </Text>
                    {s.startTime ? (
                      <Text style={[styles.routeSwitchTime, isActive && styles.routeSwitchTimeActive]}>
                        {s.startTime}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <Animated.View style={[styles.stopList, { opacity: listOpacity }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            scrollEnabled={isExpanded}
            contentContainerStyle={{ paddingBottom: bottomInset + 8 }}
          >
            {!routeAssigned ? (
              <View style={styles.unassignedCard}>
                <View style={styles.unassignedIconWrap}>
                  <MaterialIcons name="local-shipping" size={36} color="#6F7A70" />
                </View>
                <Text style={styles.unassignedTitle}>
                  {todaySchedules && todaySchedules.length > 0 ? 'No Route in Schedule' : 'Awaiting Route Assignment'}
                </Text>
                <Text style={styles.unassignedBody}>
                  {todaySchedules && todaySchedules.length > 0
                    ? "You're scheduled today but no route was assigned to your schedule. Ask your supervisor to edit the schedule and select a route."
                    : "Your truck hasn't been assigned a collection route yet. Please wait for your supervisor to assign you a route, or contact your dispatch office."}
                </Text>
                <View style={styles.unassignedHint}>
                  <MaterialIcons name="map" size={14} color="#006A3B" />
                  <Text style={styles.unassignedHintText}>
                    You can still explore the map and check pollution heatmap zones while you wait.
                  </Text>
                </View>
              </View>
            ) : (
              <>
            {truckStop && (
              <View style={styles.actionCard}>
                <View style={styles.actionCardHeader}>
                  <View style={styles.actionLocationIcon}>
                    <MaterialIcons
                      name="location-on"
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionLocation}>{truckStop.name}</Text>
                    <Text style={styles.actionAddress}>
                      {truckStop.address}
                    </Text>
                  </View>
                  <View style={styles.inProgressBadge}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.inProgressText}>Now</Text>
                  </View>
                </View>
                <View style={styles.actionMeta}>
                  <View style={styles.actionMetaItem}>
                    <MaterialIcons
                      name="delete-outline"
                      size={14}
                      color="#6F7A70"
                    />
                    <Text style={styles.actionMetaText}>
                      {truckStop.bins} bins
                    </Text>
                  </View>
                  <View style={styles.actionMetaItem}>
                    <MaterialIcons name="schedule" size={14} color="#6F7A70" />
                    <Text style={styles.actionMetaText}>{truckStop.time}</Text>
                  </View>
                  <View style={styles.actionMetaItem}>
                    <MaterialIcons name="category" size={14} color="#6F7A70" />
                    <Text style={styles.actionMetaText}>{truckStop.type}</Text>
                  </View>
                </View>
                {(binStatus.preparedCount > 0 || binStatus.pickedUpCount > 0) && (
                  <View style={styles.binStatusRow}>
                    <MaterialIcons name="people" size={13} color="#006A3B" />
                    <Text style={styles.binStatusText}>
                      {binStatus.preparedCount} preparing
                    </Text>
                    {binStatus.pickedUpCount > 0 && (
                      <>
                        <Text style={styles.binStatusDot}>·</Text>
                        <MaterialIcons name="check-circle" size={13} color="#065F46" />
                        <Text style={styles.binStatusText}>{binStatus.pickedUpCount} picked up</Text>
                      </>
                    )}
                  </View>
                )}
                 <View style={styles.actionButtons}>
                   <TouchableOpacity
                     style={styles.reportBtn}
                     onPress={handleReportIssue}
                     activeOpacity={0.8}
                   >
                     <MaterialIcons name="warning" size={18} color="#BA1A1A" />
                     <Text style={styles.reportBtnText} numberOfLines={1}>
                       Report
                     </Text>
                   </TouchableOpacity>
                 </View>

                 {(() => {
                   const dist = currentLocation ? getDistanceMeters(currentLocation.lat, currentLocation.lng, truckStop.lat, truckStop.lng) : 999;
                   const isAtStop = dist <= 50;
                   return (
                     <View>
                       <TouchableOpacity
                         style={[styles.cleanBtn, !isAtStop && styles.cleanBtnDisabled]}
                         onPress={() => isAtStop && handleMarkCleaned(truckStop.id)}
                         activeOpacity={isAtStop ? 0.8 : 1}
                       >
                         <MaterialIcons
                           name={isAtStop ? "check-circle" : "location-off"}
                           size={18}
                           color="#FFFFFF"
                         />
                         <Text style={styles.cleanBtnText}>
                           {isAtStop ? 'Mark Cleaned' : 'Too Far from Stop'}
                         </Text>
                       </TouchableOpacity>
                       {!isAtStop && (
                         <Text style={styles.distanceHint}>
                           Get within 50m to collect ({Math.round(dist)}m away)
                         </Text>
                       )}
                     </View>
                   );
                 })()}
              </View>
            )}

            <Text style={styles.sectionTitle}>All Stops</Text>
            {stops.map((stop, index) => (
              <View key={stop.id} style={styles.stopRow}>
                <View style={styles.timelineCol}>
                  <View
                    style={[
                      styles.stopDot,
                      stop.status === "completed" && styles.stopDotCompleted,
                      stop.status === "in-progress" && styles.stopDotActive,
                    ]}
                  >
                    {stop.status === "completed" ? (
                      <MaterialIcons name="check" size={14} color="#FFFFFF" />
                    ) : stop.status === "in-progress" ? (
                      <MaterialIcons
                        name="local-shipping"
                        size={14}
                        color="#FFFFFF"
                      />
                    ) : (
                      <View style={styles.stopDotInner} />
                    )}
                  </View>
                  {index < stops.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        stop.status === "completed" &&
                          styles.timelineLineCompleted,
                      ]}
                    />
                  )}
                </View>
                <View
                  style={[
                    styles.stopContent,
                    stop.status === "in-progress" && styles.stopContentActive,
                  ]}
                >
                  <View style={styles.stopRowHeader}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.stopName,
                          stop.status === "in-progress" &&
                            styles.stopNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {stop.name}
                      </Text>
                      <Text style={styles.stopAddress} numberOfLines={1}>
                        {stop.address}
                      </Text>
                    </View>
                    <Text style={styles.stopTime}>{stop.time}</Text>
                  </View>
                  <View style={styles.stopRowFooter}>
                    <View style={styles.stopTags}>
                      <View style={styles.tag}>
                        <MaterialIcons
                          name="delete-outline"
                          size={11}
                          color="#6F7A70"
                        />
                        <Text style={styles.tagText}>{stop.bins} bins</Text>
                      </View>
                      {stop.weight && (
                        <View style={styles.tag}>
                          <MaterialIcons
                            name="monitor-weight"
                            size={11}
                            color="#6F7A70"
                          />
                          <Text style={styles.tagText}>{stop.weight}</Text>
                        </View>
                      )}
                      <View style={styles.tag}>
                        <MaterialIcons
                          name="category"
                          size={11}
                          color="#6F7A70"
                        />
                        <Text style={styles.tagText}>{stop.type}</Text>
                      </View>
                    </View>
                    {stop.status === "completed" ? (
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <View style={styles.cleanedBadge}>
                          <MaterialIcons name="check-circle" size={12} color="#006A3B" />
                          <Text style={styles.cleanedText}>Done</Text>
                        </View>
                        {stop.dwellLabel && (
                          <Text style={styles.dwellText}>⏱ {stop.dwellLabel}</Text>
                        )}
                      </View>
                    ) : stop.status === "in-progress" ? (() => {
                      const dist = currentLocation
                        ? getDistanceMeters(currentLocation.lat, currentLocation.lng, stop.lat, stop.lng)
                        : 999;
                      const isAtStop = dist <= 50;
                      return (
                        <TouchableOpacity
                          style={[styles.markBtn, !isAtStop && styles.cleanBtnDisabled]}
                          onPress={() => isAtStop && handleMarkCleaned(stop.id)}
                          activeOpacity={isAtStop ? 0.8 : 1}
                        >
                          <Text style={styles.markBtnText}>
                            {isAtStop ? "Mark Cleaned" : "Too Far"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })() : (
                      <TouchableOpacity
                        style={styles.navBtn}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons
                          name="navigation"
                          size={12}
                          color="#006A3B"
                        />
                        <Text style={styles.navBtnText}>Go</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}

            <View style={styles.sheetFooter}>
              <View style={styles.footerStats}>
                <View style={styles.footerStat}>
                  <Text style={styles.footerStatValue}>{completedCount}</Text>
                  <Text style={styles.footerStatLabel}>Completed</Text>
                </View>
                <View style={styles.footerDivider} />
                <View style={styles.footerStat}>
                  <Text style={styles.footerStatValue}>{remainingCount}</Text>
                  <Text style={styles.footerStatLabel}>Remaining</Text>
                </View>
                <View style={styles.footerDivider} />
                <View style={styles.footerStat}>
                  <Text style={styles.footerStatValue}>{totalCollected}kg</Text>
                  <Text style={styles.footerStatLabel}>Collected</Text>
                </View>
              </View>
              {completedCount === stops.length && stops.length > 0 && (
                <TouchableOpacity
                  style={styles.completeRouteBtn}
                  onPress={completeRoute}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="check-circle" size={18} color="#fff" />
                  <Text style={styles.completeRouteBtnText}>Complete Route & Notify Residents</Text>
                </TouchableOpacity>
              )}
            </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
      )}

      {/* Weight entry modal — shown when marking a stop as cleaned */}
      <Modal
        visible={!!weightModalStop}
        transparent
        animationType="slide"
        onRequestClose={() => setWeightModalStop(null)}
      >
        <TouchableOpacity
          style={styles.weightOverlay}
          activeOpacity={1}
          onPress={() => setWeightModalStop(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.weightSheet}>
            <View style={styles.weightHandle} />
            <Text style={styles.weightTitle}>Enter Collected Weight</Text>
            <Text style={styles.weightSub}>
              {stops.find((s) => s.id === weightModalStop)?.name || "This stop"}
            </Text>
            <View style={styles.weightInputRow}>
              <TextInput
                style={styles.weightInput}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                maxLength={4}
                autoFocus
              />
              <Text style={styles.weightUnit}>kg</Text>
            </View>
            <TouchableOpacity
              style={styles.weightConfirmBtn}
              onPress={() => confirmCleanWithWeight(weightInput)}
              activeOpacity={0.85}
            >
              <Text style={styles.weightConfirmText}>Confirm Cleaned</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.weightSkipBtn}
              onPress={() => confirmCleanWithWeight("")}
            >
              <Text style={styles.weightSkipText}>Skip — log weight later</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Route deviation warning modal */}
      <Modal
        visible={deviationAlert}
        transparent
        animationType="fade"
        onRequestClose={() => setDeviationAlert(false)}
      >
        <View style={styles.deviationBackdrop}>
          <View style={styles.deviationCard}>
            <TouchableOpacity
              style={styles.deviationClose}
              onPress={() => setDeviationAlert(false)}
            >
              <MaterialIcons name="close" size={20} color="#6F7A70" />
            </TouchableOpacity>

            <View style={styles.deviationIconWrap}>
              <MaterialIcons name="warning" size={38} color="#F59E0B" />
            </View>
            <Text style={styles.deviationTitle}>Off Route Warning</Text>
            <Text style={styles.deviationBody}>
              You are approximately{' '}
              <Text style={{ fontWeight: '700', color: '#BA1A1A' }}>
                {deviationInfo?.distance}m
              </Text>{' '}
              from your assigned route.{'\n'}
              Please return to your designated collection path.
            </Text>

            <TouchableOpacity
              style={styles.deviationBtnPrimary}
              onPress={() => { setDeviationAlert(false); offRouteCountRef.current = 0; }}
              activeOpacity={0.85}
            >
              <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
              <Text style={styles.deviationBtnPrimaryText}>I'm Back on Route</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deviationBtnSecondary}
              onPress={() => { setDeviationAlert(false); handleReportIssue(); }}
              activeOpacity={0.85}
            >
              <MaterialIcons name="report-problem" size={18} color="#B45309" />
              <Text style={styles.deviationBtnSecondaryText}>Report Issue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deviationBtnOutline}
              onPress={() => {
                setDeviationAlert(false);
                socketRef.current?.emit('truck:contact-dispatch', {
                  truckId: TRUCK_ID,
                  driverName: user?.driverName || '',
                  message: 'Driver requesting assistance — off assigned route',
                });
                Alert.alert(
                  'Dispatch Notified',
                  'Your supervisor has been alerted. Help is on the way.',
                  [{ text: 'OK' }]
                );
              }}
              activeOpacity={0.85}
            >
              <MaterialIcons name="phone" size={18} color="#006A3B" />
              <Text style={styles.deviationBtnOutlineText}>Contact Dispatch</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Overflowing Bin Detail Modal */}
      <Modal
        visible={!!selectedReport}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReport(null)}
      >
        <View style={styles.reportModalBackdrop}>
          <View style={styles.reportModalCard}>
            <View style={styles.reportModalHeader}>
              <View style={styles.reportModalIconWrap}>
                <MaterialIcons name="delete-sweep" size={24} color="#BA1A1A" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.reportModalTitle}>Overflowing Bin</Text>
                <Text style={styles.reportModalSub}>Reported near your route</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedReport(null)} style={styles.reportCloseBtn}>
                <MaterialIcons name="close" size={20} color="#6F7A70" />
              </TouchableOpacity>
            </View>

            <View style={styles.reportUrgencyRow}>
              <Text style={styles.reportUrgencyLabel}>Community Urgency</Text>
              <View style={[styles.reportUrgencyBadge, (selectedReport?.upvotes?.length - (selectedReport?.downvotes?.length || 0)) >= 5 ? styles.reportUrgencyHigh : styles.reportUrgencyMed]}>
                <Text style={styles.reportUrgencyText}>
                  Score: {(selectedReport?.upvotes?.length || 0) - (selectedReport?.downvotes?.length || 0)}
                </Text>
              </View>
            </View>

            <View style={styles.reportContentBox}>
              <Text style={styles.reportDescription}>{selectedReport?.description}</Text>
              <View style={styles.reportLocationRow}>
                <MaterialIcons name="location-on" size={14} color="#6F7A70" />
                <Text style={styles.reportLocationText}>{selectedReport?.location || selectedReport?.barangay}</Text>
              </View>
            </View>

            {selectedReport?.reportImage ? (
              <View style={styles.reportImageContainer}>
                <ActivityIndicator size="small" color="#006A3B" style={styles.imageLoader} />
                <Animated.Image 
                  source={{ uri: selectedReport.reportImage }} 
                  style={styles.reportImage} 
                />
              </View>
            ) : null}

            <View style={styles.reportModalFooter}>
              <Text style={styles.reportTimestamp}>
                {selectedReport ? new Date(selectedReport.createdAt).toLocaleString() : ''}
              </Text>
              <TouchableOpacity 
                style={styles.reportActionBtn}
                onPress={() => setSelectedReport(null)}
              >
                <Text style={styles.reportActionBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles (exactly as in your paste) ────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FBF9F8" },
  mapContainer: { flex: 1 },
  webView: { flex: 1, backgroundColor: "#F0EDED" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    width: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1B1C1C",
    marginTop: 20,
    lineHeight: 24,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6F7A70",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  deviationBtn: {
    backgroundColor: '#006A3B',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  deviationBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },

  // Navigation Overlay Styles
  navOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  discoveryMode: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 100,
  },
  navSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  navSearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1B1C1C',
  },
  reportModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reportModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  reportModalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1C1C',
  },
  reportModalSub: {
    fontSize: 12,
    color: '#6F7A70',
  },
  reportCloseBtn: {
    padding: 8,
  },
  reportUrgencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reportUrgencyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6F7A70',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reportUrgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  reportUrgencyMed: {
    backgroundColor: '#FFFBEB',
  },
  reportUrgencyHigh: {
    backgroundColor: '#BA1A1A',
  },
  reportUrgencyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  reportContentBox: {
    backgroundColor: '#FBF9F8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  reportDescription: {
    fontSize: 15,
    color: '#1B1C1C',
    fontWeight: '500',
    marginBottom: 8,
    lineHeight: 22,
  },
  reportLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reportLocationText: {
    fontSize: 12,
    color: '#6F7A70',
  },
  reportImageContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#F0EDED',
    marginBottom: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportImage: {
    width: '100%',
    height: '100%',
  },
  imageLoader: {
    position: 'absolute',
  },
  reportModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportTimestamp: {
    fontSize: 11,
    color: '#BECABE',
  },
  reportActionBtn: {
    backgroundColor: '#1B1C1C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  reportActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  bigStartBtn: {
    position: 'absolute',
    bottom: 70,
    right: 20,
    backgroundColor: '#006A3B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
    elevation: 8,
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  bigStartBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  guidanceMode: {
    flex: 1,
    alignItems: 'center',
  },
  guidanceHeader: {
    position: 'absolute',
    top: 60,
    width: '92%',
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  turnIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  guideDistance: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  guideStreet: {
    color: '#BECABE',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  guidanceFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  guideTime: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1B1C1C',
  },
  guideStats: {
    fontSize: 16,
    color: '#6F7A70',
    fontWeight: '600',
  },
  guideExitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 6,
  },
  guideExitText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
  },

  focusGuidanceBanner: {
    position: 'absolute',
    bottom: 20,
    left: 12,
    right: 12,
    backgroundColor: '#1A1C1E',
    borderRadius: 28,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  focusGuidanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  focusTurnIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#006A3B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  focusGuidanceText: {
    flex: 1,
  },
  focusDistanceText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  focusStreetText: {
    color: '#BECABE',
    fontSize: 14,
    fontWeight: '600',
  },
  focusGuidanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 4,
  },
  focusGuidanceBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  focusStatsBox: {
    flex: 1,
  },
  focusStatLabel: {
    color: '#6F7A70',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  focusStatValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  focusStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 12,
  },
  focusStopBtn: {
    backgroundColor: '#BA1A1A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  focusStopBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  loadingBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 80,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 15,
  },
  loadingBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#006A3B",
  },

  progressCard: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 80,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 15,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  progressTitle: { fontSize: 13, fontWeight: "600", color: "#006A3B" },
  progressBarangay: { fontSize: 11, color: "#6F7A70", marginTop: 1 },
  progressPercent: { fontSize: 13, fontWeight: "700", color: "#006A3B" },
  progressBar: {
    height: 4,
    backgroundColor: "#E8F0EA",
    borderRadius: 2,
    marginBottom: 6,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#006A3B", borderRadius: 2 },
  progressText: { fontSize: 10, color: "#6F7A70", lineHeight: 14 },

  floatingActions: {
    position: "absolute",
    top: 16,
    right: 16,
    gap: 8,
    zIndex: 20,
  },
  floatingBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  activeNavBtn: { backgroundColor: "#006A3B" },
  activeFloatingBtn: { borderColor: "#006A3B", borderWidth: 1.5 },
 
  toolsMenu: {
    position: 'absolute',
    right: 56,
    top: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 100,
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
  },
  toolText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B1C1C',
  },
  truckStatusBar: {
    position: 'absolute',
    top: 4,
    left: 12,
    right: 12,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 100,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  statusLeft: {
    flexDirection: 'column',
    gap: 4,
  },
  truckIdBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  truckIdText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  weatherBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B1C1C',
  },
  capacityContainer: {
    width: 140,
  },
  capacityLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  capacityLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6F7A70',
    textTransform: 'uppercase',
  },
  capacityValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#006A3B',
  },
  capacityBarBG: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  capacityBarFill: {
    height: '100%',
    backgroundColor: '#006A3B',
    borderRadius: 4,
  },

  legendCard: {
    position: "absolute",
    top: 120,
    left: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    gap: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6F7A70",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: "#1B1C1C", fontWeight: "500" },

  successToast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#006A3B",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 30,
  },
  successText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },

  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderTopColor: "#F0EDED",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 15,
    overflow: "hidden",
  },
  handleContainer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 8 },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#DCD9D9",
    alignSelf: "center",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B1C1C",
    lineHeight: 22,
  },
  sheetSub: { fontSize: 13, color: "#6F7A70", marginTop: 2, lineHeight: 18 },
  prefBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prefBadgeText: { fontSize: 10, fontWeight: "700", color: "#92400E" },
  expandBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0EDEB",
    justifyContent: "center",
    alignItems: "center",
  },
  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
  },
  swipeHintText: { fontSize: 11, color: "#BECABE" },
  stopList: { flex: 1, paddingHorizontal: 20 },

  actionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  actionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  actionLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#006A3B",
    justifyContent: "center",
    alignItems: "center",
  },
  actionInfo: { flex: 1 },
  actionLocation: {
    fontSize: 17,
    fontWeight: "700",
    color: "#006A3B",
    lineHeight: 22,
  },
  actionAddress: { fontSize: 13, color: "#6F7A70", lineHeight: 18 },
  inProgressBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E4EEE9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#006A3B",
  },
  inProgressText: { fontSize: 11, fontWeight: "700", color: "#006A3B" },
  actionMeta: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F6F3F2",
    borderRadius: 10,
  },
  actionMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionMetaText: { fontSize: 12, color: "#6F7A70", fontWeight: "500" },
  actionButtons: { flexDirection: "row", gap: 12, marginBottom: 12 },
  navigateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#006A3B",
    paddingVertical: 13,
    borderRadius: 14,
  },
  navigateBtnBlocked: {
    backgroundColor: "#9E9E9E",
  },
  navigateBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  stopNavBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#BA1A1A",
    paddingVertical: 13,
    borderRadius: 14,
  },
  stopNavBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  reportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEF3F2",
    paddingVertical: 13,
    borderRadius: 14,
  },
  reportBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#BA1A1A",
    flexShrink: 1,
  },
  cleanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#006A3B",
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 8,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cleanBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  cleanBtnDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  distanceHint: {
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    fontWeight: "600",
    fontStyle: 'italic',
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6F7A70",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
    paddingLeft: 4,
  },

  stopRow: { flexDirection: "row", marginBottom: 4 },
  timelineCol: { alignItems: "center", width: 32, marginRight: 14 },
  stopDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F6F3F2",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  stopDotCompleted: { backgroundColor: "#006E1C" },
  stopDotActive: { backgroundColor: "#006A3B" },
  stopDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C6D1C6",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E8F0EA",
    marginTop: -2,
    marginBottom: -2,
    minHeight: 20,
  },
  timelineLineCompleted: { backgroundColor: "#A8C9A8" },
  stopContent: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  stopContentActive: { backgroundColor: "#EBF3EE" },
  stopRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  stopName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6F7A70",
    lineHeight: 20,
  },
  stopNameActive: { color: "#006A3B", fontWeight: "700" },
  stopAddress: { fontSize: 12, color: "#C6D1C6", lineHeight: 16, marginTop: 1 },
  stopTime: { fontSize: 12, fontWeight: "600", color: "#6F7A70" },
  stopRowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stopTags: { flexDirection: "row", gap: 6, flex: 1, flexWrap: "wrap" },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F6F3F2",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: { fontSize: 11, color: "#6F7A70", fontWeight: "500" },
  cleanedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E4EEE9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cleanedText: { fontSize: 11, fontWeight: "600", color: "#006A3B" },
  dwellText: { fontSize: 10, color: "#6F7A70", fontWeight: "500" },
  binStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    backgroundColor: "#F0FFF4",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  binStatusText: { fontSize: 12, color: "#065F46", fontWeight: "500" },
  binStatusDot: { fontSize: 12, color: "#6F7A70", marginHorizontal: 2 },
  markBtn: {
    backgroundColor: "#006A3B",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  markBtnText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E4EEE9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  navBtnText: { fontSize: 11, fontWeight: "600", color: "#006A3B" },

  sheetFooter: { paddingVertical: 20, alignItems: "center" },
  footerStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  footerStat: { flex: 1, alignItems: "center" },
  footerStatValue: { fontSize: 15, fontWeight: "700", color: "#1B1C1C" },
  footerStatLabel: {
    fontSize: 11,
    color: "#6F7A70",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  footerDivider: { width: 1, height: 24, backgroundColor: "#E8F0EA" },
  completeRouteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#006A3B', borderRadius: 14, paddingVertical: 13,
    paddingHorizontal: 20, marginTop: 16, width: '100%', gap: 8,
  },
  completeRouteBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  zoneOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
    paddingHorizontal: 24,
  },
  zoneBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  zoneCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
  },
  zoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  zoneStatusDot: { width: 12, height: 12, borderRadius: 6 },
  zoneStatusText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6F7A70",
    letterSpacing: 1.5,
    flex: 1,
  },
  zoneCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F6F3F2",
    justifyContent: "center",
    alignItems: "center",
  },
  zoneName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1B1C1C",
    lineHeight: 28,
    marginBottom: 2,
  },
  zoneLevel: {
    fontSize: 15,
    color: "#6F7A70",
    lineHeight: 20,
    marginBottom: 20,
  },
  zoneMetrics: {
    flexDirection: "row",
    backgroundColor: "#F6F3F2",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  zoneMetric: { flex: 1, alignItems: "center" },
  zoneMetricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B1C1C",
    marginBottom: 2,
  },
  zoneMetricLabel: {
    fontSize: 11,
    color: "#6F7A70",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  zoneMetricDivider: {
    width: 1,
    height: "70%",
    backgroundColor: "#D4D0CF",
    alignSelf: "center",
  },
  zoneInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  zoneInfoText: { fontSize: 13, color: "#6F7A70", lineHeight: 18 },
  zoneRecommendation: {
    flexDirection: "row",
    backgroundColor: "#FFF8E1",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 12,
    marginBottom: 20,
  },
  zoneRecommendationText: {
    fontSize: 13,
    color: "#1B1C1C",
    lineHeight: 18,
    flex: 1,
  },
  zoneActions: { flexDirection: "row", gap: 10 },
  zoneActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  zoneActionBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  zoneActionBtnOutline: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#F6F3F2",
  },
  zoneActionBtnOutlineText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6F7A70",
  },

  notScheduledBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 15,
  },
  notScheduledText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7F1D1D",
    flex: 1,
  },

  noRouteBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 15,
  },
  noRouteBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    flex: 1,
  },

  unassignedCard: {
    backgroundColor: "#F6F3F2",
    borderRadius: 20,
    padding: 24,
    marginTop: 8,
    alignItems: "center",
  },
  unassignedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E8EDEA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  unassignedTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1B1C1C",
    marginBottom: 10,
    textAlign: "center",
  },
  unassignedBody: {
    fontSize: 13,
    color: "#6F7A70",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
  },
  unassignedHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EBF3EE",
    borderRadius: 12,
    padding: 12,
    width: "100%",
  },
  unassignedHintText: {
    fontSize: 12,
    color: "#006A3B",
    lineHeight: 18,
    flex: 1,
  },

  // ── Weight entry modal ──
  weightOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  weightSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 48,
    alignItems: "center",
  },
  weightHandle: {
    width: 40, height: 4, backgroundColor: "#D1D5DB",
    borderRadius: 2, alignSelf: "center", marginBottom: 24,
  },
  weightTitle: {
    fontSize: 20, fontWeight: "700", color: "#1B1C1C", marginBottom: 4,
  },
  weightSub: {
    fontSize: 14, color: "#6B7280", marginBottom: 28,
  },
  weightInputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F3F4F6", borderRadius: 20,
    paddingHorizontal: 28, paddingVertical: 12,
    marginBottom: 28, width: "100%", justifyContent: "center",
  },
  weightInput: {
    fontSize: 48, fontWeight: "800", color: "#1B1C1C",
    minWidth: 80, textAlign: "center",
  },
  weightUnit: {
    fontSize: 24, fontWeight: "600", color: "#6B7280",
    paddingTop: 12,
  },
  weightConfirmBtn: {
    backgroundColor: "#006A3B", paddingVertical: 16, borderRadius: 14,
    alignItems: "center", width: "100%", marginBottom: 12,
  },
  weightConfirmText: {
    fontSize: 17, fontWeight: "600", color: "#FFFFFF",
  },
  weightSkipBtn: {
    paddingVertical: 12, alignItems: "center", width: "100%",
  },
  weightSkipText: {
    fontSize: 14, color: "#9CA3AF",
  },

  // ── Route switcher ──
  routeSwitcherScroll: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  routeSwitcherContent: {
    gap: 8,
    paddingRight: 4,
  },
  routeSwitchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DCD9D9',
    backgroundColor: '#FAFAF9',
    maxWidth: 180,
  },
  routeSwitchPillActive: {
    borderColor: '#006A3B',
    backgroundColor: '#EBF3EE',
  },
  routeSwitchDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C6D1C6',
    flexShrink: 0,
  },
  routeSwitchDotActive: {
    backgroundColor: '#006A3B',
  },
  routeSwitchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6F7A70',
    flexShrink: 1,
  },
  routeSwitchTextActive: {
    color: '#006A3B',
  },
  routeSwitchTime: {
    fontSize: 11,
    color: '#9CA3AF',
    flexShrink: 0,
  },
  routeSwitchTimeActive: {
    color: '#4D9E72',
  },

  // ── Route deviation modal ──
  deviationBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  deviationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  deviationClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F6F3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviationIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  deviationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B1C1C',
    marginBottom: 10,
  },
  deviationBody: {
    fontSize: 14,
    color: '#6F7A70',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  deviationBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006A3B',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    marginBottom: 10,
  },
  deviationBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deviationBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    marginBottom: 10,
  },
  deviationBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B45309',
  },
  deviationBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#006A3B',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
  },
  deviationBtnOutlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#006A3B',
  },
});
