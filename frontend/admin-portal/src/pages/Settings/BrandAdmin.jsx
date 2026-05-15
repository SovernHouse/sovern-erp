import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { brandsAPI } from '../../services/api'
import BrandBadge from '../../components/BrandBadge'
import { Save, X, ChevronDown, ChevronUp } from 'lucide-react'

function BrandCard({ brand: initialBrand, onSaved }) {
  const [expanded, setExpanded] = useState(false)
  const [brand, setBrand] = useState(initialBrand)
  const [form, setForm] = useState({ ...initialBrand })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await brandsAPI.update(brand.code, form)
      const updated = res.data?.data || res.data
      setBrand(updated)
      setForm({ ...updated })
      setDirty(false)
      onSaved?.(updated)
      toast.success(`${updated.displayName} saved`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setForm({ ...brand })
    setDirty(false)
    setExpanded(false)
  }

  return (
    <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
      <div
        className="flex items-center justify-between p-5 cursor-pointer select-none hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: brand.primaryColor }} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 text-sm">{brand.displayName}</span>
              <BrandBadge code={brand.code} size="sm" />
              {!brand.active && <span className="text-xs text-red-500 font-medium">Inactive</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{brand.senderEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
          {expanded
            ? <ChevronUp size={16} className="text-slate-400" />
            : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Display Name</label>
              <input
                type="text"
                value={form.displayName || ''}
                onChange={e => handleChange('displayName', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Sender Email</label>
              <input
                type="email"
                value={form.senderEmail || ''}
                onChange={e => handleChange('senderEmail', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor || '#000000'}
                  onChange={e => handleChange('primaryColor', e.target.value)}
                  className="w-10 h-9 rounded cursor-pointer p-0.5 border border-slate-300"
                />
                <input
                  type="text"
                  value={form.primaryColor || ''}
                  onChange={e => handleChange('primaryColor', e.target.value)}
                  maxLength={7}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accentColor || '#000000'}
                  onChange={e => handleChange('accentColor', e.target.value)}
                  className="w-10 h-9 rounded cursor-pointer p-0.5 border border-slate-300"
                />
                <input
                  type="text"
                  value={form.accentColor || ''}
                  onChange={e => handleChange('accentColor', e.target.value)}
                  maxLength={7}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Logo URL</label>
              <input
                type="text"
                value={form.logoUrl || ''}
                onChange={e => handleChange('logoUrl', e.target.value)}
                placeholder="https://..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Signature HTML</label>
            <p className="text-xs text-slate-400 mb-1.5">Used in outreach and quotation emails. Leave blank to use the system default for this brand.</p>
            <textarea
              value={form.signatureHtml || ''}
              onChange={e => handleChange('signatureHtml', e.target.value)}
              rows={7}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={'<div style="margin-top:36px;">...</div>'}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Signature Text (plain-text emails)</label>
            <textarea
              value={form.signatureText || ''}
              onChange={e => handleChange('signatureText', e.target.value)}
              rows={4}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={'--\nName\nTitle | Brand\nemail@example.com'}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Footer Legal Text</label>
            <p className="text-xs text-slate-400 mb-1.5">Appears at the bottom of outbound documents (quotations, PIs, invoices).</p>
            <textarea
              value={form.footerLegalText || ''}
              onChange={e => handleChange('footerLegalText', e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brand is a trading division of COMPANY NAME, Address."
            />
          </div>

          {/* Phase 4.9.1: commissionRate + active editors. Both are super-
              admin gated server-side. commissionRate is the brand-level
              decimal used by the commission accrual flow on sales-order
              confirmation. active=false hides a brand row from quotation
              pickers without deleting historical data. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Commission rate</label>
              <p className="text-xs text-slate-400 mb-1.5">Decimal between 0 and 1. 0.07 = 7%. Used at sales-order confirmation.</p>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="1"
                value={form.commissionRate ?? ''}
                onChange={e => handleChange('commissionRate', e.target.value === '' ? null : parseFloat(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {typeof form.commissionRate === 'number' && Number.isFinite(form.commissionRate) && (
                <p className="text-xs text-slate-500 mt-1">= {(form.commissionRate * 100).toFixed(2)}%</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <p className="text-xs text-slate-400 mb-1.5">Inactive brands stay in history but disappear from quotation + product pickers.</p>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={form.active !== false}
                  onChange={e => handleChange('active', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className={`text-sm font-medium ${form.active === false ? 'text-red-600' : 'text-emerald-700'}`}>
                  {form.active === false ? 'Inactive (hidden from pickers)' : 'Active'}
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <X size={14} />
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BrandAdmin() {
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    brandsAPI.list()
      .then(res => setBrands(res.data?.data || res.data || []))
      .catch(err => setError(err.response?.data?.error || 'Failed to load brands'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Brands</h1>
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Brands</h1>
        <p className="text-slate-600 mt-1 text-sm">Manage sender identity, colors, signatures, and legal copy per brand. Changes take effect on the next send.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      <div className="space-y-4 max-w-3xl">
        {brands.map(brand => (
          <BrandCard
            key={brand.code}
            brand={brand}
            onSaved={updated => setBrands(prev => prev.map(b => b.code === updated.code ? updated : b))}
          />
        ))}
        {brands.length === 0 && !error && (
          <p className="text-slate-500 text-sm">No brands configured.</p>
        )}
      </div>
    </div>
  )
}
