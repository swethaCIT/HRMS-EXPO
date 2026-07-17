import { Platform } from 'react-native';
import api from '../services/api';

/**
 * Push notifications depend on a real Firebase project being wired into the native
 * Android/iOS projects (a `google-services.json` + the Google Services Gradle plugin
 * on Android, `GoogleService-Info.plist` on iOS) — that hasn't been set up yet in this
 * repo. Every native Firebase call below is wrapped so a missing/misconfigured
 * Firebase project degrades to a silent no-op instead of crashing the app, exactly
 * like the backend's own NotificationsService does when Firebase credentials are unset.
 */

// Typed as `any`: this is a lazily/optionally loaded native module (see comment
// above) — the concrete FirebaseMessagingTypes are not worth importing just to
// describe a value that may not exist at runtime.
let messagingMod: any = null;
function getMessaging(): any {
  if (messagingMod) return messagingMod;
  try {
    // Lazy-required so a missing/broken native module can't crash app startup.
    messagingMod = require('@react-native-firebase/messaging').default;
    return messagingMod;
  } catch {
    return null;
  }
}

/** Ask for notification permission (iOS requires this; Android <13 grants implicitly). */
async function requestPermission(): Promise<boolean> {
  const messaging = getMessaging();
  if (!messaging) return false;
  try {
    const authStatus = await messaging().requestPermission();
    const AuthorizationStatus = messaging.AuthorizationStatus;
    return authStatus === AuthorizationStatus.AUTHORIZED || authStatus === AuthorizationStatus.PROVISIONAL;
  } catch {
    return false; // no Firebase app configured, or permission denied
  }
}

/** Get the device's FCM token and register it with the backend for the signed-in user. */
export async function registerPushToken(): Promise<void> {
  const messaging = getMessaging();
  if (!messaging) return;
  try {
    const granted = await requestPermission();
    if (!granted) return;
    const token = await messaging().getToken();
    if (!token) return;
    await api.patch('/notifications/fcm-token', { token });
  } catch {
    // No Firebase app configured (google-services.json missing) — expected until
    // a real Firebase project is wired into the native Android/iOS projects.
  }
}

/**
 * Set up foreground + token-refresh listeners. Safe to call once at app startup
 * regardless of login state. Returns an unsubscribe function.
 */
export function initPushListeners(onForegroundMessage?: (title: string, body: string) => void): () => void {
  const messaging = getMessaging();
  if (!messaging) return () => {};

  const unsubscribers: Array<() => void> = [];
  try {
    unsubscribers.push(
      messaging().onMessage(async (remoteMessage: any) => {
        const title = remoteMessage.notification?.title ?? 'HRMS';
        const body = remoteMessage.notification?.body ?? '';
        onForegroundMessage?.(title, body);
      }),
    );
    unsubscribers.push(messaging().onTokenRefresh(() => { registerPushToken(); }));
  } catch {
    // No Firebase app configured — nothing to listen to.
  }

  return () => unsubscribers.forEach((u) => u());
}

/**
 * Registers the background/quit-state message handler. Must run once at the JS
 * entry point (index.js), before AppRegistry.registerComponent — that's the only
 * place React Native Firebase allows it. Also safe to no-op if Firebase isn't set up.
 */
export function registerBackgroundHandler(): void {
  const messaging = getMessaging();
  if (!messaging) return;
  try {
    messaging().setBackgroundMessageHandler(async () => {
      // Android/iOS surface the notification from `remoteMessage.notification`
      // automatically for data+notification payloads sent via sendToDevice/
      // sendToMultiple — no extra display step needed here.
    });
  } catch {
    // No Firebase app configured.
  }
}

export const isPushAvailable = () => Platform.OS === 'android' || Platform.OS === 'ios';
