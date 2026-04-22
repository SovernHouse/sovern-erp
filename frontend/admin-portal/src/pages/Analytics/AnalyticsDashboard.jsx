import React, { useState, useEffect } from 'react'
import { BarChart, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { analyticsAPI } from '../../services/api'
import RevenueChart from './RevenueChart'
import OrderFunnel from './OrderFunnel'
import TopProductsChart from './TopProductsChart'
import CustomerSegments from './CustomerSegments'
import FactoryPerformance from './FactoryPerformance'
import PaymentAging from './PaymentAging'
import ProfitMargins from './ProfitMargins'
import ShipmentTimeline from './ShipmentTimeline'
import ForecastChart from './ForecastChart'

const AnalyticsDashboard = () => {
  const [dateRange, setDateRange] = useState('12m')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    revenue: null,
    funnel: null,
    products: null,
    segments: null,
    factory: null,
    aging: null,
    margins: null,
    shipment: null,
    forecast: null
  })

  useEffect(() => {
    loadData()
  }, [dateRange])

  const loadData = async () => {
    setLoading(true)
    try {
      const [
        revenueRes,
        funnelRes,
        productsRes,
        segmentsRes,
        factoryRes,
        agingRes,
        marginsRes,
        shipmentRes,
        forecastRes
      ] = await Promise.all([
        analyticsAPI.getRevenueTrend(),
        analyticsAPI.getOrderFunnel(),
        analyticsAPI.getTopProducts(),
        analyticsAPI.getCustomerSegments(),
        analyticsAPI.getFactoryPerformance(),
        analyticsAPI.getPaymentAging(),
        analyticsAPI.getProfitMargins(),
        analyticsAPI.getShipmentTimeline(),
        analyticsAPI.getForecast()
      ])

      // Interceptor already unwraps { success, data } → res.data is the payload
      setData({
        revenue: revenueRes.data,
        funnel: funnelRes.data,
        products: productsRes.data,
        segments: segmentsRes.data,
        factory: factoryRes.data,
        aging: agingRes.data,
        margins: marginsRes.data,
        shipment: shipmentRes.data,
        forecast: forecastRes.data
      })
    } catch (error) {
      toast.error('Failed to load analytics data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDateRangeChange = (range) => {
    setDateRange(range)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Refresh
          </button>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: '7d', label: 'Last 7 Days' },
            { value: '30d', label: 'Last 30 Days' },
            { value: '90d', label: 'Last 90 Days' },
            { value: '12m', label: 'Last 12 Months' }
          ].map(range => (
            <button
              key={range.value}
              onClick={() => handleDateRangeChange(range.value)}
              className={`px-4 py-2 rounded-lg transition ${
                dateRange === range.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-600'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Trend */}
        {data.revenue && <RevenueChart data={data.revenue} />}

        {/* Order Funnel */}
        {data.funnel && <OrderFunnel data={data.funnel} />}

        {/* Top Products */}
        {data.products && <TopProductsChart data={data.products} />}

        {/* Customer Segments */}
        {data.segments && <CustomerSegments data={data.segments} />}

        {/* Factory Performance */}
        {data.factory && <FactoryPerformance data={data.factory} />}

        {/* Payment Aging */}
        {data.aging && <PaymentAging data={data.aging} />}

        {/* Profit Margins */}
        {data.margins && <ProfitMargins data={data.margins} />}

        {/* Shipment Timeline */}
        {data.shipment && <ShipmentTimeline data={data.shipment} />}

        {/* Forecast */}
        {data.forecast && <ForecastChart data={data.forecast} />}
      </div>

      {/* Footer */}
      <div className="text-right text-sm text-slate-500">
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  )
}

export default AnalyticsDashboard
