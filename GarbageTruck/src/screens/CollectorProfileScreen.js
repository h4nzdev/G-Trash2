import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileMenuItem from '../components/ProfileMenuItem';
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
        // Keep local auth cache in sync with DB
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
  }, [truckId]);

  useEffect(() => { fetchProfileData(); }, [fetchProfileData]);

  // Load saved route preference from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('@truck_route_preference')
      .then((val) => { if (val) setPreferredRoute(JSON.parse(val)); })
      .catch(() => {});
  }, []);

  const handleSelectRoute = async (route) => {
    const pref = route ? { id: route._id, name: route.name, barangay: route.barangay || '' } : null;
    setPreferredRoute(pref);
    await AsyncStorage.setItem('@truck_route_preference', JSON.stringify(pref));
    setShowRouteModal(false);
  };

  // Derived display values — DB data takes priority over cached auth
  const driverName = fleetData?.driverName || user?.driverName || 'Driver';
  const routeName  = routeData?.name || fleetData?.route || user?.route || 'No route assigned';
  const isOnline   = truckStatus?.status === 'online';

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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {loadingData ? (
                <ActivityIndicator size="large" color="#006A3B" />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.8} onPress={openEditModal}>
              <MaterialIcons name="edit" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.collectorName}>{driverName}</Text>
          <Text style={styles.collectorId}>{truckId}</Text>
          <View style={styles.routeChip}>
            <MaterialIcons name="location-on" size={14} color="#006A3B" />
            <Text style={styles.routeChipText} numberOfLines={1}>{routeName}</Text>
          </View>
        </View>

        {/* Truck status card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assigned Truck</Text>
          <View style={styles.truckCard}>
            <View style={[styles.truckIconWrap, isOnline && styles.truckIconWrapOnline]}>
              <MaterialIcons name="local-shipping" size={28} color={isOnline ? '#006A3B' : '#BECABE'} />
            </View>
            <View style={styles.truckInfo}>
              <Text style={styles.truckTitle}>Truck {truckId}</Text>
              {routeData ? (
                <>
                  <Text style={styles.truckMeta}>Route: {routeData.name}</Text>
                  {routeData.barangay && (
                    <Text style={styles.truckMeta}>Area: {routeData.barangay}</Text>
                  )}
                  {routeData.totalStops != null && (
                    <Text style={styles.truckMeta}>Total stops: {routeData.totalStops}</Text>
                  )}
                </>
              ) : (
                <Text style={styles.truckMeta}>
                  {loadingData ? 'Loading route info…' : 'No route assigned yet'}
                </Text>
              )}
              <View style={styles.operationalRow}>
                <View style={[styles.operationalDot, !isOnline && styles.operationalDotOff]} />
                <Text style={[styles.operationalText, !isOnline && styles.operationalTextOff]}>
                  {isOnline ? 'Currently Active' : 'Standby'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <MaterialIcons name="route" size={16} color="#006A3B" />
            <Text style={styles.statPillValue}>
              {routeData?.waypoints?.length ?? routeData?.totalStops ?? '—'}
            </Text>
            <Text style={styles.statPillLabel}>Stops</Text>
          </View>
          <View style={styles.statPillDivider} />
          <View style={styles.statPill}>
            <MaterialIcons name="local-shipping" size={16} color="#2196F3" />
            <Text style={styles.statPillValue}>{truckId || '—'}</Text>
            <Text style={styles.statPillLabel}>Truck</Text>
          </View>
          <View style={styles.statPillDivider} />
          <View style={styles.statPill}>
            <MaterialIcons name="fiber-manual-record" size={16} color={isOnline ? '#10B981' : '#BECABE'} />
            <Text style={styles.statPillValue}>{isOnline ? 'Online' : 'Offline'}</Text>
            <Text style={styles.statPillLabel}>Status</Text>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.menuCard}>
            <ProfileMenuItem
              icon="notifications"
              label="Notification Settings"
              showToggle
              toggleValue={notifEnabled}
              onToggle={setNotifEnabled}
            />
            <ProfileMenuItem
              icon="map"
              label="Route Preferences"
              value={preferredRoute ? preferredRoute.name : 'None'}
              onPress={() => setShowRouteModal(true)}
            />
            <ProfileMenuItem
              icon="local-shipping"
              label="Vehicle Info"
              value={truckId}
              onPress={() => {}}
              isLast
            />
          </View>
        </View>

        {/* Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resources</Text>
          <View style={styles.menuCard}>
            <ProfileMenuItem
              icon="menu-book"
              label="Segregation Guide"
              onPress={() => {}}
            />
            <ProfileMenuItem
              icon="report-problem"
              iconBg="#FEF4DC"
              iconColor="#92400E"
              label="Report Problem"
              onPress={() => {}}
            />
            <ProfileMenuItem
              icon="help-outline"
              label="Help & Support"
              onPress={() => {}}
              isLast
            />
          </View>
        </View>

        {/* Logout */}
        <View style={[styles.menuCard, { marginBottom: 0 }]}>
          <ProfileMenuItem
            icon="logout"
            label="Logout"
            danger
            onPress={handleLogout}
            isLast
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Route Preference Modal */}
      <Modal
        visible={showRouteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRouteModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRouteModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <View style={styles.modalIconWrap}>
                <MaterialIcons name="map" size={20} color="#006A3B" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Route Preference</Text>
                <Text style={styles.modalSub}>Used when no schedule is assigned</Text>
              </View>
            </View>

            <FlatList
              data={[{ _id: null, name: 'None – no preference', barangay: '' }, ...allRoutes]}
              keyExtractor={(item) => item._id || 'none'}
              style={styles.routeList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isActive = item._id ? preferredRoute?.id === item._id : !preferredRoute;
                return (
                  <TouchableOpacity
                    style={[styles.routeItem, isActive && styles.routeItemActive]}
                    onPress={() => handleSelectRoute(item._id ? item : null)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.routeItemIcon, isActive && styles.routeItemIconActive]}>
                      <MaterialIcons
                        name={item._id ? 'alt-route' : 'not-interested'}
                        size={18}
                        color={isActive ? '#006A3B' : '#9CA3AF'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.routeItemName, isActive && styles.routeItemNameActive]}>
                        {item.name}
                      </Text>
                      {item.barangay ? (
                        <Text style={styles.routeItemSub}>{item.barangay}</Text>
                      ) : null}
                    </View>
                    {isActive && (
                      <MaterialIcons name="check-circle" size={20} color="#006A3B" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalTitleRow}>
              <View style={styles.modalIconWrap}>
                <MaterialIcons name="person" size={20} color="#006A3B" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <Text style={styles.modalSub}>Update your display name</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="e.g. Juan Dela Cruz"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={60}
            />

            <View style={styles.truckIdRow}>
              <MaterialIcons name="local-shipping" size={16} color="#6B7280" />
              <Text style={styles.truckIdHint}>Truck ID: {truckId} (cannot be changed)</Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, (!editName.trim() || saving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={!editName.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#FBF9F8' },
  container: { paddingHorizontal: 16, paddingTop: 24 },

  profileHeader: { alignItems: 'center', marginBottom: 28 },
  avatarWrap:    { position: 'relative', marginBottom: 16 },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#E4EEE9',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 6,
  },
  avatarInitials: { fontSize: 32, fontWeight: '700', color: '#006A3B', letterSpacing: -0.5 },
  editBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#006A3B', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  collectorName: {
    fontSize: 26, fontWeight: '700', color: '#1B1C1C',
    letterSpacing: -0.3, lineHeight: 32, marginBottom: 4, textAlign: 'center',
  },
  collectorId: { fontSize: 15, color: '#6F7A70', lineHeight: 20, marginBottom: 10 },
  routeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#E4EEE9', borderRadius: 9999,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#C8DDD4', maxWidth: '80%',
  },
  routeChipText: { fontSize: 13, fontWeight: '600', color: '#006A3B' },

  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#1B1C1C', lineHeight: 22, marginBottom: 12 },

  truckCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 16,
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
    borderWidth: 1, borderColor: '#F0EDED',
  },
  truckIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#F0EDED',
    justifyContent: 'center', alignItems: 'center',
  },
  truckIconWrapOnline: { backgroundColor: '#E4EEE9' },
  truckInfo:    { flex: 1, gap: 4 },
  truckTitle:   { fontSize: 17, fontWeight: '600', color: '#1B1C1C', lineHeight: 22 },
  truckMeta:    { fontSize: 13, color: '#6F7A70', lineHeight: 18 },
  operationalRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  operationalDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#006A3B' },
  operationalDotOff: { backgroundColor: '#BECABE' },
  operationalText: { fontSize: 13, fontWeight: '600', color: '#006A3B' },
  operationalTextOff: { color: '#9CA3AF' },

  statsRow: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 16, marginBottom: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
    borderWidth: 1, borderColor: '#F0EDED',
  },
  statPill:      { flex: 1, alignItems: 'center', gap: 4 },
  statPillValue: { fontSize: 15, fontWeight: '700', color: '#1B1C1C' },
  statPillLabel: { fontSize: 11, color: '#6F7A70', textTransform: 'uppercase', letterSpacing: 0.5 },
  statPillDivider: { width: 1, height: 32, backgroundColor: '#F0EDED' },

  menuCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
    borderWidth: 1, borderColor: '#F0EDED',
  },

  bottomSpacer: { height: 32 },

  // ── Edit modal ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2,
    alignSelf: 'center', marginBottom: 24,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  modalIconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: '#E4EEE9',
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1B1C1C', letterSpacing: -0.3 },
  modalSub:   { fontSize: 13, color: '#6B7280', marginTop: 2 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8, marginTop: 4 },
  textInput: {
    backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 16, color: '#1B1C1C', marginBottom: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  truckIdRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24,
  },
  truckIdHint: { fontSize: 13, color: '#9CA3AF' },
  saveBtn: {
    backgroundColor: '#006A3B', paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginBottom: 12,
  },
  saveBtnDisabled: { backgroundColor: '#6DA880' },
  saveBtnText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, color: '#9CA3AF' },

  routeList: { maxHeight: 360, marginBottom: 8 },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  routeItemActive: { backgroundColor: '#F0FDF4', borderRadius: 12, paddingHorizontal: 8 },
  routeItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeItemIconActive: { backgroundColor: '#DCFCE7' },
  routeItemName: { fontSize: 15, color: '#1B1C1C', fontWeight: '500' },
  routeItemNameActive: { color: '#006A3B', fontWeight: '700' },
  routeItemSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
});
