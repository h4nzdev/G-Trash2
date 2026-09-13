import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CollectorHomeScreen from "../screens/CollectorHomeScreen";
import CollectorMapScreen from "../screens/CollectorMapScreen";
import CollectorHistoryScreen from "../screens/CollectorHistoryScreen";
import CollectorNotificationScreen from "../screens/CollectorNotificationScreen";
import CollectorProfileScreen from "../screens/CollectorProfileScreen";
import DisposalReportScreen from "../screens/DisposalReportScreen";

const Tab = createBottomTabNavigator();

export default function CollectorTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#F0EDED",
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          height: insets.bottom > 0 ? 56 + insets.bottom : 64,
          elevation: 15,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        tabBarActiveTintColor: "#006A3B",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Home: "home",
            Map: "map",
            History: "history",
            Alerts: focused ? "notifications" : "notifications-none",
            Profile: focused ? "person" : "person-outline",
          };
          return (
            <MaterialIcons
              name={icons[route.name] || "circle"}
              size={focused ? 25 : 23}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={CollectorHomeScreen} />
      <Tab.Screen name="Map" component={CollectorMapScreen} />
      <Tab.Screen name="History" component={CollectorHistoryScreen} />
      <Tab.Screen name="Alerts" component={CollectorNotificationScreen} />
      <Tab.Screen name="Profile" component={CollectorProfileScreen} />
      <Tab.Screen
        name="DisposalReport"
        component={DisposalReportScreen}
        options={{
          tabBarItemStyle: { display: "none" },
          tabBarButton: () => null,
          tabBarStyle: { display: "none" },
        }}
      />
    </Tab.Navigator>
  );
}
