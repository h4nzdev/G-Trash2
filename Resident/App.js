import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import ReportIssueScreen from './src/screens/ReportIssueScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CustomSplashScreen from './src/screens/CustomSplashScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import colors from './src/constants/colors';
import './src/i18n';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [hasSeenTour, setHasSeenTour] = useState(null);
  const [prevUser, setPrevUser] = useState(null);

  useEffect(() => {
    checkTourStatus();
  }, []);

  // Trigger splash when logging in (transition from null to user)
  useEffect(() => {
    if (!prevUser && user) {
      setShowSplash(true);
    }
    setPrevUser(user);
  }, [user]);

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

  // 1. Show Splash Screen (On app start OR after login)
  if (showSplash) {
    return <CustomSplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // Auth protected screens
        <>
          <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
          <Stack.Screen name="Report" component={ReportIssueScreen} />
          <Stack.Screen name="Notifications" component={NotificationScreen} />
        </>
      ) : (
        // Public screens
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
