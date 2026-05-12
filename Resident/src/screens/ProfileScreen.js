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
import * as ImagePicker from 'expo-image-picker';
import colors from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ProfileScreen() {
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [myReports, setMyReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const { user, logout, updateProfile } = useAuth();

  // Edit Profile States
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [barangaySearch, setBarangaySearch] = useState('');
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
    'Adlaon','Agsungot','Apas','Babag','Bacayan','Banilad','Basak Pardo',
    'Basak San Nicolas','Binaliw','Bonbon','Budla-an','Buhisan','Bulacao',
    'Buot-Taup','Busay','Calamba','Cambinocot','Capitol Site','Carreta',
    'Cogon Pardo','Cogon Ramos','Day-as','Duljo Fatima','Ermita',
    'Guadalupe','Guba','Hippodromo','Inayawan','IT Park','Kalubihan',
    'Kalunasan','Kamagayan','Kamputhaw','Kasambagan','Kinasang-an',
    'Labangon','Lahug','Lorega San Miguel','Lusaran','Luz','Mabini',
    'Mabolo','Malubog','Mambaling','Pahina Central','Pahina San Nicolas',
    'Pardo','Pari-an','Paril','Pasil','Pit-os','Poblacion Pardo',
    'Pulangbato','Pung-ol Sibugay','Punta Princesa','Quiot','Sambag I',
    'Sambag II','San Antonio','San Jose','San Nicolas Proper','San Roque',
    'Santa Cruz','Sapangdaku','Sawang Calero','Sinsin','Sirao',
    'Suba','Sudlon I','Sudlon II','T. Padilla','Tabunan','Tagbao',
    'Talamban','Taptap','Tejero','Tinago','Tisa','To-ong','Zapatera',
  ];

  const filteredBarangays = CEBU_BARANGAYS.filter(b =>
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
      setEditForm({ ...editForm, profilePicture: `data:image/jpeg;base64,${result.assets[0].base64}` });
    }
  };

  const handleEditPress = () => {
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile(editForm);
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
      if (res.ok) {
        const data = await res.json();
        setMyReports(data);
      }
    } catch (_) {
      // silently fail — stats and reports section show empty state
    } finally {
      setReportsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleDeleteReport = async (reportId) => {
    Alert.alert(
      "Delete Report",
      "Are you sure you want to delete this report? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/api/reports/${reportId}`, { method: 'DELETE' });
              if (res.ok) {
                setMyReports(prev => prev.filter(r => r._id !== reportId));
                Alert.alert("Success", "Report deleted successfully");
              } else {
                throw new Error("Failed to delete report");
              }
            } catch (error) {
              Alert.alert("Error", error.message);
            }
          }
        }
      ]
    );
  };

  const resolvedCount = myReports.filter(r => r.status === 'resolved').length;
  const recentReports = myReports.slice(0, 5);

  const handleMenuPress = (label) => {
    if (label === "Logout") {
      Alert.alert(
        "Logout",
        "Are you sure you want to logout?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Logout", onPress: logout, style: "destructive" },
        ]
      );
      return;
    }
    console.log(`Pressed: ${label}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Section */}
        <View style={styles.profileSection}>
          {/* Avatar with Edit Button */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                {user?.profilePicture ? (
                  <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
                ) : (
                  <MaterialIcons name="person" size={48} color="#BECABE" />
                )}
              </View>
              <TouchableOpacity style={styles.editButton} activeOpacity={0.7} onPress={handleEditPress}>
                <MaterialIcons name="edit" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Name and Address */}
          <Text style={styles.userName}>{user?.name || "User"}</Text>
          <View style={styles.addressRow}>
            <MaterialIcons name="location-on" size={16} color="#6F7A70" />
            <Text style={styles.address}>{user?.address || "Location not set"}</Text>
          </View>
          {user?.email && (
            <View style={[styles.addressRow, { marginTop: 4 }]}>
              <MaterialIcons name="email" size={16} color="#6F7A70" />
              <Text style={styles.address}>{user.email}</Text>
            </View>
          )}
          {user?.barangay && (
            <View style={styles.barangayBadge}>
              <MaterialIcons name="location-city" size={14} color="#006A3B" />
              <Text style={styles.barangayBadgeText}>Brgy. {user.barangay}</Text>
            </View>
          )}
        </View>

        {/* Stats Bento Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            {reportsLoading ? (
              <ActivityIndicator size="small" color="#006A3B" style={{ marginBottom: 4 }} />
            ) : (
              <Text style={styles.statValue}>{myReports.length}</Text>
            )}
            <Text style={styles.statLabel}>Reports Submitted</Text>
          </View>
          <View style={styles.statCard}>
            {reportsLoading ? (
              <ActivityIndicator size="small" color="#006A3B" style={{ marginBottom: 4 }} />
            ) : (
              <Text style={[styles.statValue, { color: "#006E1C" }]}>{resolvedCount}</Text>
            )}
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>

        {/* Settings Menu - iOS List Style */}
        <View style={styles.settingsSection}>
          {/* Main Settings Card */}
          <View style={styles.settingsCard}>
            {/* Notification Settings */}
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: "#E4EEE9" },
                  ]}
                >
                  <MaterialIcons
                    name="notifications"
                    size={20}
                    color="#006A3B"
                  />
                </View>
                <Text style={styles.menuLabel}>Notification Settings</Text>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={setNotifEnabled}
                trackColor={{ false: "#DCD9D9", true: "#006A3B" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#DCD9D9"
              />
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Segregation Guide */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuPress("Segregation Guide")}
              activeOpacity={0.5}
            >
              <View style={styles.menuItemLeft}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: "#E4EEE9" },
                  ]}
                >
                  <MaterialIcons
                    name="auto-awesome-motion"
                    size={20}
                    color="#006E1C"
                  />
                </View>
                <Text style={styles.menuLabel}>Segregation Guide</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#BECABE" />
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider} />

            {/* App Language */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuPress("App Language")}
              activeOpacity={0.5}
            >
              <View style={styles.menuItemLeft}>
                <View
                  style={[styles.iconContainer, { backgroundColor: "#D9E6DA" }]}
                >
                  <MaterialIcons name="language" size={20} color="#3E4A41" />
                </View>
                <Text style={styles.menuLabel}>App Language</Text>
              </View>
              <View style={styles.menuItemRight}>
                <Text style={styles.menuValue}>English</Text>
                <MaterialIcons name="chevron-right" size={22} color="#BECABE" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Logout Card */}
          <View style={styles.logoutCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuPress("Logout")}
              activeOpacity={0.5}
            >
              <View style={styles.menuItemLeft}>
                <View
                  style={[styles.iconContainer, { backgroundColor: "#FFDAD6" }]}
                >
                  <MaterialIcons name="logout" size={20} color="#BA1A1A" />
                </View>
                <Text
                  style={[
                    styles.menuLabel,
                    { color: "#BA1A1A", fontWeight: "600" },
                  ]}
                >
                  Logout
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Impact Card */}
        <View style={styles.impactCard}>
          <View style={styles.impactContent}>
            <Text style={styles.impactTitle}>Make an Impact</Text>
            <Text style={styles.impactText}>
              Every piece of trash you segregate contributes to a cleaner Cebu.
              You've saved 4 trees this month!
            </Text>
          </View>
          <View style={styles.impactIcon}>
            <MaterialIcons
              name="forest"
              size={100}
              color="#268058"
            />
          </View>
        </View>

        {/* My Reports Section */}
        <View style={styles.reportsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Reports</Text>
          </View>

          {reportsLoading ? (
            <View style={[styles.reportCard, { padding: 24, alignItems: 'center' }]}>
              <ActivityIndicator size="small" color="#006A3B" />
            </View>
          ) : recentReports.length === 0 ? (
            <View style={[styles.reportCard, { padding: 24, alignItems: 'center' }]}>
              <MaterialIcons name="assignment" size={32} color="#BECABE" />
              <Text style={{ fontSize: 14, color: '#6F7A70', marginTop: 8 }}>No reports submitted yet</Text>
            </View>
          ) : (
            <View style={styles.reportCard}>
              {recentReports.map((report, idx) => {
                const isResolved = report.status === 'resolved';
                return (
                  <React.Fragment key={report._id || idx}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.reportItem}>
                      <View style={[styles.reportIconContainer, isResolved && { backgroundColor: '#D9E6DA' }]}>
                        <MaterialIcons
                          name={isResolved ? "check-circle-outline" : "error-outline"}
                          size={24}
                          color={isResolved ? "#006A3B" : "#BA1A1A"}
                        />
                      </View>
                      <View style={styles.reportDetails}>
                        <View style={styles.reportHeaderRow}>
                          <Text style={styles.reportCategory} numberOfLines={1}>{report.category || 'Report'}</Text>
                          <Text style={styles.reportDate}>{formatDate(report.createdAt)}</Text>
                        </View>
                        <Text style={styles.reportDesc} numberOfLines={1}>{report.description}</Text>
                        <View style={[
                          styles.statusBadge,
                          isResolved && { backgroundColor: '#ECFDF5' },
                          report.status === 'in-progress' && { backgroundColor: '#EFF6FF' },
                        ]}>
                          <Text style={[
                            styles.statusBadgeText,
                            isResolved && { color: '#006A3B' },
                            report.status === 'in-progress' && { color: '#1D4ED8' },
                          ]}>
                            {report.status === 'pending' ? 'Under Review'
                              : report.status === 'in-progress' ? 'In Progress'
                              : 'Resolved'}
                          </Text>
                        </View>
                      </View>
                      {!isResolved && (
                        <TouchableOpacity 
                          onPress={() => handleDeleteReport(report._id)} 
                          style={styles.deleteBtn}
                        >
                          <MaterialIcons name="delete-outline" size={20} color="#BA1A1A" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </View>

        {/* Bottom Spacing for Tab Bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.editModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#1B1C1C" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.editAvatarSection}>
                <View style={styles.modalAvatar}>
                  {editForm.profilePicture ? (
                    <Image source={{ uri: editForm.profilePicture }} style={styles.avatarImage} />
                  ) : (
                    <MaterialIcons name="person" size={40} color="#BECABE" />
                  )}
                </View>
                <TouchableOpacity style={styles.changePicButton} onPress={pickImage}>
                  <Text style={styles.changePicText}>Change Profile Picture</Text>
                  <Text style={styles.cooldownHint}>10-day cooldown applies</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.firstName}
                  onChangeText={(text) => setEditForm({ ...editForm, firstName: text })}
                  placeholder="Enter first name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.lastName}
                  onChangeText={(text) => setEditForm({ ...editForm, lastName: text })}
                  placeholder="Enter last name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.phone}
                  onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Barangay</Text>
                <TouchableOpacity
                  style={styles.selectorInput}
                  onPress={() => setShowBarangayModal(true)}
                >
                  <Text style={editForm.barangay ? styles.selectorText : styles.placeholderText}>
                    {editForm.barangay || "Select Barangay"}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={24} color="#6F7A70" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Street / Sitio</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.street}
                  onChangeText={(text) => setEditForm({ ...editForm, street: text })}
                  placeholder="Enter street or sitio"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>House / Unit No.</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.houseNo}
                  onChangeText={(text) => setEditForm({ ...editForm, houseNo: text })}
                  placeholder="Enter house or unit number"
                />
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Barangay Picker Modal (Reuse from RegisterScreen) */}
      <Modal visible={showBarangayModal} animationType="fade" transparent>
        <View style={styles.barangayModalOverlay}>
          <View style={styles.barangayModalContent}>
            <View style={styles.barangayModalHeader}>
              <Text style={styles.barangayModalTitle}>Select Barangay</Text>
              <TouchableOpacity onPress={() => { setShowBarangayModal(false); setBarangaySearch(''); }}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.barangayModalSearch}>
              <MaterialIcons name="search" size={18} color="#9CA3AF" />
              <TextInput 
                style={styles.barangayModalSearchInput} 
                placeholder="Search barangay..."
                placeholderTextColor="#9CA3AF" 
                value={barangaySearch}
                onChangeText={setBarangaySearch} 
                autoFocus 
              />
            </View>

            <FlatList
              data={filteredBarangays}
              keyExtractor={item => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.barangayModalItem, editForm.barangay === item && styles.barangayModalItemActive]}
                  onPress={() => {
                    setEditForm({ ...editForm, barangay: item });
                    setShowBarangayModal(false);
                    setBarangaySearch('');
                  }}
                >
                  <MaterialIcons name="location-on" size={18}
                    color={editForm.barangay === item ? colors.primaryGreen : '#9CA3AF'} />
                  <Text style={[styles.barangayModalItemText, editForm.barangay === item && styles.barangayModalItemTextActive]}>
                    {item}
                  </Text>
                  {editForm.barangay === item && (
                    <MaterialIcons name="check-circle" size={20} color={colors.primaryGreen} />
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
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF9F8",
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
   paddingBottom: 24
  },

  // Profile Header
  profileSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarWrapper: {
    position: "relative",
    width: 96,
    height: 96,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F0EDED",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  editAvatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 32,
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 16,
  },
  modalAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  changePicButton: {
    flex: 1,
  },
  changePicText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#006A3B",
  },
  cooldownHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  editButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#006A3B",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  userName: {
    fontSize: 34,
    fontWeight: "700",
    color: "#1B1C1C",
    letterSpacing: -0.4,
    lineHeight: 41,
    marginBottom: 4,
    textAlign: "center",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  address: {
    fontSize: 15,
    color: "#6F7A70",
    lineHeight: 20,
  },
  barangayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  barangayBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#006A3B",
  },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#006A3B",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6F7A70",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    lineHeight: 16,
  },

  // Settings Section
  settingsSection: {
    gap: 24,
    marginBottom: 32,
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0EDED",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 52,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: {
    fontSize: 17,
    color: "#1B1C1C",
    lineHeight: 22,
  },
  menuValue: {
    fontSize: 15,
    color: "#6F7A70",
  },
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#F0EDED",
    marginLeft: 60,
  },

  // Logout Card
  logoutCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0EDED",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
  },

  // Impact Card
  impactCard: {
    backgroundColor: "#006A3B",
    borderRadius: 16,
    padding: 24,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 16,
  },
  impactContent: {
    zIndex: 1,
  },
  impactTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
    lineHeight: 22,
  },
  impactText: {
    fontSize: 13,
    color: "#E6F1EC",
    lineHeight: 18,
  },
  impactIcon: {
    position: "absolute",
    bottom: -16,
    right: -16,
    opacity: 0.15,
  },

  // Reports Section
  reportsSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1B1C1C',
  },
  viewAllText: {
    fontSize: 14,
    color: '#006A3B',
    fontWeight: '600',
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0EDED',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
  },
  reportItem: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  reportIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFDAD6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportDetails: {
    flex: 1,
  },
  reportHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  reportCategory: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B1C1C',
  },
  reportDate: {
    fontSize: 12,
    color: '#6F7A70',
  },
  reportDesc: {
    fontSize: 13,
    color: '#6F7A70',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#856404',
    textTransform: 'uppercase',
  },

  bottomSpacer: {
    height: 40,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  editModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1B1C1C",
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6F7A70",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    color: "#1B1C1C",
  },
  selectorInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  selectorText: {
    fontSize: 16,
    color: "#1B1C1C",
  },
  placeholderText: {
    fontSize: 16,
    color: "#9CA3AF",
  },
  saveButton: {
    backgroundColor: "#006A3B",
    borderRadius: 14,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 32,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Barangay Picker Modal Styles
  barangayModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  barangayModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  barangayModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  barangayModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B1C1C',
  },
  barangayModalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 24,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
  },
  barangayModalSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1B1C1C',
  },
  barangayModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 12,
  },
  barangayModalItemActive: {
    backgroundColor: '#ECFDF5',
  },
  barangayModalItemText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  barangayModalItemTextActive: {
    color: colors.primaryGreen,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 8,
    justifyContent: 'center',
  },
});
