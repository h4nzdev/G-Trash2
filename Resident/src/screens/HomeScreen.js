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
  Alert,
  Image,
  ActivityIndicator,
  Animated,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { io } from "socket.io-client";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const CEBU_COORDS = {
  apas: { lat: 10.3533, lng: 123.9065 },
  lahug: { lat: 10.3385, lng: 123.8967 },
  mabolo: { lat: 10.3235, lng: 123.9142 },
  banilad: { lat: 10.3472, lng: 123.9148 },
  guadalupe: { lat: 10.3275, lng: 123.8842 },
  kasambagan: { lat: 10.3312, lng: 123.9125 },
  luz: { lat: 10.3278, lng: 123.9048 },
  talamban: { lat: 10.3688, lng: 123.9168 },
  capitol: { lat: 10.3175, lng: 123.8912 },
  default: { lat: 10.3250, lng: 123.8930 },
};

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

const MOTIVATION_OPTIONS = [
  { id: "clean_barangay", label: "Clean Neighborhood", icon: "park", color: "#059669", tag: "🌿 Clean Barangay" },
  { id: "streak_points", label: "Points & Streak", icon: "emoji-events", color: "#D97706", tag: "🏆 Eco Champion" },
  { id: "truck_on_time", label: "Truck On Time", icon: "local-shipping", color: "#2563EB", tag: "🚛 Timely Disposal" },
  { id: "flood_health", label: "Flood & Health Safety", icon: "health-and-safety", color: "#DC2626", tag: "🦺 Community Safety" },
  { id: "segregation_advocacy", label: "Proper Sorting Habit", icon: "recycling", color: "#7C3AED", tag: "♻️ Zero Waste" },
];

const MALATA_CHECKLIST_ITEMS = [
  { id: 1, label: "Collect biodegradable food scraps & yard waste into green bio-bin/bag" },
  { id: 2, label: "Double check: Ensure ZERO plastics, foil, bottles, or cans are mixed" },
  { id: 3, label: "Cover bio-bin securely to prevent pests, stray animals, and foul odors" },
  { id: 4, label: "Keep plastics & dry recyclables stored for Di-Malata collection day" },
  { id: 5, label: "Place Malata bin outside curb before the collection truck arrives" },
];

const DI_MALATA_CHECKLIST_ITEMS = [
  { id: 1, label: "Separate clean dry recyclables (plastic bottles, tin cans, cartons)" },
  { id: 2, label: "Rinse food and sauce residue from containers before placing" },
  { id: 3, label: "Flatten cardboard boxes and crush plastic bottles to save space" },
  { id: 4, label: "Double check: Ensure ZERO wet kitchen or organic waste is mixed" },
  { id: 5, label: "Tie recyclable bag securely and place at designated curb spot" },
];

const GENERAL_CHECKLIST_ITEMS = [
  { id: 1, label: "Sort general waste into designated bags (Malata vs Di-Malata)" },
  { id: 2, label: "Sort recyclables (clean plastics, paper, and metal cans)" },
  { id: 3, label: "Rinse food containers before placing in the bin" },
  { id: 4, label: "Tie all trash bags securely to avoid spills and odors" },
  { id: 5, label: "Place bin at designated curb pickup spot by scheduled time" },
];

const CHECKLIST_ITEMS = GENERAL_CHECKLIST_ITEMS;

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

