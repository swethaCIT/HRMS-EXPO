import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

import LoginScreen      from '../screens/auth/LoginScreen';
import DashboardScreen  from '../screens/dashboard/DashboardScreen';
import AttendanceScreen from '../screens/attendance/AttendanceScreen';
import LeavesScreen     from '../screens/leaves/LeavesScreen';
import PayrollScreen    from '../screens/payroll/PayrollScreen';
import ProfileScreen    from '../screens/profile/ProfileScreen';
import AssetsScreen     from '../screens/assets/AssetsScreen';
import TicketsScreen    from '../screens/tickets/TicketsScreen';
import RaiseTicketScreen from '../screens/tickets/RaiseTicketScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

/* ── Tab icon map ── */
const TAB_ICONS: Record<string, string> = {
  Home:    '🏠',
  Tickets: '🎫',
  Leave:   '📋',
  Profile: '👤',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={tabStyles.wrap}>
      <Text style={tabStyles.emoji}>{TAB_ICONS[name]}</Text>
      {focused && <View style={tabStyles.activeDot} />}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 4,
        },
        tabBarActiveTintColor:   '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          height: 64,
          paddingTop: 4,
          paddingBottom: 8,
          elevation: 12,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
      })}
    >
      <Tab.Screen name="Home"    component={DashboardScreen} />
      <Tab.Screen name="Tickets" component={TicketsScreen} />
      <Tab.Screen name="Leave"   component={LeavesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { token } = useSelector((state: RootState) => state.auth);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="Main"        component={MainTabs} />
            <Stack.Screen name="Assets"      component={AssetsScreen} />
            <Stack.Screen name="Payroll"     component={PayrollScreen} />
            <Stack.Screen name="Timesheet"   component={AttendanceScreen} />
            <Stack.Screen name="RaiseTicket" component={RaiseTicketScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const tabStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 28,
  },
  emoji: {
    fontSize: 20,
  },
  activeDot: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4F46E5',
  },
});
