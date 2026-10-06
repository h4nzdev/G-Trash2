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
  RefreshControl,
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
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { io } from "socket.io-client";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";
import colors from "../constants/colors";
import { HomeScreenSkeleton } from "../components/Skeleton";
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
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
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

const MOTIVATION_OPTIONS = [
  { id: "clean_barangay", label: "Clean Neighborhood", icon: "park", color: "#059669" },
  { id: "streak_points", label: "Points & Streak", icon: "emoji-events", color: "#D97706" },
  { id: "truck_on_time", label: "Truck On Time", icon: "local-shipping", color: "#2563EB" },
  { id: "flood_health", label: "Flood & Health Safety", icon: "health-and-safety", color: "#DC2626" },
  { id: "segregation_advocacy", label: "Proper Sorting Habit", icon: "recycling", color: "#7C3AED" },
];

const MALATA_CHECKLIST_ITEMS = [
  { id: 1, label: "Collect food scraps & organic waste into green bio-bin/bag" },
  { id: 2, label: "Ensure ZERO plastics, foil, bottles, or cans are mixed" },
  { id: 3, label: "Cover bio-bin securely to prevent pests and foul odors" },
  { id: 4, label: "Store plastics & dry recyclables for Di-Malata collection day" },
  { id: 5, label: "Place Malata bin outside at designated curb spot" },
];

const DI_MALATA_CHECKLIST_ITEMS = [
  { id: 1, label: "Separate clean dry recyclables (bottles, cans, cartons)" },
  { id: 2, label: "Rinse food and sauce residue from containers before placing" },
  { id: 3, label: "Flatten cardboard boxes and crush plastic bottles" },
  { id: 4, label: "Ensure ZERO wet kitchen or organic waste is mixed" },
  { id: 5, label: "Tie recyclable bag securely and place at curb spot" },
];

