import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from '../services/api';

/**
 * Foreground presentation: show an alert + play a sound even while the app is
 * open, matching how the OS presents a backgrounded/killed-app push.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Push notifications need an EAS project ID (`app.json` → `extra.eas.projectId`,
 * set by `eas init`) to mint an Expo push token, and Expo Go no longer
 * supports *remote* push delivery (SDK 53+) — only a development/production
 * build receives them. Every call below degrades to a silent no-op rather
 * than throwing when either precondition isn't met, so the rest of the app
 * (including local notification-driven UI) still works in Expo Go / before
 * `eas init` has been run.
 */
function getEasProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

async function requestPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Get the device's Expo push token and register it with the backend for the signed-in user. */
export async function registerPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return; // push tokens aren't issued to simulators/emulators
    const projectId = getEasProjectId();
    if (!projectId) return; // `eas init` hasn't been run yet

    const granted = await requestPermission();
    if (!granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;
    await api.patch('/notifications/push-token', { token });
  } catch {
    // No EAS project configured yet, or permission denied — expected until
    // `eas init` has been run for this app.
  }
}

/**
 * Set up foreground + token-refresh listeners. Safe to call once at app startup
 * regardless of login state. Returns an unsubscribe function.
 */
export function initPushListeners(onForegroundMessage?: (title: string, body: string) => void): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const { title, body } = notification.request.content;
    onForegroundMessage?.(title ?? 'HRMS', body ?? '');
  });
  const tokenSub = Notifications.addPushTokenListener(() => { registerPushToken(); });

  return () => {
    receivedSub.remove();
    tokenSub.remove();
  };
}

export const isPushAvailable = () => Platform.OS === 'android' || Platform.OS === 'ios';
