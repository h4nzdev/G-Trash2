import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';

import StatsCard from '../components/StatsCard';
import RouteTimelineCollector from '../components/RouteTimelineCollector';
import PickupActionCard from '../components/PickupActionCard';
import HeatmapMiniCard from '../components/HeatmapMiniCard';
import CollectionLogItem from '../components/CollectionLogItem';

// ─── Static data ─────────────────────────────────────────────────────────────
const ROUTES = ['North Cebu', 'South Cebu', 'IT Corridor', 'Lahug District'];

// null → error state, [] → empty state, [...] → normal
const ROUTE_DATA = {
  'North Cebu': [
    { name: 'Ayala',    time: '08:30 AM', status: 'completed'   },
    { name: 'IT Park',  time: '09:15 AM', status: 'completed'   },
    { name: 'Apas',     time: '09:45 AM', status: 'completed'   },
    { name: 'Lahug',    time: '10:45 AM', status: 'in-progress' },
    { name: 'Banilad',  time: '11:30 AM', status: 'upcoming'    },
    { name: 'Talamban', time: '12:15 PM', status: 'upcoming'    },
  ],
  'South Cebu': [],
  'IT Corridor': null,
  'Lahug District': [
    { name: 'Banilad',     time: '08:00 AM', status: 'completed'   },
    { name: 'Talamban',    time: '09:30 AM', status: 'in-progress' },
    { name: 'Mandaue',     time: '11:00 AM', status: 'upcoming'    },
    { name: 'Consolacion', time: '12:30 PM', status: 'upcoming'    },
  ],
};

const LOG_DATA = [
  { time: '08:30 AM', location: 'Ayala',   type: 'General',     weight: '52kg' },
  { time: '09:15 AM', location: 'IT Park', type: 'Recyclables', weight: '38kg' },
  { time: '09:45 AM', location: 'Apas',    type: 'Mixed',       weight: '45kg' },
];

const HEATMAP_DATA = [
  { status: 'critical', location: 'Carbon Market', count: '2 areas'   },
  { status: 'moderate', location: 'Colon Street',  count: '1 area'    },
  { status: 'clean',    location: 'IT Park',       count: 'All clear' },
];

// ─── Map stop coordinates (Cebu City) ────────────────────────────────────────
const STOP_COORDS = {
  'Ayala':       [10.3181, 123.9068],
  'IT Park':     [10.3315, 123.9069],
  'Apas':        [10.3440, 123.8962],
  'Lahug':       [10.3288, 123.8850],
  'Banilad':     [10.3477, 123.8680],
  'Talamban':    [10.3600, 123.9020],
  'Mandaue':     [10.3500, 123.9200],
  'Consolacion': [10.3750, 123.9500],
};

