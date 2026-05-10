import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function RouteTimelineCollector({ stops }) {
  return (
    <View style={styles.container}>
      {stops.map((stop, index) => {
        const isCompleted = stop.status === 'completed';
        const isCurrent = stop.status === 'in-progress';
        const isLast = index === stops.length - 1;

        return (
          <View key={index} style={styles.row}>
            <View style={styles.indicatorCol}>
              <View style={[
                styles.dot,
                isCompleted && styles.dotCompleted,
                isCurrent && styles.dotCurrent,
              ]}>
                {isCompleted ? (
                  <MaterialIcons name="check" size={13} color="#FFFFFF" />
                ) : isCurrent ? (
                  <MaterialIcons name="local-shipping" size={15} color="#FFFFFF" />
                ) : (
                  <View style={styles.dotInner} />
                )}
              </View>
              {!isLast ? (
                <View style={[styles.line, isCompleted && styles.lineCompleted]} />
              ) : null}
            </View>

            <View style={[
              styles.content,
              isCurrent && styles.contentCurrent,
              isLast && styles.contentLast,
            ]}>
              <View style={styles.contentHeader}>
                <Text style={[styles.stopName, isCurrent && styles.stopNameCurrent]}>
                  {stop.name}
                </Text>
                {isCurrent ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>In Progress</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.stopTime, isCurrent && styles.stopTimeCurrent]}>
                {isCompleted ? `Completed · ${stop.time}` : stop.time}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  row: {
    flexDirection: 'row',
    minHeight: 64,
  },
  indicatorCol: {
    alignItems: 'center',
    width: 36,
    marginRight: 14,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0EDED',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  dotCompleted: {
    backgroundColor: '#006E1C',
    borderColor: '#FFFFFF',
  },
  dotCurrent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#006A3B',
    borderColor: '#FFFFFF',
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BECABE',
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#F0EDED',
    marginTop: -2,
    marginBottom: -2,
  },
  lineCompleted: { backgroundColor: '#BECABE' },
  content: {
    flex: 1,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  contentCurrent: {
    backgroundColor: '#EBF3EE',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C8DDD4',
    marginBottom: 20,
  },
  contentLast: { paddingBottom: 4 },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6F7A70',
    lineHeight: 20,
  },
  stopNameCurrent: {
    fontSize: 17,
    fontWeight: '700',
    color: '#006A3B',
  },
  badge: {
    backgroundColor: '#006A3B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stopTime: {
    fontSize: 12,
    color: '#6F7A70',
    marginTop: 4,
    lineHeight: 16,
  },
  stopTimeCurrent: {
    color: '#006A3B',
    fontWeight: '500',
  },
});
