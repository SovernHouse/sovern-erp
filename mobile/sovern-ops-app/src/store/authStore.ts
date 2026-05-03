// ─── Sovern Ops — Auth Store (Zustand) ────────────────────────────────────
// Holds the current user in memory. JWT itself lives in SecureStore.
// On app launch, LoginScreen checks SecureStore for an existing token
// and calls /api/auth/me to hydrate this store — so sessions persist
// across app restarts without storing the user object on device.

import { create } from 'zustand';
import type { User } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: true }),
  clearUser: () => set({ user: null, isAuthenticated: false }),
}));
