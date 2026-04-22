import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useNotificationStore = create(
  immer((set) => ({
    // State
    notifications: [],

    // Actions
    addNotification: (notification) =>
      set((state) => {
        const id = Date.now().toString()
        const notif = {
          id,
          duration: 5000, // Default 5 seconds
          ...notification,
        }
        state.notifications.push(notif)

        // Auto-remove after duration
        if (notif.duration > 0) {
          setTimeout(() => {
            set((s) => {
              s.notifications = s.notifications.filter((n) => n.id !== id)
            })
          }, notif.duration)
        }

        return id
      }),

    removeNotification: (id) =>
      set((state) => {
        state.notifications = state.notifications.filter((n) => n.id !== id)
      }),

    clearNotifications: () =>
      set((state) => {
        state.notifications = []
      }),

    // Convenience methods
    success: (message, options = {}) =>
      set((state) => {
        const id = Date.now().toString()
        state.notifications.push({
          id,
          type: 'success',
          message,
          duration: 3000,
          ...options,
        })

        if (options.duration !== 0) {
          setTimeout(() => {
            set((s) => {
              s.notifications = s.notifications.filter((n) => n.id !== id)
            })
          }, options.duration || 3000)
        }
      }),

    error: (message, options = {}) =>
      set((state) => {
        const id = Date.now().toString()
        state.notifications.push({
          id,
          type: 'error',
          message,
          duration: 5000,
          ...options,
        })

        if (options.duration !== 0) {
          setTimeout(() => {
            set((s) => {
              s.notifications = s.notifications.filter((n) => n.id !== id)
            })
          }, options.duration || 5000)
        }
      }),

    warning: (message, options = {}) =>
      set((state) => {
        const id = Date.now().toString()
        state.notifications.push({
          id,
          type: 'warning',
          message,
          duration: 4000,
          ...options,
        })

        if (options.duration !== 0) {
          setTimeout(() => {
            set((s) => {
              s.notifications = s.notifications.filter((n) => n.id !== id)
            })
          }, options.duration || 4000)
        }
      }),

    info: (message, options = {}) =>
      set((state) => {
        const id = Date.now().toString()
        state.notifications.push({
          id,
          type: 'info',
          message,
          duration: 3000,
          ...options,
        })

        if (options.duration !== 0) {
          setTimeout(() => {
            set((s) => {
              s.notifications = s.notifications.filter((n) => n.id !== id)
            })
          }, options.duration || 3000)
        }
      }),
  }))
)

export default useNotificationStore
