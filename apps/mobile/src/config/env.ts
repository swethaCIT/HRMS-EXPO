import { Platform } from 'react-native';

/* ════════════════════════════════════════════════════════
   API endpoint configuration.

   This file is the ONLY place the backend host is defined. It previously lived
   inline in services/api.ts as `http://10.0.2.2:3000/api/v1`, which is the
   Android emulator's alias for the host machine — meaning the app could not
   reach a backend from a real device, from iOS at all (ATS blocks cleartext),
   or from a signed release build (cleartext is disabled for non-debuggable
   builds by the RN gradle plugin).
   ════════════════════════════════════════════════════════ */

/**
 * ⚠️ SET THIS BEFORE SHIPPING A RELEASE BUILD.
 *
 * Must be an `https://` URL reachable from a real device — the deployed API,
 * e.g. 'https://hrms-api.yourcompany.com/api/v1'.
 *
 * Left empty deliberately: a wrong-but-plausible default is worse than none,
 * because the app would appear to work while talking to nothing. While this is
 * empty, release builds fail loudly (see `assertApiConfigured`) instead of
 * silently falling back to offline demo data.
 */
export const PRODUCTION_API_BASE_URL = '';

/**
 * Debug builds talk to a backend on the developer's machine.
 * `10.0.2.2` is the Android emulator's alias for the host's localhost;
 * iOS simulators share the host's network stack, so `localhost` is correct there.
 * Override this when testing on a physical device on your LAN, e.g.
 * 'http://192.168.1.20:3000/api/v1'.
 */
export const DEV_API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000/api/v1' : 'http://localhost:3000/api/v1';

export const API_BASE_URL = __DEV__ ? DEV_API_BASE_URL : PRODUCTION_API_BASE_URL;

/** True once a real production host has been configured. */
export const isApiConfigured = !!API_BASE_URL;

/**
 * Whether unauthenticated "demo mode" fallbacks are permitted. Debug only —
 * in a release build a network failure must surface as an error, never as a
 * signed-in session (see authSlice).
 */
export const ALLOW_DEMO_FALLBACK = __DEV__;

/**
 * Shown instead of a silent failure when someone ships a release build without
 * setting PRODUCTION_API_BASE_URL.
 */
export const API_NOT_CONFIGURED_MESSAGE =
  'This build has no API server configured. Set PRODUCTION_API_BASE_URL in src/config/env.ts and rebuild.';
