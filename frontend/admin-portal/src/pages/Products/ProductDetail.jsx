// ─── ProductDetail — Phase 4.21b Odoo upgrade ─────────────────────────────────
//
// Full form-view page following trade-odoo-patterns.md:
//   1. Breadcrumb header (via useBreadcrumbs)
//   2. Smart-button strip — clickable counts that jump to the related tab
//   3. Tab strip — Overview, Specifications, Pricing, Quotations,
//      Sales Orders, Purchase Orders, Inquiries
//   4. Chatter mounted at the bottom (entityType='Product', whitelisted in
//      backend/controllers/chatterController.js by the Phase 4.21a sweep).
//
// Related-data tabs pull from:
//   GET /api/products/:id/quotations
//   GET /api/products/:id/sales-orders
//   GET /api/products/:id/purchase-orders
//   GET /api/products/:id/inquiries
// All four are brand-scoped server-side via brandWhere on the parent
// entity (Item join tables don't carry brandCode).

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit2, Check, X } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import BrandBadge from '../../components/BrandBadge'
import Chatter from '../../components/Chatter'
import { productsAPI, productSpecsAPI } from '../../services/api'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import { formatCurrency, formatDate } from '../../utils/formatters'

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
  const [specs, setSpecs] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  // Phase 4.28t: breadcrumb appends the active tab name after a chevron.
  useBreadcrumbs(product?.name, activeTab)

  // Phase 4.21b — related-data collections, each fetched once on mount.
  const [quotations, setQuotations] = useState([])
  const [salesOrders, setSalesOrders] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [inquiries, setInquiries] = useState([])

  useEffect(() => {
    fetchAll()
  }, [id])

  const fetchAll = async () => {
    try {
      setIsLoading(true)
      const productRes = await productsAPI.getById(id)
      setProduct(productRes.data)

      // Related-data fetches run in parallel, each failure tolerated so a
      // single broken endpoint doesn't blank the whole page.
      const [specsRes, quotesRes, soRes, poRes, inqRes] = await Promise.allSettled([
        productSpecsAPI.getSpecs(id),
        productsAPI.getRelatedQuotations(id),
        productsAPI.getRelatedSalesOrders(id),
        productsAPI.getRelatedPurchaseOrders(id),
        productsAPI.getRelatedInquiries(id),
      ])
      if (specsRes.status === 'fulfilled') setSpecs(specsRes.value.data)
      if (quotesRes.status === 'fulfilled') setQuotations(quotesRes.value.data || [])
      if (soRes.status === 'fulfilled') setSalesOrders(soRes.value.data || [])
      if (poRes.status === 'fulfilled') setPurchaseOrders(poRes.value.data || [])
      if (inqRes.status === 'fulfilled') setInquiries(inqRes.value.data || [])
    } catch (error) {
      toast.error('Failed to load product')
      navigate('/products')
    } finally {
      setIsLoading(false)
    }
  }

  const prices = useMemo(() => product?.prices || [], [product])

  if (isLoading) return <LoadingSpinner />
  if (!product) return null

  const clientVisible = specs?.clientVisibleFields || []

  // Smart-button strip — each chip jumps to the matching tab and visually
  // distinguishes the count when > 0.
  const smartButtons = [
    { key: 'pricing',     label: 'Pricing',        count: prices.length },
    { key: 'quotations',  label: 'Quotations',     count: quotations.length },
    { key: 'salesOrders', label: 'Sales Orders',   count: salesOrders.length },
    { key: 'purchaseOrders', label: 'Purchase Orders', count: purchaseOrders.length },
    { key: 'inquiries',   label: 'Inquiries',      count: inquiries.length },
  ]

  const tabs = [
    { key: 'overview',       label: 'Overview' },
    { key: 'specifications', label: 'Specifications' },
    { key: 'pricing',        label: `Pricing${prices.length ? ` (${prices.length})` : ''}` },
    { key: 'quotations',     label: `Quotations${quotations.length ? ` (${quotations.length})` : ''}` },
    { key: 'salesOrders',    label: `Sales Orders${salesOrders.length ? ` (${salesOrders.length})` : ''}` },
    { key: 'purchaseOrders', label: `Purchase Orders${purchaseOrders.length ? ` (${purchaseOrders.length})` : ''}` },
    { key: 'inquiries',      label: `Inquiries${inquiries.length ? ` (${inquiries.length})` : ''}` },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/products')}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Back to products"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              {product.name}
              {product.brandCode && <BrandBadge code={product.brandCode} size="sm" />}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">SKU: <span className="font-mono">{product.sku}</span></p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/products/${id}/edit`)}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          <span>Edit</span>
        </button>
      </div>

      {/* Smart-button strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {smartButtons.map((sb) => (
          <button
            key={sb.key}
            onClick={() => setActiveTab(sb.key)}
            className={`text-left px-4 py-3 rounded-lg shadow border transition-colors ${
              activeTab === sb.key
                ? 'bg-primary-50 border-primary-200'
                : 'bg-white border-transparent hover:bg-slate-50'
            }`}
          >
            <p className="text-xs text-slate-500 font-medium">{sb.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{sb.count}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-slate-200 px-4 overflow-x-auto">
          <nav className="flex gap-1" aria-label="Product tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === t.key
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab product={product} />}
          {activeTab === 'specifications' && <SpecificationsTab specs={specs} clientVisible={clientVisible} />}
          {activeTab === 'pricing' && <PricingTab prices={prices} onManage={() => navigate(`/products/${id}/edit`)} />}
          {activeTab === 'quotations' && (
            <RelatedListTab
              rows={quotations}
              empty="No quotations include this product yet."
              columns={[
                { key: 'quotationNumber', label: 'Number', render: (r) => r.quotationNumber || r.number || r.id.slice(0, 8) },
                { key: 'customer', label: 'Customer', render: (r) => r.customer?.companyName || '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'total', label: 'Total', render: (r) => r.total ? formatCurrency(r.total, r.currency || 'USD') : '—' },
                { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
              ]}
              onRowClick={(r) => navigate(`/quotations/${r.id}`)}
            />
          )}
          {activeTab === 'salesOrders' && (
            <RelatedListTab
              rows={salesOrders}
              empty="No sales orders include this product yet."
              columns={[
                { key: 'orderNumber', label: 'Number', render: (r) => r.orderNumber || r.soNumber || r.id.slice(0, 8) },
                { key: 'customer', label: 'Customer', render: (r) => r.customer?.companyName || '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'total', label: 'Total', render: (r) => r.total ? formatCurrency(r.total, r.currency || 'USD') : '—' },
                { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
              ]}
              onRowClick={(r) => navigate(`/sales-orders/${r.id}`)}
            />
          )}
          {activeTab === 'purchaseOrders' && (
            <RelatedListTab
              rows={purchaseOrders}
              empty="No purchase orders include this product yet."
              columns={[
                { key: 'poNumber', label: 'Number', render: (r) => r.poNumber || r.purchaseOrderNumber || r.id.slice(0, 8) },
                { key: 'factory', label: 'Supplier', render: (r) => r.factory?.companyName || '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'total', label: 'Total', render: (r) => r.total ? formatCurrency(r.total, r.currency || 'USD') : '—' },
                { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
              ]}
              onRowClick={(r) => navigate(`/purchase-orders/${r.id}`)}
            />
          )}
          {activeTab === 'inquiries' && (
            <RelatedListTab
              rows={inquiries}
              empty="No inquiries reference this product yet."
              columns={[
                { key: 'inquiryNumber', label: 'Number', render: (r) => r.inquiryNumber || r.number || r.id.slice(0, 8) },
                { key: 'customer', label: 'Customer', render: (r) => r.customer?.companyName || '—' },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt) },
              ]}
              onRowClick={(r) => navigate(`/inquiries/${r.id}`)}
            />
          )}
        </div>
      </div>

      {/* Chatter — Phase 4.21a added 'Product' to the chatter whitelist */}
      <Chatter entityType="Product" entityId={id} className="mt-6" />
    </div>
  )
}

