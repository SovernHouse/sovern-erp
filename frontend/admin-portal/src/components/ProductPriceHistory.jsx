// ─── ProductPriceHistory — Phase 4.9.2c ──────────────────────────────────
//
// Inline panel for the ProductForm. Lists every ProductPrice row tied
// to the product, with status pill (active / expired / future), and
// an "Add new price" inline editor for creating new temporal entries.
//
// The form only shows when editing an existing product — new products
// don't have a productId yet, so price rows can't attach. The MCP
// tools (erp_create_product_price etc.) handle programmatic creation
// either way.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { productsAPI } from '../services/api'

function todayISO() { return new Date().toISOString().slice(0, 10) }

function statusOf(row) {
  const t = todayISO()
  if (row.validFrom > t) return 'future'
  if (row.validTo && row.validTo < t) return 'expired'
  return 'active'
}

const STATUS_STYLE = {
  active:  { bg: '#DCFCE7', fg: '#166534', label: 'Active' },
  future:  { bg: '#DBEAFE', fg: '#1E40AF', label: 'Future' },
  expired: { bg: '#F1F5F9', fg: '#475569', label: 'Expired' },
}

export default function ProductPriceHistory({ productId, factories = [] }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await productsAPI.getPriceHistory(productId)
      const arr = Array.isArray(res.data) ? res.data : []
      // Newest active first; then future; then expired by validFrom DESC
      arr.sort((a, b) => {
        const order = { active: 0, future: 1, expired: 2 }
        const sa = order[statusOf(a)]
        const sb = order[statusOf(b)]
        if (sa !== sb) return sa - sb
        return (b.validFrom || '').localeCompare(a.validFrom || '')
      })
      setRows(arr)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load price history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (productId) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const startCreate = () => {
    setDraft({
      origin: '',
      factoryId: '',
      costPriceUsdPerM2: '',
      sellingPriceUsdPerM2: '',
      markupPercent: '',
      tariffRate: '',
      tariffDestination: '',
      validFrom: todayISO(),
      validTo: '',
      sourceNote: '',
    })
  }

  const cancelDraft = () => setDraft(null)

  const saveDraft = async () => {
    if (!draft.factoryId && !draft.origin) {
      toast.error('At least one of factoryId or origin is required')
      return
    }
    if (!draft.costPriceUsdPerM2) {
      toast.error('costPriceUsdPerM2 is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...draft,
        factoryId: draft.factoryId || null,
        origin: draft.origin || null,
        costPriceUsdPerM2: parseFloat(draft.costPriceUsdPerM2),
        sellingPriceUsdPerM2: draft.sellingPriceUsdPerM2 === '' ? null : parseFloat(draft.sellingPriceUsdPerM2),
        markupPercent: draft.markupPercent === '' ? null : parseFloat(draft.markupPercent),
        tariffRate: draft.tariffRate === '' ? null : parseFloat(draft.tariffRate),
        tariffDestination: draft.tariffDestination || null,
        validTo: draft.validTo || null,
        sourceNote: draft.sourceNote || null,
      }
      await productsAPI.createPrice(productId, payload)
      toast.success('Price added')
      setDraft(null)
      await refresh()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save price')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (priceId) => {
    if (!confirm('Delete this price row? This is a hard delete; use validTo to set an end date instead if you want history.')) return
    try {
      await productsAPI.deletePrice(productId, priceId)
      toast.success('Price deleted')
      await refresh()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  if (!productId) return null

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Price history (Phase 4.9.2)</h3>
          <p className="text-xs text-slate-500 mt-1">
            Temporal pricing rows. Each row pins a cost + selling combo to a (factory or origin) and a validity window. The quotation floor reads the current active row via getCurrentPrice. Product.baseFobPrice is a denormalized cache of the current active selling price; do not edit it manually.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          disabled={!!draft}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 flex-shrink-0 inline-flex items-center gap-1"
        >
          <Plus size={12} /> Add price
        </button>
      </div>

      {draft && (
        <div className="bg-emerald-50/40 border border-emerald-200 rounded p-3 space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-3">
              <label className="block text-xs text-slate-600 mb-1">Origin</label>
              <input value={draft.origin} onChange={e => setDraft({ ...draft, origin: e.target.value })} placeholder="China" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div className="col-span-3">
              <label className="block text-xs text-slate-600 mb-1">Factory</label>
              <select value={draft.factoryId} onChange={e => setDraft({ ...draft, factoryId: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white">
                <option value="">—</option>
                {factories.map(f => <option key={f.id} value={f.id}>{f.companyName}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Cost USD/m²</label>
              <input type="number" step="0.0001" value={draft.costPriceUsdPerM2} onChange={e => setDraft({ ...draft, costPriceUsdPerM2: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Sell USD/m²</label>
              <input type="number" step="0.0001" value={draft.sellingPriceUsdPerM2} onChange={e => setDraft({ ...draft, sellingPriceUsdPerM2: e.target.value })} placeholder="auto" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Markup (dec)</label>
              <input type="number" step="0.0001" value={draft.markupPercent} onChange={e => setDraft({ ...draft, markupPercent: e.target.value })} placeholder="0.07" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Tariff (dec)</label>
              <input type="number" step="0.0001" value={draft.tariffRate} onChange={e => setDraft({ ...draft, tariffRate: e.target.value })} placeholder="0.407714" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Tariff dest</label>
              <input value={draft.tariffDestination} onChange={e => setDraft({ ...draft, tariffDestination: e.target.value.toUpperCase() })} placeholder="US" maxLength={2} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono uppercase" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Valid from</label>
              <input type="date" value={draft.validFrom} onChange={e => setDraft({ ...draft, validFrom: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Valid to</label>
              <input type="date" value={draft.validTo} onChange={e => setDraft({ ...draft, validTo: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div className="col-span-4">
              <label className="block text-xs text-slate-600 mb-1">Source note</label>
              <input value={draft.sourceNote} onChange={e => setDraft({ ...draft, sourceNote: e.target.value })} placeholder="e.g. HanHua factory quotation 2026-05-14" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={cancelDraft} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
            <button type="button" onClick={saveDraft} disabled={saving} className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save price'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400 italic py-2">Loading price history…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-2">No prices yet. Add one above to seed the floor for quotations.</p>
      ) : (
        <div className="space-y-1">
          {rows.map(r => {
            const st = STATUS_STYLE[statusOf(r)]
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded p-2 grid grid-cols-12 gap-2 items-center text-xs">
                <span className="col-span-1" style={{ background: st.bg, color: st.fg, padding: '2px 6px', borderRadius: 999, fontWeight: 600, textAlign: 'center' }}>{st.label}</span>
                <span className="col-span-2 font-mono">{r.origin || '—'}{r.factory?.companyName ? ` · ${r.factory.companyName}` : ''}</span>
                <span className="col-span-2 font-mono">{Number(r.costPriceUsdPerM2).toFixed(4)} / m²</span>
                <span className="col-span-2 font-mono text-emerald-700">
                  {r.sellingPriceUsdPerM2 != null
                    ? `${Number(r.sellingPriceUsdPerM2).toFixed(4)} / m²`
                    : (r.markupPercent != null
                        ? `+${(Number(r.markupPercent) * 100).toFixed(2)}%`
                        : '=cost')}
                </span>
                <span className="col-span-1 font-mono">{r.tariffRate != null ? `${(Number(r.tariffRate) * 100).toFixed(2)}%${r.tariffDestination ? ` ${r.tariffDestination}` : ''}` : '—'}</span>
                <span className="col-span-2 text-slate-500">{r.validFrom} → {r.validTo || '—'}</span>
                <span className="col-span-1 text-slate-400 truncate" title={r.sourceNote || ''}>{r.sourceNote || '—'}</span>
                <span className="col-span-1 text-right">
                  <button type="button" onClick={() => handleDelete(r.id)} className="p-1 hover:bg-red-50 rounded" title="Delete this row"><Trash2 size={12} className="text-red-600" /></button>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
