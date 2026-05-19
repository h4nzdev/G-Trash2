import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import API_URL from '../config';
import { saveNotification } from '../utils/notifications';

const BACKEND_URL = API_URL;
const AuthContext = createContext();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerAndSavePushToken(truckId) {
  if (!Device.isDevice) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'G-TRASH Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#006A3B',
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: '4c7208d5-5211-4ef1-a356-da0a6936022b',
  });
  const pushToken = tokenData.data;
  fetch(`${BACKEND_URL}/api/trucks/${truckId}/push-token`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pushToken }),
  }).catch(() => {});
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifListenerRef = useRef(null);

  useEffect(() => {
    loadStorageData();
    // Notification received while app is in foreground — save + badge
    notifListenerRef.current = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      saveNotification({ title, body, data }).then(() => {
        setUnreadCount((c) => c + 1);
      });
      // Write a flag so screens know to re-fetch on next focus
      if (data?.type === 'schedule' || data?.type === 'route') {
        AsyncStorage.setItem('@schedule_refresh_needed', 'true').catch(() => {});
      }
    });
    // Notification tapped — user opens app by tapping the notification
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'schedule' || data?.type === 'route') {
        AsyncStorage.setItem('@schedule_refresh_needed', 'true').catch(() => {});
      }
    });
    return () => {
      if (notifListenerRef.current) Notifications.removeNotificationSubscription(notifListenerRef.current);
      Notifications.removeNotificationSubscription(responseSub);
    };
  }, []);

  async function loadStorageData() {
    try {
      const stored = await AsyncStorage.getItem('@AuthData');
      if (stored) {
        const userData = JSON.parse(stored);
        setUser(userData);
        registerAndSavePushToken(userData.truckId);
      }
    } catch (e) {
      console.error('Failed to load auth data', e);
    } finally {
      setIsLoading(false);
    }
  }

  const login = (truckId) =>
    new Promise((resolve, reject) => {
      setIsLoading(true);
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `${BACKEND_URL}/api/fleet/${truckId.trim().toUpperCase()}`);
      xhr.timeout = 8000;
      xhr.onload = async () => {
        setIsLoading(false);
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          console.log(`[Auth] Login successful for truck: ${data.truckId}`, data);
          const userData = {
            truckId: data.truckId,
            driverName: data.driverName,
            route: data.route,
          };
          setUser(userData);
          await AsyncStorage.setItem('@AuthData', JSON.stringify(userData));
          registerAndSavePushToken(userData.truckId);
          resolve(userData);
        } else {
          reject(new Error('Invalid Truck ID. Please check with your supervisor.'));
        }
      };
      xhr.onerror = () => { setIsLoading(false); reject(new Error('Network error. Check your connection.')); };
      xhr.ontimeout = () => { setIsLoading(false); reject(new Error('Server timeout. Try again.')); };
      xhr.send();
    });

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem('@AuthData');
  };

  const updateUser = async (patch) => {
    const updated = { ...user, ...patch };
    setUser(updated);
    await AsyncStorage.setItem('@AuthData', JSON.stringify(updated));
  };

  const clearUnread = () => setUnreadCount(0);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoading, unreadCount, clearUnread }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
