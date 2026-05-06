import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit2, Check, X } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { productsAPI, productSpecsAPI } from '../../services/api'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import { formatDate } from '../../utils/formatters'

// Sovern margin formula: sell = cost / (1 - margin%)
function computeSell(cost, markup) {
  const c = parseFloat(cost)
  const m = parseFloat(markup)
  if (!c || !m || m >= 100) return null
  return (c / (1 - m / 100)).toFixed(2)
}

function InfoRow({ label, value }) {
  if (value == null || value === '' || value === 'null') return null
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="text-slate-900 font-medium text-sm mt-0.5">{value}</p>
    </div>
  )
}

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

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  useBreadcrumbs(product?.name)
  const [specs, setSpecs] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [id])

  const fetchAll = async () => {
    try {
      setIsLoading(true)
      const [productRes] = await Promise.all([
        productsAPI.getById(id),
      ])
      setProduct(productRes.data)
      try {
        const specRes = await productSpecsAPI.getSpecs(id)
        setSpecs(specRes.data)
      } catch (_) {}
    } catch (error) {
      toast.error('Failed to load product')
      navigate('/products')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (!product) return null

  const prices = product.prices || []
  const activePrices = prices.filter(p => p.isActive)
  const clientVisible = specs?.clientVisibleFields || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/products')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">SKU: {product.sku}</p>
          </div>
        </div>
        <button onClick={() => navigate(`/products/${id}/edit`)}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <Edit2 className="w-4 h-4" />
          <span>Edit</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-slate-500 font-medium">Status</p>
          <div className="mt-2">
            <StatusBadge status={product.isActive ? 'active' : 'inactive'} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-slate-500 font-medium">Category</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">{product.category?.name || '—'}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-slate-500 font-medium">Primary Factory</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">{product.factory?.companyName || '—'}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-slate-500 font-medium">Unit</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">{product.unit}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-slate-500 font-medium">Min Order Qty</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">{product.minOrderQty || 1} {product.unit}</p>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Pricing</h2>
          <button onClick={() => navigate(`/products/${id}/edit`)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Manage prices →
          </button>
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
                  <th className="py-2 px-3 font-semibold text-slate-700 text-right">Margin</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 text-right">Sell Price</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 text-center">CCY</th>
                  <th className="py-2 px-3 font-semibold text-slate-700 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {prices.map(p => (
                  <tr key={p.id} className={`border-b border-slate-100 ${p.isActive ? '' : 'opacity-50'}`}>
                    <td className="py-3 px-3 font-medium text-slate-900">{p.factory?.companyName || '—'}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm">
            No prices added yet.{' '}
            <button onClick={() => navigate(`/products/${id}/edit`)} className="text-primary-600 hover:underline">
              Add pricing →
            </button>
          </div>
        )}
      </div>

      {/* Descriptions */}
      {(product.salesDescription || product.purchaseDescription) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {product.salesDescription && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-2 flex items-center space-x-2">
                <span>Sales Description</span>
                <span className="text-xs font-normal text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">Client-facing</span>
              </h2>
              <p className="text-slate-700 text-sm whitespace-pre-line">{product.salesDescription}</p>
            </div>
          )}
          {product.purchaseDescription && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-2 flex items-center space-x-2">
                <span>Purchase Description</span>
                <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Supplier-facing</span>
              </h2>
              <p className="text-slate-700 text-sm whitespace-pre-line">{product.purchaseDescription}</p>
            </div>
          )}
        </div>
      )}

      {/* Specs — two panels side by side */}
      {specs && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Full Technical Specs */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Technical Specs</h2>
            <p className="text-xs text-amber-600 mb-4">Full spec — shown on supplier purchase orders</p>
            <div className="grid grid-cols-2 gap-3">
              {ALL_CLIENT_FIELDS.map(({ key, label }) => {
                const val = specs[key]
                if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) return null
                const display = typeof val === 'boolean'
                  ? (val ? <span className="flex items-center text-green-600"><Check className="w-3 h-3 mr-1" />Yes</span> : <span className="flex items-center text-slate-400"><X className="w-3 h-3 mr-1" />No</span>)
                  : Array.isArray(val) ? val.join(', ')
                  : String(val)
                return (
                  <div key={key}>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{display}</p>
                  </div>
                )
              })}
            </div>
            {specs.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-1">Supplier Notes</p>
                <p className="text-sm text-slate-700">{specs.notes}</p>
              </div>
            )}
          </div>

          {/* Client-Visible Specs */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Commercial Specs</h2>
            <p className="text-xs text-primary-600 mb-4">What clients see on quotations &amp; sales orders</p>
            {clientVisible.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {ALL_CLIENT_FIELDS.filter(f => clientVisible.includes(f.key)).map(({ key, label }) => {
                  const val = specs[key]
                  if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) return null
                  const display = typeof val === 'boolean'
                    ? (val ? <span className="flex items-center text-green-600"><Check className="w-3 h-3 mr-1" />Yes</span> : <span className="flex items-center text-slate-400"><X className="w-3 h-3 mr-1" />No</span>)
                    : Array.isArray(val) ? val.join(', ')
                    : String(val)
                  return (
                    <div key={key}>
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{display}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No commercial specs configured. Edit the product to set client-visible fields.</p>
            )}
          </div>
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Product Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <InfoRow label="HS Code" value={product.hsCode} />
          <InfoRow label="Weight" value={product.weight ? `${product.weight} kg` : null} />
          <InfoRow label="Created" value={formatDate(product.createdAt)} />
          <InfoRow label="Last Updated" value={formatDate(product.updatedAt)} />
        </div>
        {product.description && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-1">Internal Description</p>
            <p className="text-sm text-slate-700">{product.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}
