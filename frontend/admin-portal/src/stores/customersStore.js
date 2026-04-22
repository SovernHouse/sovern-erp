import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { customersAPI } from '../services/api.js'

const useCustomersStore = create(
  immer((set, get) => ({
    // State
    customers: [],
    totalCustomers: 0,
    currentCustomer: null,
    isLoading: false,
    error: null,
    filters: {
      status: '',
      country: '',
      search: '',
    },
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
    },

    // Fetch all customers
    fetchCustomers: async (params = {}) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await customersAPI.getAll(params)
        set((state) => {
          state.customers = response.data.data || response.data
          state.totalCustomers = response.data.total || response.data.length
          state.pagination.total = response.data.total || response.data.length
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch customers'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch single customer
    fetchCustomerById: async (id) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await customersAPI.getById(id)
        set((state) => {
          state.currentCustomer = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch customer'
          state.isLoading = false
        })
        throw error
      }
    },

    // Create customer
    createCustomer: async (data) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await customersAPI.create(data)
        set((state) => {
          state.customers.unshift(response.data)
          state.totalCustomers += 1
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to create customer'
          state.isLoading = false
        })
        throw error
      }
    },

    // Update customer
    updateCustomer: async (id, data) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await customersAPI.update(id, data)
        set((state) => {
          const index = state.customers.findIndex((c) => c.id === id)
          if (index !== -1) {
            state.customers[index] = response.data
          }
          if (state.currentCustomer?.id === id) {
            state.currentCustomer = response.data
          }
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to update customer'
          state.isLoading = false
        })
        throw error
      }
    },

    // Delete customer
    deleteCustomer: async (id) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        await customersAPI.delete(id)
        set((state) => {
          state.customers = state.customers.filter((c) => c.id !== id)
          state.totalCustomers -= 1
          if (state.currentCustomer?.id === id) {
            state.currentCustomer = null
          }
          state.isLoading = false
        })
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to delete customer'
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
          country: '',
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
        state.customers = []
        state.totalCustomers = 0
        state.currentCustomer = null
        state.isLoading = false
        state.error = null
        state.filters = {
          status: '',
          country: '',
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

export default useCustomersStore