const GENERAL_CHECKLIST_ITEMS = [
  { id: 1, label: "Sort waste into designated bags (Malata vs Di-Malata)" },
  { id: 2, label: "Separate clean recyclables (plastics, paper, metal cans)" },
  { id: 3, label: "Rinse food containers before placing in the bin" },
  { id: 4, label: "Tie all trash bags securely to avoid spills and odors" },
  { id: 5, label: "Place bin at designated curb pickup spot on time" },
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

function ConfettiExplosion({ visible }) {
  const confettiAnims = useRef(
    Array.from({ length: 20 }).map(() => ({
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

        const targetX = (Math.random() - 0.5) * 240;
        const targetY = (Math.random() - 0.7) * 260;

        Animated.parallel([
          Animated.timing(anim.x, {
            toValue: targetX,
            duration: 1000 + Math.random() * 400,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(anim.y, {
              toValue: targetY,
              duration: 500 + Math.random() * 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim.y, {
              toValue: targetY + 100,
              duration: 700,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim.scale, {
            toValue: 0.8 + Math.random() * 0.4,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(800),
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 400,
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
        const size = 8 + (i % 3) * 3;
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
                borderRadius: isCircle ? size / 2 : 2,
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
  const activeNotifDebounceRef = useRef(new Map());

  // Animations
  const flameAnim = useRef(new Animated.Value(1)).current;
  const liveBeaconAnim = useRef(new Animated.Value(1)).current;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSegregationTab, setActiveSegregationTab] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [binReady, setBinReady] = useState(false);
  const [todayPickedUp, setTodayPickedUp] = useState(false);
  const [checklist, setChecklist] = useState(
    GENERAL_CHECKLIST_ITEMS.map((item) => ({ ...item, checked: false }))
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

  const handleTakePhoto = async () => {
    if (hasSnappedToday) {
      Alert.alert(
        "Daily Limit Reached",
        "You can only snap once per day! Your daily garbage disposal photo has already been submitted today."
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
        "You can only snap once per day! Your daily garbage disposal photo has already been submitted today."
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
        setPhotoPreviewVisible(true);
      }
    } catch (err) {
      Alert.alert("Gallery Error", "Could not launch photo library.");
    }
  };

  const handleShareOrSavePhoto = async () => {
    if (!selectedPhoto) return;
    if (hasSnappedToday) {
      Alert.alert("Daily Snap Completed", "You have already submitted your disposal photo for today.");
      setPhotoPreviewVisible(false);
      return;
    }

    setIsSubmittingDisposal(true);
    const today = getTodayYMD();

    try {
      let finalPhotoUrl = selectedPhoto;

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
          console.log("Image upload fallback:", upErr);
        }
      }

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
          Alert.alert("Daily Snap Recorded", "Your daily disposal photo is already recorded for today.");
          return;
        }

        if (subRes.ok) {
          if (subJson.newStreak != null) setDisposalStreak(subJson.newStreak);
          if (subJson.totalPoints != null) setUserPoints(subJson.totalPoints);
        }
      }

      if (user?.id && user?.barangay) {
        fetch(`${API_URL}/api/bin/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ residentId: user.id, barangay: user.barangay }),
        }).catch(() => {});
      }

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
        message: `Disposal verified! Your ${streakVal}-day streak is active. Thank you for sorting ${scheduledWasteType} waste!`,
        awardPoints: earnedPts,
        motivation: selectedMotivation,
      });
      setCelebrationVisible(true);

      try {
        await Share.share({
          title: "Garbage Disposal",
          message: `My ${scheduledWasteType} bin is prepared in Barangay ${user?.barangay || "Apas"}! 🗑️🚛 #CleanerCebu #GTrash`,
          url: selectedPhoto,
        });
      } catch (_) {}
    } catch (err) {
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
    }
  };

  // Fetch IoT data
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
        }
      })
      .catch(() => {});
  }, [user?.barangay]);

  // Sync daily local storage state
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

  const aqData = useMemo(() => {
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
        methane: latestIotReading.methane != null && latestIotReading.methane > 0 ? `${latestIotReading.methane}%` : '0%',
        rawValue: latestIotReading.rawValue != null ? latestIotReading.rawValue : null,
      };
    }
    if (iotAreas.length > 0) {
      const worstArea = [...iotAreas].sort((a, b) => (a.status === 'critical' ? -1 : 1))[0];
      return {
        status: worstArea.status || 'clean',
        airQuality: worstArea.status === 'critical' ? 'Poor' : worstArea.status === 'moderate' ? 'Moderate' : 'Good',
        ammonia: '0 ppm',
        methane: '0%',
        rawValue: null,
      };
    }
    return null;
  }, [iotAreas, latestIotReading]);

  const chartBars = useMemo(() => {
    if (iotReadingsHistory && iotReadingsHistory.length > 0) {
      const items = [...iotReadingsHistory].slice(0, 7).reverse();
      const padCount = Math.max(0, 7 - items.length);
      const padded = [];
      for (let p = 0; p < padCount; p++) {
        padded.push({ id: `pad-${p}`, height: 16, color: "#A7F3D0" });
      }

      const activeBars = items.map((item, idx) => {
        const isAlert = item.airQuality === 'Unhealthy' || item.airQuality === 'Hazardous' || item.airQuality === 'Critical';
        const isWarn = item.airQuality === 'Moderate';
        const color = isAlert ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981';
        let height = isAlert ? 42 : isWarn ? 28 : 16;
        if (item.rawValue != null && item.rawValue > 0) {
          height = Math.min(48, Math.max(12, Math.round((item.rawValue / 900) * 36 + 12)));
        }
        return { id: item._id || `active-${idx}`, height, color };
      });

      return [...padded, ...activeBars];
    }
    return [
      { id: 1, height: 16, color: "#10B981" },
      { id: 2, height: 22, color: "#10B981" },
      { id: 3, height: 16, color: "#10B981" },
      { id: 4, height: 28, color: "#10B981" },
      { id: 5, height: 20, color: "#10B981" },
      { id: 6, height: 24, color: "#10B981" },
      { id: 7, height: 18, color: "#10B981" },
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
        return [];
      };

      const [trucksRes, schedulesRes, reportsRes, iotRes] = await Promise.allSettled([
        fetchLiveTrucks(),
        fetch(`${API_URL}/api/schedules/today?date=${today}`).then((r) => r.json()),
        fetch(`${API_URL}/api/reports`).then((r) => r.json()),
        fetch(`${API_URL}/api/iot/readings?barangay=${encodeURIComponent(brgy)}&limit=7`).then((r) => r.json()),
      ]);

      if (trucksRes.status === "fulfilled" && Array.isArray(trucksRes.value)) {
        const sorted = [...trucksRes.value].map(t => ({
          ...t,
          status: t.status || t.liveStatus || (t.lat && t.lng && Number(t.lat) !== 0 ? "online" : "offline")
        })).sort((a, b) => {
          if (a.status === "online" && b.status !== "online") return -1;
          if (b.status === "online" && a.status !== "online") return 1;
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
        });
        setTrucks(sorted);
      }

      if (schedulesRes.status === "fulfilled" && Array.isArray(schedulesRes.value.schedules)) {
        setTodaySchedules(schedulesRes.value.schedules);
      }

      if (reportsRes.status === "fulfilled" && Array.isArray(reportsRes.value)) {
        setPendingCount(reportsRes.value.filter((r) => r.status !== "resolved").length);
      }

      if (iotRes.status === "fulfilled" && Array.isArray(iotRes.value) && iotRes.value.length > 0) {
        setLatestIotReading(iotRes.value[0]);
        setIotReadingsHistory(iotRes.value);
      }
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  }, [user?.barangay]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchDashboard();
    } catch (_) {
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchDashboard]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Location handling
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cachedRaw = await AsyncStorage.getItem("@gtrash_last_user_location");
        if (cachedRaw && isMounted) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed?.lat && parsed?.lng) {
            setUserLocation(parsed);
            userLocationRef.current = parsed;
          }
        }
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc?.coords && isMounted) {
            const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude };
            setUserLocation(pos);
            userLocationRef.current = pos;
            AsyncStorage.setItem("@gtrash_last_user_location", JSON.stringify(pos)).catch(() => {});
          }
        } else {
          const bKey = (user?.barangay || "").trim().toLowerCase();
          const fallback = CEBU_COORDS[bKey] || CEBU_COORDS.default;
          if (isMounted && !userLocationRef.current) {
            setUserLocation(fallback);
            userLocationRef.current = fallback;
          }
        }
      } catch (_) {}
    })();
    return () => { isMounted = false; };
  }, [user?.barangay]);

  // Real-time socket
  useEffect(() => {
    const socket = io(API_URL, { transports: ["polling", "websocket"] });

    if (user?.id) {
      socket.emit("resident:join", { residentId: user.id });
    }

    socket.on("resident:points:update", ({ pointsEarned, description, newTotal }) => {
      clearTimeout(pointsToastTimerRef.current);
      setPointsToast({ pointsEarned, description, newTotal });
      pointsToastTimerRef.current = setTimeout(() => setPointsToast(null), 4000);
    });

    socket.on("truck:location:update", ({ truckId, lat, lng }) => {
      setTrucks((prev) => {
        const exists = prev.some((t) => t.truckId === truckId);
        if (exists) {
          return prev.map((t) => (t.truckId === truckId ? { ...t, lat, lng, status: "online", updatedAt: new Date().toISOString() } : t));
        }
        return [{ truckId, lat, lng, status: "online", updatedAt: new Date().toISOString() }, ...prev];
      });
      setTodayPickupDone(false);
    });

    socket.on("truck:status", ({ truckId, status }) => {
      setTrucks((prev) => prev.map((t) => (t.truckId === truckId ? { ...t, status } : t)));
    });

    socket.on("route:completed", (data) => {
      if (userBarangayRef.current && data.barangay?.toLowerCase() === userBarangayRef.current.toLowerCase()) {
        setTodayPickupDone(true);
        clearTimeout(toastTimerRef.current);
        setToastMsg(`🎉 Route completed for today in ${data.barangay}!`);
        toastTimerRef.current = setTimeout(() => setToastMsg(null), 8000);
      }
    });

    socket.on("collection:new", (newLog) => {
      fetchDashboard();
      if (newLog && (newLog.stopName || newLog.sitioName)) {
        setLatestPickupFeed({
          sitioName: newLog.stopName || newLog.sitioName,
          truckId: newLog.truckId,
          time: new Date(newLog.completedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
    });

    socket.on("schedule:changed", () => { fetchDashboard(); });
    socket.on("schedules:updated", () => { fetchDashboard(); });

    return () => {
      socket.disconnect();
      clearTimeout(toastTimerRef.current);
      clearTimeout(pointsToastTimerRef.current);
    };
  }, [fetchDashboard, user?.id]);

  const isTruckOnline = (t) => {
    if (!t) return false;
    const st = (t.status || "").trim().toLowerCase();
    if (st === "online" || st === "active" || st === "collecting" || st === "en-route" || st === "in-transit") return true;
    if (t.updatedAt) {
      const diffMs = Date.now() - new Date(t.updatedAt).getTime();
      if (!isNaN(diffMs) && diffMs < 10 * 60 * 1000) return true;
    }
    return false;
  };

  const onlineTrucks = useMemo(() => trucks.filter(isTruckOnline), [trucks]);

  const nearestTruck = useMemo(() => {
    if (!onlineTrucks.length) return null;
    if (!userLocation?.lat) return onlineTrucks[0];
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
    return nearestTruck?.truckId || firstSchedule?.truckId || (onlineTrucks[0]?.truckId) || "GT-001";
  }, [nearestTruck, firstSchedule, onlineTrucks]);

  const distToTruck = useMemo(() => {
    if (!nearestTruck?.lat || !userLocation?.lat) return null;
    return Math.round(getDistanceM(userLocation.lat, userLocation.lng, nearestTruck.lat, nearestTruck.lng));
  }, [nearestTruck, userLocation]);

  const scheduledWasteType = useMemo(() => {
    const raw = (firstSchedule?.wasteType || todaySchedules[0]?.wasteType || "").trim();
    const lower = raw.toLowerCase();
    if (lower.includes("di") || lower.includes("non") || lower.includes("recycl")) return "Di-Malata";
    if (lower.includes("malata") || lower.includes("bio") || lower.includes("organ")) return "Malata";
    return raw || "Malata";
  }, [firstSchedule, todaySchedules]);

  useEffect(() => {
    let source = GENERAL_CHECKLIST_ITEMS;
    if (scheduledWasteType === "Malata") source = MALATA_CHECKLIST_ITEMS;
    else if (scheduledWasteType === "Di-Malata") source = DI_MALATA_CHECKLIST_ITEMS;
    setChecklist(source.map((item) => ({ ...item, checked: false })));
  }, [scheduledWasteType]);

  const toggleCheck = (id) => {
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
  };

  const allChecked = checklist.every((item) => item.checked);
  const checkedCount = checklist.filter((item) => item.checked).length;

  const isRouteCompleted = useMemo(() => {
    if (todayPickupDone) return true;
    if (firstSchedule?.status === "completed") return true;
    const brgy = user?.barangay?.trim()?.toLowerCase();
    if (brgy && todaySchedules.length > 0) {
      const userScheds = todaySchedules.filter(
        (s) => (s.barangay && s.barangay.trim().toLowerCase() === brgy) || (s.routeName && s.routeName.toLowerCase().includes(brgy))
      );
      if (userScheds.length > 0) {
        return userScheds.every((s) => s.status === "completed" || (s.sitioTasks?.length > 0 && s.sitioTasks.every((t) => t.completed)));
      }
    }
    return false;
  }, [todayPickupDone, todaySchedules, user?.barangay, firstSchedule]);

  const hasActiveTruckOrSchedule = useMemo(() => {
    return onlineTrucks.length > 0 || !!firstSchedule || todaySchedules.length > 0;
  }, [onlineTrucks.length, firstSchedule, todaySchedules]);

  const isTruckNear = useMemo(() => distToTruck !== null && distToTruck <= 1500, [distToTruck]);

  // Pulse & Flame micro-animations
  useEffect(() => {
    const flame = Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(flameAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    flame.start();

    const beacon = Animated.loop(
      Animated.sequence([
        Animated.timing(liveBeaconAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(liveBeaconAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    beacon.start();

    return () => {
      flame.stop();
      beacon.stop();
    };
  }, []);

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="light" backgroundColor="#006A3B" />

      {/* Toast Notification */}
      {toastMsg && (
        <View style={styles.toastContainer}>
          <MaterialIcons name="local-shipping" size={15} color="#FFFFFF" />
          <Text style={styles.toastText} numberOfLines={2}>{toastMsg}</Text>
        </View>
      )}

      {/* Points Toast */}
      {pointsToast && (
        <View style={styles.pointsToast}>
          <Ionicons name="star" size={15} color="#FFFFFF" />
          <Text style={styles.pointsToastText}>
            +{pointsToast.pointsEarned} pts! {pointsToast.description}
          </Text>
        </View>
      )}

      {/* Green Native Top App Bar */}
      <View style={styles.topAppBar}>
        <View style={styles.appBarLeft}>
          <Image source={require("../../assets/logo.png")} style={styles.appBarLogo} resizeMode="contain" />
          <View style={{ marginLeft: 7 }}>
            <Text style={styles.appBarTitle}>G-TRASH</Text>
            <Text style={styles.appBarSubtitle}>CEBU CITY</Text>
          </View>
        </View>

        <View style={styles.appBarRight}>
          <TouchableOpacity
            style={styles.appBarIconButton}
            onPress={() => navigation.navigate("Notifications")}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={19} color="#FFFFFF" />
            {pendingCount + truckAlertCount > 0 && (
              <View style={styles.badgeDot}>
                <Text style={styles.badgeDotText}>{pendingCount + truckAlertCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => navigation.navigate("Profile")}
            activeOpacity={0.7}
          >
            <MaterialIcons name="person" size={18} color="#006A3B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: "#F8FAFC" }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#006A3B"]}
            tintColor="#006A3B"
          />
        }
      >
        {isLoading ? (
          <HomeScreenSkeleton />
        ) : (
          <>
            {/* Greeting & Live Status Header */}
            <View style={styles.greetingHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greetingText}>
                  {getGreeting(t)}, {firstName}!
                </Text>
                <Text style={styles.barangaySubText} numberOfLines={1}>
                  📍 Barangay {user?.barangay || "Apas"}
                </Text>
              </View>

              {/* Compact Live Status Chip */}
              <View style={[
                styles.liveStatusPill,
                onlineTrucks.length > 0 ? styles.liveStatusPillGreen :
                isRouteCompleted ? styles.liveStatusPillGray : styles.liveStatusPillAmber
              ]}>
                <Animated.View
                  style={[
                    styles.liveDot,
                    onlineTrucks.length > 0 ? { backgroundColor: "#10B981", opacity: liveBeaconAnim } :
                    isRouteCompleted ? { backgroundColor: "#6B7280" } : { backgroundColor: "#F59E0B" }
                  ]}
                />
                <Text style={[
                  styles.liveStatusText,
                  onlineTrucks.length > 0 ? { color: "#065F46" } :
                  isRouteCompleted ? { color: "#4B5563" } : { color: "#92400E" }
                ]}>
                  {onlineTrucks.length > 0 ? "LIVE ROUTE" : isRouteCompleted ? "COMPLETED" : "STANDBY"}
                </Text>
              </View>
            </View>

            {/* Resident 3-Metric Bar (Streak, Eco Points, Community Posts) */}
            <View style={styles.metricsBar}>
              <View style={styles.metricColumn}>
                <Animated.View style={[styles.metricIconWrap, { backgroundColor: "#FFF7ED", transform: [{ scale: flameAnim }] }]}>
                  <MaterialIcons name="local-fire-department" size={16} color="#F97316" />
                </Animated.View>
                <Text style={styles.metricValText}>{disposalStreak}d</Text>
                <Text style={styles.metricLblText}>Streak</Text>
              </View>

              <View style={styles.metricDivider} />

              <TouchableOpacity style={styles.metricColumn} onPress={() => navigation.navigate("Profile")} activeOpacity={0.7}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="star" size={15} color="#D97706" />
                </View>
                <Text style={styles.metricValText}>{userPoints}</Text>
                <Text style={styles.metricLblText}>Points</Text>
              </TouchableOpacity>

              <View style={styles.metricDivider} />

              <TouchableOpacity style={styles.metricColumn} onPress={() => navigation.navigate("Community")} activeOpacity={0.7}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}>
                  <MaterialIcons name="campaign" size={16} color="#2563EB" />
                </View>
                <Text style={styles.metricValText}>{communityPostsCount}</Text>
                <Text style={styles.metricLblText}>Reports</Text>
              </TouchableOpacity>
            </View>

            {/* Live Collection Hero Card (Compact Native Proportions) */}
            <View style={styles.collectionHeroCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.streamBadge}>
                  <MaterialIcons
                    name={scheduledWasteType === "Di-Malata" ? "recycling" : "eco"}
                    size={13}
                    color={scheduledWasteType === "Di-Malata" ? "#1D4ED8" : "#047857"}
                  />
                  <Text style={[
                    styles.streamBadgeText,
                    { color: scheduledWasteType === "Di-Malata" ? "#1D4ED8" : "#047857" }
                  ]}>
                    {scheduledWasteType}
                  </Text>
                </View>

                <View style={styles.pointsBadge}>
                  <MaterialIcons name="emoji-events" size={12} color="#D97706" />
                  <Text style={styles.pointsBadgeText}>+10 Pts</Text>
                </View>
              </View>

              {/* Status summary */}
              <View style={styles.heroStatusRow}>
                <View style={[styles.heroTruckIconWrap, { backgroundColor: onlineTrucks.length > 0 ? "#ECFDF5" : "#F1F5F9" }]}>
                  <MaterialIcons name="local-shipping" size={24} color={onlineTrucks.length > 0 ? "#006A3B" : "#64748B"} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.heroMainTitle}>
                    {hasSnappedToday
                      ? "Bin Prepared & Verified ✓"
                      : isRouteCompleted
                      ? "Route Collection Completed"
                      : distToTruck !== null && distToTruck < 400
                      ? `Truck ${distToTruck}m Away (On Street!)`
                      : distToTruck !== null
                      ? `Truck ~${distToTruck}m Away (~${Math.ceil(distToTruck / 200)}m)`
                      : onlineTrucks.length > 0
                      ? `${onlineTrucks.length} Truck${onlineTrucks.length > 1 ? "s" : ""} Online in Area`
                      : "Standby for Collection"}
                  </Text>
                  <Text style={styles.heroSubText}>
                    {hasSnappedToday
                      ? "Disposal photo verified for today. Resets tomorrow."
                      : isRouteCompleted
                      ? "Trash collection in your area is finished for today."
                      : scheduledWasteType === "Di-Malata"
                      ? "Dry recyclables only. Keep wet kitchen waste stored."
                      : "Biodegradable organic waste. Please tie bags securely."}
                  </Text>
                </View>
              </View>

              {/* Verified photo thumbnail if snapped today */}
              {todayDisposalPhoto && hasSnappedToday && (
                <View style={styles.verifiedThumbnailRow}>
                  <Image source={{ uri: todayDisposalPhoto }} style={styles.verifiedThumbnailImg} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.verifiedThumbTitle}>Daily Proof Submitted ✓</Text>
                    <Text style={styles.verifiedThumbSub}>Verified at curb • +10 points earned</Text>
                  </View>
                </View>
              )}

              {/* CTA Action Button Row */}
              <View style={styles.heroActionButtons}>
                {hasSnappedToday ? (
                  <TouchableOpacity
                    style={[styles.primaryCtaBtn, { backgroundColor: "#ECFDF5" }]}
                    onPress={() => {
                      if (todayDisposalPhoto) {
                        setSelectedPhoto(todayDisposalPhoto);
                        setPhotoPreviewVisible(true);
                      } else {
                        Alert.alert("Daily Snap", "Your bin photo is verified for today!");
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="check-circle" size={16} color="#059669" />
                    <Text style={[styles.primaryCtaBtnText, { color: "#059669" }]}>View Proof</Text>
                  </TouchableOpacity>
                ) : (isRouteCompleted || todayPickupDone) ? (
                  <View style={[styles.primaryCtaBtn, { backgroundColor: "#F1F5F9" }]}>
                    <MaterialIcons name="check-circle" size={16} color="#64748B" />
                    <Text style={[styles.primaryCtaBtnText, { color: "#64748B" }]}>Finished ✓</Text>
                  </View>
                ) : hasActiveTruckOrSchedule ? (
                  <TouchableOpacity
                    style={styles.primaryCtaBtn}
                    onPress={() => setModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="checklist" size={16} color="#FFFFFF" />
                    <Text style={styles.primaryCtaBtnText}>Prepare Bin (+10 Pts)</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryCtaBtn, { backgroundColor: "#F1F5F9" }]}
                    onPress={() => navigation.navigate("Calendar")}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="event-note" size={16} color="#475569" />
                    <Text style={[styles.primaryCtaBtnText, { color: "#475569" }]}>View Schedule</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.secondaryCtaBtn}
                  onPress={() => navigation.navigate("Map")}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="navigation" size={15} color="#006A3B" />
                  <Text style={styles.secondaryCtaBtnText}>Track GPS</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Actions 4-Column Native Grid */}
            <View style={styles.quickGridContainer}>
              <TouchableOpacity
                style={styles.quickGridTile}
                onPress={() => {
                  if (hasActiveTruckOrSchedule) setModalVisible(true);
                  else navigation.navigate("Community");
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.quickGridIconWrap, { backgroundColor: "#ECFDF5" }]}>
                  <MaterialIcons name={hasActiveTruckOrSchedule ? "photo-camera" : "campaign"} size={20} color="#059669" />
                </View>
                <Text style={styles.quickGridLabel}>{hasActiveTruckOrSchedule ? "Daily Snap" : "Community"}</Text>
                <Text style={styles.quickGridSub}>{hasActiveTruckOrSchedule ? "+10 Pts" : "Feed"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickGridTile}
                onPress={() => navigation.navigate("Map")}
                activeOpacity={0.7}
              >
                <View style={[styles.quickGridIconWrap, { backgroundColor: "#EFF6FF" }]}>
                  <MaterialIcons name="map" size={20} color="#2563EB" />
                </View>
                <Text style={styles.quickGridLabel}>Live GPS</Text>
                <Text style={styles.quickGridSub}>Tracking</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickGridTile}
                onPress={() => navigation.navigate("Calendar")}
                activeOpacity={0.7}
              >
                <View style={[styles.quickGridIconWrap, { backgroundColor: "#FEF3C7" }]}>
                  <MaterialIcons name="event-note" size={20} color="#D97706" />
                </View>
                <Text style={styles.quickGridLabel}>Schedule</Text>
                <Text style={styles.quickGridSub}>Routes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickGridTile}
                onPress={() => navigation.navigate("Report")}
                activeOpacity={0.7}
              >
                <View style={[styles.quickGridIconWrap, { backgroundColor: "#FEE2E2" }]}>
                  <MaterialIcons name="report-problem" size={20} color="#DC2626" />
                </View>
                <Text style={styles.quickGridLabel}>Report</Text>
                <Text style={styles.quickGridSub}>File Issue</Text>
              </TouchableOpacity>
            </View>

            {/* Air Quality IoT Card (Compact & High-Density) */}
            {(() => {
              const isCritical = aqData?.status === "critical";
              const isModerate = aqData?.status === "moderate";
              const activeLevel = isCritical ? 3 : isModerate ? 2 : 1;
              const statusLabel = isCritical ? "Poor Quality" : isModerate ? "Moderate" : "Clean Air";
              const statusColor = isCritical ? "#DC2626" : isModerate ? "#D97706" : "#059669";

              return (
                <View style={styles.compactCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <MaterialIcons name="air" size={18} color="#475569" />
                      <Text style={styles.compactCardTitle}>Air Quality (Barangay {user?.barangay || "Apas"})</Text>
                    </View>
                    <View style={[styles.aqStatusPill, { borderColor: statusColor, backgroundColor: isCritical ? "#FEF2F2" : isModerate ? "#FFFBEB" : "#ECFDF5" }]}>
                      <View style={[styles.liveDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.aqStatusText, { color: statusColor }]}>
                        Level {activeLevel} • {statusLabel}
                      </Text>
                    </View>
                  </View>

                  {/* 7-Bar Sparkline Chart */}
                  <View style={styles.miniChartRow}>
                    {chartBars.map((bar, i) => (
                      <View key={bar.id || i} style={[styles.miniBar, { height: bar.height, backgroundColor: bar.color }]} />
                    ))}
                  </View>

                  {/* 3-Level Breakdown */}
                  <View style={styles.aqLevelColumns}>
                    {[
                      { level: 1, label: "Good", desc: "Clean", color: "#10B981", bg: "#ECFDF5" },
                      { level: 2, label: "Moderate", desc: "Caution", color: "#F59E0B", bg: "#FFFBEB" },
                      { level: 3, label: "Poor", desc: "Alert", color: "#EF4444", bg: "#FEF2F2" },
                    ].map((lvl) => {
                      const isCur = activeLevel === lvl.level;
                      return (
                        <View
                          key={lvl.level}
                          style={[
                            styles.aqLevelItem,
                            isCur ? { backgroundColor: lvl.bg, borderColor: lvl.color, borderWidth: 1.5 } : styles.aqLevelItemInactive,
                          ]}
                        >
                          <Text style={[styles.aqLevelNum, { color: isCur ? lvl.color : "#94A3B8" }]}>Lvl {lvl.level}</Text>
                          <Text style={[styles.aqLevelTitle, { color: isCur ? "#0F172A" : "#64748B" }]}>{lvl.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {/* Interactive Waste Segregation Guide (Compact Native Tabs) */}
            {(() => {
              const currentTab = activeSegregationTab || (scheduledWasteType === "Di-Malata" ? "di_malata" : "malata");
              const isMalata = currentTab === "malata";

              return (
                <View style={styles.compactCard}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={styles.compactCardTitle}>Waste Segregation Guide</Text>
                      <Text style={styles.compactCardSub}>Cebu City Solid Waste Guidelines</Text>
                    </View>
                    <View style={styles.streamBadge}>
                      <Text style={styles.streamBadgeText}>Today: {scheduledWasteType}</Text>
                    </View>
                  </View>

                  {/* Segmented Tab Control */}
                  <View style={styles.segTabsContainer}>
                    <TouchableOpacity
                      style={[styles.segTabButton, isMalata && styles.segTabButtonActiveMalata]}
                      onPress={() => setActiveSegregationTab("malata")}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="eco" size={14} color={isMalata ? "#047857" : "#64748B"} />
                      <Text style={[styles.segTabText, isMalata && styles.segTabTextActiveMalata]}>Malata (Bio)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.segTabButton, !isMalata && styles.segTabButtonActiveDiMalata]}
                      onPress={() => setActiveSegregationTab("di_malata")}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="recycling" size={14} color={!isMalata ? "#1D4ED8" : "#64748B"} />
                      <Text style={[styles.segTabText, !isMalata && styles.segTabTextActiveDiMalata]}>Di-Malata (Dry)</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Two-Column Accept vs Reject List */}
                  <View style={styles.segSplitGrid}>
                    <View style={[styles.segColBox, isMalata ? styles.segColBoxGreen : styles.segColBoxBlue]}>
                      <View style={styles.segColHead}>
                        <MaterialIcons name="check-circle" size={13} color={isMalata ? "#059669" : "#2563EB"} />
                        <Text style={[styles.segColHeadText, { color: isMalata ? "#059669" : "#2563EB" }]}>
                          {isMalata ? "PUT IN GREEN BIN" : "PUT IN DRY BIN"}
                        </Text>
                      </View>
                      <Text style={styles.segItemText}>• {isMalata ? "Leftover food & rice" : "Plastic bottles & cups"}</Text>
                      <Text style={styles.segItemText}>• {isMalata ? "Fruit & veggie peelings" : "Tin & soda cans"}</Text>
                      <Text style={styles.segItemText}>• {isMalata ? "Fish & meat bones" : "Cardboard boxes"}</Text>
                      <Text style={styles.segItemText}>• {isMalata ? "Garden leaves & twigs" : "Clean dry wrappers"}</Text>
                    </View>

                    <View style={[styles.segColBox, styles.segColBoxRed]}>
                      <View style={styles.segColHead}>
                        <MaterialIcons name="cancel" size={13} color="#DC2626" />
                        <Text style={[styles.segColHeadText, { color: "#DC2626" }]}>DO NOT MIX</Text>
                      </View>
                      <Text style={styles.segItemTextReject}>• {isMalata ? "Plastic wrappers & cups" : "Wet leftover food"}</Text>
                      <Text style={styles.segItemTextReject}>• {isMalata ? "Tin cans & bottles" : "Oily & greasy waste"}</Text>
                      <Text style={styles.segItemTextReject}>• {isMalata ? "Diapers & batteries" : "Garden soil & weeds"}</Text>
                      <Text style={styles.segItemTextReject}>• {isMalata ? "Styrofoam packs" : "Animal & meat waste"}</Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </>
        )}
      </ScrollView>

      {/* Prepare Bin Checklist Bottom Sheet Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheetContainer}>
            <View style={styles.sheetHandle} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalHeaderIconWrap}>
                  <MaterialIcons
                    name={scheduledWasteType === "Di-Malata" ? "recycling" : "delete-outline"}
                    size={20}
                    color={scheduledWasteType === "Di-Malata" ? "#1D4ED8" : "#006A3B"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitleText}>Prepare Your Bin</Text>
                  <Text style={styles.modalSubText}>Today's Stream: {scheduledWasteType} Collection</Text>
                </View>
              </View>

              {/* Checklist Items */}
              <Text style={styles.checklistSectionLabel}>Pre-Collection Checklist ({checkedCount}/{checklist.length})</Text>

              {checklist.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.checkRow}
                  onPress={() => toggleCheck(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkBox, item.checked && styles.checkBoxChecked]}>
                    {item.checked && <MaterialIcons name="check" size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.checkLabel, item.checked && styles.checkLabelDone]}>{item.label}</Text>
                </TouchableOpacity>
              ))}

              {/* Progress bar */}
              <View style={styles.sheetProgressTrack}>
                <View style={[styles.sheetProgressFill, { width: `${(checkedCount / checklist.length) * 100}%` }]} />
              </View>

              {/* Camera Trigger */}
              {allChecked ? (
                <View style={styles.snapBoxActive}>
                  <Text style={styles.snapBoxTitle}>Take Proof Photo (+10 Eco Points)</Text>
                  <Text style={styles.snapBoxSub}>All checked! Snap your sorted bin at the curb to earn points.</Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                    <TouchableOpacity style={styles.snapCameraBtn} onPress={handleTakePhoto} activeOpacity={0.8}>
                      <MaterialIcons name="photo-camera" size={16} color="#FFFFFF" />
                      <Text style={styles.snapCameraBtnText}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.snapGalleryBtn} onPress={handlePickPhoto} activeOpacity={0.8}>
                      <MaterialIcons name="photo-library" size={16} color="#006A3B" />
                      <Text style={styles.snapGalleryBtnText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.snapBoxDisabled}>
                  <MaterialIcons name="lock" size={16} color="#94A3B8" />
                  <Text style={styles.snapBoxDisabledText}>Check all {checklist.length} items above to unlock photo capture.</Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Story Preview Modal */}
      <Modal visible={photoPreviewVisible} transparent animationType="fade" onRequestClose={() => setPhotoPreviewVisible(false)}>
        <View style={styles.modalOverlayDark}>
          <View style={styles.storyModalCard}>
            <Text style={styles.storyTitle}>Disposal Verification</Text>
            <Text style={styles.storySubtitle}>Submit to earn points and keep your streak!</Text>

            {selectedPhoto && (
              <View style={styles.storyPhotoWrap}>
                <Image source={{ uri: selectedPhoto }} style={styles.storyImg} resizeMode="cover" />
                <View style={styles.storyBadgeTop}>
                  <Text style={styles.storyBadgeText}>📍 {user?.barangay || "Cebu City"} • {scheduledWasteType}</Text>
                </View>
              </View>
            )}

            {/* Motivation Chips */}
            <Text style={styles.motivationLabel}>What motivated you to dispose your trash today?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.motivationScroll}>
              {MOTIVATION_OPTIONS.map((opt) => {
                const isSel = selectedMotivation === opt.label;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.motivationChip, isSel && styles.motivationChipSelected]}
                    onPress={() => setSelectedMotivation(opt.label)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name={opt.icon} size={13} color={isSel ? "#FFFFFF" : opt.color} />
                    <Text style={[styles.motivationChipText, isSel && { color: "#FFFFFF" }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.storyActionRow}>
              <TouchableOpacity style={styles.retakeButton} onPress={handleTakePhoto} activeOpacity={0.7}>
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isSubmittingDisposal && { opacity: 0.7 }]}
                onPress={handleShareOrSavePhoto}
                disabled={isSubmittingDisposal}
                activeOpacity={0.8}
              >
                {isSubmittingDisposal ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit (+10 Pts)</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Celebration Modal */}
      <Modal visible={celebrationVisible} transparent animationType="fade" onRequestClose={() => setCelebrationVisible(false)}>
        <View style={styles.modalOverlayDark}>
          <ConfettiExplosion visible={celebrationVisible} />
          <View style={styles.celebrationBox}>
            <Text style={{ fontSize: 36, textAlign: "center" }}>🏆</Text>
            <Text style={styles.celebrationHeading}>Disposal Verified!</Text>
            <Text style={styles.celebrationBody}>{celebrationData?.message}</Text>

            <View style={styles.rewardPillRow}>
              <View style={styles.rewardPill}>
                <Text style={styles.rewardPillVal}>🔥 {disposalStreak} Days</Text>
                <Text style={styles.rewardPillLbl}>Streak</Text>
              </View>
              <View style={styles.rewardPill}>
                <Text style={styles.rewardPillVal}>🌟 +{celebrationData?.awardPoints || 10} Pts</Text>
                <Text style={styles.rewardPillLbl}>Eco Points</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.celebrationDoneBtn} onPress={() => setCelebrationVisible(false)} activeOpacity={0.8}>
              <Text style={styles.celebrationDoneBtnText}>Great! 🌟</Text>
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
    backgroundColor: "#006A3B",
  },
  toastContainer: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: "#006A3B",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    elevation: 8,
    zIndex: 999,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  pointsToast: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: "#D97706",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    elevation: 8,
    zIndex: 998,
  },
  pointsToastText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  // Fixed Top App Bar
  topAppBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#006A3B",
    borderBottomWidth: 1,
    borderBottomColor: "#00552F",
  },
  appBarLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  appBarLogo: {
    width: 26,
    height: 26,
  },
  appBarTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  appBarSubtitle: {
    fontSize: 7.5,
    fontWeight: "800",
    color: "#A7F3D0",
    letterSpacing: 0.5,
  },
  appBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appBarIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  badgeDot: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  badgeDotText: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  // Greeting Header
  greetingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  barangaySubText: {
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 1,
  },
  liveStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
    borderWidth: 1,
  },
  liveStatusPillGreen: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  liveStatusPillGray: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  liveStatusPillAmber: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveStatusText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  // 3-Metric Bar
  metricsBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  metricColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  metricValText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  metricLblText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#F1F5F9",
  },
  // Collection Hero Card
  collectionHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streamBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  streamBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  pointsBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D97706",
  },
  heroStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroTruckIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  heroMainTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  heroSubText: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
    marginTop: 2,
  },
  verifiedThumbnailRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  verifiedThumbnailImg: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  verifiedThumbTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#065F46",
  },
  verifiedThumbSub: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
  },
  heroActionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  primaryCtaBtn: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006A3B",
    paddingVertical: 11,
    borderRadius: 12,
    gap: 6,
  },
  primaryCtaBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryCtaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 11,
    borderRadius: 12,
    gap: 5,
  },
  secondaryCtaBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#006A3B",
  },
  // 4-Column Quick Actions Grid
  quickGridContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  quickGridTile: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  quickGridIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  quickGridLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
  },
  quickGridSub: {
    fontSize: 9,
    color: "#64748B",
    marginTop: 1,
  },
  // Generic Compact Card
  compactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 10,
  },
  compactCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  compactCardSub: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 1,
  },
  // Air Quality styles
  aqStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  aqStatusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  miniChartRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  miniBar: {
    flex: 1,
    marginHorizontal: 3,
    borderRadius: 4,
  },
  aqLevelColumns: {
    flexDirection: "row",
    gap: 6,
  },
  aqLevelItem: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: "center",
  },
  aqLevelItemInactive: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  aqLevelNum: {
    fontSize: 8.5,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  aqLevelTitle: {
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 1,
  },
  // Waste Segregation Styles
  segTabsContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  segTabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  segTabButtonActiveMalata: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segTabButtonActiveDiMalata: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segTabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  segTabTextActiveMalata: {
    color: "#047857",
    fontWeight: "700",
  },
  segTabTextActiveDiMalata: {
    color: "#1D4ED8",
    fontWeight: "700",
  },
  segSplitGrid: {
    flexDirection: "row",
    gap: 8,
  },
  segColBox: {
    flex: 1,
    borderRadius: 12,
    padding: 9,
  },
  segColBoxGreen: {
    backgroundColor: "#ECFDF5",
  },
  segColBoxBlue: {
    backgroundColor: "#EFF6FF",
  },
  segColBoxRed: {
    backgroundColor: "#FEF2F2",
  },
  segColHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 5,
  },
  segColHeadText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  segItemText: {
    fontSize: 10,
    color: "#1E293B",
    lineHeight: 14,
    marginTop: 1.5,
  },
  segItemTextReject: {
    fontSize: 10,
    color: "#64748B",
    lineHeight: 14,
    marginTop: 1.5,
  },
  // Modal Sheet Styles
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "85%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#CBD5E1",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  modalHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubText: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 1,
  },
  checklistSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 10,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  checkBoxChecked: {
    backgroundColor: "#006A3B",
    borderColor: "#006A3B",
  },
  checkLabel: {
    flex: 1,
    fontSize: 12.5,
    color: "#1E293B",
  },
  checkLabelDone: {
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  sheetProgressTrack: {
    height: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 2,
    marginVertical: 12,
    overflow: "hidden",
  },
  sheetProgressFill: {
    height: "100%",
    backgroundColor: "#006A3B",
    borderRadius: 2,
  },
  snapBoxActive: {
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  snapBoxTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#065F46",
  },
  snapBoxSub: {
    fontSize: 11,
    color: "#047857",
    marginTop: 2,
  },
  snapCameraBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006A3B",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  snapCameraBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  snapGalleryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D1FAE5",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  snapGalleryBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#006A3B",
  },
  snapBoxDisabled: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  snapBoxDisabledText: {
    flex: 1,
    fontSize: 11,
    color: "#64748B",
  },
  // Story Preview Modal
  modalOverlayDark: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  storyModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    gap: 10,
  },
  storyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  storySubtitle: {
    fontSize: 11.5,
    color: "#64748B",
  },
  storyPhotoWrap: {
    width: "100%",
    height: 190,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  storyImg: {
    width: "100%",
    height: "100%",
  },
  storyBadgeTop: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  storyBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  motivationLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
    marginTop: 2,
  },
  motivationScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  motivationChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  motivationChipSelected: {
    backgroundColor: "#006A3B",
  },
  motivationChipText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#334155",
  },
  storyActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  retakeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    borderRadius: 10,
  },
  retakeButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  submitButton: {
    flex: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006A3B",
    paddingVertical: 10,
    borderRadius: 10,
  },
  submitButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Celebration Box
  celebrationBox: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  celebrationHeading: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  celebrationBody: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    lineHeight: 16,
  },
  rewardPillRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  rewardPill: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  rewardPillVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  rewardPillLbl: {
    fontSize: 9.5,
    color: "#64748B",
    marginTop: 1,
  },
  celebrationDoneBtn: {
    width: "100%",
    backgroundColor: "#006A3B",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  celebrationDoneBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
