import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNetwork } from '../context/NetworkContext';

// Shows for 3 s then slides away when connection type is positive (cellular/wifi restored).
// Stays visible indefinitely when offline.
const BANNER_HEIGHT = 36;
const AUTO_HIDE_MS = 3000;

export default function NetworkBanner() {
  const { isConnected, isOnMobileData, connectionType } = useNetwork();

  // What the banner should currently say / look like
  const [banner, setBanner] = useState(null); // null = hidden
  const slideAnim = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
  const hideTimer = useRef(null);

  const show = (config) => {
    clearTimeout(hideTimer.current);
    setBanner(config);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hide = () => {
    Animated.timing(slideAnim, {
      toValue: -BANNER_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setBanner(null));
  };

  useEffect(() => {
    clearTimeout(hideTimer.current);

    if (!isConnected) {
      show({ icon: 'wifi-off', text: 'No internet connection', bg: '#B91C1C', fg: '#FEF2F2' });
      // stays until reconnected
    } else if (isOnMobileData) {
      show({ icon: 'signal-cellular-alt', text: 'Using mobile data', bg: '#92400E', fg: '#FFFBEB' });
      hideTimer.current = setTimeout(hide, AUTO_HIDE_MS);
    } else if (connectionType === 'wifi') {
      show({ icon: 'wifi', text: 'Connected to WiFi', bg: '#065F46', fg: '#ECFDF5' });
      hideTimer.current = setTimeout(hide, AUTO_HIDE_MS);
    }

    return () => clearTimeout(hideTimer.current);
  }, [isConnected, isOnMobileData, connectionType]);

  if (!banner) return null;

  return (
    <Animated.View style={[styles.banner, { backgroundColor: banner.bg, transform: [{ translateY: slideAnim }] }]}>
      <MaterialIcons name={banner.icon} size={14} color={banner.fg} />
      <Text style={[styles.text, { color: banner.fg }]}>{banner.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: BANNER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    zIndex: 999,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
