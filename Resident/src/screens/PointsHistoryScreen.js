import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import API_URL from '../config';

const ACTION_META = {
  correct_scan:      { icon: 'qr-code-scanner', color: '#10B981', label: 'AI Scan' },
  report_submit:     { icon: 'report-problem',  color: '#3B82F6', label: 'Report Submitted' },
  report_upvote:     { icon: 'thumb-up',        color: '#8B5CF6', label: 'Report Upvoted' },
  report_comment:    { icon: 'chat-bubble',     color: '#F59E0B', label: 'Comment Added' },
  verify_resolution: { icon: 'verified',        color: '#006A3B', label: 'Resolution Verified' },
  report_penalty:    { icon: 'report',          color: '#EF4444', label: 'Penalty' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function PointsHistoryScreen({ navigation }) {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [summary, setSummary] = useState(null);
  const LIMIT = 30;

  const uid = user?.id || user?._id;

  const fetchHistory = useCallback(async (p = 0, silent = false) => {
    if (!uid) return;
    if (!silent) p === 0 ? setLoading(true) : null;
    try {
      const [histRes, ptRes] = await Promise.all([
        fetch(`${API_URL}/api/residents/${uid}/points/history?page=${p}&limit=${LIMIT}`),
        p === 0 ? fetch(`${API_URL}/api/residents/${uid}/points`) : Promise.resolve(null),
      ]);
      if (histRes.ok) {
        const data = await histRes.json();
        setTotal(data.total);
        setHasMore(data.history.length === LIMIT);
        setHistory(prev => p === 0 ? data.history : [...prev, ...data.history]);
      }
      if (ptRes?.ok) setSummary(await ptRes.json());
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [uid]);

  useEffect(() => { fetchHistory(0); }, [fetchHistory]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchHistory(next, true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPage(0);
    fetchHistory(0, true);
  };

  const renderItem = ({ item }) => {
    const meta = ACTION_META[item.action] || { icon: 'star', color: '#9CA3AF', label: item.action };
    const positive = item.points > 0;
    return (
      <View style={styles.item}>
        <View style={[styles.iconBox, { backgroundColor: meta.color + '18' }]}>
          <MaterialIcons name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemLabel}>{meta.label}</Text>
          <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.itemTime}>{timeAgo(item.date)}</Text>
        </View>
        <Text style={[styles.itemPoints, { color: positive ? '#006A3B' : '#EF4444' }]}>
          {positive ? '+' : ''}{item.points}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Points History</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Summary */}
      {summary && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="star" size={20} color="#F59E0B" />
            <Text style={styles.summaryVal}>{summary.totalPoints ?? 0}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
            <Text style={styles.summaryVal}>{summary.monthlyPoints ?? 0}</Text>
            <Text style={styles.summaryLabel}>This Month</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="scan-outline" size={20} color="#10B981" />
            <Text style={styles.summaryVal}>{summary.stats?.correctScans ?? 0}</Text>
            <Text style={styles.summaryLabel}>Scans</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="document-text-outline" size={20} color="#8B5CF6" />
            <Text style={styles.summaryVal}>{summary.stats?.reportsSubmitted ?? 0}</Text>
            <Text style={styles.summaryLabel}>Reports</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#006A3B" />
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#006A3B" />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.countText}>{total} transaction{total !== 1 ? 's' : ''}</Text>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="star-outline" size={56} color="#E5E7EB" />
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptySub}>Start scanning waste or submitting reports to earn points!</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? <ActivityIndicator size="small" color="#006A3B" style={{ marginVertical: 16 }} /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#1F2937' },
  summaryRow: { flexDirection: 'row', backgroundColor: '#FFF', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  summaryCard: { flex: 1, alignItems: 'center', gap: 4 },
  summaryVal: { fontSize: 18, fontWeight: '900', color: '#1F2937' },
  summaryLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  countText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 12, marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginVertical: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  itemContent: { flex: 1 },
  itemLabel: { fontSize: 13, fontWeight: '800', color: '#1F2937' },
  itemDesc: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  itemTime: { fontSize: 10, color: '#9CA3AF', marginTop: 3 },
  itemPoints: { fontSize: 18, fontWeight: '900', marginLeft: 12, flexShrink: 0 },
  empty: { alignItems: 'center', marginTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#9CA3AF' },
  emptySub: { fontSize: 13, color: '#D1D5DB', textAlign: 'center', lineHeight: 20 },
});
