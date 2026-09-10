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
  Modal,
  Pressable,
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
import { useRoute, useNavigation } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API_URL from "../config";
import { useAuth } from "../context/AuthContext";
import TRUCK_B64 from "../constants/truckBase64";

const TRACKING_SERVER = API_URL;

function getDistanceM(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ROUTE_COLORS = [
  "#006A3B",
  "#2196F3",
  "#FF9800",
  "#9C27B0",
  "#F44336",
  "#00BCD4",
];

const CEBU_BARANGAYS = [
  "Apas",
  "Lahug",
  "Banilad",
  "Talamban",
  "Guadalupe",
  "Mabolo",
  "Kasambagan",
  "Busay",
  "Luz",
  "Capitol Site",
  "Sambag I",
  "Sambag II",
  "Tisa",
  "Labangon",
  "Carbon",
  "Mandaue",
  "Consolacion",
];

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const COLLAPSED_HEIGHT = 80;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.44;

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
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(26,115,232,0.15);
      border: 2px solid rgba(26,115,232,0.35);
      position: absolute; left: -2px; top: -2px;
      animation: pulse 2s ease-out infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.35); opacity: 0; }
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
        maxBounds: cebuBounds, maxBoundsViscosity: 0.0, minZoom: 17, maxZoom: 20,
        inertia: true, inertiaDeceleration: 3000,
      });
      map.setView([10.3157, 123.8854], 17);

      var tileLayer, hillshadeLayer, labelsLayer;
      function setTileLayer(style) {
        if (tileLayer) map.removeLayer(tileLayer);
        if (hillshadeLayer) map.removeLayer(hillshadeLayer);
        if (labelsLayer) map.removeLayer(labelsLayer);

        if (style === 'satellite') {
          tileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 20, maxNativeZoom: 18, minZoom: 17, attribution: '' }
          );
        } else if (style === 'topographic') {
          tileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 20, maxNativeZoom: 18, minZoom: 17, attribution: '' }
          );
          hillshadeLayer = L.tileLayer(
            'https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png',
            { opacity: 0.25, maxZoom: 20, maxNativeZoom: 17, minZoom: 17 }
          ).addTo(map);
          labelsLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            { opacity: 0.7, maxZoom: 20, maxNativeZoom: 18, minZoom: 17 }
          ).addTo(map);
        } else {
          tileLayer = L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            { opacity: 0.9, maxZoom: 20, maxNativeZoom: 19, minZoom: 17 }
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

      // IoT air quality & hazard callouts
      var heatmapCircles = {};
      window.updateHeatmapArea = function(area) {
        var id = area._id;
        var color = area.status === 'critical' ? '#EF4444' : area.status === 'moderate' ? '#F59E0B' : '#10B981';
        var fillOp = area.status === 'critical' ? 0.35 : area.status === 'moderate' ? 0.25 : 0.18;
        if (heatmapCircles[id]) { map.removeLayer(heatmapCircles[id]); }
        
        var group = L.layerGroup();
        
        var r = 180 + Math.round((area.intensity || 0.5) * 120);
        var circle = L.circle([area.lat, area.lng], {
          radius: r, color: color, fillColor: color,
          fillOpacity: fillOp, weight: 2, opacity: 0.8, interactive: true,
        });
        var lvlNum = area.status === 'critical' ? 3 : area.status === 'moderate' ? 2 : 1;
        var lvlName = area.status === 'critical' ? 'Poor' : area.status === 'moderate' ? 'Moderate' : 'Good';
        var lvlDesc = area.status === 'critical' ? 'Alert' : area.status === 'moderate' ? 'Caution' : 'Clean Air';
        var lvlBg = area.status === 'critical' ? '#FEF2F2' : area.status === 'moderate' ? '#FFFBEB' : '#ECFDF5';
        circle.bindPopup(
          '<div style="font-family:sans-serif;min-width:145px;padding:4px 0;">' +
          '<b style="font-size:12px;color:#111827;">' + (area.name || 'Sensor') + '</b><br/>' +
          '<div style="margin-top:6px;display:inline-block;padding:3px 8px;border-radius:12px;background:' + lvlBg + ';border:1px solid ' + color + ';">' +
          '<span style="font-size:11px;color:' + color + ';font-weight:700;">Level ' + lvlNum + ' · ' + lvlName + '</span>' +
          '</div>' +
          '<div style="margin-top:4px;font-size:10px;color:#6B7280;font-weight:500;">' +
          'Status: ' + lvlDesc +
          '</div></div>'
        );
        circle.on('click', function() {
          try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hazard_click', area: area })); } catch(e) {}
        });
        circle.addTo(group);

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
        // 3-layer alert radius around resident pinpoint (Outer: 150m, Mid: 80m, Inner: 30m)
        var layers = [
          { radius: 150, color: '#10B981', fillColor: '#10B981', fillOpacity: 0.07, weight: 1, dashArray: '4 4' },
          { radius: 80,  color: '#059669', fillColor: '#059669', fillOpacity: 0.14, weight: 1.2, dashArray: '3 3' },
          { radius: 30,  color: '#047857', fillColor: '#047857', fillOpacity: 0.24, weight: 1.5, dashArray: null }
        ];
        layers.forEach(function(l) {
          var c = L.circle([lat, lng], {
            radius: l.radius,
            color: l.color,
            fillColor: l.fillColor,
            fillOpacity: l.fillOpacity,
            weight: l.weight,
            dashArray: l.dashArray,
            opacity: 0.85,
            interactive: false,
          }).addTo(map);
          radiusCircles.push(c);
        });
      }

      function makeTruckIcon(truckId, heading) {
        return L.divIcon({
          html: '<div style="display:flex;flex-direction:column;align-items:center;position:relative;">' +
                  '<div style="background:#006A3B;color:#ffffff;font-size:10px;font-weight:800;padding:3px 10px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.25);margin-bottom:4px;white-space:nowrap;letter-spacing:0.3px;">ETA: 8 min</div>' +
                  '<div style="background:#fff;border-radius:12px;padding:4px;box-shadow:0 4px 15px rgba(0,106,59,0.4);border:2.5px solid #006A3B;position:relative;z-index:2;">' +
                    '<img src="data:image/png;base64,' + TB + '" style="width:36px;height:36px;object-fit:contain;display:block;" />' +
                  '</div>' +
                  '<div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid #006A3B;margin-top:-3px;"></div>' +
                '</div>',
          iconSize: [80, 85],
          iconAnchor: [40, 75],
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
        if (truckMarkers[id]) { map.removeLayer(truckMarkers[id]); delete truckMarkers[id]; }
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
            color: r.color || '#006A3B', weight: 4, opacity: 0.85,
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

      // Resident route stop markers — verified sitios with dark green trash bin icon
      var residentStopMarkers = [];
      window.clearResidentStops = function() {
        residentStopMarkers.forEach(function(m) { map.removeLayer(m); });
        residentStopMarkers = [];
      };
      window.addResidentStops = function(stopsJson) {
        window.clearResidentStops();
        var arr = JSON.parse(stopsJson);
        var trashSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        var checkSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        arr.forEach(function(s) {
          var status = s.status || 'upcoming';
          var isDone = status === 'completed';
          var bg = isDone ? '#10B981' : status === 'in-progress' ? '#F59E0B' : '#006A3B';
          var iconContent = isDone ? checkSvg : trashSvg;
          var icon = L.divIcon({
            html: '<div style="display:flex;flex-direction:column;align-items:center;position:relative;">' +
                  '<div style="background:' + bg + ';color:#fff;width:28px;height:28px;border-radius:50%;' +
                  'display:flex;align-items:center;justify-content:center;' +
                  'border:2px solid white;box-shadow:0 3px 8px rgba(0,106,59,0.35);">' + iconContent + '</div>' +
                  '<span style="position:absolute;top:-18px;background:rgba(255,255,255,0.95);color:#1B1C1C;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;border:1px solid #ccc;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.1);">' + s.name + (isDone ? ' ✓' : '') + '</span>' +
                  '</div>',
            iconSize: [28, 28], iconAnchor: [14, 14], className: '',
          });
          var m = L.marker([s.lat, s.lng], { icon: icon });
          m.bindPopup(
            '<div style="font-family:sans-serif;min-width:100px;">' +
            '<b style="font-size:11px;">Sitio ' + s.name + '</b><br>' +
            '<span style="font-size:10px;color:' + (isDone ? '#059669' : '#555') + ';font-weight:700;">Status: ' + (isDone ? 'Collection Completed ✓' : status === 'in-progress' ? 'Scheduled Today' : 'Drop-off Point') + '</span>' +
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

      window.updateUserLocation = function(lat, lng, autoPan) {
        if (userMarker) { map.removeLayer(userMarker); }
        if (userPulseCircle) { map.removeLayer(userPulseCircle); userPulseCircle = null; }
        userMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: '<div style="position:relative; display:flex; justify-content:center; align-items:center; width:36px; height:44px;">' +
                  '<svg viewBox="0 0 36 44" width="36" height="44" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">' +
                  '<path d="M18 0C8.06 0 0 8.06 0 18c0 12.5 18 26 18 26s18-13.5 18-26C36 8.06 27.94 0 18 0z" fill="#006A3B" />' +
                  '<circle cx="18" cy="16.5" r="10.5" fill="#FFFFFF" />' +
                  '<circle cx="18" cy="13" r="3.8" fill="#006A3B" />' +
                  '<path d="M11.8 23c0-3.1 2.8-5.2 6.2-5.2s6.2 2.1 6.2 5.2v0.8h-12.4V23z" fill="#006A3B" />' +
                  '</svg>' +
                  '</div>',
            iconSize: [36, 44], iconAnchor: [18, 44], className: '',
          })
        }).addTo(map);
        drawUserRadius(lat, lng);
        if (autoPan) {
          map.setView([lat, lng], 17);
        }
      };

      window.gotoLocation = function(lat, lng, zoom) { map.setView([lat, lng], zoom || 17); };
      setTimeout(function() { map.invalidateSize(); }, 300);
    })();
  </script>
</body>
</html>`;
}

export default function MapScreen() {
  const navigation = useNavigation();
  const routeParams = useRoute();
  const { focusTruck } = routeParams.params || {};
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const { user } = useAuth();
  const userBarangay = user?.barangay || '';

  const sheetTotalHeight = EXPANDED_HEIGHT + bottomInset;
  const translateCollapsed = sheetTotalHeight - COLLAPSED_HEIGHT;

  const [isExpanded, setIsExpanded] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(null);
  const [liveTruckOnline, setLiveTruckOnline] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState("topographic");
  const [isFollowing, setIsFollowing] = useState(!!focusTruck);
  const [isAutoCenterUser, setIsAutoCenterUser] = useState(true);
  const [showCityOutline, setShowCityOutline] = useState(true);
  const [activeFilter, setActiveFilter] = useState('trucks');
  const [iotAreas, setIotAreas] = useState([]);
  const [truckPosState, setTruckPosState] = useState(null); // UI-reactive truck position
  const [cleanedNotif, setCleanedNotif] = useState(null);
  const [truckBarangay, setTruckBarangay] = useState(null);
  const [binReady, setBinReady] = useState(false);
  const [proximityToast, setProximityToast] = useState(null);
  const [hazardModalVisible, setHazardModalVisible] = useState(false);
  const [selectedHazardArea, setSelectedHazardArea] = useState(null);
  const [clearingNotif, setClearingNotif] = useState(null);

  const [sitioList, setSitioList] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);

  const isExpandedRef = useRef(true);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef(null);
  const socketRef = useRef(null);
  const liveTruckPos = useRef(null);
  const userLocationRef = useRef(null);
  const truckAlertFiredRef = useRef(new Set());
  const toastTimerRef = useRef(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const webViewReadyRef = useRef(false);
  const isFollowingRef = useRef(!!focusTruck);
  const isAutoCenterUserRef = useRef(true);
  const initialTrucks = useRef([]);
  const iotAreasRef = useRef([]);

  useEffect(() => {
    isFollowingRef.current = isFollowing;
  }, [isFollowing]);

  useEffect(() => {
    isAutoCenterUserRef.current = isAutoCenterUser;
  }, [isAutoCenterUser]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  // Load bin prepared status for today
  useEffect(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    AsyncStorage.getItem(`@bin_prepared_${today}`)
      .then((val) => {
        if (val === "true") setBinReady(true);
      })
      .catch(() => {});
  }, []);

  const handlePrepareBin = async () => {
    if (binReady) return;
    if (!liveTruckOnline) {
      Alert.alert(
        "Truck Not Active",
        "You can prepare your bin when the collection truck is actively online and on route in your area.",
        [{ text: "OK" }],
      );
      return;
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    setBinReady(true);
    await AsyncStorage.setItem(`@bin_prepared_${today}`, "true").catch(() => {});
    if (user?.id && user?.barangay) {
      fetch(`${API_URL}/api/bin/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId: user.id, barangay: user.barangay }),
      }).catch(() => {});
    }
    Alert.alert("Bin Prepared! ✓", "Your garbage bin is marked as prepared for active collection. +2 Points earned!");
  };

  const activeSchedule = useMemo(() => {
    if (liveTruckOnline && liveTruckPos.current?.truckId) {
      const match = todaySchedules.find(s => s.truckId === liveTruckPos.current.truckId);
      if (match) return match;
    }
    return todaySchedules.find(s => s.barangay?.toLowerCase() === userBarangay.toLowerCase());
  }, [todaySchedules, liveTruckPos.current, liveTruckOnline, userBarangay]);

  const hasScheduleToday = useMemo(() => {
    if (!todaySchedules || todaySchedules.length === 0) return false;
    const brgy = activeBarangay || userBarangay;
    if (!brgy) return todaySchedules.length > 0;
    return todaySchedules.some(
      (s) =>
        !s.barangay ||
        s.barangay.toLowerCase() === brgy.toLowerCase() ||
        s.routeName?.toLowerCase().includes(brgy.toLowerCase())
    );
  }, [todaySchedules, activeBarangay, userBarangay]);

  const isTruckActiveForBarangay = useMemo(() => {
    return liveTruckOnline && hasScheduleToday;
  }, [liveTruckOnline, hasScheduleToday]);

  const isRouteCompleted = useMemo(() => {
    if (!hasScheduleToday) return false;
    if (activeSchedule?.status === 'completed') return true;
    if (todaySchedules.length > 0 && todaySchedules.every(s => s.status === 'completed')) return true;
    if (cleanedNotif) return true;
    return false;
  }, [hasScheduleToday, activeSchedule, todaySchedules, cleanedNotif]);

  const missedBannerData = useMemo(() => {
    if (binReady) return null;
    if (!hasScheduleToday) return null;

    if (isRouteCompleted || cleanedNotif) {
      return {
        type: 'missed_full',
        title: "You Missed Today's Collection ⚠️",
        message: "The garbage truck completed collection in your area and your bin was not marked ready. Please prepare for the next pickup schedule.",
        icon: "event-busy",
        color: "#D97706",
        bgColor: "#FFFBEB",
        borderColor: "#FDE68A",
      };
    }

    const completedStops = activeSchedule?.sitioTasks?.filter(t => t.completed) || [];
    if (isTruckActiveForBarangay && completedStops.length > 0) {
      const isUserSitioDone = completedStops.some(t =>
        t.name?.toLowerCase().includes(userBarangay?.toLowerCase()) ||
        (user?.sitio && t.name?.toLowerCase().includes(user.sitio.toLowerCase()))
      );
      if (isUserSitioDone) {
        return {
          type: 'missed_sitio',
          title: "Missed Area Collection ⚠️",
          message: "The truck already completed collection at your sitio/area today. Make sure to mark your bin ready in advance next time!",
          icon: "warning",
          color: "#D97706",
          bgColor: "#FFFBEB",
          borderColor: "#FDE68A",
        };
      }
    }

    if (isTruckActiveForBarangay) {
      return {
        type: 'unprepared',
        title: "Bin Not Prepared Yet ⚠️",
        message: `The collection truck is currently active on route in ${activeBarangay || 'your area'}! Tap 'Prepare Bin' below to notify the driver to stop at your location.`,
        icon: "delete-outline",
        color: "#B45309",
        bgColor: "#FEF3C7",
        borderColor: "#FDE68A",
      };
    }

    return null;
  }, [binReady, hasScheduleToday, isRouteCompleted, cleanedNotif, isTruckActiveForBarangay, activeSchedule, userBarangay, activeBarangay, user]);

  const hasMissedTruck = !!missedBannerData;

  const distToUser = useMemo(() => {
    if (!truckPosState?.lat || !userLocation?.lat) return null;
    return Math.round(getDistanceM(userLocation.lat, userLocation.lng, truckPosState.lat, truckPosState.lng));
  }, [truckPosState, userLocation]);

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
            setTruckPosState({ lat: active.lat, lng: active.lng, truckId: active.truckId });
            setLiveTruckOnline(true);
          } else {
            liveTruckPos.current = null;
            setTruckPosState(null);
            setLiveTruckOnline(false);
          }
          // Inject markers immediately if WebView is already loaded
          if (webViewReadyRef.current) {
            online.forEach((t) => {
              const safeId = (t.truckId || "GT").replace(/'/g, "\\'");
              webViewRef.current?.injectJavaScript(
                `window.updateTruckPosition(${t.lat}, ${t.lng}, '${safeId}', false); true;`,
              );
            });
          }
        }
      } catch (e) {
        console.warn('MapScreen fetch error:', e);
      } finally {
        setDataLoading(false);
      }
    })();
  }, []);

  const [selectedBarangay, setSelectedBarangay] = useState(user?.barangay || 'Apas');
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarSchedules, setCalendarSchedules] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const activeBarangay = selectedBarangay || user?.barangay || 'Apas';

  const aqStatus = useMemo(() => {
    if (!iotAreas || iotAreas.length === 0) return 'moderate';
    if (iotAreas.some(a => a.status === 'critical')) return 'critical';
    if (iotAreas.some(a => a.status === 'moderate')) return 'moderate';
    return 'clean';
  }, [iotAreas]);

  // Fetch barangay-specific IoT garbage areas
  useEffect(() => {
    if (!activeBarangay) return;
    fetch(`${API_URL}/api/garbage-areas?barangay=${encodeURIComponent(activeBarangay)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setIotAreas(data);
          iotAreasRef.current = data;
        }
      })
      .catch(() => {});
  }, [activeBarangay]);

  // Fetch verified sitios and today's schedules for active barangay
  const fetchSitiosAndSchedules = useCallback(() => {
    if (!activeBarangay) return;
    
    const fetchSitios = fetch(`${API_URL}/api/sitios?barangay=${encodeURIComponent(activeBarangay)}`).then(r => r.json());
    
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
  }, [activeBarangay]);

  useEffect(() => {
    fetchSitiosAndSchedules();
  }, [fetchSitiosAndSchedules]);

  // Fetch schedules for Calendar Schedule Modal
  useEffect(() => {
    if (!showCalendarModal) return;
    setCalendarLoading(true);
    fetch(`${API_URL}/api/schedules`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.schedules || [];
        const filtered = list.filter(
          (s) =>
            !s.barangay ||
            s.barangay.toLowerCase() === activeBarangay.toLowerCase() ||
            s.routeName?.toLowerCase().includes(activeBarangay.toLowerCase())
        );
        setCalendarSchedules(filtered.length > 0 ? filtered : list);
      })
      .catch(() => {})
      .finally(() => setCalendarLoading(false));
  }, [showCalendarModal, activeBarangay]);

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
      if (webViewReadyRef.current) {
        const safeId = (truckId || "GT").replace(/'/g, "\\'");
        webViewRef.current?.injectJavaScript(
          `window.updateTruckPosition(${lat}, ${lng}, '${safeId}', ${isFollowingRef.current}, ${heading || 0}); true;`,
        );
      }

      // Proximity notification when truck is active and approaches user location
      const loc = userLocationRef.current;
      if (loc) {
        const distM = getDistanceM(loc.lat, loc.lng, lat, lng);
        if (distM < 25 && !truckAlertFiredRef.current.has(`near-${truckId}`)) {
          truckAlertFiredRef.current.add(`near-${truckId}`);
          clearTimeout(toastTimerRef.current);
          setProximityToast(`🚚 Truck ${truckId} is right at your location (~${Math.round(distM)}m) — prepare your bin!`);
          toastTimerRef.current = setTimeout(() => setProximityToast(null), 6000);
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Garbage Truck Very Close!",
              body: `Truck ${truckId} is passing right near your location — please have your bin ready.`,
              sound: true,
            },
            trigger: null,
          }).catch(() => {});
        } else if (distM < 100 && !truckAlertFiredRef.current.has(`approach-${truckId}`)) {
          truckAlertFiredRef.current.add(`approach-${truckId}`);
          clearTimeout(toastTimerRef.current);
          setProximityToast(`🚚 Truck ${truckId} is approaching your area (~${Math.round(distM)}m).`);
          toastTimerRef.current = setTimeout(() => setProximityToast(null), 6000);
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Garbage Truck Approaching",
              body: `Truck ${truckId} is on its way to your neighborhood.`,
              sound: true,
            },
            trigger: null,
          }).catch(() => {});
        }
      }
    });

    socket.on("truck:status", ({ truckId, status }) => {
      if (status === "offline") {
        setLiveTruckOnline(false);
        const safeId = (truckId || "GT").replace(/'/g, "\\'");
        if (webViewReadyRef.current) {
          webViewRef.current?.injectJavaScript(
            `window.removeTruckMarker('${safeId}'); true;`,
          );
        }
        liveTruckPos.current = null;
        setTruckPosState(null);
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
      if (webViewReadyRef.current) {
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
          if (webViewReadyRef.current) {
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

    socket.on("truck:clearing:update", (data) => {
      if (data.status === "clearing") {
        setClearingNotif(data);
        clearTimeout(toastTimerRef.current);
        setProximityToast(`🧹 Waste Clearing in Progress at ${data.sitioName} (${data.truckId})`);
        toastTimerRef.current = setTimeout(() => setProximityToast(null), 10000);
        Notifications.scheduleNotificationAsync({
          content: {
            title: "🧹 Waste Clearing in Progress!",
            body: `Truck ${data.truckId} is actively clearing waste bins at ${data.sitioName}.`,
            sound: true,
          },
          trigger: null,
        }).catch(() => {});
      } else {
        setClearingNotif((prev) => (prev?.sitioName === data.sitioName ? null : prev));
      }
    });

    socket.on("schedule:task:completed", (data) => {
      setClearingNotif((prev) => (prev?.sitioName === data.sitioName ? null : prev));
    });

    socket.on("schedule:changed", () => {
      fetchSitiosAndSchedules();
    });

    socket.on("route:completed", (data) => {
      setClearingNotif(null);
      setCleanedNotif({
        name: `${data.barangay || 'Area'} Collection Route Completed 🎉`,
        barangay: data.barangay,
        collectedBy: `Truck ${data.truckId} (${data.driverName || 'Collector'})`,
        weight: '100% Cleared',
      });
      setTimeout(() => setCleanedNotif(null), 8000);
      fetchSitiosAndSchedules();
    });

    return () => socket.disconnect();
  }, [fetchSitiosAndSchedules]);

  const handleWebViewLoad = useCallback(() => {
    webViewReadyRef.current = true;
    setWebViewReady(true);

    if (userLocationRef.current) {
      const { lat, lng } = userLocationRef.current;
      const autoPan = isAutoCenterUserRef.current && !isFollowingRef.current;
      webViewRef.current?.injectJavaScript(
        `window.updateUserLocation(${lat}, ${lng}, ${autoPan}); true;`,
      );
    }
    
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
    if (msg.startsWith("route:")) {
      setSelectedRouteId(msg.slice(6));
    } else {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'hazard_click' && data.area) {
          setSelectedHazardArea(data.area);
          setHazardModalVisible(true);
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    let subscription = null;
    (async () => {
      try {
        setIsLocationLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status);
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const { latitude, longitude } = loc.coords;
          const pos = { lat: latitude, lng: longitude };
          setUserLocation(pos);
          userLocationRef.current = pos;

          setTimeout(() => {
            webViewRef.current?.injectJavaScript(
              `window.updateUserLocation(${latitude}, ${longitude}, true); true;`,
            );
          }, 600);

          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 4000,
              distanceInterval: 5,
            },
            (newLoc) => {
              const { latitude: nLat, longitude: nLng } = newLoc.coords;
              const newPos = { lat: nLat, lng: nLng };
              setUserLocation(newPos);
              userLocationRef.current = newPos;

              const shouldPan = isAutoCenterUserRef.current && !isFollowingRef.current;
              webViewRef.current?.injectJavaScript(
                `window.updateUserLocation(${nLat}, ${nLng}, ${shouldPan}); true;`,
              );
            }
          );
        }
      } catch (e) {
        console.warn("Location error:", e);
      } finally {
        setIsLocationLoading(false);
      }
    })();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
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

        {user && (
          <>
            <View style={styles.floatingActions}>
          <TouchableOpacity
            style={[
              styles.floatingButton,
              isFollowing && styles.floatingButtonActive,
            ]}
            onPress={() => {
              const nextFollowing = !isFollowing;
              setIsFollowing(nextFollowing);
              if (nextFollowing) {
                setIsAutoCenterUser(false);
                isAutoCenterUserRef.current = false;
                if (liveTruckPos.current) {
                  const { lat, lng } = liveTruckPos.current;
                  webViewRef.current?.injectJavaScript(
                    `window.gotoLocation(${lat}, ${lng}, 17); true;`,
                  );
                }
              }
            }}
          >
            <MaterialIcons
              name="navigation"
              size={20}
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
              name="layers"
              size={20}
              color={mapStyle !== "voyager" ? "#006A3B" : "#1B1C1C"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.floatingButton,
              isAutoCenterUser && styles.floatingButtonActive,
            ]}
            onPress={() => {
              const nextAutoCenter = !isAutoCenterUser;
              setIsAutoCenterUser(nextAutoCenter);
              isAutoCenterUserRef.current = nextAutoCenter;
              if (nextAutoCenter) {
                setIsFollowing(false);
                isFollowingRef.current = false;
              }

              setIsLocationLoading(true);
              if (userLocationRef.current) {
                const { lat, lng } = userLocationRef.current;
                webViewRef.current?.injectJavaScript(
                  `window.gotoLocation(${lat}, ${lng}, 17); true;`,
                );
                setTimeout(() => setIsLocationLoading(false), 400);
              } else {
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
                  .then((loc) => {
                    const { latitude, longitude } = loc.coords;
                    const pos = { lat: latitude, lng: longitude };
                    setUserLocation(pos);
                    userLocationRef.current = pos;
                    webViewRef.current?.injectJavaScript(
                      `window.updateUserLocation(${latitude}, ${longitude}, true); true;`,
                    );
                  })
                  .catch((err) => console.warn("Recenter error:", err))
                  .finally(() => setIsLocationLoading(false));
              }
            }}
          >
            {isLocationLoading ? (
              <ActivityIndicator size="small" color="#006A3B" />
            ) : (
              <MaterialIcons
                name="my-location"
                size={20}
                color={isAutoCenterUser ? "#006A3B" : "#1B1C1C"}
              />
            )}
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
            <MaterialIcons name="crop-free" size={20} color={showCityOutline ? "#006A3B" : "#1B1C1C"} />
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
            <MaterialIcons name="directions-bus" size={20} color={isExpanded ? "#006A3B" : "#1B1C1C"} />
          </TouchableOpacity>
        </View>

        {/* Floating Air Quality Capsule Banner */}
        {activeBarangay && (
          <View style={styles.aqPillWrapper} pointerEvents="none">
            <View
              style={[
                styles.aqPillBanner,
                aqStatus === 'critical' && { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
                aqStatus === 'moderate' && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                aqStatus === 'clean' && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
              ]}
            >
              <View
                style={[
                  styles.aqPillDot,
                  aqStatus === 'critical' && { backgroundColor: '#EF4444' },
                  aqStatus === 'moderate' && { backgroundColor: '#F59E0B' },
                  aqStatus === 'clean' && { backgroundColor: '#10B981' },
                ]}
              />
              <Text
                style={[
                  styles.aqPillText,
                  aqStatus === 'critical' && { color: '#B91C1C' },
                  aqStatus === 'moderate' && { color: '#D97706' },
                  aqStatus === 'clean' && { color: '#047857' },
                ]}
              >
                {activeBarangay} · {aqStatus === 'critical' ? 'Poor Air Quality' : aqStatus === 'moderate' ? 'Moderate Air Quality' : 'Clean Air Quality'}
              </Text>
            </View>
          </View>
        )}

        {/* Location Loading Banner Overlay */}
        {isLocationLoading && (
          <View style={styles.locationLoadingWrapper} pointerEvents="none">
            <View style={styles.locationLoadingBanner}>
              <ActivityIndicator size="small" color="#006A3B" />
              <Text style={styles.locationLoadingText}>Locating your position...</Text>
            </View>
          </View>
        )}

        {/* Proximity Approaching Truck Toast */}
        {proximityToast && (
          <View style={styles.proximityToastWrapper} pointerEvents="none">
            <View style={styles.proximityToast}>
              <MaterialIcons name="notifications-active" size={20} color="#006A3B" />
              <Text style={styles.proximityToastText} numberOfLines={2}>
                {proximityToast}
              </Text>
            </View>
          </View>
        )}

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

        {/* Clearing In Progress Banner Notification */}
        {clearingNotif && (
          <View style={styles.cleanedNotifWrapper} pointerEvents="none">
            <View style={[styles.cleanedNotif, { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
              <Text style={styles.cleanedNotifEmoji}>🧹</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cleanedNotifTitle, { color: '#065F46' }]}>Clearing In Progress</Text>
                <Text style={[styles.cleanedNotifSub, { color: '#047857' }]} numberOfLines={2}>
                  Waste collection active at {clearingNotif.sitioName} (Truck {clearingNotif.truckId})
                </Text>
              </View>
            </View>
          </View>
        )}
          </>
        )}
      </View>

      {user && (
        <View style={styles.bottomSheet}>
          <View style={styles.handleBarContainer}>
            <View style={styles.handleBar} />
          </View>

            <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
              {/* Header: Status & Stops Left */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isRouteCompleted ? '#10B981' : isTruckActiveForBarangay ? '#059669' : '#6B7280' }} />
                    <Text style={{ fontSize: 15, fontWeight: '800', color: isRouteCompleted ? '#059669' : isTruckActiveForBarangay ? '#006A3B' : '#374151' }}>
                      {isRouteCompleted
                        ? 'Route Collection Completed ✓'
                        : isTruckActiveForBarangay
                          ? (distToUser != null && distToUser < 50
                              ? 'Truck Passing Near You!'
                              : distToUser != null && distToUser < 200
                                ? 'Truck Approaching Area'
                                : 'Driver is Active on Route')
                          : hasScheduleToday
                            ? 'Scheduled · Collection Standby'
                            : 'No Collection Scheduled Today'}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: '#6B7280', marginTop: 2, fontWeight: '500' }}>
                    Route: {activeSchedule?.routeName || activeSchedule?.barangay || userBarangay || 'Collection Area'}
                  </Text>
                </View>
                {/* Remaining stops pill */}
                {(() => {
                  if (isRouteCompleted) {
                    return (
                      <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialIcons name="check-circle" size={14} color="#059669" />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>
                          Completed ✓
                        </Text>
                      </View>
                    );
                  }
                  if (!hasScheduleToday) {
                    return (
                      <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>
                          No schedule
                        </Text>
                      </View>
                    );
                  }
                  const remaining = activeSchedule?.sitioTasks
                    ? activeSchedule.sitioTasks.filter(t => !t.completed).length
                    : (sitioList.length || 0);
                  return (
                    <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#D1FAE5' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#006A3B' }}>
                        {remaining} {remaining === 1 ? 'stop' : 'stops'} left
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {/* Driver & Truck Info Section */}
              <View style={styles.driverCard}>
                {/* Truck Avatar Icon */}
                <View style={styles.driverAvatarBg}>
                  <MaterialIcons name="local-shipping" size={24} color="#006A3B" />
                </View>

                {/* Driver & Truck Details */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.truckName}>
                    {activeSchedule?.truckId || "Truck 2"}
                  </Text>
                  <Text style={styles.driverName}>
                    {activeSchedule?.driverName || "Xherdone James"}
                  </Text>
                  <Text style={styles.driverSub}>
                    {isRouteCompleted
                      ? 'Route collection completed for today'
                      : isTruckActiveForBarangay
                        ? `Collecting waste in ${activeBarangay || 'Apas'}`
                        : hasScheduleToday
                          ? 'Scheduled for collection'
                          : 'No collection schedule today'}
                  </Text>
                </View>

                {/* Truck Badge */}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.truckPlate}>
                    {activeSchedule?.truckPlate || activeSchedule?.truckId || 'GT-QSO'}
                  </Text>
                  <View style={styles.liveBadgeRow}>
                    <View style={[styles.liveDot, isRouteCompleted ? { backgroundColor: '#10B981' } : isTruckActiveForBarangay ? { backgroundColor: '#059669' } : { backgroundColor: '#9CA3AF' }]} />
                    <Text style={[styles.liveBadgeText, isRouteCompleted ? { color: '#059669' } : isTruckActiveForBarangay ? { color: '#059669' } : { color: '#6B7280' }]}>
                      {isRouteCompleted ? 'COMPLETED ✓' : isTruckActiveForBarangay ? 'LIVE TRACKING' : 'STANDBY'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Missed / Unprepared Waste Collection Warning Banner */}
              {missedBannerData && (
                <View style={{
                  backgroundColor: missedBannerData.bgColor,
                  borderColor: missedBannerData.borderColor,
                  borderWidth: 1.5,
                  borderRadius: 14,
                  padding: 12,
                  marginVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={missedBannerData.icon} size={22} color={missedBannerData.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E' }}>
                      {missedBannerData.title}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#B45309', marginTop: 2, lineHeight: 15, fontWeight: '500' }}>
                      {missedBannerData.message}
                    </Text>
                  </View>
                </View>
              )}

              {/* Resident Action Shortcuts */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginTop: 4, paddingVertical: 2 }}
              >
                {/* Prepare Bin Button */}
                <TouchableOpacity
                  onPress={handlePrepareBin}
                  activeOpacity={0.8}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: binReady
                      ? '#ECFDF5'
                      : hasMissedTruck
                        ? '#FFFBEB'
                        : liveTruckOnline
                          ? '#006A3B'
                          : '#F3F4F6',
                    borderWidth: 1,
                    borderColor: binReady
                      ? '#A7F3D0'
                      : hasMissedTruck
                        ? '#FDE68A'
                        : liveTruckOnline
                          ? '#006A3B'
                          : '#E5E7EB',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 5,
                  }}
                >
                  <MaterialIcons
                    name={binReady ? 'check-circle' : hasMissedTruck ? 'event-busy' : 'delete-outline'}
                    size={16}
                    color={binReady ? '#006A3B' : hasMissedTruck ? '#D97706' : liveTruckOnline ? '#FFFFFF' : '#9CA3AF'}
                  />
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: binReady ? '#006A3B' : hasMissedTruck ? '#D97706' : liveTruckOnline ? '#FFFFFF' : '#9CA3AF',
                  }}>
                    {binReady ? 'Bin Ready ✓' : hasMissedTruck ? 'Missed Pickup ⚠️' : 'Prepare Bin'}
                  </Text>
                </TouchableOpacity>

                {/* Report Hazard Shortcut */}
                <TouchableOpacity
                  onPress={() => navigation.navigate('Report')}
                  activeOpacity={0.8}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: '#FEF3C7',
                    borderWidth: 1,
                    borderColor: '#FDE68A',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 5,
                  }}
                >
                  <MaterialIcons name="report-problem" size={16} color="#B45309" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#B45309' }}>
                    Report Issue
                  </Text>
                </TouchableOpacity>

                {/* Follow / Focus Truck Shortcut */}
                <TouchableOpacity
                  onPress={() => {
                    const next = !isFollowing;
                    setIsFollowing(next);
                    if (liveTruckPos.current) {
                      const { lat, lng } = liveTruckPos.current;
                      webViewRef.current?.injectJavaScript(`window.gotoLocation(${lat}, ${lng}, 17); true;`);
                    }
                  }}
                  activeOpacity={0.8}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: isFollowing ? '#DCFCE7' : '#F1F5F9',
                    borderWidth: 1,
                    borderColor: isFollowing ? '#86EFAC' : '#E2E8F0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 5,
                  }}
                >
                  <MaterialIcons
                    name={isFollowing ? 'gps-fixed' : 'gps-not-fixed'}
                    size={16}
                    color={isFollowing ? '#006A3B' : '#475569'}
                  />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isFollowing ? '#006A3B' : '#475569' }}>
                    {isFollowing ? 'Following' : 'Track Truck'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
        </View>
      )}

      {/* Guest Mode: Bottom Banner with Sign In */}
      {!user && (
        <View style={[styles.guestBottomBanner, { paddingBottom: Math.max(bottomInset, 16) }]}>
          <View style={styles.guestBannerContent}>
            <View style={styles.guestIconWrap}>
              <MaterialIcons name="local-shipping" size={24} color="#006A3B" />
            </View>
            <View style={styles.guestTextWrap}>
              <Text style={styles.guestBannerTitle}>Welcome to G-Trash</Text>
              <Text style={styles.guestBannerSub}>
                Sign in to track live collection routes and prepare your bin.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.guestSignInBtn}
            onPress={() => navigation.navigate("Login")}
            activeOpacity={0.85}
          >
            <MaterialIcons name="login" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.guestSignInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Air Quality & Hazard Zone Pop-Up Modal */}
      <Modal
        visible={hazardModalVisible && !!user}
        transparent
        animationType="slide"
        onRequestClose={() => setHazardModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlayDark}
          activeOpacity={1}
          onPress={() => setHazardModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.hazardModalCard}>
            <View style={styles.modalHandleBar} />

            {/* Header with Hazard Status */}
            <View style={styles.hazardModalHeader}>
              <View style={[styles.hazardIconWrap, {
                backgroundColor: selectedHazardArea?.status === 'critical' ? '#FEF2F2' : selectedHazardArea?.status === 'moderate' ? '#FFFBEB' : '#ECFDF5'
              }]}>
                <MaterialIcons name="air" size={24} color={
                  selectedHazardArea?.status === 'critical' ? '#E53935' :
                  selectedHazardArea?.status === 'moderate' ? '#D97706' : '#059669'
                } />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hazardModalTitle}>
                  {selectedHazardArea?.name || 'Sensor Zone'}
                </Text>
                <Text style={styles.hazardModalSub}>
                  {selectedHazardArea?.barangay || 'Barangay Area'} • Air Quality Monitoring
                </Text>
              </View>
              <TouchableOpacity onPress={() => setHazardModalVisible(false)} style={styles.hazardCloseBtn}>
                <MaterialIcons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Hazard Status Pill & 3 Level Air Quality Indicator */}
            {(() => {
              const isCrit =
                selectedHazardArea?.status === "critical" ||
                selectedHazardArea?.airQuality === "Unhealthy" ||
                selectedHazardArea?.airQuality === "Hazardous" ||
                selectedHazardArea?.airQuality === "Critical";
              const isMod =
                selectedHazardArea?.status === "moderate" ||
                selectedHazardArea?.airQuality === "Moderate";
              const hLevel = isCrit ? 3 : isMod ? 2 : 1;
              const hLabel = isCrit
                ? "POOR AIR QUALITY"
                : isMod
                ? "MODERATE AIR QUALITY"
                : "GOOD AIR QUALITY";
              return (
                <>
                  <View
                    style={[
                      styles.hazardStatusBadge,
                      {
                        backgroundColor: isCrit
                          ? "#FEF2F2"
                          : isMod
                          ? "#FFFBEB"
                          : "#ECFDF5",
                        borderColor: isCrit
                          ? "#FCA5A5"
                          : isMod
                          ? "#FDE68A"
                          : "#A7F3D0",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.hazardStatusDot,
                        {
                          backgroundColor: isCrit
                            ? "#E53935"
                            : isMod
                            ? "#F59E0B"
                            : "#10B981",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.hazardStatusText,
                        {
                          color: isCrit
                            ? "#DC2626"
                            : isMod
                            ? "#D97706"
                            : "#047857",
                        },
                      ]}
                    >
                      {`LEVEL ${hLevel} · ${hLabel}`}
                    </Text>
                  </View>

                  {/* 3 Level Air Quality Status Row */}
                  <View style={styles.hazardLevelsRow}>
                    {[
                      {
                        level: 1,
                        label: "Good",
                        desc: "Clean Air",
                        color: "#10B981",
                        bg: "#ECFDF5",
                        border: "#10B981",
                      },
                      {
                        level: 2,
                        label: "Moderate",
                        desc: "Caution",
                        color: "#F59E0B",
                        bg: "#FFFBEB",
                        border: "#F59E0B",
                      },
                      {
                        level: 3,
                        label: "Poor",
                        desc: "Alert",
                        color: "#EF4444",
                        bg: "#FEF2F2",
                        border: "#EF4444",
                      },
                    ].map((item) => {
                      const isCur = hLevel === item.level;
                      return (
                        <View
                          key={item.level}
                          style={[
                            styles.hazardLevelCard,
                            isCur
                              ? {
                                  backgroundColor: item.bg,
                                  borderColor: item.border,
                                  borderWidth: 1.5,
                                }
                              : styles.hazardLevelCardInactive,
                          ]}
                        >
                          <View style={styles.hazardLevelHeader}>
                            <View
                              style={[
                                styles.hazardLevelDot,
                                {
                                  backgroundColor: isCur
                                    ? item.color
                                    : "#9CA3AF",
                                },
                              ]}
                            />
                            <Text
                              style={[
                                styles.hazardLevelNum,
                                { color: isCur ? item.color : "#9CA3AF" },
                              ]}
                            >
                              Level {item.level}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.hazardLevelTitle,
                              {
                                color: isCur ? "#111827" : "#4B5563",
                                fontWeight: isCur ? "700" : "600",
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                          <Text
                            style={[
                              styles.hazardLevelDesc,
                              { color: isCur ? item.color : "#9CA3AF" },
                            ]}
                          >
                            {item.desc}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              );
            })()}

            {/* Air Quality Index Trend Graph */}
            <View style={styles.hazardChartContainer}>
              <Text style={styles.hazardChartTitle}>Air Quality Reading Trend</Text>
              <View style={styles.hazardBarChart}>
                {[
                  { label: '6 AM', val: selectedHazardArea?.status === 'critical' ? 55 : 30 },
                  { label: '9 AM', val: selectedHazardArea?.status === 'critical' ? 70 : 45 },
                  { label: '12 PM', val: selectedHazardArea?.status === 'critical' ? 85 : 50 },
                  { label: '3 PM', val: selectedHazardArea?.status === 'critical' ? 95 : 60 },
                  { label: '6 PM', val: selectedHazardArea?.status === 'critical' ? 65 : 40 },
                  { label: 'Now', val: selectedHazardArea?.status === 'critical' ? 90 : 35 },
                ].map((item, idx) => (
                  <View key={idx} style={styles.hazardBarCol}>
                    <View style={styles.hazardBarTrack}>
                      <View style={[styles.hazardBarFill, {
                        height: `${item.val}%`,
                        backgroundColor: item.val > 75 ? '#E53935' : item.val > 50 ? '#F59E0B' : '#10B981',
                      }]} />
                    </View>
                    <Text style={styles.hazardBarLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Safety & Recommendation Banner */}
            <View style={styles.hazardRecBox}>
              <MaterialIcons name="shield" size={18} color="#006A3B" />
              <Text style={styles.hazardRecText}>
                {selectedHazardArea?.status === 'critical'
                  ? 'Level 3 Alert: Poor air quality detected. Please wear a mask when near this waste container.'
                  : selectedHazardArea?.status === 'moderate'
                  ? 'Level 2 Caution: Moderate air quality detected. Ensure waste bin lid remains tightly closed.'
                  : 'Level 1 Normal: Air quality levels are good. Healthy environment around waste zone.'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.hazardDoneBtn}
              onPress={() => setHazardModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.hazardDoneBtnText}>Close Monitoring</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Barangay Selection Picker Modal ── */}
      <Modal
        visible={showBarangayModal && !!user}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBarangayModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          activeOpacity={1}
          onPress={() => setShowBarangayModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, elevation: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="location-on" size={22} color="#006A3B" />
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>Select Barangay</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBarangayModal(false)}>
                <MaterialIcons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {CEBU_BARANGAYS.map((b) => {
                const isActive = activeBarangay.toLowerCase() === b.toLowerCase();
                return (
                  <TouchableOpacity
                    key={b}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      backgroundColor: isActive ? '#ECFDF5' : '#F9FAFB',
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: isActive ? '#A7F3D0' : '#F3F4F6',
                    }}
                    onPress={() => {
                      setSelectedBarangay(b);
                      setShowBarangayModal(false);
                    }}
                  >
                    <MaterialIcons name="map" size={18} color={isActive ? '#006A3B' : '#9CA3AF'} style={{ marginRight: 10 }} />
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: isActive ? '700' : '500', color: isActive ? '#006A3B' : '#374151' }}>
                      Barangay {b}
                    </Text>
                    {isActive && <MaterialIcons name="check-circle" size={18} color="#006A3B" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Barangay Collection Calendar Schedule Modal ── */}
      <Modal
        visible={showCalendarModal && !!user}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowCalendarModal(false)} />
          <View
            style={{
              width: '100%',
              height: SCREEN_HEIGHT * 0.78,
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 16,
              paddingBottom: 10,
              elevation: 20,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 16,
            }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 }} />
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="event" size={24} color="#006A3B" />
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827' }}>Collection Schedule</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Barangay {activeBarangay}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {calendarLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#006A3B" />
              </View>
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
              >
                {/* 3-Day Cycle Notice */}
                <View style={{ backgroundColor: '#ECFDF5', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#A7F3D0', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <MaterialIcons name="schedule" size={22} color="#006A3B" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#006A3B' }}>3-Day Garbage Pickup Routine</Text>
                    <Text style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>Garbage trucks collect waste every 3 days in {activeBarangay}.</Text>
                  </View>
                </View>

                {/* Sitio / Route Breakdown */}
                {calendarSchedules.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <MaterialIcons name="event-busy" size={36} color="#9CA3AF" />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280', marginTop: 8 }}>No specific schedule found for {activeBarangay}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Regular 3-day pickup routine applies.</Text>
                  </View>
                ) : (
                  calendarSchedules.map((sched, idx) => (
                    <View
                      key={sched._id || idx}
                      style={{
                        backgroundColor: '#F9FAFB',
                        borderRadius: 18,
                        padding: 16,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        shadowColor: '#000',
                        shadowOpacity: 0.03,
                        shadowRadius: 4,
                        elevation: 1,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', flex: 1, marginRight: 6 }} numberOfLines={1}>
                          {sched.routeName || `Route ${idx + 1}`}
                        </Text>
                        <View style={{ backgroundColor: sched.status === 'completed' ? '#DCFCE7' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: sched.status === 'completed' ? '#006A3B' : '#D97706' }}>
                            {sched.status === 'completed' ? 'COMPLETED' : 'SCHEDULED'}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 12, color: '#4B5563', fontWeight: '600', marginBottom: 8 }}>
                        📅 {sched.date || 'Today'}  •  🚚 {sched.truckId || 'GT-Assigned'}
                      </Text>

                      {sched.sitioTasks && sched.sitioTasks.length > 0 && (
                        <View style={{ gap: 5, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.5 }}>SITIO STOPS</Text>
                          {sched.sitioTasks.map((t, tidx) => (
                            <View key={tidx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <MaterialIcons name={t.completed ? 'check-circle' : 'radio-button-unchecked'} size={14} color={t.completed ? '#10B981' : '#9CA3AF'} />
                              <Text style={{ fontSize: 12, color: t.completed ? '#059669' : '#374151', textDecorationLine: t.completed ? 'line-through' : 'none', fontWeight: '500' }}>
                                Sitio {t.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))
                )}

                {!user && (
                  <View style={{ marginTop: 12, padding: 14, backgroundColor: '#EFF6FF', borderRadius: 16, borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#1E40AF', textAlign: 'center', marginBottom: 10 }}>
                      Sign in to earn Eco-Points & Streaks when you prepare your bin!
                    </Text>
                    <TouchableOpacity
                      style={{ backgroundColor: '#006A3B', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 }}
                      onPress={() => {
                        setShowCalendarModal(false);
                        navigation.navigate("Login");
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Sign In Now 🌟</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FBF9F8" },
  mapContainer: { flex: 1, position: "relative" },
  webView: { flex: 1 },
  floatingActions: {
    position: "absolute",
    top: 16,
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
  legendOverlay: { position: "absolute", top: 16, left: 16, zIndex: 10 },
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
    paddingBottom: 10,
  },
  guestBottomBanner: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderBottomWidth: 0,
    zIndex: 20,
  },
  guestBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  guestIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  guestTextWrap: {
    flex: 1,
  },
  guestBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 3,
  },
  guestBannerSub: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 17,
  },
  guestSignInBtn: {
    backgroundColor: "#006A3B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  guestSignInBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
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
  routeDetails: { flex: 1, minHeight: 0 },
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
  // Proximity notification toast (floating top-center of map)
  proximityToastWrapper: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    zIndex: 30,
  },
  proximityToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#006A3B",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  proximityToastText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065F46",
    flex: 1,
    lineHeight: 18,
  },
  // Air quality banner (floating top-center of map)
  cleanedNotifWrapper: {
    position: "absolute", top: 16, left: 12, right: 12, zIndex: 20,
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

  // Hazard Air Quality Pop-Up Modal
  modalOverlayDark: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  hazardModalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    alignItems: "stretch",
  },
  modalHandleBar: {
    width: 36,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  hazardModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  hazardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  hazardModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  hazardModalSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  hazardCloseBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  hazardStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  hazardStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hazardStatusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  hazardLevelsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  hazardLevelCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  hazardLevelCardInactive: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
    opacity: 0.65,
  },
  hazardLevelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  hazardLevelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hazardLevelNum: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  hazardLevelTitle: {
    fontSize: 13,
    marginTop: 2,
  },
  hazardLevelDesc: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  hazardMetricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  hazardMetricCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  hazardMetricLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  hazardMetricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
  },
  hazardChartContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  hazardChartTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  hazardBarChart: {
    flexDirection: "row",
    height: 90,
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  hazardBarCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  hazardBarTrack: {
    width: "100%",
    height: 65,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  hazardBarFill: {
    width: "100%",
    borderRadius: 6,
  },
  hazardBarLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 4,
  },
  hazardRecBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 16,
  },
  hazardRecText: {
    flex: 1,
    fontSize: 12,
    color: "#047857",
    lineHeight: 16,
    fontWeight: "500",
  },
  hazardDoneBtn: {
    backgroundColor: "#006A3B",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  hazardDoneBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  locationLoadingWrapper: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  locationLoadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  locationLoadingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#006A3B",
  },

  // Top App Header & Filter Bar Styles
  topHeader: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    zIndex: 10,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  leafIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#006A3B",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#006A3B",
    letterSpacing: 0.5,
    lineHeight: 20,
  },
  headerSubTitle: {
    fontSize: 8,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 0.6,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    position: "relative",
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    position: "absolute",
    top: 7,
    right: 7,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#006A3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 10,
  },
  searchPlaceholder: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
    flex: 1,
  },
  filterChipScroll: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipActive: {
    backgroundColor: "#006A3B",
    borderColor: "#006A3B",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },

  // Bottom Sheet Driver & Truck Card
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  driverAvatarBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  truckName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1F2937",
    lineHeight: 18,
  },
  driverName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
    marginTop: 2,
  },
  driverSub: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 1,
  },
  truckPlate: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 0.5,
  },
  liveBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#059669",
  },
  liveBadgeText: {
    fontSize: 10,
    color: "#059669",
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  aqPillWrapper: {
    position: "absolute",
    top: 14,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  aqPillBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  aqPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
  },
  aqPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#D97706",
  },
});
