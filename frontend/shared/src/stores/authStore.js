import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

const useAuthStore = create(
  persist(
    immer((set, get) => ({
      // State
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      setUser: (user) =>
        set((state) => {
          state.user = user
          state.isAuthenticated = !!user
        }),

      setToken: (token, refreshToken = null) =>
        set((state) => {
          state.token = token
          if (refreshToken) {
            state.refreshToken = refreshToken
          }
        }),

      login: async (credentials, loginFn) => {
        set((state) => {
          state.isLoading = true
          state.error = null
        })
        try {
          const response = await loginFn(credentials)
          const { token, refreshToken, user } = response.data

          set((state) => {
            state.token = token
            state.refreshToken = refreshToken
            state.user = user
            state.isAuthenticated = true
            state.isLoading = false
            state.error = null
          })

          return response.data
        } catch (error) {
          set((state) => {
            state.error = error.response?.data?.message || 'Login failed'
            state.isLoading = false
          })
          throw error
        }
      },

      logout: async (logoutFn) => {
        try {
          if (logoutFn) {
            await logoutFn()
          }
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set((state) => {
            state.user = null
            state.token = null
            state.refreshToken = null
            state.isAuthenticated = false
            state.error = null
          })
        }
      },

      refreshTokenFn: async (refreshTokenFn) => {
        try {
          set((state) => {
            state.isLoading = true
          })

          const response = await refreshTokenFn()
          const { token, refreshToken } = response.data

          set((state) => {
            state.token = token
            if (refreshToken) {
              state.refreshToken = refreshToken
            }
            state.isLoading = false
          })

          return response.data
        } catch (error) {
          set((state) => {
            state.error = error.response?.data?.message || 'Token refresh failed'
            state.isLoading = false
          })
          // On refresh failure, clear auth state
          set((state) => {
            state.user = null
            state.token = null
            state.refreshToken = null
            state.isAuthenticated = false
          })
          throw error
        }
      },

      clearError: () =>
        set((state) => {
          state.error = null
        }),

      clearAuth: () =>
        set((state) => {
          state.user = null
          state.token = null
          state.refreshToken = null
          state.isAuthenticated = false
          state.error = null
          state.isLoading = false
        }),
    })),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export default useAuthStore
