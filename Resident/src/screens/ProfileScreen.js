import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ProfileScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [myReports, setMyReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const { user, logout, updateProfile } = useAuth();

  const [points, setPoints] = useState(null);
  const [rank, setRank] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [barangaySearch, setBarangaySearch] = useState("");
  const [routePreference, setRoutePreference] = useState(null); // { id, name }
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    barangay: "",
    street: "",
    houseNo: "",
    profilePicture: null,
  });

  const CEBU_BARANGAYS = [
    "Adlaon","Agsungot","Apas","Babag","Bacayan","Banilad","Basak Pardo",
    "Basak San Nicolas","Binaliw","Bonbon","Budla-an","Buhisan","Bulacao",
    "Buot-Taup","Busay","Calamba","Cambinocot","Capitol Site","Carreta",
    "Cogon Pardo","Cogon Ramos","Day-as","Duljo Fatima","Ermita",
    "Guadalupe","Guba","Hippodromo","Inayawan","IT Park","Kalubihan",
    "Kalunasan","Kamagayan","Kamputhaw","Kasambagan","Kinasang-an",
    "Labangon","Lahug","Lorega San Miguel","Lusaran","Luz","Mabini",
    "Mabolo","Malubog","Mambaling","Pahina Central","Pahina San Nicolas",
    "Pardo","Pari-an","Paril","Pasil","Pit-os","Poblacion Pardo",
    "Pulangbato","Pung-ol Sibugay","Punta Princesa","Quiot","Sambag I",
    "Sambag II","San Antonio","San Jose","San Nicolas Proper","San Roque",
    "Santa Cruz","Sapangdaku","Sawang Calero","Sinsin","Sirao",
    "Suba","Sudlon I","Sudlon II","T. Padilla","Tabunan","Tagbao",
    "Talamban","Taptap","Tejero","Tinago","Tisa","To-ong","Zapatera",
  ];

  const filteredBarangays = CEBU_BARANGAYS.filter((b) =>
    b.toLowerCase().includes(barangaySearch.toLowerCase())
  );

  useEffect(() => {
    if (user) {
      const nameParts = user.name ? user.name.split(" ") : ["", ""];
      setEditForm({
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        phone: user.phone || "",
        barangay: user.barangay || "",
        street: user.street || "",
        houseNo: user.houseNo || "",
        profilePicture: user.profilePicture || null,
      });
    }
  }, [user]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled) {
      setEditForm({
        ...editForm,
        profilePicture: `data:image/jpeg;base64,${result.assets[0].base64}`,
      });
    }
  };

  const uploadToCloudinary = async (base64Data) => {
    const res = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: base64Data }),
    });
    if (!res.ok) throw new Error('Image upload failed');
    const json = await res.json();
    return json.url;
  };

  const handleSaveProfile = async () => {
    try {
      let profileData = { ...editForm };
      if (profileData.profilePicture?.startsWith('data:')) {
        profileData.profilePicture = await uploadToCloudinary(profileData.profilePicture);
      }
      await updateProfile(profileData);
      setIsEditModalVisible(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to update profile");
    }
  };

  const fetchReports = useCallback(async () => {
    if (!user?.id) return;
    setReportsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/reports?userId=${user.id}`);
      if (res.ok) setMyReports(await res.json());
    } catch (_) {}
    finally { setReportsLoading(false); }
  }, [user?.id]);

  const fetchPoints = useCallback(async () => {
    const uid = user?.id || user?._id;
    if (!uid) return;
    try {
      const [ptRes, rkRes] = await Promise.all([
        fetch(`${API_URL}/api/residents/${uid}/points`),
        fetch(`${API_URL}/api/residents/${uid}/rank`),
      ]);
      if (ptRes.ok) setPoints(await ptRes.json());
      if (rkRes.ok) setRank(await rkRes.json());
    } catch (_) {}
  }, [user?.id, user?._id]);

  useEffect(() => { fetchReports(); fetchPoints(); }, [fetchReports, fetchPoints]);

  const handleDeleteReport = async (reportId) => {
    Alert.alert("Delete Report", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/api/reports/${reportId}`, { method: "DELETE" });
            if (res.ok) {
              setMyReports((prev) => prev.filter((r) => r._id !== reportId));
              Alert.alert("Deleted", "Report removed successfully.");
            } else throw new Error();
          } catch { Alert.alert("Error", "Failed to delete report."); }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert(t("logout"), t("logout_confirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("logout"), onPress: logout, style: "destructive" },
    ]);
  };

  const changeLanguage = async (lang) => {
    await i18n.changeLanguage(lang);
    await AsyncStorage.setItem("user-language", lang);
    setShowLanguageModal(false);
  };

  useEffect(() => {
    AsyncStorage.getItem("@route_preference")
      .then((val) => { if (val) setRoutePreference(JSON.parse(val)); })
      .catch(() => {});
    fetch(`${API_URL}/api/routes`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAvailableRoutes(data); })
      .catch(() => {});
  }, []);

  const handleSelectRoute = async (route) => {
    const pref = route ? { id: route._id, name: route.name } : null;
    setRoutePreference(pref);
    await AsyncStorage.setItem("@route_preference", JSON.stringify(pref));
    setShowRouteModal(false);
  };

  const resolvedCount = myReports.filter((r) => r.status === "resolved").length;
  const pendingCount  = myReports.filter((r) => r.status === "pending").length;
  const recentReports = myReports.slice(0, 5);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Green cover ── */}
        <View style={styles.coverHeader}>
          <Text style={styles.screenLabel}>{t("profile")}</Text>
        </View>

        {/* ── White sheet (covers everything below cover) ── */}
        <View style={styles.whiteSheet}>

          {/* Avatar section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                {user?.profilePicture ? (
                  <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={52} color="#A8C4B4" />
                )}
              </View>
              <TouchableOpacity
                style={styles.editBadge}
                onPress={() => setIsEditModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={12} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>{user?.name || "User"}</Text>

            {user?.barangay && (
              <View style={styles.barangayBadge}>
                <Ionicons name="location-sharp" size={13} color="#006A3B" />
                <Text style={styles.barangayBadgeText}>{t("barangay")} {user.barangay}</Text>
              </View>
            )}

            {user?.email && (
              <View style={styles.metaRow}>
                <Ionicons name="mail-outline" size={13} color="#7A8C7F" />
                <Text style={styles.metaText}>{user.email}</Text>
              </View>
            )}
          </View>

          {/* ── Stats row ── */}
          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              {reportsLoading
                ? <ActivityIndicator size="small" color="#006A3B" />
                : <Text style={styles.statValue}>{myReports.length}</Text>}
              <Text style={styles.statLabel}>{t("total_reports")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              {reportsLoading
                ? <ActivityIndicator size="small" color="#006A3B" />
                : <Text style={[styles.statValue, { color: "#006A3B" }]}>{resolvedCount}</Text>}
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              {reportsLoading
                ? <ActivityIndicator size="small" color="#006A3B" />
                : <Text style={styles.statValue}>{pendingCount}</Text>}
              <Text style={styles.statLabel}>{t("pending")}</Text>
            </View>
          </View>

          {/* ── Points card ── */}
          <TouchableOpacity
            style={styles.pointsCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('PointsHistory')}
          >
            <View style={styles.pointsLeft}>
              <Ionicons name="star" size={28} color="#F59E0B" />
              <View>
                <Text style={styles.pointsTotal}>{points?.totalPoints ?? '—'}</Text>
                <Text style={styles.pointsLabel}>Total Points</Text>
              </View>
            </View>
            <View style={styles.pointsMid}>
              <Text style={styles.pointsMonthly}>{points?.monthlyPoints ?? 0}</Text>
              <Text style={styles.pointsMonthLabel}>This month</Text>
            </View>
            <View style={styles.pointsRight}>
              {rank ? (
                <>
                  <Text style={styles.rankNum}>#{rank.monthlyRank}</Text>
                  <Text style={styles.rankLabel}>of {rank.total} in Brgy.</Text>
                </>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color="#C4CEC7" style={{ marginTop: 4 }} />
            </View>
          </TouchableOpacity>

          {/* ── Activity mini-stats ── */}
          {points?.stats && (
            <View style={styles.activityRow}>
              {[
                { icon: 'scan-outline', label: 'Scans', val: points.stats.correctScans ?? 0 },
                { icon: 'document-text-outline', label: 'Reports', val: points.stats.reportsSubmitted ?? 0 },
                { icon: 'checkmark-circle-outline', label: 'Verified', val: points.stats.resolutionsVerified ?? 0 },
              ].map(({ icon, label, val }) => (
                <View key={label} style={styles.activityCell}>
                  <Ionicons name={icon} size={20} color="#006A3B" />
                  <Text style={styles.activityVal}>{val}</Text>
                  <Text style={styles.activityLabel}>{label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Body content ── */}
          <View style={styles.body}>

            {/* Impact banner */}
            <View style={styles.impactCard}>
              <View style={styles.impactLeft}>
                <Text style={styles.impactTitle}>{t("community_impact")}</Text>
                <Text style={styles.impactSub}>
                  {resolvedCount > 0
                    ? t("impact_message_active", { count: resolvedCount })
                    : t("impact_message_empty")}
                </Text>
              </View>
              <MaterialIcons name="forest" size={64} color="#fff" style={{ opacity: 0.2 }} />
            </View>

            {/* Preferences */}
            <Text style={styles.sectionLabel}>{t("preferences")}</Text>
            <View style={styles.card}>
              <View style={styles.menuRow}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: "#E4EEE9" }]}>
                    <Ionicons name="notifications" size={18} color="#006A3B" />
                  </View>
                  <Text style={styles.menuText}>{t("notifications")}</Text>
                </View>
                <Switch
                  value={notifEnabled}
                  onValueChange={setNotifEnabled}
                  trackColor={{ false: "#DCD9D9", true: "#006A3B" }}
                  thumbColor="#fff"
                  ios_backgroundColor="#DCD9D9"
                />
              </View>

              <View style={styles.separator} />

              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.5}
                onPress={() => setShowRouteModal(true)}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: "#E4EEE9" }]}>
                    <MaterialIcons name="alt-route" size={18} color="#006A3B" />
                  </View>
                  <Text style={styles.menuText}>Route Preference</Text>
                </View>
                <View style={styles.menuRight}>
                  <Text style={styles.menuValue} numberOfLines={1}>
                    {routePreference ? routePreference.name : "None"}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
                </View>
              </TouchableOpacity>

              <View style={styles.separator} />

              <TouchableOpacity style={styles.menuRow} activeOpacity={0.5}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: "#E4EEE9" }]}>
                    <Ionicons name="leaf" size={18} color="#006A3B" />
                  </View>
                  <Text style={styles.menuText}>{t("segregation_guide")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
              </TouchableOpacity>

              <View style={styles.separator} />

              <TouchableOpacity 
                style={styles.menuRow} 
                activeOpacity={0.5}
                onPress={() => setShowLanguageModal(true)}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: "#E4EEE9" }]}>
                    <Ionicons name="language" size={18} color="#006A3B" />
                  </View>
                  <Text style={styles.menuText}>{t("language")}</Text>
                </View>
                <View style={styles.menuRight}>
                  <Text style={styles.menuValue}>
                    {i18n.language === "en" ? "English" : "Cebuano"}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Account */}
            <Text style={styles.sectionLabel}>{t("account")}</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.5}
                onPress={() => setIsEditModalVisible(true)}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: "#E4EEE9" }]}>
                    <Ionicons name="person" size={18} color="#006A3B" />
                  </View>
                  <Text style={styles.menuText}>{t("edit_profile")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
              </TouchableOpacity>

              <View style={styles.separator} />

              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.5}
                onPress={() => navigation.navigate('PointsHistory')}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: "#FFFBEB" }]}>
                    <Ionicons name="star-outline" size={18} color="#F59E0B" />
                  </View>
                  <Text style={styles.menuText}>Points History</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
              </TouchableOpacity>

              <View style={styles.separator} />

              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.5}
                onPress={() => navigation.navigate('MyRewards')}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: "#FFF7ED" }]}>
                    <Ionicons name="gift-outline" size={18} color="#F59E0B" />
                  </View>
                  <Text style={styles.menuText}>My Rewards</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
              </TouchableOpacity>

              <View style={styles.separator} />

              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.5}
                onPress={() => navigation.navigate('BugReport')}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: "#FEF3C7" }]}>
                    <Ionicons name="bug-outline" size={18} color="#D97706" />
                  </View>
                  <Text style={styles.menuText}>Report a Bug</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
              </TouchableOpacity>

              <View style={styles.separator} />

              <TouchableOpacity style={styles.menuRow} activeOpacity={0.5} onPress={handleLogout}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: "#F0EDED" }]}>
                    <Ionicons name="log-out-outline" size={18} color="#7A8C7F" />
                  </View>
                  <Text style={[styles.menuText, { color: "#7A8C7F" }]}>Logout</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* My Reports */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>My Reports</Text>
              {myReports.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{myReports.length}</Text>
                </View>
              )}
            </View>

            {reportsLoading ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator color="#006A3B" />
              </View>
            ) : recentReports.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={36} color="#C4CEC7" />
                <Text style={styles.emptyText}>No reports submitted yet</Text>
                <Text style={styles.emptySubText}>Your reports will appear here</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {recentReports.map((report, idx) => {
                  const isResolved = report.status === "resolved";
                  const isProgress = report.status === "in-progress";
                  return (
                    <React.Fragment key={report._id || idx}>
                      {idx > 0 && <View style={styles.separator} />}
                      <View style={styles.reportRow}>
                        <View style={[
                          styles.reportIcon,
                          isResolved && { backgroundColor: "#DCFCE7" },
                          isProgress && { backgroundColor: "#ECFDF5" },
                          !isResolved && !isProgress && { backgroundColor: "#EFF3F0" },
                        ]}>
                          <Ionicons
                            name={isResolved ? "checkmark-circle" : isProgress ? "time" : "alert-circle"}
                            size={22}
                            color={isResolved ? "#006A3B" : isProgress ? "#338862" : "#A8C4B4"}
                          />
                        </View>
                        <View style={styles.reportInfo}>
                          <View style={styles.reportTopRow}>
                            <Text style={styles.reportCategory} numberOfLines={1}>
                              {report.category || "Report"}
                            </Text>
                            <Text style={styles.reportDate}>{formatDate(report.createdAt)}</Text>
                          </View>
                          <Text style={styles.reportDesc} numberOfLines={1}>
                            {report.description}
                          </Text>
                          <View style={[
                            styles.statusPill,
                            isResolved && { backgroundColor: "#DCFCE7" },
                            isProgress && { backgroundColor: "#ECFDF5" },
                          ]}>
                            <Text style={[
                              styles.statusPillText,
                              isResolved && { color: "#006A3B" },
                              isProgress && { color: "#338862" },
                            ]}>
                              {isResolved ? "Resolved" : isProgress ? "In Progress" : "Under Review"}
                            </Text>
                          </View>
                        </View>
                        {!isResolved && (
                          <TouchableOpacity
                            onPress={() => handleDeleteReport(report._id)}
                            style={styles.deleteBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={18} color="#A8C4B4" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
            )}

            <View style={{ height: 48 }} />
          </View>
        </View>
      </ScrollView>

        {/* Language Modal */}
        <Modal
          visible={showLanguageModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLanguageModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.languageModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t("language")}</Text>
                <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                  <Ionicons name="close" size={24} color="#7A8C7F" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.langOption, i18n.language === "en" && styles.activeLangOption]} 
                onPress={() => changeLanguage("en")}
              >
                <Text style={[styles.langText, i18n.language === "en" && styles.activeLangText]}>English</Text>
                {i18n.language === "en" && <Ionicons name="checkmark-circle" size={20} color="#006A3B" />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.langOption, i18n.language === "ceb" && styles.activeLangOption]} 
                onPress={() => changeLanguage("ceb")}
              >
                <Text style={[styles.langText, i18n.language === "ceb" && styles.activeLangText]}>Cebuano</Text>
                {i18n.language === "ceb" && <Ionicons name="checkmark-circle" size={20} color="#006A3B" />}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      {/* ── Edit Profile Modal ── */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#1B1C1C" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Avatar picker */}
              <TouchableOpacity style={styles.avatarPickerRow} onPress={pickImage} activeOpacity={0.7}>
                <View style={styles.modalAvatarCircle}>
                  {editForm.profilePicture ? (
                    <Image source={{ uri: editForm.profilePicture }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={36} color="#C4CEC7" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.changePicLabel}>Change Profile Picture</Text>
                  <Text style={styles.changePicHint}>10-day cooldown applies</Text>
                </View>
                <View style={styles.changePicBtn}>
                  <Ionicons name="camera" size={16} color="#006A3B" />
                </View>
              </TouchableOpacity>

              {[
                { label: "First Name", key: "firstName", placeholder: "e.g. Juan" },
                { label: "Last Name",  key: "lastName",  placeholder: "e.g. Dela Cruz" },
                { label: "Phone",      key: "phone",     placeholder: "+63 9XX XXX XXXX", keyboard: "phone-pad" },
              ].map(({ label, key, placeholder, keyboard }) => (
                <View key={key} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{label}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editForm[key]}
                    onChangeText={(t) => setEditForm({ ...editForm, [key]: t })}
                    placeholder={placeholder}
                    placeholderTextColor="#C4CEC7"
                    keyboardType={keyboard || "default"}
                  />
                </View>
              ))}

              {/* Address — read-only after registration */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Registered Address</Text>
                <View style={styles.readonlyAddress}>
                  <Ionicons name="home-outline" size={16} color="#7A8C7F" />
                  <Text style={styles.readonlyAddressText}>
                    {[editForm.houseNo, editForm.street, editForm.barangay].filter(Boolean).join(', ') || 'No address on record'}
                    {editForm.barangay ? ', Cebu City' : ''}
                  </Text>
                </View>
                <View style={styles.addressLockNotice}>
                  <Ionicons name="lock-closed-outline" size={13} color="#D97706" />
                  <Text style={styles.addressLockText}>
                    Address cannot be changed here. Contact your Barangay Office to update it.
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Route Preference Modal ── */}
      <Modal visible={showRouteModal} animationType="slide" transparent onRequestClose={() => setShowRouteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingTop: 0 }]}>
            <View style={styles.barangayModalHeader}>
              <Text style={styles.modalTitle}>Route Preference</Text>
              <TouchableOpacity onPress={() => setShowRouteModal(false)}>
                <Ionicons name="close" size={24} color="#1B1C1C" />
              </TouchableOpacity>
            </View>
            <Text style={styles.routeModalHint}>
              Select your garbage collection route. The map will auto-select it when you open the Map tab.
            </Text>
            <FlatList
              data={[{ _id: null, name: "None – no preference" }, ...availableRoutes]}
              keyExtractor={(item) => item._id || 'none'}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const isActive = item._id
                  ? routePreference?.id === item._id
                  : !routePreference;
                return (
                  <TouchableOpacity
                    style={[styles.barangayItem, isActive && styles.barangayItemActive]}
                    onPress={() => handleSelectRoute(item._id ? item : null)}
                  >
                    <MaterialIcons
                      name={item._id ? "alt-route" : "not-interested"}
                      size={18}
                      color={isActive ? "#006A3B" : "#C4CEC7"}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.barangayItemText, isActive && { color: "#006A3B", fontWeight: "700" }]}>
                        {item.name}
                      </Text>
                      {item.barangay ? (
                        <Text style={styles.routeSubLabel}>{item.barangay}</Text>
                      ) : null}
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={18} color="#006A3B" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Barangay Picker ── */}
      <Modal visible={showBarangayModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingTop: 0 }]}>
            <View style={styles.barangayModalHeader}>
              <Text style={styles.modalTitle}>Select Barangay</Text>
              <TouchableOpacity onPress={() => { setShowBarangayModal(false); setBarangaySearch(""); }}>
                <Ionicons name="close" size={24} color="#1B1C1C" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#C4CEC7" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search barangay…"
                placeholderTextColor="#C4CEC7"
                value={barangaySearch}
                onChangeText={setBarangaySearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredBarangays}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.barangayItem,
                    editForm.barangay === item && styles.barangayItemActive,
                  ]}
                  onPress={() => {
                    setEditForm({ ...editForm, barangay: item });
                    setShowBarangayModal(false);
                    setBarangaySearch("");
                  }}
                >
                  <Ionicons
                    name="location-sharp"
                    size={16}
                    color={editForm.barangay === item ? "#006A3B" : "#C4CEC7"}
                  />
                  <Text style={[
                    styles.barangayItemText,
                    editForm.barangay === item && { color: "#006A3B", fontWeight: "700" },
                  ]}>
                    {item}
                  </Text>
                  {editForm.barangay === item && (
                    <Ionicons name="checkmark-circle" size={18} color="#006A3B" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#006A3B" },
  scroll:   { backgroundColor: "#FBF9F8", marginBottom: 16 },

  // ── Cover ──
  coverHeader: {
    backgroundColor: "#006A3B",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 62,
  },
  screenLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255,255,255,0.65)",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },

  // ── White sheet below cover ──
  whiteSheet: {
    backgroundColor: "#FBF9F8",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },

  // ── Avatar ──
  avatarSection: {
    alignItems: "center",
    paddingBottom: 4,
  },
  avatarRing: {
    marginTop: -50,
    position: "relative",
    width: 100,
    height: 100,
    marginBottom: 14,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#EDF4F0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
    overflow: "hidden",
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
  },
  avatarImage: { width: "100%", height: "100%", resizeMode: "cover" },
  editBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#006A3B",
    borderWidth: 2,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1B1C1C",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 8,
  },
  barangayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8,
  },
  barangayBadgeText: { fontSize: 12, fontWeight: "700", color: "#006A3B" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  metaText: { fontSize: 13, color: "#7A8C7F" },

  // ── Stats ──
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 18,
    paddingVertical: 18,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  statCell: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1B1C1C",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: "#7A8C7F",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
    lineHeight: 15,
  },
  statDivider: { width: 1, backgroundColor: "#EDF4F0" },

  // ── Points card ──
  pointsCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#006A3B', borderRadius: 20, marginHorizontal: 16, marginTop: 14,
    paddingHorizontal: 18, paddingVertical: 16, shadowColor: '#006A3B',
    shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  pointsLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointsTotal: { fontSize: 26, fontWeight: '900', color: '#fff' },
  pointsLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 1 },
  pointsMid: { alignItems: 'center' },
  pointsMonthly: { fontSize: 20, fontWeight: '800', color: '#FFD700' },
  pointsMonthLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  pointsRight: { alignItems: 'center' },
  rankNum: { fontSize: 18, fontWeight: '900', color: '#fff' },
  rankLabel: { fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: '600', textAlign: 'center' },

  // ── Activity mini-stats ──
  activityRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  activityCell: { flex: 1, alignItems: 'center', gap: 4 },
  activityVal: { fontSize: 18, fontWeight: '900', color: '#1F2937' },
  activityLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },

  // ── Body ──
  body: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // ── Impact banner ──
  impactCard: {
    backgroundColor: "#006A3B",
    borderRadius: 18,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  impactLeft: { flex: 1 },
  impactTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  impactSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 17 },

  // ── Section labels ──
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7A8C7F",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 4,
  },
  countBadge: {
    backgroundColor: "#006A3B",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },

  // ── Cards ──
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EDF4F0",
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  separator: { height: 1, backgroundColor: "#F2F6F3", marginLeft: 56 },

  // ── Menu rows ──
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuLeft:  { flexDirection: "row", alignItems: "center", gap: 12 },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  menuText:  { fontSize: 15, color: "#1B1C1C", fontWeight: "500" },
  menuValue: { fontSize: 14, color: "#7A8C7F" },

  // ── Reports ──
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EDF4F0",
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText:    { fontSize: 15, fontWeight: "600", color: "#7A8C7F", marginTop: 10 },
  emptySubText: { fontSize: 13, color: "#C4CEC7", marginTop: 4 },
  reportRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
  },
  reportIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  reportInfo: { flex: 1 },
  reportTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  reportCategory: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1B1C1C",
    flex: 1,
    marginRight: 8,
  },
  reportDate: { fontSize: 11, color: "#C4CEC7" },
  reportDesc:  { fontSize: 12, color: "#7A8C7F", marginBottom: 6 },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#EDF4F0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7A8C7F",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  deleteBtn: { paddingTop: 2 },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingTop: 12,
    maxHeight: "92%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#EDF4F0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#1B1C1C" },

  // ── Edit avatar row ──
  avatarPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F6FAF8",
    padding: 14,
    borderRadius: 14,
    marginBottom: 24,
  },
  modalAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EDF4F0",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  changePicLabel: { fontSize: 15, fontWeight: "600", color: "#006A3B" },
  changePicHint:  { fontSize: 12, color: "#C4CEC7", marginTop: 2 },
  changePicBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Form inputs ──
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7A8C7F",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: "#F6FAF8",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    color: "#1B1C1C",
    borderWidth: 1,
    borderColor: "#EDF4F0",
  },
  readonlyAddress: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F6FAF8",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#EDF4F0",
    marginBottom: 8,
  },
  readonlyAddressText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  addressLockNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  addressLockText: {
    flex: 1,
    fontSize: 11,
    color: "#92400E",
    lineHeight: 16,
    fontWeight: "500",
  },
  selectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F6FAF8",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: "#EDF4F0",
  },
  selectorValue:       { fontSize: 15, color: "#1B1C1C" },
  selectorPlaceholder: { fontSize: 15, color: "#C4CEC7" },
  saveBtn: {
    backgroundColor: "#006A3B",
    borderRadius: 14,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 32,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },

  // ── Barangay picker ──
  barangayModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 14,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F6FAF8",
    marginHorizontal: 24,
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: "#EDF4F0",
  },
  searchInput: { flex: 1, fontSize: 15, color: "#1B1C1C" },
  barangayItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 24,
    gap: 12,
  },
  barangayItemActive:  { backgroundColor: "#ECFDF5" },
  barangayItemText:    { flex: 1, fontSize: 15, color: "#374151" },
  routeModalHint: {
    fontSize: 13,
    color: "#7A8C7F",
    paddingHorizontal: 24,
    marginBottom: 8,
    lineHeight: 18,
  },
  routeSubLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  languageModalContent: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 32,
    padding: 24,
  },
  langOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  activeLangOption: {
    backgroundColor: "#E4EEE9",
    borderColor: "#006A3B",
  },
  langText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4B5563",
  },
  activeLangText: {
    color: "#006A3B",
  },
});
