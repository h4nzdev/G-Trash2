import React, { useState, useRef, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Animated,
  Dimensions,
  Image,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";

import StatsCard from "../components/StatsCard";
import RouteTimelineCollector from "../components/RouteTimelineCollector";
import PickupActionCard from "../components/PickupActionCard";
import HeatmapMiniCard from "../components/HeatmapMiniCard";
import CollectionLogItem from "../components/CollectionLogItem";
import colors from "../constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function formatStopTime(index) {
  const totalMinutes = 8 * 60 + index * 45;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function waypointsToStops(waypoints) {
  const types = ["General", "Recyclables", "Mixed"];
  return waypoints.map((wp, i) => ({
    id: i + 1,
    name: wp.name,
    address: wp.name,
    lat: wp.lat,
    lng: wp.lng,
    time: formatStopTime(i),
    status: i === 0 ? "in-progress" : "upcoming",
    bins: (i % 3) + 2,
    weight: null,
    type: types[i % 3],
  }));
}

const HEATMAP_DATA = [
  { status: "critical", location: "Carbon Market", count: "2 areas" },
  { status: "moderate", location: "Colon Street", count: "1 area" },
  { status: "clean", location: "IT Park", count: "All clear" },
];

// ─── Skeleton Component ──────────────────────────────────────────────────────
function SkeletonBlock({ width = "100%", height = 16, radius = 8, style }) {
  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: "#E4E2E1" },
        style,
      ]}
    />
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CollectorHomeScreen() {
  const { user } = useAuth();
  const TRUCK_ID = user?.truckId ?? "GT-000";
  const driverName = user?.driverName ?? "Collector";

  const [stops, setStops] = useState([]);
  const [routeName, setRouteName] = useState("");
  const [routeAssigned, setRouteAssigned] = useState(false);
  const [pickupStatus, setPickupStatus] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showCleanedConfetti, setShowCleanedConfetti] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [truckCapacity, setTruckCapacity] = useState(0);
  const [weather, setWeather] = useState({ temp: 31, condition: 'Sunny' });
  const [navActive, setNavActive] = useState(false);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('@truck_nav_active').then((val) => {
        setNavActive(val === 'true');
      }).catch(() => {});
    }, [])
  );

  useEffect(() => {
    // Simulate capacity based on weight collected (max 1000kg for this truck)
    const maxWeight = 1000;
    const currentWeight = stops
      .filter((s) => s.status === "completed")
      .reduce((sum, s) => sum + parseInt(s.weight || "0", 10), 0);
    setTruckCapacity(Math.min(Math.round((currentWeight / maxWeight) * 100), 100));
  }, [stops]);

  const scrollRef = useRef(null);
  const actionRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(1)).current;
  const cleanedOpacity = useRef(new Animated.Value(0)).current;

  const applyRoute = useCallback((route) => {
    if (route?.waypoints?.length >= 1) {
      setStops(waypointsToStops(route.waypoints));
      setRouteName(route.name || "");
      setRouteAssigned(true);
    } else {
      setRouteAssigned(false);
      setStops([]);
    }
    setIsLoading(false);
  }, []);

  // Fallback: route assigned directly to this truck
  const fetchRouteDirect = useCallback(() => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `${API_URL}/api/routes/truck/${TRUCK_ID}`);
    xhr.timeout = 8000;
    xhr.onload = () => {
      if (xhr.status === 200) {
        try { applyRoute(JSON.parse(xhr.responseText)); }
        catch (_) { setHasError(true); setIsLoading(false); }
      } else if (xhr.status === 404) {
        setRouteAssigned(false);
        setStops([]);
        setIsLoading(false);
      } else {
        setHasError(true);
        setIsLoading(false);
      }
    };
    xhr.onerror = () => { setHasError(true); setIsLoading(false); };
    xhr.ontimeout = () => { setHasError(true); setIsLoading(false); };
    xhr.send();
  }, [TRUCK_ID, applyRoute]);

  // Fetch a route by its ID
  const fetchRouteById = useCallback((routeId) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `${API_URL}/api/routes/${routeId}`);
    xhr.timeout = 8000;
    xhr.onload = () => {
      if (xhr.status === 200) {
        try { applyRoute(JSON.parse(xhr.responseText)); }
        catch (_) { fetchRouteDirect(); }
      } else {
        fetchRouteDirect();
      }
    };
    xhr.onerror = fetchRouteDirect;
    xhr.ontimeout = fetchRouteDirect;
    xhr.send();
  }, [applyRoute, fetchRouteDirect]);

  const fetchRouteData = useCallback(() => {
    setIsLoading(true);
    setHasError(false);

    // Device-local date (YYYY-MM-DD) sent to avoid server UTC vs device timezone mismatch
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Step 1: check today's schedule for this truck (Officials create schedules, not direct route assignments)
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `${API_URL}/api/schedules/truck/${TRUCK_ID}/today?date=${today}`);
    xhr.timeout = 8000;
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const { schedules } = JSON.parse(xhr.responseText);
          const first = schedules?.[0];
          if (first?.routeId) {
            // Step 2: load the route linked from the schedule
            fetchRouteById(first.routeId);
            return;
          }
        } catch (_) {}
      }
      // No schedule today — fall back to directly-assigned route
      fetchRouteDirect();
    };
    xhr.onerror = fetchRouteDirect;
    xhr.ontimeout = fetchRouteDirect;
    xhr.send();
  }, [TRUCK_ID, fetchRouteById, fetchRouteDirect]);

  useEffect(() => { fetchRouteData(); }, [fetchRouteData]);

  useEffect(
    function () {
      if (!isLoading) { pulseAnim.setValue(1); return; }
      var loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return function () { loop.stop(); };
    },
    [isLoading],
  );

  useEffect(
    function () {
      if (showCleanedConfetti) {
        cleanedOpacity.setValue(0);
        Animated.sequence([
          Animated.timing(cleanedOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(1800),
          Animated.timing(cleanedOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(function () { setShowCleanedConfetti(false); });
      }
    },
    [showCleanedConfetti],
  );

  var currentStopIndex = stops.findIndex(function (s) { return s.status === "in-progress"; });
  var currentStop = stops[currentStopIndex];
  var completedCount = stops.filter(function (s) { return s.status === "completed"; }).length;
  var progressPct = stops.length > 0 ? Math.round((completedCount / stops.length) * 100) : 0;
  var totalWeight = stops
    .filter(function (s) { return s.status === "completed"; })
    .reduce(function (sum, s) { return sum + parseInt(s.weight || "0", 10); }, 0);

  // Collection log derived from completed stops
  var completedStops = stops.filter(function (s) { return s.status === "completed"; });

  // Waste breakdown computed from stops
  var typeColors = { General: "#006A3B", Recyclables: "#268451", Mixed: "#7ED99E" };
  var wasteBreakdown = ["General", "Recyclables", "Mixed"].map(function (type) {
    var typeStops = stops.filter(function (s) { return s.type === type; });
    var doneWeight = typeStops
      .filter(function (s) { return s.status === "completed"; })
      .reduce(function (sum, s) { return sum + parseInt(s.weight || "0", 10); }, 0);
    var percent = stops.length > 0 ? Math.round((typeStops.length / stops.length) * 100) : 0;
    return { type: type + " Waste", percent, weight: doneWeight + "kg", color: typeColors[type] };
  }).filter(function (item) { return item.percent > 0; });

  var handleMarkCleaned = function () {
    Animated.sequence([
      Animated.timing(successScale, { toValue: 1.03, duration: 120, useNativeDriver: true }),
      Animated.timing(successScale, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setPickupStatus("cleaned");
    setShowCleanedConfetti(true);
    setTimeout(function () {
      setStops(function (prev) {
        return prev.map(function (stop, i) {
          if (i === currentStopIndex)
            return Object.assign({}, stop, {
              status: "completed",
              weight: Math.floor(Math.random() * 40 + 20) + "kg",
            });
          if (i === currentStopIndex + 1 && stop.status === "upcoming")
            return Object.assign({}, stop, { status: "in-progress" });
          return stop;
        });
      });
      setPickupStatus("pending");
    }, 2000);
  };

  var handleReportIssue = function () {
    Alert.alert("Report Issue", "Select the type of issue at this location:", [
      { text: "Overflowing Bin" },
      { text: "Hazardous Waste" },
      { text: "Access Blocked" },
      { text: "Equipment Issue" },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  var scrollToAction = function () {
    if (actionRef.current && scrollRef.current) {
      actionRef.current.measureLayout(
        scrollRef.current,
        function (_x, y) { scrollRef.current.scrollTo({ y: y - 100, animated: true }); },
        function () {},
      );
    }
  };

  // ─── Render: Skeleton ──────────────────────────────────────────────────────
  var renderSkeleton = function () {
    return (
      <Animated.View style={{ opacity: pulseAnim }}>
        <View style={styles.statsRow}>
          {[0, 1].map(function (i) {
            return (
              <View key={i} style={[styles.skeletonCard, { flex: 1 }]}>
                <SkeletonBlock width={36} height={36} radius={10} style={{ marginBottom: 12 }} />
                <SkeletonBlock width="55%" height={26} style={{ marginBottom: 8 }} />
                <SkeletonBlock width="75%" height={11} style={{ marginBottom: 10 }} />
                <SkeletonBlock height={6} radius={3} />
              </View>
            );
          })}
        </View>
        <View style={[styles.skeletonCard, { marginBottom: 32 }]}>
          <SkeletonBlock width="45%" height={13} style={{ marginBottom: 20 }} />
          <SkeletonBlock height={20} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="55%" height={13} style={{ marginBottom: 28 }} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <SkeletonBlock height={48} radius={12} style={{ flex: 1 }} />
            <SkeletonBlock height={48} radius={12} style={{ flex: 1 }} />
          </View>
        </View>
      </Animated.View>
    );
  };

  var renderError = function () {
    return (
      <View style={styles.stateCard}>
        <View style={styles.errorIconWrap}>
          <MaterialIcons name="wifi-off" size={32} color="#BA1A1A" />
        </View>
        <Text style={styles.stateTitle}>Failed to load route</Text>
        <Text style={styles.stateSub}>Check your connection and try again.</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={fetchRouteData}
          activeOpacity={0.8}
        >
          <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  var renderUnassigned = function () {
    return (
      <View style={styles.stateCard}>
        <View style={styles.emptyIconWrap}>
          <MaterialIcons name="local-shipping" size={40} color="#BECABE" />
        </View>
        <Text style={[styles.stateTitle, { color: "#6F7A70" }]}>No route assigned yet</Text>
        <Text style={styles.stateSub}>Check back later or contact dispatch for your assignment.</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: "#6F7A70" }]}
          onPress={fetchRouteData}
          activeOpacity={0.8}
        >
          <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  };

  var renderAllDone = function () {
    return (
      <View style={styles.stateCard}>
        <View style={styles.successIconWrap}>
          <MaterialIcons name="check-circle" size={48} color="#006A3B" />
        </View>
        <Text style={[styles.stateTitle, { color: "#006A3B" }]}>All stops cleared!</Text>
        <Text style={styles.stateSub}>
          Great work today, {TRUCK_ID}. You collected {totalWeight}kg total.
        </Text>
      </View>
    );
  };

  // ─── Main Return ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.collectorBadge}>
            <Text style={styles.collectorBadgeText}>Collector</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7} onPress={fetchRouteData}>
            <MaterialIcons name="refresh" size={22} color="#1B1C1C" />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <MaterialIcons name="person" size={22} color="#BECABE" />
          </View>
        </View>
      </View>

      {/* Truck Status Bar */}
      <View style={styles.truckStatusBar}>
        <View style={styles.statusLeft}>
          <View style={styles.truckIdBadge}>
            <Text style={styles.truckIdText}>TRUCK-{TRUCK_ID}</Text>
          </View>
          <View style={styles.weatherBox}>
            <MaterialIcons name="wb-sunny" size={16} color="#F59E0B" />
            <Text style={styles.weatherText}>{weather.temp}°C {weather.condition}</Text>
          </View>
        </View>
        
        <View style={styles.capacityContainer}>
          <View style={styles.capacityLabelRow}>
            <Text style={styles.capacityLabel}>Bin Capacity</Text>
            <Text style={[styles.capacityValue, truckCapacity > 85 && { color: '#EF4444' }]}>
              {truckCapacity}%
            </Text>
          </View>
          <View style={styles.capacityBarBG}>
            <View style={[
              styles.capacityBarFill, 
              { width: `${truckCapacity}%` },
              truckCapacity > 85 && { backgroundColor: '#EF4444' }
            ]} />
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Greeting Section */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeInfo}>
            <Text style={styles.greeting}>Good Morning,</Text>
            <Text style={styles.driverName}>{driverName.split(" ")[0]}!</Text>
            <Text style={styles.greetingSub}>
              {routeAssigned ? `Active Route: ${routeName}` : "Waiting for route assignment."}
            </Text>
            <View style={styles.driverRow}>
              <View style={styles.driverChip}>
                <MaterialIcons name="badge" size={14} color="#FFFFFF" />
                <Text style={styles.driverChipText}>{TRUCK_ID}</Text>
              </View>
              {routeAssigned ? (
                <View style={styles.driverChip}>
                  <MaterialIcons name="route" size={14} color="#FFFFFF" />
                  <Text style={styles.driverChipText}>{routeName}</Text>
                </View>
              ) : (
                <View style={[styles.driverChip, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <MaterialIcons name="schedule" size={14} color="#FFFFFF" />
                  <Text style={styles.driverChipText}>Unassigned</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.welcomeIconBox}>
            <MaterialIcons name="eco" size={80} color="rgba(255,255,255,0.15)" />
          </View>
        </View>

        {/* ─── PERFORMANCE ANALYTICS ─────────────────────────────────────── */}
        {!isLoading && !hasError && routeAssigned && stops.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Analytics</Text>

            <View style={styles.statsRow}>
              <StatsCard
                icon="local-shipping"
                value={completedCount + "/" + stops.length}
                label="Stops Completed"
                progress={progressPct}
                color="#006A3B"
              />
              <StatsCard
                icon="schedule"
                value={currentStop ? currentStop.time : "—"}
                label={currentStop ? currentStop.name : stops.length > 0 ? "All done" : "No stops"}
                sublabel={currentStop ? "Scheduled" : undefined}
                color="#006E1C"
              />
            </View>

            {/* Today's Summary */}
            <View style={[styles.card, { marginBottom: 16 }]}>
              <View style={styles.analyticsHeader}>
                <MaterialIcons name="today" size={18} color="#006A3B" />
                <Text style={styles.analyticsTitle}>Today's Summary</Text>
              </View>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{completedCount}</Text>
                  <Text style={styles.summaryLabel}>Stops Done</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalWeight > 0 ? totalWeight + "kg" : "—"}</Text>
                  <Text style={styles.summaryLabel}>Collected</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{progressPct}%</Text>
                  <Text style={styles.summaryLabel}>Complete</Text>
                </View>
              </View>
            </View>

            {/* Waste Breakdown (computed from real stops) */}
            {wasteBreakdown.length > 0 ? (
              <View style={[styles.card, { marginBottom: 16 }]}>
                <View style={styles.analyticsHeader}>
                  <MaterialIcons name="pie-chart" size={18} color="#006A3B" />
                  <Text style={styles.analyticsTitle}>Route Waste Breakdown</Text>
                </View>
                {wasteBreakdown.map(function (item, i) {
                  return (
                    <View
                      key={i}
                      style={[styles.breakdownItem, i < wasteBreakdown.length - 1 && { marginBottom: 14 }]}
                    >
                      <View style={styles.breakdownRow}>
                        <View style={styles.breakdownLabelRow}>
                          <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
                          <Text style={styles.breakdownType}>{item.type}</Text>
                        </View>
                        <Text style={styles.breakdownWeight}>{item.weight}</Text>
                      </View>
                      <View style={styles.breakdownBar}>
                        <View style={[styles.breakdownFill, { width: item.percent + "%", backgroundColor: item.color }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Loading State */}
        {isLoading ? renderSkeleton() : null}

        {/* Error State */}
        {!isLoading && hasError ? renderError() : null}

        {/* Unassigned State */}
        {!isLoading && !hasError && !routeAssigned ? renderUnassigned() : null}

        {/* All Done State */}
        {!isLoading && !hasError && routeAssigned && stops.length > 0 && !currentStop
          ? renderAllDone()
          : null}

        {/* Current Pickup Action Card */}
        {!isLoading && !hasError && routeAssigned && currentStop ? (
          <Animated.View
            ref={actionRef}
            style={[styles.section, { transform: [{ scale: successScale }] }]}
          >
            <Text style={styles.sectionTitle}>Current Pickup</Text>
            <PickupActionCard
              location={currentStop.name}
              binCount={currentStop.bins || 3}
              status={pickupStatus}
              navigationActive={navActive}
              onMarkCleaned={handleMarkCleaned}
              onReportIssue={handleReportIssue}
            />
          </Animated.View>
        ) : null}

        {/* Assigned Route Section */}
        {!isLoading && !hasError && routeAssigned && stops.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Assigned Route</Text>
              <View style={styles.routeNameBadge}>
                <MaterialIcons name="route" size={13} color="#006A3B" />
                <Text style={styles.routeNameBadgeText}>{routeName}</Text>
              </View>
            </View>
            <View style={styles.card}>
              <RouteTimelineCollector stops={stops} />
            </View>
          </View>
        ) : null}

        {/* Area Status / Heatmap */}
        {!isLoading && !hasError ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Area Status</Text>
            <View style={styles.heatmapRow}>
              {HEATMAP_DATA.map(function (item, i) {
                return (
                  <HeatmapMiniCard
                    key={i}
                    status={item.status}
                    location={item.location}
                    count={item.count}
                    onPress={function () {
                      Alert.alert(item.location, "Status: " + item.status + "\n" + item.count);
                    }}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Collection Log (from completed stops) */}
        {!isLoading && !hasError && routeAssigned ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Today's Collection Log</Text>
              {totalWeight > 0 ? (
                <Text style={styles.logTotal}>{totalWeight}kg total</Text>
              ) : null}
            </View>
            <View style={styles.card}>
              {completedStops.length > 0 ? (
                completedStops.map(function (item, i) {
                  return (
                    <CollectionLogItem
                      key={i}
                      time={item.time}
                      location={item.name}
                      type={item.type}
                      weight={item.weight || "—"}
                      bins={item.bins}
                    />
                  );
                })
              ) : (
                <Text style={styles.logEmpty}>No collections logged yet.</Text>
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Cleaned Success Overlay */}
      {showCleanedConfetti ? (
        <Animated.View style={[styles.cleanedOverlay, { opacity: cleanedOpacity }]}>
          <View style={styles.cleanedCard}>
            <MaterialIcons name="check-circle" size={56} color="#006A3B" />
            <Text style={styles.cleanedTitle}>Area Cleaned!</Text>
            <Text style={styles.cleanedSub}>System updated successfully</Text>
          </View>
        </Animated.View>
      ) : null}

      {/* AI Assistant Modal */}
      <Modal
        visible={showAiAssistant}
        transparent
        animationType="slide"
        statusBarTranslucent
      >
        <View style={styles.aiModalOverlay}>
          <TouchableOpacity 
            style={styles.aiModalCloseArea} 
            onPress={() => setShowAiAssistant(false)} 
          />
          <View style={styles.aiModalContent}>
            <View style={styles.aiHeader}>
              <View style={styles.aiIconCircle}>
                <MaterialIcons name="psychology" size={32} color="#006A3B" />
              </View>
              <View>
                <Text style={styles.aiTitle}>EcoAssist AI</Text>
                <Text style={styles.aiSubtitle}>Your Intelligent Route Companion</Text>
              </View>
              <TouchableOpacity 
                style={styles.aiCloseBtn} 
                onPress={() => setShowAiAssistant(false)}
              >
                <MaterialIcons name="close" size={24} color="#6F7A70" />
              </TouchableOpacity>
            </View>

            <View style={styles.aiMessageContainer}>
              <Text style={styles.aiGreeting}>
                Hello {driverName.split(" ")[0]}, I've analyzed your current route and city data.
              </Text>
              
              <View style={styles.aiSuggestionCard}>
                <View style={styles.aiSuggestionHeader}>
                  <MaterialIcons name="auto-awesome" size={16} color="#F59E0B" />
                  <Text style={styles.aiSuggestionTitle}>Smart Insight</Text>
                </View>
                <Text style={styles.aiSuggestionText}>
                  Traffic is increasing near {currentStop?.name || 'your next stop'}. I recommend staying on the current path as it's still 4 minutes faster than alternatives.
                </Text>
              </View>

              <Text style={styles.aiSectionTitle}>Quick Actions</Text>
              
              <TouchableOpacity style={styles.aiActionItem} onPress={() => { setShowAiAssistant(false); scrollToAction(); }}>
                <View style={[styles.aiActionIcon, { backgroundColor: '#E4EEE9' }]}>
                  <MaterialIcons name="my-location" size={20} color="#006A3B" />
                </View>
                <View style={styles.aiActionText}>
                  <Text style={styles.aiActionTitle}>Focus on Current Stop</Text>
                  <Text style={styles.aiActionSub}>Instantly scroll to your active task</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#BECABE" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.aiActionItem}>
                <View style={[styles.aiActionIcon, { backgroundColor: '#FEF3F2' }]}>
                  <MaterialIcons name="report-problem" size={20} color="#BA1A1A" />
                </View>
                <View style={styles.aiActionText}>
                  <Text style={styles.aiActionTitle}>Report Blocked Route</Text>
                  <Text style={styles.aiActionSub}>Let AI recalculate for the whole fleet</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#BECABE" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.aiActionItem}>
                <View style={[styles.aiActionIcon, { backgroundColor: '#F0F9FF' }]}>
                  <MaterialIcons name="wb-sunny" size={20} color="#0284C7" />
                </View>
                <View style={styles.aiActionText}>
                  <Text style={styles.aiActionTitle}>Weather Optimization</Text>
                  <Text style={styles.aiActionSub}>Sunny weather confirmed for next 4 hours</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#BECABE" />
              </TouchableOpacity>
            </View>

            <View style={styles.aiFooter}>
              <Text style={styles.aiFooterText}>Powered by EcoAssist AI</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Assistant FAB */}
      {!isLoading && !hasError && currentStop ? (
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => setShowAiAssistant(true)} 
          activeOpacity={0.85}
        >
          <MaterialIcons name="psychology" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FBF9F8" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerLogo: { width: 90, height: 36 },
  truckStatusBar: {
    height: 70,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDED',
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
  collectorBadge: {
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  collectorBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  scrollContainer: { paddingHorizontal: 16, paddingTop: 24 },

  welcomeCard: {
    backgroundColor: "#006A3B",
    borderRadius: 28,
    padding: 24,
    marginBottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    overflow: "hidden",
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  welcomeInfo: { flex: 1, zIndex: 2 },
  greeting: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 2,
  },
  driverName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  greetingSub: { 
    fontSize: 14, 
    color: "rgba(255,255,255,0.85)", 
    lineHeight: 20, 
    marginBottom: 20,
    fontWeight: "500",
  },
  welcomeIconBox: {
    position: "absolute",
    right: -10,
    bottom: -20,
    zIndex: 1,
  },
  driverRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  driverChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  driverChipText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

  section: { marginBottom: 32 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    zIndex: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B1C1C",
    lineHeight: 22,
    marginBottom: 16,
    letterSpacing: -0.5,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  skeletonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },

  analyticsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  analyticsTitle: { fontSize: 16, fontWeight: "700", color: "#1B1C1C", flex: 1 },

  summaryGrid: { flexDirection: "row", alignItems: "center" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 22, fontWeight: "800", color: "#006A3B", marginBottom: 2 },
  summaryLabel: {
    fontSize: 10,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },
  summaryDivider: { width: 1, height: 36, backgroundColor: "#F0EDED" },

  breakdownItem: {},
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  breakdownLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  breakdownDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownType: { fontSize: 14, fontWeight: "500", color: "#1B1C1C" },
  breakdownWeight: { fontSize: 14, fontWeight: "700", color: "#1B1C1C" },
  breakdownBar: { height: 6, backgroundColor: "#F6F3F2", borderRadius: 3, overflow: "hidden" },
  breakdownFill: { height: "100%", borderRadius: 3 },

  routeNameBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E4EEE9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#C8DDD4",
  },
  routeNameBadgeText: { fontSize: 12, fontWeight: "600", color: "#006A3B" },

  heatmapRow: { flexDirection: "row", gap: 10 },

  stateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 40,
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#F0EDED",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#006A3B",
    lineHeight: 22,
    textAlign: "center",
    marginTop: 4,
  },
  stateSub: { fontSize: 13, color: "#6F7A70", lineHeight: 18, textAlign: "center" },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FDE9E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F6F3F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E4EEE9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#006A3B",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  retryBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },

  logTotal: { fontSize: 13, fontWeight: "600", color: "#006A3B" },
  logEmpty: { fontSize: 13, color: "#6F7A70", textAlign: "center", paddingVertical: 12 },

  cleanedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  cleanedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 40,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
  },
  cleanedTitle: { fontSize: 22, fontWeight: "700", color: "#006A3B", marginTop: 8 },
  cleanedSub: { fontSize: 14, color: "#6F7A70" },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#006A3B",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },

  aiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  aiModalCloseArea: {
    flex: 1,
  },
  aiModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDED',
  },
  aiIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E4EEE9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1C1C',
  },
  aiSubtitle: {
    fontSize: 12,
    color: '#6F7A70',
    fontWeight: '500',
  },
  aiCloseBtn: {
    marginLeft: 'auto',
    padding: 4,
  },
  aiMessageContainer: {
    padding: 24,
  },
  aiGreeting: {
    fontSize: 15,
    color: '#1B1C1C',
    lineHeight: 22,
    marginBottom: 20,
  },
  aiSuggestionCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginBottom: 28,
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiSuggestionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiSuggestionText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
    fontWeight: '500',
  },
  aiSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6F7A70',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  aiActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  aiActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  aiActionText: {
    flex: 1,
  },
  aiActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B1C1C',
    marginBottom: 2,
  },
  aiActionSub: {
    fontSize: 12,
    color: '#6F7A70',
  },
  aiFooter: {
    alignItems: 'center',
    marginTop: 8,
  },
  aiFooterText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#BECABE',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  bottomSpacer: { height: 40 },
});