function ConfettiExplosion({ visible }) {
  const confettiAnims = useRef(
    Array.from({ length: 24 }).map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (visible) {
      confettiAnims.forEach((anim) => {
        anim.x.setValue(0);
        anim.y.setValue(0);
        anim.scale.setValue(0.2);
        anim.opacity.setValue(1);

        const targetX = (Math.random() - 0.5) * 260;
        const targetY = (Math.random() - 0.7) * 300;

        Animated.parallel([
          Animated.timing(anim.x, {
            toValue: targetX,
            duration: 1100 + Math.random() * 500,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(anim.y, {
              toValue: targetY,
              duration: 600 + Math.random() * 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim.y, {
              toValue: targetY + 120,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim.scale, {
            toValue: 0.8 + Math.random() * 0.5,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(900),
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });
    }
  }, [visible]);

  if (!visible) return null;

  const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EC4899", "#8B5CF6", "#14B8A6"];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {confettiAnims.map((anim, i) => {
        const color = COLORS[i % COLORS.length];
        const size = 10 + (i % 3) * 4;
        const isCircle = i % 2 === 0;

        return (
          <Animated.View
            key={i}
            style={[
              {
                position: "absolute",
                top: "45%",
                left: "48%",
                width: size,
                height: size,
                borderRadius: isCircle ? size / 2 : 3,
                backgroundColor: color,
                transform: [
                  { translateX: anim.x },
                  { translateY: anim.y },
                  { scale: anim.scale },
                ],
                opacity: anim.opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
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
  const aqAlertLastFiredRef = useRef(0);
  const activeNotifDebounceRef = useRef(new Map());

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
  const [todayPickedUp, setTodayPickedUp] = useState(false);
  const [checklist, setChecklist] = useState(
    CHECKLIST_ITEMS.map((item) => ({ ...item, checked: false })),
  );
  const [iotAreas, setIotAreas] = useState([]);
  const [latestIotReading, setLatestIotReading] = useState(null);
  const [iotReadingsHistory, setIotReadingsHistory] = useState([]);
  const [todayPickupDone, setTodayPickupDone] = useState(false);
  const [latestPickupFeed, setLatestPickupFeed] = useState(null);

  const userBarangayRef = useRef(user?.barangay);
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    userBarangayRef.current = user?.barangay;
    userIdRef.current = user?.id;
  }, [user]);

  const [pointsToast, setPointsToast] = useState(null);
  const pointsToastTimerRef = useRef(null);

  const [disposalStreak, setDisposalStreak] = useState(user?.disposalStreak || 0);
  const [userPoints, setUserPoints] = useState(user?.totalPoints || user?.points || 0);
  const [communityPostsCount, setCommunityPostsCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API_URL}/api/resident/${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          if (data.disposalStreak != null) setDisposalStreak(data.disposalStreak);
          if (data.totalPoints != null) setUserPoints(data.totalPoints);
        }
      })
      .catch(() => {});

    fetch(`${API_URL}/api/reports?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCommunityPostsCount(data.length);
      })
      .catch(() => {});
  }, [user]);
  const [proximityModalVisible, setProximityModalVisible] = useState(false);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [todayDisposalPhoto, setTodayDisposalPhoto] = useState(null);
  const [capturedBase64, setCapturedBase64] = useState(null);
  const [hasSnappedToday, setHasSnappedToday] = useState(false);
  const [isSubmittingDisposal, setIsSubmittingDisposal] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);
  const [officialNoticeVisible, setOfficialNoticeVisible] = useState(false);
  const [officialNoticeText, setOfficialNoticeText] = useState("");
  const [selectedMotivation, setSelectedMotivation] = useState("Clean Neighborhood");
  const [guestNoticeVisible, setGuestNoticeVisible] = useState(false);

  const handleTakePhoto = async () => {
    if (hasSnappedToday) {
      Alert.alert(
        "Daily Limit Reached",
        "You can only snap once per day! Your daily garbage disposal photo has already been submitted today and resets tomorrow at midnight."
      );
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Needed", "Camera permission is required to capture photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedPhoto(result.assets[0].uri);
        setCapturedBase64(result.assets[0].base64 || null);
        setModalVisible(false);
        setProximityModalVisible(false);
        setPhotoPreviewVisible(true);
      }
    } catch (err) {
      Alert.alert("Camera Error", "Could not launch camera.");
    }
  };

  const handlePickPhoto = async () => {
    if (hasSnappedToday) {
      Alert.alert(
        "Daily Limit Reached",
        "You can only snap once per day! Your daily garbage disposal photo has already been submitted today and resets tomorrow at midnight."
      );
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Needed", "Photo library access is required to select photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedPhoto(result.assets[0].uri);
        setCapturedBase64(result.assets[0].base64 || null);
        setModalVisible(false);
        setProximityModalVisible(false);
        setPhotoPreviewVisible(true);
      }
    } catch (err) {
      Alert.alert("Gallery Error", "Could not launch photo library.");
    }
  };

  const handleShareOrSavePhoto = async () => {
    if (!selectedPhoto) return;
    if (hasSnappedToday) {
      Alert.alert(
        "Daily Snap Completed",
        "You have already submitted your daily disposal photo today. Resets tomorrow at midnight!"
      );
      setPhotoPreviewVisible(false);
      return;
    }

    setIsSubmittingDisposal(true);
    const today = getTodayYMD();

    try {
      let finalPhotoUrl = selectedPhoto;

      // Upload image to backend / Cloudinary if base64 data exists
      if (capturedBase64) {
        try {
          const uploadRes = await fetch(`${API_URL}/api/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: `data:image/jpeg;base64,${capturedBase64}` }),
          });
          if (uploadRes.ok) {
            const uploadJson = await uploadRes.json();
            if (uploadJson?.url) {
              finalPhotoUrl = uploadJson.url;
            }
          }
        } catch (upErr) {
          console.log("Image upload fallback to direct uri:", upErr);
        }
      }

      // Submit disposal verification record to backend
      const residentId = user?.id || user?._id;
      let subJson = null;
      if (residentId) {
        const subRes = await fetch(`${API_URL}/api/disposal/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            residentId,
            photoUrl: finalPhotoUrl,
            barangay: user?.barangay || "Apas",
            sitio: user?.sitio || "",
            truckId: activeTruckId || "Barangay Unit",
            isTruckNearAndScheduled: !!isTruckNear,
            motivation: selectedMotivation,
            wasteType: scheduledWasteType,
          }),
        });

        subJson = await subRes.json();
        if (!subRes.ok && subJson?.alreadySubmittedToday) {
          setHasSnappedToday(true);
          await AsyncStorage.setItem(`@disposal_snapped_${today}`, "true");
          setPhotoPreviewVisible(false);
          setIsSubmittingDisposal(false);
          Alert.alert(
            "Daily Snap Recorded",
            "You have already submitted your disposal photo for today. Your daily snap resets tomorrow at midnight!"
          );
          return;
        }

        if (subRes.ok) {
          if (subJson.newStreak != null) setDisposalStreak(subJson.newStreak);
          if (subJson.totalPoints != null) setUserPoints(subJson.totalPoints);
        }
      }

      // Notify bin preparation endpoint
      if (user?.id && user?.barangay) {
        fetch(`${API_URL}/api/bin/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ residentId: user.id, barangay: user.barangay }),
        }).catch(() => {});
      }

      // Mark locally as snapped today & bin ready & save photo
      setHasSnappedToday(true);
      setTodayDisposalPhoto(finalPhotoUrl);
      setBinReady(true);
      await Promise.all([
        AsyncStorage.setItem(`@disposal_snapped_${today}`, "true"),
        AsyncStorage.setItem(`@disposal_photo_${today}`, finalPhotoUrl),
        AsyncStorage.setItem(`@bin_prepared_${today}`, "true"),
      ]);

      setPhotoPreviewVisible(false);
      setIsSubmittingDisposal(false);

      const earnedPts = subJson?.pointsAwarded != null ? subJson.pointsAwarded : 10;
      const streakVal = subJson?.newStreak != null ? subJson.newStreak : ((disposalStreak || 0) + 1);
      setCelebrationData({
        message: `Disposal verified! Your ${streakVal}-day streak is active. Thank you for properly sorting your ${scheduledWasteType} waste!`,
        awardPoints: earnedPts,
        motivation: selectedMotivation,
      });
      setCelebrationVisible(true);

      // Open native system share dialog
      try {
        await Share.share({
          title: "Garbage Disposal",
          message: `My ${scheduledWasteType} bin is prepared for collection in Barangay ${user?.barangay || "Apas"}! 🗑️🚛 Motivation: ${selectedMotivation} #CleanerCebu #GTrash`,
          url: selectedPhoto,
        });
      } catch (shareErr) {
        /* share dismissed */
      }
    } catch (err) {
      console.log("Disposal submit error:", err);
      // Fallback local save so resident progress is kept
      setHasSnappedToday(true);
      setTodayDisposalPhoto(selectedPhoto);
      setBinReady(true);
      if (user?.id && user?.barangay) {
        fetch(`${API_URL}/api/bin/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ residentId: user.id, barangay: user.barangay }),
        }).catch(() => {});
      }
      AsyncStorage.setItem(`@disposal_snapped_${today}`, "true").catch(() => {});
      AsyncStorage.setItem(`@disposal_photo_${today}`, selectedPhoto).catch(() => {});
      AsyncStorage.setItem(`@bin_prepared_${today}`, "true").catch(() => {});
      setPhotoPreviewVisible(false);
      setIsSubmittingDisposal(false);
      Alert.alert(
        "Disposal Photo Saved",
        "Your disposal photo has been saved for today (resets tomorrow)."
      );
    }
  };

  // Fetch barangay IoT areas & real sensor readings on mount
  useEffect(() => {
    const brgy = user?.barangay || "Apas";
    fetch(`${API_URL}/api/garbage-areas?barangay=${encodeURIComponent(brgy)}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setIotAreas(data); })
      .catch(() => {});

    fetch(`${API_URL}/api/iot/readings?barangay=${encodeURIComponent(brgy)}&limit=7`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLatestIotReading(data[0]);
          setIotReadingsHistory(data);
        } else {
          fetch(`${API_URL}/api/iot/readings?limit=7`)
            .then((r) => r.json())
            .then((all) => {
              if (Array.isArray(all) && all.length > 0) {
                setLatestIotReading(all[0]);
                setIotReadingsHistory(all);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [user?.barangay]);

  // Restore bin-ready, picked-up, and daily snapped state from AsyncStorage (keyed by date — auto-resets next day)
  useEffect(() => {
    const syncDailyState = () => {
      const today = getTodayYMD();
      Promise.all([
        AsyncStorage.getItem(`@bin_prepared_${today}`),
        AsyncStorage.getItem(`@bin_pickedup_${today}`),
        AsyncStorage.getItem(`@disposal_snapped_${today}`),
        AsyncStorage.getItem(`@disposal_photo_${today}`),
      ]).then(([prepared, pickedUp, snapped, photo]) => {
        if (prepared === 'true') setBinReady(true);
        if (pickedUp === 'true') setTodayPickedUp(true);
        if (snapped === 'true') setHasSnappedToday(true);
        if (photo) setTodayDisposalPhoto(photo);
      }).catch(() => {});

      const residentId = user?.id || user?._id;
      if (residentId) {
        fetch(`${API_URL}/api/disposal/status/${residentId}`)
          .then((r) => r.json())
          .then((data) => {
            if (data?.hasSnappedToday) {
              setHasSnappedToday(true);
              AsyncStorage.setItem(`@disposal_snapped_${today}`, "true").catch(() => {});
              if (data?.submission?.photoUrl) {
                setTodayDisposalPhoto(data.submission.photoUrl);
                AsyncStorage.setItem(`@disposal_photo_${today}`, data.submission.photoUrl).catch(() => {});
              }
            } else {
              AsyncStorage.getItem(`@disposal_snapped_${today}`).then((val) => {
                if (val !== "true") {
                  setHasSnappedToday(false);
                  setTodayDisposalPhoto(null);
                }
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }
    };

    syncDailyState();
    const unsubscribe = navigation?.addListener ? navigation.addListener("focus", syncDailyState) : undefined;
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, navigation]);

  // Check if today's pickup already happened (only flags complete if no truck is actively collecting)
  useEffect(() => {
    const brgy = user?.barangay;
    if (!brgy) return;
    fetch(`${API_URL}/api/pickup?barangay=${encodeURIComponent(brgy)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const today = getTodayYMD();
        const done = data.some((run) => {
          const ts = run.createdAt || run.completedAt;
          return ts && ts.slice(0, 10) === today;
        });
        if (done && (!trucks || !trucks.some((t) => (t.status || "").toLowerCase() === "online"))) {
          setTodayPickupDone(true);
        }
      })
      .catch(() => {});
  }, [user?.barangay, trucks]);

  const aqData = useMemo(() => {
    const order = { critical: 0, moderate: 1, clean: 2 };
    const aqMap = {
      Hazardous: 'critical',
      Unhealthy: 'critical',
      Critical: 'critical',
      Moderate: 'moderate',
      Good: 'clean',
      Clean: 'clean',
    };
    if (latestIotReading) {
      return {
        status: aqMap[latestIotReading.airQuality] || 'clean',
        airQuality: latestIotReading.airQuality || 'Good',
        ammonia: latestIotReading.ammonia != null ? `${latestIotReading.ammonia} ppm` : '0 ppm',
        methane: latestIotReading.methane != null && latestIotReading.methane > 0
          ? `${latestIotReading.methane}%`
          : '0%',
        rawValue: latestIotReading.rawValue != null ? latestIotReading.rawValue : null,
        sensorId: latestIotReading.sensorId,
        location: latestIotReading.location,
      };
    }
    if (iotAreas.length > 0) {
      const worstArea = [...iotAreas].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3))[0];
      return {
        status: worstArea.status || 'clean',
        airQuality: worstArea.status === 'critical' ? 'Poor' : worstArea.status === 'moderate' ? 'Moderate' : 'Good',
        ammonia: worstArea.ammonia ? (typeof worstArea.ammonia === 'number' ? `${worstArea.ammonia} ppm` : worstArea.ammonia) : '0 ppm',
        methane: worstArea.methane ? (typeof worstArea.methane === 'number' ? `${worstArea.methane}%` : worstArea.methane) : '0%',
        rawValue: null,
        sensorId: worstArea.sensorId,
        location: worstArea.name,
      };
    }
    return null;
  }, [iotAreas, latestIotReading]);

  const chartBars = useMemo(() => {
    if (iotReadingsHistory && iotReadingsHistory.length > 0) {
      // iotReadingsHistory is descending (newest first). Slice 7 and reverse for chronological order
      const items = [...iotReadingsHistory].slice(0, 7).reverse();
      const padCount = Math.max(0, 7 - items.length);
      const padded = [];
      for (let p = 0; p < padCount; p++) {
        padded.push({
          id: `pad-${p}`,
          height: 24,
          color: "#A7F3D0",
          airQuality: "Good",
        });
      }

      const activeBars = items.map((item, idx) => {
        const isAlert =
          item.airQuality === 'Unhealthy' ||
          item.airQuality === 'Hazardous' ||
          item.airQuality === 'Critical';
        const isWarn = item.airQuality === 'Moderate';
        const color = isAlert ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981';

        let height = 28;
        if (item.rawValue != null && item.rawValue > 0) {
          height = Math.min(88, Math.max(20, Math.round((item.rawValue / 900) * 68 + 20)));
        } else if (item.ammonia != null && item.ammonia > 0) {
          height = Math.min(88, Math.max(20, Math.round(item.ammonia * 2 + 18)));
        } else if (isAlert) {
          height = 78;
        } else if (isWarn) {
          height = 50;
        } else {
          height = 28;
        }

        return {
          id: item._id || `active-${idx}`,
          height,
          color,
          airQuality: item.airQuality,
        };
      });

      return [...padded, ...activeBars];
    }

    return [
      { id: 1, height: 26, color: "#10B981" },
      { id: 2, height: 32, color: "#10B981" },
      { id: 3, height: 24, color: "#10B981" },
      { id: 4, height: 36, color: "#10B981" },
      { id: 5, height: 28, color: "#10B981" },
      { id: 6, height: 30, color: "#10B981" },
      { id: 7, height: 34, color: "#10B981" },
    ];
  }, [iotReadingsHistory]);

  const fetchDashboard = useCallback(async () => {
    try {
      const today = getTodayYMD();
      const brgy = user?.barangay || "Apas";
      const fetchLiveTrucks = async () => {
        try {
          const rLoc = await fetch(`${API_URL}/api/trucks/locations`);
          if (rLoc.ok) {
            const dLoc = await rLoc.json();
            if (Array.isArray(dLoc) && dLoc.length > 0) return dLoc;
          }
        } catch (_) {}
        try {
          const rAct = await fetch(`${API_URL}/api/trucks/active`);
          if (rAct.ok) {
            const dAct = await rAct.json();
            if (Array.isArray(dAct) && dAct.length > 0) return dAct;
          }
        } catch (_) {}
        try {
          const rGen = await fetch(`${API_URL}/api/trucks`);
          if (rGen.ok) return await rGen.json();
        } catch (_) {}
        return [];
      };

      const [trucksRes, schedulesRes, reportsRes, iotRes] = await Promise.allSettled([
        fetchLiveTrucks(),
        fetch(`${API_URL}/api/schedules/today?date=${today}`).then((r) =>
          r.json(),
        ),
        fetch(`${API_URL}/api/reports`).then((r) => r.json()),
        fetch(`${API_URL}/api/iot/readings?barangay=${encodeURIComponent(brgy)}&limit=7`).then((r) => r.json()),
      ]);

      if (trucksRes.status === "fulfilled" && Array.isArray(trucksRes.value)) {
        // Sort by most recently updated, online first
        const sorted = [...trucksRes.value].map(t => ({
          ...t,
          status: t.status || t.liveStatus || (t.lat && t.lng && Number(t.lat) !== 0 ? "online" : "offline")
        })).sort((a, b) => {
          if (a.status === "online" && b.status !== "online") return -1;
          if (b.status === "online" && a.status !== "online") return 1;
          return new Date(b.updatedAt || b.lastSeen || 0) - new Date(a.updatedAt || a.lastSeen || 0);
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

      if (iotRes.status === "fulfilled" && Array.isArray(iotRes.value) && iotRes.value.length > 0) {
        setLatestIotReading(iotRes.value[0]);
        setIotReadingsHistory(iotRes.value);
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

  // Get device location for proximity checks (request permissions and fallback gracefully)
  useEffect(() => {
    let isMounted = true;
    const acquireLocation = async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
        }
        if (status === "granted") {
          const last = await Location.getLastKnownPositionAsync();
          if (last && isMounted) {
            const loc = { lat: last.coords.latitude, lng: last.coords.longitude };
            setUserLocation(loc);
            userLocationRef.current = loc;
          }
          const curr = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (curr && isMounted) {
            const loc = { lat: curr.coords.latitude, lng: curr.coords.longitude };
            setUserLocation(loc);
            userLocationRef.current = loc;
          }
        } else {
          const bKey = (user?.barangay || "").trim().toLowerCase();
          const fallback = CEBU_COORDS[bKey] || CEBU_COORDS.default;
          if (isMounted) {
            setUserLocation(fallback);
            userLocationRef.current = fallback;
          }
        }
      } catch (_) {
        const bKey = (user?.barangay || "").trim().toLowerCase();
        const fallback = CEBU_COORDS[bKey] || CEBU_COORDS.default;
        if (isMounted) {
          setUserLocation(fallback);
          userLocationRef.current = fallback;
        }
      }
    };
    acquireLocation();
    return () => {
      isMounted = false;
    };
  }, [user?.barangay]);

  // Real-time truck updates via socket
  useEffect(() => {
    const socket = io(API_URL, { transports: ["polling", "websocket"] });

    // Join personal room for targeted events (points, rewards, report updates)
    if (user?.id) {
      socket.emit("resident:join", { residentId: user.id });
    }

    socket.on("resident:points:update", ({ pointsEarned, description, newTotal }) => {
      clearTimeout(pointsToastTimerRef.current);
      setPointsToast({ pointsEarned, description, newTotal });
      pointsToastTimerRef.current = setTimeout(() => setPointsToast(null), 5000);
    });

    socket.on("report:updated", (report) => {
      if (report.userId && report.userId === userIdRef.current && report.status === "resolved") {
        clearTimeout(pointsToastTimerRef.current);
        setPointsToast({ pointsEarned: 10, description: "Your report was resolved!", newTotal: null });
        pointsToastTimerRef.current = setTimeout(() => setPointsToast(null), 6000);
        Notifications.scheduleNotificationAsync({
          content: {
            title: "Report Resolved!",
            body: `Your report "${report.title || report.category}" has been resolved. +10 points earned!`,
            sound: true,
          },
          trigger: null,
        }).catch(() => {});
      }
    });

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

      // Live truck position update: clear stale pickup-done flag since collection is actively ongoing
      setTodayPickupDone(false);
    });

    socket.on("truck:status", async ({ truckId, status }) => {
      setTrucks((prev) =>
        prev.map((t) => (t.truckId === truckId ? { ...t, status } : t)),
      );
      if (status === "offline" && truckId) {
        truckAlertFiredRef.current.delete(`near-${truckId}`);
        truckAlertFiredRef.current.delete(`approach-${truckId}`);
        clearTimeout(toastTimerRef.current);
        setToastMsg(`Truck ${truckId} is now offline.`);
        toastTimerRef.current = setTimeout(() => setToastMsg(null), 5000);

        const notifId = `truck-offline-${truckId}`;
        const now = Date.now();
        const lastFired = activeNotifDebounceRef.current.get(notifId) || 0;

        // Debounce duplicate socket emissions arriving within 10 seconds
        if (now - lastFired < 10000) return;
        activeNotifDebounceRef.current.set(notifId, now);

        try {
          // Check if notification with this ID or title is already popping up / presented
          const presented = await Notifications.getPresentedNotificationsAsync().catch(() => []);
          const isAlreadyPoppingUp = presented.some(
            (n) =>
              n.request?.identifier === notifId ||
              (n.request?.content?.title === "Truck Offline" &&
                n.request?.content?.body?.includes(truckId))
          );

          if (!isAlreadyPoppingUp) {
            await Notifications.scheduleNotificationAsync({
              identifier: notifId,
              content: {
                title: "Truck Offline",
                body: `Truck ${truckId} is currently offline (app closed or wifi disconnected).`,
                sound: true,
              },
              trigger: null,
            });
          }
        } catch (_) {}
      }
    });

    socket.on("garbage-area:updated", (area) => {
      const brgy = userBarangayRef.current;
      if (brgy && area.barangay && area.barangay !== brgy) return;
      setIotAreas((prev) => {
        const idx = prev.findIndex((a) => a._id === area._id);
        return idx >= 0
          ? prev.map((a) => (a._id === area._id ? area : a))
          : [...prev, area];
      });
    });

    socket.on("iot:reading", (reading) => {
      const brgy = userBarangayRef.current;
      if (brgy && reading.barangay && reading.barangay !== brgy) return;
      setLatestIotReading(reading);
      setIotReadingsHistory((prev) => [reading, ...prev.filter((r) => r._id !== reading._id).slice(0, 6)]);
    });

    socket.on("truck:clearing:update", (data) => {
      if (data.status === "clearing") {
        clearTimeout(toastTimerRef.current);
        setToastMsg(`🧹 Waste Clearing in Progress at ${data.sitioName} (${data.truckId})`);
        toastTimerRef.current = setTimeout(() => setToastMsg(null), 10000);
      }
    });

    socket.on("route:completed", (data) => {
      if (userBarangayRef.current && data.barangay?.toLowerCase() === userBarangayRef.current.toLowerCase()) {
        setTodayPickupDone(true);
        clearTimeout(toastTimerRef.current);
        setToastMsg(`🎉 Route Finished! Waste collection complete for today in ${data.barangay}. +10 Eco-Points earned!`);
        toastTimerRef.current = setTimeout(() => setToastMsg(null), 12000);
      }
    });

    socket.on("pickup:completed", (run) => {
      if (userBarangayRef.current && run.barangay === userBarangayRef.current) {
        setTodayPickupDone(true);
      }
    });

    socket.on("schedule:changed", () => {
      fetchDashboard();
    });

    socket.on("schedules:updated", () => {
      fetchDashboard();
    });

    socket.on("collection:new", (newLog) => {
      fetchDashboard();
      if (newLog && (newLog.stopName || newLog.sitioName)) {
        setLatestPickupFeed({
          sitioName: newLog.stopName || newLog.sitioName,
          truckId: newLog.truckId,
          driverName: newLog.driverName,
          barangay: newLog.barangay,
          time: new Date(newLog.completedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
    });

    socket.on("schedule:task:completed", (data) => {
      fetchDashboard();
      if (data && data.sitioName) {
        setLatestPickupFeed({
          sitioName: data.sitioName,
          truckId: data.truckId,
          driverName: data.driverName,
          barangay: data.barangay,
          time: new Date(data.completedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
    });

    socket.on("resident:photo:deleted", ({ residentId, message }) => {
      if (residentId === userIdRef.current) {
        setOfficialNoticeText(
          message || "LGU Official reviewed & cleared your disposal photo validation. Your streak & earned points remain completely safe!"
        );
        setOfficialNoticeVisible(true);
      }
    });

    socket.on("task:completed", () => {
      fetchDashboard();
    });

    socket.on("bin:status:update", () => {
      const today = getTodayYMD();
      AsyncStorage.getItem(`@bin_prepared_${today}`)
        .then((val) => {
          if (val === "true") setBinReady(true);
        })
        .catch(() => {});
    });

    return () => {
      socket.disconnect();
      clearTimeout(toastTimerRef.current);
      clearTimeout(pointsToastTimerRef.current);
    };
  }, [fetchDashboard]);

  const isTruckOnline = (t) => {
    if (!t) return false;
    const st = (t.status || "").trim().toLowerCase();
    if (st === "online" || st === "active" || st === "collecting" || st === "en-route" || st === "in-transit") {
      return true;
    }
    if (t.updatedAt) {
      const diffMs = Date.now() - new Date(t.updatedAt).getTime();
      if (!isNaN(diffMs) && diffMs < 10 * 60 * 1000) return true;
    }
    return false;
  };

  const onlineTrucks = useMemo(() => {
    return trucks.filter(isTruckOnline);
  }, [trucks]);

  const nearestTruck = useMemo(() => {
    if (!onlineTrucks || onlineTrucks.length === 0) return null;
    if (!userLocation || userLocation.lat == null) return onlineTrucks[0];
    let closest = null;
    let minDist = Infinity;
    for (const t of onlineTrucks) {
      if (t.lat != null && t.lng != null) {
        const d = getDistanceM(userLocation.lat, userLocation.lng, t.lat, t.lng);
        if (d < minDist) {
          minDist = d;
          closest = t;
        }
      }
    }
    return closest || onlineTrucks[0];
  }, [onlineTrucks, userLocation]);

  const firstSchedule = todaySchedules[0] || null;

  const activeTruckId = useMemo(() => {
    return (
      nearestTruck?.truckId ||
      nearestTruck?.plateNumber ||
      firstSchedule?.truckId ||
      onlineTrucks[0]?.truckId ||
      (trucks.length > 0 ? (trucks[0].truckId || trucks[0].plateNumber) : null) ||
      "GT-001"
    );
  }, [nearestTruck, firstSchedule, onlineTrucks, trucks]);

  // Distance in meters to the nearest online truck (null if no location or truck)
  const distToTruck = useMemo(() => {
    if (!nearestTruck?.lat || !userLocation?.lat) return null;
    return Math.round(
      getDistanceM(
        userLocation.lat,
        userLocation.lng,
        nearestTruck.lat,
        nearestTruck.lng,
      ),
    );
  }, [nearestTruck, userLocation]);

  const scheduledWasteType = useMemo(() => {
    const raw = (firstSchedule?.wasteType || todaySchedules[0]?.wasteType || "").trim();
    const lower = raw.toLowerCase();
    if (lower.includes("di") || lower.includes("non") || lower.includes("recycl")) {
      return "Di-Malata";
    }
    if (lower.includes("malata") || lower.includes("bio") || lower.includes("organ")) {
      return "Malata";
    }
    return raw || "Malata";
  }, [firstSchedule, todaySchedules]);

  // Sync checklist items dynamically to today's active collection stream
  useEffect(() => {
    let source = GENERAL_CHECKLIST_ITEMS;
    if (scheduledWasteType === "Malata") {
      source = MALATA_CHECKLIST_ITEMS;
    } else if (scheduledWasteType === "Di-Malata") {
      source = DI_MALATA_CHECKLIST_ITEMS;
    }
    setChecklist(source.map((item) => ({ ...item, checked: false })));
  }, [scheduledWasteType]);

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
    const today = getTodayYMD();
    setBinReady(true);
    setModalVisible(false);
    AsyncStorage.setItem(`@bin_prepared_${today}`, 'true').catch(() => {});
    if (user?.id && user?.barangay) {
      fetch(`${API_URL}/api/bin/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId: user.id, barangay: user.barangay }),
      }).catch(() => {});
    }
  };

  const handleOpenModal = () => {
    if (binReady) return;
    if (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed") {
      Alert.alert(
        "Route Completed",
        "The garbage truck has already completed its collection route in your area for today.",
        [{ text: "OK" }],
      );
      return;
    }
    if (onlineTrucks.length === 0) {
      Alert.alert(
        "Truck Not Active",
        "You can only prepare your bin when a garbage truck is actively collecting in your area. Please wait until a truck starts its route.",
        [{ text: "OK" }],
      );
      return;
    }
    setModalVisible(true);
  };

  const handleTrashPickedUp = () => {
    const today = getTodayYMD();
    setTodayPickedUp(true);
    AsyncStorage.setItem(`@bin_pickedup_${today}`, 'true').catch(() => {});
    if (user?.id && user?.barangay) {
      fetch(`${API_URL}/api/bin/pickedup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId: user.id, barangay: user.barangay }),
      }).catch(() => {});
    }
    if (nearestTruck) {
      truckAlertFiredRef.current.delete(`near-${nearestTruck.truckId}`);
      truckAlertFiredRef.current.delete(`approach-${nearestTruck.truckId}`);
    }
    clearTimeout(toastTimerRef.current);
    setToastMsg("✓ Trash collected — thank you for participating!");
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 5000);
    notifyPickupComplete();
  };

  // Real route stops visual driven by actual driver's route/schedule
  const routeStopsData = useMemo(() => {
    const sched = firstSchedule || todaySchedules[0];
    let stops = [];

    if (sched?.sitioTasks && sched.sitioTasks.length > 0) {
      stops = sched.sitioTasks.map((t) => ({
        name: t.name,
        completed: !!t.completed,
      }));
    } else if (sched?.sitios && sched.sitios.length > 0) {
      stops = sched.sitios.map((name) => ({
        name,
        completed: sched.status === "completed",
      }));
    }

    if (stops.length === 0) {
      if (sched?.barangay || user?.barangay) {
        const brgy = sched?.barangay || user?.barangay;
        stops = [
          { name: `${brgy} Main`, completed: sched?.status === "completed" },
          { name: `${brgy} Route`, completed: false },
        ];
      } else {
        stops = [
          { name: "Scheduled Route", completed: false },
        ];
      }
    }

    // Determine current active stop index (first pending stop)
    let activeIndex = stops.findIndex((s) => !s.completed);
    if (activeIndex === -1 && stops.length > 0) {
      activeIndex = stops.length - 1;
    }

    const hasActiveTruck = onlineTrucks.length > 0 || !!nearestTruck;

    return stops.map((stop, index) => {
      const isDone = stop.completed;
      const isActive = !isDone && (index === activeIndex) && hasActiveTruck;

      let statusLabel = "UPCOMING";
      let icon = "place";

      if (isDone) {
        statusLabel = "CLEANED ✓";
        icon = "check-circle";
      } else if (isActive) {
        statusLabel = distToTruck != null && distToTruck < 350 ? "NEARBY" : "APPROACHING";
        icon = "local-shipping";
      } else {
        statusLabel = "UPCOMING";
        icon = "place";
      }

      return {
        name: stop.name,
        status: statusLabel,
        isCompleted: isDone,
        isActive,
        icon,
        highlighted: isDone || isActive,
      };
    });
  }, [firstSchedule, todaySchedules, onlineTrucks.length, nearestTruck, distToTruck, user?.barangay]);

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

    // AQ CRITICAL: Poor air quality in barangay
    if (aqData?.status === 'critical') {
      return {
        insight: `⚠ Poor air quality detected in ${user?.barangay || 'your area'}! Consider staying indoors and avoid prolonged outdoor exposure.`,
        variant: "worrying"
      };
    }

    // AQ MODERATE: Moderate air quality
    if (aqData?.status === 'moderate') {
      return {
        insight: `Air quality is moderate in ${user?.barangay || 'your area'}. Sensitive groups should limit outdoor activities.`,
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
  }, [distToTruck, onlineTrucks.length, firstSchedule, binReady, t, aqData, user?.barangay, latestIotReading]);

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

  const isRouteCompleted = useMemo(() => {
    if (todayPickupDone) return true;
    if (firstSchedule?.status === "completed") return true;
    const brgy = user?.barangay?.trim()?.toLowerCase();
    if (brgy && todaySchedules.length > 0) {
      const userScheds = todaySchedules.filter(
        (s) =>
          (s.barangay && s.barangay.trim().toLowerCase() === brgy) ||
          (s.routeName && s.routeName.toLowerCase().includes(brgy))
      );
      if (userScheds.length > 0) {
        return userScheds.every(
          (s) =>
            s.status === "completed" ||
            (s.sitioTasks?.length > 0 && s.sitioTasks.every((t) => t.completed))
        );
      }
    }
    if (todaySchedules.length > 0) {
      return todaySchedules.every((s) => s.status === "completed");
    }
    return false;
  }, [todayPickupDone, todaySchedules, user?.barangay, firstSchedule]);

  const isTruckCollecting = useMemo(() => {
    return onlineTrucks.length > 0;
  }, [onlineTrucks.length]);

  const isTruckNear = useMemo(() => {
    return distToTruck !== null && distToTruck <= 1500;
  }, [distToTruck]);

  const isTruckActiveNearby = isTruckCollecting;

  const isTruckNearOrActive = useMemo(() => {
    // 1. Must have at least one online truck
    if (!onlineTrucks || onlineTrucks.length === 0) return false;

    // 2. If the truck is physically nearby (within 2.5 km), ALWAYS active & near!
    if (distToTruck !== null && distToTruck <= 2500) {
      return true;
    }

    // 3. If there is a schedule for the resident's barangay and any truck is online
    const brgy = user?.barangay?.trim()?.toLowerCase();
    if (brgy && todaySchedules && todaySchedules.length > 0) {
      const brgySched = todaySchedules.find(
        (s) =>
          (s.barangay && s.barangay.trim().toLowerCase() === brgy) ||
          (s.routeName && s.routeName.toLowerCase().includes(brgy))
      );
      if (brgySched) {
        return true;
      }
    }

    // 4. Default: Any online truck in the system means collection is active
    if (onlineTrucks.length > 0) {
      return true;
    }

    return false;
  }, [onlineTrucks, distToTruck, user?.barangay, todaySchedules]);

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

  useEffect(() => {
    if (!user) {
      navigation.navigate("Map");
    }
  }, [user]);

  if (!user) {
    return null;
  }

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

      {/* Points toast — shows when resident earns points */}
      {pointsToast && (
        <View style={[styles.pointsToast, { top: toastMsg ? 134 : 80 }]}>
          <Ionicons name="star" size={16} color="#FFFFFF" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.pointsToastTitle}>+{pointsToast.pointsEarned} pts earned!</Text>
            <Text style={styles.pointsToastSub} numberOfLines={1}>{pointsToast.description}</Text>
          </View>
          {pointsToast.newTotal != null && (
            <Text style={styles.pointsToastTotal}>{pointsToast.newTotal} total</Text>
          )}
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
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.headerTitleText}>G-TRASH</Text>
            <Text style={styles.headerSubTitleText}>CLEANER CEBU, GREENER TOMORROW</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => navigation.navigate("Notifications")}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color="#1E293B" />
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

          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => navigation.navigate("Profile")}
            activeOpacity={0.7}
          >
            <MaterialIcons name="person" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>
            {user ? `${getGreeting(t)}, ${firstName}!` : "Welcome to G-Trash!"}
          </Text>
          <Text style={styles.subtitle}>
            {onlineTrucks.length > 0
              ? t("trucks_active", { count: onlineTrucks.length })
              : t("no_trucks_active")}
          </Text>
        </View>

        {/* 3-Column Resident Status Card (Vector Icons Only) */}
        <View style={styles.statusThreeColCard}>
          {/* Col 1: Streak */}
          <View style={styles.statusColItem}>
            <View style={[styles.statusColIconWrap, { backgroundColor: "#FFF7ED" }]}>
              <MaterialIcons name="local-fire-department" size={20} color="#F97316" />
            </View>
            <Text style={styles.statusColValue}>
              {user ? `${disposalStreak} Days` : "0 Days"}
            </Text>
            <Text style={styles.statusColLabel}>Disposal Streak</Text>
          </View>

          <View style={styles.statusColDivider} />

          {/* Col 2: Points */}
          <View style={styles.statusColItem}>
            <View style={[styles.statusColIconWrap, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="star" size={19} color="#D97706" />
            </View>
            <Text style={styles.statusColValue}>
              {user ? `${userPoints} Pts` : "0 Pts"}
            </Text>
            <Text style={styles.statusColLabel}>Eco Points</Text>
          </View>

          <View style={styles.statusColDivider} />

          {/* Col 3: Community Posted */}
          <TouchableOpacity
            style={styles.statusColItem}
            onPress={() => navigation.navigate("Community")}
            activeOpacity={0.7}
          >
            <View style={[styles.statusColIconWrap, { backgroundColor: "#EFF6FF" }]}>
              <MaterialIcons name="campaign" size={20} color="#2563EB" />
            </View>
            <Text style={styles.statusColValue}>
              {communityPostsCount} {communityPostsCount === 1 ? "Post" : "Posts"}
            </Text>
            <Text style={styles.statusColLabel}>Community Posted</Text>
          </TouchableOpacity>
        </View>

        {/* Pre-Information Live Pickup Feed Banner */}
        {latestPickupFeed && (
          <View style={styles.pickupPreInfoCard}>
            <View style={styles.pickupPreInfoHeader}>
              <View style={styles.pickupPreInfoIconWrap}>
                <MaterialIcons name="check-circle" size={20} color="#006A3B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickupPreInfoTitle}>
                  Waste Collected — Sitio {latestPickupFeed.sitioName}
                </Text>
                <Text style={styles.pickupPreInfoSub}>
                  Truck {latestPickupFeed.truckId} completed pickup at {latestPickupFeed.time}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setLatestPickupFeed(null)}>
                <Ionicons name="close" size={18} color="#6F7A70" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Pickup completion congratulation or Missed Pickup Banner */}
        {todayPickupDone && !isTruckNearOrActive && binReady && (
          <View style={styles.pickupDoneBanner}>
            <MaterialIcons name="check-circle" size={22} color="#006A3B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.pickupDoneTitle}>Collection Complete!</Text>
              <Text style={styles.pickupDoneSubtitle}>
                Today's pickup for {user?.barangay || 'your barangay'} is done. Good job disposing your trash!
              </Text>
            </View>
          </View>
        )}

        {todayPickupDone && !isTruckNearOrActive && !binReady && (
          <View style={styles.missedPickupBanner}>
            <View style={styles.missedPickupHeader}>
              <View style={styles.missedPickupIconWrap}>
                <MaterialIcons name="event-busy" size={22} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.missedPickupTitle}>You Missed Today's Collection Truck</Text>
                <Text style={styles.missedPickupSub}>
                  The garbage truck finished collection in {user?.barangay || 'your area'} before your bin was prepared.
                </Text>
              </View>
            </View>
            <View style={styles.missedPickupActions}>
              <TouchableOpacity
                style={styles.missedReportBtn}
                onPress={() => navigation.navigate("Report")}
                activeOpacity={0.8}
              >
                <MaterialIcons name="report-problem" size={15} color="#92400E" />
                <Text style={styles.missedReportBtnText}>Report Missed Pickup</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.missedSchedBtn}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="event" size={15} color="#374151" />
                <Text style={styles.missedSchedBtnText}>View Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* DAILY GARBAGE DISPOSAL & BIN PREPARATION CARD (RESIDENT WORKFLOW) */}
        {isTruckNearOrActive && (
          <View style={styles.proximityCard}>
            <View style={styles.proximityCardHeader}>
              <View
                style={[
                  styles.proximityBadgePill,
                  hasSnappedToday && { backgroundColor: "#ECFDF5" },
                  (!hasSnappedToday && (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed")) && {
                    backgroundColor: "#F3F4F6",
                  },
                ]}
              >
                <View
                  style={[
                    styles.livePulseDot,
                    hasSnappedToday && { backgroundColor: "#059669" },
                    (!hasSnappedToday && (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed")) && {
                      backgroundColor: "#9CA3AF",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.proximityBadgeText,
                    hasSnappedToday && { color: "#047857" },
                    (!hasSnappedToday && (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed")) && {
                      color: "#4B5563",
                    },
                  ]}
                >
                  {hasSnappedToday
                    ? "PREPARED & VERIFIED (1/DAY)"
                    : (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed")
                    ? "COLLECTION ROUTE COMPLETED"
                    : isTruckNear
                    ? (distToTruck != null && distToTruck < 350 ? "TRUCK AT YOUR STREET" : "TRUCK NEARBY")
                    : isTruckCollecting
                    ? "TRUCK ACTIVE IN AREA"
                    : "TRUCK ONLINE"}
                </Text>
              </View>
              <View
                style={[
                  styles.streakTagPill,
                  hasSnappedToday
                    ? { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }
                    : (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed")
                    ? { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }
                    : { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
                ]}
              >
                <MaterialIcons
                  name={
                    hasSnappedToday
                      ? "check-circle"
                      : (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed")
                      ? "task-alt"
                      : "emoji-events"
                  }
                  size={14}
                  color={
                    hasSnappedToday
                      ? "#059669"
                      : (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed")
                      ? "#6B7280"
                      : "#059669"
                  }
                />
                <Text
                  style={[
                    styles.streakTagText,
                    {
                      color: hasSnappedToday
                        ? "#059669"
                        : (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed")
                        ? "#6B7280"
                        : "#059669",
                    },
                  ]}
                >
                  {hasSnappedToday
                    ? "Resets Tomorrow"
                    : (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed")
                    ? "Finished for Today"
                    : "+10 Eco Pts"}
                </Text>
              </View>
            </View>

            <Text style={styles.proximityCardTitle}>
              {hasSnappedToday
                ? "Garbage Disposal Prepared ✓"
                : (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed")
                ? "Collection Route Completed ✓"
                : "Garbage Disposal Preparation"}
            </Text>
            <Text style={styles.proximityCardSub}>
              {hasSnappedToday
                ? "You have already completed your segregation checklist and submitted your bin photo for today! Resets tomorrow at midnight."
                : (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed")
                ? "The collection truck has already completed its route in your area for today. Bin preparation is closed until the next scheduled collection."
                : "Complete your waste segregation checklist and snap a photo of your prepared bin to earn points and notify the collection crew."}
            </Text>

            {/* If user snapped a photo today, show the thumbnail preview in the card */}
            {(todayDisposalPhoto || selectedPhoto) && hasSnappedToday && (
              <View style={{ marginTop: 12, marginBottom: 8, borderRadius: 12, overflow: 'hidden', height: 160, position: 'relative' }}>
                <Image
                  source={{ uri: todayDisposalPhoto || selectedPhoto }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
                <View style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  backgroundColor: 'rgba(5, 150, 105, 0.9)',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                  <MaterialIcons name="verified" size={14} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>
                    Disposal Verified
                  </Text>
                </View>
                <View style={{
                  position: 'absolute',
                  bottom: 10,
                  left: 10,
                  right: 10,
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                    {user?.barangay || 'Curb'} • {scheduledWasteType} Waste
                  </Text>
                  <Text style={{ color: '#FCD34D', fontSize: 11, fontWeight: '700' }}>
                    +10 Pts
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.proximityActionsRow}>
              {hasSnappedToday ? (
                <TouchableOpacity
                  style={[
                    styles.proximityBtnPrimary,
                    { backgroundColor: "#ECFDF5", borderWidth: 1.5, borderColor: "#10B981", flex: 1 },
                  ]}
                  onPress={() => {
                    if (todayDisposalPhoto || selectedPhoto) {
                      setSelectedPhoto(todayDisposalPhoto || selectedPhoto);
                      setPhotoPreviewVisible(true);
                    } else {
                      Alert.alert(
                        "Daily Snap Recorded",
                        "You have already prepared your bin and submitted your photo for today.\n\nResets tomorrow at midnight!"
                      );
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="check-circle" size={18} color="#059669" />
                  <Text style={[styles.proximityBtnPrimaryText, { color: "#059669" }]} numberOfLines={1}>
                    {todayDisposalPhoto || selectedPhoto ? "View Prepared Bin Photo ✓" : "Bin Prepared Today ✓"}
                  </Text>
                </TouchableOpacity>
              ) : (isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed") ? (
                <View
                  style={[
                    styles.proximityBtnPrimary,
                    { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB", flex: 1 },
                  ]}
                >
                  <MaterialIcons name="check-circle" size={18} color="#6B7280" />
                  <Text style={[styles.proximityBtnPrimaryText, { color: "#6B7280" }]} numberOfLines={1}>
                    Route Completed ✓
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.proximityBtnPrimary, { flex: 1 }]}
                  onPress={handleOpenModal}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="checklist" size={18} color="#FFFFFF" />
                  <Text style={styles.proximityBtnPrimaryText} numberOfLines={1}>
                    Prepare My Bin
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Bento Grid Cards */}
        <View style={styles.cardGrid}>
          {/* Air Quality Card */}
          {(() => {
            const isCritical =
              aqData?.status === "critical" ||
              aqData?.airQuality === "Unhealthy" ||
              aqData?.airQuality === "Hazardous" ||
              aqData?.airQuality === "Critical";
            const isModerate =
              aqData?.status === "moderate" ||
              aqData?.airQuality === "Moderate";
            const activeLevel = isCritical ? 3 : isModerate ? 2 : 1;
            const dotColor = isCritical
              ? "#E53935"
              : isModerate
              ? "#F59E0B"
              : aqData
              ? "#10B981"
              : "#9CA3AF";
            const statusLabel =
              aqData?.airQuality ||
              (isCritical
                ? "Poor"
                : isModerate
                ? "Moderate"
                : aqData
                ? "Good"
                : "No data");
            const statusColor = isCritical
              ? "#DC2626"
              : isModerate
              ? "#92400E"
              : aqData
              ? "#065F46"
              : "#6B7280";
            return (
              <View style={styles.airQualityCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{t("air_quality")}</Text>
                    <View style={styles.statusRow}>
                      <View
                        style={[styles.statusDot, { backgroundColor: dotColor }]}
                      />
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {`Level ${activeLevel} · ${statusLabel}`}
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons name="air" size={28} color="#6B7280" />
                </View>

                {/* Mini Chart */}
                <View style={styles.chartContainer}>
                  {chartBars.map((bar, i) => (
                    <View
                      key={bar.id || i}
                      style={[
                        styles.chartBar,
                        { height: bar.height, backgroundColor: bar.color },
                      ]}
                    />
                  ))}
                </View>

                {/* 3 Levels of Air Quality */}
                <View style={styles.levelsContainer}>
                  {[
                    {
                      level: 1,
                      label: "Good",
                      sub: "Clean",
                      color: "#10B981",
                      bg: "#ECFDF5",
                      border: "#10B981",
                    },
                    {
                      level: 2,
                      label: "Moderate",
                      sub: "Fair",
                      color: "#F59E0B",
                      bg: "#FFFBEB",
                      border: "#F59E0B",
                    },
                    {
                      level: 3,
                      label: "Poor",
                      sub: "Alert",
                      color: "#EF4444",
                      bg: "#FEF2F2",
                      border: "#EF4444",
                    },
                  ].map((lvl) => {
                    const isActive = activeLevel === lvl.level;
                    return (
                      <View
                        key={lvl.level}
                        style={[
                          styles.levelCard,
                          isActive
                            ? {
                                backgroundColor: lvl.bg,
                                borderColor: lvl.border,
                                borderWidth: 1.5,
                              }
                            : styles.levelCardInactive,
                        ]}
                      >
                        <View style={styles.levelBadgeRow}>
                          <View
                            style={[
                              styles.levelDot,
                              { backgroundColor: isActive ? lvl.color : "#9CA3AF" },
                            ]}
                          />
                          <Text
                            style={[
                              styles.levelNumText,
                              { color: isActive ? lvl.color : "#9CA3AF" },
                            ]}
                          >
                            Level {lvl.level}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.levelTitleText,
                            {
                              color: isActive ? "#111827" : "#6B7280",
                              fontWeight: isActive ? "700" : "500",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {lvl.label}
                        </Text>
                        <Text
                          style={[
                            styles.levelSubText,
                            { color: isActive ? lvl.color : "#9CA3AF" },
                          ]}
                          numberOfLines={1}
                        >
                          {lvl.sub}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}

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
                      Today {firstSchedule.startTime ? `· ${firstSchedule.startTime}` : "· Scheduled"}
                    </Text>
                  ) : (
                    <Text style={styles.collectionTime}>
                      No collection today
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.collectionDetails}>
                <View style={[styles.detailRow, { flexDirection: "column", alignItems: "flex-start", gap: 4 }]}>
                  <Text style={styles.detailLabel}>Route</Text>
                  <Text style={[styles.detailValue, { textAlign: "left", width: "100%", marginTop: 2 }]}>
                    {firstSchedule?.routeName || "—"}
                  </Text>
                </View>
                {firstSchedule && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Waste Category</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <MaterialIcons
                        name={firstSchedule.wasteType === "Di-Malata" ? "recycling" : "eco"}
                        size={15}
                        color={firstSchedule.wasteType === "Di-Malata" ? "#93C5FD" : "#A7F3D0"}
                      />
                      <Text style={[styles.detailValue, { color: firstSchedule.wasteType === "Di-Malata" ? "#BFDBFE" : "#D1FAE5", fontWeight: "800" }]}>
                        {firstSchedule.wasteType === "Di-Malata" ? "DI-MALATA (Non-Bio)" : "MALATA (Biodegradable)"}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Driver</Text>
                  <Text style={styles.detailValue}>
                    {firstSchedule?.driverName || "—"}
                  </Text>
                </View>
              </View>

              {(() => {
                const isCompleted = isRouteCompleted || todayPickupDone || firstSchedule?.status === "completed";
                const truckActive = onlineTrucks.length > 0;
                const canPrepare = firstSchedule && truckActive && !binReady && !isCompleted;
                const btnStyle = binReady
                  ? styles.prepareButtonReady
                  : isCompleted
                    ? styles.prepareButtonLocked
                    : (!firstSchedule || !truckActive)
                      ? styles.prepareButtonLocked
                      : null;
                return (
                  <TouchableOpacity
                    style={[styles.prepareButton, btnStyle]}
                    onPress={canPrepare ? handleOpenModal : (isCompleted ? () => {
                      Alert.alert(
                        "Route Completed",
                        "The garbage truck has already completed its collection route in your area for today.",
                        [{ text: "OK" }],
                      );
                    } : undefined)}
                    activeOpacity={canPrepare ? 0.8 : 1}
                    disabled={!canPrepare && !isCompleted}
                  >
                    <View style={styles.prepareButtonInner}>
                      <MaterialIcons
                        name={binReady ? "check-circle" : isCompleted ? "check-circle" : firstSchedule && !truckActive ? "lock" : "delete-outline"}
                        size={18}
                        color={binReady ? "#006A3B" : isCompleted ? "#6B7280" : (!firstSchedule || !truckActive) ? "#9CA3AF" : "#006A3B"}
                      />
                      <Text style={[
                        styles.prepareButtonText,
                        (isCompleted || (!firstSchedule || !truckActive)) && !binReady && styles.prepareButtonTextLocked,
                      ]}>
                        {binReady
                          ? "Bin Ready ✓"
                          : isCompleted
                            ? "Route Completed ✓"
                            : !firstSchedule
                              ? t("no_activity")
                              : !truckActive
                                ? "Waiting for truck..."
                                : t("prepare_bin")}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })()}
            </View>

            <View style={styles.decorativeIcon}>
              <MaterialIcons name="recycling" size={80} color="#1D6B39" />
            </View>
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
      </ScrollView>

      {/* Bin Prep Modal with Dedicated Segregation Teaching */}
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

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <View style={styles.modalTitleRow}>
                <View style={[
                  styles.modalIconWrap,
                  scheduledWasteType === "Di-Malata" && { backgroundColor: "#EFF6FF" },
                ]}>
                  <MaterialIcons
                    name={scheduledWasteType === "Di-Malata" ? "recycling" : "delete-outline"}
                    size={22}
                    color={scheduledWasteType === "Di-Malata" ? "#1D4ED8" : "#006A3B"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Prepare Your Bin</Text>
                  <Text style={styles.modalSubtitle}>
                    {scheduledWasteType === "Malata"
                      ? "Today's Collection: MALATA (Biodegradable Only)"
                      : scheduledWasteType === "Di-Malata"
                      ? "Today's Collection: DI-MALATA (Non-Biodegradable Only)"
                      : "Today's Collection: General / Scheduled Route"}
                  </Text>
                </View>
              </View>

              {/* Dedicated Sorting Teacher Section */}
              {scheduledWasteType === "Malata" ? (
                <View style={styles.sortingTeacherCardMalata}>
                  <View style={styles.sortingTeacherHeader}>
                    <MaterialIcons name="eco" size={20} color="#047857" />
                    <Text style={styles.sortingTeacherTitleMalata}>
                      🌱 FOCUS ON MALATA TODAY (Biodegradable)
                    </Text>
                  </View>
                  <Text style={styles.sortingTeacherSubtitle}>
                    The collection truck is accepting organic & kitchen waste only today. Keep all plastics and recyclables stored for Di-Malata day!
                  </Text>

                  <View style={styles.sortingSplitGrid}>
                    <View style={styles.sortingAcceptCol}>
                      <View style={styles.sortingColHeaderRow}>
                        <MaterialIcons name="check-circle" size={14} color="#059669" />
                        <Text style={styles.sortingColHeaderAccept}>PUT IN BIN TODAY</Text>
                      </View>
                      <Text style={styles.sortingItemBullet}>• Leftover cooked food & rice</Text>
                      <Text style={styles.sortingItemBullet}>• Fruit & vegetable peelings</Text>
                      <Text style={styles.sortingItemBullet}>• Fish & meat bones / scraps</Text>
                      <Text style={styles.sortingItemBullet}>• Eggshells & coffee grounds</Text>
                      <Text style={styles.sortingItemBullet}>• Fallen leaves & plant cuttings</Text>
                    </View>

                    <View style={styles.sortingRejectCol}>
                      <View style={styles.sortingColHeaderRow}>
                        <MaterialIcons name="cancel" size={14} color="#DC2626" />
                        <Text style={styles.sortingColHeaderReject}>HOLD FOR DI-MALATA</Text>
                      </View>
                      <Text style={styles.sortingItemBulletReject}>• Plastic bags & wrappers</Text>
                      <Text style={styles.sortingItemBulletReject}>• Bottles, cups & straws</Text>
                      <Text style={styles.sortingItemBulletReject}>• Tin cans & foil packs</Text>
                      <Text style={styles.sortingItemBulletReject}>• Cardboard & paper boxes</Text>
                      <Text style={styles.sortingItemBulletReject}>• Diapers & hazardous waste</Text>
                    </View>
                  </View>

                  <View style={styles.sortingTipBannerMalata}>
                    <MaterialIcons name="tips-and-updates" size={16} color="#047857" />
                    <Text style={styles.sortingTipTextMalata}>
                      💡 Compost Rule: Clean organic waste is turned into barangay fertilizer! Do not mix plastic bags.
                    </Text>
                  </View>
                </View>
              ) : scheduledWasteType === "Di-Malata" ? (
                <View style={styles.sortingTeacherCardDiMalata}>
                  <View style={styles.sortingTeacherHeader}>
                    <MaterialIcons name="recycling" size={20} color="#1D4ED8" />
                    <Text style={styles.sortingTeacherTitleDiMalata}>
                      ♻️ FOCUS ON DI-MALATA TODAY (Recyclables)
                    </Text>
                  </View>
                  <Text style={styles.sortingTeacherSubtitle}>
                    The collection truck is accepting dry recyclables & non-biodegradable items. Hold all wet food waste for Malata day!
                  </Text>

                  <View style={styles.sortingSplitGrid}>
                    <View style={styles.sortingAcceptColBlue}>
                      <View style={styles.sortingColHeaderRow}>
                        <MaterialIcons name="check-circle" size={14} color="#2563EB" />
                        <Text style={styles.sortingColHeaderAcceptBlue}>PUT IN BIN TODAY</Text>
                      </View>
                      <Text style={styles.sortingItemBullet}>• Plastic bottles & beverage cups</Text>
                      <Text style={styles.sortingItemBullet}>• Tin cans & soda cans</Text>
                      <Text style={styles.sortingItemBullet}>• Cardboard boxes & cartons</Text>
                      <Text style={styles.sortingItemBullet}>• Clean dry wrappers & plastic</Text>
                      <Text style={styles.sortingItemBullet}>• Glass bottles & containers</Text>
                    </View>

                    <View style={styles.sortingRejectCol}>
                      <View style={styles.sortingColHeaderRow}>
                        <MaterialIcons name="cancel" size={14} color="#DC2626" />
                        <Text style={styles.sortingColHeaderReject}>HOLD FOR MALATA</Text>
                      </View>
                      <Text style={styles.sortingItemBulletReject}>• Wet leftover food & rice</Text>
                      <Text style={styles.sortingItemBulletReject}>• Fruit & vegetable peelings</Text>
                      <Text style={styles.sortingItemBulletReject}>• Raw meat & fish waste</Text>
                      <Text style={styles.sortingItemBulletReject}>• Wet yard waste & soil</Text>
                    </View>
                  </View>

                  <View style={styles.sortingTipBannerDiMalata}>
                    <MaterialIcons name="tips-and-updates" size={16} color="#1D4ED8" />
                    <Text style={styles.sortingTipTextDiMalata}>
                      💡 Recycler Tip: Rinse food containers and flatten boxes to save space in the truck!
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.sortingTeacherCardGeneral}>
                  <View style={styles.sortingTeacherHeader}>
                    <MaterialIcons name="alt-route" size={20} color="#006A3B" />
                    <Text style={styles.sortingTeacherTitleGeneral}>
                      🗑️ SEPARATE WASTE PROPERLY
                    </Text>
                  </View>
                  <Text style={styles.sortingTeacherSubtitle}>
                    Separate organic biodegradables (Malata) from dry recyclables (Di-Malata) into distinct bags or bins.
                  </Text>
                </View>
              )}

              {/* Pre-Collection Checklist */}
              <View style={styles.checklistHeaderWrap}>
                <Text style={styles.checklistSectionTitle}>Pre-Collection Checklist</Text>
                <Text style={styles.checklistSectionSub}>Tap items to confirm your bin is properly sorted</Text>
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

              {/* Step 2 / Final Step: Photo Verification */}
              {!allChecked ? (
                <View style={styles.snapPromptLockedCard}>
                  <View style={styles.snapPromptLockedIconWrap}>
                    <MaterialIcons name="camera-alt" size={20} color="#9CA3AF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.snapPromptLockedTitle}>Step 2: Snap Bin Photo Proof</Text>
                    <Text style={styles.snapPromptLockedSub}>
                      Check all {checklist.length} items above to unlock photo capture & verify your bin.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.snapPromptActiveCard}>
                  <View style={styles.snapPromptHeaderRow}>
                    <View style={styles.snapPromptActiveIconWrap}>
                      <MaterialIcons name="camera-alt" size={22} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.snapPromptActiveTitle}>Final Step: Snap Bin Photo Proof</Text>
                      <Text style={styles.snapPromptActiveSub}>
                        All items checked! Take a photo of your sorted bin at the curb to verify preparation, notify the collection crew, and earn +10 Eco Points.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.snapActionRow}>
                    <TouchableOpacity
                      style={styles.snapActionBtnPrimary}
                      onPress={handleTakePhoto}
                      activeOpacity={0.85}
                    >
                      <MaterialIcons name="photo-camera" size={18} color="#FFFFFF" />
                      <Text style={styles.snapActionBtnPrimaryText}>Take Bin Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.snapActionBtnSecondary}
                      onPress={handlePickPhoto}
                      activeOpacity={0.85}
                    >
                      <MaterialIcons name="photo-library" size={18} color="#006A3B" />
                      <Text style={styles.snapActionBtnSecondaryText}>From Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!allChecked && (
                <TouchableOpacity
                  style={[styles.confirmBtn, styles.confirmBtnDisabled]}
                  disabled={true}
                  activeOpacity={1}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <MaterialIcons name="lock" size={16} color="#FFFFFF" />
                    <Text style={styles.confirmBtnText}>
                      Check all items to proceed ({checkedCount}/{checklist.length})
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Story-Style Photo Overlay Preview Modal */}
      <Modal
        visible={photoPreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPreviewVisible(false)}
      >
        <View style={styles.modalOverlayDark}>
          <View style={styles.stravaPreviewContainer}>
            <Text style={styles.stravaHeaderTitle}>Disposal Story Photo</Text>
            <Text style={styles.stravaHeaderSub}>Save to device or share to your stories</Text>

            {selectedPhoto && (
              <View style={styles.stravaCardWrap}>
                <Image source={{ uri: selectedPhoto }} style={styles.stravaImage} resizeMode="cover" />

                {/* Top Glass Badges */}
                <View style={styles.stravaOverlayTop}>
                  <View style={styles.glassPill}>
                    <MaterialIcons name="location-on" size={13} color="#10B981" />
                    <Text style={styles.glassPillText} numberOfLines={1}>
                      {user?.barangay || "Community Curb"} • Just Now
                    </Text>
                  </View>
                  <View style={styles.verifiedPill}>
                    <MaterialIcons name="verified" size={13} color="#FFFFFF" />
                    <Text style={styles.verifiedPillText}>{activeTruckId || "Truck Active"}</Text>
                  </View>
                </View>

                {/* Motivation Live Overlay Badge */}
                <View style={styles.stravaMotivationBadge}>
                  <MaterialIcons name="local-fire-department" size={14} color="#F59E0B" />
                  <Text style={styles.stravaMotivationBadgeText} numberOfLines={1}>
                    Motivation: {selectedMotivation}
                  </Text>
                </View>

                {/* Bottom Glass Badges */}
                <View style={styles.stravaOverlayBottom}>
                  <View style={styles.streakOverlayBadge}>
                    <Text style={styles.overlayIcon}>🗑️</Text>
                    <View>
                      <Text style={styles.overlayLabel}>STREAM</Text>
                      <Text style={styles.overlayValue}>{scheduledWasteType}</Text>
                    </View>
                  </View>

                  <View style={styles.pointsOverlayBadge}>
                    <Text style={styles.overlayIcon}>🌱</Text>
                    <View>
                      <Text style={styles.overlayLabel}>COMMUNITY</Text>
                      <Text style={styles.overlayValue}>Cleaner Cebu</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Motivation Feedback Selector */}
            <View style={styles.motivationSection}>
              <View style={styles.motivationHeaderRow}>
                <MaterialIcons name="psychology" size={16} color="#006A3B" />
                <Text style={styles.motivationSectionTitle}>
                  What motivated you to dispose your trash today?
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.motivationChipsScroll}
              >
                {MOTIVATION_OPTIONS.map((opt) => {
                  const isSelected = selectedMotivation === opt.label;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.motivationChip,
                        isSelected && styles.motivationChipSelected,
                      ]}
                      onPress={() => setSelectedMotivation(opt.label)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name={opt.icon}
                        size={14}
                        color={isSelected ? "#FFFFFF" : opt.color}
                      />
                      <Text
                        style={[
                          styles.motivationChipText,
                          isSelected && styles.motivationChipTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <MaterialIcons name="check-circle" size={13} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.stravaActionsRow}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => {
                  setPhotoPreviewVisible(false);
                  setProximityModalVisible(true);
                }}
              >
                <MaterialIcons name="refresh" size={18} color="#4B5563" />
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitDisposalBtn, isSubmittingDisposal && { opacity: 0.7 }]}
                onPress={handleShareOrSavePhoto}
                disabled={isSubmittingDisposal}
                activeOpacity={0.85}
              >
                {isSubmittingDisposal ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="cloud-upload" size={18} color="#FFFFFF" />
                    <Text style={styles.submitDisposalBtnText}>Submit & Share</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Celebration Modal */}
      <Modal
        visible={celebrationVisible}
        transparent
        animationType="bounce"
        onRequestClose={() => setCelebrationVisible(false)}
      >
        <View style={styles.modalOverlayDark}>
          <ConfettiExplosion visible={celebrationVisible} />
          <View style={styles.celebrationCard}>
            <View style={styles.celebrationTrophyWrap}>
              <Text style={{ fontSize: 44 }}>🏆</Text>
            </View>
            <Text style={styles.celebrationTitle}>Trash Disposed!</Text>
            <Text style={styles.celebrationMessage}>
              {celebrationData?.message || `Awesome job! Your trash disposal is verified and your ${disposalStreak}-day streak is active!`}
            </Text>

            {celebrationData?.motivation && (
              <View style={styles.celebrationMotivationPill}>
                <MaterialIcons name="lightbulb" size={15} color="#059669" />
                <Text style={styles.celebrationMotivationText}>
                  Motivation: {celebrationData.motivation}
                </Text>
              </View>
            )}

            <View style={styles.rewardSummaryBox}>
              <View style={styles.rewardSummaryItem}>
                <Text style={styles.rewardSummaryIcon}>🔥</Text>
                <Text style={styles.rewardSummaryValue}>{disposalStreak} Days</Text>
                <Text style={styles.rewardSummaryLabel}>Disposal Streak</Text>
              </View>
              <View style={styles.rewardSummaryDivider} />
              <View style={styles.rewardSummaryItem}>
                <Text style={styles.rewardSummaryIcon}>🌟</Text>
                <Text style={styles.rewardSummaryValue}>
                  {celebrationData?.awardPoints ? `+${celebrationData.awardPoints}` : "Verified"}
                </Text>
                <Text style={styles.rewardSummaryLabel}>Eco Points</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.celebrationCloseBtn}
              onPress={() => setCelebrationVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.celebrationCloseBtnText}>Awesome! 🌟</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* LGU Official Clearance Notice Modal */}
      <Modal
        visible={officialNoticeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOfficialNoticeVisible(false)}
      >
        <View style={styles.modalOverlayDark}>
          <View style={styles.officialNoticeCard}>
            <View style={styles.officialNoticeIconWrap}>
              <MaterialIcons name="verified-user" size={32} color="#006A3B" />
            </View>
            <Text style={styles.officialNoticeTitle}>Photo Review Updated</Text>
            <Text style={styles.officialNoticeMessage}>
              {officialNoticeText || "LGU Official reviewed & cleared your disposal photo validation. Your streak & earned points remain safe!"}
            </Text>

            <TouchableOpacity
              style={styles.officialNoticeCloseBtn}
              onPress={() => setOfficialNoticeVisible(false)}
            >
              <Text style={styles.officialNoticeCloseBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Guest Sign-In Notice Modal */}
      <Modal
        visible={guestNoticeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGuestNoticeVisible(false)}
      >
        <View style={styles.modalOverlayDark}>
          <View style={styles.officialNoticeCard}>
            <View style={[styles.officialNoticeIconWrap, { backgroundColor: "#FEF3C7" }]}>
              <MaterialIcons name="stars" size={32} color="#D97706" />
            </View>
            <Text style={styles.officialNoticeTitle}>Sign In to Get Started</Text>
            <Text style={styles.officialNoticeMessage}>
              You are currently in Guest Mode. Sign in or create an account to prepare your bin and track garbage collection in real time!
            </Text>

            <TouchableOpacity
              style={[styles.officialNoticeCloseBtn, { marginBottom: 10 }]}
              onPress={() => {
                setGuestNoticeVisible(false);
                navigation.navigate("Login");
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.officialNoticeCloseBtnText}>Sign In / Register</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => setGuestNoticeVisible(false)}
            >
              <Text style={styles.retakeBtnText}>Continue Tracking as Guest</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    width: 32,
    height: 32,
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#006A3B",
    letterSpacing: 0.5,
    lineHeight: 18,
  },
  headerSubTitleText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 0.5,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#006A3B",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
  pickupDoneBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FFF4",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 14,
    marginBottom: 16,
  },
  pickupDoneTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#065F46",
  },
  pickupDoneSubtitle: {
    fontSize: 12,
    color: "#047857",
    marginTop: 2,
    lineHeight: 16,
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
  levelsContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  levelCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  levelCardInactive: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
    opacity: 0.65,
  },
  levelBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  levelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  levelNumText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  levelTitleText: {
    fontSize: 12,
    marginTop: 2,
  },
  levelSubText: {
    fontSize: 9,
    fontWeight: "600",
    marginTop: 1,
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
  prepareButtonLocked: {
    backgroundColor: "#F3F4F6",
  },
  prepareButtonTextLocked: {
    color: "#9CA3AF",
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
  sortingTeacherCardMalata: {
    backgroundColor: "#ECFDF5",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    padding: 14,
    marginBottom: 16,
  },
  sortingTeacherCardDiMalata: {
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    padding: 14,
    marginBottom: 16,
  },
  sortingTeacherCardGeneral: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 16,
  },
  sortingTeacherHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sortingTeacherTitleMalata: {
    fontSize: 13,
    fontWeight: "800",
    color: "#065F46",
    letterSpacing: -0.2,
  },
  sortingTeacherTitleDiMalata: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E40AF",
    letterSpacing: -0.2,
  },
  sortingTeacherTitleGeneral: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  sortingTeacherSubtitle: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 17,
    marginBottom: 12,
  },
  sortingSplitGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  sortingAcceptCol: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  sortingAcceptColBlue: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  sortingRejectCol: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  sortingColHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 4,
  },
  sortingColHeaderAccept: {
    fontSize: 9,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.2,
  },
  sortingColHeaderAcceptBlue: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.2,
  },
  sortingColHeaderReject: {
    fontSize: 9,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.2,
  },
  sortingItemBullet: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 15,
    marginTop: 2,
  },
  sortingItemBulletReject: {
    fontSize: 10,
    color: "#6B7280",
    lineHeight: 15,
    marginTop: 2,
  },
  sortingTipBannerMalata: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  sortingTipTextMalata: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#065F46",
    lineHeight: 15,
  },
  sortingTipBannerDiMalata: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DBEAFE",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  sortingTipTextDiMalata: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#1E40AF",
    lineHeight: 15,
  },
  checklistHeaderWrap: {
    marginTop: 4,
    marginBottom: 8,
  },
  checklistSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  checklistSectionSub: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
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
    top: 22,
  },
  zoneItem: {
    alignItems: "center",
    gap: 8,
    zIndex: 1,
  },
  zoneCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  zoneCircleHighlighted: {
    backgroundColor: "#006E1C",
    borderColor: "#86D896",
    shadowColor: "#006E1C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
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
  pointsToast: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#D97706",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 998,
  },
  pointsToastTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  pointsToastSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    marginTop: 1,
  },
  pointsToastTotal: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 8,
  },
  greetingSection: {
    marginBottom: 20,
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
  // 3-Column Status Card Styles
  statusThreeColCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  statusColItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusColIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statusColValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  statusColLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  statusColDivider: {
    width: 1,
    height: 38,
    backgroundColor: "#F1F5F9",
  },
  // Missed Pickup Banner Styles
  missedPickupBanner: {
    backgroundColor: "#FEF3C7",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  missedPickupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  missedPickupIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },
  missedPickupTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#92400E",
  },
  missedPickupSub: {
    fontSize: 12,
    color: "#B45309",
    marginTop: 2,
    lineHeight: 16,
    fontWeight: "500",
  },
  missedPickupActions: {
    flexDirection: "row",
    gap: 10,
  },
  missedReportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FDE68A",
    paddingVertical: 10,
    borderRadius: 12,
  },
  missedReportBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
  missedSchedBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  missedSchedBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },

  // Proximity Card Styles
  proximityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E6F4EA",
  },
  proximityCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  proximityBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  proximityBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
    letterSpacing: 0.5,
  },
  streakTagPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  streakTagIcon: {
    fontSize: 12,
  },
  streakTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#C2410C",
  },
  proximityCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  proximityCardSub: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 14,
  },
  proximityActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  proximityBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    borderRadius: 16,
    gap: 6,
  },
  proximityBtnSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#006A3B",
  },
  proximityBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006A3B",
    paddingVertical: 12,
    borderRadius: 16,
    gap: 6,
  },
  proximityBtnPrimaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Merged Step 2 Snap Photo Verification UI
  snapPromptLockedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
    gap: 12,
  },
  snapPromptLockedIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  snapPromptLockedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4B5563",
  },
  snapPromptLockedSub: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
    lineHeight: 16,
  },
  snapPromptActiveCard: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
  },
  snapPromptHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  snapPromptActiveIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  snapPromptActiveTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#065F46",
  },
  snapPromptActiveSub: {
    fontSize: 12,
    color: "#047857",
    marginTop: 2,
    lineHeight: 17,
  },
  snapActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  snapActionBtnPrimary: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006A3B",
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
  },
  snapActionBtnPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  snapActionBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#006A3B",
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
  },
  snapActionBtnSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#006A3B",
  },

  // Modal Choice Option Cards
  choiceOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  choiceIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  choiceOptionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  choiceOptionSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  // Dark Overlay & Strava Preview
  modalOverlayDark: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  stravaPreviewContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 20,
    alignItems: "center",
  },
  stravaHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  stravaHeaderSub: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    marginBottom: 16,
  },
  stravaCardWrap: {
    width: "100%",
    height: 260,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  stravaImage: {
    width: "100%",
    height: "100%",
  },
  stravaOverlayTop: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  glassPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
    maxWidth: "65%",
  },
  glassPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stravaOverlayBottom: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  streakOverlayBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(234, 88, 12, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 8,
  },
  pointsOverlayBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 8,
  },
  overlayIcon: {
    fontSize: 18,
  },
  overlayLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "rgba(255, 255, 255, 0.8)",
    letterSpacing: 0.5,
  },
  overlayValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  stravaMotivationBadge: {
    position: "absolute",
    top: 50,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(17, 24, 39, 0.82)",
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 5,
    maxWidth: "80%",
  },
  stravaMotivationBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FDE68A",
  },
  motivationSection: {
    width: "100%",
    marginTop: 14,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  motivationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  motivationSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F2937",
  },
  motivationChipsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  motivationChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  motivationChipSelected: {
    backgroundColor: "#006A3B",
    borderColor: "#006A3B",
  },
  motivationChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
  },
  motivationChipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  celebrationMotivationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
    marginBottom: 4,
    gap: 6,
  },
  celebrationMotivationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065F46",
  },
  stravaActionsRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
    marginTop: 14,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    borderRadius: 18,
    gap: 6,
  },
  retakeBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  submitDisposalBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006A3B",
    paddingVertical: 14,
    borderRadius: 18,
    gap: 6,
  },
  submitDisposalBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Celebration Modal Styles
  celebrationCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
  },
  celebrationTrophyWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  celebrationMessage: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  rewardSummaryBox: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: "100%",
    marginTop: 16,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  rewardSummaryItem: {
    alignItems: "center",
  },
  rewardSummaryIcon: {
    fontSize: 20,
  },
  rewardSummaryValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginTop: 2,
  },
  rewardSummaryLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
  },
  rewardSummaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E5E7EB",
  },
  celebrationCloseBtn: {
    width: "100%",
    backgroundColor: "#006A3B",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
  },
  celebrationCloseBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Official Notice Modal
  officialNoticeCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
  },
  officialNoticeIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  officialNoticeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  officialNoticeMessage: {
    fontSize: 13,
    color: "#4B5563",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 18,
  },
  officialNoticeCloseBtn: {
    width: "100%",
    backgroundColor: "#006A3B",
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
  },
  officialNoticeCloseBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Soft UI Streaks & Eco Points Hero Banner Styles
  streaksHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  streaksHeroItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  streaksHeroIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  streaksHeroValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  streaksHeroLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
  },
  streaksHeroDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 12,
  },
  streaksSnapBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#006A3B",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 6,
  },
  streaksSnapBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Status and Analysis Card Styles
  statusAnalysisCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E6F4EA",
  },
  statusAnalysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  statusAnalysisIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  statusAnalysisTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  statusAnalysisSub: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
  },
  livePillBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  livePillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  insightBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FFF4",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    gap: 10,
    marginBottom: 14,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: "#065F46",
    lineHeight: 18,
    fontWeight: "500",
  },
  analysisGrid: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  analysisStatItem: {
    flex: 1,
    alignItems: "center",
  },
  analysisStatDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "#E5E7EB",
  },
  analysisStatLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  analysisStatValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginTop: 2,
  },
  pickupPreInfoCard: {
    backgroundColor: "#EBF3EE",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#C8DDD4",
  },
  pickupPreInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pickupPreInfoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D5E7DD",
    justifyContent: "center",
    alignItems: "center",
  },
  pickupPreInfoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#006A3B",
  },
  pickupPreInfoSub: {
    fontSize: 12,
    color: "#404943",
    marginTop: 2,
  },
});
