// ─── Root Layout ──────────────────────────────────────────────────────────
// Expo Router uses file-based routing. This _layout.tsx wraps the entire app.
// Auth guard: if no valid token in SecureStore, redirect to /login.

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { CONFIG, COLORS } from '../src/constants/config';
import type { User } from '../src/services/api';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const { isAuthenticated, setUser, clearUser } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  // On mount: check for existing JWT and validate it
  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(CONFIG.TOKEN_KEY);
      if (token) {
        try {
          const res = await fetch(`${CONFIG.SERVER_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            // Backend wraps: { success, data: <user object>, message }
            const body = await res.json();
            const user: User = body.data;
            setUser(user);
          } else {
            await SecureStore.deleteItemAsync(CONFIG.TOKEN_KEY);
            clearUser();
          }
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

  if (!ready) return null;

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
      </Stack>
    </>
  );
}
