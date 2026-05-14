/**
 * CommissionDashboard — Phase 4, C15.
 *
 * Super-admin OR FW-access users only. The route gate in App.jsx
 * mirrors the backend requireFwAccess middleware so the page is
 * defense-in-depth-hidden from SH-only users.
 *
 * KPIs: MTD / QTD / YTD accrued, plus pending payment (any
 * accrued/invoiced_to_factory status, regardless of date).
 *
 * Pipeline forecast: server sums open quotations × resolved commission
 * rate. Probability-by-stage is a future refinement; today it's the
 * upper-bound forecast assuming every open quote converts.
 *
 * Deals table: every CommissionTracking row under the brand with
 * customer + SO + days-open. Status badges. Super-admin can Mark
 * paid / Claw back via the row actions.
 *
 * Outstanding tracker: subset of deals with status accrued or
 * invoiced_to_factory aged > 30 days. Same row actions.
 */

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { DollarSign, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import api from '../../services/api'
import StatsCard from '../../components/StatsCard'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency } from '../../utils/formatters'
import { formatDateTaipei } from '../../utils/formatters'

const STATUS_COLORS = {
  accrued: { bg: '#FEF3C7', fg: '#92400E', label: 'Accrued' },
  invoiced_to_factory: { bg: '#DBEAFE', fg: '#1E40AF', label: 'Invoiced to factory' },
  paid: { bg: '#D1FAE5', fg: '#065F46', label: 'Paid' },
  disputed: { bg: '#FEE2E2', fg: '#991B1B', label: 'Disputed' },
  clawed_back: { bg: '#F3F4F6', fg: '#374151', label: 'Clawed back' },
  pending: { bg: '#E5E7EB', fg: '#374151', label: 'Pending (legacy)' },
}

export default function CommissionDashboard() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/personalization/commissions/dashboard?brand=FW')
      setData(res.data?.data || res.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load commission dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleMarkPaid = async (row) => {
    if (!confirm(`Mark commission ${formatCurrency(row.amount)} on order ${row.orderNumber || row.id.slice(0, 8)} as PAID?`)) return
    setActionBusy(row.id)
    try {
      await api.post(`/personalization/commissions/${row.id}/mark-paid`)
      toast.success('Marked paid')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Mark paid failed')
    } finally {
      setActionBusy(null)
    }
  }

  const handleClawBack = async (row) => {
    const reason = prompt(`Reason for clawing back commission on order ${row.orderNumber || row.id.slice(0, 8)} (min 5 chars):`)
    if (!reason || reason.trim().length < 5) {
      toast.error('Reason must be at least 5 characters')
      return
    }
    setActionBusy(row.id)
    try {
      await api.post(`/personalization/commissions/${row.id}/claw-back`, { reason })
      toast.success('Clawed back')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Claw back failed')
    } finally {
      setActionBusy(null)
    }
  }

  const handlePercentageBlur = async (row, newPctStr) => {
    const pct = parseFloat(newPctStr)
    if (!Number.isFinite(pct) || pct < 5 || pct > 100) {
      toast.error('Rate must be between 5% (floor) and 100%')
      return
    }
    if (pct === parseFloat(row.percentage)) return
    setActionBusy(row.id)
    try {
      await api.patch(`/personalization/commissions/${row.id}`, { percentage: pct })
      toast.success(`Rate updated to ${pct}%`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rate update failed')
    } finally {
      setActionBusy(null)
    }
  }

  if (loading || !data) return <LoadingSpinner message="Loading commission dashboard…" />

  const { kpis, pipelineForecast, deals, outstanding, currency } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">FlorWay commission dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Tracking of factory-paid commission. Rate floor 5%. Per-quotation override on the quotation itself.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          icon={DollarSign}
          label="Accrued (MTD)"
          value={formatCurrency(kpis.mtdAccrued, currency)}
        />
        <StatsCard
          icon={TrendingUp}
          label="Accrued (QTD)"
          value={formatCurrency(kpis.qtdAccrued, currency)}
        />
        <StatsCard
          icon={TrendingUp}
          label="Accrued (YTD)"
          value={formatCurrency(kpis.ytdAccrued, currency)}
        />
        <StatsCard
          icon={Clock}
          label="Pending payment"
          value={formatCurrency(kpis.pendingPayment, currency)}
          trendLabel="awaiting factory"
        />
      </div>

      {/* Pipeline forecast */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Pipeline forecast (open quotations × rate)
            </div>
            <div className="text-3xl font-bold text-slate-900 mt-2">
              {formatCurrency(pipelineForecast, currency)}
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 max-w-[280px]">
            Upper-bound estimate assuming every open quotation converts. Probability-by-stage weighting comes in a later phase.
          </div>
        </div>
      </div>

      {/* Outstanding > 30d */}
      {outstanding && outstanding.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-700" />
            <h2 className="text-lg font-semibold text-amber-900">Outstanding &gt; 30 days ({outstanding.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-amber-700 border-b border-amber-200">
                <th className="text-left py-2">Order</th>
                <th className="text-left py-2">Customer</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-right py-2">Days open</th>
                <th className="text-left py-2">Status</th>
                {isSuperAdmin && <th className="text-right py-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {outstanding.map((r) => (
                <tr key={r.id} className="border-b border-amber-100">
                  <td className="py-2 font-mono text-xs">{r.orderNumber || r.id.slice(0, 8)}</td>
                  <td className="py-2">{r.customerName || '—'}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(r.amount, currency)}</td>
                  <td className="py-2 text-right">{r.daysOpen}d</td>
                  <td className="py-2">
                    <StatusPill status={r.status} />
                  </td>
                  {isSuperAdmin && (
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleMarkPaid(r)}
                        disabled={actionBusy === r.id}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 mr-1"
                      >
                        Mark paid
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* All deals */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">All FW commission deals</h2>
          <span className="text-sm text-slate-500">{deals?.length || 0} rows</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Order</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Accrued</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Rate</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                {isSuperAdmin && <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(deals || []).map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.orderNumber || r.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{r.customerName || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTaipei(r.accrualDate)}</td>
                  <td className="px-4 py-3 text-right">
                    {isSuperAdmin && (r.status === 'accrued' || r.status === 'pending') ? (
                      <input
                        type="number"
                        min={5}
                        max={100}
                        step={0.5}
                        defaultValue={parseFloat(r.percentage)}
                        disabled={actionBusy === r.id}
                        onBlur={(e) => handlePercentageBlur(r, e.target.value)}
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-xs text-right"
                      />
                    ) : (
                      <span className="font-mono">{Number(r.percentage).toFixed(2)}</span>
                    )}
                    <span className="text-slate-500 text-xs ml-1">%</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(r.amount, currency)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {(r.status === 'accrued' || r.status === 'invoiced_to_factory' || r.status === 'pending') && (
                        <button
                          onClick={() => handleMarkPaid(r)}
                          disabled={actionBusy === r.id}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 mr-1"
                        >
                          Mark paid
                        </button>
                      )}
                      {r.status !== 'clawed_back' && r.status !== 'paid' && (
                        <button
                          onClick={() => handleClawBack(r)}
                          disabled={actionBusy === r.id}
                          className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 disabled:opacity-50"
                        >
                          Claw back
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {(!deals || deals.length === 0) && (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                    No commission rows yet. Confirm an FW sales order to accrue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const c = STATUS_COLORS[status] || { bg: '#F3F4F6', fg: '#374151', label: status }
  return (
    <span
      className="inline-block text-xs font-semibold px-2 py-0.5 rounded"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  )
}
