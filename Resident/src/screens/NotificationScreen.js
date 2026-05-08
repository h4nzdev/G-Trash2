import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
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
  };
}

const NotificationItem = ({ item }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'resolved': return 'assignment-turned-in';
      case 'report': return 'assignment';
      case 'calendar': return 'event';
      case 'truck': return 'local-shipping';
      default: return 'notifications';
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'resolved': return '#006A3B';
      case 'report': return '#2196F3';
      case 'calendar': return '#FF9800';
      case 'truck': return '#006A3B';
      default: return colors.primaryGreen;
    }
  };

  return (
    <TouchableOpacity style={[styles.notificationItem, !item.read && styles.unreadItem]}>
      <View style={[styles.iconContainer, { backgroundColor: `${getIconColor(item.type)}15` }]}>
        <MaterialIcons name={getIcon(item.type)} size={24} color={getIconColor(item.type)} />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
};

export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reportsRes, scheduleRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/reports`),
        fetch(`${API_URL}/api/schedules/today`),
      ]);

      const items = [];

      // Build notification items from reports
      if (reportsRes.status === 'fulfilled' && reportsRes.value.ok) {
        const reports = await reportsRes.value.json();
        reports.slice(0, 10).forEach(r => items.push(reportToNotification(r)));
      }

      // Add today's schedule as a notification at the top if it exists
      if (scheduleRes.status === 'fulfilled' && scheduleRes.value.ok) {
        const { schedules } = await scheduleRes.value.json();
        if (schedules && schedules.length > 0) {
          const sched = schedules[0];
          items.unshift({
            id: `sched-${sched._id}`,
            title: "Today's Collection",
            message: `Truck ${sched.truckId}${sched.driverName ? ` (${sched.driverName})` : ''} is scheduled today${sched.routeName ? ` on the ${sched.routeName} route` : ''}.`,
            time: 'Today',
            type: 'calendar',
            read: true,
          });
        }
      }

      setNotifications(items);
    } catch (_) {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#1B1C1C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={fetchData}>
          <Ionicons name="refresh-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryGreen} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationItem item={item} />}
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
  settingsButton: { padding: 4 },
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
});
