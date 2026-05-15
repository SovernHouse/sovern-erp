import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Edit2,
  Download,
  Send,
  Copy,
  Trash2,
  FileText,
  Loader,
  CalendarClock,
  Truck,
} from 'lucide-react'
import { quotationsAPI, ordersAPI, factoriesAPI, tariffRatesAPI } from '../../services/api'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import { useBrands } from '../../contexts/BrandsContext'
import BrandBadge from '../../components/BrandBadge'
import ScheduleActivityModal from '../../components/ScheduleActivityModal'
import Chatter from '../../components/Chatter'
import WorkflowStatusBar, { QUOTATION_STAGES } from '../../components/WorkflowStatusBar'
import ApprovalPanel from '../../components/ApprovalPanel'
import StatusBadge from '../../components/StatusBadge'
import DocumentGenerateButton from '../../components/DocumentGenerateButton'
import ConfirmDialog from '../../components/ConfirmDialog'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters'
import { QUOTATION_STATUS } from '../../utils/constants'

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getBrand, accessibleBrands } = useBrands()

  const [quotation, setQuotation] = useState(null)
  useBreadcrumbs(quotation?.quotationNumber)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isConvertingToSO, setIsConvertingToSO] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSendConfirm, setShowSendConfirm] = useState(false)
  const [showConvertConfirm, setShowConvertConfirm] = useState(false)
  const [showConvertToSOModal, setShowConvertToSOModal] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [error, setError] = useState(null)

  // Phase 4, C16: Convert-to-SO modal state.
  const [factories, setFactories] = useState([])
  const [soFactoryId, setSoFactoryId] = useState('')
  const [soEstimatedDelivery, setSoEstimatedDelivery] = useState('')
  const [soShippingMethod, setSoShippingMethod] = useState('')
  const [soNotes, setSoNotes] = useState('')

  // Phase 4.9 C-5: tariff snapshot status per line, computed when the
  // send dialog opens. { hardBlocks: [{line, reason}], warnings: [{...}] }
  const [tariffPreflight, setTariffPreflight] = useState({ hardBlocks: [], warnings: [], checked: false })

  useEffect(() => {
    const fetchQuotation = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await quotationsAPI.getById(id)
        setQuotation(res.data || res)
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.message || 'Failed to load quotation'
        setError(errorMsg)
        toast.error(errorMsg)
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchQuotation()
    }
  }, [id])

  const handleSend = async () => {
    try {
      setIsSending(true)
      await quotationsAPI.send(id)
      setQuotation({ ...quotation, status: 'sent' })
      toast.success('Quotation sent successfully')
      setShowSendConfirm(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send quotation')
    } finally {
      setIsSending(false)
    }
  }

  // Phase 4.9 C-5: pre-flight the tariff state before opening the send
  // dialog. Hard-block when a line has an origin but no active tariff
  // for (origin -> US). Warn when an active tariff expires within 7 days
  // or is already expired. Non-US destinations are no-op.
  const openSendDialog = async () => {
    const dest = (quotation?.customer?.country || '').toUpperCase()
    const isUS = dest === 'US' || dest === 'USA'
    if (!isUS) {
      setTariffPreflight({ hardBlocks: [], warnings: [], checked: true })
      setShowSendConfirm(true)
      return
    }
    try {
      const res = await tariffRatesAPI.getAll({ includeExpired: true })
      const all = Array.isArray(res.data) ? res.data : []
      const today = new Date().toISOString().slice(0, 10)
      const hardBlocks = []
      const warnings = []
      for (const item of (quotation.items || [])) {
        const origin = (item.originCountry || '').toUpperCase()
        if (!origin) continue
        const candidates = all.filter(r =>
          r.originCountry === origin &&
          r.destinationCountry === dest &&
          r.effectiveFrom <= today &&
          r.effectiveUntil >= today
        )
        const brandHit = candidates.find(r => r.brandCode === quotation.brandCode)
        const tariff = brandHit || candidates.find(r => !r.brandCode) || candidates[0]
        const lineLabel = item.description || item.product?.name || item.productId
        if (!tariff) {
          hardBlocks.push({ line: lineLabel, origin, reason: 'No active tariff' })
          continue
        }
        const daysLeft = Math.round((new Date(tariff.effectiveUntil).getTime() - new Date(today).getTime()) / 86400000)
        if (daysLeft <= 7) {
          warnings.push({ line: lineLabel, origin, ratePercent: Number(tariff.ratePercent), expires: tariff.effectiveUntil, daysLeft })
        }
      }
      setTariffPreflight({ hardBlocks, warnings, checked: true })
    } catch (e) {
      setTariffPreflight({ hardBlocks: [], warnings: [], checked: true })
    }
    setShowSendConfirm(true)
  }

  const handleConvertToPI = async () => {
    try {
      setIsConverting(true)
      const res = await quotationsAPI.convertToPI(id)
      toast.success('Quotation converted to Proforma Invoice')
      navigate(`/proforma-invoices/${res.data?.id || res?.id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to convert quotation')
    } finally {
      setIsConverting(false)
      setShowConvertConfirm(false)
    }
  }

  // Phase 4, C16: open modal, preload factories list, prefill factory from quote.
  const openConvertToSO = async () => {
    setSoFactoryId(quotation.factoryId || quotation.factory?.id || '')
    setSoEstimatedDelivery('')
    setSoShippingMethod('')
    setSoNotes('')
    setShowConvertToSOModal(true)
    try {
      const res = await factoriesAPI.getAll({ limit: 200 })
      setFactories(res.data?.data || res.data || [])
    } catch {
      setFactories([])
    }
  }

  const handleConvertToSO = async () => {
    if (!soFactoryId) {
      toast.error('Factory is required to create a Sales Order')
      return
    }
    try {
      setIsConvertingToSO(true)
      const res = await ordersAPI.createFromQuotation({
        quotationId: id,
        factoryId: soFactoryId,
        estimatedDelivery: soEstimatedDelivery || undefined,
        shippingMethod: soShippingMethod || undefined,
        notes: soNotes || undefined,
      })
      const soId = res.data?.data?.id || res.data?.id || res?.id
      toast.success('Sales Order created from quotation')
      setShowConvertToSOModal(false)
      if (soId) navigate(`/sales-orders/${soId}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create Sales Order')
    } finally {
      setIsConvertingToSO(false)
    }
  }

  const handleDuplicate = async () => {
    try {
      setIsDuplicating(true)
      const res = await quotationsAPI.duplicate(id)
      toast.success('Quotation duplicated successfully')
      navigate(`/quotations/${res.data?.id || res?.id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to duplicate quotation')
    } finally {
      setIsDuplicating(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true)
      const res = await quotationsAPI.getPDF(id)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${quotation?.quotationNumber || 'quotation'}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('PDF downloaded successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download PDF')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await quotationsAPI.delete(id)
      toast.success('Quotation deleted successfully')
      navigate('/quotations')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete quotation')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/quotations')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Quotations</span>
        </button>
        <LoadingSpinner message="Loading quotation details..." />
      </div>
    )
  }

  if (error || !quotation) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/quotations')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Quotations</span>
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error || 'Quotation not found'}</p>
        </div>
      </div>
    )
  }

  const lineItems = quotation.lineItems || []
  const subtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0)
  const discountAmount = quotation.discountAmount || (quotation.discount || 0)
  const taxAmount = quotation.taxAmount || (quotation.tax || 0)
  const total = quotation.total || subtotal - discountAmount + taxAmount

  const canSend = quotation.status === 'draft'
  // Phase 4, C16: Quotation status enum is draft/sent/revised/accepted/rejected/expired.
  // 'approved' was a stale reference (never on the model) — fixed.
  // Convert-to-PI: allowed from 'sent' or 'accepted'.
  const canConvert = ['sent', 'accepted'].includes(quotation.status)
  const brand = getBrand(quotation.brandCode || 'SH')
  const brandEmail = brand?.senderEmail || 'alex@sovernhouse.co'
  // Phase 4, C16: Convert-to-SO requires formal acceptance + brand access.
  // Backend re-validates via brandScope gate; this just hides the button
  // when the user has no business clicking it.
  const quoteBrand = quotation.brandCode || 'SH'
  const hasBrandAccess = !accessibleBrands || accessibleBrands.length === 0 || accessibleBrands.includes(quoteBrand)
  const canConvertToSO = quotation.status === 'accepted' && hasBrandAccess

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/quotations')}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{quotation.quotationNumber || 'Quotation'}</h1>
            <div className="flex items-center space-x-2 mt-2">
              <BrandBadge code={quotation.brandCode || 'SH'} size="sm" />
              <StatusBadge status={quotation.status} />
              <span className="text-sm text-slate-500">•</span>
              <span className="text-sm text-slate-600">v{quotation.version || 1}</span>
              <span className="text-sm text-slate-500">•</span>
              <span className="text-sm text-slate-600">{formatDate(quotation.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowActivityModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Schedule Activity</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>PDF</span>
          </button>
          <DocumentGenerateButton
            documentType="quotation"
            entityId={id}
            entityData={quotation}
            label="Generate Doc"
          />
          <button
            onClick={() => navigate(`/quotations/${id}/edit`)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </button>
          {canSend && (
            <button
              onClick={openSendDialog}
              disabled={isSending}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSending ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Send</span>
            </button>
          )}
          {canConvert && (
            <button
              onClick={() => setShowConvertConfirm(true)}
              disabled={isConverting}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isConverting ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>Convert to PI</span>
            </button>
          )}
          {canConvertToSO && (
            <button
              onClick={openConvertToSO}
              disabled={isConvertingToSO}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
              title="Create a Sales Order from this accepted quotation"
            >
              {isConvertingToSO ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
              <span>Convert to SO</span>
            </button>
          )}
          <button
            onClick={handleDuplicate}
            disabled={isDuplicating}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {isDuplicating ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span>Duplicate</span>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Workflow Stage Bar */}
      <WorkflowStatusBar stages={QUOTATION_STAGES} currentStatus={quotation.status} />

      {/* Phase 3, C9: FW variant hint banner. The PDF renderer picks the
          variant from customer.productBrandingMode. Surface it here so the
          user knows what the buyer will see before clicking Download. */}
      {quotation.brandCode === 'FW' && (
        (() => {
          const mode = quotation.customer?.productBrandingMode
          const labels = {
            ironlite: {
              tone: 'bg-slate-900 text-slate-50',
              title: 'IronLite Core branding',
              detail: 'PDF renders with the IronLite I-Beam wordmark, OEM badge, and (for WPC product) a construction diagram addendum page.',
            },
            generic: {
              tone: 'bg-slate-100 text-slate-900',
              title: 'FlorWay generic',
              detail: 'PDF renders under the FlorWay Sdn. Bhd. wordmark. No IronLite imagery or OEM badge.',
            },
            private_label: {
              tone: 'bg-amber-50 text-amber-900 border border-amber-200',
              title: 'Private Label template in development',
              detail: `PDF will render with the FlorWay generic layout. The full private-label template, including "Manufactured exclusively for ${quotation.customer?.privateLabelProductName || 'the buyer'}" framing, ships once the first OEM private-label buyer signs.`,
            },
          }
          const fallback = {
            tone: 'bg-slate-50 text-slate-700 border border-slate-200',
            title: 'FlorWay generic (no productBrandingMode set)',
            detail: 'Set the customer\'s product branding mode on their detail page to render an IronLite or Private Label quotation.',
          }
          const info = labels[mode] || fallback
          return (
            <div className={`rounded-lg p-4 ${info.tone}`}>
              <p className="text-sm font-semibold mb-1">FlorWay quotation document  ·  {info.title}</p>
              <p className="text-xs leading-relaxed opacity-90">{info.detail}</p>
            </div>
          )
        })()
      )}

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Quotation Details */}
        <div className="col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Customer Information</h2>
            {quotation.customer ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Customer Name</p>
                  <p className="text-slate-900 font-medium">{quotation.customer.name || quotation.customerName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email</p>
                  <p className="text-slate-900">{quotation.customer.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Phone</p>
                  <p className="text-slate-900">{quotation.customer.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Country</p>
                  <p className="text-slate-900">{quotation.customer.country || '-'}</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No customer information available</p>
            )}
          </div>

          {/* Sourcing Trail — factory and originating lead links */}
          {(quotation.factory || quotation.lead) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Sourcing Trail</h2>
              <div className="grid grid-cols-2 gap-4">
                {quotation.factory && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Source factory</p>
                    <p className="text-slate-900 font-medium">{quotation.factory.companyName}</p>
                    {quotation.factory.country && (
                      <p className="text-xs text-slate-500 mt-1">{quotation.factory.country}</p>
                    )}
                  </div>
                )}
                {quotation.lead && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Originating lead</p>
                    <p className="text-slate-900 font-medium">{quotation.lead.companyName}</p>
                    {quotation.lead.contactName && (
                      <p className="text-xs text-slate-500 mt-1">Contact: {quotation.lead.contactName}</p>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                These links carry forward into the PI / Sales Order / Invoice generated from this quote.
              </p>
            </div>
          )}

          {/* Line Items */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Quoted Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Product</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Description</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Quantity</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Unit</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Unit Price</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Discount</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length > 0 ? (
                    lineItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-900">
                          <p className="font-medium">{item.productName || item.product?.name || '-'}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {item.description || '-'}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-900">
                          {formatNumber(item.quantity || 0, 2)}
                        </td>
                        <td className="px-6 py-4 text-slate-900">{item.unit || '-'}</td>
                        <td className="px-6 py-4 text-right text-slate-900">
                          {formatCurrency(item.unitPrice || 0)}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-900">
                          {item.discount ? formatCurrency(item.discount) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                          {formatCurrency(item.total || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                        No items in this quotation
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Terms & Notes */}
          <div className="grid grid-cols-2 gap-6">
            {quotation.terms && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Terms</h2>
                <p className="text-slate-700 whitespace-pre-wrap text-sm">{quotation.terms}</p>
              </div>
            )}
            {quotation.notes && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Notes</h2>
                <p className="text-slate-700 whitespace-pre-wrap text-sm">{quotation.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Financial Summary + Approval */}
        <div className="space-y-6">
          {/* Internal Approval Panel */}
          <ApprovalPanel
            entityType="Quotation"
            entityId={quotation.id}
            approvalType="send_quotation"
          />

          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Financial Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="text-slate-900 font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Discount</span>
                  <span className="text-slate-900 font-medium">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Tax</span>
                  <span className="text-slate-900 font-medium">{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-3 mt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-slate-900">Total</span>
                  <span className="text-lg font-semibold text-primary-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quotation Metadata */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quotation Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500 mb-1">Created Date</p>
                <p className="text-slate-900">{formatDate(quotation.createdAt)}</p>
              </div>
              {quotation.validUntil && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Valid Until</p>
                  <p className="text-slate-900">{formatDate(quotation.validUntil)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-500 mb-1">Version</p>
                <p className="text-slate-900">v{quotation.version || 1}</p>
              </div>
              {quotation.paymentTerms && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Payment Terms</p>
                  <p className="text-slate-900">{quotation.paymentTerms}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chatter */}
      <Chatter entityType="Quotation" entityId={quotation.id} className="mt-6" />

      {/* Send Confirmation Dialog. Phase 4.9 C-5: extra tariff warnings
          surface inside the dialog when destination is US. Hard-block when
          a line has an origin but no active tariff. */}
      <ConfirmDialog
        isOpen={showSendConfirm}
        onClose={() => setShowSendConfirm(false)}
        onConfirm={handleSend}
        title="Send Quotation"
        message={`Send ${quotation.quotationNumber} to ${quotation.customer?.companyName || 'customer'} via ${brandEmail}?`}
        confirmText="Send"
        cancelText="Cancel"
        isLoading={isSending}
        disableConfirm={tariffPreflight.hardBlocks.length > 0}
      >
        {tariffPreflight.hardBlocks.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-300 rounded text-sm text-red-900">
            <p className="font-semibold mb-2">Cannot send: missing tariff rate</p>
            {tariffPreflight.hardBlocks.map((b, i) => (
              <div key={i} className="text-xs mb-1">
                · <span className="font-medium">{b.line}</span> ({b.origin} → US): {b.reason}
              </div>
            ))}
            <p className="text-xs mt-2">
              Add the missing rate in <span className="font-mono">Settings → Tariff rates</span> first.
            </p>
          </div>
        )}
        {tariffPreflight.warnings.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded text-sm text-amber-900">
            <p className="font-semibold mb-2">Tariff rate(s) expiring soon — confirm with factory before sending</p>
            {tariffPreflight.warnings.map((w, i) => (
              <div key={i} className="text-xs mb-1">
                · <span className="font-medium">{w.line}</span> ({w.origin} → US, <span className="font-mono">{w.ratePercent.toFixed(4)}%</span>):{' '}
                {w.daysLeft < 0 ? `expired ${-w.daysLeft}d ago` : `expires in ${w.daysLeft}d (${w.expires})`}
              </div>
            ))}
          </div>
        )}
      </ConfirmDialog>

      {/* Convert to PI Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConvertConfirm}
        onClose={() => setShowConvertConfirm(false)}
        onConfirm={handleConvertToPI}
        title="Convert to Proforma Invoice"
        message="Are you sure you want to convert this quotation to a Proforma Invoice? This action is typically irreversible."
        confirmText="Convert"
        cancelText="Cancel"
        isLoading={isConverting}
      />

      {/* Phase 4, C16: Convert to Sales Order modal */}
      {showConvertToSOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Convert to Sales Order</h3>
              <button
                onClick={() => setShowConvertToSOModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {quoteBrand === 'FW' && (
                <div className="rounded-md bg-slate-900 text-slate-50 px-3 py-2 text-xs">
                  <p className="font-semibold">FlorWay internal record</p>
                  <p className="opacity-80 mt-0.5">
                    The factory sends the document to the buyer. This Sales Order, its PI, and Invoice are ERP-internal records only.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Factory <span className="text-red-600">*</span>
                </label>
                <select
                  value={soFactoryId}
                  onChange={(e) => setSoFactoryId(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select a factory...</option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.companyName || f.name}{f.country ? ` (${f.country})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Defaults to the quotation factory. Must match an existing factory.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estimated Delivery
                </label>
                <input
                  type="date"
                  value={soEstimatedDelivery}
                  onChange={(e) => setSoEstimatedDelivery(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Shipping Method
                </label>
                <input
                  type="text"
                  value={soShippingMethod}
                  onChange={(e) => setSoShippingMethod(e.target.value)}
                  placeholder="e.g. FOB Shanghai, CIF Alexandria"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={soNotes}
                  onChange={(e) => setSoNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setShowConvertToSOModal(false)}
                disabled={isConvertingToSO}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertToSO}
                disabled={isConvertingToSO || !soFactoryId}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 flex items-center space-x-2"
              >
                {isConvertingToSO && <Loader className="w-4 h-4 animate-spin" />}
                <span>Create Sales Order</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Quotation"
        message="Are you sure you want to delete this quotation? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
        isDangerous={true}
      />

      {/* Schedule Activity */}
      <ScheduleActivityModal
        open={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onCreated={() => setShowActivityModal(false)}
        entityType="Quotation"
        entityId={id}
        entityLabel={`${quotation?.quotationNumber || 'Quotation'}${quotation?.customer?.name ? ' — ' + quotation.customer.name : ''}`}
      />
    </div>
  )
}
