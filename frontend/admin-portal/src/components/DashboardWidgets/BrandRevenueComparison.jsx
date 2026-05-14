/**
 * BrandRevenueComparison — Phase 3, C11.
 *
 * Super_admin "All Brands" widget. Shows SH vs FW revenue + commission +
 * order count side by side for the current Asia/Taipei MTD period.
 * Reads from GET /api/personalization/commissions/brand-comparison.
 *
 * Render guards:
 *   - Only renders when the user is super_admin AND in cross-brand viewMode.
 *   - Hidden for single-brand and standard multi-brand users.
 *
 * Recharts is already in the admin bundle; the bar chart uses brand
 * primaryColor as the fill so SH (forest) and FW (iron-deep) read as
 * themselves.
 */

import React, { useEffect, useState } from 'react'
import { useBrands } from '../../contexts/BrandsContext'
import api from '../../services/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'

function fmtMoney(value) {
  if (value == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(Number(value))
}

export default function BrandRevenueComparison() {
  const { isCrossBrand } = useBrands()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isCrossBrand) return
    let cancelled = false
    setLoading(true)
    api.get('/personalization/commissions/brand-comparison')
      .then((res) => {
        if (!cancelled) setData(res.data?.data || res.data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || err.message)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [isCrossBrand])

  if (!isCrossBrand) return null

  const brands = data?.brands || []
  const totalRevenue = brands.reduce((sum, b) => sum + (b.revenue || 0), 0)
  const totalCommission = brands.reduce((sum, b) => sum + (b.commission || 0), 0)
  const totalOrders = brands.reduce((sum, b) => sum + (b.orderCount || 0), 0)

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      border: '1px solid #e2e8f0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            All Brands  ·  Month-to-date
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            Combined view (super-admin, read-only)
          </div>
        </div>
        {loading && <span style={{ fontSize: 11, color: '#94a3b8' }}>Loading…</span>}
      </div>

      {error ? (
        <div style={{ fontSize: 12, color: '#dc2626' }}>Comparison unavailable: {error}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <Summary label="Combined Revenue" value={fmtMoney(totalRevenue)} />
            <Summary label="Combined Commission" value={fmtMoney(totalCommission)} />
            <Summary label="Total Orders" value={String(totalOrders)} />
          </div>

          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brands} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <XAxis dataKey="displayName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtMoney(v).replace('$', '$')} />
                <Tooltip
                  formatter={(value) => fmtMoney(value)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue"    name="Revenue"    radius={[4, 4, 0, 0]}>
                  {brands.map((b, i) => (
                    <Cell key={i} fill={b.primaryColor || '#64748b'} />
                  ))}
                </Bar>
                <Bar dataKey="commission" name="Commission" radius={[4, 4, 0, 0]} fill="#92400E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

function Summary({ label, value }) {
  return (
    <div style={{
      background: '#FAFAF7',
      borderRadius: 8,
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0E0D0C' }}>{value}</div>
    </div>
  )
}
