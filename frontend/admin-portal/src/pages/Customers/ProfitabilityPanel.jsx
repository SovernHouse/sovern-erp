import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { customersAPI } from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

function isoDay(d) {
  const x = new Date(d)
  return x.toISOString().slice(0, 10)
}

function defaultFrom() {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  return isoDay(d)
}

function defaultTo() {
  return isoDay(new Date())
}

function MetricCard({ label, value, sublabel, tone = 'neutral' }) {
  const toneClasses = {
    positive: 'text-emerald-700',
    negative: 'text-rose-700',
    neutral: 'text-slate-900',
    muted: 'text-slate-700',
  }
  return (
    <div className="bg-white rounded-lg shadow p-5 border border-slate-100">
      <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${toneClasses[tone]}`}>{value}</p>
      {sublabel ? <p className="text-xs text-slate-500 mt-1">{sublabel}</p> : null}
    </div>
  )
}

function BreakdownRow({ label, value, sublabel, sign = '', emphasis = false }) {
  return (
    <div className={`flex items-baseline justify-between py-2 ${emphasis ? 'border-t border-slate-200 mt-1 font-semibold' : ''}`}>
      <div>
        <span className="text-slate-700">{label}</span>
        {sublabel ? <span className="text-xs text-slate-500 ml-2">{sublabel}</span> : null}
      </div>
      <div className="font-mono">
        {sign ? <span className="text-slate-400 mr-1">{sign}</span> : null}
        <span>{value}</span>
      </div>
    </div>
  )
}

export default function ProfitabilityPanel({ customerId }) {
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(defaultTo())
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchProfitability = async (overrideFrom, overrideTo) => {
    try {
      setIsLoading(true)
      const res = await customersAPI.getProfitability(customerId, {
        from: overrideFrom ?? from,
        to: overrideTo ?? to,
      })
      setData(res.data?.data ?? res.data)
    } catch (err) {
      console.error('Failed to fetch profitability:', err)
      toast.error(err.response?.data?.error?.message || 'Failed to load profitability')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProfitability(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  const presets = [
    { label: 'Trailing 3mo', months: 3 },
    { label: 'Trailing 6mo', months: 6 },
    { label: 'Trailing 12mo', months: 12 },
    { label: 'YTD', ytd: true },
  ]

  function applyPreset(p) {
    let f, t
    if (p.ytd) {
      const now = new Date()
      f = isoDay(new Date(now.getFullYear(), 0, 1))
      t = isoDay(now)
    } else {
      const now = new Date()
      const start = new Date(now)
      start.setMonth(start.getMonth() - p.months)
      f = isoDay(start)
      t = isoDay(now)
    }
    setFrom(f)
    setTo(t)
    fetchProfitability(f, t)
  }

  return (
    <div className="space-y-6">
      {/* Period controls */}
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <button
            onClick={() => fetchProfitability(from, to)}
            disabled={isLoading}
            className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {isLoading ? 'Loading…' : 'Apply'}
          </button>
          <div className="ml-auto flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && !data ? (
        <LoadingSpinner />
      ) : !data ? (
        <p className="text-slate-500 text-center py-12">No profitability data.</p>
      ) : (
        <>
          {/* Top metrics. Phase 4.28h: Commission Revenue surfaces the
              FW/HH agent-model income; Total Net Profit folds it in alongside
              Invoice-PO gross margin. */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Revenue (invoiced)"
              value={USD.format(data.revenue?.invoiced || 0)}
              sublabel={`${USD.format(data.revenue?.paid || 0)} paid`}
            />
            <MetricCard
              label="Commission Revenue"
              value={USD.format(data.commissionRevenue?.accrued || 0)}
              sublabel={
                (data.commissionRevenue?.byBrand?.length || 0) > 0
                  ? `${data.commissionRevenue.byBrand.map(b => b.brandCode).join(' + ')} accrued (FW/HH agent model)`
                  : 'CommissionTracking accrued in period'
              }
              tone={(data.commissionRevenue?.accrued || 0) > 0 ? 'positive' : 'muted'}
            />
            <MetricCard
              label="Total Net Profit"
              value={USD.format(data.totalNetProfit ?? data.netProfit ?? 0)}
              sublabel="Gross + commission − unreimbursed exp − overhead"
              tone={(data.totalNetProfit ?? data.netProfit ?? 0) >= 0 ? 'positive' : 'negative'}
            />
            <MetricCard
              label="Direct Cost Ratio"
              value={data.directCostRatio != null ? `${(data.directCostRatio * 100).toFixed(1)}%` : '—'}
              sublabel="Direct expenses ÷ revenue"
              tone={data.directCostRatio != null && data.directCostRatio > 0.25 ? 'negative' : 'muted'}
            />
          </div>

          {/* Detail breakdown */}
          <div className="bg-white rounded-lg shadow p-6 border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-3">P&amp;L Breakdown</h3>
            <BreakdownRow label="Revenue (invoiced)" value={USD.format(data.revenue?.invoiced || 0)} />
            <BreakdownRow
              label="COGS (supplier purchase orders)"
              value={USD.format(data.cogs || 0)}
              sign="−"
            />
            <BreakdownRow
              label="Gross Profit"
              sublabel="Invoice − COGS (SH markup model)"
              value={USD.format(data.grossProfit || 0)}
              emphasis
            />
            {/* Phase 4.28h: commission revenue + reimbursements section.
                Shown unconditionally so the structure is consistent across
                SH-only (zeros) and FW/HH customers. */}
            <BreakdownRow
              label="Commission Revenue (FW/HH)"
              sublabel={
                (data.commissionRevenue?.count || 0) > 0
                  ? `${data.commissionRevenue.count} accrued ${data.commissionRevenue.count === 1 ? 'row' : 'rows'} on confirmed sales orders`
                  : 'No commission accrued in period'
              }
              value={USD.format(data.commissionRevenue?.accrued || 0)}
              sign="+"
            />
            <BreakdownRow
              label="Direct Expenses"
              sublabel={`${data.directExpenses?.count || 0} expense ${data.directExpenses?.count === 1 ? 'row' : 'rows'} tagged to this customer`}
              value={USD.format(data.directExpenses?.total || 0)}
              sign="−"
            />
            <BreakdownRow
              label="Reimbursements Received"
              sublabel={
                (data.reimbursementsReceived?.count || 0) > 0
                  ? `${data.reimbursementsReceived.count} expense ${data.reimbursementsReceived.count === 1 ? 'row' : 'rows'} reimbursed by factory (status=paid)`
                  : 'No reimbursements in period'
              }
              value={USD.format(data.reimbursementsReceived?.total || 0)}
              sign="+"
            />
            <BreakdownRow
              label="Allocated Overhead"
              sublabel={
                data.allocatedOverhead?.revenueShare != null
                  ? `${(data.allocatedOverhead.revenueShare * 100).toFixed(2)}% of ${USD.format(data.allocatedOverhead.overheadPool || 0)} pool`
                  : 'revenue-share basis'
              }
              value={USD.format(data.allocatedOverhead?.total || 0)}
              sign="−"
            />
            <BreakdownRow
              label="Net Commission Profit"
              sublabel="Commission − unreimbursed expenses (FW/HH agent P&L)"
              value={USD.format(data.netCommissionProfit ?? 0)}
            />
            <BreakdownRow
              label="Total Net Profit"
              sublabel="Blended: gross + commission − unreimbursed − overhead"
              value={USD.format(data.totalNetProfit ?? data.netProfit ?? 0)}
              emphasis
            />
          </div>

          {/* Footnotes */}
          <div className="text-xs text-slate-500 leading-relaxed space-y-1">
            <p>
              Period: {data.period?.from} to {data.period?.to}. All amounts in USD; expense rows
              without a USD-equivalent in a non-USD currency are excluded so totals don&apos;t mix
              currencies. Allocated overhead uses revenue-share allocation: unassigned expenses
              (no customer / no factory) are split across customers in proportion to each
              customer&apos;s share of period revenue.
            </p>
            <p>
              <strong>FW/HH agent model:</strong> the buyer-facing FOB on FlorWay (Malaysia) and
              HanHua (China) Resilient flooring deals already includes Sovern&apos;s 7% commission.
              Invoice − PO gross margin is therefore $0 on these brands by design; the real income
              lands in CommissionTracking (accrued at SalesOrder confirmation) and is shown above
              as &quot;Commission Revenue&quot;. Reimbursements close the loop on direct expenses the
              factory pays back via the Expenses module.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
