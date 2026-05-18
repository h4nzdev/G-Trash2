import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import colors from '../constants/colors';
import API_URL from '../config';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function reportToNotification(report) {
  const isResolved = report.status === 'resolved';
  const isInProgress = report.status === 'in-progress';
  return {
    id: report._id,
    title: isResolved ? 'Report Resolved' : isInProgress ? 'Report In Progress' : 'Report Submitted',
    message: `Your report "${report.category}" has been ${
      isResolved ? 'resolved.' : isInProgress ? 'picked up and is being actioned.' : 'received and is under review.'
    }`,
    time: timeAgo(report.createdAt),
    type: isResolved ? 'resolved' : 'report',
    read: isResolved || isInProgress,
    _createdAt: report.createdAt,
  };
}

const NotificationItem = ({ item, onVerifyPickup, onViewReward }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'resolved':     return 'assignment-turned-in';
      case 'report':       return 'assignment';
      case 'calendar':     return 'event';
      case 'truck':        return 'local-shipping';
      case 'pickup':       return 'local-shipping';
      case 'announcement': return 'campaign';
      case 'reward':       return 'card-giftcard';
      default:             return 'notifications';
    }
  };

  const getIconColor = (type, annType) => {
    if (type === 'announcement') {
      const map = { info: '#2196F3', success: '#006A3B', warning: '#F59E0B', critical: '#EF4444' };
      return map[annType] ?? '#2196F3';
    }
    switch (type) {
      case 'resolved': return '#006A3B';
      case 'report':   return '#2196F3';
      case 'calendar': return '#FF9800';
      case 'truck':    return '#006A3B';
      case 'pickup':   return '#006A3B';
      case 'reward':   return '#D97706';
      default:         return colors.primaryGreen;
    }
  };

  const iconColor = getIconColor(item.type, item.annType);
  return (
    <View style={[styles.notificationItem, !item.read && styles.unreadItem]}>
      <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
        <MaterialIcons name={getIcon(item.type)} size={24} color={iconColor} />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <Text style={styles.message} numberOfLines={item.needsVerification ? 3 : 2}>{item.message}</Text>
        {item.needsVerification && !item.verified && (
          <View style={styles.verifyRow}>
            <TouchableOpacity
              style={styles.verifyYesBtn}
              onPress={() => onVerifyPickup(item.id, item.pickupId, true)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="check" size={14} color="#fff" />
              <Text style={styles.verifyYesText}>Yes, collected</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.verifyNoBtn}
              onPress={() => onVerifyPickup(item.id, item.pickupId, false)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="close" size={14} color="#BA1A1A" />
              <Text style={styles.verifyNoText}>No, missed me</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.verified && (
          <Text style={styles.verifiedNote}>
            {item.verifiedConfirmed ? '✓ You confirmed pickup' : '✗ Missed pickup reported'}
          </Text>
        )}
        {item.type === 'reward' && (
          <TouchableOpacity style={styles.viewRewardBtn} onPress={onViewReward} activeOpacity={0.85}>
            <MaterialIcons name="card-giftcard" size={14} color="#fff" />
            <Text style={styles.viewRewardText}>View My Rewards</Text>
          </TouchableOpacity>
        )}
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </View>
  );
};

export default function NotificationScreen({ navigation }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [truckNotifs, setTruckNotifs] = useState([]);
  const [pickupNotifs, setPickupNotifs] = useState([]);
  const [rewardNotifs, setRewardNotifs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clearedAt, setClearedAt] = useState(
    user?.notificationsClearedAt ? new Date(user.notificationsClearedAt) : null
  );
  const seenTrucksRef = useRef(new Set());

  const handleClearAll = useCallback(() => {
    const total = notifications.length + truckNotifs.length + pickupNotifs.length + rewardNotifs.length;
    if (total === 0) return;
    Alert.alert(
      'Clear Notifications',
      `Remove all ${total} notification${total !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const now = new Date();
            setNotifications([]);
            setTruckNotifs([]);
            setPickupNotifs([]);
            setRewardNotifs([]);
            seenTrucksRef.current.clear();
            setClearedAt(now);
            if (user?.id) {
              fetch(`${API_URL}/api/residents/${user.id}/notifications`, { method: 'DELETE' })
                .catch(() => {});
            }
          },
        },
      ],
    );
  }, [notifications.length, truckNotifs.length, pickupNotifs.length, rewardNotifs.length, user?.id]);

  const clearedAtRef = useRef(clearedAt);
  useEffect(() => { clearedAtRef.current = clearedAt; }, [clearedAt]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reportsRes, scheduleRes, announcementsRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/reports`),
        fetch(`${API_URL}/api/schedules/today`),
        fetch(`${API_URL}/api/announcements`),
      ]);

      const cutoff = clearedAtRef.current;
      const items = [];

      // System announcements — always at top
      if (announcementsRes.status === 'fulfilled' && announcementsRes.value.ok) {
        const anns = await announcementsRes.value.json();
        anns.slice(0, 10).forEach((a) => {
          items.push({
            id: `ann-${a._id}`,
            title: a.title,
            message: a.message,
            time: timeAgo(a.createdAt),
            type: 'announcement',
            annType: a.type,
            read: true,
            _createdAt: a.createdAt,
          });
        });
      }

      // Today's schedule
      if (scheduleRes.status === 'fulfilled' && scheduleRes.value.ok) {
        const { schedules } = await scheduleRes.value.json();
        if (schedules && schedules.length > 0) {
          const sched = schedules[0];
          items.push({
            id: `sched-${sched._id}`,
            title: "Today's Collection",
            message: `Truck ${sched.truckId}${sched.driverName ? ` (${sched.driverName})` : ''} is scheduled today${sched.routeName ? ` on the ${sched.routeName} route` : ''}.`,
            time: 'Today',
            type: 'calendar',
            read: true,
            _createdAt: sched.createdAt,
          });
        }
      }

      // Reports
      if (reportsRes.status === 'fulfilled' && reportsRes.value.ok) {
        const reports = await reportsRes.value.json();
        reports.slice(0, 10).forEach(r => items.push(reportToNotification(r)));
      }

      const filtered = cutoff
        ? items.filter((n) => !n._createdAt || new Date(n._createdAt) > cutoff)
        : items;
      setNotifications(filtered);
    } catch (_) {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVerifyPickup = useCallback(async (notifId, pickupId, confirmed) => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_URL}/api/pickup/${pickupId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, confirmed }),
      });
      if (res.ok) {
        setPickupNotifs((prev) =>
          prev.map((n) =>
            n.id === notifId
              ? { ...n, verified: true, verifiedConfirmed: confirmed, needsVerification: false }
              : n
          )
        );
        Alert.alert(
          confirmed ? 'Thank you!' : 'Missed Pickup Reported',
          confirmed
            ? 'Your confirmation helps improve garbage collection performance.'
            : 'A missed pickup report has been submitted for your barangay.',
        );
      }
    } catch (_) {
      Alert.alert('Error', 'Could not submit your response. Please try again.');
    }
  }, [user]);

  // Live truck, pickup, and reward notifications via socket
  useEffect(() => {
    const socket = io(API_URL, { transports: ['polling', 'websocket'] });

    // Join resident-specific room so targeted reward events reach this socket
    if (user?.id) socket.emit('resident:join', { residentId: user.id });

    socket.on('reward:new', (reward) => {
      setRewardNotifs(prev => {
        if (prev.some(n => n.rewardId === reward._id)) return prev;
        return [{
          id: `reward-${reward._id}-${Date.now()}`,
          rewardId: reward._id,
          title: '🎉 You received a reward!',
          message: `"${reward.title}" from Brgy. ${reward.barangay}. Claim it before it expires!`,
          time: 'Just now',
          type: 'reward',
          read: false,
        }, ...prev];
      });
    });

    socket.on('truck:location:update', ({ truckId }) => {
      if (seenTrucksRef.current.has(truckId)) return;
      seenTrucksRef.current.add(truckId);
      setTruckNotifs((prev) => [
        {
          id: `truck-online-${truckId}-${Date.now()}`,
          title: 'Truck Active',
          message: `Truck ${truckId} is currently collecting in your area.`,
          time: 'Just now',
          type: 'truck',
          read: false,
        },
        ...prev,
      ]);
    });

    socket.on('truck:status', ({ truckId, status }) => {
      if (status === 'offline') {
        seenTrucksRef.current.delete(truckId);
        setTruckNotifs((prev) => [
          {
            id: `truck-done-${truckId}-${Date.now()}`,
            title: 'Collection Complete',
            message: `Truck ${truckId} has finished collection in your area.`,
            time: 'Just now',
            type: 'truck',
            read: false,
          },
          ...prev,
        ]);
      }
    });

    socket.on('pickup:completed', (run) => {
      setPickupNotifs((prev) => [
        {
          id: `pickup-${run._id}-${Date.now()}`,
          pickupId: run._id,
          title: 'Garbage Collected!',
          message: `Truck ${run.truckId}${run.routeName ? ` (${run.routeName})` : ''} just completed pickup${run.barangay ? ` in ${run.barangay}` : ''}. Was your trash collected?`,
          time: 'Just now',
          type: 'pickup',
          read: false,
          needsVerification: true,
          verified: false,
        },
        ...prev,
      ]);
    });

    return () => socket.disconnect();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#1B1C1C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={fetchData}>
            <Ionicons name="refresh-outline" size={22} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleClearAll}>
            <MaterialIcons name="delete-sweep" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryGreen} />
        </View>
      ) : (
        <FlatList
          data={[...rewardNotifs, ...pickupNotifs, ...truckNotifs, ...notifications]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem
              item={item}
              onVerifyPickup={handleVerifyPickup}
              onViewReward={() => navigation.navigate('MyRewards')}
            />
          )}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="notifications-none" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF9F8' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1B1C1C' },
  backButton: { padding: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: { padding: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { paddingVertical: 8 },
  notificationItem: {
    flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0EDED', alignItems: 'center',
  },
  unreadItem: { backgroundColor: '#F0F9F4' },
  iconContainer: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  contentContainer: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '700', color: '#1B1C1C' },
  time: { fontSize: 12, color: '#6B7280' },
  message: { fontSize: 14, color: '#4B5563', lineHeight: 20 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryGreen, marginLeft: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#9CA3AF' },
  verifyRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  verifyYesBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#006A3B', borderRadius: 10, paddingVertical: 8, gap: 4,
  },
  verifyYesText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  verifyNoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: '#FECACA', gap: 4,
  },
  verifyNoText: { fontSize: 13, fontWeight: '700', color: '#BA1A1A' },
  verifiedNote: { fontSize: 12, color: '#6B7280', marginTop: 6, fontStyle: 'italic' },
  viewRewardBtn: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#D97706', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14,
    marginTop: 10, gap: 5,
  },
  viewRewardText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
