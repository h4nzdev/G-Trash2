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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
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
  const { user, logout } = useAuth();

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/reports`);
      if (res.ok) {
        const data = await res.json();
        setMyReports(data);
      }
    } catch (_) {
      // silently fail — stats and reports section show empty state
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const resolvedCount = myReports.filter(r => r.status === 'resolved').length;
  const recentReports = myReports.slice(0, 2);

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
                <MaterialIcons name="person" size={48} color="#BECABE" />
              </View>
              <TouchableOpacity style={styles.editButton} activeOpacity={0.7}>
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
                    { backgroundColor: "rgba(0,106,59,0.1)" },
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
                    { backgroundColor: "rgba(0,110,28,0.1)" },
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
              color="rgba(255,255,255,0.15)"
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
    color: "rgba(255,255,255,0.9)",
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
});
