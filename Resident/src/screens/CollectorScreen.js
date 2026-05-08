import React, { useState, useRef } from 'react';
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

import StatsCard from '../components/StatsCard';
import RouteTimelineCollector from '../components/RouteTimelineCollector';
import PickupActionCard from '../components/PickupActionCard';
import HeatmapMiniCard from '../components/HeatmapMiniCard';
import CollectionLogItem from '../components/CollectionLogItem';

const INITIAL_STOPS = [
  { name: 'Ayala',     time: '08:30 AM', status: 'completed'   },
  { name: 'IT Park',   time: '09:15 AM', status: 'completed'   },
  { name: 'Apas',      time: '09:45 AM', status: 'completed'   },
  { name: 'Lahug',     time: '10:45 AM', status: 'in-progress' },
  { name: 'Banilad',   time: '11:30 AM', status: 'upcoming'    },
  { name: 'Talamban',  time: '12:15 PM', status: 'upcoming'    },
];

const LOG_DATA = [
  { time: '08:30 AM', location: 'Ayala',   type: 'General',     weight: '52kg' },
  { time: '09:15 AM', location: 'IT Park', type: 'Recyclables', weight: '38kg' },
  { time: '09:45 AM', location: 'Apas',    type: 'Mixed',       weight: '45kg' },
];

const HEATMAP_DATA = [
  { status: 'critical', location: 'Carbon Market', count: '2 areas'  },
  { status: 'moderate', location: 'Colon Street',  count: '1 area'   },
  { status: 'clean',    location: 'IT Park',       count: 'All clear' },
];

export default function CollectorScreen({ navigation }) {
  const [stops, setStops] = useState(INITIAL_STOPS);
  const [pickupStatus, setPickupStatus] = useState('pending'); // 'pending' | 'cleaned'
  const scrollRef = useRef(null);
  const actionRef = useRef(null);

  const currentStopIndex = stops.findIndex(s => s.status === 'in-progress');
  const currentStop = stops[currentStopIndex];
  const completedCount = stops.filter(s => s.status === 'completed').length;
  const progressPct = Math.round((completedCount / stops.length) * 100);

  const handleMarkCleaned = () => {
    setPickupStatus('cleaned');
    // After brief success display, advance to next stop
    setTimeout(() => {
      setStops(prev =>
        prev.map((stop, i) => {
          if (i === currentStopIndex) return { ...stop, status: 'completed' };
          if (i === currentStopIndex + 1 && stop.status === 'upcoming') {
            return { ...stop, status: 'in-progress' };
          }
          return stop;
        })
      );
      setPickupStatus('pending');
    }, 1500);
  };

  const handleReportIssue = () => {
    Alert.alert(
      'Report Issue',
      'Select the type of issue at this location:',
      [
        { text: 'Overflowing Bin',  onPress: () => console.log('Overflowing reported') },
        { text: 'Hazardous Waste',  onPress: () => console.log('Hazardous reported')   },
        { text: 'Access Blocked',   onPress: () => console.log('Access reported')      },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const scrollToAction = () => {
    actionRef.current?.measureLayout(
      scrollRef.current,
      (_x, y) => scrollRef.current?.scrollTo({ y, animated: true }),
      () => {}
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Top app bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="eco" size={24} color="#047857" />
          <Text style={styles.brandTitle}>G-TRASH</Text>
        </View>
        <View style={styles.avatar}>
          <MaterialIcons name="person" size={22} color="#BECABE" />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>Good Morning, Collector!</Text>
          <Text style={styles.subtitle}>Driver ID: GT-402 | Route: North Cebu</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatsCard
            icon="local-shipping"
            value={`${completedCount}/${stops.length}`}
            label="Stops Completed"
            progress={progressPct}
          />
          <StatsCard
            icon="schedule"
            value={currentStop ? currentStop.time : '—'}
            label={currentStop ? `${currentStop.name}, Block 5` : 'All stops done'}
            sublabel={currentStop ? 'On Time' : undefined}
          />
        </View>

        {/* Current pickup action — only visible when a stop is in-progress */}
        {currentStop ? (
          <View ref={actionRef} style={styles.section}>
            <Text style={styles.sectionTitle}>Current Pickup</Text>
            <PickupActionCard
              location={`${currentStop.name}, Block 5`}
              binCount={3}
              status={pickupStatus}
              onMarkCleaned={handleMarkCleaned}
              onReportIssue={handleReportIssue}
            />
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <MaterialIcons name="check-circle" size={40} color="#006A3B" />
            <Text style={styles.emptyTitle}>All stops cleared!</Text>
            <Text style={styles.emptySubtitle}>Great work today, GT-402.</Text>
          </View>
        )}

        {/* Route timeline */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assigned Route</Text>
            <View style={styles.routeBadge}>
              <MaterialIcons name="route" size={12} color="#006A3B" />
              <Text style={styles.routeBadgeText}>North Cebu</Text>
            </View>
          </View>
          <View style={styles.card}>
            <RouteTimelineCollector stops={stops} />
          </View>
        </View>

        {/* Heatmap status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Area Status</Text>
          <View style={styles.heatmapRow}>
            {HEATMAP_DATA.map((item, i) => (
              <HeatmapMiniCard
                key={i}
                status={item.status}
                location={item.location}
                count={item.count}
                onPress={() => Alert.alert(item.location, `Status: ${item.status}\n${item.count}`)}
              />
            ))}
          </View>
        </View>

        {/* Collection log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Collection Log</Text>
          <View style={styles.card}>
            {LOG_DATA.map((item, i) => (
              <CollectionLogItem
                key={i}
                time={item.time}
                location={item.location}
                type={item.type}
                weight={item.weight}
              />
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Floating action button — navigates to report issue */}
      {currentStop ? (
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => navigation.navigate('Report')} 
          activeOpacity={0.85}
        >
          <MaterialIcons name="flag" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBF9F8',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: -0.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0EDED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Scroll content
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  greetingSection: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1B1C1C',
    letterSpacing: -0.4,
    lineHeight: 41,
  },
  subtitle: {
    fontSize: 15,
    color: '#6F7A70',
    marginTop: 4,
    lineHeight: 20,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },

  // Sections
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1B1C1C',
    lineHeight: 22,
    marginBottom: 16,
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,106,59,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    marginBottom: 16,
  },
  routeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#006A3B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0EDED',
  },

  // Heatmap
  heatmapRow: {
    flexDirection: 'row',
    gap: 10,
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#006A3B',
    lineHeight: 22,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6F7A70',
    lineHeight: 18,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#006A3B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  bottomSpacer: {
    height: 40,
  },
});
