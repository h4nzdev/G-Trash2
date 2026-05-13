import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Image,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { io } from "socket.io-client";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";
import colors from "../constants/colors";
import TarsiAssistant from "../components/TarsiAssistant";
import { useTranslation } from "react-i18next";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getDistanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180,
    φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const { width } = Dimensions.get("window");

// Radar pulse speed (ms) and ring color per proximity tier
// Tier 0=idle, 1=trucks online, 2=<1050m, 3=<700m, 4=<350m
const PULSE_DURATIONS = [4200, 2800, 2000, 1300, 800];
const PULSE_RING_COLORS = [
  "#7BA08A",
  "#006A3B",
  "#10B981",
  "#10B981",
  "#F59E0B",
];

// Pre-blended hex equivalents of rgba(0,106,59,α) on #FBF9F8 for chart bar heights [40,55,45,70,60,85,75]
const BAR_COLORS = [
  "#A6C8B8",
  "#8FBCA6",
  "#9EC4B2",
  "#79AF96",
  "#88B7A1",
  "#62A285",
  "#71AA90",
];

const CHECKLIST_ITEMS = [
  { id: 1, label: "Sort general waste into black bag" },
  { id: 2, label: "Sort recyclables (plastic, paper, cans)" },
  { id: 3, label: "Rinse food containers before placing" },
  { id: 4, label: "Tie all bags securely" },
  { id: 5, label: "Place bin at curb by 7:30 AM" },
];

function getGreeting(t) {
  const h = new Date().getHours();
  if (h < 12) return t("good_morning");
  if (h < 17) return t("good_afternoon");
  return t("good_evening");
}

function getTodayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "there";

  const [trucks, setTrucks] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [truckAlertCount, setTruckAlertCount] = useState(0);

  const userLocationRef = useRef(null);
  const truckAlertFiredRef = useRef(new Set());
  const toastTimerRef = useRef(null);

  // Radar pulse animation values
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const pulseAnim3 = useRef(new Animated.Value(0)).current;
  const truckFloatAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop1 = useRef(null);
  const pulseLoop2 = useRef(null);
  const pulseLoop3 = useRef(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [binReady, setBinReady] = useState(false);
  const [checklist, setChecklist] = useState(
    CHECKLIST_ITEMS.map((item) => ({ ...item, checked: false })),
  );

  const fetchDashboard = useCallback(async () => {
    try {
      const today = getTodayYMD();
      const [trucksRes, schedulesRes, reportsRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/trucks`).then((r) => r.json()),
        fetch(`${API_URL}/api/schedules/today?date=${today}`).then((r) =>
          r.json(),
        ),
        fetch(`${API_URL}/api/reports`).then((r) => r.json()),
      ]);

      if (trucksRes.status === "fulfilled" && Array.isArray(trucksRes.value)) {
        // Sort by most recently updated, online first
        const sorted = [...trucksRes.value].sort((a, b) => {
          if (a.status === "online" && b.status !== "online") return -1;
          if (b.status === "online" && a.status !== "online") return 1;
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
        setTrucks(sorted);
      }

      if (
        schedulesRes.status === "fulfilled" &&
        Array.isArray(schedulesRes.value.schedules)
      ) {
        setTodaySchedules(schedulesRes.value.schedules);
      }

      if (
        reportsRes.status === "fulfilled" &&
        Array.isArray(reportsRes.value)
      ) {
        setPendingCount(
          reportsRes.value.filter((r) => r.status !== "resolved").length,
        );
      }
    } catch (err) {
      // silent — dashboard still shows with empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
  }, []);

  // Get last known device location for proximity checks (no new permission dialog)
  useEffect(() => {
    Location.getLastKnownPositionAsync()
      .then((pos) => {
        if (pos) {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          userLocationRef.current = loc;
        }
      })
      .catch(() => {});
  }, []);

  // Real-time truck updates via socket
  useEffect(() => {
    const socket = io(API_URL, { transports: ["polling", "websocket"] });

    socket.on("truck:location:update", ({ truckId, lat, lng }) => {
      setTrucks((prev) => {
        const exists = prev.some((t) => t.truckId === truckId);
        if (exists) {
          return prev.map((t) =>
            t.truckId === truckId
              ? {
                  ...t,
                  lat,
                  lng,
                  status: "online",
                  updatedAt: new Date().toISOString(),
                }
              : t,
          );
        }
        return [
          {
            truckId,
            lat,
            lng,
            status: "online",
            updatedAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });

      // Proximity notification
      const loc = userLocationRef.current;
      if (loc) {
        const distM = getDistanceM(loc.lat, loc.lng, lat, lng);
        if (distM < 350 && !truckAlertFiredRef.current.has(`near-${truckId}`)) {
          truckAlertFiredRef.current.add(`near-${truckId}`);
          setTruckAlertCount((c) => c + 1);
          clearTimeout(toastTimerRef.current);
          setToastMsg(`Truck ${truckId} is very close — prepare your bin!`);
          toastTimerRef.current = setTimeout(() => setToastMsg(null), 5000);
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Garbage Truck Very Close!",
              body: `Truck ${truckId} is nearby — prepare your bin now.`,
              sound: true,
            },
            trigger: null,
          }).catch(() => {});
        } else if (
          distM < 1050 &&
          !truckAlertFiredRef.current.has(`approach-${truckId}`)
        ) {
          truckAlertFiredRef.current.add(`approach-${truckId}`);
          setTruckAlertCount((c) => c + 1);
          clearTimeout(toastTimerRef.current);
          setToastMsg(`Truck ${truckId} is approaching your area.`);
          toastTimerRef.current = setTimeout(() => setToastMsg(null), 5000);
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Garbage Truck Approaching",
              body: `Truck ${truckId} is on its way to your area.`,
              sound: true,
            },
            trigger: null,
          }).catch(() => {});
        }
      }
    });

    socket.on("truck:status", ({ truckId, status }) => {
      setTrucks((prev) =>
        prev.map((t) => (t.truckId === truckId ? { ...t, status } : t)),
      );
      if (status === "offline") {
        truckAlertFiredRef.current.delete(`near-${truckId}`);
        truckAlertFiredRef.current.delete(`approach-${truckId}`);
        clearTimeout(toastTimerRef.current);
        setToastMsg(`Truck ${truckId} has finished collection.`);
        toastTimerRef.current = setTimeout(() => setToastMsg(null), 5000);
        Notifications.scheduleNotificationAsync({
          content: {
            title: "Collection Complete",
            body: `Truck ${truckId} has finished collection in your area.`,
          },
          trigger: null,
        }).catch(() => {});
      }
    });

    return () => {
      socket.disconnect();
      clearTimeout(toastTimerRef.current);
    };
  }, []);

  const onlineTrucks = trucks.filter((t) => t.status === "online");
  const nearestTruck = onlineTrucks[0] || null;
  const firstSchedule = todaySchedules[0] || null;

  // Distance in meters to the nearest online truck (null if no location or truck)
  const distToTruck = useMemo(() => {
    if (!nearestTruck?.lat || !userLocation) return null;
    return Math.round(
      getDistanceM(
        userLocation.lat,
        userLocation.lng,
        nearestTruck.lat,
        nearestTruck.lng,
      ),
    );
  }, [nearestTruck, userLocation]);

  const toggleCheck = (id) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    );
  };

  const allChecked = checklist.every((item) => item.checked);
  const checkedCount = checklist.filter((item) => item.checked).length;

  const handleConfirm = () => {
    setBinReady(true);
    setModalVisible(false);
  };

  const handleOpenModal = () => {
    if (!binReady) setModalVisible(true);
  };

  const handleTrashPickedUp = () => {
    // Reset the full session so the next collection cycle can start fresh
    setBinReady(false);
    setChecklist(CHECKLIST_ITEMS.map((item) => ({ ...item, checked: false })));
    if (nearestTruck) {
      truckAlertFiredRef.current.delete(`near-${nearestTruck.truckId}`);
      truckAlertFiredRef.current.delete(`approach-${nearestTruck.truckId}`);
    }
    clearTimeout(toastTimerRef.current);
    setToastMsg("✓ Trash collected — thank you for participating!");
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 5000);
    Notifications.scheduleNotificationAsync({
      content: {
        title: "Trash Collected!",
        body: "Your trash has been successfully picked up. See you next collection!",
        sound: true,
      },
      trigger: null,
    }).catch(() => {});
  };

  const handleCancelTracking = () => {
    setBinReady(false);
    setChecklist(CHECKLIST_ITEMS.map((item) => ({ ...item, checked: false })));
  };

  // Zone visual driven by real distance when available
  const zoneData = useMemo(() => {
    let z1Label = nearestTruck ? t("live") : t("no_trucks_active");
    let z2Label = onlineTrucks.length > 0 ? t("approaching") : "—";
    let z3Label = onlineTrucks.length === 0 ? t("no_trucks_active") : t("area");
    if (distToTruck != null) {
      if (distToTruck < 350) {
        z1Label = t("very_close");
        z2Label = t("passed");
        z3Label = t("passed");
      } else if (distToTruck < 700) {
        z1Label = `${distToTruck}m away`;
        z2Label = t("nearby");
        z3Label = t("area");
      } else if (distToTruck < 1050) {
        z1Label = t("approaching");
        z2Label = `${distToTruck}m`;
        z3Label = t("area");
      }
    }
    return [
      {
        name: `${t("zone")} 3`,
        distance: z3Label,
        icon: "location-on",
        highlighted: false,
      },
      {
        name: `${t("zone")} 2`,
        distance: z2Label,
        icon: "location-on",
        highlighted: false,
      },
      {
        name: `${t("zone")} 1`,
        distance: z1Label,
        icon: nearestTruck ? "check-circle" : "location-off",
        highlighted: !!nearestTruck,
      },
    ];
  }, [nearestTruck, onlineTrucks.length, distToTruck, t]);

  const tarsiData = useMemo(() => {
    const hour = new Date().getHours();
    
    // SUCCESS: User has prepared the bin
    if (binReady) {
      return {
        insight: t("tarsi_bin_ready", { count: 12 }),
        variant: "celebrate"
      };
    }

    // URGENT: Truck is extremely close
    if (distToTruck !== null && distToTruck < 350) {
      return {
        insight: t("tarsi_urgent"),
        variant: "worrying"
      };
    }
    
    // ALERT: Truck is nearby
    if (distToTruck !== null && distToTruck < 1000) {
      const mins = Math.ceil(distToTruck / 200);
      return {
        insight: t("tarsi_approaching", { dist: distToTruck, mins }),
        variant: "urgent"
      };
    }

    // ACTIVE: Trucks are in the city
    if (onlineTrucks.length > 0) {
      return {
        insight: t("tarsi_active", { count: onlineTrucks.length }),
        variant: "default"
      };
    }

    // SCHEDULED: Nothing live, but something planned
    if (firstSchedule) {
      return {
        insight: t("tarsi_scheduled", { route: firstSchedule.routeName }),
        variant: "default"
      };
    }

    // IDLE: No activity
    if (hour < 10) {
      return {
        insight: t("tarsi_morning"),
        variant: "default"
      };
    }
    
    if (hour > 18) {
      return {
        insight: t("tarsi_evening"),
        variant: "default"
      };
    }

    return {
      insight: t("tarsi_idle"),
      variant: "default"
    };
  }, [distToTruck, onlineTrucks.length, firstSchedule, binReady, t]);

  const pulseTier = useMemo(() => {
    if (distToTruck !== null) {
      if (distToTruck < 350) return 4;
      if (distToTruck < 700) return 3;
      if (distToTruck < 1050) return 2;
    }
    if (onlineTrucks.length > 0) return 1;
    return 0;
  }, [distToTruck, onlineTrucks.length]);

  // Zone 1 (< 350 m) is the only layer where pickup can be confirmed
  const inZone1 = distToTruck !== null && distToTruck < 350;

  // Restart radar rings whenever the proximity tier changes
  useEffect(() => {
    const duration = PULSE_DURATIONS[pulseTier];
    const stagger = Math.floor(duration / 3);

    pulseLoop1.current?.stop();
    pulseLoop2.current?.stop();
    pulseLoop3.current?.stop();
    pulseAnim1.setValue(0);
    pulseAnim2.setValue(0);
    pulseAnim3.setValue(0);

    const makeLoop = (anim, delay) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: Math.floor(duration * 0.82),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.delay(Math.floor(duration * 0.18)),
          ]),
        ),
      ]);

    pulseLoop1.current = makeLoop(pulseAnim1, 0);
    pulseLoop2.current = makeLoop(pulseAnim2, stagger);
    pulseLoop3.current = makeLoop(pulseAnim3, stagger * 2);
    pulseLoop1.current.start();
    pulseLoop2.current.start();
    pulseLoop3.current.start();

    return () => {
      pulseLoop1.current?.stop();
      pulseLoop2.current?.stop();
      pulseLoop3.current?.stop();
    };
  }, [pulseTier]);

  // Truck marker float — runs continuously
  useEffect(() => {
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(truckFloatAnim, {
          toValue: -6,
          duration: 1700,
          useNativeDriver: true,
        }),
        Animated.timing(truckFloatAnim, {
          toValue: 0,
          duration: 1700,
          useNativeDriver: true,
        }),
      ]),
    );
    float.start();
    return () => float.stop();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Proximity toast — overlays at the top */}
      {toastMsg && (
        <View style={styles.proximityToast}>
          <MaterialIcons name="local-shipping" size={16} color="#FFFFFF" />
          <Text style={styles.proximityToastText} numberOfLines={2}>
            {toastMsg}
          </Text>
        </View>
      )}

      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
        <TouchableOpacity
          style={styles.notificationBtn}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Ionicons name="notifications-outline" size={24} color="#6B7280" />
          {pendingCount + truckAlertCount > 0 && (
            <View style={styles.badge}>
              {pendingCount + truckAlertCount <= 9 && (
                <Text style={styles.badgeText}>
                  {pendingCount + truckAlertCount}
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ── NORMAL VIEW ─────────────────────────────────────── */}
        {!binReady && (
        <>
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>
            {getGreeting(t)}, {firstName}!
          </Text>
          <Text style={styles.subtitle}>
            {onlineTrucks.length > 0
              ? t("trucks_active", { count: onlineTrucks.length })
              : t("no_trucks_active")}
          </Text>
        </View>

        {/* Tarsi mascot assistant — anchored to a green divider, contextual insight */}
        <TarsiAssistant 
          insight={tarsiData.insight} 
          variant={tarsiData.variant} 
        />

        {/* Bento Grid Cards */}
        <View style={styles.cardGrid}>
          {/* Air Quality Card (decorative — no sensor backend yet) */}
          <View style={styles.airQualityCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>{t("air_quality")}</Text>
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Moderate</Text>
                </View>
              </View>
              <MaterialIcons name="air" size={28} color="#6B7280" />
            </View>

            {/* Mini Chart */}
            <View style={styles.chartContainer}>
              {[40, 55, 45, 70, 60, 85, 75].map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.chartBar,
                    { height: h, backgroundColor: BAR_COLORS[i] },
                  ]}
                />
              ))}
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Ammonia</Text>
                <Text style={styles.metricValue}>12 ppm</Text>
              </View>
              <View style={[styles.metricItem, styles.metricDivider]}>
                <Text style={styles.metricLabel}>Methane</Text>
                <Text style={styles.metricValue}>0.8%</Text>
              </View>
            </View>
          </View>

          {/* Upcoming Collection Card */}
          <View style={styles.collectionCard}>
            <View style={styles.collectionContent}>
              <View style={styles.collectionHeader}>
                <View style={styles.truckIconContainer}>
                  <MaterialIcons
                    name="local-shipping"
                    size={24}
                    color="#FFFFFF"
                  />
                </View>
                <View>
                  <Text style={styles.collectionLabel}>
                    {t("upcoming_collection")}
                  </Text>
                  {isLoading ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                      style={{ marginTop: 4 }}
                    />
                  ) : firstSchedule ? (
                    <Text style={styles.collectionTime}>
                      Today · {firstSchedule.routeName || "Scheduled"}
                    </Text>
                  ) : nearestTruck ? (
                    <Text style={styles.collectionTime}>
                      Live · Truck {nearestTruck.truckId} Nearby
                    </Text>
                  ) : (
                    <Text style={styles.collectionTime}>
                      No active collection
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.collectionDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Route / Status</Text>
                  <Text style={styles.detailValue}>
                    {firstSchedule?.routeName || (nearestTruck ? "Collection in Progress" : "No Activity")}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Assigned Unit</Text>
                  <Text style={styles.detailValue}>
                    {firstSchedule?.truckId || nearestTruck?.truckId || "—"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.prepareButton,
                  (binReady) ? styles.trackLiveButton : ((!firstSchedule && !nearestTruck) && styles.prepareButtonReady),
                ]}
                onPress={binReady ? () => navigation.navigate("Map", { focusTruck: true }) : ((firstSchedule || nearestTruck) ? handleOpenModal : undefined)}
                activeOpacity={(firstSchedule || nearestTruck || binReady) ? 0.8 : 1}
              >
                <View style={styles.prepareButtonInner}>
                  <MaterialIcons
                    name={binReady ? "map" : "delete-outline"}
                    size={18}
                    color={binReady ? "#FFFFFF" : "#006A3B"}
                  />
                  <Text style={[styles.prepareButtonText, binReady && { color: '#FFFFFF' }]}>
                    {binReady
                      ? t("track_live")
                      : (firstSchedule || nearestTruck)
                        ? t("prepare_bin")
                        : t("no_activity")}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.decorativeIcon}>
              <MaterialIcons name="recycling" size={80} color="#1D6B39" />
            </View>
          </View>
        </View>

        {/* Truck Status Section */}
        <View style={styles.truckStatusSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("truck_status")}</Text>
            <View style={styles.liveBadge}>
              <View
                style={[styles.liveDot, !nearestTruck && styles.liveDotOff]}
              />
              <Text style={styles.liveText}>
                {nearestTruck ? t("live") : t("offline")}
              </Text>
            </View>
          </View>

          <View style={styles.truckStatusCard}>
            {/* Zone Progress */}
            <View style={styles.zoneContainer}>
              <View style={styles.progressLine} />
              {zoneData.map((zone, index) => (
                <View key={index} style={styles.zoneItem}>
                  <View
                    style={[
                      styles.zoneCircle,
                      zone.highlighted && styles.zoneCircleHighlighted,
                    ]}
                  >
                    <MaterialIcons
                      name={zone.icon}
                      size={zone.highlighted ? 28 : 20}
                      color={zone.highlighted ? "#FFFFFF" : "#6B7280"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.zoneName,
                      zone.highlighted && styles.zoneNameHighlighted,
                    ]}
                  >
                    {zone.name}
                  </Text>
                  <Text
                    style={[
                      styles.zoneDistance,
                      zone.highlighted && styles.zoneDistanceHighlighted,
                    ]}
                  >
                    {zone.distance}
                  </Text>
                </View>
              ))}
            </View>

            {/* Truck Info Card */}
            {isLoading ? (
              <View
                style={[styles.truckInfoCard, { justifyContent: "center" }]}
              >
                <ActivityIndicator size="small" color="#006A3B" />
              </View>
            ) : nearestTruck ? (
              <View style={styles.truckInfoCard}>
                <View style={styles.truckImagePlaceholder}>
                  <MaterialIcons
                    name="local-shipping"
                    size={32}
                    color="#047857"
                  />
                </View>
                <View style={styles.truckDetails}>
                  <Text style={styles.truckTitle}>
                    Truck {nearestTruck.truckId} is active
                  </Text>
                  <Text style={styles.truckEstimate}>
                    {distToTruck != null
                      ? distToTruck < 350
                        ? "Very close — prepare your bin!"
                        : distToTruck < 700
                          ? `~${distToTruck}m from you`
                          : distToTruck < 1050
                            ? "Approaching your area"
                            : "Active in your area"
                      : `${onlineTrucks.length} truck${onlineTrucks.length > 1 ? "s" : ""} online`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.mapButton}
                  onPress={() => navigation.navigate("Map")}
                >
                  <MaterialIcons name="map" size={20} color="#00731E" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.truckInfoCard}>
                <View
                  style={[
                    styles.truckImagePlaceholder,
                    { backgroundColor: "#F0EDED" },
                  ]}
                >
                  <MaterialIcons
                    name="local-shipping"
                    size={32}
                    color="#BECABE"
                  />
                </View>
                <View style={styles.truckDetails}>
                  <Text style={[styles.truckTitle, { color: "#6B7280" }]}>
                    No trucks active
                  </Text>
                  <Text style={styles.truckEstimate}>Check back later</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Quick Report Section */}
        <View style={styles.quickReportSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Report an Issue</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Report")}>
              <Text style={styles.viewAllText}>New Report</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.quickReportCard}>
            <View style={styles.quickReportInfo}>
              <Text style={styles.quickReportTitle}>See a trash problem?</Text>
              <Text style={styles.quickReportSubtitle}>
                Report it now to help keep the community clean.
              </Text>
              <TouchableOpacity
                style={styles.reportNowBtn}
                onPress={() => navigation.navigate("Report")}
              >
                <Text style={styles.reportNowBtnText}>Report Now</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.quickReportIcon}>
              <MaterialIcons name="add-a-photo" size={48} color="#BA1A1A" />
            </View>
          </View>
        </View>

        {/* Map Preview */}
        <TouchableOpacity
          style={styles.mapPreview}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("Map")}
        >
          {/* Radar rings + truck marker */}
          <View style={styles.mapPlaceholder}>
            {[pulseAnim1, pulseAnim2, pulseAnim3].map((anim, i) => {
              const ringScale = anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.12, 1.55],
              });
              const ringOpacity = anim.interpolate({
                inputRange: [0, 0.08, 0.55, 1],
                outputRange: [0, 0.9, 0.35, 0],
              });
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.radarRing,
                    {
                      borderColor: PULSE_RING_COLORS[pulseTier],
                      opacity: ringOpacity,
                      transform: [{ scale: ringScale }],
                    },
                  ]}
                />
              );
            })}

            {/* Center dot — your location */}
            <View style={styles.radarCenter} />

            {/* Truck marker — floats when visible */}
            <Animated.View
              style={[
                styles.radarTruckMarker,
                {
                  opacity: nearestTruck ? 1 : 0.28,
                  transform: [{ translateY: truckFloatAnim }],
                },
              ]}
            >
              <MaterialIcons name="local-shipping" size={18} color="#FFFFFF" />
            </Animated.View>
          </View>

          {/* Live / Offline badge — top left */}
          <View
            style={[
              styles.radarLiveBadge,
              !nearestTruck && styles.radarLiveBadgeOff,
            ]}
          >
            <View
              style={[
                styles.radarLiveDot,
                !nearestTruck && styles.radarLiveDotOff,
              ]}
            />
            <Text style={styles.radarLiveText}>
              {nearestTruck ? "LIVE" : "OFFLINE"}
            </Text>
          </View>

          {/* Distance / status — bottom left */}
          <View style={styles.mapOverlay}>
            <MaterialIcons name="my-location" size={16} color="#00731E" />
            <Text style={styles.mapAddress}>
              {distToTruck !== null
                ? distToTruck < 350
                  ? "Very close — prepare now!"
                  : distToTruck < 700
                    ? `${distToTruck}m away`
                    : `${nearestTruck?.truckId} approaching`
                : nearestTruck
                  ? `Truck ${nearestTruck.truckId}`
                  : "No active trucks"}
            </Text>
          </View>

          <View style={styles.mapViewBadge}>
            <Text style={styles.mapViewBadgeText}>Tap to view full map</Text>
          </View>
        </TouchableOpacity>
        </>
        )}

        {/* ── TRACKING MODE — shown when bin is marked ready ─── */}
        {binReady && (
        <>
          {/* Status banner */}
          <View style={styles.trackingBanner}>
            <View style={styles.trackingBannerLeft}>
              <View style={styles.trackingLiveDot} />
              <View>
                <Text style={styles.trackingTitle}>Bin Ready · Tracking Live</Text>
                <Text style={styles.trackingSubtitle}>
                  {nearestTruck
                    ? `Truck ${nearestTruck.truckId} is active`
                    : "Waiting for truck…"}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.trackingZonePill,
                inZone1 && styles.trackingZonePillActive,
              ]}
            >
              <Text style={styles.trackingZonePillText}>
                {inZone1
                  ? "ZONE 1 ✓"
                  : pulseTier === 3
                  ? "ZONE 2"
                  : pulseTier === 2
                  ? "ZONE 3"
                  : "—"}
              </Text>
            </View>
          </View>

          {/* Large distance number */}
          <View style={styles.distanceDisplay}>
            <Text
              style={[
                styles.distanceNumber,
                inZone1 && { color: "#059669" },
              ]}
            >
              {distToTruck != null ? `${distToTruck}m` : "—"}
            </Text>
            <Text style={styles.distanceLabel}>distance to nearest truck</Text>
            {distToTruck != null && (
              <View
                style={[
                  styles.distanceZoneBadge,
                  inZone1 && styles.distanceZoneBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.distanceZoneBadgeText,
                    inZone1 && { color: "#065F46" },
                  ]}
                >
                  {inZone1
                    ? "✓ Zone 1 reached — truck is very close!"
                    : `${distToTruck - 350}m more until Zone 1 unlocks`}
                </Text>
              </View>
            )}
          </View>

          {/* Zone progress circles */}
          <View style={[styles.truckStatusCard, { marginBottom: 20 }]}>
            <View style={styles.zoneContainer}>
              <View style={styles.progressLine} />
              {zoneData.map((zone, index) => (
                <View key={index} style={styles.zoneItem}>
                  <View
                    style={[
                      styles.zoneCircle,
                      zone.highlighted && styles.zoneCircleHighlighted,
                    ]}
                  >
                    <MaterialIcons
                      name={zone.icon}
                      size={zone.highlighted ? 28 : 20}
                      color={zone.highlighted ? "#FFFFFF" : "#6B7280"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.zoneName,
                      zone.highlighted && styles.zoneNameHighlighted,
                    ]}
                  >
                    {zone.name}
                  </Text>
                  <Text
                    style={[
                      styles.zoneDistance,
                      zone.highlighted && styles.zoneDistanceHighlighted,
                    ]}
                  >
                    {zone.distance}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Radar map */}
          <TouchableOpacity
            style={[styles.mapPreview, { height: 220, marginBottom: 24 }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("Map")}
          >
            <View style={styles.mapPlaceholder}>
              {[pulseAnim1, pulseAnim2, pulseAnim3].map((anim, i) => {
                const ringScale = anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.12, 1.55],
                });
                const ringOpacity = anim.interpolate({
                  inputRange: [0, 0.08, 0.55, 1],
                  outputRange: [0, 0.9, 0.35, 0],
                });
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.radarRing,
                      {
                        borderColor: PULSE_RING_COLORS[pulseTier],
                        opacity: ringOpacity,
                        transform: [{ scale: ringScale }],
                      },
                    ]}
                  />
                );
              })}
              <View style={styles.radarCenter} />
              <Animated.View
                style={[
                  styles.radarTruckMarker,
                  {
                    opacity: nearestTruck ? 1 : 0.28,
                    transform: [{ translateY: truckFloatAnim }],
                  },
                ]}
              >
                <MaterialIcons name="local-shipping" size={18} color="#FFFFFF" />
              </Animated.View>
            </View>
            <View
              style={[
                styles.radarLiveBadge,
                !nearestTruck && styles.radarLiveBadgeOff,
              ]}
            >
              <View
                style={[
                  styles.radarLiveDot,
                  !nearestTruck && styles.radarLiveDotOff,
                ]}
              />
              <Text style={styles.radarLiveText}>
                {nearestTruck ? "LIVE" : "OFFLINE"}
              </Text>
            </View>
            <View style={styles.mapViewBadge}>
              <Text style={styles.mapViewBadgeText}>Tap for full map</Text>
            </View>
          </TouchableOpacity>

          {/* Trash Picked Up — gated to Zone 1 */}
          <TouchableOpacity
            style={[
              styles.pickedUpBtn,
              !inZone1 && styles.pickedUpBtnDisabled,
            ]}
            onPress={inZone1 ? handleTrashPickedUp : undefined}
            activeOpacity={inZone1 ? 0.85 : 1}
          >
            <MaterialIcons
              name="check-circle"
              size={22}
              color={inZone1 ? "#FFFFFF" : "#9CA3AF"}
            />
            <Text
              style={[
                styles.pickedUpBtnText,
                !inZone1 && styles.pickedUpBtnTextDisabled,
              ]}
            >
              Trash Picked Up
            </Text>
          </TouchableOpacity>

          <Text style={styles.zoneHint}>
            {inZone1
              ? "Tap above to confirm your trash was collected"
              : distToTruck != null
              ? `Unlocks in Zone 1 · need < 350m (${distToTruck}m now)`
              : "Unlocks when truck enters Zone 1 (< 350m from you)"}
          </Text>

          <TouchableOpacity
            onPress={handleCancelTracking}
            style={styles.cancelTrackingBtn}
          >
            <Text style={styles.cancelTrackingText}>Cancel Tracking</Text>
          </TouchableOpacity>
        </>
        )}
      </ScrollView>

      {/* Bin Prep Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalTitleRow}>
              <View style={styles.modalIconWrap}>
                <MaterialIcons
                  name="delete-outline"
                  size={22}
                  color="#006A3B"
                />
              </View>
              <View>
                <Text style={styles.modalTitle}>Prepare Your Bin</Text>
                <Text style={styles.modalSubtitle}>
                  {firstSchedule
                    ? `Collection Today · ${firstSchedule.routeName || "Scheduled"}`
                    : "Bin preparation checklist"}
                </Text>
              </View>
            </View>

            {checklist.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.checklistItem,
                  index === checklist.length - 1 && styles.checklistItemLast,
                ]}
                onPress={() => toggleCheck(item.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    item.checked && styles.checkboxChecked,
                  ]}
                >
                  {item.checked && (
                    <MaterialIcons name="check" size={14} color="#FFFFFF" />
                  )}
                </View>
                <Text
                  style={[
                    styles.checklistLabel,
                    item.checked && styles.checklistLabelDone,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(checkedCount / checklist.length) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {checkedCount} of {checklist.length} items ready
            </Text>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                !allChecked && styles.confirmBtnDisabled,
              ]}
              onPress={allChecked ? handleConfirm : undefined}
              activeOpacity={allChecked ? 0.85 : 1}
            >
              <Text style={styles.confirmBtnText}>
                {allChecked
                  ? "Mark Bin as Ready"
                  : "Check all items to confirm"}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF9F8",
  },
  fixedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerLogo: {
    width: 90,
    height: 36,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },
  greeting: {
    fontSize: 34,
    fontWeight: "700",
    color: "#1B1C1C",
    letterSpacing: -0.4,
    lineHeight: 41,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 4,
    lineHeight: 20,
  },
  cardGrid: {
    gap: 12,
    marginBottom: 32,
  },
  airQualityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B1C1C",
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F5A623",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400E",
  },
  chartContainer: {
    height: 96,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 4,
    marginTop: 16,
  },
  chartBar: {
    flex: 1,
    borderRadius: 8,
  },
  metricsRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "#D1D5DB",
    paddingLeft: 16,
  },
  metricLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1B1C1C",
  },
  collectionCard: {
    backgroundColor: "#006A3B",
    borderRadius: 24,
    padding: 16,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 5,
    overflow: "hidden",
  },
  collectionContent: {
    zIndex: 1,
  },
  collectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  truckIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#338862",
    justifyContent: "center",
    alignItems: "center",
  },
  collectionLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#CCE1D8",
  },
  collectionTime: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  collectionDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#19784E",
  },
  detailLabel: {
    fontSize: 13,
    color: "#B3D2C4",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  prepareButton: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    alignItems: "center",
  },
  prepareButtonReady: {
    backgroundColor: "#D9E9E2",
  },
  trackLiveButton: {
    backgroundColor: "#059669",
    borderColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  prepareButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  prepareButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#006A3B",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 24,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E4EEE9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1B1C1C",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  checklistItemLast: {
    borderBottomWidth: 0,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#006A3B",
    borderColor: "#006A3B",
  },
  checklistLabel: {
    flex: 1,
    fontSize: 15,
    color: "#1B1C1C",
    lineHeight: 22,
  },
  checklistLabelDone: {
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    marginTop: 20,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    backgroundColor: "#006A3B",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 4,
  },
  confirmBtn: {
    backgroundColor: "#006A3B",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },
  confirmBtnDisabled: {
    backgroundColor: "#6DA880",
  },
  confirmBtnText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  decorativeIcon: {
    position: "absolute",
    right: -16,
    bottom: -16,
    opacity: 0.15,
  },
  truckStatusSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B1C1C",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  liveDotOff: {
    backgroundColor: "#BECABE",
  },
  liveText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#006A3B",
  },
  truckStatusCard: {
    backgroundColor: "#F0EDED",
    borderRadius: 24,
    padding: 24,
  },
  zoneContainer: {
    position: "relative",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  progressLine: {
    position: "absolute",
    left: 40,
    right: 40,
    height: 2,
    backgroundColor: "#BECABE",
    top: 20,
  },
  zoneItem: {
    alignItems: "center",
    gap: 8,
    zIndex: 1,
  },
  zoneCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 4,
    borderColor: "#F0EDED",
    justifyContent: "center",
    alignItems: "center",
  },
  zoneCircleHighlighted: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#006E1C",
    borderWidth: 4,
    borderColor: "#86D896",
  },
  zoneName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  zoneNameHighlighted: {
    color: "#006E1C",
    fontWeight: "700",
  },
  zoneDistance: {
    fontSize: 10,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  zoneDistanceHighlighted: {
    color: "#006E1C",
    fontWeight: "900",
    letterSpacing: 2,
  },
  truckInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBF9F8",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  truckImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  truckDetails: {
    flex: 1,
  },
  truckTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B1C1C",
  },
  truckEstimate: {
    fontSize: 13,
    color: "#6B7280",
  },
  mapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E6F8E2",
    justifyContent: "center",
    alignItems: "center",
  },
  mapPreview: {
    height: 192,
    borderRadius: 24,
    backgroundColor: "#D4EDDA",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#AAD3BA",
    position: "relative",
    marginBottom: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  radarRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  radarCenter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#006A3B",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    elevation: 4,
    zIndex: 2,
  },
  radarTruckMarker: {
    position: "absolute",
    top: 32,
    right: 48,
    backgroundColor: "#006A3B",
    padding: 7,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    elevation: 6,
    zIndex: 3,
  },
  radarLiveBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#006A3B",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  radarLiveBadgeOff: {
    backgroundColor: "#6B7280",
  },
  radarLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#86EFAC",
  },
  radarLiveDotOff: {
    backgroundColor: "#D1D5DB",
  },
  radarLiveText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  mapViewBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "#3F4941",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  mapViewBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  mapOverlay: {
    position: "absolute",
    bottom: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mapAddress: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1B1C1C",
  },
  quickReportSection: {
    marginBottom: 32,
  },
  quickReportCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0EDED",
  },
  quickReportInfo: {
    flex: 1,
  },
  quickReportTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1B1C1C",
    marginBottom: 4,
  },
  quickReportSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
    lineHeight: 18,
  },
  reportNowBtn: {
    backgroundColor: "#BA1A1A",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  reportNowBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  quickReportIcon: {
    width: 80,
    height: 80,
    backgroundColor: "#FFDAD6",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: "#006A3B",
    fontWeight: "600",
  },
  proximityToast: {
    position: "absolute",
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: "#006A3B",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 999,
  },
  proximityToastText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
  },
  greetingSection: {
    marginBottom: 20,
  },

  // ── Tracking mode ────────────────────────────────────
  trackingBanner: {
    backgroundColor: "#006A3B",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  trackingBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  trackingLiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#86EFAC",
  },
  trackingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  trackingSubtitle: {
    fontSize: 12,
    color: "#A7F3D0",
    marginTop: 2,
  },
  trackingZonePill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  trackingZonePillActive: {
    backgroundColor: "#059669",
  },
  trackingZonePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  distanceDisplay: {
    backgroundColor: "#F0EDED",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  distanceNumber: {
    fontSize: 64,
    fontWeight: "800",
    color: "#006A3B",
    letterSpacing: -3,
    lineHeight: 72,
  },
  distanceLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    marginBottom: 12,
  },
  distanceZoneBadge: {
    backgroundColor: "#E5E7EB",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  distanceZoneBadgeActive: {
    backgroundColor: "#D1FAE5",
  },
  distanceZoneBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  pickedUpBtn: {
    backgroundColor: "#006A3B",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  pickedUpBtnDisabled: {
    backgroundColor: "#E5E7EB",
    shadowOpacity: 0,
    elevation: 0,
  },
  pickedUpBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  pickedUpBtnTextDisabled: {
    color: "#9CA3AF",
  },
  zoneHint: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  cancelTrackingBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 40,
  },
  cancelTrackingText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "500",
  },
});
