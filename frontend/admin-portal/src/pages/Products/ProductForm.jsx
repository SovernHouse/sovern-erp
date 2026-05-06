import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { productsAPI, factoriesAPI, productSpecsAPI } from '../../services/api'
import api from '../../services/api'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'

const TABS = ['Basic Info', 'Pricing', 'Technical Specs', 'Commercial']
const UNITS = ['sqm', 'sqft', 'box', 'pallet', 'roll', 'piece']
const INCOTERMS = ['FOB', 'EXW', 'CIF', 'CFR', 'DDP']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CNY', 'AUD']

const ALL_CLIENT_FIELDS = [
  { key: 'flooringType', label: 'Flooring Type' },
  { key: 'coreType', label: 'Core Type' },
  { key: 'construction', label: 'Construction' },
  { key: 'length', label: 'Length (mm)' },
  { key: 'width', label: 'Width (mm)' },
  { key: 'thickness', label: 'Thickness (mm)' },
  { key: 'wearLayerThickness', label: 'Wear Layer (mm)' },
  { key: 'wearLayerMil', label: 'Wear Layer (mil)' },
  { key: 'acRating', label: 'AC Rating' },
  { key: 'waterproof', label: 'Waterproof' },
  { key: 'fireRating', label: 'Fire Rating' },
  { key: 'slipRating', label: 'Slip Rating' },
  { key: 'surfaceFinish', label: 'Surface Finish' },
  { key: 'surfaceTexture', label: 'Surface Texture' },
  { key: 'colorPattern', label: 'Color / Pattern' },
  { key: 'edgeType', label: 'Edge Type' },
  { key: 'woodSpecies', label: 'Wood Species' },
  { key: 'woodGrade', label: 'Wood Grade' },
  { key: 'installationMethod', label: 'Installation Method' },
  { key: 'clickSystem', label: 'Click System' },
  { key: 'underlaymentRequired', label: 'Underlayment' },
  { key: 'sqmPerBox', label: 'sqm / Box' },
  { key: 'sqftPerBox', label: 'sqft / Box' },
  { key: 'planksPerBox', label: 'Planks / Box' },
  { key: 'boxWeight', label: 'Box Weight (kg)' },
  { key: 'warrantyResidential', label: 'Residential Warranty' },
  { key: 'warrantyCommercial', label: 'Commercial Warranty' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'origin', label: 'Origin' },
  { key: 'format', label: 'Format' },
]

const DEFAULT_CLIENT_VISIBLE = [
  'flooringType', 'length', 'width', 'thickness', 'wearLayerThickness',
  'acRating', 'waterproof', 'surfaceFinish', 'surfaceTexture', 'colorPattern',
  'edgeType', 'format', 'installationMethod', 'sqmPerBox', 'sqftPerBox',
  'planksPerBox', 'warrantyResidential', 'warrantyCommercial', 'certifications', 'origin',
]

function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  )
}

function SpecField({ label, name, value, onChange, type = 'text', options = null }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {options ? (
        <select name={name} value={value || ''} onChange={onChange}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600">
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} name={name} value={value ?? ''} onChange={onChange}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600" />
      )}
    </div>
  )
}

