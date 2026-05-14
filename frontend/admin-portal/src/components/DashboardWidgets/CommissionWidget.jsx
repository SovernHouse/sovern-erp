/**
 * CommissionWidget — Phase 3, C11.
 *
 * Read-only summary of the current user's FW commission accrual for the
 * Asia/Taipei month-to-date period. Three tiles: Accrued / Paid / Pending.
 *
 * Reads from GET /api/personalization/commissions/summary?brandCode=FW&period=mtd
 * which the backend (commissionRoutes.js, C11) returns with the same shape
 * across desktop and mobile.
 *
 * Visibility rules:
 *   - Renders for any user with 'FW' in their accessibleBrands.
 *   - Hidden for users without FW access. (Super_admin sees the aggregate
 *     BrandRevenueComparison widget instead when viewMode='cross-brand'.)
 *
 * Uses formatDateTaipei from formatters.js (added in C11) for any time
 * strings rendered on the tile.
 */

import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useBrands } from '../../contexts/BrandsContext'
import api from '../../services/api'
import { formatDateTaipei } from '../../utils/formatters'

function fmtMoney(value, currency = 'USD') {
  if (value == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(Number(value))
}

export default function CommissionWidget() {
  const { accessibleBrands } = useBrands()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [savingId, setSavingId] = useState(null)

  const hasFw = accessibleBrands.includes('FW')

  const loadSummary = () => {
    if (!hasFw) return
    setLoading(true)
    api.get('/personalization/commissions/summary?brandCode=FW&period=mtd')
      .then((res) => setData(res.data?.data || res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSummary() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFw])

  // Per-order percentage edit. Pending rows only (backend enforces).
  // 'pending' is the default status for newly-accrued rows.
  const handlePercentageBlur = async (row, newPctStr) => {
    const newPct = parseFloat(newPctStr)
    if (!Number.isFinite(newPct) || newPct < 0 || newPct > 100) {
      toast.error('Percentage must be 0 to 100')
      return
    }
    if (newPct === parseFloat(row.percentage)) return  // no change
    setSavingId(row.id)
    try {
      await api.patch(`/personalization/commissions/${row.id}`, { percentage: newPct })
      toast.success(`Commission updated to ${newPct}%`)
      loadSummary()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update commission')
    } finally {
      setSavingId(null)
    }
  }

  if (!hasFw) return null

  const summary = data?.summary || { accrued: 0, paid: 0, pending: 0 }
  const currency = data?.currency || 'USD'

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      border: '1px solid #e2e8f0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            FlorWay Commission  ·  Month-to-date
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            5% default rate, adjustable per order
          </div>
        </div>
        {loading && <span style={{ fontSize: 11, color: '#94a3b8' }}>Loading…</span>}
      </div>

      {error ? (
        <div style={{ fontSize: 12, color: '#dc2626' }}>Commission summary unavailable: {error}</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <Tile label="Accrued"  value={fmtMoney(summary.accrued, currency)}  color="#1F2933" />
            <Tile label="Paid"     value={fmtMoney(summary.paid, currency)}     color="#16a34a" />
            <Tile label="Pending"  value={fmtMoney(summary.pending, currency)}  color="#92400E" />
          </div>

          {/* Phase 3, C11: expandable list of contributing orders with
              inline per-order percentage edit. Backend allows edits on
              pending rows by the owner; super_admin can edit any. */}
          {(data?.rows?.length || 0) > 0 && (
            <div style={{ marginTop: 14 }}>
              <button
                onClick={() => setExpanded((v) => !v)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 12,
                  color: '#1F2933',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {expanded ? 'Hide order details' : `Show ${data.rows.length} order${data.rows.length === 1 ? '' : 's'}`}
              </button>

              {expanded && (
                <table style={{ width: '100%', marginTop: 10, fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ textAlign: 'left',  padding: '6px 4px' }}>Order</th>
                      <th style={{ textAlign: 'left',  padding: '6px 4px' }}>Date</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px' }}>Order Total</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px' }}>Commission</th>
                      <th style={{ textAlign: 'left',  padding: '6px 4px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 4px', color: '#0E0D0C' }}>
                          {row.SalesOrder?.orderNumber || row.salesOrderId.slice(0, 8)}
                        </td>
                        <td style={{ padding: '8px 4px', color: '#64748b' }}>
                          {formatDateTaipei(row.SalesOrder?.createdAt || row.createdAt)}
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', color: '#0E0D0C' }}>
                          {fmtMoney(row.orderAmount, currency)}
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            defaultValue={parseFloat(row.percentage)}
                            disabled={row.status !== 'pending' || savingId === row.id}
                            onBlur={(e) => handlePercentageBlur(row, e.target.value)}
                            style={{
                              width: 56,
                              padding: '3px 6px',
                              border: '1px solid #cbd5e1',
                              borderRadius: 4,
                              fontSize: 12,
                              textAlign: 'right',
                              background: row.status !== 'pending' ? '#f8fafc' : 'white',
                            }}
                          />
                          <span style={{ marginLeft: 2, color: '#64748b' }}>%</span>
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: '#0E0D0C' }}>
                          {fmtMoney(row.amount, currency)}
                        </td>
                        <td style={{ padding: '8px 4px', color: '#64748b', textTransform: 'capitalize' }}>
                          {row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Tile({ label, value, color }) {
  return (
    <div style={{
      background: '#FAFAF7',
      borderRadius: 8,
      padding: '12px 14px',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0E0D0C' }}>{value}</div>
    </div>
  )
}
