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
  LayoutAnimation,
  UIManager,
  Image,
} from "react-native";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SMOOTH_SPRING_ANIMATION = {
  duration: 320,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.spring,
    springDamping: 0.84,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};
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
  <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { height:100%; width:100%; overflow:hidden; background: #e8ede8; }
    .maplibregl-popup-content { padding: 8px 12px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .maplibregl-popup-close-button { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var TB = '${truckB64 || ''}';
      var map, currentMarker = null, userMarker = null;
      var truckMarkers = {};
      var residentStopMarkers = [];
      var heatmapMarkers = {};
      var followMode = false;

      var CEBU_OUTLINE = [
        [10.3565,123.8808],[10.3592,123.8842],[10.3610,123.8882],[10.3620,123.8925],
        [10.3624,123.8972],[10.3618,123.9018],[10.3600,123.9065],[10.3568,123.9112],
        [10.3525,123.9158],[10.3475,123.9200],[10.3420,123.9235],[10.3362,123.9262],
        [10.3302,123.9278],[10.3242,123.9284],[10.3182,123.9278],[10.3124,123.9260],
        [10.3068,123.9234],[10.3015,123.9202],[10.2965,123.9165],[10.2918,123.9124],
        [10.2874,123.9080],[10.2834,123.9032],[10.2798,123.8982],[10.2766,123.8928],
        [10.2740,123.8868],[10.2720,123.8805],[10.2708,123.8740],[10.2703,123.8675],
        [10.2706,123.8612],[10.2718,123.8555],[10.2738,123.8508],[10.2770,123.8472],
        [10.2806,123.8452],[10.2844,123.8445],[10.2878,123.8452],[10.2908,123.8465],
        [10.2936,123.8480],[10.2965,123.8488],[10.2995,123.8493],[10.3025,123.8496],
        [10.3055,123.8500],[10.3085,123.8506],[10.3115,123.8515],[10.3145,123.8528],
        [10.3172,123.8545],[10.3196,123.8558],[10.3220,123.8568],[10.3246,123.8573],
        [10.3272,123.8576],[10.3300,123.8580],[10.3328,123.8588],[10.3358,123.8600],
        [10.3388,123.8616],[10.3415,123.8636],[10.3440,123.8660],[10.3464,123.8686],
        [10.3487,123.8714],[10.3508,123.8742],[10.3526,123.8770],[10.3544,123.8792],
        [10.3558,123.8802],[10.3565,123.8808]
      ];
      var CEBU_OUTLINE_LNGLAT = CEBU_OUTLINE.map(function(c) { return [c[1], c[0]]; });

      map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [123.893, 10.325],
        zoom: 16,
        pitch: 55,
        bearing: 0,
        attributionControl: false
      });

      map.on('load', function() {
        map.addSource('cebu-outline', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: CEBU_OUTLINE_LNGLAT }
          }
        });
        map.addLayer({
          id: 'cebu-outline-layer',
          type: 'line',
          source: 'cebu-outline',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#2563EB',
            'line-width': 2.5,
            'line-opacity': 0.65,
            'line-dasharray': [3, 2]
          }
        });

        setTimeout(function() {
          map.resize();
          window.ReactNativeWebView.postMessage('map_ready');
        }, 200);
      });

      window.setPerspective3D = function(enable3d) {
        if (!map) return;
        map.easeTo({
          pitch: enable3d ? 55 : 0,
          duration: 600
        });
      };

      window.setMapStyle = function(style) {};
      window.toggleCityOutline = function(show) {
        if (map && map.getLayer('cebu-outline-layer')) {
          map.setLayoutProperty('cebu-outline-layer', 'visibility', show ? 'visible' : 'none');
        }
      };

      // Stop markers
      window.clearResidentStops = function() {
        residentStopMarkers.forEach(function(m) { m.remove(); });
        residentStopMarkers = [];
      };

      function createResidentStopMarkerEl(status, name) {
        var isDone = status === 'completed';
        var bg = isDone ? '#10B981' : status === 'in-progress' ? '#F59E0B' : '#006A3B';
        var el = document.createElement('div');
        el.innerHTML = '<div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">' +
          '<div style="background:' + bg + ';width:26px;height:26px;border-radius:13px;border:2.5px solid white;box-shadow:0 3px 8px rgba(0,106,59,0.35);display:flex;align-items:center;justify-content:center;color:#fff;">' +
            (isDone
              ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
              : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>') +
          '</div>' +
          '<div style="position:absolute;top:-18px;background:rgba(255,255,255,0.95);color:#1B1C1C;font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;border:1px solid #CBD5E1;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.12);">' +
            name + (isDone ? ' ✓' : '') +
          '</div>' +
        '</div>';
        return el;
      }

      window.addResidentStops = function(stopsJson) {
        window.clearResidentStops();
        var arr = JSON.parse(stopsJson);
        arr.forEach(function(s) {
          var el = createResidentStopMarkerEl(s.status, s.name);
          var isDone = s.status === 'completed';
          var popup = new maplibregl.Popup({ offset: 15 }).setHTML(
            '<div style="font-family:sans-serif;padding:3px;text-align:center;">' +
            '<b style="font-size:12px;color:#0F172A;">' + (isDone ? '✨ ' : '📍 ') + s.name + '</b><br>' +
            '<span style="font-size:11px;font-weight:700;color:' + (isDone ? '#059669' : '#006A3B') + ';">' +
            (isDone ? 'Collection Completed ✓' : 'Drop-off Stop Point') +
            '</span>' +
            '</div>'
          );
          var m = new maplibregl.Marker({ element: el })
            .setLngLat([s.lng, s.lat])
            .setPopup(popup)
            .addTo(map);
          residentStopMarkers.push(m);
        });
      };

      // Route layers
      window.updateTruckRoute = function(coordsJson) {
        var coords = JSON.parse(coordsJson);
        if (!coords || coords.length === 0) return;
        var geojsonCoords = coords.map(function(c) { return [c[1], c[0]]; });

        if (map.getSource('truck-route')) {
          map.getSource('truck-route').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: geojsonCoords }
          });
        } else {
          map.addSource('truck-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: geojsonCoords }
            }
          });
          map.addLayer({
            id: 'truck-route-layer',
            type: 'line',
            source: 'truck-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#006A3B',
              'line-width': 5,
              'line-opacity': 0.85
            }
          }, map.getLayer('3d-car-arrow-model') ? '3d-car-arrow-model' : undefined);
        }

        var bounds = new maplibregl.LngLatBounds();
        geojsonCoords.forEach(function(c) { bounds.extend(c); });
        map.fitBounds(bounds, { padding: 40 });
      };

      // User Location & Radius Rings
      function createCirclePolygon(lat, lng, radiusM) {
        var coords = [];
        var km = radiusM / 1000;
        var distanceX = km / (111.320 * Math.cos(lat * Math.PI / 180));
        var distanceY = km / 110.574;
        var points = 48;
        for (var i = 0; i <= points; i++) {
          var theta = (i / points) * (2 * Math.PI);
          var x = distanceX * Math.cos(theta);
          var y = distanceY * Math.sin(theta);
          coords.push([lng + x, lat + y]);
        }
        return [coords];
      }

      function drawUserRadiusRings(lat, lng) {
        var outer = createCirclePolygon(lat, lng, 150);
        var mid = createCirclePolygon(lat, lng, 80);
        var inner = createCirclePolygon(lat, lng, 30);

        if (map.getSource('user-rings')) {
          map.getSource('user-rings').setData({
            type: 'FeatureCollection',
            features: [
              { type: 'Feature', properties: { level: 'outer' }, geometry: { type: 'Polygon', coordinates: outer } },
              { type: 'Feature', properties: { level: 'mid' }, geometry: { type: 'Polygon', coordinates: mid } },
              { type: 'Feature', properties: { level: 'inner' }, geometry: { type: 'Polygon', coordinates: inner } }
            ]
          });
        } else {
          map.addSource('user-rings', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [
                { type: 'Feature', properties: { level: 'outer' }, geometry: { type: 'Polygon', coordinates: outer } },
                { type: 'Feature', properties: { level: 'mid' }, geometry: { type: 'Polygon', coordinates: mid } },
                { type: 'Feature', properties: { level: 'inner' }, geometry: { type: 'Polygon', coordinates: inner } }
              ]
            }
          });
          map.addLayer({
            id: 'user-rings-fill',
            type: 'fill',
            source: 'user-rings',
            paint: {
              'fill-color': '#10B981',
              'fill-opacity': [
                'match',
                ['get', 'level'],
                'outer', 0.06,
                'mid', 0.12,
                'inner', 0.22,
                0.08
              ]
            }
          });
          map.addLayer({
            id: 'user-rings-line',
            type: 'line',
            source: 'user-rings',
            paint: {
              'line-color': '#059669',
              'line-width': 1.2,
              'line-opacity': 0.7,
              'line-dasharray': [3, 2]
            }
          });
        }
      }

      window.updateUserLocation = function(lat, lng, autoPan) {
        if (userMarker) { userMarker.remove(); }
        var el = document.createElement('div');
        el.innerHTML =
          '<div style="position:relative; display:flex; justify-content:center; align-items:center; width:36px; height:44px;">' +
            '<svg viewBox="0 0 36 44" width="36" height="44" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">' +
              '<path d="M18 0C8.06 0 0 8.06 0 18c0 12.5 18 26 18 26s18-13.5 18-26C36 8.06 27.94 0 18 0z" fill="#006A3B" />' +
              '<circle cx="18" cy="16.5" r="10.5" fill="#FFFFFF" />' +
              '<circle cx="18" cy="13" r="3.8" fill="#006A3B" />' +
              '<path d="M11.8 23c0-3.1 2.8-5.2 6.2-5.2s6.2 2.1 6.2 5.2v0.8h-12.4V23z" fill="#006A3B" />' +
            '</svg>' +
          '</div>';

        userMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(map);

        drawUserRadiusRings(lat, lng);
        if (autoPan) {
          map.flyTo({ center: [lng, lat], zoom: 17, duration: 1000 });
        }
      };

      // Live Truck Position & Follow
      var clearingMarker = null;
      window.setClearingMarker = function(sitioName, lat, lng, isClearing) {
        if (clearingMarker) { clearingMarker.remove(); clearingMarker = null; }
        if (!isClearing || !lat || !lng) return;
        var el = document.createElement('div');
        el.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:16px;background:#059669;border:2px solid #ffffff;box-shadow:0 3px 8px rgba(0,0,0,0.25);font-size:16px;z-index:9999;">🧹</div>';
        clearingMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
      };

      function createFallbackTruckEl(bearing, truckId, isClearing) {
        var el = document.createElement('div');
        var imgHtml = TB
          ? '<img src="data:image/png;base64,' + TB + '" style="width:48px;height:48px;object-fit:contain;display:block;" />'
          : '<svg width="42" height="42" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="rgba(0,106,59,0.15)" /><path d="M20 5L32 32L20 26L8 32L20 5Z" fill="#006A3B" stroke="white" stroke-width="2.5" stroke-linejoin="round" /></svg>';
        el.innerHTML =
          '<div style="position:relative;display:flex;flex-direction:column;align-items:center;z-index:9000;cursor:pointer;">' +
            (isClearing ? '<div style="position:absolute;top:-4px;width:52px;height:52px;border-radius:26px;background:rgba(16,185,129,0.35);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>' : '') +
            '<div style="transform: rotate(' + (bearing || 0) + 'deg); filter: drop-shadow(0 4px 10px rgba(0,106,59,0.35)); transition: transform 0.3s ease;">' +
              imgHtml +
            '</div>' +
            '<div style="background:#006A3B;color:#ffffff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;margin-top:2px;box-shadow:0 2px 4px rgba(0,0,0,0.3);white-space:nowrap;">' +
              (truckId || 'GT') +
            '</div>' +
          '</div>';
        return el;
      }

      window.updateTruckPosition = function(lat, lng, truckId, autoPan, heading, isClearing) {
        if (!lat || !lng) return;
        var id = truckId || 'GT';
        if (!truckMarkers[id]) {
          var el = createFallbackTruckEl(heading || 0, id, isClearing);
          truckMarkers[id] = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .addTo(map);
        } else {
          truckMarkers[id].setLngLat([lng, lat]);
          var el = createFallbackTruckEl(heading || 0, id, isClearing);
          truckMarkers[id].getElement().innerHTML = el.innerHTML;
        }

        if (autoPan) {
          map.panTo([lng, lat], { duration: 500 });
        }
      };

      window.removeTruckMarker = function(truckId) {
        var id = truckId || 'GT';
        if (truckMarkers[id]) { truckMarkers[id].remove(); delete truckMarkers[id]; }
      };

      window.gotoLocation = function(lat, lng, zoom) {
        map.flyTo({ center: [lng, lat], zoom: zoom || 17, duration: 1000 });
      };

      // IoT Air Quality Sensors
      window.updateHeatmapArea = function(area) {
        var id = area._id || area.id;
        var color = area.status === 'critical' ? '#EF4444' : area.status === 'moderate' ? '#F59E0B' : '#10B981';
        if (heatmapMarkers[id]) { heatmapMarkers[id].remove(); }

        var el = document.createElement('div');
        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;background:#0F172A;width:26px;height:26px;border-radius:50%;border:2.5px solid ' + color + ';box-shadow:0 3px 8px rgba(0,0,0,0.35);cursor:pointer;">' +
          '<span style="font-size:12px;line-height:26px;">📡</span>' +
        '</div>';

        var popup = new maplibregl.Popup({ offset: 15 }).setHTML(
          '<div style="font-family:sans-serif;min-width:145px;padding:4px 0;">' +
          '<b style="font-size:12px;color:#111827;">' + (area.name || 'Sensor') + '</b><br/>' +
          '<div style="margin-top:6px;display:inline-block;padding:3px 8px;border-radius:12px;background:' + (area.status === 'critical' ? '#FEF2F2' : area.status === 'moderate' ? '#FFFBEB' : '#ECFDF5') + ';border:1px solid ' + color + ';">' +
          '<span style="font-size:11px;color:' + color + ';font-weight:700;">' + (area.status === 'critical' ? 'High Gas Warning' : area.status === 'moderate' ? 'Moderate Risk' : 'Safe Air Quality') + '</span>' +
          '</div></div>'
        );

        el.addEventListener('click', function() {
          try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hazard_click', area: area })); } catch(e) {}
        });

        var m = new maplibregl.Marker({ element: el })
          .setLngLat([area.lng, area.lat])
          .setPopup(popup)
          .addTo(map);

        heatmapMarkers[id] = m;
      };

      window.clearHeatmapAreas = function() {
        Object.keys(heatmapMarkers).forEach(function(id) {
          if (heatmapMarkers[id]) heatmapMarkers[id].remove();
        });
        heatmapMarkers = {};
      };

    })();
  </script>
