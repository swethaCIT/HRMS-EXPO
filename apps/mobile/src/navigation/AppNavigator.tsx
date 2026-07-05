import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { managementKind, restoreSession } from '../store/slices/authSlice';

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
import HolidaysScreen        from '../screens/common/HolidaysScreen';
import AnnouncementsScreen   from '../screens/common/AnnouncementsScreen';
import DocumentsScreen       from '../screens/common/DocumentsScreen';
import Icon, { IconName }    from '../components/Icon';
import ForgotPasswordScreen     from '../screens/auth/ForgotPasswordScreen';
import OnboardingRegisterScreen from '../screens/auth/OnboardingRegisterScreen';

const RootStack = createNativeStackNavigator();
const Tab       = createBottomTabNavigator();
const Inner     = createNativeStackNavigator();

/* ── Tab route → line-icon map ── */
const TAB_ICON: Record<string, IconName> = {
  Home: 'home',
  Tickets: 'tag',
  Leave: 'calendar',
  Approvals: 'check-square',
  Team: 'users',
  Insights: 'bar-chart',
  Requests: 'inbox',
  People: 'users',
  Users: 'user',
  Profile: 'user',
};

function TabIcon({ name, focused, badge }: { name: string; focused: boolean; badge?: number }) {
  return (
    <View style={tabStyles.wrap}>
      <Icon name={TAB_ICON[name] ?? 'home'} size={22} color={focused ? '#4F46E5' : '#9CA3AF'} strokeWidth={focused ? 2.4 : 2} />
      {!!badge && badge > 0 && (
        <View style={tabStyles.badge}>
          <Text style={tabStyles.badgeTx}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

/* ── Leaf (pushed) screens shared by every tab so the bottom bar stays visible ──
 * These are reachable from ANY role's tabs, so managers/HR/admin can self-serve
 * (apply leave, raise a ticket, view payslip) without switching to a separate
 * "employee view" — the dashboards are unified. */
const LEAF_SCREENS: [string, React.ComponentType<any>][] = [
  ['Assets', AssetsScreen],
  ['Payroll', PayrollScreen],
  ['Timesheet', AttendanceScreen],
  ['ApplyLeave', LeavesScreen],
  ['MyTickets', TicketsScreen],
  ['RaiseTicket', RaiseTicketScreen],
  ['TicketDetail', TicketDetailScreen],
  ['TeamMember', TeamMemberDetailScreen],
  ['Notifications', NotificationsScreen],
  ['Holidays', HolidaysScreen],
  ['Announcements', AnnouncementsScreen],
  ['Documents', DocumentsScreen],
];

/**
 * Wrap a tab's main screen in a stack that also registers the leaf screens.
 * Navigating to a leaf pushes WITHIN the tab → the bottom tab bar stays visible.
 * Navigating to another tab's name bubbles up to the Tab navigator (also keeps the bar).
 */
function makeTabStack(Main: React.ComponentType<any>) {
  return function TabStack() {
    return (
      <Inner.Navigator screenOptions={{ headerShown: false }}>
        <Inner.Screen name="index" component={Main} />
        {LEAF_SCREENS.map(([name, comp]) => (
          <Inner.Screen key={name} name={name} component={comp} />
        ))}
      </Inner.Navigator>
    );
  };
}

/* Stable per-tab stack components (defined once at module scope) */
const EmpHome   = makeTabStack(DashboardScreen);
const EmpTickets = makeTabStack(TicketsScreen);
const EmpLeave  = makeTabStack(LeavesScreen);
const CommonProfile = makeTabStack(ProfileScreen);

const MgrHome      = makeTabStack(ManagerDashboardScreen);
const MgrApprovals = makeTabStack(ApprovalsScreen);
const MgrTeam      = makeTabStack(TeamScreen);
const MgrInsights  = makeTabStack(InsightsScreen);

const HrHome     = makeTabStack(HRDashboardScreen);
const HrRequests = makeTabStack(RequestsScreen);
const HrPeople   = makeTabStack(PeopleScreen);
const HrInsights = makeTabStack(HRInsightsScreen);

const AdmHome  = makeTabStack(AdminDashboardScreen);
const AdmUsers = makeTabStack(UserManagementScreen);

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
    <Tab.Navigator screenOptions={({ route }) => ({ ...commonScreenOptions, tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} /> })}>
      <Tab.Screen name="Home"    component={EmpHome} />
      <Tab.Screen name="Tickets" component={EmpTickets} />
      <Tab.Screen name="Leave"   component={EmpLeave} />
      <Tab.Screen name="Profile" component={CommonProfile} />
    </Tab.Navigator>
  );
}

/* ── Manager tabs ── */
function ManagerTabs() {
  const pending = useSelector((s: RootState) => s.approvals.items.filter((i) => i.status === 'pending').length);
  return (
    <Tab.Navigator screenOptions={({ route }) => ({ ...commonScreenOptions, tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} badge={route.name === 'Approvals' ? pending : undefined} /> })}>
      <Tab.Screen name="Home"      component={MgrHome} />
      <Tab.Screen name="Approvals" component={MgrApprovals} />
      <Tab.Screen name="Team"      component={MgrTeam} />
      <Tab.Screen name="Insights"  component={MgrInsights} />
      <Tab.Screen name="Profile"   component={CommonProfile} />
    </Tab.Navigator>
  );
}