// ─── Leaflet HTML generator ───────────────────────────────────────────────────
// Builds a self-contained Leaflet map with status-coded markers and route lines.
// All JS inside the HTML uses var/function style for max WebView compatibility.
function generateMapHTML(stops) {
  const stopsWithCoords = stops
    .filter(s => STOP_COORDS[s.name])
    .map(s => ({
      name: s.name,
      status: s.status,
      lat: STOP_COORDS[s.name][0],
      lng: STOP_COORDS[s.name][1],
    }));

  const stopsJSON = JSON.stringify(stopsWithCoords);

  const centerStop =
    stopsWithCoords.find(s => s.status === 'in-progress') ||
    [...stopsWithCoords].reverse().find(s => s.status === 'completed') ||
    stopsWithCoords[0];

  const centerLat = centerStop ? centerStop.lat : 10.3288;
  const centerLng = centerStop ? centerStop.lng : 123.8960;

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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var stops = ${stopsJSON};

      var map = new L.Map('map', {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: true,
      });
      map.setView([${centerLat}, ${centerLng}], 14);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        opacity: 0.9, maxZoom: 17, minZoom: 12,
      }).addTo(map);

      // Build polyline segments
      var completedCoords = [];
      var upcomingCoords = [];
      for (var i = 0; i < stops.length; i++) {
        if (stops[i].status === 'completed' || stops[i].status === 'in-progress') {
          completedCoords.push([stops[i].lat, stops[i].lng]);
        }
      }
      for (var i = 0; i < stops.length; i++) {
        if (stops[i].status === 'in-progress' || stops[i].status === 'upcoming') {
          upcomingCoords.push([stops[i].lat, stops[i].lng]);
        }
      }
      if (completedCoords.length > 1) {
        L.polyline(completedCoords, { color: '#006A3B', weight: 5, opacity: 0.85 }).addTo(map);
      }
      if (upcomingCoords.length > 1) {
        L.polyline(upcomingCoords, { color: '#BECABE', weight: 4, opacity: 0.7, dashArray: '8, 10' }).addTo(map);
      }

      // Add a marker per stop
      for (var i = 0; i < stops.length; i++) {
        var stop = stops[i];
        var markerHtml, iconW, iconH, anchorX, anchorY;

        if (stop.status === 'completed') {
          markerHtml = '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">'
            + '<div style="width:24px;height:24px;border-radius:50%;background:#006E1C;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,106,59,0.4);">'
            + '<span style="color:white;font-size:13px;line-height:1;font-weight:bold;">&#10003;</span></div>'
            + '<span style="font-size:10px;color:#1B1C1C;background:white;padding:1px 6px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1);white-space:nowrap;">' + stop.name + '</span>'
            + '</div>';
          iconW = 64; iconH = 44; anchorX = 32; anchorY = 12;
        } else if (stop.status === 'in-progress') {
          markerHtml = '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">'
            + '<div style="width:32px;height:32px;border-radius:50%;background:#006A3B;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,106,59,0.5);">'
            + '<span style="font-size:16px;line-height:1;">&#128666;</span></div>'
            + '<span style="font-size:10px;font-weight:bold;color:#006A3B;background:white;padding:1px 6px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.15);white-space:nowrap;">' + stop.name + '</span>'
            + '</div>';
          iconW = 72; iconH = 52; anchorX = 36; anchorY = 16;
        } else {
          markerHtml = '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">'
            + '<div style="width:16px;height:16px;border-radius:50%;background:#BECABE;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.15);"></div>'
            + '<span style="font-size:10px;color:#6F7A70;background:white;padding:1px 6px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.08);white-space:nowrap;">' + stop.name + '</span>'
            + '</div>';
          iconW = 60; iconH = 36; anchorX = 30; anchorY = 8;
        }

        var icon = L.divIcon({ html: markerHtml, iconSize: [iconW, iconH], iconAnchor: [anchorX, anchorY], className: '' });
        L.marker([stop.lat, stop.lng], { icon: icon }).addTo(map);
      }

      setTimeout(function() { map.invalidateSize(); }, 200);
    })();
  </script>
