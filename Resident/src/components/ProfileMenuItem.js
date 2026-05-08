import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';

export default function ProfileMenuItem({
  icon,
  label,
  value,
  showToggle,
  toggleValue,
  onToggle,
  onPress,
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={22} color={colors.primaryGreen} style={styles.icon} />
      <Text style={styles.label}>{label}</Text>
      {showToggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ true: colors.lightGreen, false: '#ddd' }}
          thumbColor={toggleValue ? colors.primaryGreen : '#f4f3f4'}
        />
      ) : value ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.greyedOut} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  icon: { marginRight: 14 },
  label: { flex: 1, fontSize: 15, color: colors.darkGrey },
  value: { fontSize: 14, color: colors.greyedOut },
});
