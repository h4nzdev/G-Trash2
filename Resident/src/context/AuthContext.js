import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import API_URL from "../config";

const AuthContext = createContext();

async function registerAndSavePushToken(residentId, token) {
  try {
    if (!residentId || !token) return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "G-TRASH Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#006A3B",
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "4c7208d5-5211-4ef1-a356-da0a6936022b",
    });
    const pushToken = tokenData.data;
    fetch(`${API_URL}/api/residents/${residentId}/push-token`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pushToken }),
    }).catch(() => {});
  } catch (err) {
    console.warn("Push token registration failed:", err);
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
      const authDataSerialized = await AsyncStorage.getItem("@AuthData");
      if (authDataSerialized) {
        const _authData = JSON.parse(authDataSerialized);

        // Mongo returns _id, but the app normalizes to id — support both
        const uid = _authData.id || _authData._id;

        if (!uid) {
          // Corrupted storage entry — force clean logout
          setUser(null);
          await AsyncStorage.removeItem("@AuthData");
          return;
        }

        // Verify with the backend if the user still exists
        const res = await fetch(`${API_URL}/api/residents/${uid}`, {
          headers: { Authorization: `Bearer ${_authData.token}` },
        });

        if (res.ok) {
          const freshData = await res.json();

          // Unwrap `{ user: {...} }` if present, otherwise use the flat payload.
          // This was the root cause of the missing profilePicture on relaunch:
          // the response is wrapped, so spreading it directly nested the fields.
          const freshPayload = freshData.user ?? freshData;

          const mergedData = { ..._authData, ...freshPayload };
          setUser(mergedData);
          await AsyncStorage.setItem("@AuthData", JSON.stringify(mergedData));
          registerAndSavePushToken(
            mergedData.id || mergedData._id,
            mergedData.token,
          );
        } else {
          // Resident deleted or invalid session, force logout
          setUser(null);
          await AsyncStorage.removeItem("@AuthData");
        }
      }
    } catch (error) {
      console.error("Failed to load auth data", error);
      // Fallback: keep current session on network/server error to allow offline mode
    } finally {
      setIsLoading(false);
    }
  }

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/residents/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      // 2FA required — return data so the UI can show QR + OTP input
      if (data.requires2FA) {
        return data;
      }

      const payload = data.user ?? data;
      const userData = { ...payload, token: data.token };
      setUser(userData);
      await AsyncStorage.setItem("@AuthData", JSON.stringify(userData));
      registerAndSavePushToken(userData.id || userData._id, userData.token);
      return userData;
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verify2FA = async (tempToken, code) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      const payload = data.user ?? data;
      const userData = { ...payload, token: data.token };
      setUser(userData);
      await AsyncStorage.setItem("@AuthData", JSON.stringify(userData));
      registerAndSavePushToken(userData.id || userData._id, userData.token);
      return userData;
    } catch (error) {
      console.error("2FA verification failed", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (formData) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/residents/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(
          data.message || data.error || "Registration failed",
        );
        err.code = data.error;
        err.messageCebuano = data.messageCebuano || null;
        throw err;
      }

      const payload = data.user ?? data;
      const userData = { ...payload, token: data.token };
      setUser(userData);
      await AsyncStorage.setItem("@AuthData", JSON.stringify(userData));
      registerAndSavePushToken(userData.id || userData._id, userData.token);
      return userData;
    } catch (error) {
      console.error("Register failed", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updatedData) => {
    const uid = user?.id || user?._id;
    if (!uid) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/residents/${uid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(updatedData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      // Unwrap `{ user: {...} }` if present, otherwise use flat payload.
      const payload = data.user ?? data;
      if (!payload || Object.keys(payload).length === 0) {
        throw new Error("Server returned no updated user");
      }

      const newUser = { ...user, ...payload };
      setUser(newUser);
      await AsyncStorage.setItem("@AuthData", JSON.stringify(newUser));
      return newUser;
    } catch (error) {
      console.error("Update profile failed", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserPoints = (newTotal, monthlyPoints) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        totalPoints: newTotal != null ? newTotal : prev.totalPoints,
        monthlyPoints: monthlyPoints != null ? monthlyPoints : prev.monthlyPoints,
      };
      AsyncStorage.setItem("@AuthData", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const refreshUser = async () => {
    const uid = user?.id || user?._id;
    if (!uid) return;
    try {
      const res = await fetch(`${API_URL}/api/residents/${uid}`, {
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {},
      });
      if (res.ok) {
        const freshData = await res.json();
        const freshPayload = freshData.user ?? freshData;
        const mergedData = { ...user, ...freshPayload };
        setUser(mergedData);
        await AsyncStorage.setItem("@AuthData", JSON.stringify(mergedData));
      }
    } catch (_) {}
  };

  const logout = async () => {
    try {
      setUser(null);
      await AsyncStorage.removeItem("@AuthData");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        verify2FA,
        register,
        updateProfile,
        updateUserPoints,
        refreshUser,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
