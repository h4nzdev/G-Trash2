import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
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
import { useRoute } from "@react-navigation/native";
import HeatmapLegend from "../components/HeatmapLegend";
import API_URL from "../config";
import { useAuth } from "../context/AuthContext";
import TRUCK_B64 from "../constants/truckBase64";

const TRACKING_SERVER = API_URL;

const ROUTE_COLORS = [
  "#006A3B",
  "#2196F3",
  "#FF9800",
  "#9C27B0",
  "#F44336",
  "#00BCD4",
];

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const COLLAPSED_HEIGHT = 80;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.52;

function buildLeafletHTML(truckB64) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { height: 100%; width: 100%; overflow: hidden; background: #f0eded; }
    .leaflet-control-zoom { display: none; }
    .leaflet-container { background: #f0eded; }
    img { pointer-events: none; }
    .user-marker {
      background: #1A73E8; width: 18px; height: 18px;
      border-radius: 50%; border: 3px solid white;
      box-shadow: 0 2px 8px rgba(26,115,232,0.4);
    }
    .user-pulse {
      width: 60px; height: 60px; border-radius: 50%;
      background: rgba(26,115,232,0.15);
      border: 2px solid rgba(26,115,232,0.35);
      position: absolute; left: -21px; top: -21px;
      animation: pulse 2s ease-out infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.8); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var TB = '${truckB64}';

      var map, userMarker, userPulseCircle, routeLayer;
      var radiusCircles = [];
      var routeLayers = {};
      var truckMarkers = {};

      var southWest = new L.LatLng(10.275, 123.845);
      var northEast = new L.LatLng(10.355, 123.925);
      var cebuBounds = new L.LatLngBounds(southWest, northEast);

      map = new L.Map('map', {
        zoomControl: false, attributionControl: false, dragging: true,
        scrollWheelZoom: false, doubleClickZoom: true, touchZoom: true,
        maxBounds: cebuBounds, maxBoundsViscosity: 0.0, minZoom: 13, maxZoom: 17,
        inertia: true, inertiaDeceleration: 3000,
      });
      map.setView([10.3157, 123.8854], 14);

      var tileLayer, hillshadeLayer, labelsLayer;
      function setTileLayer(style) {
        if (tileLayer) map.removeLayer(tileLayer);
        if (hillshadeLayer) map.removeLayer(hillshadeLayer);
        if (labelsLayer) map.removeLayer(labelsLayer);

        if (style === 'satellite') {
          tileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 17, minZoom: 13, attribution: '' }
          );
        } else if (style === 'topographic') {
          tileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 17, minZoom: 11, attribution: '' }
          );
          hillshadeLayer = L.tileLayer(
            'https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png',
            { opacity: 0.25, maxZoom: 17 }
          ).addTo(map);
          labelsLayer = L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
            { opacity: 0.7, maxZoom: 17 }
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

      var CEBU_OUTLINE = [[10.3565,123.8808],[10.3592,123.8842],[10.3610,123.8882],[10.3620,123.8925],[10.3624,123.8972],[10.3618,123.9018],[10.3600,123.9065],[10.3568,123.9112],[10.3525,123.9158],[10.3475,123.9200],[10.3420,123.9235],[10.3362,123.9262],[10.3302,123.9278],[10.3242,123.9284],[10.3182,123.9278],[10.3124,123.9260],[10.3068,123.9234],[10.3015,123.9202],[10.2965,123.9165],[10.2918,123.9124],[10.2874,123.9080],[10.2834,123.9032],[10.2798,123.8982],[10.2766,123.8928],[10.2740,123.8868],[10.2720,123.8805],[10.2708,123.8740],[10.2703,123.8675],[10.2706,123.8612],[10.2718,123.8555],[10.2738,123.8508],[10.2770,123.8472],[10.2806,123.8452],[10.2844,123.8445],[10.2878,123.8452],[10.2908,123.8465],[10.2936,123.8480],[10.2965,123.8488],[10.2995,123.8493],[10.3025,123.8496],[10.3055,123.8500],[10.3085,123.8506],[10.3115,123.8515],[10.3145,123.8528],[10.3172,123.8545],[10.3196,123.8558],[10.3220,123.8568],[10.3246,123.8573],[10.3272,123.8576],[10.3300,123.8580],[10.3328,123.8588],[10.3358,123.8600],[10.3388,123.8616],[10.3415,123.8636],[10.3440,123.8660],[10.3464,123.8686],[10.3487,123.8714],[10.3508,123.8742],[10.3526,123.8770],[10.3544,123.8792],[10.3558,123.8802],[10.3565,123.8808]];
      var sensorIcon = L.divIcon({
        html: '<div style="display:flex;align-items:center;justify-content:center;background:#0F172A;width:24px;height:24px;border-radius:50%;border:2px solid #38BDF8;box-shadow:0 2px 6px rgba(0,0,0,0.4);">' +
              '<span style="font-size:11px;line-height:24px;">📡</span>' +
              '</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: ''
      });

      // IoT air quality heatmap circles — barangay-filtered
      var heatmapCircles = {};
      window.updateHeatmapArea = function(area) {
        var id = area._id;
        var color = area.status === 'critical' ? '#E53935' : area.status === 'moderate' ? '#FDD835' : '#4CAF50';
        var fillOp = area.status === 'critical' ? 0.35 : area.status === 'moderate' ? 0.25 : 0.15;
        if (heatmapCircles[id]) { map.removeLayer(heatmapCircles[id]); }
        
        var group = L.layerGroup();
        
        var r = 180 + Math.round((area.intensity || 0.5) * 120);
        var circle = L.circle([area.lat, area.lng], {
          radius: r, color: color, fillColor: color,
          fillOpacity: fillOp, weight: 2, opacity: 0.8, interactive: true,
        });
        circle.bindPopup(
          '<div style="font-family:sans-serif;min-width:140px;padding:2px 0;">' +
          '<b style="font-size:12px;">' + (area.name || 'Sensor') + '</b><br/>' +
          '<span style="font-size:10px;color:' + color + ';font-weight:700;text-transform:uppercase;">' + area.status + '</span>' +
          '<div style="margin-top:5px;font-size:10px;color:#555;line-height:1.6;">' +
          'NH₃: ' + (area.ammonia || 'N/A') + '<br/>' +
          'CH₄: ' + (area.methane || 'N/A') +
          '</div></div>'
        );
        circle.addTo(group);

        var sensorMarker = L.marker([area.lat, area.lng], { icon: sensorIcon });
        sensorMarker.bindPopup(
          '<div style="font-family:sans-serif;min-width:140px;padding:2px 0;">' +
          '<b style="font-size:12px;">📡 IoT Waste Sensor</b><br/>' +
          '<span style="font-size:10px;color:#64748B;">Zone: ' + (area.name || 'Sensor') + '</span><br/>' +
          '<span style="font-size:11px;color:#1E293B;font-weight:600;display:inline-block;margin-top:4px;">Status: ' + 
          (area.status === 'critical' ? '🔴 Critical' : area.status === 'moderate' ? '🟡 Moderate' : '🟢 Clean') + '</span>' +
          '<div style="margin-top:5px;font-size:10px;color:#555;line-height:1.6;">' +
          'NH₃: ' + (area.ammonia || 'N/A') + ' ppm<br/>' +
          'CH₄: ' + (area.methane || 'N/A') + ' ppm' +
          '</div></div>'
        );
        sensorMarker.addTo(group);

        group.addTo(map);
        heatmapCircles[id] = group;
      };
      window.clearHeatmapAreas = function() {
        Object.keys(heatmapCircles).forEach(function(id) {
          if (heatmapCircles[id]) map.removeLayer(heatmapCircles[id]);
        });
        heatmapCircles = {};
      };

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

      function drawUserRadius(lat, lng) {
        radiusCircles.forEach(function(c) { map.removeLayer(c); });
        radiusCircles = [];
        [
          { radius: 100, color: '#E53935' },
          { radius: 200, color: '#FDD835' },
          { radius: 300, color: '#4CAF50' },
        ].forEach(function(l) {
          radiusCircles.push(L.circle([lat, lng], {
            radius: l.radius, color: l.color,
            fillOpacity: 0, weight: 2.5, dashArray: '6 4', opacity: 0.8, interactive: false,
          }).addTo(map));
        });
      }

      function makeTruckIcon(truckId, heading) {
        return L.divIcon({
          html: '<div style="display:flex;flex-direction:column;align-items:center;position:relative;">' +
                  '<div style="background:#fff;border-radius:12px;padding:4px;box-shadow:0 4px 15px rgba(0,106,59,0.4);border:2.5px solid #006A3B;position:relative;z-index:2;">' +
                    '<img src="data:image/png;base64,' + TB + '" style="width:36px;height:36px;object-fit:contain;display:block;" />' +
                  '</div>' +
                  '<div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #006A3B;margin-top:-3px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));"></div>' +
                  '<div style="background:#006A3B;color:#fff;font-size:9px;font-weight:800;padding:2px 8px;border-radius:8px;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(0,0,0,0.15);"> ' + (truckId || 'GT') + ' </div>' +
                '</div>',
          iconSize: [50, 90],
          iconAnchor: [25, 60],
          className: '',
        });
      }

      function makeIdleIcon(truckId) {
        return L.divIcon({
          html: '<div style="display:flex;flex-direction:column;align-items:center;opacity:0.7;">' +
                  '<div style="background:#fff;border-radius:12px;padding:4px;box-shadow:0 2px 8px rgba(0,0,0,0.2);border:2.5px solid #6B7280;filter:grayscale(100%);">' +
                    '<img src="data:image/png;base64,' + TB + '" style="width:36px;height:36px;object-fit:contain;display:block;" />' +
                  '</div>' +
                  '<div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #6B7280;margin-top:-3px;"></div>' +
                  '<div style="background:#6B7280;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:8px;white-space:nowrap;margin-top:2px;"> Idle </div>' +
                '</div>',
          iconSize: [50, 75],
          iconAnchor: [25, 52],
          className: '',
        });
      }

      window.updateTruckPosition = function(lat, lng, truckId, autoPan, heading) {
        var id = truckId || 'GT';
        var icon = makeTruckIcon(id, heading);
        if (!truckMarkers[id]) {
          truckMarkers[id] = L.marker([lat, lng], { icon: icon }).addTo(map);
        } else {
          truckMarkers[id].setLatLng([lat, lng]);
          truckMarkers[id].setIcon(icon);
        }
        if (autoPan) map.panTo([lat, lng]);
      };

      window.showIdleTruck = function(lat, lng, truckId) {
        var id = truckId || 'GT';
        if (truckMarkers[id]) { map.removeLayer(truckMarkers[id]); }
        truckMarkers[id] = L.marker([lat, lng], { icon: makeIdleIcon(id) }).addTo(map);
      };

      window.removeTruckMarker = function(truckId) {
        var id = truckId || 'GT';
        if (truckMarkers[id]) { map.removeLayer(truckMarkers[id]); delete truckMarkers[id]; }
      };

      window.loadAllRoutes = function(routesPayload) {
        Object.keys(routeLayers).forEach(function(id) {
          if (routeLayers[id]) { map.removeLayer(routeLayers[id]); }
        });
        routeLayers = {};
        routesPayload.forEach(function(r) {
          if (!r.coords || r.coords.length < 2) return;
          var layer = L.polyline(r.coords, {
            color: r.color || '#006A3B', weight: 3, opacity: 0.45,
            lineCap: 'round', lineJoin: 'round',
          });
          layer.on('click', function() {
            window.ReactNativeWebView.postMessage('route:' + r.id);
          });
          layer.addTo(map);
          routeLayers[r.id] = layer;
        });
      };

      window.highlightRoute = function(routeId) {
        Object.keys(routeLayers).forEach(function(id) {
          if (!routeLayers[id]) return;
          if (id === routeId) {
            routeLayers[id].setStyle({ weight: 5, opacity: 0.9 });
            routeLayers[id].bringToFront();
            try { map.fitBounds(routeLayers[id].getBounds().pad(0.1)); } catch(e) {}
          } else {
            routeLayers[id].setStyle({ weight: 2, opacity: 0.3 });
          }
        });
      };

      // Resident route stop markers — verified sitios
      var residentStopMarkers = [];
      window.clearResidentStops = function() {
        residentStopMarkers.forEach(function(m) { map.removeLayer(m); });
        residentStopMarkers = [];
      };
      window.addResidentStops = function(stopsJson) {
        window.clearResidentStops();
        var arr = JSON.parse(stopsJson);
        arr.forEach(function(s) {
          var status = s.status || 'upcoming';
          var bg = status === 'completed' ? '#006E1C' : status === 'in-progress' ? '#F59E0B' : '#9CA3AF';
          var inner = status === 'completed' ? '✓' : status === 'in-progress' ? '🚛' : '●';
          var icon = L.divIcon({
            html: '<div style="display:flex;flex-direction:column;align-items:center;position:relative;">' +
                  '<div style="background:' + bg + ';color:#fff;width:24px;height:24px;border-radius:50%;' +
                  'display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;' +
                  'border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2);">' + inner + '</div>' +
                  '<span style="position:absolute;top:-18px;background:rgba(255,255,255,0.95);color:#1B1C1C;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;border:1px solid #ccc;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.1);">' + s.name + '</span>' +
                  '</div>',
            iconSize: [24, 24], iconAnchor: [12, 12], className: '',
          });
          var m = L.marker([s.lat, s.lng], { icon: icon });
          m.bindPopup(
            '<div style="font-family:sans-serif;min-width:100px;">' +
            '<b style="font-size:11px;">Sitio ' + s.name + '</b><br>' +
            '<span style="font-size:10px;color:#555;">Status: ' + (status === 'completed' ? 'Cleaned' : status === 'in-progress' ? 'Scheduled Today' : 'Not Scheduled') + '</span>' +
            '</div>'
          );
          m.addTo(map);
          residentStopMarkers.push(m);
        });
      };

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
        }
      };

      window.updateUserLocation = function(lat, lng) {
        if (userMarker) { map.removeLayer(userMarker); }
        if (userPulseCircle) { map.removeLayer(userPulseCircle); }
        userMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: '<div style="position:relative; display:flex; justify-content:center; align-items:center; width:32px; height:32px;">' +
                  '<svg viewBox="0 0 24 24" width="32" height="32" fill="#1A73E8" stroke="#FFFFFF" stroke-width="1.5" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));">' +
                  '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />' +
                  '</svg>' +
                  '<div class="user-pulse" style="left: -14px; top: 2px;"></div>' +
                  '</div>',
            iconSize: [32, 32], iconAnchor: [16, 32], className: '',
          })
        }).addTo(map);
        userPulseCircle = L.circle([lat, lng], {
          radius: 25, color: '#1A73E8', fillColor: '#1A73E8',
          fillOpacity: 0.08, weight: 1.5, dashArray: '4 4', interactive: false,
        }).addTo(map);
        drawUserRadius(lat, lng);
      };

      window.gotoLocation = function(lat, lng, zoom) { map.setView([lat, lng], zoom || 15); };
      setTimeout(function() { map.invalidateSize(); }, 300);
    })();
  </script>
