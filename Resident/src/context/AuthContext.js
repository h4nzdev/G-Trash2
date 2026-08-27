import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import API_URL from '../config';

const AuthContext = createContext();

async function registerAndSavePushToken(residentId, token) {
  try {
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
    fetch(`${API_URL}/api/residents/${residentId}/push-token`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ pushToken }),
    }).catch(() => {});
  } catch (err) {
    console.warn('Push token registration failed:', err);
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for persisted user on app launch
    loadStorageData();
  }, []);

  async function loadStorageData() {
    try {
      const authDataSerialized = await AsyncStorage.getItem('@AuthData');
      if (authDataSerialized) {
        const _authData = JSON.parse(authDataSerialized);
        
        // Verify with the backend if the user still exists
        const res = await fetch(`${API_URL}/api/residents/${_authData.id}`, {
          headers: { 'Authorization': `Bearer ${_authData.token}` }
        });
        
        if (res.ok) {
          const freshData = await res.json();
          const mergedData = { ..._authData, ...freshData };
          setUser(mergedData);
          await AsyncStorage.setItem('@AuthData', JSON.stringify(mergedData));
          registerAndSavePushToken(mergedData.id, mergedData.token);
        } else {
          // Resident deleted or invalid session, force logout
          setUser(null);
          await AsyncStorage.removeItem('@AuthData');
        }
      }
    } catch (error) {
      console.error('Failed to load auth data', error);
      // Fallback: keep current session on network/server error to allow offline mode
    } finally {
      setIsLoading(false);
    }
  }

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/residents/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      const userData = { ...data.user, token: data.token };
      setUser(userData);
      await AsyncStorage.setItem('@AuthData', JSON.stringify(userData));
      registerAndSavePushToken(userData.id, userData.token);
      return userData;
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (formData) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/residents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || data.error || 'Registration failed');
        err.code = data.error;
        err.messageCebuano = data.messageCebuano || null;
        throw err;
      }

      const userData = { ...data.user, token: data.token };
      setUser(userData);
      await AsyncStorage.setItem('@AuthData', JSON.stringify(userData));
      registerAndSavePushToken(userData.id, userData.token);
      return userData;
    } catch (error) {
      console.error('Register failed', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updatedData) => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/residents/${user.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(updatedData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      const newUser = { ...user, ...data.user };
      setUser(newUser);
      await AsyncStorage.setItem('@AuthData', JSON.stringify(newUser));
      return newUser;
    } catch (error) {
      console.error('Update profile failed', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      await AsyncStorage.removeItem('@AuthData');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, updateProfile, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
