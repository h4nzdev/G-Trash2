import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LAYER_CONFIG = {
  FAR: {
    bg: '#FFFBEB',
    border: '#F59E0B',
    iconColor: '#D97706',
    icon: 'notifications-outline',
    title: 'Garbage truck is in your area',
    sub: 'Within 500 m — heads up!',
  },
  MEDIUM: {
    bg: '#EFF6FF',
    border: '#3B82F6',
    iconColor: '#2563EB',
    icon: 'car-outline',
    title: 'Garbage truck is approaching',
    sub: 'Within 200 m — prepare your trash',
  },
  NEAR: {
    bg: '#FEF2F2',
    border: '#EF4444',
    iconColor: '#DC2626',
    icon: 'alert-circle-outline',
    title: 'Garbage truck is nearby!',
    sub: 'Within 50 m — bring your trash out NOW',
  },
};

// Escalation order — higher number = more urgent
const LAYER_ORDER = { FAR: 1, MEDIUM: 2, NEAR: 3 };

export default function TruckProximityBanner({ layer, nearestTruck, onDismiss }) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(-120)).current;
  const prevLayerRef = useRef(null);

  useEffect(() => {
    if (layer) {
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 9,
      }).start();

      // Vibrate only when entering NEAR
      const prev = LAYER_ORDER[prevLayerRef.current] ?? 0;
      const curr = LAYER_ORDER[layer] ?? 0;
      if (layer === 'NEAR' && curr > prev) {
        Vibration.vibrate([0, 200, 100, 200]);
      }
    } else {
      Animated.timing(slideY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
    prevLayerRef.current = layer;
  }, [layer, slideY]);

  // Keep rendering during slide-out animation
  const displayLayer = layer || prevLayerRef.current;
  if (!displayLayer) return null;

  const cfg = LAYER_CONFIG[displayLayer];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          backgroundColor: cfg.bg,
          borderColor: cfg.border,
          transform: [{ translateY: slideY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.iconWrap, { backgroundColor: cfg.border + '22' }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.iconColor} />
      </View>

      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: cfg.iconColor }]} numberOfLines={1}>
          {cfg.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {nearestTruck?.distance != null
            ? `${nearestTruck.distance} m away — ${cfg.sub.split('—')[1]?.trim() ?? cfg.sub}`
            : cfg.sub}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onDismiss}
        style={styles.closeBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={16} color="#6B7280" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1,
  },
  sub: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  closeBtn: {
    padding: 4,
    flexShrink: 0,
  },
});
