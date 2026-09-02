import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import API_URL from '../config';

export default function CollectorProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const truckId = user?.truckId ?? '';

  const [notifEnabled, setNotifEnabled] = useState(true);

  // Live fleet + route data fetched from backend
  const [fleetData, setFleetData] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [truckStatus, setTruckStatus] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  // Route preference
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [preferredRoute, setPreferredRoute] = useState(null); // { id, name, barangay }
  const [allRoutes, setAllRoutes] = useState([]);

  // Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProfileData = useCallback(async () => {
    if (!truckId) return;
    setLoadingData(true);
    try {
      const [fleetRes, routeRes, truckRes, allRoutesRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/fleet/${truckId}`).then((r) => r.json()),
        fetch(`${API_URL}/api/routes/truck/${truckId}`).then((r) => r.json()),
        fetch(`${API_URL}/api/trucks`).then((r) => r.json()),
        fetch(`${API_URL}/api/routes`).then((r) => r.json()),
      ]);

      if (fleetRes.status === 'fulfilled' && fleetRes.value?.truckId) {
        setFleetData(fleetRes.value);
        await updateUser({ driverName: fleetRes.value.driverName, route: fleetRes.value.route });
      }
      if (routeRes.status === 'fulfilled' && routeRes.value?.name) {
        setRouteData(routeRes.value);
      }
      if (truckRes.status === 'fulfilled' && Array.isArray(truckRes.value)) {
        const mine = truckRes.value.find((t) => t.truckId === truckId);
        setTruckStatus(mine ?? null);
      }
      if (allRoutesRes.status === 'fulfilled' && Array.isArray(allRoutesRes.value)) {
        setAllRoutes(allRoutesRes.value);
      }
    } catch (_) {
      // Silently fall back to local auth data
    } finally {
      setLoadingData(false);
    }
  }, [truckId, updateUser]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // Load saved route preference from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('@truck_route_preference')
      .then((val) => {
        if (val) setPreferredRoute(JSON.parse(val));
      })
      .catch(() => {});
  }, []);

  const handleSelectRoute = async (route) => {
    const pref = route ? { id: route._id, name: route.name, barangay: route.barangay || '' } : null;
    setPreferredRoute(pref);
    await AsyncStorage.setItem('@truck_route_preference', JSON.stringify(pref));
    setShowRouteModal(false);
  };

  // Derived display values
  const driverName = fleetData?.driverName || user?.driverName || user?.name || 'Driver';
  const routeName = routeData?.name || fleetData?.route || user?.route || 'No route assigned';
  const isOnline = truckStatus?.status === 'online';

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const openEditModal = () => {
    setEditName(driverName);
    setEditModal(true);
  };

  const handleSave = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/fleet/${truckId}/self`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverName: trimmed }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setFleetData(updated);
      await updateUser({ driverName: updated.driverName });
      setEditModal(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save changes. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  // Avatar initials
  const initials = driverName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#006A3B" />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Green curved cover header ── */}
        <View style={styles.coverHeader}>
          <Text style={styles.screenLabel}>Collector Profile</Text>
        </View>

        {/* ── White sheet (overlaps cover) ── */}
        <View style={styles.whiteSheet}>

          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                {loadingData ? (
                  <ActivityIndicator size="small" color="#006A3B" />
                ) : (
                  <Text style={styles.avatarInitials}>{initials || 'DR'}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.editBadge}
                onPress={openEditModal}
                activeOpacity={0.8}
              >
                <MaterialIcons name="edit" size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>{driverName}</Text>

            {truckId ? (
              <View style={styles.barangayBadge}>
                <MaterialIcons name="local-shipping" size={14} color="#006A3B" />
                <Text style={styles.barangayBadgeText}>Assigned Truck: {truckId}</Text>
              </View>
            ) : null}

            {routeName ? (
              <View style={styles.metaRow}>
                <Ionicons name="navigate-outline" size={13} color="#7A8C7F" />
                <Text style={styles.metaText} numberOfLines={1}>{routeName}</Text>
              </View>
            ) : null}
          </View>

          {/* ── Stats Row ── */}
          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>
                {routeData?.waypoints?.length ?? routeData?.totalStops ?? (fleetData?.route ? '1' : '—')}
              </Text>
              <Text style={styles.statLabel}>Stops</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: '#006A3B' }]}>{truckId || '—'}</Text>
              <Text style={styles.statLabel}>Truck ID</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: isOnline ? '#059669' : '#6B7280' }]}>
                {isOnline ? 'Online' : 'Standby'}
              </Text>
              <Text style={styles.statLabel}>Status</Text>
            </View>
          </View>

          {/* ── Body content ── */}
          <View style={styles.body}>

            {/* Assigned Truck Banner Card */}
            <Text style={styles.sectionLabel}>Vehicle & Route Overview</Text>
            <View style={styles.truckCard}>
              <View style={[styles.truckIconWrap, isOnline && styles.truckIconWrapOnline]}>
                <MaterialIcons name="local-shipping" size={28} color={isOnline ? '#006A3B' : '#9CA3AF'} />
              </View>
              <View style={styles.truckInfo}>
                <Text style={styles.truckTitle}>Truck {truckId || 'Unassigned'}</Text>
                {routeData ? (
                  <>
                    <Text style={styles.truckMeta}>Route: {routeData.name}</Text>
                    {routeData.barangay ? (
                      <Text style={styles.truckMeta}>Service Area: {routeData.barangay}</Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.truckMeta}>
                    {loadingData ? 'Loading route info…' : 'No route assigned yet'}
                  </Text>
                )}
                <View style={styles.operationalRow}>
                  <View style={[styles.operationalDot, !isOnline && styles.operationalDotOff]} />
                  <Text style={[styles.operationalText, !isOnline && styles.operationalTextOff]}>
                    {isOnline ? 'Active On Route' : 'Standby / Waiting for Shift'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Preferences */}
            <Text style={styles.sectionLabel}>Preferences</Text>
            <View style={styles.card}>
              <View style={styles.menuRow}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#E4EEE9' }]}>
                    <Ionicons name="notifications" size={18} color="#006A3B" />
                  </View>
                  <Text style={styles.menuText}>Shift Notifications</Text>
                </View>
                <Switch
                  value={notifEnabled}
                  onValueChange={setNotifEnabled}
                  trackColor={{ false: '#DCD9D9', true: '#006A3B' }}
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
                  <View style={[styles.iconBox, { backgroundColor: '#E4EEE9' }]}>
                    <MaterialIcons name="alt-route" size={18} color="#006A3B" />
                  </View>
                  <Text style={styles.menuText}>Route Preferences</Text>
                </View>
                <View style={styles.menuRight}>
                  <Text style={styles.menuValue} numberOfLines={1}>
                    {preferredRoute ? preferredRoute.name : 'None'}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
                </View>
              </TouchableOpacity>

              <View style={styles.separator} />

              <View style={styles.menuRow}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#E4EEE9' }]}>
                    <MaterialIcons name="directions-bus" size={18} color="#006A3B" />
                  </View>
                  <Text style={styles.menuText}>Vehicle Plate</Text>
                </View>
                <Text style={styles.menuValue}>{fleetData?.plateNumber || truckId || '—'}</Text>
              </View>
            </View>

            {/* Resources & Support */}
            <Text style={styles.sectionLabel}>Resources & Support</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.menuRow} activeOpacity={0.5}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#E4EEE9' }]}>
                    <Ionicons name="book-outline" size={18} color="#006A3B" />
                  </View>
                  <Text style={styles.menuText}>Collector Manual</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
              </TouchableOpacity>

              <View style={styles.separator} />

              <TouchableOpacity style={styles.menuRow} activeOpacity={0.5}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="warning-outline" size={18} color="#D97706" />
                  </View>
                  <Text style={styles.menuText}>Report Route Issue</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
              </TouchableOpacity>

              <View style={styles.separator} />

              <TouchableOpacity style={styles.menuRow} activeOpacity={0.5}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#E4EEE9' }]}>
                    <Ionicons name="help-circle-outline" size={18} color="#006A3B" />
                  </View>
                  <Text style={styles.menuText}>Help & Support</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
              </TouchableOpacity>
            </View>

            {/* Account & Logout */}
            <Text style={styles.sectionLabel}>Account</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.5}
                onPress={openEditModal}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#E4EEE9' }]}>
                    <Ionicons name="person-outline" size={18} color="#006A3B" />
                  </View>
                  <Text style={styles.menuText}>Edit Profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C4CEC7" />
              </TouchableOpacity>

              <View style={styles.separator} />

              <TouchableOpacity style={styles.menuRow} activeOpacity={0.5} onPress={handleLogout}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                  </View>
                  <Text style={[styles.menuText, { color: '#DC2626', fontWeight: '600' }]}>Logout</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={{ height: 48 }} />
          </View>
        </View>
      </ScrollView>

      {/* ── Route Preference Modal ── */}
      <Modal visible={showRouteModal} animationType="slide" transparent onRequestClose={() => setShowRouteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingTop: 0 }]}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Route Preference</Text>
              <TouchableOpacity onPress={() => setShowRouteModal(false)}>
                <Ionicons name="close" size={24} color="#1B1C1C" />
              </TouchableOpacity>
            </View>
            <Text style={styles.routeModalHint}>
              Select your default collection route when no automated dispatch is active.
            </Text>
            <FlatList
              data={[{ _id: null, name: 'None – no preference', barangay: '' }, ...allRoutes]}
              keyExtractor={(item) => item._id || 'none'}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const isActive = item._id ? preferredRoute?.id === item._id : !preferredRoute;
                return (
                  <TouchableOpacity
                    style={[styles.routeItem, isActive && styles.routeItemActive]}
                    onPress={() => handleSelectRoute(item._id ? item : null)}
                  >
                    <MaterialIcons
                      name={item._id ? 'alt-route' : 'not-interested'}
                      size={18}
                      color={isActive ? '#006A3B' : '#C4CEC7'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.routeItemText, isActive && { color: '#006A3B', fontWeight: '700' }]}>
                        {item.name}
                      </Text>
                      {item.barangay ? (
                        <Text style={styles.routeItemSub}>{item.barangay}</Text>
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

      {/* ── Edit Profile Modal ── */}
      <Modal
        visible={editModal}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalSheetTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setEditModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#1B1C1C" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Driver Full Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g. Juan Dela Cruz"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Assigned Truck</Text>
                <View style={styles.readonlyField}>
                  <MaterialIcons name="local-shipping" size={18} color="#7A8C7F" />
                  <Text style={styles.readonlyFieldText}>
                    Truck ID: {truckId || 'Not Assigned'} (Set by Dispatch Official)
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, (!editName.trim() || saving) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!editName.trim() || saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#006A3B' },
  scroll:   { flex: 1, backgroundColor: '#F8FAFC' },

  // ── Cover Header ──
  coverHeader: {
    backgroundColor: '#006A3B',
    paddingTop: 16,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  screenLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },

  // ── White Sheet ──
  whiteSheet: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -28,
    paddingTop: 16,
  },

  // ── Avatar ──
  avatarSection: {
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 4,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 12,
    position: 'relative',
  },
  avatar: {
    flex: 1,
    borderRadius: 44,
    backgroundColor: '#E4EEE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '800',
    color: '#006A3B',
    letterSpacing: -0.5,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#006A3B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1B1C1C',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  barangayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  barangayBadgeText: { fontSize: 12, fontWeight: '700', color: '#006A3B' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
    maxWidth: '85%',
  },
  metaText: { fontSize: 13, color: '#7A8C7F' },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    paddingVertical: 18,
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EDF4F0',
  },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1B1C1C',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#7A8C7F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  statDivider: { width: 1, backgroundColor: '#EDF4F0' },

  // ── Body ──
  body: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // ── Section labels ──
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7A8C7F',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 6,
  },

  // ── Truck Card ──
  truckCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EDF4F0',
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  truckIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  truckIconWrapOnline: { backgroundColor: '#ECFDF5' },
  truckInfo: { flex: 1, gap: 3 },
  truckTitle: { fontSize: 16, fontWeight: '700', color: '#1B1C1C' },
  truckMeta: { fontSize: 12, color: '#6F7A70' },
  operationalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  operationalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' },
  operationalDotOff: { backgroundColor: '#BECABE' },
  operationalText: { fontSize: 12, fontWeight: '700', color: '#059669' },
  operationalTextOff: { color: '#9CA3AF' },

  // ── Cards ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDF4F0',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  separator: { height: 1, backgroundColor: '#F2F6F3', marginLeft: 56 },

  // ── Menu rows ──
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: { fontSize: 15, color: '#1B1C1C', fontWeight: '500' },
  menuValue: { fontSize: 14, color: '#7A8C7F', maxWidth: 140 },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingTop: 12,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#EDF4F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    marginBottom: 12,
  },
  modalSheetTitle: { fontSize: 20, fontWeight: '700', color: '#1B1C1C' },
  routeModalHint: {
    fontSize: 13,
    color: '#7A8C7F',
    marginBottom: 12,
    lineHeight: 18,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  routeItemActive: { backgroundColor: '#ECFDF5' },
  routeItemText: { fontSize: 15, color: '#374151', fontWeight: '500' },
  routeItemSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A8C7F',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: '#F6FAF8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1B1C1C',
    borderWidth: 1,
    borderColor: '#EDF4F0',
  },
  readonlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  readonlyFieldText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  saveBtn: {
    backgroundColor: '#006A3B',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
