import React, { useState, useRef, useCallback, useEffect } from "react";
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
  Modal,
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

const TRACKING_SERVER = API_URL;

// ═══════════════════════════════════════════════════════════
// CONFIG — replace with your OpenRouteService API key
// ═══════════════════════════════════════════════════════════
const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjQ1N2I3YTYyYzZiMTRjZTc5MjI5OTdhNWI3NTIzY2I1IiwiaCI6Im11cm11cjY0In0=";

// ═══════════════════════════════════════════════════════════
// DIMENSIONS
// ═══════════════════════════════════════════════════════════
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const COLLAPSED_HEIGHT = 80;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.52;

// ═══════════════════════════════════════════════════════════
// BARANGAY LIST (Mabolo added)
// ═══════════════════════════════════════════════════════════
const barangays = ["Lahug", "Apas", "Mabolo", "IT Park", "Ayala", "Banilad"];

// ═══════════════════════════════════════════════════════════
// VERIFIED BARANGAY CENTERS (real coordinates)
// ═══════════════════════════════════════════════════════════
const barangayCenters = {
  Lahug: [10.33093, 123.89813],
  Apas: [10.3374, 123.9044],
  Mabolo: [10.3476, 123.913],
  IT_Park: [10.3304, 123.9074],
  Ayala: [10.31778, 123.905],
  Banilad: [10.3333, 123.9],
};

// ═══════════════════════════════════════════════════════════
// WAYPOINTS SENT TO OPENROUTESERVICE  [lng, lat] order
// ═══════════════════════════════════════════════════════════
const barangayWaypoints = {
  Lahug: [
    [123.905, 10.31778], // Ayala
    [123.9074, 10.3304], // IT Park
    [123.9044, 10.3374], // Apas
    [123.89813, 10.33093], // Lahug
  ],
  Apas: [
    [123.9074, 10.3304], // IT Park
    [123.9044, 10.3374], // Apas
    [123.89813, 10.33093], // Lahug
    [123.913, 10.3476], // Mabolo
  ],
  Mabolo: [
    [123.913, 10.3476], // Mabolo
    [123.9044, 10.3374], // Apas
    [123.9074, 10.3304], // IT Park
    [123.89813, 10.33093], // Lahug
  ],
};

// ═══════════════════════════════════════════════════════════
// FALLBACK ROUTES (if ORS fails)
// ═══════════════════════════════════════════════════════════
const fallbackRoutes = {
  Lahug: [
    [10.31778, 123.905],
    [10.324, 123.906],
    [10.3304, 123.9074],
    [10.334, 123.9044],
    [10.3374, 123.9044],
    [10.334, 123.9],
    [10.33093, 123.89813],
  ],
  Apas: [
    [10.3304, 123.9074],
    [10.334, 123.906],
    [10.3374, 123.9044],
    [10.334, 123.901],
    [10.33093, 123.89813],
    [10.34, 123.908],
    [10.3476, 123.913],
  ],
  Mabolo: [
    [10.3476, 123.913],
    [10.343, 123.909],
    [10.3374, 123.9044],
    [10.334, 123.906],
    [10.3304, 123.9074],
    [10.327, 123.903],
    [10.33093, 123.89813],
  ],
};

// ═══════════════════════════════════════════════════════════
// ROUTE STOPS PER BARANGAY (bottom‑sheet timeline)
// ═══════════════════════════════════════════════════════════
const barangayStops = {
  Lahug: [
    { name: "Ayala", active: false, time: "08:30 AM", status: "Completed" },
    { name: "IT Park", active: false, time: "09:15 AM", status: "Completed" },
    {
      name: "Apas",
      active: false,
      time: "Estimating...",
      status: "In Progress",
    },
    { name: "Lahug", active: true, time: "10:45 AM", status: "Active" },
  ],
  Apas: [
    { name: "IT Park", active: false, time: "08:00 AM", status: "Completed" },
    { name: "Apas", active: true, time: "09:20 AM", status: "Active" },
    { name: "Lahug", active: false, time: "10:00 AM", status: "In Progress" },
    { name: "Mabolo", active: false, time: "11:15 AM", status: "Pending" },
  ],
  Mabolo: [
    { name: "Mabolo", active: true, time: "08:45 AM", status: "Active" },
    { name: "Apas", active: false, time: "09:30 AM", status: "In Progress" },
    { name: "IT Park", active: false, time: "10:10 AM", status: "Pending" },
    { name: "Lahug", active: false, time: "11:00 AM", status: "Pending" },
  ],
};

