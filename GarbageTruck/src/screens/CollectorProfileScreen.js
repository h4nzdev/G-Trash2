import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ProfileMenuItem from '../components/ProfileMenuItem';
import { useAuth } from '../context/AuthContext';

const STATS = [
  { label: 'Total Collected', value: '1,245kg', icon: 'scale',          color: '#006A3B' },
  { label: 'Stops Completed', value: '186',      icon: 'local-shipping', color: '#006E1C' },
  { label: 'Rating',          value: '4.8 ⭐',   icon: 'star',           color: '#D97706' },
  { label: 'On-Time Rate',    value: '94%',       icon: 'schedule',       color: '#006A3B' },
];

export default function CollectorProfileScreen() {
  const [notifEnabled, setNotifEnabled] = useState(true);
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel',  style: 'cancel' },
        { text: 'Logout',  style: 'destructive', onPress: logout },
      ]
    );
  };

  const collectorInfo = {
    id:       user?.truckId || 'GT-402',
    name:     user?.name || 'Juan Dela Cruz',
    route:    'North Cebu Route',
    truck:    user?.truckId || 'GT-402',
    capacity: '2.5 tons',
  };

  return (
    <SafeAreaView style={styles.safeArea} >
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={52} color="#BECABE" />
            </View>
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.8}>
              <MaterialIcons name="edit" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.collectorName}>{collectorInfo.name}</Text>
          <Text style={styles.collectorId}>{collectorInfo.id}</Text>
          <View style={styles.routeChip}>
            <MaterialIcons name="location-on" size={14} color="#006A3B" />
            <Text style={styles.routeChipText}>{collectorInfo.route}</Text>
          </View>
        </View>

        {/* Stats 2×2 grid */}
        <View style={styles.statsGrid}>
          {STATS.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: stat.color + '18' }]}>
                <MaterialIcons name={stat.icon} size={20} color={stat.color} />
              </View>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Settings — Preferences */}
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
              onPress={() => {}}
            />
            <ProfileMenuItem
              icon="local-shipping"
              label="Vehicle Info"
              value={collectorInfo.truck}
              onPress={() => {}}
              isLast
            />
          </View>
        </View>

        {/* Settings — Resources */}
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
              iconBg="rgba(245,166,35,0.12)"
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

        {/* Assigned truck card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assigned Truck</Text>
          <View style={styles.truckCard}>
            <View style={styles.truckIconWrap}>
              <MaterialIcons name="local-shipping" size={28} color="#006A3B" />
            </View>
            <View style={styles.truckInfo}>
              <Text style={styles.truckTitle}>Truck {collectorInfo.truck}</Text>
              <Text style={styles.truckMeta}>Capacity: {collectorInfo.capacity}</Text>
              <Text style={styles.truckMeta}>Last Maintenance: Dec 15, 2024</Text>
              <View style={styles.operationalRow}>
                <View style={styles.operationalDot} />
                <Text style={styles.operationalText}>Operational</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.menuCard}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#FBF9F8' },
  container: { paddingHorizontal: 16, paddingTop: 24 },

  profileHeader: { alignItems: 'center', marginBottom: 32 },
  avatarWrap:    { position: 'relative', marginBottom: 16 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F0EDED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  editBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#006A3B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  collectorName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1B1C1C',
    letterSpacing: -0.3,
    lineHeight: 34,
    marginBottom: 4,
  },
  collectorId: { fontSize: 15, color: '#6F7A70', lineHeight: 20, marginBottom: 10 },
  routeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,106,59,0.08)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,106,59,0.18)',
  },
  routeChipText: { fontSize: 13, fontWeight: '600', color: '#006A3B' },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'flex-start',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0EDED',
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  statLabel: { fontSize: 12, color: '#6F7A70', lineHeight: 16 },

  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#1B1C1C', lineHeight: 22, marginBottom: 12 },

  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0EDED',
  },

  truckCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0EDED',
  },
  truckIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(0,106,59,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  truckInfo:        { flex: 1, gap: 4 },
  truckTitle:       { fontSize: 17, fontWeight: '600', color: '#1B1C1C', lineHeight: 22 },
  truckMeta:        { fontSize: 13, color: '#6F7A70', lineHeight: 18 },
  operationalRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  operationalDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#006A3B' },
  operationalText:  { fontSize: 13, fontWeight: '600', color: '#006A3B' },

  bottomSpacer: { height: 16 },
});
