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

function formatStopTime(index) {
  const totalMinutes = 8 * 60 + index * 45;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

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

      window.updateTruckPosition = function(lat, lng, truckId, autoPan) {
        var id = truckId || 'GT';
        var icon = makeTruckIcon(id);
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

export default function MapScreen() {
  const routeParams = useRoute();
  const { focusTruck } = routeParams.params || {};
  const { bottom: bottomInset } = useSafeAreaInsets();

  const sheetTotalHeight = EXPANDED_HEIGHT + bottomInset;
  const translateCollapsed = sheetTotalHeight - COLLAPSED_HEIGHT;

  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [routePayload, setRoutePayload] = useState([]); 
  const [liveTruckOnline, setLiveTruckOnline] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState('topographic');
  const [isFollowing, setIsFollowing] = useState(!!focusTruck);

  const isExpandedRef = useRef(false);
  const sheetAnim = useRef(new Animated.Value(translateCollapsed)).current;
  const webViewRef = useRef(null);
  const socketRef = useRef(null);
  const liveTruckPos = useRef(null);
  const webViewReady = useRef(false);
  const routePayloadRef = useRef([]);
  const selectedRouteIdRef = useRef(null);
  const isFollowingRef = useRef(!!focusTruck);
  const initialTrucks = useRef([]);

  useEffect(() => { isFollowingRef.current = isFollowing; }, [isFollowing]);
  useEffect(() => { routePayloadRef.current = routePayload; }, [routePayload]);
  useEffect(() => { selectedRouteIdRef.current = selectedRouteId; }, [selectedRouteId]);

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

  useEffect(() => {
    (async () => {
      try {
        const [routesRes, schedRes, trucksRes] = await Promise.allSettled([
          fetch(`${TRACKING_SERVER}/api/routes`).then((r) => r.json()),
          fetch(`${TRACKING_SERVER}/api/schedules/today`).then((r) => r.json()),
          fetch(`${TRACKING_SERVER}/api/trucks`).then((r) => r.json()),
        ]);
        if (routesRes.status === "fulfilled" && Array.isArray(routesRes.value)) {
          setRoutes(routesRes.value);
        }
        if (schedRes.status === "fulfilled" && Array.isArray(schedRes.value?.schedules)) {
          setSchedules(schedRes.value.schedules);
        }
        if (trucksRes.status === "fulfilled" && Array.isArray(trucksRes.value)) {
          const online = trucksRes.value.filter(t => t.status === 'online');
          initialTrucks.current = online;
          if (online.length > 0) {
            const active = online[0];
            liveTruckPos.current = { lat: active.lat, lng: active.lng, truckId: active.truckId };
            setLiveTruckOnline(true);
          }
        }
      } catch (e) {
        console.warn("MapScreen fetch error:", e);
      } finally {
        setDataLoading(false);
      }
    })();
  }, []);

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

  useEffect(() => {
    if (!webViewReady.current || routePayload.length === 0) return;
    webViewRef.current?.injectJavaScript(
      `window.loadAllRoutes(${JSON.stringify(routePayload)}); true;`,
    );
  }, [routePayload]);

  useEffect(() => {
    if (!webViewReady.current || !selectedRouteId) return;
    webViewRef.current?.injectJavaScript(
      `window.highlightRoute('${selectedRouteId}'); true;`,
    );
  }, [selectedRouteId]);

  useEffect(() => {
    const socket = io(TRACKING_SERVER, { transports: ["polling", "websocket"] });
    socketRef.current = socket;

    socket.on("truck:location:update", ({ truckId, lat, lng }) => {
      liveTruckPos.current = { lat, lng, truckId };
      setLiveTruckOnline(true);
      if (webViewReady.current) {
        const safeId = (truckId || "GT").replace(/'/g, "\\'");
        webViewRef.current?.injectJavaScript(
          `window.updateTruckPosition(${lat}, ${lng}, '${safeId}', ${isFollowingRef.current}); true;`,
        );
      }
    });

    socket.on("truck:status", ({ truckId, status }) => {
      if (status === "offline") {
        setLiveTruckOnline(false);
        const pos = liveTruckPos.current;
        if (pos && webViewReady.current) {
          const safeId = (truckId || "GT").replace(/'/g, "\\'");
          webViewRef.current?.injectJavaScript(`window.showIdleTruck(${pos.lat}, ${pos.lng}, '${safeId}'); true;`);
        } else if (webViewReady.current) {
          webViewRef.current?.injectJavaScript(`window.removeTruckMarker(); true;`);
        }
        liveTruckPos.current = null;
      }
    });

    return () => socket.disconnect();
  }, []);

  const handleWebViewLoad = useCallback(() => {
    webViewReady.current = true;
    if (routePayloadRef.current.length > 0) {
      webViewRef.current?.injectJavaScript(`window.loadAllRoutes(${JSON.stringify(routePayloadRef.current)}); true;`);
      if (selectedRouteIdRef.current) {
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(`window.highlightRoute('${selectedRouteIdRef.current}'); true;`);
        }, 150);
      }
    }
    // Inject all initial online trucks
    initialTrucks.current.forEach(t => {
      const safeId = (t.truckId || "GT").replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(
        `window.updateTruckPosition(${t.lat}, ${t.lng}, '${safeId}', false); true;`
      );
    });
    // Focus if following
    if (liveTruckPos.current && isFollowingRef.current) {
      const { lat, lng, truckId } = liveTruckPos.current;
      const safeId = (truckId || "GT").replace(/'/g, "\\'");
      webViewRef.current?.injectJavaScript(`window.updateTruckPosition(${lat}, ${lng}, '${safeId}', true); true;`);
    }
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
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { latitude, longitude } = loc.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(`window.updateUserLocation(${latitude}, ${longitude}); true;`);
          }, 600);
        }
      } catch (e) {
        console.warn("Location error:", e);
      }
    })();
  }, []);

  const expandSheet = useCallback(() => {
    isExpandedRef.current = true; setIsExpanded(true);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 150 }).start();
  }, [sheetAnim]);

  const collapseSheet = useCallback(() => {
    isExpandedRef.current = false; setIsExpanded(false);
    Animated.spring(sheetAnim, { toValue: translateCollapsed, useNativeDriver: true, damping: 20, stiffness: 150 }).start();
  }, [sheetAnim, translateCollapsed]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.locationY < 60,
      onMoveShouldSetPanResponder: (evt, gs) => Math.abs(gs.dy) > Math.abs(gs.dx) && Math.abs(gs.dy) > 15 && evt.nativeEvent.locationY < 80,
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
        <View style={styles.floatingActions}>
          <TouchableOpacity
            style={[styles.floatingButton, isFollowing && styles.floatingButtonActive]}
            onPress={() => {
              setIsFollowing(!isFollowing);
              if (!isFollowing && liveTruckPos.current) {
                const { lat, lng } = liveTruckPos.current;
                webViewRef.current?.injectJavaScript(`window.gotoLocation(${lat}, ${lng}, 16); true;`);
              }
            }}
          >
            <MaterialIcons name={isFollowing ? "gps-fixed" : "gps-not-fixed"} size={22} color={isFollowing ? "#006A3B" : "#1B1C1C"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.floatingButton, (mapStyle !== 'voyager') && styles.floatingButtonActive]}
            activeOpacity={0.7}
            onPress={() => {
              setMapStyle((prev) => {
                let next;
                if (prev === 'topographic') next = 'satellite';
                else if (prev === 'satellite') next = 'voyager';
                else next = 'topographic';
                webViewRef.current?.injectJavaScript(
                  `window.setMapStyle('${next}'); true;`,
                );
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
            style={styles.floatingButton}
            onPress={() => {
              if (userLocation) {
                webViewRef.current?.injectJavaScript(`window.gotoLocation(${userLocation.lat}, ${userLocation.lng}, 15); true;`);
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

      <Animated.View style={[styles.bottomSheet, { height: sheetTotalHeight, transform: [{ translateY: sheetAnim }] }]}>
        <View {...panResponder.panHandlers}>
          <View style={styles.handleBarContainer}><View style={styles.handleBar} /></View>
          {dataLoading ? (
            <View style={styles.pillsLoading}><ActivityIndicator size="small" color="#006A3B" /><Text style={styles.pillsLoadingText}>Loading routes…</Text></View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll} contentContainerStyle={styles.pillsContent}>
              {routePayload.map((rp) => {
                const isSelected = rp.id === selectedRouteId;
                return (
                  <TouchableOpacity key={rp.id} style={[styles.routePill, isSelected && { borderColor: rp.color, backgroundColor: `${rp.color}18` }]} onPress={() => setSelectedRouteId(rp.id)}>
                    <View style={[styles.pillDot, { backgroundColor: rp.color }]} />
                    <Text style={[styles.pillText, isSelected && { color: rp.color, fontWeight: "700" }]}>{rp.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeTitle}>{activeRoute?.name || "Select a route"}</Text>
              <Text style={styles.scheduleId}>
                {activeSchedule ? `Truck ${activeSchedule.truckId} · ${activeSchedule.driverName}` : "No active schedule"}
              </Text>
            </View>
          </View>
        </View>
        <Animated.View style={[styles.routeDetails, { opacity: routeDetailsOpacity }]}>
          <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={isExpanded} contentContainerStyle={{ paddingBottom: bottomInset + 8 }}>
            <View style={styles.timeline}>
              {currentStops.map((stop, index) => (
                <View key={index} style={styles.timelineStep}>
                  <View style={styles.timelineIndicator}>
                    <View style={styles.timelineDot}><View style={styles.timelineDotInner} /></View>
                    {index < currentStops.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}><Text style={styles.timelineStopName}>{stop.name}</Text><Text style={styles.timelineTime}>{stop.time}</Text></View>
                </View>
              ))}
            </View>
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
  floatingActions: { position: "absolute", top: 60, right: 16, gap: 12, zIndex: 10 },
  floatingButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFF", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  floatingButtonActive: { borderColor: "#006A3B", borderWidth: 2 },
  legendOverlay: { position: "absolute", top: 60, left: 16, zIndex: 10 },
  bottomSheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#FFF", borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  handleBarContainer: { paddingVertical: 12, alignItems: "center" },
  handleBar: { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2 },
  pillsScroll: { maxHeight: 50 },
  pillsContent: { paddingHorizontal: 24, gap: 10 },
  routePill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, py: 8, borderRadius: 20, borderWeight: 1, borderColor: "#F3F4F6", backgroundColor: "#F9FAFB" },
  pillDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  pillText: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  pillsLoading: { paddingHorizontal: 24, flexDirection: "row", alignItems: "center", gap: 8 },
  pillsLoadingText: { fontSize: 13, color: "#9CA3AF" },
  sheetHeader: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: "row", alignItems: "center" },
  routeTitle: { fontSize: 20, fontWeight: "800", color: "#1F2937" },
  scheduleId: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  routeDetails: { flex: 1 },
  timeline: { paddingHorizontal: 24, paddingTop: 8 },
  timelineStep: { flexDirection: "row", gap: 16, marginBottom: 20 },
  timelineIndicator: { alignItems: "center", width: 20 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" },
  timelineDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFF" },
  timelineLine: { width: 2, flex: 1, backgroundColor: "#F3F4F6", marginTop: 4 },
  timelineContent: { flex: 1 },
  timelineStopName: { fontSize: 15, fontWeight: "600", color: "#1F2937" },
  timelineTime: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
});
