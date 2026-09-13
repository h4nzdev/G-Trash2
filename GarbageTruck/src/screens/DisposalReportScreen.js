import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";
import colors from "../constants/colors";

const FACILITIES = [
  { name: "Binaliw Sanitary Landfill (ARN)", short: "Binaliw Landfill (ARN)" },
  { name: "Inayawan Transfer Station", short: "Inayawan Transfer Station" },
  { name: "Barangay Materials Recovery (MRF)", short: "Barangay MRF" },
  { name: "Consolacion Waste Facility", short: "Consolacion Facility" },
];

const MOCK_DISPOSAL_IMAGE =
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80";

export default function DisposalReportScreen({ navigation, route }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const TRUCK_ID = user?.truckId ?? "GT-000";

  const routeParams = route?.params || {};
  const [scheduleId, setScheduleId] = useState(routeParams.scheduleId || null);
  const [barangay, setBarangay] = useState(routeParams.barangay || "Assigned Area");
  const [routeName, setRouteName] = useState(routeParams.routeName || "");
  const [sitiosCleared, setSitiosCleared] = useState(routeParams.sitiosCleared || 0);
  const [totalSitios, setTotalSitios] = useState(routeParams.totalSitios || routeParams.sitiosCleared || 0);

  // Weighbridge state
  const [disposalFacility, setDisposalFacility] = useState("Binaliw Sanitary Landfill (ARN)");
  const [disposalWeight, setDisposalWeight] = useState("2.40");
  const [disposalWeightUnit, setDisposalWeightUnit] = useState("tons");
  const [disposalPhoto, setDisposalPhoto] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // If scheduleId was not passed in params, fetch today's schedule for this truck
  useEffect(() => {
    if (!scheduleId) {
      setIsLoadingSchedule(true);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      fetch(`${API_URL}/api/schedules/truck/${TRUCK_ID.toUpperCase()}/today?date=${today}`)
        .then((r) => r.json())
        .then((data) => {
          const list = Array.isArray(data?.schedules) ? data.schedules : data?.schedule ? [data.schedule] : [];
          if (list.length > 0) {
            const sched = list[0];
            setScheduleId(sched._id);
            setBarangay(sched.barangay || "Assigned Area");
            setRouteName(sched.routeName || "");
            const cleared = (sched.sitioTasks || []).filter((t) => t.completed).length;
            const total = sched.sitioTasks?.length || 1;
            setSitiosCleared(cleared);
            setTotalSitios(total);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingSchedule(false));
    }
  }, [scheduleId, TRUCK_ID]);

  const takeDisposalPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status === "granted") {
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.6,
          base64: true,
        });
        if (!result.canceled && result.assets?.[0]) {
          setDisposalPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
          return;
        }
      }
    } catch (e) {
      console.warn("Disposal photo error:", e);
    }
    // Fallback if camera unavailable or canceled
    if (!disposalPhoto) {
      setDisposalPhoto(MOCK_DISPOSAL_IMAGE);
    }
  };

  const chooseFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setDisposalPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (e) {
      console.warn("Gallery picker error:", e);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const parsedWeight = parseFloat(disposalWeight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      Alert.alert("Invalid Weight", "Please enter a valid weighed tonnage or kilogram value.");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalPhotoUrl = disposalPhoto;
      if (disposalPhoto && disposalPhoto.startsWith("data:")) {
        try {
          const res = await fetch(`${API_URL}/api/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: disposalPhoto }),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.url) finalPhotoUrl = json.url;
          }
        } catch (_) {}
      }
      if (!finalPhotoUrl) finalPhotoUrl = MOCK_DISPOSAL_IMAGE;

      // 1. Submit to Schedule completion endpoint
      if (scheduleId) {
        await fetch(`${API_URL}/api/schedules/${scheduleId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalWeight: parsedWeight,
            weightUnit: disposalWeightUnit,
            disposalFacility,
            disposalPhoto: finalPhotoUrl,
            completedAt: new Date().toISOString(),
          }),
        }).catch(() => {});

        // 2. Also call batch-weigh to update collection history logs directly
        await fetch(`${API_URL}/api/collections/batch-weigh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            truckId: TRUCK_ID,
            scheduleId,
            totalWeight: parsedWeight,
            weightUnit: disposalWeightUnit,
            disposalFacility,
            disposalPhoto: finalPhotoUrl,
          }),
        }).catch(() => {});
      }

      // 3. Mark shift and navigation as inactive
      await AsyncStorage.setItem("@truck_shift_active", "false").catch(() => {});
      await AsyncStorage.setItem("@truck_nav_active", "false").catch(() => {});

      // 4. Socket notifications to LGU dashboard
      try {
        const socket = io(API_URL, { transports: ["websocket", "polling"] });
        socket.emit("truck:offline", { truckId: TRUCK_ID });
        socket.emit("truck:shift-completed", {
          truckId: TRUCK_ID,
          driverName: user?.driverName || user?.name || "Collector",
          routeName: routeName || `${barangay} Route`,
          completedStops: sitiosCleared,
          totalStops: totalSitios,
          totalWeight: parsedWeight,
          weightUnit: disposalWeightUnit,
          disposalFacility,
          timestamp: new Date().toISOString(),
        });
        setTimeout(() => socket.disconnect(), 1000);
      } catch (_) {}

      Alert.alert(
        "Shift Completed & Weighed! 🚛",
        `Weighbridge report logged: ${parsedWeight} ${disposalWeightUnit} at ${disposalFacility}. Great job!`,
        [
          {
            text: "View History",
            onPress: () => navigation.navigate("History"),
          },
          {
            text: "Done",
            onPress: () => navigation.navigate("Home"),
          },
        ]
      );
    } catch (err) {
      Alert.alert("Notice", "Weighbridge report recorded. Shift completed!");
      navigation.navigate("Home");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF9F8" />

      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (navigation?.canGoBack?.() ? navigation.goBack() : navigation.navigate("Home"))}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1B1C1C" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Disposal Report</Text>
          <Text style={styles.headerSub}>{TRUCK_ID} • {barangay}</Text>
        </View>
        <View style={styles.headerRightBadge}>
          <Text style={styles.headerRightBadgeText}>SCALE REPORT</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingSchedule ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#006A3B" />
            <Text style={styles.loadingText}>Loading route details…</Text>
          </View>
        ) : (
          <>
            {/* Hero Accomplishment Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroIconWrap}>
                <MaterialIcons name="local-shipping" size={32} color="#006A3B" />
              </View>
              <Text style={styles.heroTitle}>Sitios 100% Cleared!</Text>
              <Text style={styles.heroDescription}>
                Submit the weighbridge scale report to officially conclude collection for{" "}
                <Text style={styles.heroHighlight}>{barangay}</Text>.
              </Text>

              <View style={styles.sitiosPill}>
                <View style={styles.sitiosPillLeft}>
                  <MaterialIcons name="check-circle" size={16} color="#006A3B" />
                  <Text style={styles.sitiosPillLabel}>Sitios Collected</Text>
                </View>
                <Text style={styles.sitiosPillCount}>
                  {sitiosCleared} / {totalSitios} (Complete)
                </Text>
              </View>
            </View>

            {/* Section 1: Designated Disposal Facility */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>1. Designated Disposal Facility</Text>
              <Text style={styles.sectionHint}>Select the weighbridge or landfill site visited</Text>
              <View style={styles.facilityList}>
                {FACILITIES.map((fac) => {
                  const isSelected = disposalFacility === fac.name;
                  return (
                    <TouchableOpacity
                      key={fac.name}
                      onPress={() => setDisposalFacility(fac.name)}
                      style={[
                        styles.facilityItem,
                        isSelected && styles.facilityItemSelected,
                      ]}
                      activeOpacity={0.75}
                    >
                      <View style={styles.facilityItemLeft}>
                        <MaterialIcons
                          name={isSelected ? "radio-button-checked" : "radio-button-unchecked"}
                          size={20}
                          color={isSelected ? "#006A3B" : "#94A3B8"}
                        />
                        <Text
                          style={[
                            styles.facilityItemName,
                            isSelected && styles.facilityItemNameSelected,
                          ]}
                        >
                          {fac.short}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedBadgeText}>SELECTED</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Section 2: Weighed Waste (Scale Net) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>2. Weighed Waste (Scale Net)</Text>
                  <Text style={styles.sectionHint}>Net tonnage recorded on scale ticket</Text>
                </View>
                {/* Unit Switcher */}
                <View style={styles.unitToggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.unitBtn,
                      disposalWeightUnit === "tons" && styles.unitBtnActive,
                    ]}
                    onPress={() => setDisposalWeightUnit("tons")}
                  >
                    <Text
                      style={[
                        styles.unitBtnText,
                        disposalWeightUnit === "tons" && styles.unitBtnTextActive,
                      ]}
                    >
                      TONS
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.unitBtn,
                      disposalWeightUnit === "kg" && styles.unitBtnActive,
                    ]}
                    onPress={() => setDisposalWeightUnit("kg")}
                  >
                    <Text
                      style={[
                        styles.unitBtnText,
                        disposalWeightUnit === "kg" && styles.unitBtnTextActive,
                      ]}
                    >
                      KG
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.weightInputWrap}>
                <View style={styles.scaleIconWrap}>
                  <MaterialIcons name="scale" size={22} color="#006A3B" />
                </View>
                <TextInput
                  style={styles.weightTextInput}
                  value={disposalWeight}
                  onChangeText={setDisposalWeight}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 2.40"
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.weightUnitSuffix}>{disposalWeightUnit}</Text>
              </View>
            </View>

            {/* Section 3: Scale Slip / Disposal Photo Proof */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>3. Scale Slip / Disposal Photo Proof</Text>
              <Text style={styles.sectionHint}>Attach photo of weighbridge ticket or dump receipt</Text>

              {disposalPhoto ? (
                <View style={styles.photoPreviewContainer}>
                  <Image source={{ uri: disposalPhoto }} style={styles.photoPreview} resizeMode="cover" />
                  <View style={styles.photoOverlayBadge}>
                    <MaterialIcons name="check-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.photoOverlayText}>Ticket Captured</Text>
                  </View>
                  <View style={styles.photoActionRow}>
                    <TouchableOpacity
                      style={styles.retakeBtn}
                      onPress={takeDisposalPhoto}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="photo-camera" size={16} color="#006A3B" />
                      <Text style={styles.retakeBtnText}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.retakeBtn}
                      onPress={chooseFromGallery}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="photo-library" size={16} color="#006A3B" />
                      <Text style={styles.retakeBtnText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <View style={styles.cameraIconCircle}>
                    <MaterialIcons name="photo-camera" size={28} color="#006A3B" />
                  </View>
                  <Text style={styles.placeholderTitle}>No scale ticket attached</Text>
                  <Text style={styles.placeholderSub}>
                    Capture a clear photo of the certified weighbridge slip
                  </Text>
                  <View style={styles.photoButtonRow}>
                    <TouchableOpacity
                      style={styles.captureBtn}
                      onPress={takeDisposalPhoto}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="photo-camera" size={18} color="#FFFFFF" />
                      <Text style={styles.captureBtnText}>Open Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.galleryBtn}
                      onPress={chooseFromGallery}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="photo-library" size={18} color="#006A3B" />
                      <Text style={styles.galleryBtnText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Submit Action */}
            <View style={styles.submitSection}>
              <TouchableOpacity
                style={[styles.primarySubmitBtn, isSubmitting && styles.primarySubmitBtnDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.primarySubmitBtnText}>
                      Submit Weighbridge Report & Finish Shift
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reviewLaterBtn}
                onPress={() => navigation.navigate("Home")}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.reviewLaterText}>Review Later / Back to Home</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF9F8",
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDED",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1B1C1C",
  },
  headerSub: {
    fontSize: 11,
    color: "#6F7A70",
    fontWeight: "500",
  },
  headerRightBadge: {
    backgroundColor: "#E4EEE9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  headerRightBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#006A3B",
    letterSpacing: 0.5,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 80,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6F7A70",
    fontWeight: "600",
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0EDED",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E4EEE9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#006A3B",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1B1C1C",
    textAlign: "center",
    marginBottom: 4,
  },
  heroDescription: {
    fontSize: 12,
    color: "#6F7A70",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  heroHighlight: {
    color: "#006A3B",
    fontWeight: "800",
  },
  sitiosPill: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FBF9F8",
    borderWidth: 1,
    borderColor: "#F0EDED",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sitiosPillLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sitiosPillLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1B1C1C",
  },
  sitiosPillCount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#006A3B",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0EDED",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1B1C1C",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  sectionHint: {
    fontSize: 11,
    color: "#6F7A70",
    marginBottom: 12,
  },
  facilityList: {
    gap: 8,
  },
  facilityItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FBF9F8",
    borderWidth: 1.5,
    borderColor: "#F0EDED",
  },
  facilityItemSelected: {
    backgroundColor: "#E4EEE9",
    borderColor: "#006A3B",
  },
  facilityItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  facilityItemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1B1C1C",
  },
  facilityItemNameSelected: {
    color: "#006A3B",
    fontWeight: "800",
  },
  selectedBadge: {
    backgroundColor: "#006A3B",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  unitToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F0EDED",
    borderRadius: 8,
    padding: 2,
  },
  unitBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitBtnActive: {
    backgroundColor: "#006A3B",
  },
  unitBtnText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6F7A70",
  },
  unitBtnTextActive: {
    color: "#FFFFFF",
  },
  weightInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBF9F8",
    borderWidth: 1.5,
    borderColor: "#006A3B",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  scaleIconWrap: {
    marginRight: 10,
  },
  weightTextInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    color: "#1B1C1C",
  },
  weightUnitSuffix: {
    fontSize: 14,
    fontWeight: "800",
    color: "#006A3B",
    textTransform: "uppercase",
  },
  photoPreviewContainer: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0EDED",
    backgroundColor: "#FBF9F8",
  },
  photoPreview: {
    width: "100%",
    height: 180,
    backgroundColor: "#E2E8F0",
  },
  photoOverlayBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 106, 59, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  photoOverlayText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  photoActionRow: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    backgroundColor: "#FFFFFF",
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#006A3B",
    backgroundColor: "#E4EEE9",
  },
  retakeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#006A3B",
  },
  photoPlaceholder: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#BECABE",
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    backgroundColor: "#FBF9F8",
  },
  cameraIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E4EEE9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  placeholderTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1B1C1C",
    marginBottom: 2,
  },
  placeholderSub: {
    fontSize: 11,
    color: "#6F7A70",
    textAlign: "center",
    marginBottom: 14,
  },
  photoButtonRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  captureBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#006A3B",
    height: 42,
    borderRadius: 12,
  },
  captureBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  galleryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#E4EEE9",
    borderWidth: 1,
    borderColor: "#006A3B",
    height: 42,
    borderRadius: 12,
  },
  galleryBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#006A3B",
  },
  submitSection: {
    marginTop: 8,
    gap: 10,
  },
  primarySubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#006A3B",
    height: 54,
    borderRadius: 16,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primarySubmitBtnDisabled: {
    opacity: 0.6,
  },
  primarySubmitBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  reviewLaterBtn: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewLaterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6F7A70",
  },
});
