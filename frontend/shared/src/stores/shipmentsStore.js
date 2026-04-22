import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// Shipments store for managing shipment data across portals
const useShipmentsStore = create(
  immer((set, get) => ({
    // State
    shipments: [],
    totalShipments: 0,
    currentShipment: null,
    isLoading: false,
    error: null,
    filters: {
      status: '', // pending, ready, shipped, in_transit, delivered, cancelled
      origin: '',
      destination: '',
      carrier: '',
      search: '',
    },
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
    },

    // Fetch all shipments
    fetchShipments: async (params = {}, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.getAll(params)
        set((state) => {
          state.shipments = response.data.data || response.data
          state.totalShipments = response.data.total || response.data.length
          state.pagination.total = response.data.total || response.data.length
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch shipments'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch single shipment
    fetchShipment: async (id, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.getById(id)
        set((state) => {
          state.currentShipment = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch shipment'
          state.isLoading = false
        })
        throw error
      }
    },

    // Update shipment
    updateShipment: async (id, data, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.update(id, data)
        set((state) => {
          const index = state.shipments.findIndex((s) => s.id === id)
          if (index !== -1) {
            state.shipments[index] = response.data
          }
          if (state.currentShipment?.id === id) {
            state.currentShipment = response.data
          }
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to update shipment'
          state.isLoading = false
        })
        throw error
      }
    },

    // Update shipment status
    updateStatus: async (id, status, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        // Try to use a dedicated status endpoint if available
        const response = apiService.changeStatus
          ? await apiService.changeStatus(id, status)
          : await apiService.update(id, { status })

        set((state) => {
          const index = state.shipments.findIndex((s) => s.id === id)
          if (index !== -1) {
            state.shipments[index] = response.data
          }
          if (state.currentShipment?.id === id) {
            state.currentShipment = response.data
          }
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to update shipment status'
          state.isLoading = false
        })
        throw error
      }
    },

    // Add tracking information
    addTracking: async (id, trackingData, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = apiService.updateTracking
          ? await apiService.updateTracking(id, trackingData)
          : await apiService.update(id, { tracking: trackingData })

        set((state) => {
          const index = state.shipments.findIndex((s) => s.id === id)
          if (index !== -1) {
            state.shipments[index] = response.data
          }
          if (state.currentShipment?.id === id) {
            state.currentShipment = response.data
          }
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to add tracking information'
          state.isLoading = false
        })
        throw error
      }
    },

    // Set filters
    setFilters: (filters) =>
      set((state) => {
        state.filters = { ...state.filters, ...filters }
        state.pagination.page = 1
      }),

    // Clear filters
    clearFilters: () =>
      set((state) => {
        state.filters = {
          status: '',
          origin: '',
          destination: '',
          carrier: '',
          search: '',
        }
        state.pagination.page = 1
      }),

    // Set pagination
    setPagination: (page, limit) =>
      set((state) => {
        state.pagination.page = page
        state.pagination.limit = limit
      }),

    // Clear error
    clearError: () =>
      set((state) => {
        state.error = null
      }),

    // Reset store
    reset: () =>
      set((state) => {
        state.shipments = []
        state.totalShipments = 0
        state.currentShipment = null
        state.isLoading = false
        state.error = null
        state.filters = {
          status: '',
          origin: '',
          destination: '',
          carrier: '',
          search: '',
        }
        state.pagination = {
          page: 1,
          limit: 10,
          total: 0,
        }
      }),
  }))
)

export default useShipmentsStore
