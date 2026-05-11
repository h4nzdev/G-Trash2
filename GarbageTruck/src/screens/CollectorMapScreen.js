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


// ── Heatmap zones (unchanged) ────────────────────────────
const HEATMAP_ZONES = [
  {
    id: "critical",
    name: "Carbon Market",
    lat: 10.295,
    lng: 123.895,
    color: "#E53935",
    status: "critical",
    level: "High Pollution",
    ammonia: "45 ppm",
    methane: "2.8%",
    lastUpdated: "10 mins ago",
    recommendation: "Immediate collection needed. Schedule additional pickup.",
    bins: 12,
    riskLevel: "High",
  },
  {
    id: "moderate",
    name: "Colon Street",
    lat: 10.308,
    lng: 123.895,
    color: "#FDD835",
    status: "moderate",
    level: "Moderate Pollution",
    ammonia: "22 ppm",
    methane: "1.2%",
    lastUpdated: "25 mins ago",
    recommendation: "Monitor closely. Standard collection schedule adequate.",
    bins: 8,
    riskLevel: "Medium",
  },
  {
    id: "clean",
    name: "IT Park",
    lat: 10.328,
    lng: 123.9,
    color: "#4CAF50",
    status: "clean",
    level: "Safe Levels",
    ammonia: "5 ppm",
    methane: "0.2%",
    lastUpdated: "1 hour ago",
    recommendation: "Area well maintained. Continue regular monitoring.",
    bins: 3,
    riskLevel: "Low",
  },
];

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
      perspective: 2000px;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #f0eded;
    }
    #map {
      width: 100%;
      height: 100%; 
      transform: translateY(-15%) rotateX(35deg) scale(1.8);
      transform-origin: center center;
    }
    .leaflet-marker-icon, .leaflet-marker-shadow {
      transform-style: preserve-3d;
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
        maxBounds: cebuBounds, maxBoundsViscosity: 0.0, minZoom: 10, maxZoom: 18,
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

      // Heat zones
      var criticalZone = L.circle([10.295, 123.895], { radius:250, color:'#E53935', fillColor:'#E53935', fillOpacity:0.35, weight:3, opacity:0.9, className:'zone-circle' }).addTo(map);
      criticalZone.on('click', function() { window.ReactNativeWebView.postMessage('heatmap:critical'); });
      var moderateZone = L.circle([10.308, 123.895], { radius:250, color:'#FDD835', fillColor:'#FDD835', fillOpacity:0.35, weight:3, opacity:0.9, className:'zone-circle' }).addTo(map);
      moderateZone.on('click', function() { window.ReactNativeWebView.postMessage('heatmap:moderate'); });
      var cleanZone = L.circle([10.328, 123.900], { radius:250, color:'#4CAF50', fillColor:'#4CAF50', fillOpacity:0.35, weight:3, opacity:0.9, className:'zone-circle' }).addTo(map);
      cleanZone.on('click', function() { window.ReactNativeWebView.postMessage('heatmap:clean'); });

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

      // Moves the arrow to the driver's real GPS position
      window.updateDriverPosition = function(lat, lng, bearing) {
        if (currentMarker) { map.removeLayer(currentMarker); }
        currentMarker = createArrowMarker(lat, lng, bearing || 0);
        currentMarker.addTo(map);
        map.panTo([lat, lng]);
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

      setTimeout(function() { map.invalidateSize(); }, 200);
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
  const TRUCK_ID = user?.truckId ?? 'GT-000';
  const { bottom: bottomInset } = useSafeAreaInsets();
  const [stops, setStops] = useState([]);
  const [routeAssigned, setRouteAssigned] = useState(false);
  const [assignedRouteName, setAssignedRouteName] = useState('');
  const [todaySchedules, setTodaySchedules] = useState(null); // null=loading, []=not scheduled
  const [activeScheduleId, setActiveScheduleId] = useState(null);

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
        console.log(`[App] No schedules available, clearing route.`);
        setRouteAssigned(false);
        setStops([]);
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
            setAssignedRouteName(route.name || '');
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapStyle, setMapStyle] = useState('topographic');
  const [showSuccess, setShowSuccess] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [navigationActive, setNavigationActive] = useState(false);
  const [elapsedDisplay, setElapsedDisplay] = useState("00:00");
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [weightModalStop, setWeightModalStop] = useState(null);
  const [weightInput, setWeightInput] = useState("");
  const [deviationAlert, setDeviationAlert] = useState(false);
  const [deviationInfo, setDeviationInfo] = useState(null);

  const isExpandedRef = useRef(false);
  const navigationActiveRef = useRef(false);
  const lastGpsRef = useRef(null);
  const shiftStartRef = useRef(null);
  const offRouteCountRef = useRef(0);
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

    return () => {
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
    if (message.startsWith("heatmap:")) {
      const zoneId = message.replace("heatmap:", "");
      const zone = HEATMAP_ZONES.find((z) => z.id === zoneId);
      if (zone) {
        setSelectedZone(zone);
        Animated.spring(zoneCardAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 20,
          stiffness: 150,
        }).start();
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
    setWeightModalStop(null);
    setStops((prev) => {
      const idx = prev.findIndex((s) => s.id === stopId);
      return prev.map((s, i) => {
        if (i === idx) return { ...s, status: "completed", weight: `${kg}kg` };
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

    // Show truck on driver's own map
    webViewRef.current?.injectJavaScript(
      `window.updateDriverPosition(${lat}, ${lng}, ${heading}); true;`,
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
    // Show idle gray marker at last known position
    if (pos) {
      webViewRef.current?.injectJavaScript(
        `window.stopNavigation(${pos.lat}, ${pos.lng}); true;`
      );
    } else {
      webViewRef.current?.injectJavaScript('window.stopNavigation(); true;');
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
              <Text style={styles.progressTitle} numberOfLines={1}>
                {assignedRouteName || 'Route Progress'}
              </Text>
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

        <View style={styles.floatingActions}>
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

          {/* New Re-center Button */}
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

        {/* Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Air Quality</Text>
          {HEATMAP_ZONES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.legendRow}
              onPress={() => {
                setSelectedZone(item);
                Animated.spring(zoneCardAnim, {
                  toValue: 1,
                  useNativeDriver: true,
                  damping: 20,
                  stiffness: 150,
                }).start();
              }}
              activeOpacity={0.7}
            >
              <View
                style={[styles.legendDot, { backgroundColor: item.color }]}
              />
              <Text style={styles.legendText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
              {/* Overlays removed for minimalist view */}
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
            <View>
              <Text style={styles.sheetTitle}>
                {routeAssigned ? 'Pickup Locations' : 'No Route Assigned'}
              </Text>
              <Text style={styles.sheetSub}>
                {routeAssigned
                  ? 'Swipe up for details'
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
                <TouchableOpacity
                  style={styles.cleanBtn}
                  onPress={() => handleMarkCleaned(truckStop.id)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="check-circle"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.cleanBtnText}>Mark Cleaned</Text>
                </TouchableOpacity>
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
                      <View style={styles.cleanedBadge}>
                        <MaterialIcons
                          name="check-circle"
                          size={12}
                          color="#006A3B"
                        />
                        <Text style={styles.cleanedText}>Done</Text>
                      </View>
                    ) : stop.status === "in-progress" ? (
                      <TouchableOpacity
                        style={styles.markBtn}
                        onPress={() => handleMarkCleaned(stop.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.markBtnText}>Mark Cleaned</Text>
                      </TouchableOpacity>
                    ) : (
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
            </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>

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
  bigStartBtn: {
    position: 'absolute',
    bottom: 60,
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
  progressTitle: { fontSize: 13, fontWeight: "600", color: "#006A3B", flex: 1 },
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
