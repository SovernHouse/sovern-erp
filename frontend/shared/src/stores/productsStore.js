import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// This store is designed to work with any portal's API service
// Expects api object with products endpoints
const useProductsStore = create(
  immer((set, get) => ({
    // State
    products: [],
    totalProducts: 0,
    currentProduct: null,
    isLoading: false,
    error: null,
    filters: {
      status: '',
      category: '',
      search: '',
      factory: '',
    },
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
    },

    // Fetch all products
    fetchProducts: async (params = {}, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.getAll(params)
        set((state) => {
          state.products = response.data.data || response.data
          state.totalProducts = response.data.total || response.data.length
          state.pagination.total = response.data.total || response.data.length
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch products'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch single product
    fetchProduct: async (id, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.getById(id)
        set((state) => {
          state.currentProduct = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch product'
          state.isLoading = false
        })
        throw error
      }
    },

    // Create product
    createProduct: async (data, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.create(data)
        set((state) => {
          state.products.unshift(response.data)
          state.totalProducts += 1
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to create product'
          state.isLoading = false
        })
        throw error
      }
    },

    // Update product
    updateProduct: async (id, data, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await apiService.update(id, data)
        set((state) => {
          const index = state.products.findIndex((p) => p.id === id)
          if (index !== -1) {
            state.products[index] = response.data
          }
          if (state.currentProduct?.id === id) {
            state.currentProduct = response.data
          }
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to update product'
          state.isLoading = false
        })
        throw error
      }
    },

    // Delete product
    deleteProduct: async (id, apiService) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        await apiService.delete(id)
        set((state) => {
          state.products = state.products.filter((p) => p.id !== id)
          state.totalProducts -= 1
          if (state.currentProduct?.id === id) {
            state.currentProduct = null
          }
          state.isLoading = false
        })
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to delete product'
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
          category: '',
          search: '',
          factory: '',
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
        state.products = []
        state.totalProducts = 0
        state.currentProduct = null
        state.isLoading = false
        state.error = null
        state.filters = {
          status: '',
          category: '',
          search: '',
          factory: '',
        }
        state.pagination = {
          page: 1,
          limit: 10,
          total: 0,
        }
      }),
  }))
)

export default useProductsStore
