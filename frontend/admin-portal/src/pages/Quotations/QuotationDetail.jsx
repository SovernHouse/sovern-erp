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
} from 'lucide-react'
import { quotationsAPI } from '../../services/api'
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

  const [quotation, setQuotation] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSendConfirm, setShowSendConfirm] = useState(false)
  const [showConvertConfirm, setShowConvertConfirm] = useState(false)
  const [error, setError] = useState(null)

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
  const canConvert = ['approved', 'sent'].includes(quotation.status)

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
              onClick={() => setShowSendConfirm(true)}
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

      {/* Send Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSendConfirm}
        onClose={() => setShowSendConfirm(false)}
        onConfirm={handleSend}
        title="Send Quotation"
        message="Are you sure you want to send this quotation to the customer?"
        confirmText="Send"
        cancelText="Cancel"
        isLoading={isSending}
      />

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
    </div>
  )
}
