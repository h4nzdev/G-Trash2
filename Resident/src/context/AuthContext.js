import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

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
        setUser(_authData);
      }
    } catch (error) {
      console.error('Failed to load auth data', error);
    } finally {
      setIsLoading(false);
    }
  }

  const login = async (email, password) => {
    // Mock login logic
    setIsLoading(true);
    try {
      // In a real app, you'd call an API here
      const mockUser = {
        id: '1',
        name: 'Jane Doe',
        email: email,
        address: 'Block 5, Lahug, Cebu City',
      };

      setUser(mockUser);
      await AsyncStorage.setItem('@AuthData', JSON.stringify(mockUser));
    } catch (error) {
      console.error('Login failed', error);
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
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
