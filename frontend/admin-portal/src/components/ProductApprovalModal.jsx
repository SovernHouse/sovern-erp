/**
 * ProductApprovalModal — Phase 4.17.
 *
 * Opens when a "Product" activity pill is clicked in the dashboard
 * banner. Shows full product detail (brand, category, factory, specs,
 * origins, prices, attached approval note) and exposes three actions:
 *
 *   Approve         → POST /api/products/:id/approve   (note optional)
 *   Reject          → POST /api/products/:id/reject    (reason required)
 *   Request Revision → POST /api/products/:id/request-revision (comment required)
 *
 * On any successful action the modal closes and signals the parent to
 * refresh the activity list — closing the chip on the dashboard banner.
 *
 * Read-only data is fetched on mount; the modal does NOT block on
 * fetch errors — partial info is still usable for the approve path.
 */

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Slash, MessageSquare, Loader2 } from 'lucide-react'
import api from '../services/api'

const INK    = '#0E0D0C'
const CREAM  = '#F1EEE7'
const FOREST = '#1D5A32'
const RED    = '#A93226'
const AMBER  = '#A04000'

export default function ProductApprovalModal({ productId, activity, onClose }) {
  const [product, setProduct]   = useState(null)
  const [prices, setPrices]     = useState([])
  const [specs, setSpecs]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [comment, setComment]   = useState('')
  const [busy, setBusy]         = useState(null)  // 'approve' | 'reject' | 'revise'
  const [actionError, setActionError] = useState(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    ;(async () => {
      try {
        const [prodRes, priceRes, specRes] = await Promise.allSettled([
          api.get(`/products/${productId}`),
          api.get(`/products/${productId}/prices/history`).catch(() => api.get(`/products/${productId}/prices`)),
          api.get(`/product-specifications`, { params: { product_id: productId, limit: 1 } }).catch(() => null),
        ])
        if (cancelled) return
        if (prodRes.status === 'fulfilled') {
          setProduct(prodRes.value.data?.data || prodRes.value.data)
        } else {
          setLoadError('Failed to load product details — actions still available')
        }
        if (priceRes.status === 'fulfilled') {
          const body = priceRes.value.data?.data || priceRes.value.data
          setPrices(Array.isArray(body) ? body : (Array.isArray(body?.prices) ? body.prices : []))
        }
        if (specRes.status === 'fulfilled' && specRes.value) {
          const body = specRes.value.data?.data || specRes.value.data
          const row = Array.isArray(body) ? body[0] : (Array.isArray(body?.specifications) ? body.specifications[0] : null)
          setSpecs(row || null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [productId])

  async function doAction(kind) {
    setActionError(null)
    const trimmed = comment.trim()
    if (kind !== 'approve' && !trimmed) {
      setActionError(kind === 'reject'
        ? 'A reason is required when rejecting a product.'
        : 'A comment is required when requesting a revision.')
      textareaRef.current?.focus()
      return
    }
    setBusy(kind)
    try {
      if (kind === 'approve') {
        await api.post(`/products/${productId}/approve`, trimmed ? { note: trimmed } : {})
      } else if (kind === 'reject') {
        await api.post(`/products/${productId}/reject`, { reason: trimmed })
      } else if (kind === 'revise') {
        await api.post(`/products/${productId}/request-revision`, { comment: trimmed })
      }
      // Caller closes + refreshes the banner list.
      onClose(true)
    } catch (err) {
      setActionError(err.response?.data?.error || err.response?.data?.message || err.message || 'Action failed')
      setBusy(null)
    }
  }

  function row(label, value) {
    if (value === undefined || value === null || value === '') return null
    return (
      <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: `1px solid ${INK}10` }}>
        <div style={{ flex: '0 0 160px', color: INK + '99', fontSize: 13 }}>{label}</div>
        <div style={{ flex: 1, color: INK, fontSize: 13, wordBreak: 'break-word' }}>{value}</div>
      </div>
    )
  }

  const overlay = (
    <div
      onClick={() => !busy && onClose(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(14,13,12,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: CREAM, color: INK,
          width: 'min(720px, 100%)', maxHeight: '90vh',
          borderRadius: 12, boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${INK}1A`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: INK + '99' }}>
              Product approval
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              {product?.name || activity?.entityLabel || 'Loading…'}
            </div>
            {product?.sku && (
              <div style={{ fontSize: 12, color: INK + '99', marginTop: 2 }}>SKU: {product.sku}</div>
            )}
          </div>
          <button
            onClick={() => !busy && onClose(false)}
            disabled={!!busy}
            style={{
              background: 'transparent', border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
              color: INK + '99', padding: 4,
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 20px', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: INK + '99', padding: '20px 0' }}>
              <Loader2 size={16} className="spin" /> Loading product details…
            </div>
          )}

          {loadError && !loading && (
            <div style={{ background: '#FFF5F4', border: `1px solid ${RED}30`, color: RED, padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
              {loadError}
            </div>
          )}

          {!loading && product && (
            <>
              {row('Brand',           product.brandCode)}
              {row('Category',        product.category?.name || product.categoryId)}
              {row('Factory',         product.factory?.companyName || product.factoryId)}
              {row('Type',            product.productType || product.specifications?.productTypeLabel)}
              {row('Active?',         product.isActive ? 'Yes (already live)' : 'No (pending)')}
              {row('Unit',            product.unit)}
              {row('Currency',        product.currency)}
              {row('Base FOB price',  product.baseFobPrice && `${product.baseFobPrice} ${product.currency || 'USD'} / ${product.unit || 'unit'}`)}
              {row('Lead time (days)', product.leadTimeDays)}
              {row('Origin country',  product.originCountry)}
              {Array.isArray(product.originVariants) && product.originVariants.length > 0 && (
                row('Origin variants', `${product.originVariants.length}: ${product.originVariants.map(v => v.origin || '?').join(', ')}`)
              )}
              {row('HS code',         product.hsCode)}
              {row('Weight (kg)',     product.weight)}
              {row('Cubic meters',    product.cubicMeters)}
              {row('Min order qty',   product.minOrderQty)}

              {product.description && row('Description', (
                <div style={{ whiteSpace: 'pre-wrap' }}>{product.description}</div>
              ))}

              {product.specifications && Object.keys(product.specifications).length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: INK + '99', marginBottom: 6 }}>
                    Specifications
                  </div>
                  <pre style={{
                    background: '#FFF', border: `1px solid ${INK}10`, padding: 10,
                    borderRadius: 6, fontSize: 11, color: INK,
                    maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap',
                  }}>
                    {JSON.stringify(product.specifications, null, 2)}
                  </pre>
                </div>
              )}

              {prices.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: INK + '99', marginBottom: 6 }}>
                    Prices ({prices.length})
                  </div>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: INK + '08' }}>
                        <th style={{ textAlign: 'left', padding: '4px 6px' }}>Origin / Factory</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px' }}>Cost USD/m²</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px' }}>Selling USD/m²</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px' }}>Valid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prices.slice(0, 8).map(p => (
                        <tr key={p.id} style={{ borderTop: `1px solid ${INK}10` }}>
                          <td style={{ padding: '4px 6px' }}>{p.origin || p.factoryId?.slice(0,8) || '—'}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right' }}>{p.costPriceUsdPerM2 != null ? Number(p.costPriceUsdPerM2).toFixed(3) : '—'}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right' }}>{p.sellingPriceUsdPerM2 != null ? Number(p.sellingPriceUsdPerM2).toFixed(3) : '—'}</td>
                          <td style={{ padding: '4px 6px' }}>{(p.validFrom||'').slice(0,10)} → {(p.validTo||'').slice(0,10) || 'open'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activity?.note && (
                <div style={{ marginTop: 14, background: '#FFF', border: `1px solid ${INK}10`, padding: 10, borderRadius: 6 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: INK + '99', marginBottom: 4 }}>
                    Approval task note
                  </div>
                  <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: INK }}>{activity.note}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Comment + actions */}
        <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${INK}1A`, background: '#FFF' }}>
          <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: INK + '99' }}>
            Comment <span style={{ textTransform: 'none', fontSize: 11, color: INK + '66' }}>(required for reject / revision)</span>
          </label>
          <textarea
            ref={textareaRef}
            value={comment}
            onChange={e => setComment(e.target.value)}
            disabled={!!busy}
            rows={3}
            placeholder="Why reject? What needs to change?"
            style={{
              width: '100%', marginTop: 4, padding: 8, borderRadius: 6,
              border: `1px solid ${INK}30`, fontSize: 13, fontFamily: 'inherit',
              background: busy ? INK + '08' : '#FFF', resize: 'vertical',
            }}
          />
          {actionError && (
            <div style={{ marginTop: 6, fontSize: 12, color: RED }}>{actionError}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => doAction('reject')}
              disabled={!!busy}
              style={{
                padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: '#FFF', color: RED, border: `1px solid ${RED}80`,
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {busy === 'reject' ? <Loader2 size={14} className="spin" /> : <Slash size={14} />}
              Reject
            </button>
            <button
              onClick={() => doAction('revise')}
              disabled={!!busy}
              style={{
                padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: '#FFF', color: AMBER, border: `1px solid ${AMBER}80`,
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {busy === 'revise' ? <Loader2 size={14} className="spin" /> : <MessageSquare size={14} />}
              Request revision
            </button>
            <button
              onClick={() => doAction('approve')}
              disabled={!!busy}
              style={{
                padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: FOREST, color: CREAM, border: 'none',
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {busy === 'approve' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              Approve
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spinKf { 100% { transform: rotate(360deg); } }
        .spin { animation: spinKf 0.9s linear infinite; }
      `}</style>
    </div>
  )

  return createPortal(overlay, document.body)
}
