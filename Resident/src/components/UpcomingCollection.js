import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';

export default function UpcomingCollection({ day = 'Tomorrow', time = '8:00 AM' }) {
  return (
    <View style={styles.card}>
      <Ionicons name="trash-outline" size={32} color={colors.primaryGreen} style={{ marginRight: 12 }} />
      <View>
        <Text style={styles.title}>Next Collection</Text>
        <Text style={styles.subtitle}>{day}, {time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 13, color: colors.greyedOut, marginBottom: 2 },
  subtitle: { fontSize: 16, fontWeight: 'bold', color: colors.primaryGreen },
});
