import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { poAPI } from '../../services/api'

const ProductionGantt = () => {
  const navigate = useNavigate()
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [zoomLevel, setZoomLevel] = useState('month') // week, month, quarter
  const [statusFilter, setStatusFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [hoveredBar, setHoveredBar] = useState(null)
  const [tooltipPos, setTooltipPos] = useState(null)

  useEffect(() => {
    fetchPurchaseOrders()
  }, [statusFilter])

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = {
        limit: 999,
      }
      if (statusFilter) {
        params.status = statusFilter
      }
      const response = await poAPI.list(params)
      setPurchaseOrders(response.data.data || response.data)
    } catch (err) {
      console.error('Error fetching purchase orders:', err)
      setError(err.response?.data?.message || 'Failed to fetch purchase orders')
      toast.error('Failed to load purchase orders')
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (productFilter) {
        const hasProduct = po.items && po.items.some((item) => item.productName?.toLowerCase().includes(productFilter.toLowerCase()) || item.name?.toLowerCase().includes(productFilter.toLowerCase()))
        return hasProduct
      }
      return true
    })
  }, [purchaseOrders, productFilter])

  const getStatusColor = (status) => {
    const colors = {
      pending: '#3B82F6', // blue
      confirmed: '#3B82F6', // blue
      in_production: '#F59E0B', // orange
      ready: '#10B981', // green
      shipped: '#8B5CF6', // purple
      delivered: '#10B981', // green
      cancelled: '#EF4444', // red
    }
    return colors[status] || '#6B7280' // gray
  }

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      in_production: 'In Production',
      ready: 'Ready',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    }
    return labels[status] || status
  }

  const calculateGanttDimensions = () => {
    const today = new Date()
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1)

    // Calculate date range
    let endDate
    if (zoomLevel === 'week') {
      startDate.setDate(today.getDate() - today.getDay())
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 84) // 12 weeks
    } else if (zoomLevel === 'month') {
      startDate.setMonth(today.getMonth() - 2)
      endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 6)
    } else {
      // quarter
      startDate.setMonth(Math.floor(today.getMonth() / 3) * 3 - 3)
      endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 12)
    }

    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    const pixelsPerDay = zoomLevel === 'week' ? 8 : zoomLevel === 'month' ? 2 : 0.5

    return { startDate, endDate, totalDays, pixelsPerDay, today }
  }

  const getBarPosition = (orderDate, durationDays, { startDate, pixelsPerDay }) => {
    const start = new Date(orderDate)
    const daysFromStart = Math.ceil((start - startDate) / (1000 * 60 * 60 * 24))
    const left = Math.max(0, daysFromStart * pixelsPerDay)
    const width = Math.max(10, durationDays * pixelsPerDay)
    return { left, width }
  }

  const generateTimelineHeaders = () => {
    const { startDate, endDate, pixelsPerDay } = calculateGanttDimensions()
    const headers = []

    if (zoomLevel === 'week') {
      let current = new Date(startDate)
      while (current < endDate) {
        const weekEnd = new Date(current)
        weekEnd.setDate(weekEnd.getDate() + 6)
        headers.push({
          label: `Week of ${current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          width: 7 * pixelsPerDay,
        })
        current = new Date(weekEnd)
        current.setDate(current.getDate() + 1)
      }
    } else if (zoomLevel === 'month') {
      let current = new Date(startDate)
      while (current < endDate) {
        const monthName = current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()
        headers.push({
          label: monthName,
          width: daysInMonth * pixelsPerDay,
        })
        current.setMonth(current.getMonth() + 1)
      }
    } else {
      // quarter
      let current = new Date(startDate)
      while (current < endDate) {
        const quarter = Math.floor(current.getMonth() / 3) + 1
        const quarterLabel = `Q${quarter} ${current.getFullYear()}`
        const daysInQuarter = new Date(current.getFullYear(), current.getMonth() + 3, 0).getDate() - current.getDate() + 1
        headers.push({
          label: quarterLabel,
          width: 91 * pixelsPerDay, // ~91 days per quarter
        })
        current.setMonth(current.getMonth() + 3)
      }
    }

    return headers
  }

  const { startDate, pixelsPerDay, today } = calculateGanttDimensions()

  const timelineHeaders = generateTimelineHeaders()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-gray-600">Loading production schedule...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Production Gantt Chart</h1>
          <p className="text-gray-600 mt-2">Visualize purchase orders and production timeline</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">View:</label>
              <div className="flex gap-1">
                {['week', 'month', 'quarter'].map((level) => (
                  <button
                    key={level}
                    onClick={() => setZoomLevel(level)}
                    className={`px-3 py-1 rounded text-sm font-medium transition ${
                      zoomLevel === level ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_production">In Production</option>
                <option value="ready">Ready</option>
                <option value="shipped">Shipped</option>
              </select>
            </div>

            {/* Product Filter */}
            <div className="flex items-center gap-2 flex-1">
              <label className="text-sm font-medium text-gray-700">Product:</label>
              <input
                type="text"
                placeholder="Filter by product name..."
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {['confirmed', 'in_production', 'ready', 'shipped', 'pending'].map((status) => (
              <div key={status} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor(status) }}></div>
                <span className="text-sm text-gray-700">{getStatusLabel(status)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gantt Chart */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Timeline Headers */}
              <div className="flex border-b border-gray-200">
                <div className="w-48 flex-shrink-0 px-4 py-3 border-r border-gray-200 bg-gray-50 font-semibold text-sm text-gray-900">
                  Purchase Order
                </div>
                <div className="flex-1 flex">
                  {timelineHeaders.map((header, idx) => (
                    <div
                      key={idx}
                      className="border-r border-gray-200 px-2 py-3 text-xs font-medium text-gray-600 text-center bg-gray-50"
                      style={{ width: `${header.width}px`, minWidth: '50px' }}
                    >
                      {header.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Gantt Bars */}
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No purchase orders found</p>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const orderDate = new Date(order.orderDate || order.createdAt)
                  const deliveryDate = new Date(order.expectedDelivery || order.deliveryDate)
                  const durationDays = Math.ceil((deliveryDate - orderDate) / (1000 * 60 * 60 * 24))
                  const { left, width } = getBarPosition(orderDate, Math.max(1, durationDays), { startDate, pixelsPerDay })
                  const todayPosition = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)) * pixelsPerDay

                  return (
                    <div
                      key={order.id}
                      className="flex border-b border-gray-100 hover:bg-blue-50 transition"
                      onClick={() => navigate(`/purchase-orders/${order.id}`)}
                    >
                      {/* PO Info */}
                      <div className="w-48 flex-shrink-0 px-4 py-3 border-r border-gray-200 bg-white text-sm">
                        <p className="font-semibold text-gray-900">{order.poNumber || order.number || `PO-${order.id}`}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {order.items && order.items.length > 0
                            ? order.items.map((item) => item.productName || item.name).join(', ').substring(0, 30)
                            : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{order.quantity || 0} units</p>
                      </div>

                      {/* Timeline with Bar */}
                      <div className="flex-1 relative bg-white" style={{ minWidth: `${sum(timelineHeaders.map((h) => h.width))}px` }}>
                        {/* Today marker */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 opacity-60"
                          style={{ left: `${todayPosition}px` }}
                        >
                          <span className="absolute top-1 right-0 text-xs text-red-500 font-bold whitespace-nowrap -translate-x-1">Today</span>
                        </div>

                        {/* Bar */}
                        <div
                          className="absolute top-2 bottom-2 rounded cursor-pointer transition hover:opacity-80"
                          style={{
                            left: `${left}px`,
                            width: `${width}px`,
                            backgroundColor: getStatusColor(order.status),
                            minWidth: '10px',
                          }}
                          onMouseEnter={(e) => {
                            setHoveredBar(order.id)
                            setTooltipPos({ x: e.clientX, y: e.clientY })
                          }}
                          onMouseLeave={() => {
                            setHoveredBar(null)
                            setTooltipPos(null)
                          }}
                        />

                        {/* Tooltip */}
                        {hoveredBar === order.id && tooltipPos && (
                          <div
                            className="fixed bg-gray-900 text-white rounded-lg p-3 z-50 shadow-lg text-xs max-w-xs pointer-events-none"
                            style={{
                              left: `${tooltipPos.x}px`,
                              top: `${tooltipPos.y + 10}px`,
                              transform: 'translateX(-50%)',
                            }}
                          >
                            <p className="font-semibold">{order.poNumber || `PO-${order.id}`}</p>
                            <p className="mt-1">
                              <span className="text-gray-300">Status:</span> {getStatusLabel(order.status)}
                            </p>
                            {order.items && order.items.length > 0 && (
                              <p className="mt-1">
                                <span className="text-gray-300">Products:</span> {order.items.map((item) => item.productName || item.name).join(', ')}
                              </p>
                            )}
                            <p className="mt-1">
                              <span className="text-gray-300">Quantity:</span> {order.quantity || 0} units
                            </p>
                            <p className="mt-1">
                              <span className="text-gray-300">Order Date:</span> {orderDate.toLocaleDateString()}
                            </p>
                            <p className="mt-1">
                              <span className="text-gray-300">Due:</span> {deliveryDate.toLocaleDateString()}
                            </p>
                            <p className="mt-2 text-blue-300">Click to view details</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {['confirmed', 'in_production', 'ready', 'shipped'].map((status) => {
            const count = filteredOrders.filter((po) => po.status === status).length
            return (
              <div key={status} className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">{getStatusLabel(status)}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{count}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {filteredOrders.length > 0 ? Math.round((count / filteredOrders.length) * 100) : 0}%
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Helper function to sum array values
const sum = (arr) => arr.reduce((a, b) => a + b, 0)

export default ProductionGantt
