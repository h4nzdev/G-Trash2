import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

/**
 * NavigationOverlay Component
 * Toggles between 'Discovery Mode' and 'Active Guidance Mode'
 */
export default function NavigationOverlay() {
  const [isNavigating, setIsNavigating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <View style={styles.container} pointerEvents="box-none">
      {!isNavigating ? (
        /* Discovery Mode UI */
        <View style={styles.discoveryContainer} pointerEvents="box-none">
          <View style={styles.searchBarContainer}>
            <MaterialIcons name="search" size={20} color="#6F7A70" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search destination..."
              placeholderTextColor="#BECABE"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            style={styles.startButton}
            onPress={() => setIsNavigating(true)}
            activeOpacity={0.9}
          >
            <Text style={styles.startButtonText}>Start</Text>
            <MaterialIcons name="navigation" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      ) : (
        /* Active Guidance Mode UI */
        <View style={styles.guidanceContainer} pointerEvents="box-none">
          {/* Header Guidance Card */}
          <View style={styles.guidanceHeader}>
            <View style={styles.turnIconContainer}>
              <MaterialIcons name="navigation" size={32} color="#4CAF50" style={styles.turnIcon} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.distanceText}>380 m</Text>
              <Text style={styles.streetText}>Bg Canteen</Text>
            </View>
          </View>

          {/* Footer Navigation Bar */}
          <View style={styles.guidanceFooter}>
            <View style={styles.timeContainer}>
              <Text style={styles.timeRemaining}>1 min</Text>
              <Text style={styles.totalStats}> · 380 m</Text>
            </View>
            
            <TouchableOpacity
              style={styles.exitButton}
              onPress={() => setIsNavigating(false)}
            >
              <MaterialIcons name="close" size={24} color="#EF4444" />
              <Text style={styles.exitText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  /* Discovery Mode Styles */
  discoveryContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    // Shadows
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  searchIcon: { marginRight: 12 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1B1C1C',
    fontWeight: '500',
  },
  startButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    backgroundColor: '#006A3B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
    elevation: 10,
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  startButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  /* Guidance Mode Styles */
  guidanceContainer: {
    flex: 1,
    alignItems: 'center',
  },
  guidanceHeader: {
    position: 'absolute',
    top: 50,
    width: '90%',
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  turnIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  turnIcon: {
    transform: [{ rotate: '0deg' }], // Placeholder for directional logic
  },
  textContainer: {
    flex: 1,
  },
  distanceText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
  },
  streetText: {
    color: '#BECABE',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 2,
  },
  guidanceFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  timeRemaining: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1B1C1C',
  },
  totalStats: {
    fontSize: 16,
    color: '#6F7A70',
    fontWeight: '600',
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  exitText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
  },
});
