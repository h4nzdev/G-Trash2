import React, { useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Image, 
  TouchableOpacity, Dimensions, Animated 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../constants/colors';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Smart Waste Tracking',
    description: 'Never miss a collection again. Track garbage trucks in real-time and get notified precisely when they enter your street.',
    icon: 'local-shipping',
    color: '#006A3B'
  },
  {
    id: '2',
    title: 'Community Reporting',
    description: 'See a problem? Report overflowing bins or illegal dumping instantly. Let the community vote to prioritize urgent issues.',
    icon: 'report-problem',
    color: '#2E7D32'
  },
  {
    id: '3',
    title: 'Engage & Discuss',
    description: 'Join the conversation. Discuss reports with your neighbors and stay updated on the resolution status of local issues.',
    icon: 'forum',
    color: '#388E3C'
  },
  {
    id: '4',
    title: 'Collection Calendar',
    description: 'Stay organized with a personalized schedule. View upcoming collection dates and waste types for your specific barangay.',
    icon: 'calendar-today',
    color: '#43A047'
  },
  {
    id: '5',
    title: 'Make an Impact',
    description: 'Every action counts. Earn points by segregating waste correctly and contribute to a cleaner, greener Cebu City.',
    icon: 'park',
    color: '#1B5E20'
  }
];

export default function OnboardingScreen({ onFinish }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef(null);

  const viewableItemsChanged = useRef(({ viewableItems }) => {
    setCurrentIndex(viewableItems[0].index);
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleFinish = async () => {
    await AsyncStorage.setItem('@HasSeenTour', 'true');
    onFinish();
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleFinish();
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.slide}>
      <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
        <MaterialIcons name={item.icon} size={100} color={item.color} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.skipHeader}>
        {currentIndex < SLIDES.length - 1 && (
          <TouchableOpacity onPress={handleFinish}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 3 }}>
        <FlatList
          data={SLIDES}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          onViewableItemsChanged={viewableItemsChanged}
          viewConfig={viewConfig}
          ref={slidesRef}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.paginator}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [10, 24, 10],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.2, 1, 0.2],
              extrapolate: 'clamp',
            });
            return <Animated.View style={[styles.dot, { width: dotWidth, opacity }]} key={i.toString()} />;
          })}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipHeader: {
    height: 40,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  skipText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  footer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 40,
    width: '100%',
  },
  paginator: {
    flexDirection: 'row',
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primaryGreen,
    marginHorizontal: 8,
  },
  button: {
    backgroundColor: colors.primaryGreen,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
