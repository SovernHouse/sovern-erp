/**
 * ProductCatalog — Phase 4, C14.
 *
 * Admin page at /settings/products. Manages the brand-aware catalog
 * that quotations pick from. Brand filter at top (single-brand users
 * see only their brand). Create / edit / deactivate flows.
 *
 * baseFobPrice is the floor — quotations default to this and editing
 * upward is free; editing below floor on the quotation form requires
 * super-admin + reason (enforced server-side).
 *
 * NO-MARKUP INVARIANT: the price shown here IS the buyer-facing price.
 * Alex's commission is already baked into the factory's quoted FOB and
 * is tracked separately in CommissionTracking. Nothing on this page or
 * the quotation it feeds adds a percentage on top.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Edit2, Power } from 'lucide-react'
import { productsAPI, factoriesAPI } from '../../services/api'
import api from '../../services/api'
import BrandFilterPicker from '../../components/BrandFilterPicker'
import BrandPicker from '../../components/BrandPicker'
import BrandBadge from '../../components/BrandBadge'
import ProductPriceHistory from '../../components/ProductPriceHistory'
import LoadingSpinner from '../../components/LoadingSpinner'
import FactoryQuickCreate from '../../components/FactoryQuickCreate'
import { formatCurrency } from '../../utils/formatters'
import { useAuth } from '../../hooks/useAuth'
import { filterByFlooring, useShowAllCategories, FLOORING_PRODUCT_TYPES } from '../../utils/productCategoryFilter'

const PRODUCT_TYPES = [
  { value: 'lvt', label: 'LVT' },
  { value: 'spc', label: 'SPC' },
  { value: 'engineered_spc', label: 'Engineered SPC' },
  { value: 'wpc', label: 'WPC' },
  { value: 'hardwood', label: 'Hardwood' },
  { value: 'laminate', label: 'Laminate' },
  { value: 'tile', label: 'Tile' },
  { value: 'ceramic', label: 'Ceramic' },
  { value: 'other', label: 'Other' },
]

const MOQ_UNITS = ['sqm', 'sqft', 'box', 'pallet', 'roll', 'piece', 'container']

export default function ProductCatalog() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isSuperAdmin = user?.role === 'super_admin'
  // Phase 4.20: super_admin opens the catalog with all accessible brands aggregated
  // by default. Picker still lets them narrow to SH or FW individually. This avoids
  // the trap where IronLite (FW) was hidden because defaultBrand=SH pre-selected
  // a single-brand filter.
  const [brandFilter, setBrandFilter] = useState(isSuperAdmin ? 'all' : null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [factories, setFactories] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  // Phase 4.5, C21: flooring-only filter is the default. Super-admin can
  // flip on "Show all categories" to surface non-flooring rows that exist
  // in schema (auto parts, garments, services). Persists per-browser.
  const [showAllCategories, setShowAllCategories] = useShowAllCategories()
  const visibleProducts = filterByFlooring(products, showAllCategories)

  const load = async () => {
    setLoading(true)
    try {
      const params = brandFilter && brandFilter !== 'all' ? { brandCode: brandFilter, limit: 100 } : { limit: 100 }
      const res = await productsAPI.getAll(params)
      setProducts(Array.isArray(res.data) ? res.data : (res.data?.data || []))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandFilter])

  useEffect(() => {
    api.get('/products/categories/flat').then(r => setCategories(Array.isArray(r.data) ? r.data : (r.data?.data || []))).catch(() => {})
    factoriesAPI.getAll({ limit: 200 }).then(r => setFactories(Array.isArray(r.data) ? r.data : (r.data?.data || []))).catch(() => {})
  }, [])

  const handleDeactivate = async (product) => {
    if (!confirm(`Deactivate ${product.sku}? Buyers can't pick it on new quotations until reactivated.`)) return
    try {
      await productsAPI.update(product.id, { isActive: !product.isActive })
      toast.success(product.isActive ? 'Deactivated' : 'Reactivated')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Toggle failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product catalog</h1>
          <p className="text-sm text-slate-500 mt-1">
            Brand-aware list of products quotations pick from. Base FOB price is the floor; below floor requires super-admin override.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={showAllCategories}
                onChange={(e) => setShowAllCategories(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span>Show all categories</span>
            </label>
          )}
          <BrandFilterPicker value={brandFilter} onChange={setBrandFilter} />
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> New Product
          </button>
        </div>
      </div>

      {!showAllCategories && (
        <div className="text-xs text-slate-500">
          Showing flooring only ({FLOORING_PRODUCT_TYPES.join(', ')}). Toggle <em>Show all categories</em> to see auto parts, garments, services, and other lines.
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading catalog…" />
        ) : visibleProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {products.length === 0
              ? <>No products yet. Click <strong>New Product</strong> to add one.</>
              : <>No flooring products in this brand. {isSuperAdmin && <>Toggle <em>Show all categories</em> to see hidden lines.</>}</>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">SKU</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Brand</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Floor price</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">MOQ</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Lead</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Active</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700"> </th>
              </tr>
            </thead>
            <tbody>
              {/* Phase 4.23 — Odoo row click → navigate to ProductDetail.
                  Edit pencil opens the inline edit modal (in-context tweaks);
                  the row body itself opens the full detail view with chatter,
                  smart buttons, related-data tabs. */}
              {visibleProducts.map(p => (
                <tr
                  key={p.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${!p.isActive ? 'opacity-60' : ''}`}
                  onClick={() => navigate(`/products/${p.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.sku}</td>
                  <td className="px-4 py-3 text-slate-900">{p.name}</td>
                  <td className="px-4 py-3"><BrandBadge code={p.brandCode || 'SH'} size="sm" /></td>
                  <td className="px-4 py-3 text-slate-700">{p.productType || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-900">
                    {p.baseFobPrice != null ? formatCurrency(p.baseFobPrice, p.currency || 'USD') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {p.minOrderQty != null ? `${p.minOrderQty} ${p.moqUnit || p.unit || ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{p.leadTimeDays ? `${p.leadTimeDays}d` : '—'}</td>
                  <td className="px-4 py-3 text-center">{p.isActive ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex gap-2">
                      <button onClick={() => { setEditing(p); setShowForm(true) }} className="p-1.5 hover:bg-slate-200 rounded">
                        <Edit2 className="w-4 h-4 text-slate-600" />
                      </button>
                      <button onClick={() => handleDeactivate(p)} className="p-1.5 hover:bg-slate-200 rounded">
                        <Power className={`w-4 h-4 ${p.isActive ? 'text-slate-600' : 'text-amber-600'}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <ProductForm
          editing={editing}
          categories={categories}
          factories={factories}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function ProductForm({ editing, categories, factories, onClose, onSaved }) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const isEdit = !!editing
  const [saving, setSaving] = useState(false)
  // Phase 4.20 (Bug 4a): brand changes on existing products route through
  // the audited /admin/brand-override flow rather than a silent patch. The
  // disabled BrandPicker stays for visual reference; "Change brand" opens
  // the override modal.
  const [showBrandOverride, setShowBrandOverride] = useState(false)
  // Phase 4.22 — Odoo quick-create. localFactories starts from the parent
  // prop and grows when the user creates a new factory inline. The parent's
  // factories prop refresh is not required for the local form to function.
  const [localFactories, setLocalFactories] = useState(factories)
  const [showFactoryQuickCreate, setShowFactoryQuickCreate] = useState(false)
  const [form, setForm] = useState({
    brandCode: editing?.brandCode || '',
    sku: editing?.sku || '',
    name: editing?.name || '',
    productType: editing?.productType || '',
    description: editing?.description || '',
    salesDescription: editing?.salesDescription || '',
    categoryId: editing?.categoryId || '',
    factoryId: editing?.factoryId || '',
    baseFobPrice: editing?.baseFobPrice ?? '',
    currency: editing?.currency || 'USD',
    minOrderQty: editing?.minOrderQty ?? 1,
    moqUnit: editing?.moqUnit || 'sqm',
    leadTimeDays: editing?.leadTimeDays ?? '',
    originCountry: editing?.originCountry || '',
    // Phase 4.9 C-1: multi-origin pricing array. Each entry =
    //   { originCountry, fobPriceUsd, priceUnit, moqOverride?, leadTimeOverride? }
    // Empty array == backwards-compat (quotation builder reads from
    // baseFobPrice + originCountry above). One entry == single-origin.
    // Multi-entry == multi-origin pricing.
    originVariants: Array.isArray(editing?.originVariants) ? editing.originVariants : [],
  })

  // Phase 4.9 C-1: variant editor helpers
  const addVariant = () => setForm((prev) => ({
    ...prev,
    originVariants: [...prev.originVariants, { originCountry: '', fobPriceUsd: '', priceUnit: 'sqm' }],
  }))
  const removeVariant = (idx) => setForm((prev) => ({
    ...prev,
    originVariants: prev.originVariants.filter((_, i) => i !== idx),
  }))
  const updateVariant = (idx, patch) => setForm((prev) => {
    const next = [...prev.originVariants]
    next[idx] = { ...next[idx], ...patch }
    return { ...prev, originVariants: next }
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.sku || !form.categoryId || !form.factoryId) {
      toast.error('Name, SKU, category, and factory are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        baseFobPrice: form.baseFobPrice === '' ? null : Number(form.baseFobPrice),
        leadTimeDays: form.leadTimeDays === '' ? null : Number(form.leadTimeDays),
        minOrderQty: form.minOrderQty === '' ? null : Number(form.minOrderQty),
        // Phase 4.9 C-1: normalize variant numbers + drop incomplete rows.
        // A variant without originCountry OR fobPriceUsd is treated as a
        // user-abandoned row and silently dropped.
        originVariants: (form.originVariants || [])
          .filter((v) => v.originCountry && v.fobPriceUsd !== '' && v.fobPriceUsd != null)
          .map((v) => ({
            originCountry: String(v.originCountry).toUpperCase().slice(0, 2),
            fobPriceUsd: Number(v.fobPriceUsd),
            priceUnit: v.priceUnit || 'sqm',
            ...(v.moqOverride != null && v.moqOverride !== '' ? { moqOverride: Number(v.moqOverride) } : {}),
            ...(v.leadTimeOverride != null && v.leadTimeOverride !== '' ? { leadTimeOverride: Number(v.leadTimeOverride) } : {}),
          })),
      }
      if (isEdit) {
        // brandCode is immutable on update; the BrandPicker is disabled.
        delete payload.brandCode
        await productsAPI.update(editing.id, payload)
        toast.success('Product updated')
      } else {
        await productsAPI.create(payload)
        toast.success('Product created')
      }
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  // Phase 4.20 (Bug 4b): on category change for a NEW product, pre-fill
  // brandCode from category.defaultBrand if present and the user hasn't
  // already picked a brand. Resilient subtree (LVT, SPC, Engineered SPC,
  // WPC, Vinyl Sheet) and Resilient itself default to FW per the
  // migrate420ProductCategoryDefaultBrand seed. Editing an existing
  // product leaves brandCode locked (handled by the brand-override flow).
  const handleCategoryChange = (e) => {
    const nextId = e.target.value
    setForm(prev => {
      const next = { ...prev, categoryId: nextId }
      if (!isEdit && nextId) {
        const picked = categories.find(c => c.id === nextId)
        if (picked?.defaultBrand && !prev.brandCode) {
          next.brandCode = picked.defaultBrand
        }
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            {isEdit ? `Edit ${editing.sku}` : 'New product'}
          </h2>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <BrandPicker
                value={form.brandCode}
                onChange={(v) => setForm(prev => ({ ...prev, brandCode: v }))}
                disabled={isEdit}
              />
            </div>
            {isEdit && isSuperAdmin && (
              <button
                type="button"
                onClick={() => setShowBrandOverride(true)}
                className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                title="Change this product's brand. Requires reason; audit-logged."
              >
                Change brand…
              </button>
            )}
          </div>

          {showBrandOverride && (
            <BrandOverrideModal
              productId={editing.id}
              currentBrandCode={form.brandCode}
              onClose={() => setShowBrandOverride(false)}
              onSaved={(newBrandCode) => {
                setForm(prev => ({ ...prev, brandCode: newBrandCode }))
                setShowBrandOverride(false)
                onSaved()
              }}
            />
          )}

          {/* Phase 4.22 — quick-create supplier from inside the product form. */}
          <FactoryQuickCreate
            open={showFactoryQuickCreate}
            defaultBrandCode={form.brandCode}
            onClose={() => setShowFactoryQuickCreate(false)}
            onCreated={(factory) => {
              setLocalFactories((prev) => [...prev, factory])
              setForm((prev) => ({ ...prev, factoryId: factory.id }))
              setShowFactoryQuickCreate(false)
            }}
          />

          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU *" value={form.sku} onChange={f('sku')} disabled={isEdit}
              help={isEdit ? 'SKU is locked on edit.' : 'Use brand prefix (e.g., FW-SPC-65). Globally unique.'}
            />
            <Field label="Product name *" value={form.name} onChange={f('name')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Type" value={form.productType} onChange={f('productType')}
              options={[{ value: '', label: '— None —' }, ...PRODUCT_TYPES]}
            />
            <SelectField label="Category *" value={form.categoryId} onChange={handleCategoryChange}
              options={[{ value: '', label: '— Pick category —' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Supplier *{' '}
                <button
                  type="button"
                  onClick={() => setShowFactoryQuickCreate(true)}
                  className="ml-2 text-xs font-semibold text-primary-600 hover:text-primary-700"
                  title="Create a new supplier without leaving this form"
                >
                  + New
                </button>
              </label>
              <select
                value={form.factoryId || ''}
                onChange={f('factoryId')}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              >
                <option value="">— Pick supplier —</option>
                {localFactories.map(fy => (
                  <option key={fy.id} value={fy.id}>{fy.companyName || fy.name}</option>
                ))}
              </select>
            </div>
            <Field label="Origin country (ISO-2)" value={form.originCountry} onChange={f('originCountry')}
              placeholder="MY, CN, …" maxLength={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Phase 4.9.5: baseFobPrice is now the denormalized read-side
                cache of the current active ProductPrice row. Editing it
                directly still works (afterSave hook on ProductPrice will
                re-sync if any future price row is created), but admins
                should manage prices via the Price History panel below.
                Field stays editable for backward compat + the quick-fix
                case; explicit hint steers new edits to the canonical
                path. */}
            <div>
              <Field
                label="Base FOB price (floor) — cache"
                type="number"
                step="0.01"
                value={form.baseFobPrice}
                onChange={f('baseFobPrice')}
                help="Auto-synced from the current ProductPrice row (see Price History below). Edits here are honoured but get overwritten the next time a ProductPrice is added or boot-time reconcile runs. Prefer the Price History panel for new pricing entries."
              />
            </div>
            <SelectField label="Currency" value={form.currency} onChange={f('currency')}
              options={['USD', 'EUR', 'GBP', 'CNY', 'MYR'].map(c => ({ value: c, label: c }))}
            />
            <Field label="Lead time (days)" type="number" value={form.leadTimeDays} onChange={f('leadTimeDays')} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="MOQ" type="number" value={form.minOrderQty} onChange={f('minOrderQty')} />
            <SelectField label="MOQ unit" value={form.moqUnit} onChange={f('moqUnit')}
              options={MOQ_UNITS.map(u => ({ value: u, label: u }))}
            />
            <div />
          </div>

          {/* Phase 4.9 C-1: multi-origin pricing editor */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Origin variants</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Add one row per origin country when the same SKU is sourced from multiple factories at different prices (e.g. China vs Malaysia). Quotation builder reads from these variants when present. Leave empty to use the Base FOB price + Origin country above as the single origin.
                </p>
              </div>
              <button
                type="button"
                onClick={addVariant}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 flex-shrink-0"
              >
                + Add origin
              </button>
            </div>
            {form.originVariants.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No origin variants yet. Quotation builder will use the single-origin fields above.</p>
            ) : (
              <div className="space-y-2">
                {form.originVariants.map((v, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end bg-white border border-slate-200 rounded p-2">
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Origin (ISO-2)</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={v.originCountry || ''}
                        onChange={(e) => updateVariant(i, { originCountry: e.target.value.toUpperCase() })}
                        placeholder="CN"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono uppercase"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs text-slate-600 mb-1">FOB price (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={v.fobPriceUsd ?? ''}
                        onChange={(e) => updateVariant(i, { fobPriceUsd: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Price unit</label>
                      <select
                        value={v.priceUnit || 'sqm'}
                        onChange={(e) => updateVariant(i, { priceUnit: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      >
                        {MOQ_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">MOQ override</label>
                      <input
                        type="number"
                        value={v.moqOverride ?? ''}
                        onChange={(e) => updateVariant(i, { moqOverride: e.target.value })}
                        placeholder="(opt)"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Lead time (d)</label>
                      <input
                        type="number"
                        value={v.leadTimeOverride ?? ''}
                        onChange={(e) => updateVariant(i, { leadTimeOverride: e.target.value })}
                        placeholder="(opt)"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeVariant(i)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        title="Remove this origin"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Phase 4.9.2c: temporal Price History panel. Only shows when
              editing an existing product (new rows can't attach a
              price before the productId exists). */}
          {editing?.id && (
            <ProductPriceHistory productId={editing.id} factories={factories} />
          )}

          <Field label="Description" value={form.description} onChange={f('description')} multiline />
          <Field label="Sales description (buyer-facing)" value={form.salesDescription} onChange={f('salesDescription')} multiline />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50">
              {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Phase 4.20 (Bug 4a) — audited Product brand change.
// Opens from "Change brand…" on the edit form. Posts to /admin/brand-override
// which writes an AuditLog row with the reason. Reason is required (min 3).
function BrandOverrideModal({ productId, currentBrandCode, onClose, onSaved }) {
  const [newBrandCode, setNewBrandCode] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const canSubmit = newBrandCode && newBrandCode !== currentBrandCode && reason.trim().length >= 3

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      await api.patch('/admin/brand-override', {
        entityType: 'Product',
        entityId:   productId,
        newBrandCode,
        reason:     reason.trim(),
      })
      toast.success(`Brand changed to ${newBrandCode}`)
      onSaved(newBrandCode)
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Override failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Change product brand</h3>
            <p className="text-xs text-slate-500 mt-1">
              Routes through <span className="font-mono">/admin/brand-override</span>.
              Super-admin only. Audit-logged with your reason. Existing quotations and
              prices remain on the old brand record until they are individually re-tagged.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current brand</label>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-mono">
              {currentBrandCode || '— unset —'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New brand *</label>
            <BrandPicker value={newBrandCode} onChange={setNewBrandCode} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason * <span className="text-xs text-slate-400">(min 3 chars; recorded in AuditLog)</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Re-tagging from SH to FW after FlorWay absorbed the SKU line."
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : `Change to ${newBrandCode || '…'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', step, disabled, placeholder, multiline, help, maxLength }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {multiline ? (
        <textarea value={value || ''} onChange={onChange} rows={2} disabled={disabled}
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:bg-slate-100 disabled:text-slate-500"
        />
      ) : (
        <input type={type} step={step} value={value ?? ''} onChange={onChange} disabled={disabled} placeholder={placeholder} maxLength={maxLength}
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:bg-slate-100 disabled:text-slate-500"
        />
      )}
      {help && <p className="text-xs text-slate-500 mt-1">{help}</p>}
    </div>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select value={value || ''} onChange={onChange}
        className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
      >
        {options.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
      </select>
    </div>
  )
}
