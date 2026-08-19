import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getProgressSummary } from '../utils/routeProgress';

const STATUS = {
  completed: { bg: '#F3F4F6', border: '#9CA3AF', text: '#9CA3AF', arrow: '#D1D5DB' },
  current:   { bg: '#FEF2F2', border: '#EF4444', text: '#EF4444', arrow: '#006A3B' },
  upcoming:  { bg: '#F0FDF4', border: '#006A3B', text: '#006A3B', arrow: '#006A3B' },
};

export default function RouteBoard({ route, enrichedStops, onPress }) {
  if (!route) {
    return (
      <View style={styles.emptyCard}>
        <MaterialIcons name="directions-bus" size={18} color="#9CA3AF" />
        <Text style={styles.emptyText}>No active collection route</Text>
      </View>
    );
  }

  const stops = enrichedStops?.length ? enrichedStops : [];
  const { completed, total } = getProgressSummary(stops);

  return (
    <View style={styles.card}>
      {/* Header row — tappable */}
      <TouchableOpacity
        style={styles.header}
        onPress={onPress}
        activeOpacity={0.88}
      >
        <MaterialIcons name="directions-bus" size={14} color="#006A3B" />
        <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>{completed}/{total}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={16} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Jeepney stop strip — horizontally scrollable */}
      {stops.length === 0 ? (
        <Text style={styles.noStops}>No stops defined for this route</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stopsRow}
          nestedScrollEnabled
        >
          {stops.map((stop, i) => {
            const cfg = STATUS[stop.status] ?? STATUS.upcoming;
            const isLast = i === stops.length - 1;

            return (
              <React.Fragment key={i}>
                {/* Stop node */}
                <View style={styles.stopNode}>
                  <View style={[
                    styles.stopCircle,
                    { backgroundColor: cfg.bg, borderColor: cfg.border },
                  ]}>
                    {stop.status === 'completed' ? (
                      <MaterialIcons name="check" size={12} color={cfg.text} />
                    ) : stop.status === 'current' ? (
                      <MaterialIcons name="local-shipping" size={12} color={cfg.text} />
                    ) : (
                      <Text style={[styles.stopNum, { color: cfg.text }]} numberOfLines={1}>
                        {stop.name
                          ? stop.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 3)
                          : `${i + 1}`}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[styles.stopLabel, { color: stop.status === 'completed' ? '#9CA3AF' : '#1F2937' }]}
                    numberOfLines={1}
                  >
                    {stop.name || `Stop ${i + 1}`}
                  </Text>
                </View>

                {/* Arrow connector */}
                {!isLast && (
                  <MaterialIcons
                    name="arrow-forward-ios"
                    size={10}
                    color={cfg.arrow}
                    style={styles.arrowIcon}
                  />
                )}
              </React.Fragment>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  routeName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  progressBadge: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#006A3B',
  },
  noStops: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 6,
  },
  stopsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  stopNode: {
    alignItems: 'center',
    width: 68,
  },
  stopCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  stopNum: {
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  stopLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    width: 66,
  },
  arrowIcon: {
    marginHorizontal: 2,
    marginBottom: 14,
  },
});
