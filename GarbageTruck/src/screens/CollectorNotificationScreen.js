import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { NOTIF_STORAGE_KEY } from '../utils/notifications';

const TYPE_META = {
  schedule: { icon: 'event', color: '#006A3B', bg: '#E4EEE9' },
  alert:    { icon: 'warning', color: '#D97706', bg: '#FEF3C7' },
  system:   { icon: 'info', color: '#2563EB', bg: '#EFF6FF' },
};

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function CollectorNotificationScreen() {
  const [notifications, setNotifications] = useState([]);
  const { clearUnread } = useAuth();

  const load = useCallback(async () => {
    clearUnread();
    try {
      const raw = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
      setNotifications(raw ? JSON.parse(raw) : []);
    } catch {}
  }, [clearUnread]);

  useFocusEffect(load);

  const markAllRead = async () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
  };

  const clearAll = async () => {
    setNotifications([]);
    await AsyncStorage.removeItem(NOTIF_STORAGE_KEY);
  };

  const markRead = async (id) => {
    const updated = notifications.map((n) => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderItem = ({ item }) => {
    const meta = TYPE_META[item.data?.type] || TYPE_META.system;
    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.85}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <MaterialIcons name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardTime}>{formatTime(item.receivedAt)}</Text>
          </View>
          <Text style={styles.cardSub} numberOfLines={2}>{item.body}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF9F8" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>{unreadCount} unread</Text>
          )}
        </View>
        {notifications.length > 0 && (
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.actionBtn} onPress={markAllRead}>
                <Text style={styles.actionBtnText}>Mark all read</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, styles.clearBtn]} onPress={clearAll}>
              <Text style={[styles.actionBtnText, styles.clearBtnText]}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* List */}
      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="notifications-none" size={40} color="#BECABE" />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>Schedule assignments and alerts from your supervisor will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF9F8' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDED',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1B1C1C' },
  headerSub: { fontSize: 12, color: '#006A3B', fontWeight: '600', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#E4EEE9',
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#006A3B' },
  clearBtn: { backgroundColor: '#FEE2E2' },
  clearBtnText: { color: '#DC2626' },

  list: { padding: 16, gap: 2 },
  separator: { height: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0EDED',
  },
  cardUnread: {
    borderColor: '#B9D4BC',
    backgroundColor: '#FAFFFE',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#6F7A70', flex: 1, marginRight: 8 },
  cardTitleUnread: { fontWeight: '700', color: '#1B1C1C' },
  cardSub: { fontSize: 13, color: '#6F7A70', lineHeight: 18 },
  cardTime: { fontSize: 11, color: '#BECABE', fontWeight: '500' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#006A3B',
    marginTop: 4,
  },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F1F5F1',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1B1C1C', marginBottom: 8 },
  emptySub: { fontSize: 13, color: '#6F7A70', textAlign: 'center', lineHeight: 20 },
});
