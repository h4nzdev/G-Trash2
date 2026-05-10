import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const CONFIG = {
  critical: { bg: '#FDE9E9', border: '#F8D0D0', color: '#BA1A1A', icon: 'warning'               },
  moderate: { bg: '#FEF4DC', border: '#FBE4B3', color: '#92400E', icon: 'remove-circle-outline' },
  clean:    { bg: '#EBF3EE', border: '#C8DDD4', color: '#006A3B', icon: 'check-circle-outline'  },
};

export default function HeatmapMiniCard({ status, location, count, onPress }) {
  const cfg = CONFIG[status] || CONFIG.clean;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialIcons name={cfg.icon} size={22} color={cfg.color} />
      <Text style={[styles.location, { color: cfg.color }]} numberOfLines={2}>
        {location}
      </Text>
      <Text style={styles.count}>{count}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  location: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
  count: {
    fontSize: 11,
    color: '#6F7A70',
    textAlign: 'center',
    lineHeight: 14,
  },
});