// ─── Tab components ────────────────────────────────────────────────────────

function OverviewTab({ product }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-slate-500 font-medium">Status</p>
          <div className="mt-2"><StatusBadge status={product.isActive ? 'active' : 'inactive'} /></div>
        </div>
        <InfoRow label="Category" value={product.category?.name} />
        <InfoRow label="Primary Factory" value={product.factory?.companyName} />
        <InfoRow label="Type" value={product.productType} />
        <InfoRow label="Unit" value={product.unit} />
        <InfoRow label="MOQ" value={product.minOrderQty ? `${product.minOrderQty} ${product.moqUnit || product.unit || ''}` : null} />
        <InfoRow label="Lead Time" value={product.leadTimeDays ? `${product.leadTimeDays} days` : null} />
        <InfoRow label="Origin Country" value={product.originCountry} />
        <InfoRow label="HS Code" value={product.hsCode} />
        <InfoRow label="Weight" value={product.weight ? `${product.weight} kg` : null} />
        <InfoRow label="Cubic Meters" value={product.cubicMeters ? `${product.cubicMeters} m³` : null} />
        <InfoRow label="Currency" value={product.currency} />
      </div>

      {(product.salesDescription || product.purchaseDescription || product.description) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          {product.salesDescription && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                Sales Description
                <span className="text-xs font-normal text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">Client-facing</span>
              </h3>
              <p className="text-slate-700 text-sm whitespace-pre-line">{product.salesDescription}</p>
            </div>
          )}
          {product.purchaseDescription && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                Purchase Description
                <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Supplier-facing</span>
              </h3>
              <p className="text-slate-700 text-sm whitespace-pre-line">{product.purchaseDescription}</p>
            </div>
          )}
          {product.description && !product.salesDescription && !product.purchaseDescription && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Internal Description</h3>
              <p className="text-slate-700 text-sm whitespace-pre-line">{product.description}</p>
            </div>
          )}
        </div>
      )}

      {Array.isArray(product.originVariants) && product.originVariants.length > 0 && (
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Origin Variants</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr><th className="py-1 pr-3">Origin</th><th className="py-1 pr-3">FOB (USD)</th><th className="py-1 pr-3">Unit</th><th className="py-1 pr-3">MOQ</th><th className="py-1 pr-3">Lead time</th></tr>
            </thead>
            <tbody>
              {product.originVariants.map((v, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-mono uppercase">{v.originCountry}</td>
                  <td className="py-2 pr-3">{v.fobPriceUsd}</td>
                  <td className="py-2 pr-3 text-slate-600">{v.priceUnit || 'sqm'}</td>
                  <td className="py-2 pr-3 text-slate-600">{v.moqOverride ?? '—'}</td>
                  <td className="py-2 pr-3 text-slate-600">{v.leadTimeOverride ? `${v.leadTimeOverride} d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <InfoRow label="Created" value={formatDate(product.createdAt)} />
        <InfoRow label="Last Updated" value={formatDate(product.updatedAt)} />
      </div>
    </div>
  )
}

function SpecificationsTab({ specs, clientVisible }) {
  if (!specs) {
    return <p className="text-slate-400 text-sm">No specifications configured for this product.</p>
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Technical Specs</h3>
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

      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Commercial Specs</h3>
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
  )
}

function PricingTab({ prices, onManage }) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-slate-900">Price History</h3>
        <button onClick={onManage} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          Manage prices →
        </button>
      </div>
      {prices.length === 0 ? (
        <p className="text-slate-400 text-sm">No prices added yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3">Supplier</th>
                <th className="py-2 pr-3">Origin</th>
                <th className="py-2 pr-3 text-right">Cost (USD/m²)</th>
                <th className="py-2 pr-3 text-right">Markup %</th>
                <th className="py-2 pr-3 text-right">Sell (USD/m²)</th>
                <th className="py-2 pr-3">CCY</th>
                <th className="py-2 pr-3">Valid From</th>
                <th className="py-2 pr-3">Valid To</th>
              </tr>
            </thead>
            <tbody>
              {prices.map(p => {
                const sell = p.sellingPriceUsdPerM2 || computeSell(p.costPriceUsdPerM2, (p.markupPercent || 0) * 100)
                return (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-3 pr-3 text-slate-900">{p.factory?.companyName || '—'}</td>
                    <td className="py-3 pr-3 text-slate-700">{p.origin || '—'}</td>
                    <td className="py-3 pr-3 text-right text-slate-900">{p.costPriceUsdPerM2 ? parseFloat(p.costPriceUsdPerM2).toFixed(2) : '—'}</td>
                    <td className="py-3 pr-3 text-right text-slate-600">{p.markupPercent != null ? `${(p.markupPercent * 100).toFixed(0)}%` : '—'}</td>
                    <td className="py-3 pr-3 text-right font-semibold text-green-700">{sell ? parseFloat(sell).toFixed(2) : '—'}</td>
                    <td className="py-3 pr-3 text-slate-600">{p.currency || 'USD'}</td>
                    <td className="py-3 pr-3 text-slate-600">{p.validFrom ? formatDate(p.validFrom) : '—'}</td>
                    <td className="py-3 pr-3 text-slate-600">{p.validTo ? formatDate(p.validTo) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function RelatedListTab({ rows, columns, empty, onRowClick }) {
  if (!rows || rows.length === 0) {
    return <p className="text-slate-400 text-sm py-4">{empty}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            {columns.map((c) => (
              <th key={c.key} className="py-2 pr-3 font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onRowClick && onRowClick(r)}
              className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
            >
              {columns.map((c) => (
                <td key={c.key} className="py-3 pr-3 text-slate-800">
                  {c.render ? c.render(r) : (r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
