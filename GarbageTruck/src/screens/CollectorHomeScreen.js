import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import API_URL from "../config";
import * as ImagePicker from 'expo-image-picker';

import NetworkBanner from "../components/NetworkBanner";
import colors from "../constants/colors";

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

// Formats a stop schedule time from a zero-based index (08:00, 08:45, 09:30, …)
function formatStopTime(index) {
  const totalMinutes = 8 * 60 + index * 45;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CollectorHomeScreen() {
  const { user, unreadCount, clearUnread } = useAuth();
  const { networkChangeKey } = useNetwork();
  const navigation = useNavigation();
  const TRUCK_ID = user?.truckId ?? "GT-000";
  const driverName = user?.driverName ?? "Collector";

  const [todaySchedules, setTodaySchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shiftActive, setShiftActive] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatScrollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // --- Before/After Clearance Flow States ---
  const MOCK_BEFORE_IMAGE = "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=600&q=80";
  const MOCK_AFTER_IMAGE = "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=600&q=80";

  const [activeFlowTask, setActiveFlowTask] = useState(null); // { scheduleId, sitioName, routeName, step }
  const [beforeImage, setBeforeImage] = useState("");
  const [afterImage, setAfterImage] = useState("");
  const [flowStatus, setFlowStatus] = useState("clean");
  const [flowLocation, setFlowLocation] = useState("");
  const [flowWasteType, setFlowWasteType] = useState("General");
  const [flowBins, setFlowBins] = useState(1);
  const [isSubmittingFlow, setIsSubmittingFlow] = useState(false);
  
  // Basic report within task flow
  const [showBasicReportModal, setShowBasicReportModal] = useState(false);
  const [basicReportNotes, setBasicReportNotes] = useState("");
  const [basicReportCategory, setBasicReportCategory] = useState("Other");
  const [submittingBasicReport, setSubmittingBasicReport] = useState(false);

  // Restore shift state from local storage on mount
  useEffect(() => {
    AsyncStorage.getItem("@truck_shift_active")
      .then((val) => {
        // Only set true if schedule validation passes
        if (val === "true" && todaySchedules.length > 0) {
          setShiftActive(true);
        } else {
          setShiftActive(false);
        }
      })
      .catch(() => {});
  }, [todaySchedules.length]);

  // Fetch today's schedule for this truck
  const fetchScheduleData = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const xhr = new XMLHttpRequest();
    xhr.open("GET", `${API_URL}/api/schedules/truck/${TRUCK_ID}/today?date=${today}`);
    xhr.timeout = 8000;
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const { schedules } = JSON.parse(xhr.responseText);
          const list = Array.isArray(schedules) ? schedules : [];
          setTodaySchedules(list);
          if (list.length === 0) {
            // No schedule for today -> reset shift state to default "Waiting for Schedule"
            setShiftActive(false);
            AsyncStorage.setItem("@truck_shift_active", "false").catch(() => {});
            AsyncStorage.setItem("@truck_nav_active", "false").catch(() => {});
          } else {
            // Check shift status from AsyncStorage
            AsyncStorage.getItem("@truck_shift_active").then((val) => {
              setShiftActive(val === "true");
            }).catch(() => {});
          }
        } catch (_) {
          setTodaySchedules([]);
          setShiftActive(false);
        }
      } else {
        setTodaySchedules([]);
        setShiftActive(false);
      }
      setIsLoading(false);
    };
    xhr.onerror = () => { setHasError(true); setIsLoading(false); };
    xhr.ontimeout = () => { setHasError(true); setIsLoading(false); };
    xhr.send();
  }, [TRUCK_ID]);

  // Refresh on focus and synchronize shift status
  useFocusEffect(
    useCallback(() => {
      fetchScheduleData();
      AsyncStorage.getItem("@truck_shift_active").then((val) => {
        setShiftActive(val === "true");
      }).catch(() => {});
    }, [fetchScheduleData]),
  );

  // Socket: re-fetch when an official assigns a new schedule to this truck or priority updates
  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket", "polling"] });
    socket.on("schedule:changed", ({ truckId }) => {
      if (truckId?.toUpperCase() === TRUCK_ID?.toUpperCase()) fetchScheduleData();
    });
    socket.on("priority:update", ({ truckId }) => {
      if (!truckId || truckId?.toUpperCase() === TRUCK_ID?.toUpperCase()) fetchScheduleData();
    });
    return () => socket.disconnect();
  }, [TRUCK_ID, fetchScheduleData, networkChangeKey]);

  // Loading animation
  useEffect(() => {
    if (!isLoading) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLoading]);

  // Navigate to Map Collector screen to start/manage shift
  const goToMap = () => {
    navigation.navigate("Map");
  };

  // Toggle single schedule completed (Todo List item)
  const toggleScheduleComplete = (id, currentStatus, routeName = "Collection Duty", sitioName = "Depot") => {
    if (currentStatus === "completed") return; // No-op if already complete
    
    // Reset state for new flow
    setBeforeImage("");
    setAfterImage("");
    setFlowStatus("clean");
    setFlowLocation(`${sitioName}`);
    setFlowWasteType("General");
    setFlowBins(1);
    
    setActiveFlowTask({
      scheduleId: id,
      sitioName,
      routeName,
      step: 'options'
    });
  };

  // Toggle specific sitio task completed inside a sequential schedule
  const toggleTaskComplete = (scheduleId, sitioName, isCompleted, routeName = "Collection Duty") => {
    if (isCompleted) return; // No-op if already complete
    
    // Reset state for new flow
    setBeforeImage("");
    setAfterImage("");
    setFlowStatus("clean");
    setFlowLocation(`${sitioName}`);
    setFlowWasteType("General");
    setFlowBins(1);
    
    setActiveFlowTask({
      scheduleId,
      sitioName,
      routeName,
      step: 'options'
    });
  };

  // Helper to request camera and snap photo (hybrid with mock camera)
  const takePhotoStep = async (type) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status === 'granted') {
        let result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.6,
          base64: true,
        });
        if (!result.canceled) {
          const imgBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
          if (type === 'before') {
            setBeforeImage(imgBase64);
          } else {
            setAfterImage(imgBase64);
          }
          return;
        }
      }
    } catch (e) {
      console.warn("Camera error:", e);
    }
    
    // Fallback placeholder mock image URLs if camera permission is denied or emulator
    if (type === 'before') {
      setBeforeImage(MOCK_BEFORE_IMAGE);
    } else {
      setAfterImage(MOCK_AFTER_IMAGE);
    }
  };

  // Helper to submit the basic report
  const submitBasicReportFlow = () => {
    if (!activeFlowTask) return;
    setSubmittingBasicReport(true);
    
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/reports`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = () => {
      setSubmittingBasicReport(false);
      if (xhr.status === 201) {
        Alert.alert("Success", "Basic hazard report submitted successfully.");
        setBasicReportNotes("");
        setBasicReportCategory("Other");
        setShowBasicReportModal(false);
        setActiveFlowTask(null);
      } else {
        Alert.alert("Error", "Could not submit report.");
      }
    };
    xhr.onerror = () => {
      setSubmittingBasicReport(false);
      Alert.alert("Error", "Network connection failed.");
    };
    
    xhr.send(JSON.stringify({
      category: basicReportCategory,
      description: basicReportNotes || `Issue reported at ${activeFlowTask.sitioName}`,
      location: activeFlowTask.sitioName,
      reportedBy: driverName,
      truckId: TRUCK_ID,
    }));
  };

  const notifyClearingStatus = (sitioName, status = 'clearing') => {
    if (!sitioName) return;
    fetch(`${API_URL}/api/schedules/clearing-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        truckId: TRUCK_ID,
        driverName: driverName || 'Collector',
        barangay: activeFlowTask?.barangay || assignedBarangay || 'Apas',
        sitioName,
        status,
        lat: currentLocation?.latitude || null,
        lng: currentLocation?.longitude || null,
      }),
    }).catch(() => {});
  };

  // Helper to complete the cleaning flow and submit to backend
  const submitCleaningFlow = async () => {
    if (!activeFlowTask || isSubmittingFlow) return;
    setIsSubmittingFlow(true);

    try {
      let finalBeforeUrl = beforeImage;
      let finalAfterUrl = afterImage;

      // Helper function to upload to Cloudinary if it's base64 data
      const uploadToCloudinary = async (base64Data) => {
        if (!base64Data || !base64Data.startsWith("data:")) return base64Data;
        const res = await fetch(`${API_URL}/api/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: base64Data }),
        });
        if (!res.ok) throw new Error("Image upload failed");
        const json = await res.json();
        return json.url;
      };

      // Upload images in parallel if needed
      if (beforeImage && beforeImage.startsWith("data:")) {
        try {
          finalBeforeUrl = await uploadToCloudinary(beforeImage);
        } catch (_) {
          finalBeforeUrl = MOCK_BEFORE_IMAGE;
        }
      }
      if (afterImage && afterImage.startsWith("data:")) {
        try {
          finalAfterUrl = await uploadToCloudinary(afterImage);
        } catch (_) {
          finalAfterUrl = MOCK_AFTER_IMAGE;
        }
      }

      if (!finalBeforeUrl) finalBeforeUrl = MOCK_BEFORE_IMAGE;
      if (!finalAfterUrl) finalAfterUrl = MOCK_AFTER_IMAGE;

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // 1. Post to collections endpoint
      const collectionPayload = {
        truckId: TRUCK_ID,
        date: today,
        stopName: activeFlowTask.sitioName,
        stopAddress: flowLocation || activeFlowTask.sitioName,
        wasteType: flowWasteType,
        bins: flowBins,
        routeId: activeFlowTask.scheduleId,
        routeName: activeFlowTask.routeName,
        driverName: driverName,
        beforeImage: finalBeforeUrl,
        afterImage: finalAfterUrl,
        status: flowStatus,
      };

      const submitLogPromise = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_URL}/api/collections`);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onload = () => {
          if (xhr.status === 201) resolve(JSON.parse(xhr.responseText));
          else reject(new Error("Could not log collection"));
        };
        xhr.onerror = () => reject(new Error("Network failed"));
        xhr.send(JSON.stringify(collectionPayload));
      });

      await submitLogPromise;

      // 2. Complete sitio task on schedule
      const completeTaskPromise = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_URL}/api/schedules/${activeFlowTask.scheduleId}/complete-task`);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onload = () => {
          if (xhr.status === 200) resolve();
          else reject(new Error("Could not mark task complete"));
        };
        xhr.onerror = () => reject(new Error("Network failed"));
        xhr.send(JSON.stringify({ sitioName: activeFlowTask.sitioName }));
      });

      await completeTaskPromise;

      Alert.alert("Success", "Collection verified and logged successfully!");
      fetchScheduleData();
      setActiveFlowTask(null);
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to log pickup.");
    } finally {
      setIsSubmittingFlow(false);
    }
  };

  // AI Chat
  const openAiModal = () => {
    const areaName = todaySchedules[0]?.routeName || "Unassigned";
    const greeting = `Hi ${driverName.split(" ")[0]}! I'm EcoAssist AI. You're assigned to "${areaName}" today. How can I help you?`;
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
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated,
          context: { driverName, truckId: TRUCK_ID, routeName: todaySchedules[0]?.routeName || "" },
        }),
      });
      const data = await res.json();
      setAiMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Sorry, I couldn't get a response." }]);
    } catch {
      setAiMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Check your internet and try again." }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // Dynamic Shift Analytics Calculations
  const analyticsStats = useMemo(() => {
    let totalStops = 0;
    let completedStops = 0;

    todaySchedules.forEach((sched) => {
      if (sched.sitioTasks && sched.sitioTasks.length > 0) {
        totalStops += sched.sitioTasks.length;
        completedStops += sched.sitioTasks.filter((t) => t.completed).length;
      } else if (sched.sitio) {
        totalStops += 1;
        if (sched.status === "completed") completedStops += 1;
      }
    });

    const stopsLeft = Math.max(0, totalStops - completedStops);
    const progressPercent = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
    const estimatedBins = completedStops * 4;

    return {
      totalStops,
      completedStops,
      stopsLeft,
      progressPercent,
      estimatedBins,
    };
  }, [todaySchedules]);

  const isRouteCompleted = useMemo(() => {
    if (!todaySchedules || todaySchedules.length === 0) return false;
    if (analyticsStats.totalStops > 0 && analyticsStats.stopsLeft === 0) return true;
    return todaySchedules.every((sched) => sched.status === "completed");
  }, [todaySchedules, analyticsStats]);

  // Broadcast shift completion to Officials app
  useEffect(() => {
    if (isRouteCompleted && todaySchedules.length > 0) {
      const socket = io(API_URL, { transports: ["websocket", "polling"] });
      socket.emit("truck:shift-completed", {
        truckId: TRUCK_ID,
        driverName,
        routeName: formattedAssignedRoute || "Collection Duty",
        completedStops: analyticsStats.completedStops,
        totalStops: analyticsStats.totalStops,
        timestamp: new Date().toISOString(),
      });
      return () => socket.disconnect();
    }
  }, [isRouteCompleted, todaySchedules.length, TRUCK_ID, driverName, formattedAssignedRoute, analyticsStats]);

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Dynamic route arrow string for header & schedule items
  const formatRouteArrowString = useCallback((sched) => {
    if (!sched) return "No schedule assigned today";
    
    // Priority 1: If sitioTasks is present, use barangay + sitioTask names
    if (sched.sitioTasks && sched.sitioTasks.length > 0) {
      const bgy = (sched.barangay || (sched.routeName ? sched.routeName.split(/[\s\u2014\u2013\u2794\u2192\u279c>:;\-]+/u)[0] : "") || "Apas").trim();
      const sitioNames = sched.sitioTasks.map(t => (typeof t === 'string' ? t : t.name).trim()).filter(Boolean);
      
      const rawList = [bgy, ...sitioNames];
      const uniqueList = [];
      const seen = new Set();
      for (const item of rawList) {
        const lower = item.toLowerCase();
        if (item && !seen.has(lower)) {
          seen.add(lower);
          uniqueList.push(item);
        }
      }
      return uniqueList.join(" ➔ ");
    }

    // Priority 2: Parse routeName with comprehensive unicode arrow regex
    if (sched.routeName) {
      const parts = sched.routeName.split(/\s*[\u2014\u2013\u2794\u2192\u279c>:;\-]+\s*/u).map(p => p.trim()).filter(Boolean);
      const uniqueParts = [];
      const seen = new Set();
      for (const part of parts) {
        const lower = part.toLowerCase();
        if (part && !seen.has(lower)) {
          seen.add(lower);
          uniqueParts.push(part);
        }
      }
      if (uniqueParts.length > 0) return uniqueParts.join(" ➔ ");
    }

    return sched.sitio ? `${sched.barangay || 'Apas'} ➔ ${sched.sitio}` : "Collection Duty";
  }, []);

  const formattedAssignedRoute = useMemo(() => {
    if (!todaySchedules || todaySchedules.length === 0) return "No schedule assigned today";
    return formatRouteArrowString(todaySchedules[0]);
  }, [todaySchedules, formatRouteArrowString]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <NetworkBanner />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.leafIconCircle}>
            <MaterialIcons name="eco" size={18} color="#059669" />
          </View>
          <View style={styles.collectorBadge}>
            <Text style={styles.collectorBadgeText}>COLLECTOR</Text>
          </View>
          <Text style={styles.truckIdText}>TRUCK-{TRUCK_ID}</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={fetchScheduleData} activeOpacity={0.7}>
            <MaterialIcons name="refresh" size={20} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.7}
            onPress={() => { clearUnread(); navigation.navigate("Alerts"); }}
          >
            <MaterialIcons
              name={unreadCount > 0 ? "notifications" : "notifications-none"}
              size={22}
              color={unreadCount > 0 ? "#059669" : "#475569"}
            />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* ── Hero Greeting & Single Assigned Route Display ── */}
        <View style={styles.hero}>
          <Text style={styles.heroGreeting}>{greeting},</Text>
          <Text style={styles.heroName}>{driverName.split(" ")[0]}!</Text>

          {/* Single Assigned Route Card (SHOWN ONLY ONCE) */}
          <View style={styles.heroRouteCard}>
            <View style={styles.heroRouteHeader}>
              <MaterialIcons name="alt-route" size={18} color="#059669" />
              <Text style={styles.heroRouteHeaderTitle}>TODAY'S ASSIGNED ROUTE</Text>
            </View>
            <Text style={styles.heroRouteText}>{formattedAssignedRoute}</Text>
          </View>
        </View>

        {/* ── Route & Shift Completed Banner ── */}
        {!isLoading && isRouteCompleted && (
          <View style={styles.shiftCompletedBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.shiftCompletedBadgeIcon}>
                <MaterialIcons name="emoji-events" size={24} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shiftCompletedBannerTitle}>Shift & Pickups Completed</Text>
                <Text style={styles.shiftCompletedBannerSub}>
                  Truck {TRUCK_ID} ({driverName}) has completed all scheduled waste collections for today.
                </Text>
              </View>
            </View>
            <View style={styles.shiftCompletedBannerFooter}>
              <Text style={styles.shiftCompletedFooterStat}>
                {analyticsStats.completedStops} / {analyticsStats.totalStops} Stops Cleared
              </Text>
              <Text style={styles.shiftCompletedFooterStat}>
                ~{analyticsStats.estimatedBins} Bins Volume
              </Text>
            </View>
          </View>
        )}

        {/* ── Primary Map Action Button ── */}
        {!isLoading && !hasError && (
          <TouchableOpacity
            style={[
              styles.primaryLaunchMapBtn,
              isRouteCompleted && styles.disabledLaunchMapBtn,
            ]}
            onPress={() => {
              if (isRouteCompleted) {
                setShowFinishModal(true);
              } else {
                goToMap();
              }
            }}
            activeOpacity={0.85}
          >
            <MaterialIcons
              name={isRouteCompleted ? "check-circle" : "map"}
              size={22}
              color="#FFFFFF"
            />
            <Text style={styles.primaryLaunchMapBtnText}>
              {isRouteCompleted ? "Route Completed ✓ (View Summary)" : "Launch Live Map & Navigation"}
            </Text>
            {!isRouteCompleted && (
              <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        )}

        {/* ── Loading ── */}
        {isLoading ? (
          <Animated.View style={{ opacity: pulseAnim }}>
            <View style={styles.skeletonHero}>
              <SkeletonBlock width="40%" height={13} style={{ marginBottom: 10 }} />
              <SkeletonBlock width="55%" height={30} style={{ marginBottom: 14 }} />
              <SkeletonBlock width="70%" height={13} style={{ marginBottom: 20 }} />
            </View>
          </Animated.View>
        ) : null}

        {/* ── Error ── */}
        {!isLoading && hasError ? (
          <View style={styles.stateCard}>
            <View style={styles.errorIconWrap}>
              <MaterialIcons name="wifi-off" size={28} color="#DC2626" />
            </View>
            <Text style={styles.stateTitle}>Failed to load schedule</Text>
            <Text style={styles.stateSub}>Check your connection and try again.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchScheduleData} activeOpacity={0.8}>
              <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Shift Analytics Grid ── */}
        {!isLoading && !hasError ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SHIFT ANALYTICS</Text>
            <View style={styles.analyticsGrid}>
              {/* Card 1: Stops Left */}
              <View style={styles.analyticsCard}>
                <View style={[styles.analyticsIconBox, { backgroundColor: "#FEE2E2" }]}>
                  <MaterialIcons name="location-on" size={20} color="#DC2626" />
                </View>
                <Text style={styles.analyticsValue}>{analyticsStats.stopsLeft}</Text>
                <Text style={styles.analyticsLabel}>Stops Remaining</Text>
              </View>

              {/* Card 2: Cleared / Complete */}
              <View style={styles.analyticsCard}>
                <View style={[styles.analyticsIconBox, { backgroundColor: "#ECFDF5" }]}>
                  <MaterialIcons name="check-circle" size={20} color="#059669" />
                </View>
                <Text style={styles.analyticsValue}>
                  {analyticsStats.completedStops} / {analyticsStats.totalStops}
                </Text>
                <Text style={styles.analyticsLabel}>Stops Cleared ({analyticsStats.progressPercent}%)</Text>
              </View>

              {/* Card 3: Bins Volume */}
              <View style={styles.analyticsCard}>
                <View style={[styles.analyticsIconBox, { backgroundColor: "#FEF3C7" }]}>
                  <MaterialIcons name="delete-outline" size={20} color="#D97706" />
                </View>
                <Text style={styles.analyticsValue}>{analyticsStats.estimatedBins} Bins</Text>
                <Text style={styles.analyticsLabel}>Estimated Volume</Text>
              </View>

              {/* Card 4: Shift Status */}
              <View style={styles.analyticsCard}>
                <View style={[
                  styles.analyticsIconBox,
                  isRouteCompleted
                    ? { backgroundColor: "#DCFCE7" }
                    : shiftActive
                    ? { backgroundColor: "#DCFCE7" }
                    : todaySchedules.length > 0
                    ? { backgroundColor: "#FEF3C7" }
                    : { backgroundColor: "#F1F5F9" }
                ]}>
                  <MaterialIcons
                    name={isRouteCompleted ? "check-circle" : shiftActive ? "gps-fixed" : todaySchedules.length > 0 ? "hourglass-top" : "event-busy"}
                    size={20}
                    color={isRouteCompleted ? "#166534" : shiftActive ? "#166534" : todaySchedules.length > 0 ? "#B45309" : "#64748B"}
                  />
                </View>
                <Text style={[styles.analyticsValue, { fontSize: 14 }]} numberOfLines={1}>
                  {isRouteCompleted ? "Completed ✓" : shiftActive ? "On Duty" : todaySchedules.length > 0 ? "Ready to Start" : "No Schedule"}
                </Text>
                <Text style={styles.analyticsLabel}>Shift Status</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Route Progress Bar ── */}
        {!isLoading && !hasError && todaySchedules.length > 0 ? (
          <View style={styles.section}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 4 }}>
              <Text style={styles.sectionLabel}>ROUTE PROGRESS</Text>
              <Text style={styles.progressPercentText}>{analyticsStats.progressPercent}% Complete</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${analyticsStats.progressPercent}%` }]} />
            </View>
          </View>
        ) : null}

        {/* ── Today's Duty Checklist ── */}
        {!isLoading && !hasError ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TODAY'S DUTY CHECKLIST</Text>

            {todaySchedules.length > 0 ? (
              todaySchedules.map((sched, i) => (
                <View key={sched._id || i} style={styles.checklistCard}>
                  {sched.sitioTasks && sched.sitioTasks.length > 0 ? (
                    sched.sitioTasks.map((task, idx) => (
                      <TouchableOpacity
                        key={task._id || idx}
                        style={[
                          styles.checklistItem,
                          task.completed && styles.checklistItemCompleted
                        ]}
                        onPress={() => toggleTaskComplete(sched._id, task.name, task.completed, sched.routeName || "Collection Duty")}
                        activeOpacity={task.completed ? 1 : 0.75}
                      >
                        <View style={[
                          styles.checkboxSquare,
                          task.completed && styles.checkboxSquareChecked
                        ]}>
                          {task.completed && (
                            <MaterialIcons name="check" size={15} color="#FFFFFF" />
                          )}
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={[
                            styles.checklistItemTitle,
                            task.completed && styles.checklistItemTitleCompleted
                          ]}>
                            {task.name}
                          </Text>
                          <Text style={styles.checklistItemTime}>
                            Scheduled: {formatStopTime(idx)}
                          </Text>
                        </View>

                        <View style={[
                          styles.sitioStatusBadge,
                          task.completed ? styles.sitioBadgeDone : styles.sitioBadgePending
                        ]}>
                          <Text style={[
                            styles.sitioStatusBadgeText,
                            task.completed ? styles.sitioBadgeTextDone : styles.sitioBadgeTextPending
                          ]}>
                            {task.completed ? "CLEARED" : "PENDING"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.checklistItem,
                        sched.status === "completed" && styles.checklistItemCompleted
                      ]}
                      onPress={() => toggleScheduleComplete(sched._id, sched.status, sched.routeName || "Collection Duty", sched.sitio || "Depot")}
                      activeOpacity={sched.status === "completed" ? 1 : 0.75}
                    >
                      <View style={[
                        styles.checkboxSquare,
                        sched.status === "completed" && styles.checkboxSquareChecked
                      ]}>
                        {sched.status === "completed" && (
                          <MaterialIcons name="check" size={15} color="#FFFFFF" />
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[
                          styles.checklistItemTitle,
                          sched.status === "completed" && styles.checklistItemTitleCompleted
                        ]}>
                          {sched.sitio || "Collection Duty"}
                        </Text>
                        <Text style={styles.checklistItemTime}>Scheduled Duty</Text>
                      </View>

                      <View style={[
                        styles.sitioStatusBadge,
                        sched.status === "completed" ? styles.sitioBadgeDone : styles.sitioBadgePending
                      ]}>
                        <Text style={[
                          styles.sitioStatusBadgeText,
                          sched.status === "completed" ? styles.sitioBadgeTextDone : styles.sitioBadgeTextPending
                        ]}>
                          {sched.status === "completed" ? "CLEARED" : "PENDING"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <MaterialIcons name="event-busy" size={36} color="#CBD5E1" />
                <Text style={styles.emptyCardTitle}>No collections scheduled today</Text>
                <Text style={styles.emptyCardSub}>Check back later or contact dispatch</Text>
              </View>
            )}
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Clearance Flow Modal */}
      <Modal
        visible={!!activeFlowTask}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isSubmittingFlow) {
            setActiveFlowTask(null);
          }
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#334155' }}>
              <TouchableOpacity
                onPress={() => {
                  if (activeFlowTask.step === 'options') {
                    setActiveFlowTask(null);
                  } else if (activeFlowTask.step === 'before_photo') {
                    setActiveFlowTask(prev => ({ ...prev, step: 'options' }));
                  } else if (activeFlowTask.step === 'cleaning') {
                    setActiveFlowTask(prev => ({ ...prev, step: 'before_photo' }));
                  } else if (activeFlowTask.step === 'after_photo') {
                    setActiveFlowTask(prev => ({ ...prev, step: 'cleaning' }));
                  } else if (activeFlowTask.step === 'details') {
                    setActiveFlowTask(prev => ({ ...prev, step: 'after_photo' }));
                  }
                }}
                disabled={isSubmittingFlow}
                style={{ padding: 4 }}
              >
                <MaterialIcons name="arrow-back" size={24} color="#F8FAFC" />
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#F8FAFC' }}>
                {activeFlowTask?.step === 'options' && 'Select Action'}
                {activeFlowTask?.step === 'before_photo' && 'Proof: Before Cleaning'}
                {activeFlowTask?.step === 'cleaning' && 'Clearing In Progress'}
                {activeFlowTask?.step === 'after_photo' && 'Proof: After Cleaning'}
                {activeFlowTask?.step === 'details' && 'Log Verification Details'}
              </Text>
              <TouchableOpacity
                onPress={() => setActiveFlowTask(null)}
                disabled={isSubmittingFlow}
                style={{ padding: 4 }}
              >
                <MaterialIcons name="close" size={24} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            {/* Step Content */}
            <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }}>
              {activeFlowTask?.step === 'options' && (
                <View style={{ gap: 16, width: '100%' }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#F8FAFC', textAlign: 'center', marginBottom: 8 }}>
                    {activeFlowTask.sitioName}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 20 }}>
                    Select an action to perform at this garbage collection area.
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      setBasicReportNotes("");
                      setBasicReportCategory("Other");
                      setShowBasicReportModal(true);
                    }}
                    style={{ backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#334155', borderRadius: 20, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16 }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="warning" size={26} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#F8FAFC' }}>Basic Report</Text>
                      <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>File a hazard, obstruction or incident report</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setActiveFlowTask(prev => ({ ...prev, step: 'before_photo' }))}
                    style={{ backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#10B981', borderRadius: 20, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16 }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="local-shipping" size={26} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#F8FAFC' }}>Clear Area & Log Pickup</Text>
                      <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Perform standard before/after clearing flow</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {activeFlowTask?.step === 'before_photo' && (
                <View style={{ gap: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#F8FAFC', textAlign: 'center' }}>
                    Capture photo BEFORE waste collection at {activeFlowTask.sitioName}
                  </Text>
                  {beforeImage ? (
                    <Image source={{ uri: beforeImage }} style={{ width: '100%', height: 240, borderRadius: 16 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: '100%', height: 200, backgroundColor: '#1E293B', borderRadius: 16, borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <MaterialIcons name="photo-camera" size={48} color="#64748B" />
                      <Text style={{ color: '#94A3B8', fontSize: 13 }}>No photo captured yet</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                    <TouchableOpacity
                      onPress={() => takePhotoStep('before')}
                      style={{ flex: 1, backgroundColor: '#334155', paddingVertical: 14, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    >
                      <MaterialIcons name="photo-camera" size={20} color="#F8FAFC" />
                      <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{beforeImage ? "Retake Photo" : "Take Photo"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        notifyClearingStatus(activeFlowTask.sitioName, 'clearing');
                        setActiveFlowTask(prev => ({ ...prev, step: 'cleaning' }));
                      }}
                      style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Next Step</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {activeFlowTask?.step === 'cleaning' && (
                <View style={{ gap: 24, alignItems: 'center', paddingHorizontal: 12 }}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#064E3B', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="cleaning-services" size={44} color="#34D399" />
                  </View>
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#F8FAFC', textAlign: 'center' }}>
                      Clearing In Progress
                    </Text>
                    <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 }}>
                      Live broom animation is broadcasting on Officials & Resident maps for <Text style={{ color: '#34D399', fontWeight: '700' }}>{activeFlowTask.sitioName}</Text>.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setActiveFlowTask(prev => ({ ...prev, step: 'after_photo' }))}
                    style={{ width: '100%', backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 12 }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Finish Clearing & Take After Photo</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeFlowTask?.step === 'after_photo' && (
                <View style={{ gap: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#F8FAFC', textAlign: 'center' }}>
                    Capture photo AFTER waste collection at {activeFlowTask.sitioName}
                  </Text>
                  {afterImage ? (
                    <Image source={{ uri: afterImage }} style={{ width: '100%', height: 240, borderRadius: 16 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: '100%', height: 200, backgroundColor: '#1E293B', borderRadius: 16, borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <MaterialIcons name="photo-camera" size={48} color="#64748B" />
                      <Text style={{ color: '#94A3B8', fontSize: 13 }}>No photo captured yet</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                    <TouchableOpacity
                      onPress={() => takePhotoStep('after')}
                      style={{ flex: 1, backgroundColor: '#334155', paddingVertical: 14, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                    >
                      <MaterialIcons name="photo-camera" size={20} color="#F8FAFC" />
                      <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{afterImage ? "Retake Photo" : "Take Photo"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActiveFlowTask(prev => ({ ...prev, step: 'details' }))}
                      style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Next Step</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {activeFlowTask?.step === 'details' && (
                <View style={{ gap: 16 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 }}>
                    Log Verification Details
                  </Text>
                  <View>
                    <Text style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Waste Type</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {['General', 'Recyclable', 'Organic', 'Hazardous'].map(type => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => setFlowWasteType(type)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 10,
                            backgroundColor: flowWasteType === type ? '#10B981' : '#1E293B',
                            borderWidth: 1,
                            borderColor: flowWasteType === type ? '#10B981' : '#334155'
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: flowWasteType === type ? '#FFFFFF' : '#94A3B8' }}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Bins Collected</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                      <TouchableOpacity
                        onPress={() => setFlowBins(prev => Math.max(1, prev - 1))}
                        style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <MaterialIcons name="remove" size={20} color="#F8FAFC" />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#F8FAFC' }}>{flowBins}</Text>
                      <TouchableOpacity
                        onPress={() => setFlowBins(prev => prev + 1)}
                        style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <MaterialIcons name="add" size={20} color="#F8FAFC" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={submitCleaningFlow}
                    disabled={isSubmittingFlow}
                    style={{ backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 16 }}
                  >
                    {isSubmittingFlow ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Submit Verification Log</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Basic Report Modal */}
      <Modal
        visible={showBasicReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBasicReportModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
          <View style={{ flex: 1, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#F8FAFC' }}>File Basic Report</Text>
              <TouchableOpacity onPress={() => setShowBasicReportModal(false)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={24} color="#F8FAFC" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <Text style={{ fontSize: 14, color: '#94A3B8' }}>
                Select issue type for <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{activeFlowTask?.sitioName}</Text>:
              </Text>

              {['Blocked Road', 'Overflow Hazard', 'Vehicle Obstruction', 'Other'].map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setBasicReportCategory(cat)}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: basicReportCategory === cat ? '#1E293B' : '#0F172A',
                    borderWidth: 1.5,
                    borderColor: basicReportCategory === cat ? '#EF4444' : '#334155',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: basicReportCategory === cat ? '#EF4444' : '#F8FAFC' }}>{cat}</Text>
                  {basicReportCategory === cat && <MaterialIcons name="check-circle" size={20} color="#EF4444" />}
                </TouchableOpacity>
              ))}

              <Text style={{ fontSize: 14, color: '#94A3B8', marginTop: 8 }}>Additional Notes:</Text>
              <TextInput
                value={basicReportNotes}
                onChangeText={setBasicReportNotes}
                placeholder="Describe details for LGU Officials..."
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: '#1E293B',
                  borderRadius: 12,
                  padding: 14,
                  color: '#F8FAFC',
                  borderWidth: 1,
                  borderColor: '#334155',
                  textAlignVertical: 'top',
                  minHeight: 100
                }}
              />

              <TouchableOpacity
                onPress={submitBasicReportFlow}
                disabled={submittingBasicReport}
                style={{ backgroundColor: '#EF4444', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 12 }}
              >
                {submittingBasicReport ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Submit Incident Report</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* AI Assistant Chat Modal */}
      <Modal
        visible={showAiAssistant}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAiAssistant(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.aiModalOverlay}>
            <TouchableOpacity style={styles.aiModalCloseArea} activeOpacity={1} onPress={() => setShowAiAssistant(false)} />
            <View style={styles.aiModalContent}>
              <View style={styles.aiHeader}>
                <View style={styles.aiIconCircle}>
                  <MaterialIcons name="psychology" size={26} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiTitle}>EcoAssist AI</Text>
                  <Text style={styles.aiSubtitle}>Driver Assistant • Powered by Gemini</Text>
                </View>
                <TouchableOpacity style={styles.aiCloseBtn} onPress={() => setShowAiAssistant(false)}>
                  <MaterialIcons name="close" size={24} color="#6F7A70" />
                </TouchableOpacity>
              </View>
              <ScrollView
                ref={chatScrollRef}
                style={styles.aiChatScroll}
                contentContainerStyle={styles.aiChatContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {aiMessages.map((msg, i) => (
                  <View key={i} style={[styles.aiBubble, msg.role === "user" ? styles.aiBubbleUser : styles.aiBubbleAI]}>
                    <Text style={[styles.aiBubbleText, msg.role === "user" && styles.aiBubbleTextUser]}>{msg.content}</Text>
                  </View>
                ))}
                {aiLoading && (
                  <View style={[styles.aiBubble, styles.aiBubbleAI, { paddingVertical: 14 }]}>
                    <ActivityIndicator size="small" color="#047857" />
                  </View>
                )}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aiChipsRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                {["Any tips for this area?", "What should I know today?", "How to handle hazardous waste?"].map((chip) => (
                  <TouchableOpacity key={chip} style={styles.aiChip} onPress={() => setAiInput(chip)}>
                    <Text style={styles.aiChipText}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.aiInputRow}>
                <TextInput
                  style={styles.aiTextInput}
                  value={aiInput}
                  onChangeText={setAiInput}
                  placeholder="Ask anything..."
                  placeholderTextColor="#BECABE"
                  multiline={false}
                  returnKeyType="send"
                  onSubmitEditing={sendAiMessage}
                  editable={!aiLoading}
                />
                <TouchableOpacity
                  style={[styles.aiSendBtn, (!aiInput.trim() || aiLoading) && { opacity: 0.4 }]}
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
      {!isLoading && !hasError ? (
        <TouchableOpacity style={styles.fab} onPress={openAiModal} activeOpacity={0.85}>
          <MaterialIcons name="lightbulb" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}

      {/* Finish Summary Modal */}
      <Modal
        visible={showFinishModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFinishModal(false)}
      >
        <View style={styles.finishModalBackdrop}>
          <View style={styles.finishModalCard}>
            <View style={styles.finishHeaderIconCircle}>
              <MaterialIcons name="emoji-events" size={42} color="#059669" />
            </View>

            <Text style={styles.finishModalTitle}>Shift & Pickups Completed</Text>
            <Text style={styles.finishModalSub}>
              Truck <Text style={{ fontWeight: "800", color: "#059669" }}>{TRUCK_ID}</Text> ({driverName}) has completed all assigned waste collection stops for today.
            </Text>

            {/* Summary Stats Grid */}
            <View style={styles.finishStatsContainer}>
              <View style={styles.finishStatBox}>
                <MaterialIcons name="check-circle" size={20} color="#059669" />
                <Text style={styles.finishStatValue}>
                  {analyticsStats.completedStops} / {analyticsStats.totalStops}
                </Text>
                <Text style={styles.finishStatLabel}>Stops Cleared</Text>
              </View>

              <View style={styles.finishStatBox}>
                <MaterialIcons name="delete" size={20} color="#D97706" />
                <Text style={styles.finishStatValue}>{analyticsStats.estimatedBins} Bins</Text>
                <Text style={styles.finishStatLabel}>Est. Volume</Text>
              </View>

              <View style={styles.finishStatBox}>
                <MaterialIcons name="verified" size={20} color="#2563EB" />
                <Text style={styles.finishStatValue}>100%</Text>
                <Text style={styles.finishStatLabel}>Route Done</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.finishModalBtnPrimary}
              onPress={() => setShowFinishModal(false)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
              <Text style={styles.finishModalBtnText}>Close & Return</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContainer: { paddingHorizontal: 16, paddingBottom: 110, paddingTop: 8 },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, backgroundColor: "#FFFFFF",
    borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  leafIconCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#ECFDF5",
    justifyContent: "center", alignItems: "center",
  },
  collectorBadge: {
    backgroundColor: "#E6F4EA", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4,
  },
  collectorBadgeText: { fontSize: 10, fontWeight: "800", color: "#059669", letterSpacing: 0.6 },
  truckIdText: { fontSize: 13, fontWeight: "600", color: "#475569", marginLeft: 2 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  notifBadge: {
    position: "absolute", top: 4, right: 4, minWidth: 14, height: 14, borderRadius: 7,
    backgroundColor: "#EF4444", justifyContent: "center", alignItems: "center", paddingHorizontal: 2,
  },
  notifBadgeText: { fontSize: 8, fontWeight: "800", color: "#FFFFFF" },

  // ── Hero & Single Route Display ─────────────────────────────────────────────
  hero: {
    paddingVertical: 14, paddingHorizontal: 2, marginBottom: 8,
  },
  heroGreeting: { fontSize: 14, color: "#64748B", fontWeight: "500" },
  heroName: { fontSize: 30, fontWeight: "800", color: "#0F172A", letterSpacing: -0.6, lineHeight: 36, marginVertical: 2 },
  
  heroRouteCard: {
    backgroundColor: "#ECFDF5", borderRadius: 16, padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: "#A7F3D0",
  },
  heroRouteHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  heroRouteHeaderTitle: { fontSize: 10, fontWeight: "800", color: "#047857", letterSpacing: 0.8 },
  heroRouteText: { fontSize: 14, fontWeight: "700", color: "#065F46", lineHeight: 20 },

  // ── Primary Map Action Button ──────────────────────────────────────────────
  primaryLaunchMapBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#059669", paddingVertical: 15, borderRadius: 16, marginBottom: 18,
    shadowColor: "#059669", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  disabledLaunchMapBtn: {
    backgroundColor: "#94A3B8",
    shadowColor: "transparent",
    elevation: 0,
  },
  primaryLaunchMapBtnText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },

  // ── Section & Cards ────────────────────────────────────────────────────────
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1,
    marginBottom: 10, paddingLeft: 4,
  },

  // ── Analytics Grid ─────────────────────────────────────────────────────────
  analyticsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
  },
  analyticsCard: {
    width: "48%", backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: "#F1F5F9", gap: 6,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2,
  },
  analyticsIconBox: {
    width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 2,
  },
  analyticsValue: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  analyticsLabel: { fontSize: 11, fontWeight: "600", color: "#64748B" },

  // ── Route Progress Bar ──────────────────────────────────────────────────────
  progressPercentText: { fontSize: 12, fontWeight: "800", color: "#059669" },
  progressBarTrack: {
    height: 12, backgroundColor: "#E2E8F0", borderRadius: 6, overflow: "hidden",
  },
  progressBarFill: {
    height: "100%", backgroundColor: "#059669", borderRadius: 6,
  },

  // ── Today's Duty Checklist Card ────────────────────────────────────────────
  checklistCard: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: "#F1F5F9", gap: 10,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
  },
  checklistItem: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  checklistItemCompleted: { backgroundColor: "#F8FAFC", borderColor: "#CBD5E1" },
  checkboxSquare: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#CBD5E1",
    alignItems: "center", justifyContent: "center",
  },
  checkboxSquareChecked: { backgroundColor: "#059669", borderColor: "#059669" },
  checklistItemTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  checklistItemTitleCompleted: { textDecorationLine: "line-through", color: "#94A3B8" },
  checklistItemTime: { fontSize: 11, color: "#64748B", marginTop: 2 },
  
  sitioStatusBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  sitioBadgeDone: { backgroundColor: "#DCFCE7" },
  sitioBadgePending: { backgroundColor: "#FEF3C7" },
  sitioStatusBadgeText: { fontSize: 9, fontWeight: "800" },
  sitioBadgeTextDone: { color: "#15803D" },
  sitioBadgeTextPending: { color: "#B45309" },

  emptyCard: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 32, alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: "#F1F5F9",
  },
  emptyCardTitle: { fontSize: 15, fontWeight: "700", color: "#64748B" },
  emptyCardSub: { fontSize: 12, color: "#94A3B8" },

  // ── State cards ─────────────────────────────────────────────────────────────
  stateCard: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 32, alignItems: "center", gap: 8, marginBottom: 16,
    borderWidth: 1, borderColor: "#F1F5F9",
  },
  stateTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", textAlign: "center", marginTop: 4 },
  stateSub: { fontSize: 13, color: "#64748B", lineHeight: 19, textAlign: "center" },
  errorIconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#FEE2E2",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    backgroundColor: "#059669", paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10,
  },
  retryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  skeletonHero: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "#F1F5F9",
  },

  // ── FAB ──────────────────────────────────────────────────────────────────────
  fab: {
    position: "absolute", right: 20, bottom: 24, width: 54, height: 54, borderRadius: 27,
    backgroundColor: "#047857", justifyContent: "center", alignItems: "center",
    shadowColor: "#047857", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8, zIndex: 50,
  },

  // ── AI Modal ────────────────────────────────────────────────────────────────
  aiModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  aiModalCloseArea: { flex: 1 },
  aiModalContent: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingTop: 12, paddingBottom: 24, maxHeight: "85%", minHeight: "60%",
  },
  aiHeader: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F0EDED", gap: 12,
  },
  aiIconCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#E4EEE9",
    justifyContent: "center", alignItems: "center",
  },
  aiTitle: { fontSize: 16, fontWeight: "700", color: "#1B1C1C" },
  aiSubtitle: { fontSize: 11, color: "#6F7A70", fontWeight: "500" },
  aiCloseBtn: { padding: 4 },
  aiChatScroll: { flex: 1 },
  aiChatContent: { padding: 16, gap: 10, flexGrow: 1 },
  aiBubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  aiBubbleAI: { alignSelf: "flex-start", backgroundColor: "#F1F5F1", borderBottomLeftRadius: 4 },
  aiBubbleUser: { alignSelf: "flex-end", backgroundColor: "#047857", borderBottomRightRadius: 4 },
  aiBubbleText: { fontSize: 14, color: "#1B1C1C", lineHeight: 20 },
  aiBubbleTextUser: { color: "#FFFFFF" },
  aiChipsRow: { maxHeight: 44, marginVertical: 8 },
  aiChip: { backgroundColor: "#F1F5F1", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#D4EAD9" },
  aiChipText: { fontSize: 12, color: "#047857", fontWeight: "600" },
  aiInputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10, paddingTop: 4 },
  aiTextInput: {
    flex: 1, backgroundColor: "#F8FAF8", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12,
    fontSize: 14, color: "#1B1C1C", borderWidth: 1, borderColor: "#E8EDE8",
  },
  aiSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#047857", justifyContent: "center", alignItems: "center" },

  // ── Shift Completed Banner ──────────────────────────────────────────────────
  shiftCompletedBanner: {
    backgroundColor: "#ECFDF5", borderRadius: 20, padding: 18, marginBottom: 16,
    borderWidth: 1.5, borderColor: "#A7F3D0", gap: 12,
    shadowColor: "#059669", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  shiftCompletedBadgeIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#D1FAE5",
    alignItems: "center", justifyContent: "center",
  },
  shiftCompletedBannerTitle: { fontSize: 16, fontWeight: "800", color: "#065F46" },
  shiftCompletedBannerSub: { fontSize: 12, color: "#047857", marginTop: 2, lineHeight: 17 },
  shiftCompletedBannerFooter: {
    flexDirection: "row", justifyContent: "space-between", paddingTop: 10,
    borderTopWidth: 1, borderTopColor: "#A7F3D0",
  },
  shiftCompletedFooterStat: { fontSize: 12, fontWeight: "700", color: "#065F46" },

  // ── Finish Summary Modal ─────────────────────────────────────────────────────
  finishModalBackdrop: {
    flex: 1, backgroundColor: "rgba(15, 23, 42, 0.75)", justifyContent: "center", alignItems: "center", padding: 20,
  },
  finishModalCard: {
    width: "100%", backgroundColor: "#FFFFFF", borderRadius: 28, padding: 24, alignItems: "center", gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
  },
  finishHeaderIconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "#ECFDF5",
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#A7F3D0",
  },
  finishModalTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", textAlign: "center" },
  finishModalSub: { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 19 },
  finishStatsContainer: {
    flexDirection: "row", width: "100%", justifyContent: "space-between", gap: 8, marginVertical: 8,
  },
  finishStatBox: {
    flex: 1, backgroundColor: "#F8FAFC", borderRadius: 16, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", gap: 4,
  },
  finishStatValue: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  finishStatLabel: { fontSize: 10, color: "#64748B", fontWeight: "600" },
  finishModalBtnPrimary: {
    width: "100%", backgroundColor: "#059669", borderRadius: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  finishModalBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
