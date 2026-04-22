import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { ordersAPI } from '../services/api.js'

const useOrdersStore = create(
  immer((set, get) => ({
    // State
    orders: [],
    totalOrders: 0,
    currentOrder: null,
    isLoading: false,
    error: null,
    filters: {
      status: '',
      customerId: '',
      dateRange: { start: '', end: '' },
      search: '',
    },
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
    },

    // Fetch all orders
    fetchOrders: async (params = {}) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await ordersAPI.getAll(params)
        set((state) => {
          state.orders = response.data.data || response.data
          state.totalOrders = response.data.total || response.data.length
          state.pagination.total = response.data.total || response.data.length
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch orders'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch single order
    fetchOrderById: async (id) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await ordersAPI.getById(id)
        set((state) => {
          state.currentOrder = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch order'
          state.isLoading = false
        })
        throw error
      }
    },

    // Create order
    createOrder: async (data) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await ordersAPI.create(data)
        set((state) => {
          state.orders.unshift(response.data)
          state.totalOrders += 1
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to create order'
          state.isLoading = false
        })
        throw error
      }
    },

    // Update order
    updateOrder: async (id, data) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await ordersAPI.update(id, data)
        set((state) => {
          const index = state.orders.findIndex((o) => o.id === id)
          if (index !== -1) {
            state.orders[index] = response.data
          }
          if (state.currentOrder?.id === id) {
            state.currentOrder = response.data
          }
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to update order'
          state.isLoading = false
        })
        throw error
      }
    },

    // Delete order
    deleteOrder: async (id) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        await ordersAPI.delete(id)
        set((state) => {
          state.orders = state.orders.filter((o) => o.id !== id)
          state.totalOrders -= 1
          if (state.currentOrder?.id === id) {
            state.currentOrder = null
          }
          state.isLoading = false
        })
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to delete order'
          state.isLoading = false
        })
        throw error
      }
    },

    // Change order status
    changeOrderStatus: async (id, status) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await ordersAPI.changeStatus(id, status)
        set((state) => {
          const index = state.orders.findIndex((o) => o.id === id)
          if (index !== -1) {
            state.orders[index] = response.data
          }
          if (state.currentOrder?.id === id) {
            state.currentOrder = response.data
          }
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to change order status'
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
          customerId: '',
          dateRange: { start: '', end: '' },
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
        state.orders = []
        state.totalOrders = 0
        state.currentOrder = null
        state.isLoading = false
        state.error = null
        state.filters = {
          status: '',
          customerId: '',
          dateRange: { start: '', end: '' },
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

export default useOrdersStore
