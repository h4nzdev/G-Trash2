import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import colors from '../constants/colors';

const { width } = Dimensions.get('window');

export default function CustomSplashScreen({ onFinish }) {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      onFinish();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[
        styles.logoContainer, 
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
      ]}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="local-shipping" size={60} color="#FFFFFF" />
        </View>
        <Text style={styles.logoText}>G-TRASH</Text>
        <Text style={styles.tagline}>Smart Waste Management</Text>
      </Animated.View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>CLEANER CEBU • GREENER FUTURE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 16,
    color: '#E4EEE9',
    marginTop: 8,
    fontWeight: '600',
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
  },
  footerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    opacity: 0.8,
  }
});
