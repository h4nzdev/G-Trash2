import React, { useState, useRef, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { io } from "socket.io-client";
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useNetwork } from "../context/NetworkContext";
import { saveRouteCache, loadRouteCache } from "../utils/routeCache";
import API_URL from "../config";

import NetworkBanner from "../components/NetworkBanner";
import StatsCard from "../components/StatsCard";
import RouteTimelineCollector from "../components/RouteTimelineCollector";
import PickupActionCard from "../components/PickupActionCard";
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
  const { user, unreadCount, clearUnread } = useAuth();
  const { networkChangeKey } = useNetwork();
  const navigation = useNavigation();
  const TRUCK_ID = user?.truckId ?? "GT-000";
  const driverName = user?.driverName ?? "Collector";

  const [stops, setStops] = useState([]);
  const [routeName, setRouteName] = useState("");
  const [routeAssigned, setRouteAssigned] = useState(false);
  const [pickupStatus, setPickupStatus] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isOfflineRoute, setIsOfflineRoute] = useState(false);
  const [showCleanedConfetti, setShowCleanedConfetti] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [truckCapacity, setTruckCapacity] = useState(0);
  const [navActive, setNavActive] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatScrollRef = useRef(null);

  // Re-fetch route data every time the Home tab comes into focus (covers tab switches + notification taps)
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("@truck_nav_active")
        .then((val) => {
          setNavActive(val === "true");
        })
        .catch(() => {});
      // Always refresh on focus — catches notification taps and tab switches
      fetchRouteData();
      // Clear the schedule refresh flag set by notification handlers
      AsyncStorage.removeItem("@schedule_refresh_needed").catch(() => {});
    }, [fetchRouteData]),
  );

  // Socket: re-fetch when an official assigns a new schedule or route to this truck.
  // networkChangeKey bumps whenever the interface switches (WiFi → cellular or back),
  // which tears down the stale socket and opens a fresh one immediately.
  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket", "polling"] });
    socket.on("schedule:changed", ({ truckId }) => {
      if (truckId?.toUpperCase() === TRUCK_ID?.toUpperCase()) fetchRouteData();
    });
    socket.on("route:assigned", ({ truckId }) => {
      if (truckId?.toUpperCase() === TRUCK_ID?.toUpperCase()) fetchRouteData();
    });
    return () => socket.disconnect();
  }, [TRUCK_ID, fetchRouteData, networkChangeKey]);

  useEffect(() => {
    // Simulate capacity based on weight collected (max 1000kg for this truck)
    const maxWeight = 1000;
    const currentWeight = stops
      .filter((s) => s.status === "completed")
      .reduce((sum, s) => sum + parseInt(s.weight || "0", 10), 0);
    setTruckCapacity(
      Math.min(Math.round((currentWeight / maxWeight) * 100), 100),
    );
  }, [stops]);

  const scrollRef = useRef(null);
  const actionRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(1)).current;
  const cleanedOpacity = useRef(new Animated.Value(0)).current;

  const applyRoute = useCallback(
    (route, fromCache = false) => {
      if (route?.waypoints?.length >= 1) {
        setStops(waypointsToStops(route.waypoints));
        setRouteName(route.name || "");
        setRouteAssigned(true);
        if (!fromCache) saveRouteCache(TRUCK_ID, route);
      } else {
        setRouteAssigned(false);
        setStops([]);
      }
      setIsLoading(false);
    },
    [TRUCK_ID],
  );

  // Last-resort fallback: load today's cached route when all network calls fail.
  const tryOfflineCache = useCallback(async () => {
    const cached = await loadRouteCache(TRUCK_ID);
    if (cached) {
      applyRoute(cached, true);
      setIsOfflineRoute(true);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  }, [TRUCK_ID, applyRoute]);

  // Fallback: route assigned directly to this truck
  const fetchRouteDirect = useCallback(() => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `${API_URL}/api/routes/truck/${TRUCK_ID}`);
    xhr.timeout = 8000;
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          applyRoute(JSON.parse(xhr.responseText));
        } catch (_) {
          tryOfflineCache();
        }
      } else if (xhr.status === 404) {
        setRouteAssigned(false);
        setStops([]);
        setIsLoading(false);
      } else {
        tryOfflineCache();
      }
    };
    xhr.onerror = () => tryOfflineCache();
    xhr.ontimeout = () => tryOfflineCache();
    xhr.send();
  }, [TRUCK_ID, applyRoute, tryOfflineCache]);

  // Fetch a route by its ID
  const fetchRouteById = useCallback(
    (routeId) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", `${API_URL}/api/routes/${routeId}`);
      xhr.timeout = 8000;
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            applyRoute(JSON.parse(xhr.responseText));
          } catch (_) {
            fetchRouteDirect();
          }
        } else {
          fetchRouteDirect();
        }
      };
      xhr.onerror = fetchRouteDirect;
      xhr.ontimeout = fetchRouteDirect;
      xhr.send();
    },
    [applyRoute, fetchRouteDirect],
  );

  const fetchRouteData = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setIsOfflineRoute(false);

    // Device-local date (YYYY-MM-DD) sent to avoid server UTC vs device timezone mismatch
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Step 1: check today's schedule for this truck (Officials create schedules, not direct route assignments)
    const xhr = new XMLHttpRequest();
    xhr.open(
      "GET",
      `${API_URL}/api/schedules/truck/${TRUCK_ID}/today?date=${today}`,
    );
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

  useEffect(() => {
    fetchRouteData();
  }, [fetchRouteData]);

  useEffect(
    function () {
      if (!isLoading) {
        pulseAnim.setValue(1);
        return;
      }
      var loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return function () {
        loop.stop();
      };
    },
    [isLoading],
  );

  useEffect(
    function () {
      if (showCleanedConfetti) {
        cleanedOpacity.setValue(0);
        Animated.sequence([
          Animated.timing(cleanedOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(1800),
          Animated.timing(cleanedOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(function () {
          setShowCleanedConfetti(false);
        });
      }
    },
    [showCleanedConfetti],
  );

  var currentStopIndex = stops.findIndex(function (s) {
    return s.status === "in-progress";
  });
  var currentStop = stops[currentStopIndex];
  var completedCount = stops.filter(function (s) {
    return s.status === "completed";
  }).length;
  var progressPct =
    stops.length > 0 ? Math.round((completedCount / stops.length) * 100) : 0;
  var totalWeight = stops
    .filter(function (s) {
      return s.status === "completed";
    })
    .reduce(function (sum, s) {
      return sum + parseInt(s.weight || "0", 10);
    }, 0);

  // Collection log derived from completed stops
  var completedStops = stops.filter(function (s) {
    return s.status === "completed";
  });

  // Waste breakdown computed from stops
  var typeColors = {
    General: "#006A3B",
    Recyclables: "#268451",
    Mixed: "#7ED99E",
  };
  var wasteBreakdown = ["General", "Recyclables", "Mixed"]
    .map(function (type) {
      var typeStops = stops.filter(function (s) {
        return s.type === type;
      });
      var doneWeight = typeStops
        .filter(function (s) {
          return s.status === "completed";
        })
        .reduce(function (sum, s) {
          return sum + parseInt(s.weight || "0", 10);
        }, 0);
      var percent =
        stops.length > 0
          ? Math.round((typeStops.length / stops.length) * 100)
          : 0;
      return {
        type: type + " Waste",
        percent,
        weight: doneWeight + "kg",
        color: typeColors[type],
      };
    })
    .filter(function (item) {
      return item.percent > 0;
    });

  var handleMarkCleaned = function () {
    Animated.sequence([
      Animated.timing(successScale, {
        toValue: 1.03,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(successScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
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

  const openAiModal = () => {
    const greeting = `Hi ${driverName.split(" ")[0]}! I'm EcoAssist AI. You're on route "${routeName || "Unassigned"}" with ${completedCount} of ${stops.length} stops done. How can I help you today?`;
    setAiMessages([{ role: "assistant", content: greeting }]);
    setAiInput("");
    setShowAiAssistant(true);
  };

  const sendAiMessage = async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    const userMsg = { role: "user", content: text };
    const updated = [...aiMessages, userMsg];
    setAiMessages(updated);
    setAiInput("");
    setAiLoading(true);
    setTimeout(
      () => chatScrollRef.current?.scrollToEnd({ animated: true }),
      100,
    );
    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated,
          context: {
            driverName,
            truckId: TRUCK_ID,
            routeName,
            currentStop: currentStop?.name || null,
            completed: completedCount,
            total: stops.length,
            totalWeight,
          },
        }),
      });
      const data = await res.json();
      const reply =
        data.reply || "Sorry, I couldn't get a response. Try again.";
      setAiMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error. Check your internet and try again.",
        },
      ]);
    } finally {
      setAiLoading(false);
      setTimeout(
        () => chatScrollRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  };

  var scrollToAction = function () {
    if (actionRef.current && scrollRef.current) {
      actionRef.current.measureLayout(
        scrollRef.current,
        function (_x, y) {
          scrollRef.current.scrollTo({ y: y - 100, animated: true });
        },
        function () {},
      );
    }
  };

  // ─── Render: Skeleton ──────────────────────────────────────────────────────
  var renderSkeleton = function () {
    return (
      <Animated.View style={{ opacity: pulseAnim }}>
        <View style={styles.skeletonHero}>
          <SkeletonBlock width="40%" height={13} style={{ marginBottom: 10 }} />
          <SkeletonBlock width="55%" height={30} style={{ marginBottom: 14 }} />
          <SkeletonBlock width="70%" height={13} style={{ marginBottom: 20 }} />
          <SkeletonBlock height={6} radius={3} style={{ marginBottom: 16 }} />
          <View style={styles.skeletonStatsRow}>
            {[0, 1, 2].map((i) => (
              <SkeletonBlock
                key={i}
                height={52}
                radius={8}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        </View>
        <View style={styles.skeletonSection}>
          <SkeletonBlock width="35%" height={11} style={{ marginBottom: 14 }} />
          <SkeletonBlock height={88} radius={12} style={{ marginBottom: 12 }} />
        </View>
        <View style={styles.skeletonSection}>
          <SkeletonBlock width="30%" height={11} style={{ marginBottom: 14 }} />
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                gap: 12,
                marginBottom: 14,
                alignItems: "center",
              }}
            >
              <SkeletonBlock width={10} height={10} radius={5} />
              <SkeletonBlock height={13} style={{ flex: 1 }} />
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  var renderError = function () {
    return (
      <View style={styles.stateCard}>
        <View style={styles.errorIconWrap}>
          <MaterialIcons name="wifi-off" size={28} color="#DC2626" />
        </View>
        <Text style={styles.stateTitle}>Failed to load route</Text>
        <Text style={styles.stateSub}>
          Check your connection and try again.
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={fetchRouteData}
          activeOpacity={0.8}
        >
          <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  var renderUnassigned = function () {
    return (
      <View style={styles.stateCard}>
        <View style={styles.emptyIconWrap}>
          <MaterialIcons name="local-shipping" size={36} color="#9CA3AF" />
        </View>
        <Text style={[styles.stateTitle, { color: "#374151" }]}>
          No route assigned yet
        </Text>
        <Text style={styles.stateSub}>
          Check back later or contact dispatch.
        </Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: "#6B7280" }]}
          onPress={fetchRouteData}
          activeOpacity={0.8}
        >
          <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  };

  var renderAllDone = function () {
    return (
      <View style={styles.stateCard}>
        <View style={styles.successIconWrap}>
          <MaterialIcons name="check-circle" size={40} color="#006A3B" />
        </View>
        <Text style={[styles.stateTitle, { color: "#006A3B" }]}>
          All stops cleared!
        </Text>
        <Text style={styles.stateSub}>
          Great work, {driverName.split(" ")[0]}. You collected {totalWeight}kg
          today.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <NetworkBanner />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.collectorBadge}>
            <Text style={styles.collectorBadgeText}>Collector</Text>
          </View>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.truckIdText}>TRUCK-{TRUCK_ID}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={fetchRouteData}
            activeOpacity={0.7}
          >
            <MaterialIcons name="refresh" size={20} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.7}
            onPress={() => {
              clearUnread();
              navigation.navigate("Alerts");
            }}
          >
            <MaterialIcons
              name={unreadCount > 0 ? "notifications" : "notifications-none"}
              size={22}
              color={unreadCount > 0 ? "#006A3B" : "#374151"}
            />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* ── Hero (no card — inline native text) ── */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroGreeting}>Good morning,</Text>
              <Text style={styles.heroName}>{driverName.split(" ")[0]}!</Text>
            </View>
            {isOfflineRoute && (
              <View style={styles.offlinePill}>
                <MaterialIcons name="cloud-off" size={11} color="#92400E" />
                <Text style={styles.offlinePillText}>Cached</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroRoute}>
            {routeAssigned
              ? `Route: ${routeName}`
              : "Waiting for route assignment"}
          </Text>

          {!isLoading && !hasError && routeAssigned && stops.length > 0 && (
            <View style={styles.heroMeta}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>
                  {completedCount} of {stops.length} stops done
                </Text>
                <Text style={styles.progressPct}>{progressPct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${progressPct}%` }]}
                />
              </View>
              <View style={styles.statsStrip}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {completedCount}/{stops.length}
                  </Text>
                  <Text style={styles.statLabel}>Stops</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {totalWeight > 0 ? `${totalWeight}kg` : "—"}
                  </Text>
                  <Text style={styles.statLabel}>Collected</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text
                    style={[
                      styles.statValue,
                      truckCapacity > 85 && { color: "#DC2626" },
                    ]}
                  >
                    {truckCapacity}%
                  </Text>
                  <Text style={styles.statLabel}>Bin Load</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── Loading ── */}
        {isLoading ? renderSkeleton() : null}

        {/* ── Error ── */}
        {!isLoading && hasError ? renderError() : null}

        {/* ── Unassigned ── */}
        {!isLoading && !hasError && !routeAssigned ? renderUnassigned() : null}

        {/* ── All Done ── */}
        {!isLoading &&
        !hasError &&
        routeAssigned &&
        stops.length > 0 &&
        !currentStop
          ? renderAllDone()
          : null}

        {/* ── Current Stop ── */}
        {!isLoading && !hasError && routeAssigned && currentStop ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Current Stop</Text>
            <View style={styles.surface}>
              <Animated.View
                ref={actionRef}
                style={{ transform: [{ scale: successScale }] }}
              >
                <PickupActionCard
                  location={currentStop.name}
                  binCount={currentStop.bins || 3}
                  status={pickupStatus}
                  navigationActive={navActive}
                  onMarkCleaned={handleMarkCleaned}
                  onReportIssue={handleReportIssue}
                />
              </Animated.View>
            </View>
          </View>
        ) : null}

        {/* ── Assigned Route ── */}
        {!isLoading && !hasError && routeAssigned && stops.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Assigned Route</Text>
              <View style={styles.routeNameBadge}>
                <MaterialIcons name="route" size={11} color="#006A3B" />
                <Text style={styles.routeNameBadgeText}>{routeName}</Text>
              </View>
            </View>
            <View style={styles.surface}>
              <RouteTimelineCollector stops={stops} />
            </View>
          </View>
        ) : null}

        {/* ── Collection Log ── */}
        {!isLoading && !hasError && routeAssigned ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Today's Log</Text>
              {totalWeight > 0 ? (
                <Text style={styles.logTotal}>{totalWeight}kg total</Text>
              ) : null}
            </View>
            <View style={styles.surface}>
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

      {/* ── Cleaned overlay ── */}
      {showCleanedConfetti ? (
        <Animated.View
          style={[styles.cleanedOverlay, { opacity: cleanedOpacity }]}
        >
          <View style={styles.cleanedCard}>
            <MaterialIcons name="check-circle" size={52} color="#006A3B" />
            <Text style={styles.cleanedTitle}>Area Cleaned!</Text>
            <Text style={styles.cleanedSub}>System updated successfully</Text>
          </View>
        </Animated.View>
      ) : null}

      {/* EcoAssist AI Chat Modal */}
      <Modal
        visible={showAiAssistant}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowAiAssistant(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View style={styles.aiModalOverlay}>
            <TouchableOpacity
              style={styles.aiModalCloseArea}
              onPress={() => setShowAiAssistant(false)}
            />
            <View style={styles.aiModalContent}>
              {/* Header */}
              <View style={styles.aiHeader}>
                <View style={styles.aiIconCircle}>
                  <MaterialIcons name="psychology" size={28} color="#006A3B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiTitle}>EcoAssist AI</Text>
                  <Text style={styles.aiSubtitle}>
                    Powered by Groq · llama-3.1-8b
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.aiCloseBtn}
                  onPress={() => setShowAiAssistant(false)}
                >
                  <MaterialIcons name="close" size={24} color="#6F7A70" />
                </TouchableOpacity>
              </View>

              {/* Chat messages */}
              <ScrollView
                ref={chatScrollRef}
                style={styles.aiChatScroll}
                contentContainerStyle={styles.aiChatContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() =>
                  chatScrollRef.current?.scrollToEnd({ animated: true })
                }
              >
                {aiMessages.map((msg, i) => (
                  <View
                    key={i}
                    style={[
                      styles.aiBubble,
                      msg.role === "user"
                        ? styles.aiBubbleUser
                        : styles.aiBubbleAI,
                    ]}
                  >
                    <Text
                      style={[
                        styles.aiBubbleText,
                        msg.role === "user" && styles.aiBubbleTextUser,
                      ]}
                    >
                      {msg.content}
                    </Text>
                  </View>
                ))}
                {aiLoading && (
                  <View
                    style={[
                      styles.aiBubble,
                      styles.aiBubbleAI,
                      { paddingVertical: 14 },
                    ]}
                  >
                    <ActivityIndicator size="small" color="#006A3B" />
                  </View>
                )}
              </ScrollView>

              {/* Suggestion chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.aiChipsRow}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
              >
                {[
                  "What's my next stop?",
                  "Any tips for this area?",
                  "How much have I collected?",
                ].map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={styles.aiChip}
                    onPress={() => setAiInput(chip)}
                  >
                    <Text style={styles.aiChipText}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Input row */}
              <View style={styles.aiInputRow}>
                <TextInput
                  style={styles.aiTextInput}
                  value={aiInput}
                  onChangeText={setAiInput}
                  placeholder="Ask anything about your route..."
                  placeholderTextColor="#BECABE"
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={sendAiMessage}
                  editable={!aiLoading}
                />
                <TouchableOpacity
                  style={[
                    styles.aiSendBtn,
                    (!aiInput.trim() || aiLoading) && { opacity: 0.4 },
                  ]}
                  onPress={sendAiMessage}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="send" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* AI Assistant FAB */}
      {!isLoading && !hasError && currentStop ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={openAiModal}
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
  safeArea: { flex: 1, backgroundColor: "#F2F2F7" },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    // Removed flex: 1 so it wraps its own content width
  },
  headerCenter: {
    flex: 1, // Takes up all remaining space between left and right
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    // Removed flex: 1 so it wraps its own content width
  },
  headerLogo: { width: 72, height: 26 },
  collectorBadge: {
    backgroundColor: "#ECFDF5",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  collectorBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#059669",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  truckIdText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.3,
    textAlign: "center", // Ensures it is centered in the available space
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  notifBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#006A3B",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  notifBadgeText: { fontSize: 8, fontWeight: "800", color: "#FFFFFF" },

  // ── Hero ────────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  heroGreeting: { fontSize: 13, color: "#9CA3AF", fontWeight: "500" },
  heroName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  heroRoute: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 6,
    marginBottom: 0,
  },

  heroMeta: { marginTop: 16 },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressLabel: { fontSize: 12, color: "#9CA3AF", fontWeight: "500" },
  progressPct: { fontSize: 12, fontWeight: "700", color: "#006A3B" },
  progressTrack: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 14,
  },
  progressFill: { height: "100%", backgroundColor: "#006A3B", borderRadius: 2 },
  statsStrip: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  statItem: { flex: 1, paddingVertical: 10, alignItems: "center" },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 9,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 2,
    fontWeight: "600",
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },

  offlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  offlinePillText: { fontSize: 10, fontWeight: "700", color: "#92400E" },

  // ── Sections ────────────────────────────────────────────────────────────────
  section: { marginBottom: 0 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  surface: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  routeNameBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  routeNameBadgeText: { fontSize: 11, fontWeight: "700", color: "#006A3B" },

  logTotal: { fontSize: 11, fontWeight: "700", color: "#006A3B" },
  logEmpty: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 20,
  },

  // ── State cards ─────────────────────────────────────────────────────────────
  stateCard: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    padding: 36,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginTop: 4,
  },
  stateSub: {
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 19,
    textAlign: "center",
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ECFDF5",
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
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  retryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  skeletonHero: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    marginBottom: 16,
  },
  skeletonStatsRow: { flexDirection: "row", gap: 10 },
  skeletonSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },

  // ── Cleaned overlay ──────────────────────────────────────────────────────────
  cleanedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  cleanedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 8,
    marginHorizontal: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  },
  cleanedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#006A3B",
    marginTop: 8,
  },
  cleanedSub: { fontSize: 13, color: "#6B7280" },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#006A3B",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 50,
  },

  aiModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  aiModalCloseArea: {
    flex: 1,
  },
  aiModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: "85%",
    minHeight: "60%",
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDED",
    gap: 12,
  },
  aiIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E4EEE9",
    justifyContent: "center",
    alignItems: "center",
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B1C1C",
  },
  aiSubtitle: {
    fontSize: 11,
    color: "#6F7A70",
    fontWeight: "500",
  },
  aiCloseBtn: {
    padding: 4,
  },
  aiChatScroll: {
    flex: 1,
  },
  aiChatContent: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  aiBubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  aiBubbleAI: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F1",
    borderBottomLeftRadius: 4,
  },
  aiBubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "#006A3B",
    borderBottomRightRadius: 4,
  },
  aiBubbleText: {
    fontSize: 14,
    color: "#1B1C1C",
    lineHeight: 20,
  },
  aiBubbleTextUser: {
    color: "#FFFFFF",
  },
  aiChipsRow: {
    maxHeight: 44,
    marginVertical: 8,
  },
  aiChip: {
    backgroundColor: "#F1F5F1",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#D4EAD9",
  },
  aiChipText: {
    fontSize: 12,
    color: "#006A3B",
    fontWeight: "600",
  },
  aiInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    paddingTop: 4,
  },
  aiTextInput: {
    flex: 1,
    backgroundColor: "#F8FAF8",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1B1C1C",
    borderWidth: 1,
    borderColor: "#E8EDE8",
  },
  aiSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#006A3B",
    justifyContent: "center",
    alignItems: "center",
  },

  bottomSpacer: { height: 100 },
});
