import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit2, MessageSquare, Download, CalendarClock } from 'lucide-react'
import ChatterPanel from '../../components/ChatterPanel'
import LoadingSpinner from '../../components/LoadingSpinner'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { BrandBadgeGroup } from '../../components/BrandBadge'
import SanctionsBadge from '../../components/SanctionsBadge'
import { useBrands } from '../../contexts/BrandsContext'
import ProductBrandingModePicker from '../../components/ProductBrandingModePicker'
import ProfitabilityPanel from './ProfitabilityPanel'
import api, { customersAPI } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import ScheduleActivityModal from '../../components/ScheduleActivityModal'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { accessibleBrands, isCrossBrand, getBrand } = useBrands()
  const { user } = useAuth()
  const [customer, setCustomer] = useState(null)
  useBreadcrumbs(customer?.name)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  // Phase 1 Commit 4: brand-context tab — which brand's activity am I
  // looking at? Defaults to the customer's first brand (their oldest
  // relationship). Super-admin can switch to 'all-brands' for the
  // read-only aggregate view (D-3).
  const [activeBrand, setActiveBrand] = useState(null)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [orders, setOrders] = useState([])
  const [quotations, setQuotations] = useState([])
  const [invoices, setInvoices] = useState([])
  const [claims, setClaims] = useState([])
  // Phase 4, C18: sanctions override modal state. super-admin only.
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideSubmitting, setOverrideSubmitting] = useState(false)

  useEffect(() => {
    fetchCustomer()
  }, [id])

  const fetchCustomer = async () => {
    try {
      setIsLoading(true)
      const res = await customersAPI.getById(id)
      setCustomer(res.data)

      const [ordersRes, quotationsRes, invoicesRes, claimsRes] = await Promise.all([
        customersAPI.getOrders(id),
        customersAPI.getQuotations(id),
        customersAPI.getInvoices(id),
        customersAPI.getClaims(id),
      ])

      setOrders(ordersRes.data || [])
      setQuotations(quotationsRes.data || [])
      setInvoices(invoicesRes.data || [])
      setClaims(claimsRes.data || [])
    } catch (error) {
      console.error('Failed to fetch customer:', error)
      toast.error('Failed to load customer')
      navigate('/customers')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <LoadingSpinner />

  if (!customer) return null

  // Brand-context tab strip (Phase 1 Commit 4). If the customer relates to
  // only one brand AND the user only has access to one brand, skip the
  // strip entirely (no value, just clutter). Otherwise show one tab per
  // relationship brand + an "All Brands" read-only tab for super_admin.
  const customerBrands = Array.isArray(customer.brandRelationships) && customer.brandRelationships.length
    ? customer.brandRelationships
    : ['SH']
  const visibleBrands = customerBrands.filter(b => accessibleBrands.includes(b))
  const canSeeAllBrands = isCrossBrand || accessibleBrands.length > 1
  const showBrandTabs = visibleBrands.length > 1 || canSeeAllBrands
  // Default the active brand to the first one this user can see, or 'all-brands'
  // if they're already in cross-brand mode.
  if (activeBrand === null) {
    setActiveBrand(isCrossBrand ? 'all-brands' : (visibleBrands[0] || customerBrands[0]))
  }
  const isAllBrandsView = activeBrand === 'all-brands'

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders', label: 'Orders' },
    { id: 'quotations', label: 'Quotations' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'profitability', label: 'Profitability' },
    { id: 'claims', label: 'Claims' },
    { id: 'documents', label: 'Documents' },
    { id: 'chatter', label: 'Chatter' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-slate-900">{customer.name || customer.companyName}</h1>
              <BrandBadgeGroup codes={customerBrands} size="md" />
              {/* Phase 4, C18: sanctions screening badge. Always rendered
                  (defaults to 'pending' for legacy rows). super-admin sees
                  an Override button when the customer is flagged. */}
              <SanctionsBadge status={customer.screeningStatus || 'pending'} size="md" />
              {customer.screeningStatus === 'flagged' && user?.role === 'super_admin' && (
                <button
                  onClick={() => setShowOverrideModal(true)}
                  className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Override
                </button>
              )}
            </div>
            <p className="text-slate-600 text-sm mt-1">{customer.country}</p>
            {customer.screeningStatus === 'flagged' && customer.sanctionBlockReason && (
              <p className="text-xs text-red-700 mt-1">
                {customer.sanctionBlockReason}
              </p>
            )}
            {customer.screeningStatus === 'override' && customer.sanctionOverrideReason && (
              <p className="text-xs text-amber-700 mt-1" title={customer.sanctionOverrideReason}>
                Override on file: {customer.sanctionOverrideReason.slice(0, 80)}
                {customer.sanctionOverrideReason.length > 80 ? '...' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!isAllBrandsView && (
            <>
              <button
                onClick={() => setShowActivityModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <CalendarClock className="w-4 h-4" />
                <span>Schedule Activity</span>
              </button>
              <button
                onClick={() => navigate(`/customers/${id}/edit`)}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Phase 3, C12: FlorWay productBrandingMode picker. Renders only
          for customers with FW in their brandRelationships. Locks on the
          first FW quotation sent under that mode; super-admin can override
          with a reason. */}
      {customerBrands.includes('FW') && (
        <ProductBrandingModePicker
          customer={customer}
          currentUserRole={user?.role}
          onSaved={(updated) => setCustomer(updated)}
        />
      )}

      {/* Customer Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Email</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{customer.email}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Phone</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{customer.phone}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Credit Limit</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {formatCurrency(customer.creditLimit)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Status</p>
          <div className="mt-2">
            <StatusBadge status={customer.status} />
          </div>
        </div>
      </div>

      {/* Brand-context tab strip — Phase 1 Commit 4 (D-3 / spec) */}
      {showBrandTabs && (
        <div className={`rounded-lg shadow ${isAllBrandsView
          ? 'bg-amber-50 border-2 border-dashed border-amber-600/70'
          : 'bg-white'}`}>
          <div className="flex items-center px-4 py-2 gap-3 flex-wrap">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Viewing
            </span>
            {visibleBrands.map((bc) => {
              const b = getBrand(bc)
              const isActive = activeBrand === bc
              return (
                <button
                  key={bc}
                  onClick={() => setActiveBrand(bc)}
                  className="px-3 py-1.5 font-medium text-sm transition-colors rounded"
                  style={{
                    background: isActive ? (b?.primaryColor || '#1D5A32') : 'transparent',
                    color: isActive ? (b?.accentColor || '#fff') : '#475569',
                    border: isActive ? 'none' : '1px solid #cbd5e1',
                  }}
                >
                  {bc} activity {isActive ? '' : '·'} {b?.displayName || bc}
                </button>
              )
            })}
            {canSeeAllBrands && (
              <button
                onClick={() => setActiveBrand('all-brands')}
                className="px-3 py-1.5 font-medium text-sm rounded"
                style={{
                  background: isAllBrandsView ? '#92400e' : 'transparent',
                  color: isAllBrandsView ? '#fef3c7' : '#92400e',
                  border: isAllBrandsView ? 'none' : '1px dashed #92400e',
                }}
                title="Cross-brand aggregate, read-only. Every access is audited."
              >
                All Brands (read-only)
              </button>
            )}
            <span className="ml-auto text-xs text-slate-500">
              {isAllBrandsView
                ? 'Cross-brand view. Compose/send/generate disabled. Access logged.'
                : 'Switch brand to see only that brand’s deals, quotes, emails, and docs.'}
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex items-center border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600 -mb-px'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-4">
                  Contact Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-slate-600">Email</p>
                    <p className="text-slate-900 font-medium">{customer.email}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Phone</p>
                    <p className="text-slate-900 font-medium">{customer.phone}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Address</p>
                    <p className="text-slate-900 font-medium">
                      {customer.city}, {customer.country}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-4">
                  Business Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-slate-600">Payment Terms</p>
                    <p className="text-slate-900 font-medium">
                      {customer.paymentTerms}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Credit Limit</p>
                    <p className="text-slate-900 font-medium">
                      {formatCurrency(customer.creditLimit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Status</p>
                    <div className="mt-1">
                      <StatusBadge status={customer.status} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <DataTable
              columns={[
                { key: 'orderNumber', label: 'Order #' },
                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge status={row.status} />,
                },
                {
                  key: 'total',
                  label: 'Total',
                  render: (row) => formatCurrency(row.total),
                },
              ]}
              data={orders}
              isLoading={false}
              onEdit={(order) => navigate(`/orders/${order.id}`)}
              paginated={false}
            />
          )}

          {activeTab === 'quotations' && (
            <DataTable
              columns={[
                { key: 'quotationNumber', label: 'Quotation #' },
                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge status={row.status} />,
                },
                {
                  key: 'amount',
                  label: 'Amount',
                  render: (row) => formatCurrency(row.amount),
                },
              ]}
              data={quotations}
              isLoading={false}
              onEdit={(quote) => navigate(`/quotations/${quote.id}`)}
              paginated={false}
            />
          )}

          {activeTab === 'invoices' && (
            <DataTable
              columns={[
                { key: 'invoiceNumber', label: 'Invoice #' },
                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge status={row.status} />,
                },
                {
                  key: 'amount',
                  label: 'Amount',
                  render: (row) => formatCurrency(row.amount),
                },
              ]}
              data={invoices}
              isLoading={false}
              onEdit={(invoice) => navigate(`/invoices/${invoice.id}`)}
              paginated={false}
            />
          )}

          {activeTab === 'profitability' && (
            <ProfitabilityPanel customerId={id} />
          )}

          {activeTab === 'claims' && (
            <DataTable
              columns={[
                { key: 'claimNumber', label: 'Claim #' },
                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge status={row.status} />,
                },
                { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount) },
              ]}
              data={claims}
              isLoading={false}
              onEdit={(claim) => navigate(`/claims/${claim.id}`)}
              paginated={false}
            />
          )}

          {activeTab === 'documents' && (
            <div className="text-center py-12">
              <p className="text-slate-600">No documents uploaded</p>
            </div>
          )}

          {activeTab === 'chatter' && (
            <ChatterPanel entityType="Customer" entityId={id} />
          )}
        </div>
      </div>

      {/* Schedule Activity */}
      <ScheduleActivityModal
        open={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onCreated={() => setShowActivityModal(false)}
        entityType="Customer"
        entityId={id}
        entityLabel={customer?.name || 'Customer'}
      />

      {/* Phase 4, C18: super-admin sanctions override modal. Requires
          reason ≥ 10 chars; backend audits as sanctions_override and sets
          screeningStatus='override' (does NOT clear flag details). */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Override Sanctions Block</h3>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-slate-700">
                {customer.companyName} matched a sanctions list ({(customer.sanctionsScreenDetails || []).map((h) => h.list).join(', ') || 'multiple lists'}).
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Override is an attestation, not a clear. The flag details remain on file; the override reason becomes the auditable justification. Action is super-admin only and logged as sanctions_override.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Override reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why you are attesting that this match does not block transacting (minimum 10 characters)..."
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {overrideReason.trim().length} / 10 characters minimum.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setShowOverrideModal(false)}
                disabled={overrideSubmitting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (overrideReason.trim().length < 10) {
                    toast.error('Reason must be at least 10 characters.')
                    return
                  }
                  setOverrideSubmitting(true)
                  try {
                    await api.post(`/compliance/customers/${id}/override`, { reason: overrideReason.trim() })
                    toast.success('Sanctions override applied.')
                    setShowOverrideModal(false)
                    setOverrideReason('')
                    fetchCustomer()
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Override failed')
                  } finally {
                    setOverrideSubmitting(false)
                  }
                }}
                disabled={overrideSubmitting || overrideReason.trim().length < 10}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {overrideSubmitting ? 'Applying...' : 'Apply Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
