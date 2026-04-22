import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { personalizationAPI } from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import DataTable from '../../components/DataTable'
import StatsCard from '../../components/StatsCard'

export default function CommissionDashboard() {
  const [commissions, setCommissions] = useState(null)
  const [rules, setRules] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    loadCommissionData()
  }, [])

  const loadCommissionData = async () => {
    try {
      setIsLoading(true)
      const [commsRes, rulesRes] = await Promise.all([
        personalizationAPI.getMyCommissions(),
        personalizationAPI.getCommissionRules()
      ])

      setCommissions(commsRes.data)
      setRules(rulesRes.data || [])
    } catch (error) {
      console.error('Failed to load commission data:', error)
      toast.error('Failed to load commission data')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <LoadingSpinner message="Loading commission data..." />

  if (!commissions) return <div>No commission data available</div>

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(value) || 0)
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'approved':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'disputed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  const columns = [
    { key: 'salesOrderId', label: 'Order ID' },
    { key: 'amount', label: 'Commission', format: (v) => formatCurrency(v) },
    { key: 'percentage', label: 'Rate' },
    { key: 'orderAmount', label: 'Order Total', format: (v) => formatCurrency(v) },
    { key: 'status', label: 'Status', format: (v) => <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(v)}`}>{v}</span> },
    { key: 'createdAt', label: 'Date', format: (v) => formatDate(v) }
  ]

  const tableData = commissions.commissions.map(c => ({
    ...c,
    salesOrderId: c.SalesOrder?.orderNumber || c.salesOrderId
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Commission Dashboard</h1>
        <p className="text-slate-600 mt-1">Track your earned commissions and performance metrics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          icon={<DollarSign className="w-8 h-8 text-blue-600" />}
          label="Total Earned"
          value={formatCurrency(commissions.stats.totalEarned)}
          trend={12}
          color="blue"
        />
        <StatsCard
          icon={<Clock className="w-8 h-8 text-yellow-600" />}
          label="Pending"
          value={formatCurrency(commissions.stats.pending || 0)}
          trend={5}
          color="yellow"
        />
        <StatsCard
          icon={<CheckCircle className="w-8 h-8 text-green-600" />}
          label="Paid"
          value={formatCurrency(commissions.stats.paid || 0)}
          trend={8}
          color="green"
        />
        <StatsCard
          icon={<AlertCircle className="w-8 h-8 text-red-600" />}
          label="Disputed"
          value={formatCurrency(commissions.stats.disputed || 0)}
          trend={-2}
          color="red"
        />
      </div>

      {/* Commission Rules Section */}
      {rules.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Commission Rules</h2>
          </div>
          <div className="p-6 space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{rule.name}</p>
                    <p className="text-sm text-slate-600 mt-1">{rule.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      {rule.ruleType === 'percentage' ? `${rule.baseValue}%` : formatCurrency(rule.baseValue)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{rule.ruleType}</p>
                  </div>
                </div>
                {rule.minAmount && (
                  <p className="text-xs text-slate-600 mt-3">
                    Min order: {formatCurrency(rule.minAmount)}
                    {rule.maxAmount && ` - Max: ${formatCurrency(rule.maxAmount)}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commissions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Commission History</span>
          </h2>
        </div>
        <div className="p-6">
          {tableData.length > 0 ? (
            <DataTable columns={columns} data={tableData} />
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-600">No commissions earned yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900 font-semibold">Total Commissions</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {commissions.commissions.length}
          </p>
        </div>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-900 font-semibold">Approval Rate</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {commissions.commissions.length > 0
              ? ((commissions.commissions.filter(c => c.status !== 'pending').length / commissions.commissions.length) * 100).toFixed(0)
              : 0}%
          </p>
        </div>
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-900 font-semibold">Average Commission</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            {commissions.commissions.length > 0
              ? formatCurrency(
                  commissions.commissions.reduce((sum, c) => sum + parseFloat(c.amount), 0) /
                  commissions.commissions.length
                )
              : '$0'}
          </p>
        </div>
      </div>
    </div>
  )
}
