import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { isManagerRole, managementKind } from '../store/slices/authSlice';

import LoginScreen      from '../screens/auth/LoginScreen';
import DashboardScreen  from '../screens/dashboard/DashboardScreen';
import AttendanceScreen from '../screens/attendance/AttendanceScreen';
import LeavesScreen     from '../screens/leaves/LeavesScreen';
import PayrollScreen    from '../screens/payroll/PayrollScreen';
import ProfileScreen    from '../screens/profile/ProfileScreen';
import AssetsScreen     from '../screens/assets/AssetsScreen';
import TicketsScreen    from '../screens/tickets/TicketsScreen';
import RaiseTicketScreen from '../screens/tickets/RaiseTicketScreen';
import TicketDetailScreen from '../screens/tickets/TicketDetailScreen';

import ManagerDashboardScreen from '../screens/manager/ManagerDashboardScreen';
import ApprovalsScreen        from '../screens/manager/ApprovalsScreen';
import TeamScreen             from '../screens/manager/TeamScreen';
import TeamMemberDetailScreen from '../screens/manager/TeamMemberDetailScreen';
import InsightsScreen         from '../screens/manager/InsightsScreen';

import HRDashboardScreen from '../screens/hr/HRDashboardScreen';
import PeopleScreen      from '../screens/hr/PeopleScreen';
import RequestsScreen    from '../screens/hr/RequestsScreen';
import HRInsightsScreen  from '../screens/hr/HRInsightsScreen';

import AdminDashboardScreen  from '../screens/admin/AdminDashboardScreen';
import UserManagementScreen  from '../screens/admin/UserManagementScreen';
import NotificationsScreen   from '../screens/common/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

/* ── Tab icon maps ── */
const EMP_ICONS: Record<string, string> = { Home: '🏠', Tickets: '🎫', Leave: '📋', Profile: '👤' };
const MGR_ICONS: Record<string, string> = { Home: '🏠', Approvals: '✅', Team: '👥', Insights: '📈', Profile: '👤' };
const HR_ICONS: Record<string, string>  = { Home: '🏠', Requests: '📨', People: '👥', Insights: '📊', Profile: '👤' };
const ADMIN_ICONS: Record<string, string> = { Home: '🏠', Users: '👤', People: '🏢', Insights: '📊', Profile: '👤' };

function TabIcon({ name, focused, icons, badge }: { name: string; focused: boolean; icons: Record<string, string>; badge?: number }) {
  return (
    <View style={tabStyles.wrap}>
      <Text style={tabStyles.emoji}>{icons[name]}</Text>
      {!!badge && badge > 0 && (
        <View style={tabStyles.badge}>
          <Text style={tabStyles.badgeTx}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
      {focused && <View style={tabStyles.activeDot} />}
    </View>
  );
}

const tabBarStyle = {
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
};
const commonScreenOptions = {
  headerShown: false,
  tabBarShowLabel: true,
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const, marginBottom: 4 },
  tabBarActiveTintColor: '#4F46E5',
  tabBarInactiveTintColor: '#9CA3AF',
  tabBarStyle,
};

/* ── Employee tabs ── */
function EmployeeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...commonScreenOptions,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} icons={EMP_ICONS} />,
      })}
    >
      <Tab.Screen name="Home"    component={DashboardScreen} />
      <Tab.Screen name="Tickets" component={TicketsScreen} />
      <Tab.Screen name="Leave"   component={LeavesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/* ── Manager tabs ── */
function ManagerTabs() {
  const pending = useSelector((s: RootState) => s.approvals.items.filter((i) => i.status === 'pending').length);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...commonScreenOptions,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} icons={MGR_ICONS} badge={route.name === 'Approvals' ? pending : undefined} />
        ),
      })}
    >
      <Tab.Screen name="Home"      component={ManagerDashboardScreen} />
      <Tab.Screen name="Approvals" component={ApprovalsScreen} />
      <Tab.Screen name="Team"      component={TeamScreen} />
      <Tab.Screen name="Insights"  component={InsightsScreen} />
      <Tab.Screen name="Profile"   component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/* ── HR tabs (org-wide; also used by admin) ── */
function HRTabs() {
  const pending = useSelector((s: RootState) => s.hrRequests.items.filter((i) => i.status === 'pending').length);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...commonScreenOptions,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} icons={HR_ICONS} badge={route.name === 'Requests' ? pending : undefined} />
        ),
      })}
    >
      <Tab.Screen name="Home"     component={HRDashboardScreen} />
      <Tab.Screen name="Requests" component={RequestsScreen} />
      <Tab.Screen name="People"   component={PeopleScreen} />
      <Tab.Screen name="Insights" component={HRInsightsScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/* ── Admin tabs ── */
function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...commonScreenOptions,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} icons={ADMIN_ICONS} />,
      })}
    >
      <Tab.Screen name="Home"     component={AdminDashboardScreen} />
      <Tab.Screen name="Users"    component={UserManagementScreen} />
      <Tab.Screen name="People"   component={PeopleScreen} />
      <Tab.Screen name="Insights" component={HRInsightsScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { token, user, viewMode } = useSelector((state: RootState) => state.auth);
  const inManagementView = isManagerRole(user?.role) && viewMode === 'manager';
  const kind = managementKind(user?.role); // 'admin' | 'hr' | 'manager' | null

  const MainTabs = !inManagementView
    ? EmployeeTabs
    : kind === 'admin'
      ? AdminTabs
      : kind === 'hr'
        ? HRTabs
        : ManagerTabs;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            {/* shared employee stack screens */}
            <Stack.Screen name="Assets"       component={AssetsScreen} />
            <Stack.Screen name="Payroll"      component={PayrollScreen} />
            <Stack.Screen name="Timesheet"    component={AttendanceScreen} />
            <Stack.Screen name="RaiseTicket"  component={RaiseTicketScreen} />
            <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
            {/* manager stack screens (reachable from the manager dashboard) */}
            <Stack.Screen name="Approvals"  component={ApprovalsScreen} />
            <Stack.Screen name="Team"       component={TeamScreen} />
            <Stack.Screen name="Insights"   component={InsightsScreen} />
            <Stack.Screen name="TeamMember" component={TeamMemberDetailScreen} />
            {/* HR stack screens (reachable from the HR dashboard) */}
            <Stack.Screen name="Requests"   component={RequestsScreen} />
            <Stack.Screen name="People"     component={PeopleScreen} />
            {/* admin + shared */}
            <Stack.Screen name="Users"         component={UserManagementScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const tabStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', width: 36, height: 28 },
  emoji: { fontSize: 20 },
  activeDot: { position: 'absolute', bottom: -4, width: 4, height: 4, borderRadius: 2, backgroundColor: '#4F46E5' },
  badge: { position: 'absolute', top: -4, right: -2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF' },
  badgeTx: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});
