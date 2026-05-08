import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

// Bar heights simulate a mini air quality chart
const barHeights = [30, 60, 45, 20];

export default function AirQualityCard({ status = 'Moderate', value = 85 }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Current Air Quality</Text>
      <Text style={styles.status}>{status}</Text>
      <View style={styles.chartContainer}>
        {barHeights.map((h, i) => (
          <View key={i} style={[styles.bar, { height: h }]} />
        ))}
      </View>
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
  title: { fontSize: 14, color: colors.greyedOut, marginBottom: 4 },
  status: { fontSize: 18, fontWeight: 'bold', color: colors.yellow, marginBottom: 12 },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 70,
    gap: 8,
  },
  bar: {
    flex: 1,
    backgroundColor: colors.lightGreen,
    borderRadius: 4,
  },
});
