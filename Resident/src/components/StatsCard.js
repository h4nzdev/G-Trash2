import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function StatsCard({ icon, value, label, sublabel, progress, color = '#006A3B' }) {
  return (
    <View style={styles.card}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: color + '1A' }]}>
          <MaterialIcons name={icon} size={20} color={color} />
        </View>
      ) : null}

      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>

      {sublabel ? (
        <View style={[styles.badge, { backgroundColor: color + '1A' }]}>
          <Text style={[styles.badgeText, { color }]}>{sublabel}</Text>
        </View>
      ) : null}

      {progress !== undefined ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%`, backgroundColor: color }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  value: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: '#6F7A70',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 16,
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  track: {
    height: 6,
    backgroundColor: '#F0EDED',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
});
