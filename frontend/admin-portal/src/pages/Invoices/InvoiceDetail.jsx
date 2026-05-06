import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Edit2,
  Download,
  CreditCard,
  Trash2,
  Loader,
  CalendarClock,
} from 'lucide-react'
import { invoicesAPI } from '../../services/api'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import ScheduleActivityModal from '../../components/ScheduleActivityModal'
import Chatter from '../../components/Chatter'
import StatusBadge from '../../components/StatusBadge'
import DocumentGenerateButton from '../../components/DocumentGenerateButton'
import ConfirmDialog from '../../components/ConfirmDialog'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters'
import { INVOICE_STATUS } from '../../utils/constants'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [invoice, setInvoice] = useState(null)
  useBreadcrumbs(invoice?.invoiceNumber)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRecordingPayment, setIsRecordingPayment] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showLargePaymentConfirm, setShowLargePaymentConfirm] = useState(false)
  const LARGE_PAYMENT_THRESHOLD = 10000
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'bank_transfer',
    referenceNumber: '',
    notes: '',
  })
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await invoicesAPI.getById(id)
        setInvoice(res.data || res)
        // Set default payment amount to remaining balance
        const balance = (res.data || res).balance || (res.data || res).total - (res.data || res).paidAmount || 0
        setPaymentForm((prev) => ({
          ...prev,
          amount: balance > 0 ? balance.toString() : '',
        }))
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.message || 'Failed to load invoice'
        setError(errorMsg)
        toast.error(errorMsg)
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchInvoice()
    }
  }, [id])

  const handleRecordPayment = async (e) => {
    if (e && e.preventDefault) e.preventDefault()

    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    // Require explicit confirmation for large payments
    if (parseFloat(paymentForm.amount) >= LARGE_PAYMENT_THRESHOLD && !showLargePaymentConfirm) {
      setShowLargePaymentConfirm(true)
      return
    }
    setShowLargePaymentConfirm(false)

    try {
      setIsRecordingPayment(true)
      const payload = {
        amount: parseFloat(paymentForm.amount),
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        referenceNumber: paymentForm.referenceNumber,
        notes: paymentForm.notes,
      }

      await invoicesAPI.recordPayment(id, payload)

      // Update invoice data
      const updatedPaidAmount = (invoice.paidAmount || 0) + parseFloat(paymentForm.amount)
      const newBalance = (invoice.total || 0) - updatedPaidAmount
      const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid'

      setInvoice({
        ...invoice,
        paidAmount: updatedPaidAmount,
        balance: newBalance,
        status: newStatus,
      })

      toast.success('Payment recorded successfully')
      setShowPaymentModal(false)

      // Reset form
      setPaymentForm({
        amount: newBalance > 0 ? newBalance.toString() : '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'bank_transfer',
        referenceNumber: '',
        notes: '',
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment')
    } finally {
      setIsRecordingPayment(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true)
      const res = await invoicesAPI.getPDF(id)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${invoice?.invoiceNumber || 'invoice'}.pdf`)
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
      await invoicesAPI.delete(id)
      toast.success('Invoice deleted successfully')
      navigate('/invoices')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete invoice')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Invoices</span>
        </button>
        <LoadingSpinner message="Loading invoice details..." />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Invoices</span>
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error || 'Invoice not found'}</p>
        </div>
      </div>
    )
  }

  const subtotal = invoice.subtotal || 0
  const discountAmount = invoice.discountAmount || (invoice.discount || 0)
  const taxAmount = invoice.taxAmount || (invoice.tax || 0)
  const total = invoice.total || subtotal - discountAmount + taxAmount
  const paidAmount = invoice.paidAmount || 0
  const balance = invoice.balance !== undefined ? invoice.balance : total - paidAmount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{invoice.invoiceNumber || 'Invoice'}</h1>
            <div className="flex items-center space-x-2 mt-2">
              <StatusBadge status={invoice.status} />
              <span className="text-sm text-slate-500">•</span>
              <span className="text-sm text-slate-600">{formatDate(invoice.createdAt)}</span>
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
            documentType="invoice"
            entityId={id}
            entityData={invoice}
            label="Generate Doc"
          />
          <button
            onClick={() => navigate(`/invoices/${id}/edit`)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </button>
          {balance > 0 && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              <span>Record Payment</span>
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Invoice Details */}
        <div className="col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Customer Information</h2>
            {invoice.customer ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Customer Name</p>
                  <p className="text-slate-900 font-medium">{invoice.customer.name || invoice.customerName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email</p>
                  <p className="text-slate-900">{invoice.customer.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Phone</p>
                  <p className="text-slate-900">{invoice.customer.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Country</p>
                  <p className="text-slate-900">{invoice.customer.country || '-'}</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No customer information available</p>
            )}
          </div>

          {/* Linked Sales Order */}
          {invoice.linkedSalesOrder && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Linked Sales Order</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-900 font-medium">{invoice.linkedSalesOrder.orderNumber || '-'}</p>
                  <p className="text-sm text-slate-500 mt-1">{invoice.linkedSalesOrder.customerName || '-'}</p>
                </div>
                <button
                  onClick={() => navigate(`/orders/${invoice.linkedSalesOrder.id}`)}
                  className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                >
                  View Order →
                </button>
              </div>
            </div>
          )}

          {/* Line Items / Details */}
          {invoice.lineItems && invoice.lineItems.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Invoice Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Description</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Quantity</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Unit Price</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-900">
                          <p className="font-medium">{item.description || '-'}</p>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-900">
                          {formatNumber(item.quantity || 0, 2)}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-900">
                          {formatCurrency(item.unitPrice || 0)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                          {formatCurrency(item.amount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Notes</h2>
              <p className="text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column - Financial Summary */}
        <div className="space-y-6">
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

              {/* Payment Status */}
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Paid Amount</span>
                  <span className="text-slate-900 font-medium">{formatCurrency(paidAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Balance Due</span>
                  <span className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(balance)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Metadata */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Invoice Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500 mb-1">Invoice Type</p>
                <p className="text-slate-900 capitalize">{invoice.type || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Issue Date</p>
                <p className="text-slate-900">{formatDate(invoice.createdAt)}</p>
              </div>
              {invoice.dueDate && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Due Date</p>
                  <p className="text-slate-900">{formatDate(invoice.dueDate)}</p>
                </div>
              )}
              {invoice.paymentTerms && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Payment Terms</p>
                  <p className="text-slate-900">{invoice.paymentTerms}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Payment"
        size="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payment Amount *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={balance}
              value={paymentForm.amount}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, amount: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
              placeholder="0.00"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Outstanding balance: {formatCurrency(balance)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              value={paymentForm.paymentDate}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, paymentDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payment Method *
            </label>
            <select
              value={paymentForm.paymentMethod}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
              required
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="check">Check</option>
              <option value="credit_card">Credit Card</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reference Number
            </label>
            <input
              type="text"
              value={paymentForm.referenceNumber}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
              placeholder="e.g., Check #, Transfer ID, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={paymentForm.notes}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, notes: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
              placeholder="Additional notes about this payment"
              rows="3"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              disabled={isRecordingPayment}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRecordingPayment}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isRecordingPayment && <Loader className="w-4 h-4 animate-spin" />}
              <span>{isRecordingPayment ? 'Recording...' : 'Record Payment'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
        isDangerous={true}
      />

      {/* Large payment confirmation — fires for amounts >= $10,000 */}
      <ConfirmDialog
        isOpen={showLargePaymentConfirm}
        onClose={() => setShowLargePaymentConfirm(false)}
        onConfirm={() => handleRecordPayment(null)}
        title="Confirm Large Payment"
        message={`You are recording a payment of $${parseFloat(paymentForm.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD. Please verify the amount and reference number before proceeding.`}
        confirmText="Confirm Payment"
        cancelText="Go Back"
        isDangerous={false}
      />

      {/* Chatter */}
      <Chatter entityType="Invoice" entityId={id} className="mt-6" />

      {/* Schedule Activity */}
      <ScheduleActivityModal
        open={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onCreated={() => setShowActivityModal(false)}
        entityType="Invoice"
        entityId={id}
        entityLabel={`${invoice?.invoiceNumber || 'Invoice'}${invoice?.customer?.name ? ' — ' + invoice.customer.name : ''}`}
      />
    </div>
  )
}
