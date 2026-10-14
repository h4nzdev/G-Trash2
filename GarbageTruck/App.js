import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CollectorTabNavigator from './src/navigation/CollectorTabNavigator';
import LoginScreen from './src/screens/LoginScreen';
import AnimatedSplash from './src/components/AnimatedSplash';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NetworkProvider } from './src/context/NetworkContext';
import colors from './src/constants/colors';

// Keep the native splash until our animated one is on screen or session restores
SplashScreen.preventAutoHideAsync();

function RootNavigation() {
  const { user, isLoading } = useAuth();
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);
  const [minAnimationPassed, setMinAnimationPassed] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@has_seen_animated_splash')
      .then((val) => {
        const firstTime = val !== 'true';
        setIsFirstLaunch(firstTime);
        if (!firstTime) {
          setSplashDone(true);
        }
      })
      .catch(() => {
        setIsFirstLaunch(false);
        setSplashDone(true);
      });
  }, []);

  // For returning users: hide native splash as soon as session restoration finishes
  useEffect(() => {
    if (isFirstLaunch === false && !isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isFirstLaunch, isLoading]);

  // For first-time users: dismiss animated splash only when BOTH min duration has passed AND session restored
  useEffect(() => {
    if (isFirstLaunch === true && minAnimationPassed && !isLoading) {
      AsyncStorage.setItem('@has_seen_animated_splash', 'true').catch(() => {});
      setSplashDone(true);
    }
  }, [isFirstLaunch, minAnimationPassed, isLoading]);

  const handleNativeReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleAnimationFinish = useCallback(() => {
    setMinAnimationPassed(true);
  }, []);

  const showAnimatedSplash = isFirstLaunch === true && !splashDone;

  return (
    <>
      {isLoading && !showAnimatedSplash ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator size="large" color={colors.primaryGreen} />
        </View>
      ) : (
        <NavigationContainer>
          {user ? <CollectorTabNavigator /> : <LoginScreen />}
        </NavigationContainer>
      )}

      {showAnimatedSplash && (
        <AnimatedSplash
          onReady={handleNativeReady}
          onFinish={handleAnimationFinish}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <RootNavigation />
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