</body>
</html>`;
}

// ─── Skeleton block ───────────────────────────────────────────────────────────
function SkeletonBlock({ width = '100%', height = 16, radius = 8, style }) {
  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: '#E4E2E1' },
        style,
      ]}
    />
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function CollectorScreen() {
  const [stops, setStops] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('North Cebu');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pickupStatus, setPickupStatus] = useState('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const scrollRef  = useRef(null);
  const actionRef  = useRef(null);
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(1)).current;

  useEffect(() => { fetchRouteData('North Cebu'); }, []);

  useEffect(() => {
    if (!isLoading) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLoading]);

  const fetchRouteData = (route) => {
    setIsLoading(true);
    setHasError(false);
    setDropdownOpen(false);
    setPickupStatus('pending');
    setTimeout(() => {
      const data = ROUTE_DATA[route];
      if (data === null) { setHasError(true); }
      else { setStops(data); }
      setIsLoading(false);
    }, 1200);
  };

  const handleSelectRoute = (route) => {
    setSelectedRoute(route);
    fetchRouteData(route);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentStopIndex = stops.findIndex(s => s.status === 'in-progress');
  const currentStop      = stops[currentStopIndex];
  const completedCount   = stops.filter(s => s.status === 'completed').length;
  const progressPct      = stops.length > 0 ? Math.round((completedCount / stops.length) * 100) : 0;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleMarkCleaned = () => {
    Animated.sequence([
      Animated.timing(successScale, { toValue: 1.03, duration: 120, useNativeDriver: true }),
      Animated.timing(successScale, { toValue: 1,    duration: 200, useNativeDriver: true }),
    ]).start();
    setPickupStatus('cleaned');
    setTimeout(() => {
      setStops(prev =>
        prev.map((stop, i) => {
          if (i === currentStopIndex) return { ...stop, status: 'completed' };
          if (i === currentStopIndex + 1 && stop.status === 'upcoming') return { ...stop, status: 'in-progress' };
          return stop;
        })
      );
      setPickupStatus('pending');
    }, 1500);
  };

  const handleReportIssue = () => {
    Alert.alert(
      'Report Issue',
      'Select the type of issue at this location:',
      [
        { text: 'Overflowing Bin',  onPress: () => {} },
        { text: 'Hazardous Waste',  onPress: () => {} },
        { text: 'Access Blocked',   onPress: () => {} },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const scrollToAction = () => {
    actionRef.current?.measureLayout(
      scrollRef.current,
      (_x, y) => scrollRef.current?.scrollTo({ y, animated: true }),
      () => {}
    );
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <Animated.View style={{ opacity: pulseAnim }}>
      <View style={styles.statsRow}>
        {[0, 1].map(i => (
          <View key={i} style={[styles.card, { flex: 1 }]}>
            <SkeletonBlock width={36} height={36} radius={10} style={{ marginBottom: 12 }} />
            <SkeletonBlock width="55%" height={26} style={{ marginBottom: 8 }} />
            <SkeletonBlock width="75%" height={11} style={{ marginBottom: 10 }} />
            <SkeletonBlock height={6} radius={3} />
          </View>
        ))}
      </View>
      <View style={[styles.card, { marginBottom: 32, height: 220 }]}>
        <SkeletonBlock height="100%" radius={16} />
      </View>
      <View style={[styles.card, styles.skeletonSection]}>
        <SkeletonBlock width="45%" height={13} style={{ marginBottom: 20 }} />
        <SkeletonBlock height={20} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="55%" height={13} style={{ marginBottom: 28 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <SkeletonBlock height={48} radius={12} style={{ flex: 1 }} />
          <SkeletonBlock height={48} radius={12} style={{ flex: 1 }} />
        </View>
      </View>
      <View style={[styles.card, styles.skeletonSection]}>
        <SkeletonBlock width="40%" height={13} style={{ marginBottom: 24 }} />
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <SkeletonBlock width={28} height={28} radius={14} style={{ marginRight: 14, flexShrink: 0 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBlock width="50%" height={13} />
              <SkeletonBlock width="30%" height={11} />
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );

  // ── Error state ────────────────────────────────────────────────────────────
  const renderError = () => (
    <View style={[styles.card, styles.stateFeedback]}>
      <View style={styles.errorIconWrap}>
        <MaterialIcons name="wifi-off" size={32} color="#BA1A1A" />
      </View>
      <Text style={styles.stateTitle}>Failed to load route</Text>
      <Text style={styles.stateSub}>Check your connection and try again.</Text>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={() => fetchRouteData(selectedRoute)}
        activeOpacity={0.8}
      >
        <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
        <Text style={styles.retryBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Empty state ────────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={[styles.card, styles.stateFeedback]}>
      <MaterialIcons name="event-busy" size={40} color="#BECABE" />
      <Text style={[styles.stateTitle, { color: '#6F7A70' }]}>No route assigned for today</Text>
      <Text style={styles.stateSub}>Check back later or contact dispatch.</Text>
    </View>
  );

  // ── All-done state ─────────────────────────────────────────────────────────
  const renderAllDone = () => (
    <View style={[styles.card, styles.stateFeedback]}>
      <MaterialIcons name="check-circle" size={40} color="#006A3B" />
      <Text style={styles.stateTitle}>All stops cleared!</Text>
      <Text style={styles.stateSub}>Great work today, GT-402.</Text>
    </View>
  );

  // ── Route dropdown ─────────────────────────────────────────────────────────
  const renderRouteSelector = () => (
    <View style={styles.dropdownWrapper}>
      <TouchableOpacity
        style={styles.routeSelector}
        onPress={() => setDropdownOpen(v => !v)}
        activeOpacity={0.7}
      >
        <MaterialIcons name="route" size={14} color="#006A3B" />
        <Text style={styles.routeSelectorText}>{selectedRoute}</Text>
        <MaterialIcons name={dropdownOpen ? 'expand-less' : 'expand-more'} size={18} color="#6F7A70" />
      </TouchableOpacity>

      {dropdownOpen ? (
        <View style={styles.dropdown}>
          {ROUTES.map(route => (
            <TouchableOpacity
              key={route}
              style={[styles.dropdownItem, route === selectedRoute && styles.dropdownItemActive]}
              onPress={() => handleSelectRoute(route)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dropdownItemText, route === selectedRoute && styles.dropdownItemTextActive]}>
                {route}
              </Text>
              {route === selectedRoute ? <MaterialIcons name="check" size={16} color="#006A3B" /> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} >
      <StatusBar barStyle="dark-content" />

      {/* Top app bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="eco" size={24} color="#047857" />
          <Text style={styles.brandTitle}>G-TRASH</Text>
          <View style={styles.collectorBadge}>
            <Text style={styles.collectorBadgeText}>Collector</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
            <MaterialIcons name="notifications-none" size={22} color="#1B1C1C" />
            <View style={styles.notifDot} />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <MaterialIcons name="person" size={22} color="#BECABE" />
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>Good Morning,{'\n'}Collector!</Text>
          <View style={styles.driverRow}>
            <View style={styles.driverChip}>
              <MaterialIcons name="badge" size={14} color="#006A3B" />
              <Text style={styles.driverChipText}>GT-402</Text>
            </View>
            <View style={styles.driverChip}>
              <MaterialIcons name="local-shipping" size={14} color="#006A3B" />
              <Text style={styles.driverChipText}>{selectedRoute}</Text>
            </View>
          </View>
        </View>

        {/* ── Loading ── */}
        {isLoading ? renderSkeleton() : null}

        {/* ── Error ── */}
        {!isLoading && hasError ? renderError() : null}

        {/* ── Loaded content ── */}
        {!isLoading && !hasError ? (
          <>
            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatsCard
                icon="local-shipping"
                value={stops.length > 0 ? `${completedCount}/${stops.length}` : '—'}
                label="Stops Completed"
                progress={progressPct}
              />
              <StatsCard
                icon="schedule"
                value={currentStop ? currentStop.time : '—'}
                label={
                  currentStop
                    ? `${currentStop.name}, Block 5`
                    : stops.length > 0 ? 'All done' : 'No stops'
                }
                sublabel={currentStop ? 'On Time' : undefined}
              />
            </View>

            {/* ── Route Map ── */}
            {stops.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Route Map</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveBadgeText}>Live</Text>
                  </View>
                </View>
                <View style={styles.mapCard}>
                  {/* key forces WebView refresh when route changes */}
                  <WebView
                    key={selectedRoute}
                    source={{ html: generateMapHTML(stops) }}
                    style={styles.mapWebView}
                    originWhitelist={['*']}
                    javaScriptEnabled
                    domStorageEnabled
                    scrollEnabled={false}
                    mixedContentMode="compatibility"
                  />
                  {/* Route name chip overlaid on map */}
                  <View style={styles.mapOverlayChip}>
                    <MaterialIcons name="route" size={12} color="#006A3B" />
                    <Text style={styles.mapOverlayText}>{selectedRoute}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* ── Empty / All-done / Current pickup ── */}
            {stops.length === 0 ? (
              renderEmpty()
            ) : !currentStop ? (
              renderAllDone()
            ) : (
              <Animated.View
                ref={actionRef}
                style={[styles.section, { transform: [{ scale: successScale }] }]}
              >
                <Text style={styles.sectionTitle}>Current Pickup</Text>
                <PickupActionCard
                  location={`${currentStop.name}, Block 5`}
                  binCount={3}
                  status={pickupStatus}
                  onMarkCleaned={handleMarkCleaned}
                  onReportIssue={handleReportIssue}
                />
              </Animated.View>
            )}

            {/* ── Route timeline + dropdown ── */}
            {stops.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Assigned Route</Text>
                  {renderRouteSelector()}
                </View>
                <View style={styles.card}>
                  <RouteTimelineCollector stops={stops} />
                </View>
              </View>
            ) : null}

            {/* ── Area status heatmap ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Area Status</Text>
              <View style={styles.heatmapRow}>
                {HEATMAP_DATA.map((item, i) => (
                  <HeatmapMiniCard
                    key={i}
                    status={item.status}
                    location={item.location}
                    count={item.count}
                    onPress={() => Alert.alert(item.location, `Status: ${item.status}\n${item.count}`)}
                  />
                ))}
              </View>
            </View>

            {/* ── Collection log ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Collection Log</Text>
              <View style={styles.card}>
                {LOG_DATA.length > 0 ? (
                  LOG_DATA.map((item, i) => (
                    <CollectionLogItem
                      key={i}
                      time={item.time}
                      location={item.location}
                      type={item.type}
                      weight={item.weight}
                    />
                  ))
                ) : (
                  <Text style={styles.logEmpty}>No collections logged yet.</Text>
                )}
              </View>
            </View>
          </>
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* FAB — scroll to current pickup when a stop is active */}
      {!isLoading && !hasError && currentStop ? (
        <TouchableOpacity style={styles.fab} onPress={scrollToAction} activeOpacity={0.85}>
          <MaterialIcons name="flag" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF9F8' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: -0.5,
  },
  collectorBadge: {
    backgroundColor: 'rgba(0,106,59,0.10)',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,106,59,0.18)',
  },
  collectorBadgeText: { fontSize: 11, fontWeight: '700', color: '#006A3B' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F6F3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BA1A1A',
    borderWidth: 1.5,
    borderColor: '#F6F3F2',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0EDED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Scroll content
  container: { paddingHorizontal: 16, paddingTop: 24 },

  // Greeting
  greetingSection: { marginBottom: 28 },
  greeting: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1B1C1C',
    letterSpacing: -0.4,
    lineHeight: 41,
    marginBottom: 12,
  },
  driverRow: { flexDirection: 'row', gap: 8 },
  driverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,106,59,0.08)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,106,59,0.15)',
  },
  driverChipText: { fontSize: 12, fontWeight: '600', color: '#006A3B' },

  // Layout
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  section: { marginBottom: 32 },
  skeletonSection: { marginBottom: 32 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1B1C1C',
    lineHeight: 22,
    marginBottom: 16,
  },

  // Base card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0EDED',
  },

  // Map
  mapCard: {
    borderRadius: 24,
    overflow: 'hidden',
    height: 230,
    borderWidth: 1,
    borderColor: '#F0EDED',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  mapWebView: { flex: 1, backgroundColor: '#F0EDED' },
  mapOverlayChip: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mapOverlayText: { fontSize: 11, fontWeight: '700', color: '#006A3B' },

  // Live badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,106,59,0.08)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,106,59,0.18)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#006A3B',
  },
  liveBadgeText: { fontSize: 11, fontWeight: '700', color: '#006A3B' },

  // Heatmap
  heatmapRow: { flexDirection: 'row', gap: 10 },

  // State feedback
  stateFeedback: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
    marginBottom: 32,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#006A3B',
    lineHeight: 22,
    textAlign: 'center',
  },
  stateSub: {
    fontSize: 13,
    color: '#6F7A70',
    lineHeight: 18,
    textAlign: 'center',
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(186,26,26,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#006A3B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  // Route dropdown
  dropdownWrapper: { position: 'relative', zIndex: 20 },
  routeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,106,59,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(0,106,59,0.18)',
  },
  routeSelectorText: { fontSize: 12, fontWeight: '600', color: '#006A3B' },
  dropdown: {
    position: 'absolute',
    top: 38,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 6,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#E4E2E1',
    zIndex: 30,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemActive: { backgroundColor: '#F6F3F2' },
  dropdownItemText: { fontSize: 15, color: '#1B1C1C' },
  dropdownItemTextActive: { color: '#006A3B', fontWeight: '600' },

  // Log
  logEmpty: {
    fontSize: 13,
    color: '#6F7A70',
    textAlign: 'center',
    paddingVertical: 12,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#006A3B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  bottomSpacer: { height: 16 },
});
