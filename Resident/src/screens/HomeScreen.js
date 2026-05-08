import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";
import colors from "../constants/colors";

const { width } = Dimensions.get("window");

const INITIAL_REGION = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const CHECKLIST_ITEMS = [
  { id: 1, label: "Sort general waste into black bag" },
  { id: 2, label: "Sort recyclables (plastic, paper, cans)" },
  { id: 3, label: "Rinse food containers before placing" },
  { id: 4, label: "Tie all bags securely" },
  { id: 5, label: "Place bin at curb by 7:30 AM" },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "there";

  const [trucks, setTrucks] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [binReady, setBinReady] = useState(false);
  const [checklist, setChecklist] = useState(
    CHECKLIST_ITEMS.map((item) => ({ ...item, checked: false }))
  );

  const fetchDashboard = useCallback(async () => {
    try {
      const [trucksRes, schedulesRes, reportsRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/trucks`).then((r) => r.json()),
        fetch(`${API_URL}/api/schedules/today`).then((r) => r.json()),
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

      if (schedulesRes.status === "fulfilled" && Array.isArray(schedulesRes.value.schedules)) {
        setTodaySchedules(schedulesRes.value.schedules);
      }

      if (reportsRes.status === "fulfilled" && Array.isArray(reportsRes.value)) {
        setPendingCount(reportsRes.value.filter((r) => r.status !== "resolved").length);
      }
    } catch {
      // silent — dashboard still shows with empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onlineTrucks = trucks.filter((t) => t.status === "online");
  const nearestTruck = onlineTrucks[0] || null;
  const firstSchedule = todaySchedules[0] || null;

  const toggleCheck = (id) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
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

  // Map marker: use nearest online truck position if available
  const markerCoord =
    nearestTruck?.lat && nearestTruck?.lng
      ? { latitude: nearestTruck.lat, longitude: nearestTruck.lng }
      : { latitude: INITIAL_REGION.latitude, longitude: INITIAL_REGION.longitude };

  const mapRegion = nearestTruck?.lat
    ? { ...INITIAL_REGION, latitude: nearestTruck.lat, longitude: nearestTruck.lng }
    : INITIAL_REGION;

  // Build zone visual based on truck proximity (simplified)
  const zoneData = [
    {
      name: "Zone 3",
      distance: onlineTrucks.length === 0 ? "No trucks" : "Far Away",
      icon: "location-on",
      highlighted: false,
    },
    {
      name: "Zone 2",
      distance: onlineTrucks.length > 0 ? "Approaching" : "—",
      icon: "location-on",
      highlighted: false,
    },
    {
      name: "Zone 1",
      distance: nearestTruck ? "Active" : "No trucks",
      icon: nearestTruck ? "check-circle" : "location-off",
      highlighted: !!nearestTruck,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
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
          {pendingCount > 0 && (
            <View style={styles.badge}>
              {pendingCount <= 9 && (
                <Text style={styles.badgeText}>{pendingCount}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>{getGreeting()}, {firstName}!</Text>
          <Text style={styles.subtitle}>
            {onlineTrucks.length > 0
              ? `${onlineTrucks.length} truck${onlineTrucks.length > 1 ? "s" : ""} active in your area.`
              : "No trucks currently active in your area."}
          </Text>
        </View>

        {/* Bento Grid Cards */}
        <View style={styles.cardGrid}>
          {/* Air Quality Card (decorative — no sensor backend yet) */}
          <View style={styles.airQualityCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Current Air Quality</Text>
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
                  style={[styles.chartBar, { height: h, backgroundColor: `rgba(0,106,59,${(h / 100) * 0.6 + 0.1})` }]}
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
                  <MaterialIcons name="local-shipping" size={24} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.collectionLabel}>Upcoming Collection</Text>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 4 }} />
                  ) : firstSchedule ? (
                    <Text style={styles.collectionTime}>Today · {firstSchedule.routeName || "Scheduled"}</Text>
                  ) : (
                    <Text style={styles.collectionTime}>No collection today</Text>
                  )}
                </View>
              </View>

              <View style={styles.collectionDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Route</Text>
                  <Text style={styles.detailValue}>
                    {firstSchedule?.routeName || "—"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Driver</Text>
                  <Text style={styles.detailValue}>
                    {firstSchedule?.driverName || "—"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.prepareButton, (binReady || !firstSchedule) && styles.prepareButtonReady]}
                onPress={firstSchedule ? handleOpenModal : undefined}
                activeOpacity={firstSchedule ? 0.8 : 1}
              >
                <View style={styles.prepareButtonInner}>
                  <MaterialIcons
                    name={binReady ? "check-circle" : "delete-outline"}
                    size={18}
                    color="#006A3B"
                  />
                  <Text style={styles.prepareButtonText}>
                    {binReady ? "Bin Ready ✓" : firstSchedule ? "Prepare My Bin" : "No Collection Today"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.decorativeIcon}>
              <MaterialIcons name="recycling" size={80} color="rgba(255,255,255,0.15)" />
            </View>
          </View>
        </View>

        {/* Truck Status Section */}
        <View style={styles.truckStatusSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Garbage Truck Status</Text>
            <View style={styles.liveBadge}>
              <View style={[styles.liveDot, !nearestTruck && styles.liveDotOff]} />
              <Text style={styles.liveText}>{nearestTruck ? "Live" : "Offline"}</Text>
            </View>
          </View>

          <View style={styles.truckStatusCard}>
            {/* Zone Progress */}
            <View style={styles.zoneContainer}>
              <View style={styles.progressLine} />
              {zoneData.map((zone, index) => (
                <View key={index} style={styles.zoneItem}>
                  <View style={[styles.zoneCircle, zone.highlighted && styles.zoneCircleHighlighted]}>
                    <MaterialIcons
                      name={zone.icon}
                      size={zone.highlighted ? 28 : 20}
                      color={zone.highlighted ? "#FFFFFF" : "#6B7280"}
                    />
                  </View>
                  <Text style={[styles.zoneName, zone.highlighted && styles.zoneNameHighlighted]}>
                    {zone.name}
                  </Text>
                  <Text style={[styles.zoneDistance, zone.highlighted && styles.zoneDistanceHighlighted]}>
                    {zone.distance}
                  </Text>
                </View>
              ))}
            </View>

            {/* Truck Info Card */}
            {isLoading ? (
              <View style={[styles.truckInfoCard, { justifyContent: "center" }]}>
                <ActivityIndicator size="small" color="#006A3B" />
              </View>
            ) : nearestTruck ? (
              <View style={styles.truckInfoCard}>
                <View style={styles.truckImagePlaceholder}>
                  <MaterialIcons name="local-shipping" size={32} color="#047857" />
                </View>
                <View style={styles.truckDetails}>
                  <Text style={styles.truckTitle}>Truck {nearestTruck.truckId} is active</Text>
                  <Text style={styles.truckEstimate}>
                    {onlineTrucks.length} truck{onlineTrucks.length > 1 ? "s" : ""} online
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
                <View style={[styles.truckImagePlaceholder, { backgroundColor: "#F0EDED" }]}>
                  <MaterialIcons name="local-shipping" size={32} color="#BECABE" />
                </View>
                <View style={styles.truckDetails}>
                  <Text style={[styles.truckTitle, { color: "#6B7280" }]}>No trucks active</Text>
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
          <MapView
            style={styles.map}
            initialRegion={mapRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={markerCoord}>
              <View style={styles.customMarker}>
                <MaterialIcons name="local-shipping" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          </MapView>

          <View style={styles.mapOverlay}>
            <MaterialIcons name="my-location" size={16} color="#00731E" />
            <Text style={styles.mapAddress}>
              {nearestTruck ? `Truck ${nearestTruck.truckId}` : "No active trucks"}
            </Text>
          </View>

          <View style={styles.mapViewBadge}>
            <Text style={styles.mapViewBadgeText}>Tap to view full map</Text>
          </View>
        </TouchableOpacity>
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
                <MaterialIcons name="delete-outline" size={22} color="#006A3B" />
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
                <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                  {item.checked && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
                </View>
                <Text style={[styles.checklistLabel, item.checked && styles.checklistLabelDone]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.progressBarTrack}>
              <View
                style={[styles.progressBarFill, { width: `${(checkedCount / checklist.length) * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              {checkedCount} of {checklist.length} items ready
            </Text>

            <TouchableOpacity
              style={[styles.confirmBtn, !allChecked && styles.confirmBtnDisabled]}
              onPress={allChecked ? handleConfirm : undefined}
              activeOpacity={allChecked ? 0.85 : 1}
            >
              <Text style={styles.confirmBtnText}>
                {allChecked ? "Mark Bin as Ready" : "Check all items to confirm"}
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
    backgroundColor: "rgba(255,255,255,0.9)",
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
    paddingTop: 24,
    paddingBottom: 40,
  },
  greetingSection: {
    marginBottom: 24,
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
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  collectionLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
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
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  detailLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
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
    backgroundColor: "rgba(255,255,255,0.85)",
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
    backgroundColor: "rgba(0,106,59,0.1)",
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
    backgroundColor: "rgba(0,106,59,0.35)",
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
    borderColor: "#91F78E33",
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
    backgroundColor: "#91F78E33",
    justifyContent: "center",
    alignItems: "center",
  },
  mapPreview: {
    height: 192,
    borderRadius: 24,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(108,122,112,0.3)",
    position: "relative",
    marginBottom: 40,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  customMarker: {
    backgroundColor: "#006A3B",
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  mapViewBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
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
    backgroundColor: "rgba(255,255,255,0.9)",
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
});