// ═══════════════════════════════════════════════════════════
// ORS FETCH HELPER  (POST /v2/directions/driving-car/geojson)
// ═══════════════════════════════════════════════════════════
async function fetchORSRoute(waypoints) {
  if (!ORS_API_KEY || ORS_API_KEY === "YOUR_ORS_API_KEY") {
    console.warn("ORS key missing — using fallback route");
    return null;
  }
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
      // ORS returns [lng, lat] – Leaflet expects [lat, lng]
      return data.features[0].geometry.coordinates.map((c) => [c[1], c[0]]);
    }
    return null;
  } catch (e) {
    console.warn("ORS fetch failed:", e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// LEAFLEF HTML BUILDER
// ═══════════════════════════════════════════════════════════
function buildLeafletHTML(initialCoords, userLat, userLng, hasUserLocation) {
  // Default centre for circles if user location not available
  const circleCenter = hasUserLocation
    ? { lat: userLat, lng: userLng }
    : { lat: 10.3157, lng: 123.8854 }; // map centre

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
      background: #1A73E8;
      width: 18px; height: 18px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(26,115,232,0.4);
    }
    .user-pulse {
      width: 60px; height: 60px;
      border-radius: 50%;
      background: rgba(26,115,232,0.15);
      border: 2px solid rgba(26,115,232,0.35);
      position: absolute;
      left: -21px; top: -21px;
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
      var map, routeLayer, userMarker, userPulseCircle;
      var radiusCircles = [];  // holds the three hollow circles

      var southWest = new L.LatLng(10.275, 123.845);
      var northEast = new L.LatLng(10.355, 123.925);
      var cebuBounds = new L.LatLngBounds(southWest, northEast);

      map = new L.Map('map', {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
        doubleClickZoom: true,
        touchZoom: true,
        maxBounds: cebuBounds,
        maxBoundsViscosity: 0.0,
        minZoom: 13,
        maxZoom: 17,
        inertia: true,
        inertiaDeceleration: 3000,
      });
      map.setView([10.3157, 123.8854], 14);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        opacity: 0.9, maxZoom: 17, minZoom: 13
      }).addTo(map);

      // ── Helper to place the three hollow circles at a given lat/lng ──
      function drawUserRadius(lat, lng) {
        // remove existing circles
        radiusCircles.forEach(function(c) { map.removeLayer(c); });
        radiusCircles = [];

        // three layers, border only, dashed
        var layers = [
          { radius: 350, color: '#E53935', weight: 2.5, dashArray: '6 4' },
          { radius: 700, color: '#FDD835', weight: 2.5, dashArray: '6 4' },
          { radius: 1050, color: '#4CAF50', weight: 2.5, dashArray: '6 4' }
        ];
        layers.forEach(function(l) {
          var circle = L.circle([lat, lng], {
            radius: l.radius,
            color: l.color,
            fillOpacity: 0,           // HOLLOW – only border
            weight: l.weight,
            dashArray: l.dashArray,
            opacity: 0.8,
            interactive: false,
          }).addTo(map);
          radiusCircles.push(circle);
        });
      }

      // Draw the initial hollow circles
      drawUserRadius(${circleCenter.lat}, ${circleCenter.lng});

      // ── Truck marker — created lazily on first real position received ──
      var truckMarker = null;
      var truckIcon = L.divIcon({
        html: '<div style="background:#006A3B;border-radius:12px;padding:8px;display:flex;align-items:center;gap:4px;box-shadow:0 4px 12px rgba(0,106,59,0.3);border:2px solid white;"><span style="font-size:16px;">&#128666;</span><span style="color:white;font-size:10px;font-weight:bold;">GT-402</span></div>',
        iconSize: [80, 40],
        iconAnchor: [40, 20],
        className: ''
      });

      window.updateTruckPosition = function(lat, lng) {
        if (!truckMarker) {
          truckMarker = L.marker([lat, lng], { icon: truckIcon }).addTo(map);
        } else {
          truckMarker.setLatLng([lat, lng]);
        }
        map.panTo([lat, lng]);
      };

      window.removeTruckMarker = function() {
        if (truckMarker) { map.removeLayer(truckMarker); truckMarker = null; }
      };

      // ── User location marker + accuracy circle (if permission granted) ──
      if (${hasUserLocation}) {
        userMarker = L.marker([${userLat}, ${userLng}], {
          icon: L.divIcon({
            html: '<div style="position:relative;"><div class="user-marker"></div><div class="user-pulse"></div></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            className: ''
          })
        }).addTo(map);
        userPulseCircle = L.circle([${userLat}, ${userLng}], {
          radius: 120,
          color: '#1A73E8',
          fillColor: '#1A73E8',
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: '4 4',
          interactive: false,
        }).addTo(map);
      }

      // ── Route updater (called from React Native) ──
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

      // ── Update user position AND the hollow circles ──
      window.updateUserLocation = function(lat, lng) {
        // update marker
        if (userMarker) { map.removeLayer(userMarker); }
        if (userPulseCircle) { map.removeLayer(userPulseCircle); }
        userMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: '<div style="position:relative;"><div class="user-marker"></div><div class="user-pulse"></div></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            className: ''
          })
        }).addTo(map);
        userPulseCircle = L.circle([lat, lng], {
          radius: 120,
          color: '#1A73E8',
          fillColor: '#1A73E8',
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: '4 4',
          interactive: false,
        }).addTo(map);
        // move the three hollow radius circles to the new position
        drawUserRadius(lat, lng);
      };

      // ── Draw the initial truck route ──
      window.updateTruckRoute('${JSON.stringify(initialCoords)}');

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState("Lahug");
  const [isExpanded, setIsExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  const [locationPermission, setLocationPermission] = useState(null);
  const [routeCoords, setRouteCoords] = useState(fallbackRoutes.Lahug);
  const [routeLoading, setRouteLoading] = useState(false);

  // ── Refs ──
  const isExpandedRef = useRef(false);
  const sheetAnim = useRef(new Animated.Value(translateCollapsed)).current;
  const webViewRef = useRef(null);
  const socketRef = useRef(null);
  const liveTruckPos = useRef(null); // { lat, lng } — latest position from socket
  const webViewReady = useRef(false);

  // Sync expanded state between state and ref
  const setIsExpandedAndSync = useCallback((val) => {
    isExpandedRef.current = val;
    setIsExpanded(val);
  }, []);

  // ═════════════════════════════════════════════════════════
  // REAL-TIME TRUCK TRACKING
  // ═════════════════════════════════════════════════════════
  useEffect(() => {
    const socket = io(TRACKING_SERVER, { transports: ["polling", "websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => console.log("🟢 Resident socket connected:", socket.id));
    socket.on("disconnect", (reason) => console.log("🔴 Resident socket disconnected:", reason));

    socket.on("truck:location:update", ({ lat, lng }) => {
      liveTruckPos.current = { lat, lng };
      if (webViewReady.current) {
        webViewRef.current?.injectJavaScript(
          `window.updateTruckPosition(${lat}, ${lng}); true;`,
        );
      }
    });

    socket.on("truck:status", ({ status }) => {
      if (status === "offline") {
        liveTruckPos.current = null;
        webViewRef.current?.injectJavaScript(`window.removeTruckMarker(); true;`);
      }
    });

    return () => socket.disconnect();
  }, []);

  // Reset ready flag whenever the WebView reloads (leafletHTML changed)
  useEffect(() => {
    webViewReady.current = false;
  }, [routeCoords, userLocation]);

  // Called when the WebView finishes loading — replay latest truck position
  const handleWebViewLoad = useCallback(() => {
    webViewReady.current = true;
    if (liveTruckPos.current) {
      const { lat, lng } = liveTruckPos.current;
      webViewRef.current?.injectJavaScript(
        `window.updateTruckPosition(${lat}, ${lng}); true;`,
      );
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
          // Inject into WebView once the map is ready
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
  // FETCH ORS ROUTE WHEN BARANGAY CHANGES
  // ═════════════════════════════════════════════════════════
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRouteLoading(true);
      const waypoints = barangayWaypoints[selectedBarangay];
      let coords = null;
      if (waypoints) {
        coords = await fetchORSRoute(waypoints);
      }
      if (cancelled) return;
      const finalCoords =
        coords || fallbackRoutes[selectedBarangay] || fallbackRoutes.Lahug;
      setRouteCoords(finalCoords);
      setRouteLoading(false);
      webViewRef.current?.injectJavaScript(
        `window.updateTruckRoute('${JSON.stringify(finalCoords)}'); true;`,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBarangay]);

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
    setDropdownOpen(false);
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
      onMoveShouldSetPanResponder: (evt, gs) => {
        return (
          Math.abs(gs.dy) > Math.abs(gs.dx) &&
          Math.abs(gs.dy) > 15 &&
          evt.nativeEvent.locationY < 80
        );
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -40 && !isExpandedRef.current) expandSheet();
        else if (gs.dy > 40 && isExpandedRef.current) collapseSheet();
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  const toggleDropdown = () => {
    if (!isExpandedRef.current) expandSheet();
    setDropdownOpen((v) => !v);
  };

  // ═════════════════════════════════════════════════════════
  // ANIMATED VALUES
  // ═════════════════════════════════════════════════════════
  const routeDetailsOpacity = sheetAnim.interpolate({
    inputRange: [translateCollapsed * 0.5, translateCollapsed],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const currentStops = barangayStops[selectedBarangay] || barangayStops.Lahug;

  // ═════════════════════════════════════════════════════════
  // BUILD LEAFLET HTML (recreated whenever userLocation changes)
  // ═════════════════════════════════════════════════════════
  const leafletHTML = buildLeafletHTML(
    routeCoords,
    userLocation?.lat || 0,
    userLocation?.lng || 0,
    !!userLocation,
  );

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor="transparent" translucent />

      {/* ── MAP ── */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: leafletHTML }}
          style={styles.webView}
          originWhitelist={["*"]}
          javaScriptEnabled
          onLoad={handleWebViewLoad}
        />

        {/* Floating buttons */}
        <View style={styles.floatingActions}>
          <TouchableOpacity style={styles.floatingButton} activeOpacity={0.7}>
            <MaterialIcons name="layers" size={22} color="#1B1C1C" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.floatingButton}
            activeOpacity={0.7}
            onPress={async () => {
              if (userLocation) {
                webViewRef.current?.injectJavaScript(
                  `map.setView([${userLocation.lat}, ${userLocation.lng}], 15); true;`,
                );
              } else if (locationPermission !== "granted") {
                Alert.alert(
                  "Location",
                  "Location permission is needed to centre the map on your position.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Open Settings",
                      onPress: () => {},
                    },
                  ],
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

      {/* ── FULL‑SCREEN LOADING MODAL ── */}
      <Modal
        visible={routeLoading}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => {}} // required for Android back button
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" color="#006A3B" />
            <Text style={styles.modalTitle}>Fetching Route</Text>
            <Text style={styles.modalSubtitle}>
              Retrieving the best path for {selectedBarangay}…
            </Text>
          </View>
        </View>
      </Modal>

      {/* ── BOTTOM SHEET ── */}
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

          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.routeTitle}>Collector Route</Text>
              <Text style={styles.scheduleId}>Schedule ID: #CEB-9921</Text>
            </View>

            {/* Barangay selector */}
            <View style={styles.selectorContainer}>
              <TouchableOpacity
                style={styles.selector}
                onPress={toggleDropdown}
                activeOpacity={0.7}
              >
                <Text style={styles.selectorText}>{selectedBarangay}</Text>
                <MaterialIcons
                  name={dropdownOpen ? "expand-less" : "expand-more"}
                  size={18}
                  color="#6F7A70"
                />
              </TouchableOpacity>

              {dropdownOpen && isExpanded && (
                <View style={styles.dropdownMenu}>
                  {barangays.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[
                        styles.dropdownItem,
                        b === selectedBarangay && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedBarangay(b);
                        setDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          b === selectedBarangay &&
                            styles.dropdownItemTextActive,
                        ]}
                      >
                        {b}
                      </Text>
                      {b === selectedBarangay && (
                        <MaterialIcons name="check" size={18} color="#006A3B" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
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
              {currentStops.map((stop, index) => (
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
              ))}
            </View>

            <View style={styles.truckInfoCard}>
              <View style={styles.truckIconContainer}>
                <MaterialIcons
                  name="local-shipping"
                  size={24}
                  color="#006A3B"
                />
              </View>
              <View style={styles.truckInfo}>
                <Text style={styles.truckTitle}>Truck #402 is arriving</Text>
                <Text style={styles.truckETA}>
                  Estimated arrival: 3 minutes
                </Text>
              </View>
              <TouchableOpacity style={styles.trackButton}>
                <Text style={styles.trackButtonText}>Track</Text>
              </TouchableOpacity>
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
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
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
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingBottom: 12,
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
  selectorContainer: { position: "relative", zIndex: 20 },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F6F3F2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BECABE",
  },
  selectorText: { fontSize: 15, fontWeight: "500", color: "#1B1C1C" },
  dropdownMenu: {
    position: "absolute",
    top: 44,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E4E2E1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
    minWidth: 160,
    zIndex: 30,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemActive: { backgroundColor: "#F6F3F2" },
  dropdownItemText: { fontSize: 15, color: "#1B1C1C" },
  dropdownItemTextActive: { color: "#006A3B", fontWeight: "600" },
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
    backgroundColor: "rgba(0,106,59,0.05)",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,106,59,0.1)",
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
    marginBottom: 34,
    gap: 12,
  },
  truckIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(0,106,59,0.1)",
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

  // ── Modal styles ──
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
    lineHeight: 20,
  },
});
