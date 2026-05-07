import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, AlertCircle } from 'lucide-react'
import LoadingSpinner from '../LoadingSpinner'
import { dashboardAPI } from '../../services/api'
import { formatCurrency } from '../../utils/formatters'

/**
 * RevenueWidget — real revenue numbers from /api/dashboard/admin.
 * Click anywhere to drill into /reports/financial for the breakdown.
 */
export default function RevenueWidget() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await dashboardAPI.getMetrics()
        if (cancelled) return
        const stats = res.data?.stats || {}
        setData({
          thisMonthRevenue:    Number(stats.thisMonthRevenue) || 0,
          totalRevenue:        Number(stats.totalRevenue)     || 0,
          pendingInvoices:     Number(stats.pendingInvoices)  || 0,
          totalOrders:         Number(stats.totalOrders)      || 0,
          completedOrders:     Number(stats.completedOrders)  || 0,
          totalQuotations:     Number(stats.totalQuotations)     || 0,
          convertedQuotations: Number(stats.convertedQuotations) || 0,
          quoteConversionRate: Number(stats.quoteConversionRate) || 0,
        })
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error?.message || 'Failed to load revenue')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (isLoading) return <LoadingSpinner />
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* This-month headline — clicks into the financial report */}
      <button
        onClick={() => navigate('/reports/financial')}
        className="w-full text-left p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 hover:border-green-400 transition-colors group"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-green-700 font-medium">This Month Revenue</p>
            <p className="text-3xl font-bold text-green-900 mt-2">
              {formatCurrency(data.thisMonthRevenue)}
            </p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>

      {/* Total revenue + pending invoices — both click-through */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/reports/financial')}
          className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors"
        >
          <p className="text-xs text-slate-600 font-medium">Total Revenue</p>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {formatCurrency(data.totalRevenue)}
          </p>
        </button>
        <button
          onClick={() => navigate('/invoices?status=sent')}
          className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors"
        >
          <p className="text-xs text-slate-600 font-medium">Pending Invoices</p>
          <p className={`text-lg font-bold mt-1 ${data.pendingInvoices > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {formatCurrency(data.pendingInvoices)}
          </p>
        </button>
      </div>

      {/* Quote -> Order conversion rate */}
      <button
        onClick={() => navigate('/quotations')}
        className="w-full p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 text-left transition-colors group"
        title="Accepted quotations (signed back by client) ÷ quotations sent to customers (excludes drafts)"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-700 font-medium">Quote → Order Conversion</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {data.totalQuotations > 0 ? `${data.quoteConversionRate}%` : '—'}
            </p>
            <p className="text-xs text-blue-700/80 mt-0.5">
              {data.convertedQuotations} signed back of {data.totalQuotations} {data.totalQuotations === 1 ? 'quote sent' : 'quotes sent'}
            </p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>

      <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
        <span>
          {data.totalOrders > 0
            ? `${data.completedOrders} of ${data.totalOrders} orders completed`
            : 'No sales orders yet'}
        </span>
      </div>
    </div>
  )
}