/* ── HR tabs ── */
function HRTabs() {
  const pending = useSelector((s: RootState) => s.hrRequests.items.filter((i) => i.status === 'pending').length);
  return (
    <Tab.Navigator screenOptions={({ route }) => ({ ...commonScreenOptions, tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} badge={route.name === 'Requests' ? pending : undefined} /> })}>
      <Tab.Screen name="Home"     component={HrHome} />
      <Tab.Screen name="Requests" component={HrRequests} />
      <Tab.Screen name="People"   component={HrPeople} />
      <Tab.Screen name="Insights" component={HrInsights} />
      <Tab.Screen name="Profile"  component={CommonProfile} />
    </Tab.Navigator>
  );
}

/* ── Admin tabs ── */
function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({ ...commonScreenOptions, tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} /> })}>
      <Tab.Screen name="Home"     component={AdmHome} />
      <Tab.Screen name="Users"    component={AdmUsers} />
      <Tab.Screen name="People"   component={HrPeople} />
      <Tab.Screen name="Insights" component={HrInsights} />
      <Tab.Screen name="Profile"  component={CommonProfile} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const dispatch = useDispatch<AppDispatch>();
  const { token, user, booting } = useSelector((state: RootState) => state.auth);

  // Restore a saved session on launch (persistent login).
  useEffect(() => { dispatch(restoreSession()); }, [dispatch]);

  if (booting && !token) {
    return (
      <View style={splash.root}>
        <Text style={splash.logo}>HRMS</Text>
        <ActivityIndicator color="#FFFFFF" style={{ marginTop: 16 }} />
      </View>
    );
  }

  // Each role gets ONE unified dashboard chosen purely by role — no employee/
  // manager view switching. Managers/HR/admin self-serve via leaf screens.
  const kind = managementKind(user?.role); // 'admin' | 'hr' | 'manager' | null
  const MainTabs =
    kind === 'admin'
      ? AdminTabs
      : kind === 'hr'
        ? HRTabs
        : kind === 'manager'
          ? ManagerTabs
          : EmployeeTabs;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <RootStack.Screen name="OnboardingRegister" component={OnboardingRegisterScreen} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const splash = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1E1B4B', alignItems: 'center', justifyContent: 'center' },
  logo: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: 2 },
});

const tabStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', width: 36, height: 28 },
  emoji: { fontSize: 20 },
  activeDot: { position: 'absolute', bottom: -4, width: 4, height: 4, borderRadius: 2, backgroundColor: '#4F46E5' },
  badge: { position: 'absolute', top: -4, right: -2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF' },
  badgeTx: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});
