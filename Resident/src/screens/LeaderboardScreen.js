import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import API_URL from '../config';
import colors from '../constants/colors';

const TROPHY_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardScreen() {
  const [rankings, setRankings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overall');

  const fetchLeaderboard = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leaderboard`);
      const data = await res.json();
      setRankings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Leaderboard fetch error:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard(true);
  };

  const renderRankItem = ({ item, index }) => {
    const total = item.points || 0;
    const maxPts = rankings[0]?.points || 1;
    const barWidth = Math.round((total / maxPts) * 100);

    return (
      <View style={styles.rankItem}>
        <View style={styles.rankNumberContainer}>
          {index < 3 ? (
            <MaterialIcons name="emoji-events" size={24} color={TROPHY_COLORS[index]} />
          ) : (
            <Text style={styles.rankNumber}>{index + 1}</Text>
          )}
        </View>

        <View style={styles.barangayInfo}>
          <Text style={styles.barangayName}>{item.barangay || '—'}</Text>
          <View style={styles.statRow}>
            <MaterialIcons name="delete" size={12} color="#10B981" />
            <Text style={styles.statText}>{item.pickupCount ?? 0} pickups</Text>
            <View style={styles.statDivider} />
            <MaterialIcons name="thumb-up" size={12} color="#3B82F6" />
            <Text style={styles.statText}>{item.reportVoteCount ?? 0} votes</Text>
            <View style={styles.statDivider} />
            <MaterialIcons name="eco" size={12} color="#059669" />
            <Text style={styles.statText}>{item.areaQualityPts ?? 0} area</Text>
          </View>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{total}</Text>
          <Text style={styles.scoreLabel}>pts</Text>
          <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: `${barWidth}%` }]} />
          </View>
        </View>
      </View>
    );
  };

  const renderTips = () => (
    <View style={styles.tipsContainer}>
      <Text style={styles.tipsTitle}>How to earn points for your Barangay?</Text>

      <View style={styles.tipCard}>
        <View style={styles.tipIconContainer}>
          <MaterialIcons name="delete-outline" size={24} color="#006A3B" />
        </View>
        <View style={styles.tipContent}>
          <Text style={styles.tipHeader}>Confirm Trash Pickups (+1 pt)</Text>
          <Text style={styles.tipText}>
            Tap "Trash Picked Up" when the collector arrives. Each confirmed pickup earns your barangay 1 point.
          </Text>
        </View>
      </View>

      <View style={styles.tipCard}>
        <View style={[styles.tipIconContainer, { backgroundColor: '#E0F2FE' }]}>
          <MaterialIcons name="thumb-up" size={24} color="#0369A1" />
        </View>
        <View style={styles.tipContent}>
          <Text style={[styles.tipHeader, { color: '#0369A1' }]}>Vote on Reports (+1 pt)</Text>
          <Text style={styles.tipText}>
            Upvote or downvote community reports. Every vote cast earns your barangay 1 point.
          </Text>
        </View>
      </View>

      <View style={styles.tipCard}>
        <View style={[styles.tipIconContainer, { backgroundColor: '#DCFCE7' }]}>
          <MaterialIcons name="eco" size={24} color="#059669" />
        </View>
        <View style={styles.tipContent}>
          <Text style={[styles.tipHeader, { color: '#059669' }]}>Keep Areas Clean (+1–3 pts)</Text>
          <Text style={styles.tipText}>
            IoT sensors reward barangays with clean air quality. Clean = +3 pts, Moderate = +1 pt per sensor reading.
          </Text>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryGreen} />
        <Text style={styles.loadingText}>Calculating Rankings...</Text>
      </View>
    );
  }

  const topBarangay = rankings[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>City Leaderboard</Text>
            <Text style={styles.subtitle}>Cleanest & Most Responsive Barangays</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <MaterialIcons name="refresh" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          {['overall', 'tips'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab === 'overall' ? 'Rankings' : 'How to Earn'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === 'overall' ? (
        <FlatList
          data={rankings}
          renderItem={renderRankItem}
          keyExtractor={(item) => item._id || item.barangay}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryGreen} />}
          ListHeaderComponent={
            <>
              {topBarangay && (
                <View style={styles.winnerCard}>
                  <View style={styles.winnerInfo}>
                    <View style={styles.badge}>
                      <MaterialIcons name="star" size={16} color="#FFFFFF" />
                      <Text style={styles.badgeText}>TOP PERFORMER</Text>
                    </View>
                    <Text style={styles.winnerName}>{topBarangay.barangay}</Text>
                    <Text style={styles.winnerStats}>{topBarangay.points} points earned</Text>
                    <View style={styles.winnerBreakdown}>
                      <Text style={styles.winnerBreakdownText}>
                        🗑 {topBarangay.pickupCount ?? 0} pickups · 👍 {topBarangay.reportVoteCount ?? 0} votes · 🌿 {topBarangay.areaQualityPts ?? 0} area pts
                      </Text>
                    </View>
                  </View>
                  <View style={styles.trophyContainer}>
                    <MaterialIcons name="emoji-events" size={80} color="#FFD700" />
                  </View>
                </View>
              )}
              <Text style={styles.listHeader}>Barangay Rankings</Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="leaderboard" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No rankings yet.</Text>
              <Text style={styles.emptySubtext}>Confirm your first pickup to earn points!</Text>
            </View>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {renderTips()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF9F8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  header: { paddingTop: 16, paddingBottom: 8 },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingHorizontal: 24, marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '900', color: '#1F2937' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  refreshBtn: {
    padding: 8, backgroundColor: '#FFFFFF', borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  tabBar: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, marginBottom: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F3F4F6' },
  activeTab: { backgroundColor: '#006A3B' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  activeTabText: { color: '#FFFFFF' },
  winnerCard: {
    backgroundColor: '#006A3B', borderRadius: 32, padding: 24,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#006A3B', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, marginBottom: 32,
  },
  winnerInfo: { flex: 1 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 12,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  winnerName: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  winnerStats: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4, fontWeight: '700' },
  winnerBreakdown: { marginTop: 8 },
  winnerBreakdownText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' },
  trophyContainer: { marginLeft: 16 },
  listContent: { paddingHorizontal: 24, paddingBottom: 120 },
  listHeader: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginBottom: 16 },
  rankItem: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20,
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  rankNumberContainer: { width: 32, alignItems: 'center', justifyContent: 'center' },
  rankNumber: { fontSize: 16, fontWeight: '900', color: '#9CA3AF' },
  barangayInfo: { flex: 1, marginLeft: 12 },
  barangayName: { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  statDivider: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginHorizontal: 2 },
  statText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  scoreContainer: { alignItems: 'flex-end', width: 52 },
  scoreText: { fontSize: 20, fontWeight: '900', color: '#1F2937' },
  scoreLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '700', marginTop: -2, marginBottom: 4 },
  scoreBarBg: { width: '100%', height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, overflow: 'hidden' },
  scoreBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 2 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, color: '#9CA3AF', fontWeight: '700' },
  emptySubtext: { fontSize: 13, color: '#D1D5DB', fontWeight: '500' },
  tipsContainer: { paddingTop: 16 },
  tipsTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginBottom: 20 },
  tipCard: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 20,
    borderRadius: 24, marginBottom: 16, alignItems: 'flex-start', gap: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  tipIconContainer: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: '#DCFCE7',
    alignItems: 'center', justifyContent: 'center',
  },
  tipContent: { flex: 1 },
  tipHeader: { fontSize: 15, fontWeight: '800', color: '#065F46', marginBottom: 4 },
  tipText: { fontSize: 12, color: '#4B5563', lineHeight: 18, fontWeight: '500' },
});
