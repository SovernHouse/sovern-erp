import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// Invoices store for managing invoice data across portals
const useInvoicesStore = create(
  immer((set, get) => ({
    // State
    invoices: [],
    totalInvoices: 0,
    currentInvoice: null,
    isLoading: false,
    error: null,
    stats: {
      totalAmount: 0,
      paidAmount: 0,
      dueAmount: 0,
      overdueAmount: 0,
    },
    filters: {
      status: '', // draft, issued, paid, overdue, cancelled
      customer: '',
      dateFrom: '',
      dateTo: '',
      search: '',
    },
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
    },

    // Fetch all invoices
    fetchInvoices: async (params = {}, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.getAll(params)
        set((state) => {
          state.invoices = response.data.data || response.data
          state.totalInvoices = response.data.total || response.data.length
          state.pagination.total = response.data.total || response.data.length
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch invoices'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch single invoice
    fetchInvoice: async (id, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.getById(id)
        set((state) => {
          state.currentInvoice = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch invoice'
          state.isLoading = false
        })
        throw error
      }
    },

    // Create invoice
    createInvoice: async (data, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.create(data)
        set((state) => {
          state.invoices.unshift(response.data)
          state.totalInvoices += 1
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to create invoice'
          state.isLoading = false
        })
        throw error
      }
    },

    // Update invoice
    updateInvoice: async (id, data, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.update(id, data)
        set((state) => {
          const index = state.invoices.findIndex((inv) => inv.id === id)
          if (index !== -1) {
            state.invoices[index] = response.data
          }
          if (state.currentInvoice?.id === id) {
            state.currentInvoice = response.data
          }
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to update invoice'
          state.isLoading = false
        })
        throw error
      }
    },

    // Record payment
    recordPayment: async (id, paymentData, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.recordPayment(id, paymentData)
        set((state) => {
          const index = state.invoices.findIndex((inv) => inv.id === id)
          if (index !== -1) {
            state.invoices[index] = response.data
          }
          if (state.currentInvoice?.id === id) {
            state.currentInvoice = response.data
          }
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to record payment'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch invoice statistics
    fetchInvoiceStats: async (apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        // This assumes the API has a stats endpoint, or we calculate from fetched invoices
        const response = await apiService.getAll()
        const invoices = response.data.data || response.data

        let stats = {
          totalAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
          overdueAmount: 0,
        }

        invoices.forEach((inv) => {
          stats.totalAmount += inv.totalAmount || 0
          if (inv.status === 'paid') {
            stats.paidAmount += inv.totalAmount || 0
          } else if (inv.status === 'overdue') {
            stats.overdueAmount += inv.totalAmount || 0
          } else {
            stats.dueAmount += inv.totalAmount || 0
          }
        })

        set((state) => {
          state.stats = stats
          state.isLoading = false
        })
        return stats
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch invoice stats'
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
          customer: '',
          dateFrom: '',
          dateTo: '',
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
        state.invoices = []
        state.totalInvoices = 0
        state.currentInvoice = null
        state.isLoading = false
        state.error = null
        state.stats = {
          totalAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
          overdueAmount: 0,
        }
        state.filters = {
          status: '',
          customer: '',
          dateFrom: '',
          dateTo: '',
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

export default useInvoicesStore
