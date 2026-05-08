import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

export default function TruckStatusBanner({ zones }) {
  return (
    <View style={styles.card}>
      <Text style={styles.header}>Garbage Truck Status</Text>
      {zones.map((zone, index) => (
        <View key={index} style={styles.row}>
          {/* Colored left border accent */}
          <View style={[styles.colorBar, { backgroundColor: zone.color }]} />
          <View style={styles.info}>
            <Text style={styles.zoneName}>{zone.name}</Text>
            <Text style={styles.distance}>{zone.distance}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: zone.color }]}>
            <Text style={styles.badgeText}>{zone.status}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  header: { fontSize: 15, fontWeight: 'bold', color: colors.darkGrey, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  colorBar: { width: 4, height: 40, borderRadius: 2, marginRight: 12 },
  info: { flex: 1 },
  zoneName: { fontSize: 14, fontWeight: '600', color: colors.darkGrey },
  distance: { fontSize: 12, color: colors.greyedOut },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '600' },
});
