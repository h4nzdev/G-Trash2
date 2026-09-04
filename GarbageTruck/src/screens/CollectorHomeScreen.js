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

  // Socket: re-fetch when an official assigns a new schedule to this truck
  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket", "polling"] });
    socket.on("schedule:changed", ({ truckId }) => {
      if (truckId?.toUpperCase() === TRUCK_ID?.toUpperCase()) fetchScheduleData();
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

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // ─── Render ─────────────────────────────────────────────────────────────────
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
          <TouchableOpacity style={styles.headerBtn} onPress={fetchScheduleData} activeOpacity={0.7}>
            <MaterialIcons name="refresh" size={20} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.7}
            onPress={() => { clearUnread(); navigation.navigate("Alerts"); }}
          >
            <MaterialIcons
              name={unreadCount > 0 ? "notifications" : "notifications-none"}
              size={22}
              color={unreadCount > 0 ? "#006A3B" : "#374151"}
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
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <Text style={styles.heroGreeting}>{greeting},</Text>
          <Text style={styles.heroName}>{driverName.split(" ")[0]}!</Text>
          <Text style={styles.heroRoute}>
            {todaySchedules.length > 0
              ? `Assigned: ${todaySchedules[0].routeName || "Collection duty"}`
              : "No schedule assigned today"}
          </Text>
        </View>

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

        {/* ── Shift Status & Route Overview ── */}
        {!isLoading && !hasError ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Shift Status</Text>
            <View style={styles.surface}>
              <View style={styles.shiftCard}>
                <View style={[
                  styles.shiftIndicator,
                  shiftActive ? styles.shiftIndicatorActive : todaySchedules.length > 0 ? styles.shiftIndicatorReady : styles.shiftIndicatorWaiting
                ]}>
                  <MaterialIcons
                    name={shiftActive ? "gps-fixed" : todaySchedules.length > 0 ? "local-shipping" : "hourglass-empty"}
                    size={28}
                    color={shiftActive ? "#FFFFFF" : todaySchedules.length > 0 ? "#D97706" : "#6B7280"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shiftTitle}>
                    {shiftActive
                      ? "On Duty — Streaming GPS"
                      : todaySchedules.length > 0
                      ? "Waiting — Ready to Start"
                      : "Waiting for Schedule"}
                  </Text>
                  <Text style={styles.shiftSub}>
                    {shiftActive
                      ? "Live tracking active. Residents can see your truck."
                      : todaySchedules.length > 0
                      ? `Assigned to ${todaySchedules[0]?.routeName || "collection route"}. Start shift in Map.`
                      : "No collection schedule assigned for today yet."}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.shiftBtn,
                    shiftActive ? styles.shiftBtnActive : todaySchedules.length > 0 ? styles.shiftBtnStart : styles.shiftBtnMuted
                  ]}
                  onPress={goToMap}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={shiftActive ? "map" : todaySchedules.length > 0 ? "play-arrow" : "map"}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.shiftBtnText}>
                    {shiftActive ? "Live Map" : todaySchedules.length > 0 ? "Go to Map" : "View Map"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Today's Schedule ── */}
        {!isLoading && !hasError ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Today's Schedule</Text>
            <View style={styles.surface}>
              {todaySchedules.length > 0 ? (
                todaySchedules.map((sched, i) => (
                  <View key={sched._id || i} style={[styles.schedItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ padding: 4 }}>
                        <MaterialIcons
                          name="local-shipping"
                          size={24}
                          color={sched.status === "completed" ? "#006A3B" : "#9CA3AF"}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[
                          styles.schedTitle,
                          sched.status === "completed" && { textDecorationLine: "line-through", color: "#9CA3AF" }
                        ]}>
                          {sched.routeName || "Collection Duty"}
                        </Text>
                        <Text style={styles.schedMeta}>
                          {sched.startTime ? `${sched.startTime}` : "Time TBD"}
                          {sched.endTime ? ` — ${sched.endTime}` : ""}
                        </Text>
                        {sched.notes ? <Text style={styles.schedNotes}>{sched.notes}</Text> : null}
                      </View>
                      <View style={[
                        styles.schedStatus,
                        sched.status === "completed" && styles.schedStatusDone,
                        sched.status === "accepted" && styles.schedStatusAccepted,
                        sched.status === "missed" && styles.schedStatusMissed,
                      ]}>
                        <Text style={[
                          styles.schedStatusText,
                          sched.status === "completed" && styles.schedStatusTextDone,
                          sched.status === "accepted" && styles.schedStatusTextAccepted,
                          sched.status === "missed" && styles.schedStatusTextMissed,
                        ]}>
                          {sched.status === "completed" ? "Done" : sched.status === "accepted" ? "Accepted" : sched.status === "missed" ? "Missed" : "Pending"}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Render Sitio Checklist Tasks */}
                    {sched.sitioTasks && sched.sitioTasks.length > 0 ? (
                      <View style={{ marginTop: 8, paddingLeft: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 6 }}>
                        {sched.sitioTasks.map((task, idx) => (
                          <View key={task._id || idx} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
                            <TouchableOpacity
                              onPress={() => toggleTaskComplete(sched._id, task.name, task.completed, sched.routeName || "Collection Duty")}
                              activeOpacity={task.completed ? 1 : 0.7}
                              style={{ padding: 4 }}
                            >
                              <MaterialIcons
                                name={task.completed ? "check-box" : "check-box-outline-blank"}
                                size={22}
                                color={task.completed ? "#006A3B" : "#9CA3AF"}
                              />
                            </TouchableOpacity>
                            <Text style={[
                              { fontSize: 13, marginLeft: 6, fontWeight: '500', color: '#374151' },
                              task.completed && { textDecorationLine: "line-through", color: "#9CA3AF" }
                            ]}>
                              {task.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : sched.sitio ? (
                      // Legacy single-sitio schedule manual completion fallback
                      <View style={{ marginTop: 4, paddingLeft: 12 }}>
                        <TouchableOpacity
                          onPress={() => toggleScheduleComplete(sched._id, sched.status, sched.routeName || "Collection Duty", sched.sitio || "Depot")}
                          activeOpacity={sched.status === "completed" ? 1 : 0.7}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                        >
                          <MaterialIcons
                            name={sched.status === "completed" ? "check-box" : "check-box-outline-blank"}
                            size={22}
                            color={sched.status === "completed" ? "#006A3B" : "#9CA3AF"}
                          />
                          <Text style={[
                            { fontSize: 13, marginLeft: 6, fontWeight: '500', color: '#374151' },
                            sched.status === "completed" && { textDecorationLine: "line-through", color: "#9CA3AF" }
                          ]}>
                            {sched.sitio}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ))
              ) : (
                <View style={styles.emptySchedule}>
                  <MaterialIcons name="event-busy" size={36} color="#D1D5DB" />
                  <Text style={styles.emptyScheduleText}>No collections scheduled today</Text>
                  <Text style={styles.emptyScheduleSub}>Check back later or contact dispatch</Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
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
                <View style={{ alignItems: 'center', width: '100%' }}>
                  <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 20 }}>
                    Please capture the accumulation levels BEFORE you start cleaning.
                  </Text>

                  {beforeImage ? (
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Image source={{ uri: beforeImage }} style={{ width: '100%', height: 280, borderRadius: 20, backgroundColor: '#1E293B', marginBottom: 24 }} resizeMode="cover" />
                      <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                        <TouchableOpacity
                          onPress={() => takePhotoStep('before')}
                          style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>Retake</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setActiveFlowTask(prev => ({ ...prev, step: 'cleaning' }))}
                          style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Proceed</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ width: '100%', height: 320, borderRadius: 24, borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed', backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                      <MaterialIcons name="photo-camera" size={48} color="#94A3B8" style={{ marginBottom: 16 }} />
                      <TouchableOpacity
                        onPress={() => takePhotoStep('before')}
                        style={{ backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginBottom: 12 }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Snap Before Photo</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>Permission prompt will open. Fallback to sample photo on simulators.</Text>
                    </View>
                  )}
                </View>
              )}

              {activeFlowTask?.step === 'cleaning' && (
                <View style={{ alignItems: 'center', width: '100%', gap: 24 }}>
                  <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E2E8F0' }}>
                    <MaterialIcons name="cleaning-services" size={54} color="#10B981" />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#F8FAFC', textAlign: 'center' }}>
                    Clean the Area Now
                  </Text>
                  <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22 }}>
                    Begin collecting waste bins and sweeping the surroundings at <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>{activeFlowTask.sitioName}</Text>.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setActiveFlowTask(prev => ({ ...prev, step: 'after_photo' }))}
                    style={{ backgroundColor: '#10B981', width: '100%', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>Mark as Cleared</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeFlowTask?.step === 'after_photo' && (
                <View style={{ alignItems: 'center', width: '100%' }}>
                  <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 20 }}>
                    Please capture the final cleared area AFTER cleaning is done.
                  </Text>

                  {afterImage ? (
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Image source={{ uri: afterImage }} style={{ width: '100%', height: 280, borderRadius: 20, backgroundColor: '#1E293B', marginBottom: 24 }} resizeMode="cover" />
                      <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                        <TouchableOpacity
                          onPress={() => takePhotoStep('after')}
                          style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>Retake</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setActiveFlowTask(prev => ({ ...prev, step: 'details' }))}
                          style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Proceed</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ width: '100%', height: 320, borderRadius: 24, borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed', backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                      <MaterialIcons name="photo-camera" size={48} color="#94A3B8" style={{ marginBottom: 16 }} />
                      <TouchableOpacity
                        onPress={() => takePhotoStep('after')}
                        style={{ backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginBottom: 12 }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Snap After Photo</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>Verify that the site is completely empty and clean.</Text>
                    </View>
                  )}
                </View>
              )}

              {activeFlowTask?.step === 'details' && (
                <View style={{ width: '100%' }}>
                  {/* Photo Thumbnails */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 4 }}>BEFORE</Text>
                      {beforeImage ? (
                        <Image source={{ uri: beforeImage }} style={{ width: '100%', height: 100, borderRadius: 10, backgroundColor: '#1E293B' }} />
                      ) : (
                        <View style={{ width: '100%', height: 100, borderRadius: 10, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#64748B', fontSize: 12 }}>No image</Text></View>
                      )}
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 4 }}>AFTER</Text>
                      {afterImage ? (
                        <Image source={{ uri: afterImage }} style={{ width: '100%', height: 100, borderRadius: 10, backgroundColor: '#1E293B' }} />
                      ) : (
                        <View style={{ width: '100%', height: 100, borderRadius: 10, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#64748B', fontSize: 12 }}>No image</Text></View>
                      )}
                    </View>
                  </View>

                  {/* Form */}
                  <View style={{ gap: 16 }}>
                    {/* Status */}
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>Area Status</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[
                          { label: 'Clean', value: 'clean', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
                          { label: 'Moderate', value: 'moderate', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
                          { label: 'Critical', value: 'critical', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' }
                        ].map(st => {
                          const isSelected = flowStatus === st.value;
                          return (
                            <TouchableOpacity
                              key={st.value}
                              onPress={() => setFlowStatus(st.value)}
                              style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: isSelected ? st.color : '#334155', backgroundColor: isSelected ? st.bg : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? st.color : '#94A3B8' }}>{st.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Location Description */}
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 }}>Location Reference</Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: '#F8FAFC', backgroundColor: '#1E293B', height: 44 }}
                        value={flowLocation}
                        onChangeText={setFlowLocation}
                        placeholder="e.g. Sitio Sudlon near court"
                        placeholderTextColor="#64748B"
                      />
                    </View>

                    {/* Waste Type */}
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>Waste Classification</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {['General', 'Organic', 'Recyclable', 'Hazardous', 'Bulky'].map(wt => {
                          const isSelected = flowWasteType === wt;
                          return (
                            <TouchableOpacity
                              key={wt}
                              onPress={() => setFlowWasteType(wt)}
                              style={{ height: 36, borderRadius: 18, paddingHorizontal: 16, borderWidth: 1.5, borderColor: isSelected ? '#10B981' : '#334155', backgroundColor: isSelected ? 'rgba(16,185,129,0.1)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#10B981' : '#94A3B8' }}>{wt}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Bins Cleared */}
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>Number of Bins Cleared</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <TouchableOpacity
                          onPress={() => setFlowBins(b => Math.max(1, b - 1))}
                          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <MaterialIcons name="remove" size={20} color="#F8FAFC" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#F8FAFC', minWidth: 30, textAlign: 'center' }}>{flowBins}</Text>
                        <TouchableOpacity
                          onPress={() => setFlowBins(b => b + 1)}
                          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <MaterialIcons name="add" size={20} color="#F8FAFC" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                      onPress={submitCleaningFlow}
                      disabled={isSubmittingFlow}
                      style={{ backgroundColor: '#10B981', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}
                    >
                      {isSubmittingFlow ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>Submit Collection Proof</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Basic Report Sub-Modal inside Flow */}
      <Modal
        visible={showBasicReportModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (!submittingBasicReport) setShowBasicReportModal(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#1E293B', width: '100%', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#334155' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#F8FAFC' }}>File Incident Report</Text>
              <TouchableOpacity onPress={() => setShowBasicReportModal(false)}>
                <MaterialIcons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 }}>Incident Category</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              {['Blocked Road', 'Hazard', 'Other'].map(cat => {
                const isSelected = basicReportCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setBasicReportCategory(cat)}
                    style={{ flex: 1, height: 38, borderRadius: 8, borderWidth: 1.5, borderColor: isSelected ? '#10B981' : '#334155', backgroundColor: isSelected ? 'rgba(16,185,129,0.1)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#10B981' : '#94A3B8' }}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 }}>Notes / Description</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#F8FAFC', backgroundColor: '#0F172A', height: 80, textAlignVertical: 'top', marginBottom: 20 }}
              value={basicReportNotes}
              onChangeText={setBasicReportNotes}
              placeholder="e.g. Blocked street due to parked truck"
              placeholderTextColor="#475569"
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowBasicReportModal(false)}
                style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#94A3B8', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitBasicReportFlow}
                disabled={submittingBasicReport}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}
              >
                {submittingBasicReport ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* EcoAssist AI Chat Modal */}
      <Modal
        visible={showAiAssistant}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowAiAssistant(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.aiModalOverlay}>
            <TouchableOpacity style={styles.aiModalCloseArea} onPress={() => setShowAiAssistant(false)} />
            <View style={styles.aiModalContent}>
              <View style={styles.aiHeader}>
                <View style={styles.aiIconCircle}>
                  <MaterialIcons name="psychology" size={28} color="#006A3B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiTitle}>EcoAssist AI</Text>
                  <Text style={styles.aiSubtitle}>Powered by Groq · llama-3.1-8b</Text>
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
                    <ActivityIndicator size="small" color="#006A3B" />
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
          <MaterialIcons name="psychology" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F2F2F7" },
  scrollContainer: { paddingBottom: 24 },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    backgroundColor: "#FFFFFF", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRight: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  headerLogo: { width: 72, height: 26 },
  collectorBadge: {
    backgroundColor: "#ECFDF5", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: "#D1FAE5",
  },
  collectorBadgeText: { fontSize: 9, fontWeight: "800", color: "#059669", textTransform: "uppercase", letterSpacing: 0.5 },
  truckIdText: { fontSize: 12, fontWeight: "700", color: "#6B7280", letterSpacing: 0.3, textAlign: "center" },
  headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  notifBadge: {
    position: "absolute", top: 7, right: 7, minWidth: 14, height: 14, borderRadius: 7,
    backgroundColor: "#006A3B", justifyContent: "center", alignItems: "center", paddingHorizontal: 2,
  },
  notifBadgeText: { fontSize: 8, fontWeight: "800", color: "#FFFFFF" },

  // ── Hero ────────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB", marginBottom: 16,
  },
  heroGreeting: { fontSize: 13, color: "#9CA3AF", fontWeight: "500" },
  heroName: { fontSize: 26, fontWeight: "800", color: "#111827", letterSpacing: -0.5, lineHeight: 32 },
  heroRoute: { fontSize: 13, color: "#6B7280", fontWeight: "500", marginTop: 6 },

  // ── Sections ────────────────────────────────────────────────────────────────
  section: { marginBottom: 0 },
  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.8,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  surface: {
    backgroundColor: "#FFFFFF", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 16, marginBottom: 16,
  },

  // ── Shift Toggle ──────────────────────────────────────────────────────────
  // ── Shift Status & Route Overview ──────────────────────────────────────────
  shiftCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  shiftIndicator: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center",
  },
  shiftIndicatorActive: { backgroundColor: "#006A3B" },
  shiftIndicatorReady: { backgroundColor: "#FEF3C7" },
  shiftIndicatorWaiting: { backgroundColor: "#F3F4F6" },
  shiftTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  shiftSub: { fontSize: 12, color: "#6B7280", marginTop: 2, lineHeight: 16 },
  shiftBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#006A3B",
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  shiftBtnActive: { backgroundColor: "#006A3B" },
  shiftBtnStart: { backgroundColor: "#006A3B" },
  shiftBtnMuted: { backgroundColor: "#6B7280" },
  shiftBtnStop: { backgroundColor: "#DC2626" },
  shiftBtnText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

  // ── Schedule Items ──────────────────────────────────────────────────────────
  schedItem: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  schedIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#ECFDF5",
    justifyContent: "center", alignItems: "center",
  },
  schedTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  schedMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  schedNotes: { fontSize: 11, color: "#9CA3AF", fontStyle: "italic", marginTop: 2 },
  schedStatus: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "#FEF3C7",
  },
  schedStatusDone: { backgroundColor: "#D1FAE5" },
  schedStatusAccepted: { backgroundColor: "#DBEAFE" },
  schedStatusMissed: { backgroundColor: "#FEE2E2" },
  schedStatusText: { fontSize: 10, fontWeight: "700", color: "#92400E", textTransform: "uppercase" },
  schedStatusTextDone: { color: "#065F46" },
  schedStatusTextAccepted: { color: "#1D4ED8" },
  schedStatusTextMissed: { color: "#B91C1C" },

  emptySchedule: { alignItems: "center", paddingVertical: 28, gap: 6 },
  emptyScheduleText: { fontSize: 15, fontWeight: "600", color: "#9CA3AF" },
  emptyScheduleSub: { fontSize: 12, color: "#D1D5DB" },

  // ── State cards ─────────────────────────────────────────────────────────────
  stateCard: {
    backgroundColor: "#FFFFFF", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB", padding: 36, alignItems: "center", gap: 8, marginBottom: 16,
  },
  stateTitle: { fontSize: 16, fontWeight: "700", color: "#111827", textAlign: "center", marginTop: 4 },
  stateSub: { fontSize: 13, color: "#9CA3AF", lineHeight: 19, textAlign: "center" },
  errorIconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#FEE2E2",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    backgroundColor: "#006A3B", paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10,
  },
  retryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  skeletonHero: {
    backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB", marginBottom: 16,
  },

  // ── FAB ──────────────────────────────────────────────────────────────────────
  fab: {
    position: "absolute", right: 20, bottom: 20, width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#006A3B", justifyContent: "center", alignItems: "center",
    shadowColor: "#006A3B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8, zIndex: 50,
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
  aiBubbleUser: { alignSelf: "flex-end", backgroundColor: "#006A3B", borderBottomRightRadius: 4 },
  aiBubbleText: { fontSize: 14, color: "#1B1C1C", lineHeight: 20 },
  aiBubbleTextUser: { color: "#FFFFFF" },
  aiChipsRow: { maxHeight: 44, marginVertical: 8 },
  aiChip: { backgroundColor: "#F1F5F1", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#D4EAD9" },
  aiChipText: { fontSize: 12, color: "#006A3B", fontWeight: "600" },
  aiInputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10, paddingTop: 4 },
  aiTextInput: {
    flex: 1, backgroundColor: "#F8FAF8", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12,
    fontSize: 14, color: "#1B1C1C", borderWidth: 1, borderColor: "#E8EDE8",
  },
  aiSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#006A3B", justifyContent: "center", alignItems: "center" },
});