</body>
</html>`;
}

export default function MapScreen() {
  const routeParams = useRoute();
  const { focusTruck } = routeParams.params || {};
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const { user } = useAuth();
  const userBarangay = user?.barangay || '';

  const sheetTotalHeight = EXPANDED_HEIGHT + bottomInset;
  const translateCollapsed = sheetTotalHeight - COLLAPSED_HEIGHT;

  const [isExpanded, setIsExpanded] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [liveTruckOnline, setLiveTruckOnline] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState("topographic");
  const [isFollowing, setIsFollowing] = useState(!!focusTruck);
  const [showCityOutline, setShowCityOutline] = useState(true);
  const [iotAreas, setIotAreas] = useState([]);
  const [truckPosState, setTruckPosState] = useState(null); // UI-reactive truck position
  const [cleanedNotif, setCleanedNotif] = useState(null);
  const [truckBarangay, setTruckBarangay] = useState(null);

  const [sitioList, setSitioList] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);

  const isExpandedRef = useRef(true);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef(null);
  const socketRef = useRef(null);
  const liveTruckPos = useRef(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const isFollowingRef = useRef(!!focusTruck);
  const initialTrucks = useRef([]);
  const iotAreasRef = useRef([]);

  useEffect(() => {
    isFollowingRef.current = isFollowing;
  }, [isFollowing]);



  const aqStatus = useMemo(() => {
    if (!iotAreas.length) return null;
    if (iotAreas.some((a) => a.status === 'critical')) return 'critical';
    if (iotAreas.some((a) => a.status === 'moderate')) return 'moderate';
    return 'clean';
  }, [iotAreas]);

  const activeSchedule = useMemo(() => {
    if (liveTruckOnline && liveTruckPos.current?.truckId) {
      const match = todaySchedules.find(s => s.truckId === liveTruckPos.current.truckId);
      if (match) return match;
    }
    return todaySchedules.find(s => s.barangay?.toLowerCase() === userBarangay.toLowerCase());
  }, [todaySchedules, liveTruckPos.current, liveTruckOnline, userBarangay]);

  useEffect(() => { iotAreasRef.current = iotAreas; }, [iotAreas]);

  useEffect(() => {
    (async () => {
      try {
        const trucksRes = await fetch(`${TRACKING_SERVER}/api/trucks`).then(r => r.json());
        if (Array.isArray(trucksRes)) {
          const online = trucksRes.filter(t => t.status === 'online');
          initialTrucks.current = online;
          if (online.length > 0) {
            const active = online[0];
            liveTruckPos.current = { lat: active.lat, lng: active.lng, truckId: active.truckId };
            setLiveTruckOnline(true);
          }
        }
      } catch (e) {
        console.warn('MapScreen fetch error:', e);
      } finally {
        setDataLoading(false);
      }
    })();
  }, []);

  // Fetch barangay-specific IoT garbage areas
  useEffect(() => {
    if (!userBarangay) return;
    fetch(`${API_URL}/api/garbage-areas?barangay=${encodeURIComponent(userBarangay)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setIotAreas(data);
          iotAreasRef.current = data;
        }
      })
      .catch(() => {});
  }, [userBarangay]);

  // Fetch verified sitios and today's schedules for resident's barangay
  const fetchSitiosAndSchedules = useCallback(() => {
    if (!userBarangay) return;
    
    const fetchSitios = fetch(`${API_URL}/api/sitios?barangay=${encodeURIComponent(userBarangay)}`).then(r => r.json());
    
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const fetchSchedules = fetch(`${API_URL}/api/schedules?date=${today}`).then(r => r.json());

    Promise.all([fetchSitios, fetchSchedules])
      .then(([sitios, schedules]) => {
        if (Array.isArray(sitios)) setSitioList(sitios);
        const scheds = Array.isArray(schedules) ? schedules : (schedules.schedules || []);
        setTodaySchedules(scheds);
      })
      .catch(() => {});
  }, [userBarangay]);

  useEffect(() => {
    fetchSitiosAndSchedules();
  }, [fetchSitiosAndSchedules]);

  // Inject heatmap circles whenever iotAreas changes and WebView is ready
  useEffect(() => {
    if (!webViewReady || !iotAreas.length) return;
    webViewRef.current?.injectJavaScript('window.clearHeatmapAreas(); true;');
    iotAreas.forEach((area) => {
      webViewRef.current?.injectJavaScript(
        `window.updateHeatmapArea(${JSON.stringify(area)}); true;`,
      );
    });
  }, [iotAreas, webViewReady]);

  // Inject sitio markers & route polylines into WebView
  useEffect(() => {
    if (!webViewReady) return;
    if (sitioList.length === 0) {
      webViewRef.current?.injectJavaScript(`window.clearResidentStops(); window.updateTruckRoute('[]'); true;`);
      return;
    }
    const markersPayload = sitioList.map(s => {
      let status = "upcoming";
      for (const sched of todaySchedules || []) {
        if (sched.sitioTasks && sched.sitioTasks.length > 0) {
          const task = sched.sitioTasks.find(t => t.name.toLowerCase() === s.name.toLowerCase());
          if (task) {
            status = task.completed ? "completed" : "in-progress";
            break;
          }
        } else if (sched.sitio && sched.sitio.toLowerCase() === s.name.toLowerCase()) {
          status = sched.status === "completed" ? "completed" : "in-progress";
          break;
        }
      }
      return {
        lat: s.lat,
        lng: s.lng,
        status,
        name: s.name
      };
    });
    const markersJson = JSON.stringify(markersPayload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webViewRef.current?.injectJavaScript(`window.addResidentStops('${markersJson}'); true;`);

    // Draw route polyline connecting selected sequential sitios in order
    let routeCoords = [];
    for (const sched of todaySchedules || []) {
      if (sched.routeCoords && sched.routeCoords.length > 0) {
        routeCoords = [...routeCoords, ...sched.routeCoords];
      } else if (sched.sitioTasks && sched.sitioTasks.length > 1) {
        const coords = sched.sitioTasks.map(t => [t.lat, t.lng]);
        routeCoords = [...routeCoords, ...coords];
      }
    }
    const routeCoordsJson = JSON.stringify(routeCoords).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webViewRef.current?.injectJavaScript(`window.updateTruckRoute('${routeCoordsJson}'); true;`);
  }, [sitioList, todaySchedules, webViewReady]);



  useEffect(() => {
    const socket = io(TRACKING_SERVER, {
      transports: ["polling", "websocket"],
    });
    socketRef.current = socket;

    socket.on("truck:location:update", ({ truckId, lat, lng, heading, currentBarangay }) => {
      liveTruckPos.current = { lat, lng, truckId, heading };
      setTruckPosState({ lat, lng, truckId });
      setLiveTruckOnline(true);
      if (currentBarangay) {
        setTruckBarangay(currentBarangay);
      }
      if (webViewReady) {
        const safeId = (truckId || "GT").replace(/'/g, "\\'");
        webViewRef.current?.injectJavaScript(
          `window.updateTruckPosition(${lat}, ${lng}, '${safeId}', ${isFollowingRef.current}, ${heading || 0}); true;`,
        );
      }
    });

    socket.on("truck:status", ({ truckId, status }) => {
      if (status === "offline") {
        setLiveTruckOnline(false);
        const pos = liveTruckPos.current;
        const safeId = (truckId || "GT").replace(/'/g, "\\'");
        if (webViewReady) {
          if (pos) {
            webViewRef.current?.injectJavaScript(
              `window.showIdleTruck(${pos.lat}, ${pos.lng}, '${safeId}'); true;`,
            );
          } else {
            // No last position — remove the marker entirely by truckId
            webViewRef.current?.injectJavaScript(
              `window.removeTruckMarker('${safeId}'); true;`,
            );
          }
        }
        liveTruckPos.current = null;
      }
    });

    // Real-time IoT / collection heatmap updates — show all zones (no barangay filter)
    socket.on("garbage-area:updated", (area) => {
      setIotAreas((prev) => {
        const idx = prev.findIndex((a) => a._id === area._id);
        return idx >= 0
          ? prev.map((a) => (a._id === area._id ? area : a))
          : [...prev, area];
      });
      if (webViewReady) {
        webViewRef.current?.injectJavaScript(
          `window.updateHeatmapArea(${JSON.stringify(area)}); true;`,
        );
      }
    });

    // Zone status changes (collection completed, IoT alert, report filed)
    socket.on("zone:status:update", (update) => {
      // Build a minimal area object and update the map circle directly
      const updatedArea = {
        _id: String(update.areaId || update.zoneId),
        name: update.name,
        barangay: update.barangay,
        status: update.newStatus,
        lat: update.lat,
        lng: update.lng,
        ammonia: update.ammonia,
        methane: update.methane,
        intensity: update.newStatus === 'critical' ? 0.8 : update.newStatus === 'moderate' ? 0.5 : 0.2,
      };

      // Update iotAreas state so the zone color changes locally
      setIotAreas((prev) => {
        const id = String(update.areaId || update.zoneId);
        const idx = prev.findIndex((a) => a._id === id);
        if (idx >= 0) {
          const merged = { ...prev[idx], status: update.newStatus, intensity: updatedArea.intensity };
          if (webViewReady) {
            webViewRef.current?.injectJavaScript(
              `window.updateHeatmapArea(${JSON.stringify(merged)}); true;`,
            );
          }
          return prev.map((a, i) => i === idx ? merged : a);
        }
        return prev;
      });

      // Show "Your area has been cleaned!" notification for collection events
      if (update.reason === 'collection_completed' && update.newStatus === 'clean') {
        setCleanedNotif({
          name: update.name,
          barangay: update.barangay,
          collectedBy: update.changedBy,
          weight: update.weight,
        });
        setTimeout(() => setCleanedNotif(null), 5000);
      }
    });

    socket.on("schedule:changed", () => {
      fetchSitiosAndSchedules();
    });

    return () => socket.disconnect();
  }, [fetchSitiosAndSchedules]);

  const handleWebViewLoad = useCallback(() => {
    setWebViewReady(true);
    
    // Inject all initial online trucks
    initialTrucks.current.forEach((t) => {
      const safeId = (t.truckId || "GT").replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(
        `window.updateTruckPosition(${t.lat}, ${t.lng}, '${safeId}', false); true;`,
      );
    });
    // Focus if following
    if (liveTruckPos.current && isFollowingRef.current) {
      const { lat, lng, truckId } = liveTruckPos.current;
      const safeId = (truckId || "GT").replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(
        `window.updateTruckPosition(${lat}, ${lng}, '${safeId}', true); true;`,
      );
    }
    // Inject barangay IoT heatmap areas
    iotAreasRef.current.forEach((area) => {
      webViewRef.current?.injectJavaScript(
        `window.updateHeatmapArea(${JSON.stringify(area)}); true;`,
      );
    });
  }, []);

  const handleWebViewMessage = useCallback((event) => {
    const msg = event.nativeEvent.data;
    if (msg.startsWith("route:")) setSelectedRouteId(msg.slice(6));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status);
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const { latitude, longitude } = loc.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(
              `window.updateUserLocation(${latitude}, ${longitude}); true;`,
            );
          }, 600);
        }
      } catch (e) {
        console.warn("Location error:", e);
      }
    })();
  }, []);

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
    // Keep sheet fully expanded
    isExpandedRef.current = true;
    setIsExpanded(true);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 150,
    }).start();
  }, [sheetAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderRelease: () => {},
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  const routeDetailsOpacity = sheetAnim.interpolate({
    inputRange: [translateCollapsed * 0.5, translateCollapsed],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const leafletHTML = useMemo(() => buildLeafletHTML(TRUCK_B64), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor="transparent" translucent />
      
      {/* Barangay Status Banner */}
      <View style={{
        backgroundColor: truckBarangay && truckBarangay === userBarangay ? '#006A3B' : liveTruckOnline ? '#F59E0B' : '#6B7280',
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}>
        <MaterialIcons
          name={liveTruckOnline ? 'local-shipping' : 'info-outline'}
          size={18}
          color="#FFFFFF"
        />
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 }}>
          {truckBarangay && truckBarangay === userBarangay
            ? `🟢 A garbage truck is active in ${userBarangay}!`
            : liveTruckOnline && truckBarangay
              ? `Truck active in ${truckBarangay}`
              : liveTruckOnline
                ? 'A garbage truck is active nearby'
                : 'No active trucks in your area'}
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: leafletHTML }}
          style={styles.webView}
          originWhitelist={["*"]}
          javaScriptEnabled
          onLoad={handleWebViewLoad}
          onMessage={handleWebViewMessage}
        />
        <View style={styles.floatingActions}>
          <TouchableOpacity
            style={[
              styles.floatingButton,
              isFollowing && styles.floatingButtonActive,
            ]}
            onPress={() => {
              setIsFollowing(!isFollowing);
              if (!isFollowing && liveTruckPos.current) {
                const { lat, lng } = liveTruckPos.current;
                webViewRef.current?.injectJavaScript(
                  `window.gotoLocation(${lat}, ${lng}, 16); true;`,
                );
              }
            }}
          >
            <MaterialIcons
              name={isFollowing ? "gps-fixed" : "gps-not-fixed"}
              size={22}
              color={isFollowing ? "#006A3B" : "#1B1C1C"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.floatingButton,
              mapStyle !== "voyager" && styles.floatingButtonActive,
            ]}
            activeOpacity={0.7}
            onPress={() => {
              setMapStyle((prev) => {
                let next;
                if (prev === "topographic") next = "satellite";
                else if (prev === "satellite") next = "voyager";
                else next = "topographic";
                webViewRef.current?.injectJavaScript(
                  `window.setMapStyle('${next}'); true;`,
                );
                return next;
              });
            }}
          >
            <MaterialIcons
              name={
                mapStyle === "satellite"
                  ? "map"
                  : mapStyle === "topographic"
                    ? "satellite-alt"
                    : "terrain"
              }
              size={22}
              color={mapStyle !== "voyager" ? "#006A3B" : "#1B1C1C"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={() => {
              if (userLocation) {
                webViewRef.current?.injectJavaScript(
                  `window.gotoLocation(${userLocation.lat}, ${userLocation.lng}, 15); true;`,
                );
              }
            }}
          >
            <MaterialIcons name="my-location" size={22} color="#1B1C1C" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.floatingButton, showCityOutline && styles.floatingButtonActive]}
            onPress={() => {
              const next = !showCityOutline;
              setShowCityOutline(next);
              webViewRef.current?.injectJavaScript(
                `window.toggleCityOutline(${next}); true;`,
              );
            }}
          >
            <MaterialIcons name="crop-free" size={22} color={showCityOutline ? "#006A3B" : "#1B1C1C"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.floatingButton, isExpanded && styles.floatingButtonActive]}
            onPress={() => {
              if (isExpanded) {
                collapseSheet();
              } else {
                expandSheet();
              }
            }}
          >
            <MaterialIcons name="directions-bus" size={22} color={isExpanded ? "#006A3B" : "#1B1C1C"} />
          </TouchableOpacity>
        </View>
        <View style={styles.legendOverlay}>
          <HeatmapLegend />
        </View>

        {/* Zone Cleaned Notification */}
        {cleanedNotif && (
          <View style={styles.cleanedNotifWrapper} pointerEvents="none">
            <View style={styles.cleanedNotif}>
              <Text style={styles.cleanedNotifEmoji}>🧹</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cleanedNotifTitle}>Your area has been cleaned!</Text>
                <Text style={styles.cleanedNotifSub} numberOfLines={1}>
                  {cleanedNotif.name}
                  {cleanedNotif.collectedBy ? ` · ${cleanedNotif.collectedBy}` : ''}
                  {cleanedNotif.weight ? ` · ${cleanedNotif.weight}` : ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Barangay Air Quality Status Banner */}
        {aqStatus && (
          <View style={styles.aqBannerWrapper} pointerEvents="none">
            <View style={[
              styles.aqBanner,
              aqStatus === 'critical' && { backgroundColor: '#FFF1F0', borderColor: '#FECACA' },
              aqStatus === 'moderate' && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
              aqStatus === 'clean'    && { backgroundColor: '#F0FFF4', borderColor: '#BBF7D0' },
            ]}>
              <View style={[
                styles.aqDot,
                { backgroundColor: aqStatus === 'critical' ? '#E53935' : aqStatus === 'moderate' ? '#F59E0B' : '#4CAF50' },
              ]} />
              <Text style={[
                styles.aqBannerText,
                { color: aqStatus === 'critical' ? '#DC2626' : aqStatus === 'moderate' ? '#D97706' : '#059669' },
              ]}>
                {userBarangay} · {aqStatus === 'critical' ? 'Poor Air Quality' : aqStatus === 'moderate' ? 'Moderate Air Quality' : 'Good Air Quality'}
              </Text>
              {aqStatus === 'critical' && (
                <MaterialIcons name="warning" size={12} color="#DC2626" />
              )}
            </View>
          </View>
        )}
      </View>

      <Animated.View
        style={[
          styles.bottomSheet,
          { height: sheetTotalHeight, transform: [{ translateY: sheetAnim }] },
        ]}
      >
        <View>
          <View style={styles.handleBarContainer}>
            <View style={styles.handleBar} />
          </View>

          {activeSchedule ? (
            <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
              {/* Header: Status & Stops Left */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: liveTruckOnline ? '#006A3B' : '#F59E0B' }}>
                    {liveTruckOnline ? 'Driver is on the way' : 'Truck is Offline / Idle'}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: '#6B7280', marginTop: 2, fontWeight: '500' }}>
                    Route: {activeSchedule.routeName || activeSchedule.barangay}
                  </Text>
                </View>
                {/* Remaining stops pill */}
                {(() => {
                  const remaining = activeSchedule.sitioTasks
                    ? activeSchedule.sitioTasks.filter(t => !t.completed).length
                    : 0;
                  return (
                    <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#006A3B' }}>
                        {remaining} stops left
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 }} />

              {/* Driver & Truck Info Section */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
                {/* Avatar Icon */}
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <MaterialIcons name="person" size={24} color="#4B5563" />
                </View>

                {/* Driver Details */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937' }}>
                    {activeSchedule.driverName || "Driver Assigned"}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1, fontWeight: '500' }}>
                    G-TRASH Driver · 5.0 ⭐
                  </Text>
                </View>

                {/* Truck Badge */}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', letterSpacing: 0.5 }}>
                    {activeSchedule.truckId}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2, fontWeight: '500' }}>
                    Compactor Truck
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 }} />

              {/* Chat / Call Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, alignItems: 'center' }}>
                <View style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                  <MaterialIcons name="chat-bubble-outline" size={16} color="#4B5563" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: '500' }}>
                    Chat with your driver...
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => Alert.alert("Contact Driver", "Calling G-TRASH collection hub dispatch...")}
                  style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}
                >
                  <MaterialIcons name="phone" size={16} color="#006A3B" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7280', textAlign: 'center' }}>
                No active collections scheduled in your area today.
              </Text>
            </View>
          )}
        </View>
        <Animated.View
          style={[styles.routeDetails, { opacity: routeDetailsOpacity }]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            scrollEnabled={isExpanded}
            contentContainerStyle={{ paddingBottom: bottomInset + 8 }}
          >
            {/* Barangay IoT Air Quality Section */}
            {iotAreas.length > 0 && (
              <View style={styles.aqSection}>
                <Text style={styles.aqSectionTitle}>
                  Air Quality · {userBarangay}
                </Text>
                {iotAreas.map((area) => {
                  const aColor = area.status === 'critical' ? '#E53935' : area.status === 'moderate' ? '#F59E0B' : '#4CAF50';
                  return (
                    <View key={area._id} style={styles.aqSensorRow}>
                      <View style={[styles.aqSensorDot, { backgroundColor: aColor }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aqSensorName}>{area.name}</Text>
                        <Text style={styles.aqSensorVals}>
                          NH₃: {area.ammonia || 'N/A'} · CH₄: {area.methane || 'N/A'}
                        </Text>
                      </View>
                      <Text style={[styles.aqSensorStatus, { color: aColor }]}>
                        {area.status.charAt(0).toUpperCase() + area.status.slice(1)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}


          </ScrollView>
        </Animated.View>
      </Animated.View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FBF9F8" },
  mapContainer: { flex: 1, position: "relative" },
  webView: { flex: 1 },
  floatingActions: {
    position: "absolute",
    top: 60,
    right: 16,
    gap: 12,
    zIndex: 10,
  },
  floatingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  floatingButtonActive: { borderColor: "#006A3B", borderWidth: 2 },
  legendOverlay: { position: "absolute", top: 60, left: 16, zIndex: 10 },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  handleBarContainer: { paddingVertical: 16, alignItems: "center", width: "100%" },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
  },
  pillsScroll: { maxHeight: 50 },
  pillsContent: { paddingHorizontal: 24, gap: 10 },
  routePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    py: 8,
    borderRadius: 20,
    borderWeight: 1,
    borderColor: "#F3F4F6",
    backgroundColor: "#F9FAFB",
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  pillText: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  pillsLoading: {
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillsLoadingText: { fontSize: 13, color: "#9CA3AF" },
  sheetHeader: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  routeTitle: { fontSize: 20, fontWeight: "800", color: "#1F2937" },
  scheduleId: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  routeDetails: { flex: 1 },
  timeline: { paddingHorizontal: 24, paddingTop: 8 },
  timelineStep: { flexDirection: "row", gap: 16, marginBottom: 20 },
  timelineIndicator: { alignItems: "center", width: 20 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  timelineDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFF",
  },
  timelineLine: { width: 2, flex: 1, backgroundColor: "#F3F4F6", marginTop: 4 },
  timelineContent: { flex: 1 },
  timelineStopName: { fontSize: 15, fontWeight: "600", color: "#1F2937" },
  timelineTime: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  // Air quality banner (floating top-center of map)
  cleanedNotifWrapper: {
    position: "absolute", top: 50, left: 12, right: 12, zIndex: 20,
  },
  cleanedNotif: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#ECFDF5", borderRadius: 16, borderWidth: 1, borderColor: "#6EE7B7",
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
  },
  cleanedNotifEmoji: { fontSize: 22 },
  cleanedNotifTitle: { fontSize: 13, fontWeight: "700", color: "#065F46" },
  cleanedNotifSub: { fontSize: 11, color: "#047857", marginTop: 1 },
  aqBannerWrapper: {
    position: "absolute", top: 12, left: 0, right: 0,
    alignItems: "center", zIndex: 10,
  },
  aqBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  aqDot: { width: 8, height: 8, borderRadius: 4 },
  aqBannerText: { fontSize: 11, fontWeight: "700" },
  // Air quality section inside the expanded bottom sheet
  aqSection: {
    marginHorizontal: 24, marginBottom: 20,
    backgroundColor: "#F9FAFB", borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  aqSectionTitle: {
    fontSize: 11, fontWeight: "800", color: "#6B7280",
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10,
  },
  aqSensorRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  aqSensorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  aqSensorName: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  aqSensorVals: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  aqSensorStatus: { fontSize: 11, fontWeight: "700", flexShrink: 0 },

  // ── Jeepney View overlay ──
  jeepneyOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#F8FAFC",
    zIndex: 50,
  },
  jeepneyHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    gap: 12,
  },
  jeepneyClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  jeepneyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
  },
  jeepneySubtitle: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
    fontWeight: "500",
  },
  truckStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  jeepneyProgress: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    gap: 6,
  },
  jeepneyProgressBg: {
    height: 5,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  jeepneyProgressFill: {
    height: 5,
    backgroundColor: "#006A3B",
    borderRadius: 3,
  },
  jeepneyProgressLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  jeepneyList: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  jeepneyEmpty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  jeepneyEmptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  jeepneyStopRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 0,
  },
  jeepneyStopTimeline: {
    alignItems: "center",
    width: 24,
  },
  jeepneyStopDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  jeepneyStopLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 1,
  },
  jeepneyStopContent: {
    flex: 1,
    paddingBottom: 20,
  },
  jeepneyStopTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  jeepneyStopName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  jeepneyStopSeq: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
    marginTop: 1,
  },
  jeepneyStopBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  jeepneyStopBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  jeepneyStopTime: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
});
