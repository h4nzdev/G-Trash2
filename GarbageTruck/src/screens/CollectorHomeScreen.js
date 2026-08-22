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

  // Restore shift state from local storage on mount
  useEffect(() => {
    AsyncStorage.getItem("@truck_shift_active")
      .then((val) => { if (val === "true") setShiftActive(true); })
      .catch(() => {});
  }, []);

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
          setTodaySchedules(Array.isArray(schedules) ? schedules : []);
        } catch (_) {
          setTodaySchedules([]);
        }
      } else {
        setTodaySchedules([]);
      }
      setIsLoading(false);
    };
    xhr.onerror = () => { setHasError(true); setIsLoading(false); };
    xhr.ontimeout = () => { setHasError(true); setIsLoading(false); };
    xhr.send();
  }, [TRUCK_ID]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      fetchScheduleData();
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

  // Toggle shift (start/stop GPS streaming)
  const toggleShift = () => {
    const newState = !shiftActive;
    setShiftActive(newState);
    AsyncStorage.setItem("@truck_shift_active", newState ? "true" : "false").catch(() => {});

    if (newState) {
      // Notify the map screen to start streaming via AsyncStorage flag
      AsyncStorage.setItem("@truck_nav_active", "true").catch(() => {});
      Alert.alert("Shift Started", "Your GPS location is now being shared. Residents can see your truck on the map.");
    } else {
      AsyncStorage.setItem("@truck_nav_active", "false").catch(() => {});
      // Send offline status to server
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/trucks/location`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify({ truckId: TRUCK_ID, lat: 0, lng: 0, heading: 0, speed: 0 }));
    }
  };

  // Toggle single schedule completed (Todo List item)
  const toggleScheduleComplete = (id, currentStatus) => {
    if (currentStatus === "completed") return; // No-op if already complete
    Alert.alert(
      "Complete Task",
      "Mark this collection sitio task as completed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Completed",
          onPress: () => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${API_URL}/api/schedules/${id}/complete`);
            xhr.onload = () => {
              if (xhr.status === 200) {
                fetchScheduleData();
              } else {
                Alert.alert("Error", "Could not complete task.");
              }
            };
            xhr.send();
          }
        }
      ]
    );
  };

  // Toggle specific sitio task completed inside a sequential schedule
  const toggleTaskComplete = (scheduleId, sitioName, isCompleted) => {
    if (isCompleted) return; // No-op if already complete
    Alert.alert(
      "Complete Task",
      `Mark "${sitioName}" collection task as completed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Completed",
          onPress: () => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${API_URL}/api/schedules/${scheduleId}/complete-task`);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.onload = () => {
              if (xhr.status === 200) {
                fetchScheduleData();
              } else {
                Alert.alert("Error", "Could not complete task.");
              }
            };
            xhr.send(JSON.stringify({ sitioName }));
          }
        }
      ]
    );
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

        {/* ── Shift Toggle ── */}
        {!isLoading && !hasError ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Shift Status</Text>
            <View style={styles.surface}>
              <View style={styles.shiftCard}>
                <View style={[styles.shiftIndicator, shiftActive && styles.shiftIndicatorActive]}>
                  <MaterialIcons
                    name={shiftActive ? "gps-fixed" : "gps-off"}
                    size={28}
                    color={shiftActive ? "#FFFFFF" : "#9CA3AF"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shiftTitle}>
                    {shiftActive ? "On Duty — Streaming GPS" : "Off Duty"}
                  </Text>
                  <Text style={styles.shiftSub}>
                    {shiftActive
                      ? "Residents can see your truck on the map"
                      : "Start your shift to share your location"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.shiftBtn, shiftActive && styles.shiftBtnStop]}
                  onPress={toggleShift}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={shiftActive ? "stop" : "play-arrow"}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.shiftBtnText}>
                    {shiftActive ? "End" : "Start"}
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
                      ]}>
                        <Text style={[
                          styles.schedStatusText,
                          sched.status === "completed" && styles.schedStatusTextDone,
                        ]}>
                          {sched.status === "completed" ? "Done" : sched.status === "missed" ? "Missed" : "Pending"}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Render Sitio Checklist Tasks */}
                    {sched.sitioTasks && sched.sitioTasks.length > 0 ? (
                      <View style={{ marginTop: 8, paddingLeft: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 6 }}>
                        {sched.sitioTasks.map((task, idx) => (
                          <View key={task._id || idx} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
                            <TouchableOpacity
                              onPress={() => toggleTaskComplete(sched._id, task.name, task.completed)}
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
                          onPress={() => toggleScheduleComplete(sched._id, sched.status)}
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
  shiftCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  shiftIndicator: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center",
  },
  shiftIndicatorActive: { backgroundColor: "#006A3B" },
  shiftTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  shiftSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  shiftBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#006A3B",
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  shiftBtnStop: { backgroundColor: "#DC2626" },
  shiftBtnText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },

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
  schedStatusText: { fontSize: 10, fontWeight: "700", color: "#92400E", textTransform: "uppercase" },
  schedStatusTextDone: { color: "#065F46" },

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
