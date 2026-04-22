import { useState, useEffect } from 'react'
import {
  Package,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { dashboardAPI, purchaseOrdersAPI } from '../../services/api'
import StatsCard from '../StatsCard'
import DataTable from '../DataTable'
import LoadingSpinner from '../LoadingSpinner'
import StatusBadge from '../StatusBadge'
import Timeline from '../Timeline'
import { formatDate, formatCurrency } from '../../utils/formatters'

export default function FactoryDashboard() {
  const [stats, setStats] = useState(null)
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [upcomingInspections, setUpcomingInspections] = useState([])
  const [productionTimeline, setProductionTimeline] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)

        // Fetch purchase orders for this factory
        const ordersRes = await purchaseOrdersAPI.getAll({
          limit: 10,
          sort: 'createdAt:desc',
        })

        const orders = ordersRes.data?.data || []

        // Categorize POs by status
        const newOrders = orders.filter((o) => o.status === 'draft').length
        const confirmedOrders = orders.filter((o) => o.status === 'confirmed').length
        const inProductionOrders = orders.filter((o) => o.status === 'in_production').length
        const shippedOrders = orders.filter((o) => o.status === 'shipped').length

        setPurchaseOrders(orders)

        // Mock upcoming inspections (would come from API in real scenario)
        const mockInspections = [
          {
            id: 1,
            poNumber: 'PO-001',
            scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            inspectionType: 'In-Process',
            status: 'scheduled',
          },
          {
            id: 2,
            poNumber: 'PO-002',
            scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            inspectionType: 'Final',
            status: 'scheduled',
          },
        ]

        setUpcomingInspections(mockInspections)

        // Mock production timeline
        const mockTimeline = [
          {
            id: 1,
            poNumber: 'PO-001',
            stage: 'Raw Materials',
            startDate: new Date(),
            endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            progress: 100,
            status: 'completed',
          },
          {
            id: 2,
            poNumber: 'PO-001',
            stage: 'Assembly',
            startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
            progress: 65,
            status: 'in_progress',
          },
          {
            id: 3,
            poNumber: 'PO-001',
            stage: 'Quality Check',
            startDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            progress: 0,
            status: 'pending',
          },
        ]

        setProductionTimeline(mockTimeline)

        // Mock recent activity
        const mockActivity = [
          {
            id: 1,
            type: 'order_received',
            poNumber: 'PO-001',
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
            message: 'New purchase order received',
          },
          {
            id: 2,
            type: 'production_started',
            poNumber: 'PO-002',
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
            message: 'Production started on PO-002',
          },
          {
            id: 3,
            type: 'inspection_completed',
            poNumber: 'PO-003',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
            message: 'Inspection completed - Passed',
          },
        ]

        setRecentActivity(mockActivity)

        // Calculate statistics
        setStats({
          totalPOs: orders.length,
          newOrders,
          confirmedOrders,
          inProductionOrders,
          shippedOrders,
          upcomingInspections: mockInspections.length,
        })
      } catch (error) {
        console.error('Failed to fetch factory dashboard data:', error)
        toast.error('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const getActivityIcon = (type) => {
    switch (type) {
      case 'order_received':
        return <Package className="w-4 h-4" />
      case 'production_started':
        return <TrendingUp className="w-4 h-4" />
      case 'inspection_completed':
        return <CheckCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getActivityColor = (type) => {
    switch (type) {
      case 'order_received':
        return 'bg-blue-100 text-blue-600'
      case 'production_started':
        return 'bg-orange-100 text-orange-600'
      case 'inspection_completed':
        return 'bg-green-100 text-green-600'
      default:
        return 'bg-slate-100 text-slate-600'
    }
  }

  if (isLoading) return <LoadingSpinner message="Loading factory dashboard..." />

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Factory Dashboard</h1>
          <p className="text-slate-600 text-sm mt-1">
            Production and order management overview
          </p>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            icon={Package}
            label="New Purchase Orders"
            value={stats.newOrders}
            color="blue"
          />
          <StatsCard
            icon={CheckCircle}
            label="Confirmed Orders"
            value={stats.confirmedOrders}
            color="green"
          />
          <StatsCard
            icon={TrendingUp}
            label="In Production"
            value={stats.inProductionOrders}
            color="orange"
          />
          <StatsCard
            icon={AlertCircle}
            label="Upcoming Inspections"
            value={stats.upcomingInspections}
            color="red"
          />
        </div>
      )}

      {/* PO Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PO Status Overview */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">PO Status Summary</h2>
          <div className="space-y-3">
            {stats && (
              <>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                  <span className="text-slate-600">New</span>
                  <span className="font-semibold text-slate-900">{stats.newOrders}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                  <span className="text-slate-600">Confirmed</span>
                  <span className="font-semibold text-slate-900">{stats.confirmedOrders}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                  <span className="text-slate-600">In Production</span>
                  <span className="font-semibold text-slate-900">{stats.inProductionOrders}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                  <span className="text-slate-600">Shipped</span>
                  <span className="font-semibold text-slate-900">{stats.shippedOrders}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Upcoming Inspections */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Upcoming Inspections</h2>
          <div className="space-y-3">
            {upcomingInspections.length === 0 ? (
              <p className="text-slate-500 text-sm">No upcoming inspections</p>
            ) : (
              upcomingInspections.map((inspection) => (
                <div
                  key={inspection.id}
                  className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{inspection.poNumber}</p>
                      <p className="text-sm text-slate-600 mt-1">{inspection.inspectionType}</p>
                    </div>
                    <StatusBadge status={inspection.status} />
                  </div>
                  <div className="flex items-center text-sm text-slate-600 mt-3">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(inspection.scheduledDate)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Production Timeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Production Timeline</h2>
        <div className="space-y-4">
          {productionTimeline.length === 0 ? (
            <p className="text-slate-500 text-sm">No active production timelines</p>
          ) : (
            productionTimeline.map((item) => (
              <div key={item.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-slate-900">{item.poNumber}</p>
                    <p className="text-sm text-slate-600">{item.stage}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="text-sm text-slate-600 mb-2">
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      item.status === 'completed'
                        ? 'bg-green-600'
                        : item.status === 'in_progress'
                          ? 'bg-blue-600'
                          : 'bg-slate-300'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  ></div>
                </div>
                <div className="text-xs text-slate-500 mt-1">{item.progress}% Complete</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {recentActivity.length === 0 ? (
            <p className="text-slate-500 text-sm">No recent activity</p>
          ) : (
            recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start space-x-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div
                  className={`p-2 rounded-full flex-shrink-0 ${getActivityColor(
                    activity.type
                  )}`}
                >
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{activity.message}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-slate-600">{activity.poNumber}</p>
                    <time className="text-xs text-slate-500">
                      {activity.timestamp.toLocaleTimeString()}
                    </time>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Active Purchase Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  PO #
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Order Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                    No purchase orders
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((po) => (
                  <tr key={po.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{po.poNumber}</td>
                    <td className="px-6 py-4 text-slate-600">{formatDate(po.createdAt)}</td>
                    <td className="px-6 py-4 text-slate-900">{po.quantity || 0}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {formatCurrency(po.total || 0)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