export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id
  useBreadcrumbs(isEdit ? 'Edit Product' : 'New Product')

  const [activeTab, setActiveTab] = useState(0)
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [factories, setFactories] = useState([])
  const [categories, setCategories] = useState([])

  const [form, setForm] = useState({
    name: '', sku: '', categoryId: '', factoryId: '', unit: 'sqm',
    hsCode: '', minOrderQty: 1, description: '',
    salesDescription: '', purchaseDescription: '',
  })

  const [prices, setPrices] = useState([])
  const [newPrice, setNewPrice] = useState({ factoryId: '', priceType: 'FOB', costPrice: '', exwPrice: '', markup: 20, currency: 'USD' })
  const [addingPrice, setAddingPrice] = useState(false)

  const [specs, setSpecs] = useState({})
  const [clientVisibleFields, setClientVisibleFields] = useState(DEFAULT_CLIENT_VISIBLE)
  const [sectionsOpen, setSectionsOpen] = useState({ type: true, dims: false, perf: false, surface: false, wood: false, install: false, packing: false, warranty: false })

  useEffect(() => {
    loadDropdowns()
    if (isEdit) loadProduct()
  }, [id])

  const loadDropdowns = async () => {
    try {
      const [facRes, catRes] = await Promise.all([
        factoriesAPI.getAll({ limit: 200 }),
        api.get('/products/categories/flat'),
      ])
      setFactories(facRes.data?.data || facRes.data || [])
      setCategories(catRes.data?.data || catRes.data || [])
    } catch (e) {
      console.error('Failed to load dropdowns', e)
    }
  }

  const loadProduct = async () => {
    try {
      setIsLoading(true)
      const res = await productsAPI.getById(id)
      const p = res.data
      setForm({
        name: p.name || '', sku: p.sku || '', categoryId: p.categoryId || '',
        factoryId: p.factoryId || '', unit: p.unit || 'sqm', hsCode: p.hsCode || '',
        minOrderQty: p.minOrderQty || 1, description: p.description || '',
        salesDescription: p.salesDescription || '', purchaseDescription: p.purchaseDescription || '',
      })
      setPrices(p.prices || [])
      try {
        const specRes = await productSpecsAPI.getSpecs(id)
        if (specRes.data) {
          setClientVisibleFields(specRes.data.clientVisibleFields || DEFAULT_CLIENT_VISIBLE)
          setSpecs(specRes.data)
        }
      } catch (_) {}
    } catch (error) {
      toast.error('Failed to load product')
      navigate('/products')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSpecChange = (e) => {
    const { name, value, type, checked } = e.target
    setSpecs(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : (value === '' ? null : value) }))
  }

  const toggleClientVisible = (key) => {
    setClientVisibleFields(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    )
  }

  // Sovern margin formula: sell = cost / (1 - margin%)
  const computeSell = (cost, markup) => {
    const c = parseFloat(cost)
    const m = parseFloat(markup)
    if (!c || !m || m >= 100) return ''
    return (c / (1 - m / 100)).toFixed(2)
  }

  const saveBasic = async () => {
    if (!form.name || !form.sku || !form.categoryId || !form.factoryId) {
      toast.error('Name, SKU, Category and primary Factory are required')
      return null
    }
    try {
      setIsSaving(true)
      if (isEdit) {
        await productsAPI.update(id, form)
        return id
      } else {
        const res = await productsAPI.create(form)
        return res.data.id
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save product')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const newId = await saveBasic()
    if (!newId) return
    if (!isEdit) {
      navigate(`/products/${newId}/edit`)
      toast.success('Product created — add pricing and specs in the next tabs')
    } else {
      toast.success('Product saved')
    }
  }

  const handleAddPrice = async () => {
    if (!newPrice.factoryId || !newPrice.costPrice) {
      toast.error('Supplier and FOB price are required')
      return
    }
    let productId = id
    if (!isEdit) {
      productId = await saveBasic()
      if (!productId) return
    }
    try {
      const res = await productsAPI.createPrice(productId, newPrice)
      setPrices(prev => [
        ...prev.filter(p => !(p.factoryId === newPrice.factoryId && p.isActive)),
        res.data,
      ])
      setNewPrice({ factoryId: '', priceType: 'FOB', costPrice: '', exwPrice: '', markup: 20, currency: 'USD' })
      setAddingPrice(false)
      toast.success('Price added')
      if (!isEdit) navigate(`/products/${productId}/edit`, { replace: true })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add price')
    }
  }

  const handleDeletePrice = async (priceId) => {
    try {
      await productsAPI.deletePrice(id, priceId)
      setPrices(prev => prev.filter(p => p.id !== priceId))
      toast.success('Price removed')
    } catch (error) {
      toast.error('Failed to remove price')
    }
  }

  const handleSaveSpecs = async () => {
    let productId = id
    if (!isEdit) {
      productId = await saveBasic()
      if (!productId) return
    }
    try {
      setIsSaving(true)
      const payload = { ...specs, clientVisibleFields }
      try {
        await productSpecsAPI.updateSpecs(productId, payload)
      } catch (_) {
        await productSpecsAPI.createSpecs(productId, payload)
      }
      toast.success('Specs saved')
      if (!isEdit) navigate(`/products/${productId}/edit`, { replace: true })
    } catch (error) {
      toast.error('Failed to save specs')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSection = (key) => setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }))

  if (isLoading) return <div className="text-center py-12 text-slate-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/products')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900">{isEdit ? 'Edit Product' : 'New Product'}</h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200 px-4 overflow-x-auto">
          {TABS.map((t, i) => (
            <TabButton key={t} label={t} active={activeTab === i} onClick={() => setActiveTab(i)} />
          ))}
        </div>

        <div className="p-6">

          {/* ── TAB 0: Basic Info ── */}
          {activeTab === 0 && (
            <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                  <input name="name" value={form.name} onChange={handleFormChange} required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SKU *</label>
                  <input name="sku" value={form.sku} onChange={handleFormChange} required disabled={isEdit}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:bg-slate-50 disabled:text-slate-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                  <select name="categoryId" value={form.categoryId} onChange={handleFormChange} required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600">
                    <option value="">Select category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primary Factory *</label>
                  <select name="factoryId" value={form.factoryId} onChange={handleFormChange} required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600">
                    <option value="">Select factory...</option>
                    {factories.map(f => <option key={f.id} value={f.id}>{f.companyName}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                  <select name="unit" value={form.unit} onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">HS Code</label>
                  <input name="hsCode" value={form.hsCode} onChange={handleFormChange} placeholder="e.g. 3918.10"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Order Qty</label>
                  <input type="number" name="minOrderQty" value={form.minOrderQty} onChange={handleFormChange} min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Internal Description</label>
                <textarea name="description" value={form.description} onChange={handleFormChange} rows={2}
                  placeholder="General notes (internal only)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sales Description
                    <span className="ml-2 text-xs text-primary-600 font-normal">shown on client quotations</span>
                  </label>
                  <textarea name="salesDescription" value={form.salesDescription} onChange={handleFormChange} rows={5}
                    placeholder="What the client sees on their quotation and sales order..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Purchase Description
                    <span className="ml-2 text-xs text-amber-600 font-normal">shown on POs to suppliers</span>
                  </label>
                  <textarea name="purchaseDescription" value={form.purchaseDescription} onChange={handleFormChange} rows={5}
                    placeholder="QC requirements, tolerances, certifications for the factory..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none" />
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button type="submit" disabled={isSaving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
                  {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create & Continue'}
                </button>
                <button type="button" onClick={() => navigate('/products')}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* ── TAB 1: Pricing ── */}
          {activeTab === 1 && (
            <div className="space-y-6 max-w-5xl">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">Supplier Prices</h2>
                <p className="text-sm text-slate-500">
                  One row per supplier. Sell price uses the Sovern margin formula:
                  <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded ml-1">sell = FOB ÷ (1 − margin%)</span>
                </p>
              </div>

              {prices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="py-2 px-3 font-semibold text-slate-700">Supplier</th>
                        <th className="py-2 px-3 font-semibold text-slate-700">Incoterm</th>
                        <th className="py-2 px-3 font-semibold text-slate-700 text-right">FOB (Buy)</th>
                        <th className="py-2 px-3 font-semibold text-slate-700 text-right">EXW</th>
                        <th className="py-2 px-3 font-semibold text-slate-700 text-right">Markup</th>
                        <th className="py-2 px-3 font-semibold text-slate-700 text-right">Sell Price</th>
                        <th className="py-2 px-3 font-semibold text-slate-700 text-center">CCY</th>
                        <th className="py-2 px-3 font-semibold text-slate-700 text-center">Status</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {prices.map(p => (
                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-3 font-medium text-slate-900">
                            {p.factory?.companyName || factories.find(f => f.id === p.factoryId)?.companyName || '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-600">{p.priceType || 'FOB'}</td>
                          <td className="py-3 px-3 text-right text-slate-900">{p.costPrice ? parseFloat(p.costPrice).toFixed(2) : '—'}</td>
                          <td className="py-3 px-3 text-right text-slate-500">{p.exwPrice ? parseFloat(p.exwPrice).toFixed(2) : '—'}</td>
                          <td className="py-3 px-3 text-right text-slate-600">{p.markup}%</td>
                          <td className="py-3 px-3 text-right font-semibold text-green-700">{p.sellingPrice ? parseFloat(p.sellingPrice).toFixed(2) : '—'}</td>
                          <td className="py-3 px-3 text-center text-slate-600">{p.currency}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              {p.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <button onClick={() => handleDeletePrice(p.id)}
                              className="text-red-400 hover:text-red-600 p-1 rounded transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-lg p-8 text-center text-slate-500 text-sm">
                  No prices added yet.
                </div>
              )}

              {addingPrice ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">Add Supplier Price</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Supplier *</label>
                      <select value={newPrice.factoryId}
                        onChange={e => setNewPrice(p => ({ ...p, factoryId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600">
                        <option value="">Select factory...</option>
                        {factories.map(f => <option key={f.id} value={f.id}>{f.companyName}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Incoterm</label>
                      <select value={newPrice.priceType}
                        onChange={e => setNewPrice(p => ({ ...p, priceType: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600">
                        {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
                      <select value={newPrice.currency}
                        onChange={e => setNewPrice(p => ({ ...p, currency: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600">
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">FOB Price (buy) *</label>
                      <input type="number" step="0.01" min="0" value={newPrice.costPrice}
                        onChange={e => setNewPrice(p => ({ ...p, costPrice: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">EXW Price (optional)</label>
                      <input type="number" step="0.01" min="0" value={newPrice.exwPrice}
                        onChange={e => setNewPrice(p => ({ ...p, exwPrice: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Margin %</label>
                      <input type="number" step="0.1" min="0" max="99" value={newPrice.markup}
                        onChange={e => setNewPrice(p => ({ ...p, markup: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600" />
                    </div>
                  </div>
                  {newPrice.costPrice && newPrice.markup && (
                    <p className="text-sm font-medium text-green-700">
                      Sell price: {newPrice.currency} {computeSell(newPrice.costPrice, newPrice.markup)} / {form.unit || 'unit'}
                    </p>
                  )}
                  <div className="flex space-x-2">
                    <button type="button" onClick={handleAddPrice}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
                      Add Price
                    </button>
                    <button type="button" onClick={() => setAddingPrice(false)}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingPrice(true)}
                  className="flex items-center space-x-2 px-4 py-2 border border-dashed border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">
                  <Plus className="w-4 h-4" />
                  <span>Add Supplier Price</span>
                </button>
              )}
            </div>
          )}

          {/* ── TAB 2: Technical Specs ── */}
          {activeTab === 2 && (
            <div className="space-y-4 max-w-4xl">
              <p className="text-sm text-slate-500">
                Full specification set — all fields appear on <span className="font-medium text-amber-700">purchase orders to suppliers</span>.
                Use the Commercial tab to control which fields appear on client quotations.
              </p>

              {[
                {
                  key: 'type', title: 'Flooring Type & Construction',
                  fields: (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                      <SpecField label="Flooring Type" name="flooringType" value={specs.flooringType} onChange={handleSpecChange}
                        options={['SPC', 'WPC', 'LVT', 'Laminate', 'Engineered Wood', 'Solid Wood', 'Bamboo', 'Vinyl Dry Back']} />
                      <SpecField label="Core Type" name="coreType" value={specs.coreType} onChange={handleSpecChange}
                        options={['Stone Plastic Composite', 'Wood Plastic Composite', 'HDF', 'Plywood', 'Solid Wood', 'None']} />
                      <SpecField label="Construction" name="construction" value={specs.construction} onChange={handleSpecChange} />
                      <SpecField label="Format" name="format" value={specs.format} onChange={handleSpecChange}
                        options={['Plank', 'Herringbone', 'Chevron', 'Wide Plank', 'Long Plank', 'Parquet', 'Tile']} />
                      <SpecField label="Origin (Country)" name="origin" value={specs.origin} onChange={handleSpecChange} />
                    </div>
                  )
                },
                {
                  key: 'dims', title: 'Dimensions',
                  fields: (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                      <SpecField label="Length (mm)" name="length" value={specs.length} onChange={handleSpecChange} type="number" />
                      <SpecField label="Width (mm)" name="width" value={specs.width} onChange={handleSpecChange} type="number" />
                      <SpecField label="Thickness (mm)" name="thickness" value={specs.thickness} onChange={handleSpecChange} type="number" />
                      <SpecField label="Wear Layer (mm)" name="wearLayerThickness" value={specs.wearLayerThickness} onChange={handleSpecChange} type="number" />
                      <SpecField label="Wear Layer (mil)" name="wearLayerMil" value={specs.wearLayerMil} onChange={handleSpecChange} type="number" />
                    </div>
                  )
                },
                {
                  key: 'perf', title: 'Performance Ratings',
                  fields: (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                      <SpecField label="AC Rating" name="acRating" value={specs.acRating} onChange={handleSpecChange}
                        options={['AC1', 'AC2', 'AC3', 'AC4', 'AC5']} />
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Waterproof</label>
                        <input type="checkbox" name="waterproof" checked={!!specs.waterproof} onChange={handleSpecChange}
                          className="w-4 h-4 text-primary-600 rounded border-slate-300" />
                      </div>
                      <SpecField label="Fire Rating" name="fireRating" value={specs.fireRating} onChange={handleSpecChange}
                        options={['Afl', 'Bfl-s1', 'Bfl-s2', 'Cfl-s1', 'Cfl-s2', 'Dfl', 'Efl']} />
                      <SpecField label="Slip Rating" name="slipRating" value={specs.slipRating} onChange={handleSpecChange}
                        options={['R9', 'R10', 'R11', 'R12', 'R13']} />
                    </div>
                  )
                },
                {
                  key: 'surface', title: 'Surface & Appearance',
                  fields: (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                      <SpecField label="Surface Finish" name="surfaceFinish" value={specs.surfaceFinish} onChange={handleSpecChange}
                        options={['EIR', 'Synchronized', 'Embossed', 'Matt', 'Piano', 'Crystal', 'Hand-scraped', 'Brushed', 'Oiled', 'Lacquered', 'UV Oil']} />
                      <SpecField label="Surface Texture" name="surfaceTexture" value={specs.surfaceTexture} onChange={handleSpecChange}
                        options={['Wood grain', 'Stone', 'Tile look', 'Hand scraped', 'Wire brushed', 'Smooth']} />
                      <SpecField label="Color / Pattern" name="colorPattern" value={specs.colorPattern} onChange={handleSpecChange} />
                      <SpecField label="Edge Type" name="edgeType" value={specs.edgeType} onChange={handleSpecChange}
                        options={['Micro-bevel', 'Square edge', 'Painted bevel', 'V-groove', 'Beveled 4 sides', 'No bevel']} />
                    </div>
                  )
                },
                {
                  key: 'wood', title: 'Wood-Specific',
                  fields: (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                      <SpecField label="Wood Species" name="woodSpecies" value={specs.woodSpecies} onChange={handleSpecChange}
                        options={['European Oak', 'American Oak', 'Black Walnut', 'Birch', 'Hickory', 'Maple', 'Ash', 'Pine', 'Bamboo']} />
                      <SpecField label="Wood Grade" name="woodGrade" value={specs.woodGrade} onChange={handleSpecChange}
                        options={['Select', 'Prime', 'AB', 'BC', 'CD', 'Character', 'Rustic', 'EF']} />
                    </div>
                  )
                },
                {
                  key: 'install', title: 'Installation',
                  fields: (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                      <SpecField label="Installation Method" name="installationMethod" value={specs.installationMethod} onChange={handleSpecChange}
                        options={['Click-lock', 'Glue-down', 'Nail-down', 'Floating', 'Loose Lay', 'Self-adhesive']} />
                      <SpecField label="Click System" name="clickSystem" value={specs.clickSystem} onChange={handleSpecChange}
                        options={['Uniclick', 'Valinge 2G', 'Valinge 5G', 'Drop-lock', 'Angle-angle', 'I4F', 'Uniclic']} />
                      <SpecField label="Underlayment" name="underlaymentRequired" value={specs.underlaymentRequired} onChange={handleSpecChange}
                        options={['Attached', 'Required', 'Optional', 'Not Required']} />
                      <SpecField label="Underlayment Type" name="underlaymentType" value={specs.underlaymentType} onChange={handleSpecChange}
                        options={['IXPE', 'Cork', 'EVA', 'EPE', 'Rubber', 'Foam']} />
                    </div>
                  )
                },
                {
                  key: 'packing', title: 'Packaging & Coverage',
                  fields: (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                      <SpecField label="sqm / Box" name="sqmPerBox" value={specs.sqmPerBox} onChange={handleSpecChange} type="number" />
                      <SpecField label="sqft / Box" name="sqftPerBox" value={specs.sqftPerBox} onChange={handleSpecChange} type="number" />
                      <SpecField label="Planks / Box" name="planksPerBox" value={specs.planksPerBox} onChange={handleSpecChange} type="number" />
                      <SpecField label="Box Weight (kg)" name="boxWeight" value={specs.boxWeight} onChange={handleSpecChange} type="number" />
                    </div>
                  )
                },
                {
                  key: 'warranty', title: 'Warranty & Compliance',
                  fields: (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                      <SpecField label="Residential Warranty" name="warrantyResidential" value={specs.warrantyResidential} onChange={handleSpecChange}
                        options={['Lifetime', '30 Years', '25 Years', '20 Years', '15 Years', '10 Years', '5 Years']} />
                      <SpecField label="Commercial Warranty" name="warrantyCommercial" value={specs.warrantyCommercial} onChange={handleSpecChange}
                        options={['25 Years', '20 Years', '15 Years', '10 Years', '7 Years', '5 Years', '3 Years']} />
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Certifications (comma-separated)</label>
                        <input type="text" placeholder="FSC, CARB2, FloorScore, CE..."
                          value={Array.isArray(specs.certifications) ? specs.certifications.join(', ') : (specs.certifications || '')}
                          onChange={e => setSpecs(prev => ({ ...prev, certifications: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600" />
                      </div>
                    </div>
                  )
                },
              ].map(({ key, title, fields }) => (
                <div key={key} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button type="button" onClick={() => toggleSection(key)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                    {title}
                    {sectionsOpen[key] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {sectionsOpen[key] && fields}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Notes</label>
                <textarea name="notes" value={specs.notes || ''} onChange={handleSpecChange} rows={3}
                  placeholder="QC requirements, tolerances, packaging instructions, test standards..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none" />
              </div>

              <button type="button" onClick={handleSaveSpecs} disabled={isSaving}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
                {isSaving ? 'Saving...' : 'Save Specs'}
              </button>
            </div>
          )}

          {/* ── TAB 3: Commercial ── */}
          {activeTab === 3 && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">Client-Visible Specs</h2>
                <p className="text-sm text-slate-500">
                  Check which spec fields appear on <span className="font-medium text-primary-700">quotations and sales orders</span>.
                  All specs are always included on supplier purchase orders.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ALL_CLIENT_FIELDS.map(({ key, label }) => (
                  <label key={key} className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    clientVisibleFields.includes(key)
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}>
                    <input type="checkbox" checked={clientVisibleFields.includes(key)}
                      onChange={() => toggleClientVisible(key)}
                      className="w-4 h-4 text-primary-600 rounded border-slate-300" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>

              {clientVisibleFields.length > 0 && Object.keys(specs).some(k => specs[k] != null && specs[k] !== '') && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Preview — Client View</h3>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {ALL_CLIENT_FIELDS.filter(f => clientVisibleFields.includes(f.key) && specs[f.key] != null && specs[f.key] !== '').map(({ key, label }) => (
                        <div key={key} className="flex">
                          <span className="text-slate-500 min-w-fit">{label}:&nbsp;</span>
                          <span className="font-medium text-slate-900">
                            {Array.isArray(specs[key]) ? specs[key].join(', ') : String(specs[key])}
                          </span>
                        </div>
                      ))}
                    </div>
                    {clientVisibleFields.every(k => !specs[k]) && (
                      <p className="text-slate-400 text-sm">Fill in Technical Specs first to see a preview here.</p>
                    )}
                  </div>
                </div>
              )}

              <button type="button" onClick={handleSaveSpecs} disabled={isSaving}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
                {isSaving ? 'Saving...' : 'Save Commercial Settings'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
