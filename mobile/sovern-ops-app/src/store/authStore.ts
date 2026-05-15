// ─── Sovern Ops — Auth Store (Zustand) ────────────────────────────────────
// Holds the current user in memory. JWT itself lives in SecureStore.
// On app launch, LoginScreen checks SecureStore for an existing token
// and calls /api/auth/me to hydrate this store — so sessions persist
// across app restarts without storing the user object on device.

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../services/api';
import { clearAll as clearOfflineCache } from '../services/offlineCache';

// Phase 5d: the offline read cache keys responses by user id. The id
// is only known after the in-memory user blob is hydrated, but the
// fetch wrapper in services/api.ts cannot import the store (circular).
// Persist a minimal {id} mirror in AsyncStorage on setUser; clear on
// clearUser. Read by services/api.ts under 'authStore:user'.
const PERSIST_KEY = 'authStore:user';

async function persistUser(user: User | null) {
  try {
    if (user) await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify({ id: user.id, role: user.role }));
    else      await AsyncStorage.removeItem(PERSIST_KEY);
  } catch (_) { /* best-effort */ }
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => {
    persistUser(user);
    set({ user, isAuthenticated: true });
  },
  clearUser: () => {
    persistUser(null);
    // Phase 5d: wipe cached payloads on logout so a different user
    // signing in on this device can't see the previous user's data.
    clearOfflineCache();
    set({ user: null, isAuthenticated: false });
  },
}));
