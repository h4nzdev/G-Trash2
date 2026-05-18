import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet,
  Modal, TouchableOpacity, Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';

import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import ReportIssueScreen from './src/screens/ReportIssueScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import BugReportScreen from './src/screens/BugReportScreen';
import MyRewardsScreen from './src/screens/MyRewardsScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CustomSplashScreen from './src/screens/CustomSplashScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import colors from './src/constants/colors';
import API_URL from './src/config';
import useTruckProximity from './src/hooks/useTruckProximity';
import TruckProximityBanner from './src/components/TruckProximityBanner';
import './src/i18n';

const Stack = createNativeStackNavigator();

const ANN_STYLES = {
  info:     { border: '#2196F3', bg: '#EFF6FF', icon: 'information-circle',  iconColor: '#2196F3', label: 'Info'     },
  success:  { border: '#006A3B', bg: '#ECFDF5', icon: 'checkmark-circle',    iconColor: '#006A3B', label: 'Success'  },
  warning:  { border: '#F59E0B', bg: '#FFFBEB', icon: 'warning',             iconColor: '#F59E0B', label: 'Warning'  },
  critical: { border: '#EF4444', bg: '#FEF2F2', icon: 'alert-circle',        iconColor: '#EF4444', label: 'Critical' },
};

function AnnouncementModal({ announcement, onDismiss }) {
  if (!announcement) return null;
  const s = ANN_STYLES[announcement.type] ?? ANN_STYLES.info;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          {/* Colored top bar */}
          <View style={[modalStyles.topBar, { backgroundColor: s.border }]} />

          <View style={modalStyles.body}>
            {/* Icon + type badge */}
            <View style={modalStyles.iconRow}>
              <View style={[modalStyles.iconCircle, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={28} color={s.iconColor} />
              </View>
              <View style={[modalStyles.badge, { backgroundColor: s.bg }]}>
                <Text style={[modalStyles.badgeText, { color: s.iconColor }]}>
                  {s.label.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Content */}
            <Text style={modalStyles.title}>{announcement.title}</Text>
            <Text style={modalStyles.message}>{announcement.message}</Text>

            {announcement.createdBy && (
              <Text style={modalStyles.from}>From: {announcement.createdBy}</Text>
            )}

            {/* Dismiss */}
            <TouchableOpacity style={[modalStyles.btn, { backgroundColor: s.border }]} onPress={onDismiss} activeOpacity={0.85}>
              <Text style={modalStyles.btnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const LAYER_ORDER = { FAR: 1, MEDIUM: 2, NEAR: 3 };

function AppNavigator() {
  const { user, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [hasSeenTour, setHasSeenTour] = useState(null);
  const [prevUser, setPrevUser] = useState(null);
  const [announcementQueue, setAnnouncementQueue] = useState([]);
  const [socket, setSocket] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const prevProxLayerRef = useRef(null);

  useEffect(() => {
    checkTourStatus();
  }, []);

  useEffect(() => {
    if (!prevUser && user) setShowSplash(true);
    setPrevUser(user);
  }, [user]);

  // Global socket — announcements, report status, truck proximity, and rewards
  useEffect(() => {
    if (!user) { setSocket(null); return; }
    const s = io(API_URL, { transports: ['polling', 'websocket'] });

    // Join resident-specific room for targeted reward notifications
    s.emit('resident:join', { residentId: user._id || user.id });

    s.on('announcement:new', (data) => {
      setAnnouncementQueue((q) => [...q, data]);
    });

    s.on('report:updated', (report) => {
      const isOwn = report.userId?.toString() === user.id || report.userId === user.id;
      if (!isOwn) return;
      const statusMessages = {
        'in-progress': { title: 'Report In Progress', message: `Your report "${report.category}" has been picked up and is being actioned.`, type: 'info' },
        'resolved':    { title: 'Report Resolved', message: `Your report "${report.category}" has been marked resolved. Please confirm if the issue is fixed.`, type: 'success' },
        'escalated':   { title: 'Report Escalated', message: `Your report "${report.category}" was not actioned within 72h. It has been escalated.`, type: 'warning' },
      };
      const key = report.escalated && report.status === 'pending' ? 'escalated' : report.status;
      const notif = statusMessages[key];
      if (notif) setAnnouncementQueue((q) => [...q, notif]);
    });

    s.on('reward:new', (data) => {
      setAnnouncementQueue((q) => [...q, {
        title: '🎉 You\'ve been awarded!',
        message: `You received "${data.title}"${data.rewardValue ? ` — ${data.rewardValue}` : ''}. Visit My Rewards to claim it!`,
        type: 'success',
      }]);
    });

    setSocket(s);
    return () => { s.disconnect(); setSocket(null); };
  }, [user]);

  // Truck proximity — works across all screens while app is in foreground
  const { proximityLayer, nearestTruck } = useTruckProximity(socket);

  // Re-show banner whenever truck escalates to a more urgent layer
  useEffect(() => {
    const prev = LAYER_ORDER[prevProxLayerRef.current] ?? 0;
    const curr = LAYER_ORDER[proximityLayer] ?? 0;
    if (curr > prev) setBannerDismissed(false);
    prevProxLayerRef.current = proximityLayer;
  }, [proximityLayer]);

  const dismissAnnouncement = () => {
    setAnnouncementQueue((q) => q.slice(1));
  };

  const checkTourStatus = async () => {
    try {
      const value = await AsyncStorage.getItem('@HasSeenTour');
      setHasSeenTour(value === 'true');
    } catch (e) {
      setHasSeenTour(false);
    }
  };

  if (isLoading || hasSeenTour === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryGreen} />
      </View>
    );
  }

  if (showSplash) {
    return <CustomSplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            <Stack.Screen name="Report" component={ReportIssueScreen} />
            <Stack.Screen name="Notifications" component={NotificationScreen} />
            <Stack.Screen name="BugReport" component={BugReportScreen} />
            <Stack.Screen name="MyRewards" component={MyRewardsScreen} />
          </>
        ) : (
          <>
            {!hasSeenTour ? (
              <Stack.Screen name="Onboarding">
                {(props) => <OnboardingScreen {...props} onFinish={() => setHasSeenTour(true)} />}
              </Stack.Screen>
            ) : (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
              </>
            )}
          </>
        )}
      </Stack.Navigator>

      {/* Truck proximity banner — floats over every screen */}
      <TruckProximityBanner
        layer={bannerDismissed ? null : proximityLayer}
        nearestTruck={nearestTruck}
        onDismiss={() => setBannerDismissed(true)}
      />

      {/* Global announcement modal — renders on top of any screen */}
      <AnnouncementModal
        announcement={announcementQueue[0] ?? null}
        onDismiss={dismissAnnouncement}
      />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF9F8',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  topBar: {
    height: 5,
    width: '100%',
  },
  body: {
    padding: 24,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B1C1C',
    marginBottom: 8,
    lineHeight: 24,
  },
  message: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
    marginBottom: 8,
  },
  from: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 20,
  },
  btn: {
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
