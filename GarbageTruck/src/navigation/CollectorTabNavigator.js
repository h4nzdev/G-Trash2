import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';

import CollectorHomeScreen    from '../screens/CollectorHomeScreen';
import CollectorMapScreen     from '../screens/CollectorMapScreen';
import CollectorHistoryScreen from '../screens/CollectorHistoryScreen';
import CollectorProfileScreen from '../screens/CollectorProfileScreen';

const Tab = createBottomTabNavigator();

export default function CollectorTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderTopColor: '#F0EDED',
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
          elevation: 15,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        tabBarActiveTintColor: '#006A3B',
        tabBarInactiveTintColor: '#BECABE',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Home:    focused ? 'home'           : 'home',
            Map:     focused ? 'map'            : 'map',
            History: focused ? 'history'        : 'history',
            Profile: focused ? 'person'         : 'person-outline',
          };
          return (
            <MaterialIcons
              name={icons[route.name]}
              size={focused ? 26 : 24}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home"    component={CollectorHomeScreen}    />
      <Tab.Screen name="Map"     component={CollectorMapScreen}     />
      <Tab.Screen name="History" component={CollectorHistoryScreen} />
      <Tab.Screen name="Profile" component={CollectorProfileScreen} />
    </Tab.Navigator>
  );
}
