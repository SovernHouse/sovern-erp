import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Download,
  Send,
  ShoppingCart,
  Trash2,
  Loader,
  X,
  Building2,
  Calendar,
  Link2,
  Copy,
  CheckCircle2,
  CalendarClock,
} from 'lucide-react'
import { proformaAPI, factoriesAPI, approvalAPI } from '../../services/api'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import ScheduleActivityModal from '../../components/ScheduleActivityModal'
import StatusBadge from '../../components/StatusBadge'
import BrandBadge from '../../components/BrandBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import LoadingSpinner from '../../components/LoadingSpinner'
import Chatter from '../../components/Chatter'
import { formatCurrency, formatDate } from '../../utils/formatters'

// ─── Send for Approval modal ──────────────────────────────────────────────────
// Collects optional notes + client contact details, then fires approvalAPI.generate.
// On success, shows a copyable approval link the operator can paste into email/chat.
function SendForApprovalModal({ isOpen, onClose, onSubmit, isLoading, defaultName, defaultEmail }) {
  const [notes, setNotes] = useState('')
  const [clientName, setClientName] = useState(defaultName || '')
  const [clientEmail, setClientEmail] = useState(defaultEmail || '')

  useEffect(() => {
    if (isOpen) {
      setNotes('')
      setClientName(defaultName || '')
      setClientEmail(defaultEmail || '')
    }
  }, [isOpen, defaultName, defaultEmail])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({ notes, clientName, clientEmail })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Request Client Approval</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-sm text-slate-600">
            Generates a secure, time-limited approval link you can send to the client.
            They can review the PI and approve or reject without logging in.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Client Name <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              disabled={isLoading}
              placeholder="e.g. Ahmed Hassan"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Client Email <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              disabled={isLoading}
              placeholder="client@example.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Message to Client <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              placeholder="e.g. Please review and approve this Proforma Invoice at your earliest convenience."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              <span>Generate Approval Link</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Approval link dialog ─────────────────────────────────────────────────────
// Shown after a link is generated. Operator copies and pastes it to the client.
function ApprovalLinkDialog({ isOpen, onClose, approvalUrl }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(approvalUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea')
      el.value = approvalUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-slate-900">Approval Link Generated</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Copy this link and send it to your client. It allows them to review the PI and
            approve or reject without needing an account. The link expires in 30 days.
          </p>

          <div className="flex items-stretch rounded-lg border border-slate-300 overflow-hidden">
            <input
              type="text"
              value={approvalUrl}
              readOnly
              className="flex-1 px-3 py-2.5 text-sm text-slate-700 bg-slate-50 min-w-0"
            />
            <button
              onClick={handleCopy}
              className={`flex items-center space-x-1.5 px-4 text-sm font-medium border-l border-slate-300 transition-colors ${
                copied
                  ? 'bg-green-50 text-green-700'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Convert to Sales Order modal ────────────────────────────────────────────
// Requires factory selection because factoryId is a non-nullable FK on SalesOrder.
// Uses controlled form so the parent loading state disables inputs while the
// API call is in flight.
function ConvertToSOModal({ isOpen, onClose, onConfirm, isLoading }) {
  const [factories, setFactories] = useState([])
  const [factoriesLoading, setFactoriesLoading] = useState(false)
  const [factoryId, setFactoryId] = useState('')
  const [estimatedDelivery, setEstimatedDelivery] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setFactoryId('')
    setEstimatedDelivery('')
    const load = async () => {
      try {
        setFactoriesLoading(true)
        const res = await factoriesAPI.getAll({ limit: 200 })
        setFactories(res.data || [])
      } catch {
        toast.error('Failed to load factories')
      } finally {
        setFactoriesLoading(false)
      }
    }
    load()
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!factoryId) {
      toast.error('Please select a factory')
      return
    }
    onConfirm({ factoryId, estimatedDelivery: estimatedDelivery || undefined })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Convert to Sales Order</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-sm text-slate-600">
            This will mark the PI as{' '}
            <span className="font-medium text-slate-900">Converted</span> and create a
            new Sales Order with the same line items.
          </p>

          {/* Factory selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <Building2 className="w-4 h-4 inline mr-1 align-text-bottom" />
              Factory <span className="text-red-500">*</span>
            </label>
            {factoriesLoading ? (
              <div className="flex items-center space-x-2 text-slate-500 text-sm py-2">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Loading factories...</span>
              </div>
            ) : (
              <select
                value={factoryId}
                onChange={(e) => setFactoryId(e.target.value)}
                required
                disabled={isLoading}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              >
                <option value="">Select a factory...</option>
                {factories.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name || f.companyName}
                    {f.country ? ` (${f.country})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Estimated delivery */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <Calendar className="w-4 h-4 inline mr-1 align-text-bottom" />
              Estimated Delivery{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={estimatedDelivery}
              onChange={(e) => setEstimatedDelivery(e.target.value)}
              disabled={isLoading}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !factoryId}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              <span>Create Sales Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProformaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [pi, setPi] = useState(null)
  useBreadcrumbs(pi?.piNumber || pi?.invoiceNumber || pi?.proformaNumber)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isSending, setIsSending] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [isGeneratingApproval, setIsGeneratingApproval] = useState(false)

  const [showSendConfirm, setShowSendConfirm] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [approvalLink, setApprovalLink] = useState(null)

  useEffect(() => {
    const fetchPI = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await proformaAPI.getById(id)
        setPi(res.data || res)
      } catch (err) {
        const msg =
          err.response?.data?.message || err.message || 'Failed to load Proforma Invoice'
        setError(msg)
        toast.error(msg)
      } finally {
        setIsLoading(false)
      }
    }
    if (id) fetchPI()
  }, [id])

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSend = async () => {
    try {
      setIsSending(true)
      await proformaAPI.send(id)
      setPi((prev) => ({ ...prev, status: 'sent' }))
      toast.success('Proforma Invoice sent to client')
      setShowSendConfirm(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send PI')
    } finally {
      setIsSending(false)
    }
  }

  const handleConvertToSO = async ({ factoryId, estimatedDelivery }) => {
    try {
      setIsConverting(true)
      const res = await proformaAPI.convertToOrder(id, { factoryId, estimatedDelivery })
      toast.success('Sales Order created successfully')
      setShowConvertModal(false)
      const soId = res.data?.salesOrder?.id || res.salesOrder?.id
      navigate(soId ? `/orders/${soId}` : '/orders')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create Sales Order')
    } finally {
      setIsConverting(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true)
      const res = await proformaAPI.getPDF(id)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `${pi?.piNumber || pi?.invoiceNumber || pi?.proformaNumber || 'proforma-invoice'}.pdf`
      )
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download PDF')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await proformaAPI.delete(id)
      toast.success('Proforma Invoice deleted')
      navigate('/proforma-invoices')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete PI')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleGenerateApproval = async ({ notes, clientName, clientEmail }) => {
    try {
      setIsGeneratingApproval(true)
      const res = await approvalAPI.generate({
        entityType: 'ProformaInvoice',
        entityId: id,
        documentLabel: pi?.piNumber || pi?.invoiceNumber || pi?.proformaNumber || 'PI',
        notes: notes || undefined,
        clientName: clientName || undefined,
        clientEmail: clientEmail || undefined,
      })
      const url = res.data?.approvalUrl || res.approvalUrl
      if (!url) throw new Error('No approval URL returned from server')
      setApprovalLink(url)
      setShowApprovalModal(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate approval link')
    } finally {
      setIsGeneratingApproval(false)
    }
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/proforma-invoices')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Proforma Invoices</span>
        </button>
        <LoadingSpinner message="Loading Proforma Invoice..." />
      </div>
    )
  }

  if (error || !pi) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/proforma-invoices')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Proforma Invoices</span>
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error || 'Proforma Invoice not found'}</p>
        </div>
      </div>
    )
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const items = pi.items || []
  const subtotal =
    pi.subtotal != null
      ? parseFloat(pi.subtotal)
      : items.reduce((s, i) => s + parseFloat(i.total || 0), 0)
  const discount = parseFloat(pi.discount || 0)
  const tax = parseFloat(pi.tax || 0)
  const total = pi.total != null ? parseFloat(pi.total) : subtotal - discount + tax

  const piNumber = pi.piNumber || pi.invoiceNumber || pi.proformaNumber || 'PI'
  const canSend = ['draft', 'pending'].includes(pi.status)
  // Phase 4, C16: FW PIs are internal records. The factory sends the actual
  // document to the buyer. UI disables Send; server (proformaInvoiceRoutes.js)
  // re-blocks with fw_send_blocked audit even if someone bypasses the button.
  const isFwInternalRecord = pi.brandCode === 'FW'
  const sendDisabledReason = isFwInternalRecord
    ? 'FlorWay invoices are sent to the buyer by the factory. This document is for internal records only.'
    : null
  const canConvert = ['sent', 'approved', 'confirmed', 'pending'].includes(pi.status)
  const isConverted = pi.status === 'converted'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/proforma-invoices')}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{piNumber}</h1>
            <div className="flex items-center space-x-2 mt-1">
              <BrandBadge code={pi.brandCode || 'SH'} size="sm" />
              <StatusBadge status={pi.status} />
              <span className="text-sm text-slate-400">•</span>
              <span className="text-sm text-slate-500">{formatDate(pi.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setShowActivityModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Schedule Activity</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {isDownloading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>PDF</span>
          </button>

          {canSend && (
            <button
              onClick={() => !isFwInternalRecord && setShowSendConfirm(true)}
              disabled={isSending || isFwInternalRecord}
              title={sendDisabledReason || undefined}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isSending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Send to Client</span>
            </button>
          )}

          {!isConverted && (
            <button
              onClick={() => setShowApprovalModal(true)}
              disabled={isGeneratingApproval}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isGeneratingApproval ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              <span>Request Approval</span>
            </button>
          )}

          {canConvert && (
            <button
              onClick={() => setShowConvertModal(true)}
              disabled={isConverting}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isConverting ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              <span>Convert to Sales Order</span>
            </button>
          )}

          {!isConverted && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Phase 4, C16: FW Proforma Invoices are ERP-internal records. The
          factory sends the document to the buyer. UI disables Send button;
          PDF carries an iron-deep banner; server route audits fw_send_blocked. */}
      {isFwInternalRecord && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 text-slate-50 px-4 py-3">
          <p className="text-sm font-semibold tracking-wide">FACTORY WILL SEND TO BUYER. INTERNAL RECORD</p>
          <p className="text-xs opacity-80 mt-1">{sendDisabledReason}</p>
        </div>
      )}

      {/* Converted banner */}
      {isConverted && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-5 py-4 flex items-center space-x-3">
          <ShoppingCart className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-green-800 text-sm font-medium">
            This PI has been converted to a Sales Order.
            {pi.salesOrderId && (
              <button
                onClick={() => navigate(`/sales-orders/${pi.salesOrderId}`)}
                className="ml-2 underline hover:text-green-900"
              >
                View Sales Order
              </button>
            )}
          </p>
        </div>
      )}

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col — client info, line items, notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Client Information</h2>
            {pi.customer ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5 uppercase tracking-wide">Company</p>
                  <p className="font-medium text-slate-900">
                    {pi.customer.companyName || pi.customer.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5 uppercase tracking-wide">Contact</p>
                  <p className="text-slate-900">
                    {pi.customer.contactName || pi.customer.contact || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5 uppercase tracking-wide">Email</p>
                  <p className="text-slate-900">{pi.customer.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5 uppercase tracking-wide">Country</p>
                  <p className="text-slate-900">{pi.customer.country || '-'}</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No client information available</p>
            )}
          </div>

          {/* Line items */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Line Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">Product</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">Description</th>
                    <th className="px-5 py-3 text-right font-semibold text-slate-700">Qty</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">Unit</th>
                    <th className="px-5 py-3 text-right font-semibold text-slate-700">Unit Price</th>
                    <th className="px-5 py-3 text-right font-semibold text-slate-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? (
                    items.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-4 font-medium text-slate-900">
                          {item.product?.name || item.productName || '-'}
                        </td>
                        <td className="px-5 py-4 text-slate-600">{item.description || '-'}</td>
                        <td className="px-5 py-4 text-right text-slate-900">
                          {parseFloat(item.quantity || 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-slate-600">{item.unit || '-'}</td>
                        <td className="px-5 py-4 text-right text-slate-900">
                          {formatCurrency(item.unitPrice || 0, pi.currency)}
                        </td>
                        <td className="px-5 py-4 text-right font-medium text-slate-900">
                          {formatCurrency(item.total || 0, pi.currency)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-5 py-8 text-center text-slate-400">
                        No line items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Terms / Notes */}
          {(pi.terms || pi.notes) && (
            <div className="grid grid-cols-2 gap-6">
              {pi.terms && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-base font-semibold text-slate-900 mb-3">Terms</h2>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{pi.terms}</p>
                </div>
              )}
              {pi.notes && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-base font-semibold text-slate-900 mb-3">Notes</h2>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{pi.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right col — financial summary + PI metadata */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6 lg:sticky lg:top-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Financial Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-900">{formatCurrency(subtotal, pi.currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Discount</span>
                  <span className="font-medium text-slate-900">-{formatCurrency(discount, pi.currency)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax</span>
                  <span className="font-medium text-slate-900">{formatCurrency(tax, pi.currency)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-3">
                <div className="flex justify-between">
                  <span className="text-base font-semibold text-slate-900">Total</span>
                  <span className="text-base font-bold text-green-700">
                    {formatCurrency(total, pi.currency)}
                  </span>
                </div>
              </div>
              {pi.currency && pi.currency !== 'USD' && (
                <p className="text-xs text-slate-400 pt-1">All amounts in {pi.currency}</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">PI Details</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">PI Number</p>
                <p className="font-medium text-slate-900">{piNumber}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Status</p>
                <StatusBadge status={pi.status} />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Created</p>
                <p className="text-slate-900">{formatDate(pi.createdAt)}</p>
              </div>
              {pi.validUntil && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Valid Until</p>
                  <p className="text-slate-900">{formatDate(pi.validUntil)}</p>
                </div>
              )}
              {pi.paymentTerms && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Payment Terms</p>
                  <p className="text-slate-900">{pi.paymentTerms}</p>
                </div>
              )}
              {pi.incoterms && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Incoterms</p>
                  <p className="font-medium text-slate-900">{pi.incoterms}</p>
                </div>
              )}
              {(pi.quotation || pi.quotationId) && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">
                    Source Quotation
                  </p>
                  <button
                    onClick={() =>
                      navigate(`/quotations/${pi.quotation?.id || pi.quotationId}`)
                    }
                    className="text-primary-600 hover:underline font-medium"
                  >
                    {pi.quotation?.quotationNumber || 'View Quotation'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation dialogs */}
      <ConfirmDialog
        isOpen={showSendConfirm}
        onClose={() => setShowSendConfirm(false)}
        onConfirm={handleSend}
        title="Send Proforma Invoice"
        message="Send this Proforma Invoice to the client by email?"
        confirmText="Send"
        cancelText="Cancel"
        isLoading={isSending}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Proforma Invoice"
        message="Are you sure you want to delete this PI? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
        isDangerous={true}
      />

      <ConvertToSOModal
        isOpen={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        onConfirm={handleConvertToSO}
        isLoading={isConverting}
      />

      <SendForApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onSubmit={handleGenerateApproval}
        isLoading={isGeneratingApproval}
        defaultName={pi?.customer?.contactName || pi?.customer?.name || ''}
        defaultEmail={pi?.customer?.email || ''}
      />

      <ApprovalLinkDialog
        isOpen={!!approvalLink}
        onClose={() => setApprovalLink(null)}
        approvalUrl={approvalLink || ''}
      />

      {/* Phase 4.21a — Odoo chatter parity. ProformaInvoice was already in
          the chatterController whitelist; just mounting the component. */}
      <Chatter entityType="ProformaInvoice" entityId={id} className="mt-6" />

      {/* Schedule Activity */}
      <ScheduleActivityModal
        open={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onCreated={() => setShowActivityModal(false)}
        entityType="ProformaInvoice"
        entityId={id}
        entityLabel={`${pi?.piNumber || 'PI'}${pi?.customer?.name ? ' — ' + pi.customer.name : ''}`}
      />
    </div>
  )
}
