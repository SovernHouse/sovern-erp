import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

const useUIStore = create(
  persist(
    immer((set) => ({
      // State
      sidebarCollapsed: false,
      theme: 'light', // 'light' | 'dark'
      modals: {}, // { modalName: isOpen }
      notifications: [],

      // Sidebar actions
      toggleSidebar: () =>
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed
        }),

      setSidebarCollapsed: (collapsed) =>
        set((state) => {
          state.sidebarCollapsed = collapsed
        }),

      // Theme actions
      setTheme: (theme) =>
        set((state) => {
          state.theme = theme
          // Apply theme to document
          if (theme === 'dark') {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
        }),

      toggleTheme: () =>
        set((state) => {
          state.theme = state.theme === 'light' ? 'dark' : 'light'
          if (state.theme === 'dark') {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
        }),

      // Modal actions
      openModal: (modalName) =>
        set((state) => {
          state.modals[modalName] = true
        }),

      closeModal: (modalName) =>
        set((state) => {
          state.modals[modalName] = false
        }),

      toggleModal: (modalName) =>
        set((state) => {
          state.modals[modalName] = !state.modals[modalName]
        }),

      closeAllModals: () =>
        set((state) => {
          Object.keys(state.modals).forEach((key) => {
            state.modals[key] = false
          })
        }),

      isModalOpen: (modalName) =>
        (state) =>
          !!state.modals[modalName],
    })),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
)

export default useUIStore
