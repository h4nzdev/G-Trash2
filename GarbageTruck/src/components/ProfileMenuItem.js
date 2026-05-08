import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProfileMenuItem({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  showToggle,
  toggleValue,
  onToggle,
  onPress,
  isLast,
  danger,
}) {
  const bgColor    = iconBg    || (danger ? 'rgba(186,26,26,0.10)' : 'rgba(0,106,59,0.10)');
  const iconTint   = iconColor || (danger ? '#BA1A1A' : '#006A3B');

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
        <MaterialIcons name={icon} size={20} color={iconTint} />
      </View>
      <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
      <View style={styles.right}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        {showToggle ? (
          <Switch
            value={toggleValue}
            onValueChange={onToggle}
            trackColor={{ false: '#E4E2E1', true: 'rgba(0,106,59,0.45)' }}
            thumbColor={toggleValue ? '#006A3B' : '#FFFFFF'}
          />
        ) : (
          <MaterialIcons name="chevron-right" size={22} color="#BECABE" />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: 52,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDED',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  label: {
    flex: 1,
    fontSize: 15,
    color: '#1B1C1C',
    lineHeight: 20,
  },
  labelDanger: { color: '#BA1A1A', fontWeight: '600' },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontSize: 14,
    color: '#6F7A70',
  },
});
