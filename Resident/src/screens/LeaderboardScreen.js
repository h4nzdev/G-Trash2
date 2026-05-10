import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, 
  TouchableOpacity, Image, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import API_URL from '../config';
import colors from '../constants/colors';

const TROPHY_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardScreen() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overall'); // 'overall', 'weekly', 'tips'

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Leaderboard fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderRankItem = ({ item, index }) => {
    // Mocking the efficiency score for visual demo
    const efficiency = 85 + (index === 0 ? 10 : index === 1 ? 7 : 2);
    
    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        style={styles.rankItem}
      >
        <View style={styles.rankNumberContainer}>
          {index < 3 ? (
            <MaterialIcons name="emoji-events" size={24} color={TROPHY_COLORS[index]} />
          ) : (
            <Text style={styles.rankNumber}>{index + 1}</Text>
          )}
        </View>
        
        <View style={styles.barangayInfo}>
          <Text style={styles.barangayName}>{item._id || 'Barangay'}</Text>
          <View style={styles.statRow}>
            <MaterialIcons name="check-circle" size={12} color="#10B981" />
            <Text style={styles.resolvedCount}>{item.count} Fixed</Text>
            <View style={styles.statDivider} />
            <MaterialIcons name="speed" size={12} color="#3B82F6" />
            <Text style={styles.resolvedCount}>{efficiency}% Efficient</Text>
          </View>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{efficiency}%</Text>
          <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: `${efficiency}%` }]} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTips = () => (
    <View style={styles.tipsContainer}>
      <Text style={styles.tipsTitle}>How to help your Barangay rank up?</Text>
      
      <View style={styles.tipCard}>
        <View style={styles.tipIconContainer}>
          <MaterialIcons name="add-a-photo" size={24} color="#006A3B" />
        </View>
        <View style={styles.tipContent}>
          <Text style={styles.tipHeader}>Report Issues Early</Text>
          <Text style={styles.tipText}>The faster you report illegal dumping or overflowing bins, the faster your Barangay can resolve them.</Text>
        </View>
      </View>

      <View style={styles.tipCard}>
        <View style={[styles.tipIconContainer, { backgroundColor: '#E0F2FE' }]}>
          <MaterialIcons name="restore-from-trash" size={24} color="#0369A1" />
        </View>
        <View style={styles.tipContent}>
          <Text style={[styles.tipHeader, { color: '#0369A1' }]}>Sort Your Waste</Text>
          <Text style={styles.tipText}>Properly sorted waste speeds up the collection process by 30%, increasing efficiency scores.</Text>
        </View>
      </View>

      <View style={styles.tipCard}>
        <View style={[styles.tipIconContainer, { backgroundColor: '#FEF3C7' }]}>
          <MaterialIcons name="schedule" size={24} color="#B45309" />
        </View>
        <View style={styles.tipContent}>
          <Text style={[styles.tipHeader, { color: '#B45309' }]}>Be on Time</Text>
          <Text style={styles.tipText}>Place your bins at the curb before 7:30 AM to ensure the truck doesn't have to wait or double back.</Text>
        </View>
      </View>
    </View>
  );

  if (isLoading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryGreen} />
        <Text style={styles.loadingText}>Calculating Rankings...</Text>
      </View>
    );
  }

  const topBarangay = stats?.leaderboard?.[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>City Leaderboard</Text>
            <Text style={styles.subtitle}>Cleanest & Most Responsive Barangays</Text>
          </View>
          <TouchableOpacity onPress={fetchLeaderboard} style={styles.refreshBtn}>
            <MaterialIcons name="refresh" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Custom Tabs */}
        <View style={styles.tabBar}>
          {['overall', 'tips'].map((tab) => (
            <TouchableOpacity 
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === 'overall' ? (
        <FlatList
          data={stats?.leaderboard || []}
          renderItem={renderRankItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {topBarangay && (
                <View style={styles.winnerCard}>
                  <View style={styles.winnerInfo}>
                    <View style={styles.badge}>
                      <MaterialIcons name="star" size={16} color="#FFFFFF" />
                      <Text style={styles.badgeText}>TOP PERFORMER</Text>
                    </View>
                    <Text style={styles.winnerName}>{topBarangay._id}</Text>
                    <Text style={styles.winnerStats}>{topBarangay.count} reports resolved this week</Text>
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
              <MaterialIcons name="info-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No data available yet.</Text>
            </View>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {renderTips()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF9F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  header: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  activeTab: {
    backgroundColor: '#006A3B',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  winnerCard: {
    backgroundColor: '#006A3B',
    borderRadius: 32,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 32,
  },
  winnerInfo: {
    flex: 1,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  winnerName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  winnerStats: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  trophyContainer: {
    marginLeft: 16,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  listHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
  },
  rankItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  rankNumberContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#9CA3AF',
  },
  barangayInfo: {
    flex: 1,
    marginLeft: 12,
  },
  barangayName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 4,
  },
  resolvedCount: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  scoreContainer: {
    alignItems: 'flex-end',
    width: 60,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1F2937',
    marginBottom: 4,
  },
  scoreBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  tipsContainer: {
    paddingTop: 16,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 20,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    alignItems: 'start',
    gap: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  tipIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipContent: {
    flex: 1,
  },
  tipHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
});
