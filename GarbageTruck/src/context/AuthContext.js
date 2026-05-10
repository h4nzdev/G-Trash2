import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../config';

const BACKEND_URL = API_URL;
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadStorageData(); }, []);

  async function loadStorageData() {
    try {
      const stored = await AsyncStorage.getItem('@AuthData');
      if (stored) setUser(JSON.parse(stored));
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

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
