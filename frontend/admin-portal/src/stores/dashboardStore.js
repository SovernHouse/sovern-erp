import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { dashboardAPI } from '../services/api.js'

const useDashboardStore = create(
  immer((set, get) => ({
    // State
    metrics: {
      totalRevenue: 0,
      totalOrders: 0,
      totalCustomers: 0,
      pendingOrders: 0,
      totalFactories: 0,
      lowStockProducts: 0,
    },
    revenueChart: [],
    ordersChart: [],
    topCustomers: [],
    recentInquiries: [],
    recentOrders: [],
    upcomingShipments: [],
    kpis: {},
    isLoading: false,
    error: null,
    lastRefresh: null,

    // Fetch metrics
    fetchMetrics: async () => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await dashboardAPI.getMetrics()
        set((state) => {
          state.metrics = response.data
          state.lastRefresh = new Date().toISOString()
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch metrics'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch revenue chart data
    fetchRevenueChart: async (params = {}) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await dashboardAPI.getRevenueChart(params)
        set((state) => {
          state.revenueChart = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch revenue chart'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch orders chart data
    fetchOrdersChart: async () => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await dashboardAPI.getOrdersChart()
        set((state) => {
          state.ordersChart = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch orders chart'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch top customers
    fetchTopCustomers: async () => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await dashboardAPI.getTopCustomers()
        set((state) => {
          state.topCustomers = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch top customers'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch recent inquiries
    fetchRecentInquiries: async () => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await dashboardAPI.getRecentInquiries()
        set((state) => {
          state.recentInquiries = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch recent inquiries'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch recent orders
    fetchRecentOrders: async () => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await dashboardAPI.getRecentOrders()
        set((state) => {
          state.recentOrders = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch recent orders'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch upcoming shipments
    fetchUpcomingShipments: async () => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await dashboardAPI.getUpcomingShipments()
        set((state) => {
          state.upcomingShipments = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch upcoming shipments'
          state.isLoading = false
        })
        throw error
      }
    },

    // Fetch KPIs
    fetchKPIs: async () => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        const response = await dashboardAPI.getKPIs()
        set((state) => {
          state.kpis = response.data
          state.isLoading = false
        })
        return response.data
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to fetch KPIs'
          state.isLoading = false
        })
        throw error
      }
    },

    // Refresh all dashboard data
    refreshAllData: async () => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      try {
        await Promise.all([
          get().fetchMetrics(),
          get().fetchRevenueChart(),
          get().fetchOrdersChart(),
          get().fetchTopCustomers(),
          get().fetchRecentInquiries(),
          get().fetchRecentOrders(),
          get().fetchUpcomingShipments(),
          get().fetchKPIs(),
        ])
        set((state) => {
          state.isLoading = false
          state.lastRefresh = new Date().toISOString()
        })
      } catch (error) {
        set((state) => {
          state.error = error.response?.data?.message || 'Failed to refresh dashboard data'
          state.isLoading = false
        })
        throw error
      }
    },

    // Clear error
    clearError: () =>
      set((state) => {
        state.error = null
      }),

    // Reset store
    reset: () =>
      set((state) => {
        state.metrics = {
          totalRevenue: 0,
          totalOrders: 0,
          totalCustomers: 0,
          pendingOrders: 0,
          totalFactories: 0,
          lowStockProducts: 0,
        }
        state.revenueChart = []
        state.ordersChart = []
        state.topCustomers = []
        state.recentInquiries = []
        state.recentOrders = []
        state.upcomingShipments = []
        state.kpis = {}
        state.isLoading = false
        state.error = null
        state.lastRefresh = null
      }),
  }))
)

export default useDashboardStore
