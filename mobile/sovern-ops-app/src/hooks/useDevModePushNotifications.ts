// ─── Dev Mode Push Notifications ──────────────────────────────────────────
// Registers the device's Expo push token with the ERP backend on login,
// listens for incoming notifications, and deep-links to the PR / dev run
// when the user taps a notification.
//
// REQUIRES EAS dev-client rebuild. The native deps (expo-notifications,
// expo-device, expo-constants) don't ship via OTA Update.
//
// This hook is DEFENSIVELY LOADED: native-dep imports are wrapped in
// try/catch via require() so the hook silently no-ops if:
//   - npm install hasn't been run yet
//   - The deps are missing from the bundle
//   - The app is running in Expo Go (which dropped remote-push in SDK 53)
//   - The user denies notification permission
// In any of those cases the in-chat polling DevRunCard + Resend email
// summary still cover the notification surface.
//
// Activation steps for Alex:
//   1. cd mobile/sovern-ops-app && npm install
//   2. eas build --profile development --platform ios
//   3. Reinstall the dev client on the phone

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { registerPushToken, unregisterPushToken } from '../services/api';

// Lazy-load the native deps. require() inside try/catch lets us tolerate
// missing modules at bundle time. Direct ES imports would fatal-crash.
type NotificationsModule = typeof import('expo-notifications');
type DeviceModule = typeof import('expo-device');
type ConstantsModule = typeof import('expo-constants').default;

function loadNativeDeps(): {
  Notifications: NotificationsModule | null;
  Device: DeviceModule | null;
  Constants: ConstantsModule | null;
} {
  let Notifications: NotificationsModule | null = null;
  let Device: DeviceModule | null = null;
  let Constants: ConstantsModule | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications') as NotificationsModule;
  } catch (_) { /* not installed yet */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Device = require('expo-device') as DeviceModule;
  } catch (_) { /* not installed yet */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Constants = require('expo-constants').default as ConstantsModule;
  } catch (_) { /* not installed yet */ }
  return { Notifications, Device, Constants };
}

async function ensurePermissionsAndGetToken(
  Notifications: NotificationsModule,
  Device: DeviceModule,
  Constants: ConstantsModule,
): Promise<string | null> {
  if (!Device.isDevice) {
    return null;  // simulator and web don't get push tokens
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('dev-mode', {
      name: 'Dev Mode runs',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1D5A32',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let granted = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    granted = status;
  }
  if (granted !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] No EAS projectId in expo config');
    return null;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResponse.data;
  } catch (err) {
    console.warn('[push] getExpoPushTokenAsync failed:', err);
    return null;
  }
}

export function useDevModePushNotifications() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const lastTokenRef = useRef<string | null>(null);
  const subRefs = useRef<Array<{ remove: () => void }>>([]);

  // Foreground notification handler (set once, defensively)
  useEffect(() => {
    const { Notifications } = loadNativeDeps();
    if (!Notifications) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  // Register token on login
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const { Notifications, Device, Constants } = loadNativeDeps();
    if (!Notifications || !Device || !Constants) return;

    let cancelled = false;
    (async () => {
      const token = await ensurePermissionsAndGetToken(Notifications, Device, Constants);
      if (cancelled || !token) return;
      try {
        await registerPushToken(token, {
          deviceId: Device.osInternalBuildId ?? undefined,
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        });
        lastTokenRef.current = token;
      } catch (err) {
        console.warn('[push] backend register failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]);

  // Tap handler: deep-link to /dev-runs when a dev-mode push is tapped
  useEffect(() => {
    const { Notifications } = loadNativeDeps();
    if (!Notifications) return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        kind?: string;
        runId?: string;
        prUrl?: string;
        type?: string;
        entityType?: string;
        entityId?: string;
        link?: string;
      };
      if (data?.kind === 'dev_mode' || data?.runId) {
        router.push('/dev-runs');
        return;
      }
      // Phase 4.26 mobile parity: route auto_chain notifications to
      // their entity tab. Mobile has tabs for SalesOrder, PurchaseOrder,
      // Invoice, Quotation. ProformaInvoice / GoodsReceivedNote /
      // PackingList have no mobile screen yet; fall back to dashboard.
      if (data?.type === 'auto_chain' && data.entityType) {
        const map: Record<string, string> = {
          SalesOrder: '/(tabs)/sales-orders',
          PurchaseOrder: '/(tabs)/purchase-orders',
          Invoice: '/(tabs)/invoices',
          Quotation: '/(tabs)/quotations',
        };
        const target = map[data.entityType] || '/(tabs)/dashboard';
        router.push(target);
        return;
      }
    });
    subRefs.current.push(sub);
    return () => {
      sub.remove();
      subRefs.current = subRefs.current.filter(s => s !== sub);
    };
  }, [router]);

  // Unregister on logout
  useEffect(() => {
    if (!isAuthenticated && lastTokenRef.current) {
      const token = lastTokenRef.current;
      lastTokenRef.current = null;
      unregisterPushToken(token).catch(() => {});
    }
  }, [isAuthenticated]);
}
