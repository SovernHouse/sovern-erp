// ─── Root Layout ──────────────────────────────────────────────────────────
// Expo Router uses file-based routing. This _layout.tsx wraps the entire app.
// Auth guard: if no valid token in SecureStore, redirect to /login.

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { CONFIG, COLORS } from '../src/constants/config';
import { getCurrentUser } from '../src/services/api';
import type { User } from '../src/services/api';
import { useDevModePushNotifications } from '../src/hooks/useDevModePushNotifications';

// ─── Error Boundary ───────────────────────────────────────────────────────────
// Catches render errors in any screen and shows a readable message instead of
// a blank white screen.
export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <View style={{
      flex: 1, justifyContent: 'center', alignItems: 'center',
      padding: 28, backgroundColor: COLORS.cream,
    }}>
      <Text style={{ fontSize: 36, marginBottom: 16 }}>⚠️</Text>
      <Text style={{
        fontSize: 17, fontWeight: '700', color: COLORS.ink,
        marginBottom: 8, textAlign: 'center',
      }}>
        Something went wrong
      </Text>
      <Text style={{
        fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 20,
      }}>
        {error.message}
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const { isAuthenticated, setUser, clearUser } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  // Dev Mode push notifications (super_admin only — the hook itself
  // gracefully no-ops if there's no auth, no Expo Go, or no permission).
  // Requires EAS dev-client rebuild for native push to actually register;
  // until then this is a silent no-op and polling-based card / email
  // summary cover the notification surface.
  useDevModePushNotifications();

  // On mount: check for an existing access token and validate it.
  // getCurrentUser() handles token refresh transparently — if the access
  // token is expired but a valid refresh token exists, it silently obtains
  // a new access token and retries. An 8-second timeout is enforced inside
  // getCurrentUser() so a slow server never blocks the splash screen.
  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(CONFIG.TOKEN_KEY);
      if (token) {
        try {
          const user: User = await getCurrentUser();
          setUser(user);
        } catch {
          clearUser();
        }
      }
      setReady(true);
    })();
  }, []);

  // Auth guard: redirect based on auth state once ready
  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/dashboard');
    }
  }, [ready, isAuthenticated, segments]);

  if (!ready) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream }}>
      <ActivityIndicator size="large" color={COLORS.forest} />
    </View>
  );

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.forest },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: COLORS.cream },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Lead detail — title set dynamically via navigation.setOptions in the screen */}
        <Stack.Screen
          name="lead/[id]"
          options={{
            title: 'Lead',
            headerBackTitle: 'Leads',
          }}
        />
        {/* Dev Mode runs (super_admin only — gated inside the screen) */}
        <Stack.Screen
          name="dev-runs"
          options={{ headerShown: false }}
        />
      </Stack>
    </>
  );
}
