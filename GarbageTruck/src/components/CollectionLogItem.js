import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function CollectionLogItem({ time, location, type, weight }) {
  return (
    <View style={styles.row}>
      <Text style={styles.time}>{time}</Text>

      <View style={styles.center}>
        <Text style={styles.location}>{location}</Text>
        <Text style={styles.type}>{type}</Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.weight}>{weight}</Text>
        <MaterialIcons name="check-circle" size={16} color="#006A3B" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDED',
    gap: 12,
  },
  time: {
    fontSize: 12,
    color: '#6F7A70',
    width: 64,
    lineHeight: 16,
  },
  center: { flex: 1 },
  location: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1B1C1C',
    lineHeight: 20,
  },
  type: {
    fontSize: 12,
    color: '#6F7A70',
    marginTop: 2,
    lineHeight: 16,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weight: {
    fontSize: 15,
    fontWeight: '700',
    color: '#006A3B',
  },
});