</body>
</html>`;
}

async function fetchRoadRoutePolyline(waypoints) {
  if (!waypoints || waypoints.length < 2) return waypoints || [];
  try {
    const locStr = waypoints.map((p) => `${p[1]},${p[0]}`).join(";");
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${locStr}?overview=full&geometries=geojson`
    );
    if (res.ok) {
      const data = await res.json();
      if (
        data.routes?.[0]?.geometry?.coordinates &&
        data.routes[0].geometry.coordinates.length > 0
      ) {
        return data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
      }
    }
  } catch (e) {
    console.warn("OSRM routing failed in Resident Map:", e.message);
  }
  return waypoints;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MapScreen() {
  const navigation = useNavigation();
  const routeParams = useRoute();
  const { focusTruck } = routeParams.params || {};
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const { user } = useAuth();
  const userBarangay = user?.barangay || '';

  const [isExpanded, setIsExpanded] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(null);
  const [liveTruckOnline, setLiveTruckOnline] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState("topographic");
  const [isFollowing, setIsFollowing] = useState(!!focusTruck);
  const [is3D, setIs3D] = useState(true);
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

  const expandSheet = useCallback(() => {
    LayoutAnimation.configureNext(SMOOTH_SPRING_ANIMATION);
    setIsExpanded(true);
  }, []);

  const collapseSheet = useCallback(() => {
    LayoutAnimation.configureNext(SMOOTH_SPRING_ANIMATION);
    setIsExpanded(false);
  }, []);

  const toggleSheet = useCallback(() => {
    LayoutAnimation.configureNext(SMOOTH_SPRING_ANIMATION);
    setIsExpanded((prev) => !prev);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 15 || gestureState.vy > 0.25) {
            // Swiped down -> collapse
            collapseSheet();
          } else if (gestureState.dy < -15 || gestureState.vy < -0.25) {
            // Swiped up -> expand
            expandSheet();
          }
        },
      }),
    [collapseSheet, expandSheet]
  );

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

  // Load bin prepared status for today & refresh whenever screen comes into focus
  useEffect(() => {
    const checkBinPrepared = () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      AsyncStorage.getItem(`@bin_prepared_${today}`)
        .then((val) => {
          if (val === "true") setBinReady(true);
        })
        .catch(() => {});
    };

    checkBinPrepared();
    const unsubscribe = navigation?.addListener ? navigation.addListener("focus", checkBinPrepared) : undefined;
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [navigation]);

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
    const wasteType = activeSchedule?.wasteType || "Malata";
    Alert.alert("Bin Prepared & Sorted! ✓", `Your ${wasteType} bin is marked as prepared for active collection. +2 Points earned!`);
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
    if (!liveTruckOnline) return false;
    return true;
  }, [liveTruckOnline]);

  const isRouteCompleted = useMemo(() => {
    if (liveTruckOnline) return false;
    if (!hasScheduleToday) return false;
    if (activeSchedule?.status === 'completed') return true;
    if (todaySchedules.length > 0 && todaySchedules.every(s => s.status === 'completed')) return true;
    if (cleanedNotif) return true;
    return false;
  }, [liveTruckOnline, hasScheduleToday, activeSchedule, todaySchedules, cleanedNotif]);

  const missedBannerData = useMemo(() => {
    if (binReady) {
      if (isRouteCompleted || cleanedNotif) {
        return {
          type: 'prepared_completed',
          title: "Collection Completed ✓",
          message: "Garbage collection in your area has completed. Thank you for having your bin prepared!",
          icon: "check-circle",
          color: "#059669",
          bgColor: "#ECFDF5",
          borderColor: "#A7F3D0",
          titleColor: "#065F46",
          messageColor: "#047857",
        };
      }
      return {
        type: 'prepared',
        title: "Bin Prepared & Ready ✓",
        message: isTruckActiveForBarangay
          ? `Your bin is marked as prepared! The collection driver in ${activeBarangay || 'your area'} has been notified to stop at your location.`
          : "Your garbage bin is marked as prepared for active collection. The driver will be notified upon arrival.",
        icon: "check-circle",
        color: "#059669",
        bgColor: "#ECFDF5",
        borderColor: "#A7F3D0",
        titleColor: "#065F46",
        messageColor: "#047857",
      };
    }

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
        titleColor: "#92400E",
        messageColor: "#B45309",
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
          titleColor: "#92400E",
          messageColor: "#B45309",
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
        titleColor: "#92400E",
        messageColor: "#B45309",
      };
    }

    return null;
  }, [binReady, hasScheduleToday, isRouteCompleted, cleanedNotif, isTruckActiveForBarangay, activeSchedule, userBarangay, activeBarangay, user]);

  const hasMissedTruck = !!missedBannerData && (missedBannerData.type === 'missed_full' || missedBannerData.type === 'missed_sitio');

  const distToUser = useMemo(() => {
    if (!truckPosState?.lat || !userLocation?.lat) return null;
    return Math.round(getDistanceM(userLocation.lat, userLocation.lng, truckPosState.lat, truckPosState.lng));
  }, [truckPosState, userLocation]);

  useEffect(() => { iotAreasRef.current = iotAreas; }, [iotAreas]);

  const lastTruckFetchRef = useRef(0);

  const fetchTruckStatus = useCallback(async () => {
    const now = Date.now();
    // Debounce to prevent duplicate burst requests within 2 seconds
    if (now - lastTruckFetchRef.current < 2000) return;
    lastTruckFetchRef.current = now;

    try {
      let trucksRes = [];
      // 1. Try /api/trucks/locations (direct live Truck documents with GPS coordinates)
      try {
        const resLoc = await fetch(`${TRACKING_SERVER}/api/trucks/locations`);
        if (resLoc.ok) {
          const data = await resLoc.json();
          if (Array.isArray(data) && data.length > 0) trucksRes = data;
        }
      } catch (_) {}

      // 2. Fallback to /api/trucks/active (Fleet joined with live Truck coordinates)
      if (!trucksRes || trucksRes.length === 0) {
        try {
          const resAct = await fetch(`${TRACKING_SERVER}/api/trucks/active`);
          if (resAct.ok) {
            const data = await resAct.json();
            if (Array.isArray(data) && data.length > 0) trucksRes = data;
          }
        } catch (_) {}
      }

      // 3. Fallback to /api/trucks
      if (!trucksRes || trucksRes.length === 0) {
        try {
          const resGen = await fetch(`${TRACKING_SERVER}/api/trucks`);
          if (resGen.ok) {
            const data = await resGen.json();
            if (Array.isArray(data)) trucksRes = data;
          }
        } catch (_) {}
      }

      if (!Array.isArray(trucksRes)) return;

      const isOnlineTruck = (t) => {
        if (!t || t.lat == null || t.lng == null || isNaN(t.lat) || isNaN(t.lng)) return false;
        if (Number(t.lat) === 0 && Number(t.lng) === 0) return false;
        const st = (t.status || t.liveStatus || "").trim().toLowerCase();
        if (st === "online" || st === "active" || st === "collecting" || st === "en-route" || st === "in-transit") return true;
        const ts = t.updatedAt || t.lastSeen;
        if (ts) {
          const diffMs = Date.now() - new Date(ts).getTime();
          if (!isNaN(diffMs) && diffMs < 15 * 60 * 1000) return true;
        }
        return false;
      };

      const online = trucksRes.filter(isOnlineTruck);
      initialTrucks.current = online;

      if (online.length > 0) {
        let active = online[0];
        if (userLocationRef.current && userLocationRef.current.lat) {
          let minDist = Infinity;
          for (const t of online) {
            const d = getDistanceM(userLocationRef.current.lat, userLocationRef.current.lng, t.lat, t.lng);
            if (d < minDist) {
              minDist = d;
              active = t;
            }
          }
        }
        liveTruckPos.current = {
          lat: active.lat,
          lng: active.lng,
          truckId: active.truckId,
          heading: active.heading || 0,
        };
        setTruckPosState({ lat: active.lat, lng: active.lng, truckId: active.truckId });
        setLiveTruckOnline(true);

        if (webViewReadyRef.current) {
          online.forEach((t) => {
            const safeId = (t.truckId || "GT").replace(/'/g, "\\'");
            webViewRef.current?.injectJavaScript(
              `window.updateTruckPosition(${t.lat}, ${t.lng}, '${safeId}', false, ${t.heading || 0}, false); true;`,
            );
          });
        }
      } else {
        // Do NOT wipe out live truck if we already have an active GPS position from real-time socket
        if (!liveTruckPos.current) {
          setTruckPosState(null);
          setLiveTruckOnline(false);
        }
      }
    } catch (e) {
      console.warn('MapScreen fetchTruckStatus error:', e);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Fetch truck status on mount
  useEffect(() => {
    fetchTruckStatus();
  }, [fetchTruckStatus]);

  // Fetch truck status whenever screen is focused (after resident login or tab switch)
  useEffect(() => {
    const unsubscribe = navigation?.addListener ? navigation.addListener("focus", () => {
      fetchTruckStatus();
    }) : undefined;
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [navigation, fetchTruckStatus]);

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

    // Collect all unique stops from today's schedules (including report stops) + sitioList
    const allStopsMap = new Map();

    for (const sched of todaySchedules || []) {
      if (Array.isArray(sched.sitioTasks)) {
        for (const t of sched.sitioTasks) {
          if (t.lat && t.lng) {
            allStopsMap.set(t.name.toLowerCase(), {
              name: t.name,
              lat: t.lat,
              lng: t.lng,
              status: t.completed ? "completed" : "in-progress",
              isPriority: !!t.isPriority,
              isReport: !!t.isReport,
            });
          }
        }
      }
    }

    for (const s of sitioList || []) {
      const key = (s.name || "").toLowerCase();
      if (!allStopsMap.has(key)) {
        allStopsMap.set(key, {
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          status: "upcoming",
        });
      }
    }

    const markersPayload = Array.from(allStopsMap.values());
    if (markersPayload.length === 0) {
      webViewRef.current?.injectJavaScript(`window.clearResidentStops(); window.updateTruckRoute('[]'); true;`);
      return;
    }

    const markersJson = JSON.stringify(markersPayload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webViewRef.current?.injectJavaScript(`window.addResidentStops('${markersJson}'); true;`);

    // Draw real road route polyline connecting sequential sitios along the street network
    let isMounted = true;
    (async () => {
      let rawWaypoints = [];
      for (const sched of todaySchedules || []) {
        if (sched.routeCoords && sched.routeCoords.length > 15) {
          // Already has rich road geometry from backend
          if (isMounted) {
            const routeCoordsJson = JSON.stringify(sched.routeCoords).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            webViewRef.current?.injectJavaScript(`window.updateTruckRoute('${routeCoordsJson}'); true;`);
          }
          return;
        } else if (sched.sitioTasks && sched.sitioTasks.length > 1) {
          rawWaypoints = sched.sitioTasks.map((t) => [t.lat, t.lng]);
        } else if (sched.routeCoords && sched.routeCoords.length > 1) {
          rawWaypoints = sched.routeCoords;
        }
      }

      if (rawWaypoints.length === 0 && sitioList.length > 1) {
        rawWaypoints = sitioList.map((s) => [s.lat, s.lng]);
      }

      if (rawWaypoints.length > 1) {
        const roadCoords = await fetchRoadRoutePolyline(rawWaypoints);
        if (isMounted && roadCoords && roadCoords.length > 0) {
          const routeCoordsJson = JSON.stringify(roadCoords).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          webViewRef.current?.injectJavaScript(`window.updateTruckRoute('${routeCoordsJson}'); true;`);
        }
      } else {
        if (isMounted) {
          webViewRef.current?.injectJavaScript(`window.updateTruckRoute('[]'); true;`);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
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
        const isClearing = !!clearingNotif;
        webViewRef.current?.injectJavaScript(
          `window.updateTruckPosition(${lat}, ${lng}, '${safeId}', ${isFollowingRef.current}, ${heading || 0}, ${isClearing}); true;`,
        );
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

        const cLat = data.lat != null ? data.lat : liveTruckPos.current?.lat;
        const cLng = data.lng != null ? data.lng : liveTruckPos.current?.lng;
        if (cLat && cLng) {
          liveTruckPos.current = {
            lat: cLat,
            lng: cLng,
            truckId: data.truckId || liveTruckPos.current?.truckId || "GT",
            heading: liveTruckPos.current?.heading || 0,
          };
          setTruckPosState({ lat: cLat, lng: cLng, truckId: data.truckId || "GT" });
          setLiveTruckOnline(true);
          if (webViewReadyRef.current) {
            const safeId = (data.truckId || "GT").replace(/'/g, "\\'");
            const safeSitio = (data.sitioName || "").replace(/'/g, "\\'");
            webViewRef.current?.injectJavaScript(
              `window.updateTruckPosition(${cLat}, ${cLng}, '${safeId}', ${isFollowingRef.current}, 0, true); ` +
              `window.setClearingMarker('${safeSitio}', ${cLat}, ${cLng}, true); true;`,
            );
          }
        }
      } else {
        setClearingNotif((prev) => (prev?.sitioName === data.sitioName ? null : prev));
        if (webViewReadyRef.current) {
          webViewRef.current?.injectJavaScript(`window.setClearingMarker('', 0, 0, false); true;`);
          if (liveTruckPos.current) {
            const { lat, lng, truckId, heading } = liveTruckPos.current;
            const safeId = (truckId || "GT").replace(/'/g, "\\'");
            webViewRef.current?.injectJavaScript(
              `window.updateTruckPosition(${lat}, ${lng}, '${safeId}', false, ${heading || 0}, false); true;`,
            );
          }
        }
      }
    });

    socket.on("schedule:task:completed", (data) => {
      setClearingNotif((prev) => (prev?.sitioName === data.sitioName ? null : prev));
      if (webViewReadyRef.current) {
        webViewRef.current?.injectJavaScript(`window.setClearingMarker('', 0, 0, false); true;`);
        if (liveTruckPos.current) {
          const { lat, lng, truckId, heading } = liveTruckPos.current;
          const safeId = (truckId || "GT").replace(/'/g, "\\'");
          webViewRef.current?.injectJavaScript(
            `window.updateTruckPosition(${lat}, ${lng}, '${safeId}', false, ${heading || 0}, false); true;`,
          );
        }
      }
    });

    socket.on("schedule:changed", () => {
      fetchSitiosAndSchedules();
    });

    socket.on("route:completed", (data) => {
      setClearingNotif(null);
      if (webViewReadyRef.current) {
        webViewRef.current?.injectJavaScript(`window.setClearingMarker('', 0, 0, false); true;`);
      }
      setCleanedNotif({
        name: `${data.barangay || 'Area'} Collection Route Completed 🎉`,
        barangay: data.barangay,
        collectedBy: `Truck ${data.truckId} (${data.driverName || 'Collector'})`,
        weight: '100% Cleared',
      });
      setTimeout(() => setCleanedNotif(null), 8000);
      fetchSitiosAndSchedules();
    });

    socket.on("bin:status:update", () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      AsyncStorage.getItem(`@bin_prepared_${today}`)
        .then((val) => {
          if (val === "true") setBinReady(true);
        })
        .catch(() => {});
    });

    return () => socket.disconnect();
  }, [fetchSitiosAndSchedules, clearingNotif]);

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
        `window.updateTruckPosition(${t.lat}, ${t.lng}, '${safeId}', false, 0, false); true;`,
      );
    });
    // Focus if following or active
    if (liveTruckPos.current) {
      const { lat, lng, truckId, heading } = liveTruckPos.current;
      const safeId = (truckId || "GT").replace(/'/g, "\\'");
      const isClearing = !!clearingNotif;
      webViewRef.current?.injectJavaScript(
        `window.updateTruckPosition(${lat}, ${lng}, '${safeId}', ${isFollowingRef.current}, ${heading || 0}, ${isClearing}); true;`,
      );
      if (clearingNotif && clearingNotif.lat && clearingNotif.lng) {
        const safeSitio = (clearingNotif.sitioName || "").replace(/'/g, "\\'");
        webViewRef.current?.injectJavaScript(
          `window.setClearingMarker('${safeSitio}', ${clearingNotif.lat}, ${clearingNotif.lng}, true); true;`,
        );
      }
    }
    // Inject barangay IoT heatmap areas
    iotAreasRef.current.forEach((area) => {
      webViewRef.current?.injectJavaScript(
        `window.updateHeatmapArea(${JSON.stringify(area)}); true;`,
      );
    });
    // Fetch and sync latest truck status once map engine is ready
    fetchTruckStatus();
  }, [clearingNotif, fetchTruckStatus]);

  const handleWebViewMessage = useCallback((event) => {
    const msg = event.nativeEvent.data;
    if (msg === "map_ready") {
      webViewReadyRef.current = true;
      setWebViewReady(true);
      fetchTruckStatus();
      if (liveTruckPos.current) {
        const { lat, lng, truckId, heading } = liveTruckPos.current;
        const safeId = (truckId || "GT").replace(/'/g, "\\'");
        webViewRef.current?.injectJavaScript(
          `window.updateTruckPosition(${lat}, ${lng}, '${safeId}', false, ${heading || 0}, false); true;`,
        );
      }
    } else if (msg.startsWith("route:")) {
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
  }, [fetchTruckStatus]);

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
              is3D && styles.floatingButtonActive,
            ]}
            activeOpacity={0.7}
            onPress={() => {
              const next3D = !is3D;
              setIs3D(next3D);
              webViewRef.current?.injectJavaScript(
                `window.setPerspective3D(${next3D}); true;`
              );
            }}
          >
            <MaterialIcons
              name="3d-rotation"
              size={20}
              color={is3D ? "#006A3B" : "#1B1C1C"}
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
        </View>


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
        <View style={[styles.bottomSheet, { paddingBottom: Math.max(bottomInset, 12) }]}>
          {/* Swipable & clickable header handle to collapse/expand */}
          <View {...panResponder.panHandlers} style={{ width: "100%" }}>
            <TouchableOpacity
              style={styles.handleBarContainer}
              activeOpacity={0.7}
              onPress={toggleSheet}
            >
              <View style={styles.handleBar} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={toggleSheet}
              style={{ paddingHorizontal: 20, paddingBottom: isExpanded ? 10 : 6 }}
            >
              {/* Header: Status & Stops Left */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isRouteCompleted ? '#10B981' : liveTruckOnline ? '#059669' : '#6B7280' }} />
                    <Text style={{ fontSize: 15, fontWeight: '800', color: isRouteCompleted ? '#059669' : liveTruckOnline ? '#006A3B' : '#374151' }}>
                      {isRouteCompleted
                        ? 'Route Collection Completed ✓'
                        : liveTruckOnline
                          ? (distToUser != null && distToUser < 150
                              ? 'Truck Passing Near You!'
                              : distToUser != null && distToUser < 800
                                ? 'Truck Approaching Area'
                                : 'Truck Active on Route')
                          : hasScheduleToday
                            ? 'Scheduled · Collection Standby'
                            : 'No Collection Scheduled Today'}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: '#6B7280', marginTop: 2, fontWeight: '500' }}>
                    Route: {activeSchedule?.routeName || activeSchedule?.barangay || userBarangay || 'Collection Area'}
                  </Text>
                </View>
                {/* Remaining stops pill & arrow indicator */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                  <MaterialIcons
                    name={isExpanded ? "keyboard-arrow-down" : "keyboard-arrow-up"}
                    size={22}
                    color="#9CA3AF"
                  />
                </View>
              </View>

              {/* Truck Progress Track with Finish Line */}
              {hasScheduleToday && (
                (() => {
                  const totalStops = activeSchedule?.sitioTasks?.length || sitioList.length || 1;
                  const completedStops = activeSchedule?.sitioTasks
                    ? activeSchedule.sitioTasks.filter(t => t.completed).length
                    : isRouteCompleted ? totalStops : 0;
                  const progressPct = isRouteCompleted
                    ? 100
                    : totalStops > 0
                      ? Math.min(100, Math.round((completedStops / totalStops) * 100))
                      : isTruckActiveForBarangay ? 25 : 0;
                  const truckLeftPct = Math.min(84, Math.max(0, progressPct > 90 ? 82 : progressPct - 5));

                  return (
                    <View style={{ marginTop: 10, marginBottom: 2 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isRouteCompleted ? '#059669' : '#006A3B' }}>
                          {isRouteCompleted ? '🏁 Route Complete' : `Collection Progress · ${progressPct}%`}
                        </Text>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748B' }}>
                          {completedStops}/{totalStops} stops collected
                        </Text>
                      </View>

                      {/* Progress Line Track */}
                      <View style={{ height: 26, justifyContent: 'center', position: 'relative' }}>
                        {/* Gray background track */}
                        <View style={{ height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, width: '100%', overflow: 'hidden' }}>
                          {/* Green filled progress track */}
                          <View
                            style={{
                              width: `${Math.max(4, Math.min(100, progressPct))}%`,
                              height: '100%',
                              backgroundColor: isRouteCompleted ? '#10B981' : '#006A3B',
                              borderRadius: 3,
                            }}
                          />
                        </View>

                        {/* Moving Truck Icon along track */}
                        <View
                          style={{
                            position: 'absolute',
                            left: `${truckLeftPct}%`,
                            top: -1,
                            zIndex: 2,
                          }}
                        >
                          <Image
                            source={require('../../assets/truck-progress.png')}
                            style={{ width: 28, height: 28, resizeMode: 'contain' }}
                          />
                        </View>

                        {/* Finish Line Checkered Marker */}
                        <View
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 1,
                            zIndex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: isRouteCompleted ? '#ECFDF5' : '#FFFFFF',
                            borderColor: isRouteCompleted ? '#10B981' : '#CBD5E1',
                            borderWidth: 1.5,
                            borderRadius: 6,
                            paddingHorizontal: 3,
                            paddingVertical: 1,
                          }}
                        >
                          <Text style={{ fontSize: 12, lineHeight: 14 }}>🏁</Text>
                        </View>
                      </View>
                    </View>
                  );
                })()
              )}
            </TouchableOpacity>
          </View>

          {/* Expanded Content: Driver Card & Warnings */}
          {isExpanded && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
              {/* Driver & Truck Info Section */}
              <View style={styles.driverCard}>
                {/* Truck Avatar Icon */}
                <View style={styles.driverAvatarBg}>
                  <Image
                    source={require('../../assets/truck-progress.png')}
                    style={{ width: 32, height: 32, resizeMode: 'contain' }}
                  />
                </View>

                {/* Driver & Truck Details */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.truckName}>
                    {liveTruckPos.current?.truckId || activeSchedule?.truckId || "Truck"}
                  </Text>
                  <Text style={styles.driverName}>
                    {activeSchedule?.driverName || "Waste Collector"}
                  </Text>
                  <Text style={styles.driverSub}>
                    {isRouteCompleted
                      ? 'Route collection completed for today'
                      : liveTruckOnline
                        ? `Collecting waste in ${activeBarangay || userBarangay || 'area'}`
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
                    <Text style={{ fontSize: 13, fontWeight: '800', color: missedBannerData.titleColor || '#92400E' }}>
                      {missedBannerData.title}
                    </Text>
                    <Text style={{ fontSize: 11, color: missedBannerData.messageColor || '#B45309', marginTop: 2, lineHeight: 15, fontWeight: '500' }}>
                      {missedBannerData.message}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
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
