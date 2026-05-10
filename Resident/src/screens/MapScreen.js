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
import HeatmapLegend from "../components/HeatmapLegend";
import API_URL from "../config";
import TRUCK_B64 from "../constants/truckBase64";

const TRACKING_SERVER = API_URL;

// Color palette for the different route polylines
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

function formatStopTime(index) {
  const totalMinutes = 8 * 60 + index * 45;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ═══════════════════════════════════════════════════════════
// LEAFLET HTML — routes and truck icons injected via JS
// truckB64: base64 PNG string for the truck marker image
// ═══════════════════════════════════════════════════════════
function buildLeafletHTML(truckB64) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; width: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
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

      var map, userMarker, userPulseCircle;
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

      var tileLayer;
      function setTileLayer(satellite) {
        if (tileLayer) map.removeLayer(tileLayer);
        if (satellite) {
          tileLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 17, minZoom: 13, attribution: '' }
          );
        } else {
          tileLayer = L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            { opacity: 0.9, maxZoom: 17, minZoom: 13 }
          );
        }
        tileLayer.addTo(map);
      }
      setTileLayer(false);
      window.setMapStyle = setTileLayer;

      // ── Hollow proximity circles ──
      function drawUserRadius(lat, lng) {
        radiusCircles.forEach(function(c) { map.removeLayer(c); });
        radiusCircles = [];
        [
          { radius: 350, color: '#E53935' },
          { radius: 700, color: '#FDD835' },
          { radius: 1050, color: '#4CAF50' },
        ].forEach(function(l) {
          radiusCircles.push(L.circle([lat, lng], {
            radius: l.radius, color: l.color,
            fillOpacity: 0, weight: 2.5, dashArray: '6 4', opacity: 0.8, interactive: false,
          }).addTo(map));
        });
      }
      drawUserRadius(10.3157, 123.8854);

      // ── Truck icon using truck.png ──
      function makeTruckIcon(truckId) {
        return L.divIcon({
          html: '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
                  '<div style="background:#fff;border-radius:10px;padding:3px;box-shadow:0 3px 10px rgba(0,106,59,0.35);border:2px solid #006A3B;">' +
                    '<img src="data:image/png;base64,' + TB + '" style="width:34px;height:34px;object-fit:contain;display:block;" />' +
                  '</div>' +
                  '<div style="background:#006A3B;color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;white-space:nowrap;margin-top:1px;">' + (truckId || 'GT') + '</div>' +
                '</div>',
          iconSize: [48, 62],
          iconAnchor: [24, 62],
          className: '',
        });
      }

      function makeIdleIcon(truckId) {
        return L.divIcon({
          html: '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;opacity:0.65;">' +
                  '<div style="background:#fff;border-radius:10px;padding:3px;box-shadow:0 2px 8px rgba(0,0,0,0.18);border:2px solid #9CA3AF;filter:grayscale(100%);">' +
                    '<img src="data:image/png;base64,' + TB + '" style="width:34px;height:34px;object-fit:contain;display:block;" />' +
                  '</div>' +
                  '<div style="background:#6B7280;color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;white-space:nowrap;margin-top:1px;">' + (truckId || 'GT') + ' · Idle</div>' +
                '</div>',
          iconSize: [70, 62],
          iconAnchor: [35, 62],
          className: '',
        });
      }

      window.updateTruckPosition = function(lat, lng, truckId) {
        var id = truckId || 'GT';
        var icon = makeTruckIcon(id);
        if (!truckMarkers[id]) {
          truckMarkers[id] = L.marker([lat, lng], { icon: icon }).addTo(map);
        } else {
          truckMarkers[id].setLatLng([lat, lng]);
          truckMarkers[id].setIcon(icon);
        }
        map.panTo([lat, lng]);
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

      // ── Multi-route support ──
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

      // ── User location marker ──
      window.updateUserLocation = function(lat, lng) {
        if (userMarker) { map.removeLayer(userMarker); }
        if (userPulseCircle) { map.removeLayer(userPulseCircle); }
        userMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: '<div style="position:relative;"><div class="user-marker"></div><div class="user-pulse"></div></div>',
            iconSize: [18, 18], iconAnchor: [9, 9], className: '',
          })
        }).addTo(map);
        userPulseCircle = L.circle([lat, lng], {
          radius: 120, color: '#1A73E8', fillColor: '#1A73E8',
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

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function MapScreen() {
  const { bottom: bottomInset } = useSafeAreaInsets();

  const sheetTotalHeight = EXPANDED_HEIGHT + bottomInset;
  const translateCollapsed = sheetTotalHeight - COLLAPSED_HEIGHT;

  // ── State ──
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [routePayload, setRoutePayload] = useState([]); // [{id, name, coords, color}]
  const [liveTruckOnline, setLiveTruckOnline] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [isSatellite, setIsSatellite] = useState(false);

  // ── Refs ──
  const isExpandedRef = useRef(false);
  const sheetAnim = useRef(new Animated.Value(translateCollapsed)).current;
  const webViewRef = useRef(null);
  const socketRef = useRef(null);
  const liveTruckPos = useRef(null);
  const webViewReady = useRef(false);
  const routePayloadRef = useRef([]);
  const selectedRouteIdRef = useRef(null);

  const setIsExpandedAndSync = useCallback((val) => {
    isExpandedRef.current = val;
    setIsExpanded(val);
  }, []);

  useEffect(() => {
    routePayloadRef.current = routePayload;
  }, [routePayload]);
  useEffect(() => {
    selectedRouteIdRef.current = selectedRouteId;
  }, [selectedRouteId]);

  // ── Computed: active route / schedule / stops ──
  const activeRoute = useMemo(
    () => routes.find((r) => r._id === selectedRouteId) || null,
    [routes, selectedRouteId],
  );
  const activeSchedule = useMemo(
    () =>
      schedules.find(
        (s) =>
          activeRoute &&
          (s.routeId === activeRoute._id || s.truckId === activeRoute.truckId),
      ) ||
      schedules[0] ||
      null,
    [schedules, activeRoute],
  );
  const currentStops = useMemo(() => {
    if (!activeRoute?.waypoints?.length) return [];
    return activeRoute.waypoints.map((wp, i) => ({
      name: wp.name,
      status: "Pending",
      time: formatStopTime(i),
      active: false,
    }));
  }, [activeRoute]);

  // ── Fetch routes + today's schedules on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [routesRes, schedRes] = await Promise.allSettled([
          fetch(`${TRACKING_SERVER}/api/routes`).then((r) => r.json()),
          fetch(`${TRACKING_SERVER}/api/schedules/today`).then((r) => r.json()),
        ]);
        if (
          routesRes.status === "fulfilled" &&
          Array.isArray(routesRes.value)
        ) {
          setRoutes(routesRes.value);
        }
        if (
          schedRes.status === "fulfilled" &&
          Array.isArray(schedRes.value?.schedules)
        ) {
          setSchedules(schedRes.value.schedules);
        }
      } catch (e) {
        console.warn("MapScreen: fetch error:", e.message);
      } finally {
        setDataLoading(false);
      }
    })();
  }, []);

  // ── Build route payload when routes load ──
  useEffect(() => {
    if (routes.length === 0) return;
    const payload = routes
      .map((r, i) => ({
        id: r._id,
        name: r.name || r.barangay || `Route ${i + 1}`,
        coords:
          r.routeCoords?.length > 1
            ? r.routeCoords
            : r.waypoints?.length >= 2
              ? r.waypoints.map((wp) => [wp.lat, wp.lng])
              : null,
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      }))
      .filter((p) => p.coords && p.coords.length > 0);

    setRoutePayload(payload);
    if (!selectedRouteId && payload.length > 0) {
      setSelectedRouteId(routes[0]._id);
    }
  }, [routes]);

  // ── Inject all routes into the map when payload is ready ──
  useEffect(() => {
    if (!webViewReady.current || routePayload.length === 0) return;
    webViewRef.current?.injectJavaScript(
      `window.loadAllRoutes(${JSON.stringify(routePayload)}); true;`,
    );
  }, [routePayload]);

  // ── Highlight selected route ──
  useEffect(() => {
    if (!webViewReady.current || !selectedRouteId) return;
    webViewRef.current?.injectJavaScript(
      `window.highlightRoute('${selectedRouteId}'); true;`,
    );
  }, [selectedRouteId]);

  // ═════════════════════════════════════════════════════════
  // REAL-TIME TRUCK TRACKING
  // ═════════════════════════════════════════════════════════
  useEffect(() => {
    const socket = io(TRACKING_SERVER, {
      transports: ["polling", "websocket"],
    });
    socketRef.current = socket;

    socket.on("truck:location:update", ({ truckId, lat, lng }) => {
      liveTruckPos.current = { lat, lng, truckId };
      setLiveTruckOnline(true);
      if (webViewReady.current) {
        const safeId = (truckId || "GT").replace(/'/g, "\\'");
        webViewRef.current?.injectJavaScript(
          `window.updateTruckPosition(${lat}, ${lng}, '${safeId}'); true;`,
        );
      }
    });

    socket.on("truck:status", ({ truckId, status }) => {
      if (status === "offline") {
        setLiveTruckOnline(false);
        const pos = liveTruckPos.current;
        if (pos && webViewReady.current) {
          const safeId = (truckId || pos.truckId || "GT").replace(/'/g, "\\'");
          webViewRef.current?.injectJavaScript(
            `window.showIdleTruck(${pos.lat}, ${pos.lng}, '${safeId}'); true;`,
          );
        } else if (webViewReady.current) {
          webViewRef.current?.injectJavaScript(
            `window.removeTruckMarker(); true;`,
          );
        }
        liveTruckPos.current = null;
      }
    });

    return () => socket.disconnect();
  }, []);

  // Called when WebView finishes loading — replay state into map
  const handleWebViewLoad = useCallback(() => {
    webViewReady.current = true;
    if (routePayloadRef.current.length > 0) {
      webViewRef.current?.injectJavaScript(
        `window.loadAllRoutes(${JSON.stringify(routePayloadRef.current)}); true;`,
      );
      if (selectedRouteIdRef.current) {
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(
            `window.highlightRoute('${selectedRouteIdRef.current}'); true;`,
          );
        }, 150);
      }
    }
    if (liveTruckPos.current) {
      const { lat, lng, truckId } = liveTruckPos.current;
      const safeId = (truckId || "GT").replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(
        `window.updateTruckPosition(${lat}, ${lng}, '${safeId}'); true;`,
      );
    }
  }, []);

  // Handle route-tap messages from Leaflet
  const handleWebViewMessage = useCallback((event) => {
    const msg = event.nativeEvent.data;
    if (msg.startsWith("route:")) {
      setSelectedRouteId(msg.slice(6));
    }
  }, []);

  // ═════════════════════════════════════════════════════════
  // LOCATION PERMISSION & FETCH
  // ═════════════════════════════════════════════════════════
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
        console.warn("Location error:", e.message);
      }
    })();
  }, []);

  // ═════════════════════════════════════════════════════════
  // BOTTOM SHEET DRAG HANDLING
  // ═════════════════════════════════════════════════════════
  const expandSheet = useCallback(() => {
    setIsExpandedAndSync(true);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 150,
    }).start();
  }, [setIsExpandedAndSync, sheetAnim]);

  const collapseSheet = useCallback(() => {
    setIsExpandedAndSync(false);
    Animated.spring(sheetAnim, {
      toValue: translateCollapsed,
      useNativeDriver: true,
      damping: 20,
      stiffness: 150,
    }).start();
  }, [setIsExpandedAndSync, sheetAnim, translateCollapsed]);

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

  const routeDetailsOpacity = sheetAnim.interpolate({
    inputRange: [translateCollapsed * 0.5, translateCollapsed],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Build Leaflet HTML once with the truck PNG baked in
  const leafletHTML = useMemo(() => buildLeafletHTML(TRUCK_B64), []);

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor="transparent" translucent />

      {/* MAP */}
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

        {/* Floating buttons */}
        <View style={styles.floatingActions}>
          <TouchableOpacity
            style={[styles.floatingButton, isSatellite && styles.floatingButtonActive]}
            activeOpacity={0.7}
            onPress={() => {
              setIsSatellite((prev) => {
                const next = !prev;
                webViewRef.current?.injectJavaScript(
                  `window.setMapStyle(${next}); true;`,
                );
                return next;
              });
            }}
          >
            <MaterialIcons
              name={isSatellite ? "map" : "satellite-alt"}
              size={22}
              color={isSatellite ? "#006A3B" : "#1B1C1C"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.floatingButton}
            activeOpacity={0.7}
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
        </View>

        <View style={styles.legendOverlay}>
          <HeatmapLegend />
        </View>
      </View>

      {/* BOTTOM SHEET */}
      <Animated.View
        style={[
          styles.bottomSheet,
          { height: sheetTotalHeight, transform: [{ translateY: sheetAnim }] },
        ]}
      >
        <View {...panResponder.panHandlers}>
          <View style={styles.handleBarContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Route pills — always visible, tap or drag on map to select */}
          {dataLoading ? (
            <View style={styles.pillsLoading}>
              <ActivityIndicator size="small" color="#006A3B" />
              <Text style={styles.pillsLoadingText}>Loading routes…</Text>
            </View>
          ) : routePayload.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pillsScroll}
              contentContainerStyle={styles.pillsContent}
            >
              {routePayload.map((rp) => {
                const isSelected = rp.id === selectedRouteId;
                return (
                  <TouchableOpacity
                    key={rp.id}
                    style={[
                      styles.routePill,
                      isSelected && {
                        borderColor: rp.color,
                        backgroundColor: `${rp.color}18`,
                      },
                    ]}
                    onPress={() => setSelectedRouteId(rp.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[styles.pillDot, { backgroundColor: rp.color }]}
                    />
                    <Text
                      style={[
                        styles.pillText,
                        isSelected && { color: rp.color, fontWeight: "700" },
                      ]}
                    >
                      {rp.name}
                    </Text>
                    {liveTruckOnline && activeRoute?._id === rp.id && (
                      <View style={styles.pillLiveBadge} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.pillsLoading}>
              <Text style={styles.pillsLoadingText}>No routes available</Text>
            </View>
          )}

          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeTitle} numberOfLines={1}>
                {activeRoute?.name || "Select a route above"}
              </Text>
              <Text style={styles.scheduleId} numberOfLines={1}>
                {activeSchedule
                  ? `Truck ${activeSchedule.truckId}${activeSchedule.driverName ? " · " + activeSchedule.driverName : ""}`
                  : activeRoute?.truckId
                    ? `Truck ${activeRoute.truckId}${activeRoute.driverName ? " · " + activeRoute.driverName : ""}`
                    : "No schedule today"}
              </Text>
            </View>
          </View>

          {!isExpanded && (
            <View style={styles.swipeIndicator}>
              <MaterialIcons
                name="keyboard-arrow-up"
                size={16}
                color="#BECABE"
              />
              <Text style={styles.swipeText}>Swipe up for details</Text>
            </View>
          )}
        </View>

        {/* Route timeline */}
        <Animated.View
          style={[styles.routeDetails, { opacity: routeDetailsOpacity }]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            scrollEnabled={isExpanded}
            contentContainerStyle={{ paddingBottom: bottomInset + 8 }}
          >
            <View style={styles.timeline}>
              {currentStops.length === 0 ? (
                <View style={styles.emptyStops}>
                  <MaterialIcons name="route" size={36} color="#BECABE" />
                  <Text style={styles.emptyStopsText}>
                    {dataLoading
                      ? "Loading route data…"
                      : !activeRoute
                        ? "Select a route to see stops"
                        : "No stops in this route"}
                  </Text>
                </View>
              ) : (
                currentStops.map((stop, index) => (
                  <View key={index} style={styles.timelineStep}>
                    <View style={styles.timelineIndicator}>
                      <View
                        style={[
                          styles.timelineDot,
                          stop.active && styles.timelineDotActive,
                          stop.status === "Completed" &&
                            styles.timelineDotCompleted,
                        ]}
                      >
                        {stop.status === "Completed" || stop.active ? (
                          <MaterialIcons name="check" size={14} color="#FFF" />
                        ) : (
                          <View style={styles.timelineDotInner} />
                        )}
                      </View>
                      {index < currentStops.length - 1 && (
                        <View
                          style={[
                            styles.timelineLine,
                            stop.status === "Completed" &&
                              styles.timelineLineCompleted,
                          ]}
                        />
                      )}
                    </View>
                    <View
                      style={[
                        styles.timelineContent,
                        stop.active && styles.timelineContentActive,
                      ]}
                    >
                      <View style={styles.timelineHeader}>
                        <Text
                          style={[
                            styles.timelineStopName,
                            stop.active && styles.timelineStopNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {stop.name}
                        </Text>
                        {stop.active && (
                          <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>Active</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.timelineTime,
                          stop.active && styles.timelineTimeActive,
                        ]}
                      >
                        {stop.status} • {stop.time}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.truckInfoCard}>
              <View
                style={[
                  styles.truckIconContainer,
                  !liveTruckOnline && { backgroundColor: "#F0EDED" },
                ]}
              >
                <MaterialIcons
                  name="local-shipping"
                  size={24}
                  color={liveTruckOnline ? "#006A3B" : "#BECABE"}
                />
              </View>
              <View style={styles.truckInfo}>
                {activeRoute?.truckId ? (
                  <>
                    <Text style={styles.truckTitle}>
                      Truck {activeRoute.truckId}
                      {liveTruckOnline ? " · Navigating" : ""}
                    </Text>
                    <Text style={styles.truckETA}>
                      {activeRoute.driverName
                        ? `Driver: ${activeRoute.driverName}`
                        : liveTruckOnline
                          ? "Currently collecting"
                          : "Not yet started"}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.truckTitle, { color: "#6B7280" }]}>
                      No truck assigned
                    </Text>
                    <Text style={styles.truckETA}>Check back later</Text>
                  </>
                )}
              </View>
              {liveTruckOnline && (
                <View style={styles.trackButton}>
                  <Text style={styles.trackButtonText}>Live</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FBF9F8" },
  mapContainer: { flex: 1 },
  webView: { flex: 1, backgroundColor: "#F0EDED" },
  floatingActions: {
    position: "absolute",
    top: 16,
    right: 16,
    gap: 8,
    zIndex: 20,
  },
  floatingButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  floatingButtonActive: {
    backgroundColor: "#E4EEE9",
    borderWidth: 1.5,
    borderColor: "#006A3B",
  },
  legendOverlay: { position: "absolute", left: 16, top: 16, zIndex: 10 },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 15,
    borderTopWidth: 1,
    borderTopColor: "#F0EDED",
    overflow: "hidden",
  },
  handleBarContainer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 10,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#DCD9D9",
    alignSelf: "center",
  },

  // ── Route pills ──
  pillsScroll: { maxHeight: 44 },
  pillsContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  routePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E4E2E1",
    backgroundColor: "#F6F3F2",
  },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 13, fontWeight: "500", color: "#1B1C1C" },
  pillLiveBadge: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  pillsLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 6,
    height: 36,
  },
  pillsLoadingText: { fontSize: 13, color: "#9CA3AF" },

  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  routeTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B1C1C",
    lineHeight: 22,
  },
  scheduleId: { fontSize: 12, color: "#6F7A70", marginTop: 2, lineHeight: 16 },
  swipeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
  },
  swipeText: { fontSize: 11, color: "#BECABE" },
  routeDetails: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
  timeline: { gap: 0, marginTop: 4 },
  timelineStep: { flexDirection: "row", minHeight: 72 },
  timelineIndicator: { alignItems: "center", width: 24 },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F6F3F2",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  timelineDotActive: { backgroundColor: "#006A3B", borderColor: "#FFFFFF" },
  timelineDotCompleted: { backgroundColor: "#006E1C", borderColor: "#FFFFFF" },
  timelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6F7A70",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#F0EDED",
    marginTop: -2,
    marginBottom: -2,
  },
  timelineLineCompleted: { backgroundColor: "#BECABE" },
  timelineContent: { flex: 1, marginLeft: 16, paddingBottom: 32 },
  timelineContentActive: {
    backgroundColor: "#EBF3EE",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C8DDD4",
    marginBottom: 24,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineStopName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6F7A70",
    lineHeight: 20,
  },
  timelineStopNameActive: { color: "#006A3B", fontWeight: "700" },
  activeBadge: {
    backgroundColor: "#006A3B",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  timelineTime: {
    fontSize: 12,
    color: "#6F7A70",
    marginTop: 4,
    lineHeight: 16,
  },
  timelineTimeActive: { color: "#006A3B" },
  truckInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F6F3F2",
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 54,
    gap: 12,
  },
  truckIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#E4EEE9",
    justifyContent: "center",
    alignItems: "center",
  },
  truckInfo: { flex: 1 },
  truckTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1B1C1C",
    lineHeight: 20,
  },
  truckETA: { fontSize: 13, color: "#6F7A70", lineHeight: 18 },
  trackButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#006A3B",
  },
  trackButtonText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  emptyStops: { alignItems: "center", paddingVertical: 32, gap: 12 },
  emptyStopsText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
});
