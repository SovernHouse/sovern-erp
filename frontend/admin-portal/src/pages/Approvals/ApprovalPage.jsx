/**
 * ApprovalPage.jsx
 *
 * PUBLIC page — no login required.
 * Accessed via a link like /approve/:token
 *
 * Shows the client a summary of the document (PI, Quotation, or SO) with two
 * primary actions:
 *   - Approve / Confirm Order
 *   - Reject (with optional reason)
 *
 * After responding, shows a confirmation screen.
 * IP address and user agent are recorded server-side on each response.
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { approvalAPI } from '../../services/api'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader,
  FileText,
  Clock,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(amount, currency = 'USD') {
  if (amount == null) return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// ─── Rejection modal ──────────────────────────────────────────────────────────
function RejectModal({ isOpen, onClose, onConfirm, isLoading }) {
  const [reason, setReason] = useState('')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Reject Document</h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Please let us know why you are rejecting this document so we can address any concerns.
          </p>
          <textarea
            rows={4}
            placeholder="Reason for rejection (optional)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isLoading}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-red-400 disabled:bg-gray-50"
          />
        </div>
        <div className="flex justify-end space-x-3 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            <span>Confirm Rejection</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ApprovalPage() {
  const { token } = useParams()

  const [approvalData, setApprovalData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [clientName, setClientName] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [finalStatus, setFinalStatus] = useState(null) // 'approved' | 'rejected'
  const [alreadyResponded, setAlreadyResponded] = useState(false)

  useEffect(() => {
    const fetchApproval = async () => {
      try {
        setIsLoading(true)
        const res = await approvalAPI.getByToken(token)
        const data = res.data || res
        setApprovalData(data)

        // Already responded
        if (data.status === 'approved' || data.status === 'rejected') {
          setAlreadyResponded(true)
          setFinalStatus(data.status)
        }
      } catch (err) {
        const status = err.response?.status
        if (status === 404) setError('This approval link was not found. It may have been revoked.')
        else if (status === 410) setError('This approval link has expired.')
        else setError(err.response?.data?.message || 'Failed to load document. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }
    if (token) fetchApproval()
  }, [token])

  const handleApprove = async () => {
    try {
      setIsApproving(true)
      await approvalAPI.approve(token, { clientName: clientName.trim() || undefined })
      setFinalStatus('approved')
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async (reason) => {
    try {
      setIsRejecting(true)
      await approvalAPI.reject(token, {
        clientName: clientName.trim() || undefined,
        rejectionReason: reason || undefined,
      })
      setFinalStatus('rejected')
      setShowRejectModal(false)
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setIsRejecting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-gray-500 text-sm">Loading document...</p>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error && !approvalData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-semibold text-gray-900">Link Unavailable</h1>
          <p className="text-gray-600 text-sm">{error}</p>
          <p className="text-gray-400 text-xs">
            If you believe this is a mistake, please contact the sender directly.
          </p>
        </div>
      </div>
    )
  }

  const { document: doc, documentLabel, expiresAt, notes, status } = approvalData || {}

  // ── Final state — already responded or just responded ────────────────────────
  if (finalStatus === 'approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center space-y-4">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Order Confirmed!</h1>
          <p className="text-gray-600">
            Thank you. <span className="font-medium">{documentLabel}</span> has been approved.
            The Sovern House team will be in touch shortly to proceed.
          </p>
          <p className="text-gray-400 text-xs">
            A confirmation has been recorded with your timestamp and IP address.
          </p>
        </div>
      </div>
    )
  }

  if (finalStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center space-y-4">
          <XCircle className="w-14 h-14 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Document Rejected</h1>
          <p className="text-gray-600">
            We have recorded your rejection of <span className="font-medium">{documentLabel}</span>.
            Our team will review your comments and reach out soon.
          </p>
        </div>
      </div>
    )
  }

  if (alreadyResponded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center space-y-4">
          <FileText className="w-12 h-12 text-gray-300 mx-auto" />
          <h1 className="text-xl font-semibold text-gray-900">Already Responded</h1>
          <p className="text-gray-600 text-sm">
            This document has already been{' '}
            <span className={`font-medium ${status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
              {status}
            </span>
            . No further action is needed.
          </p>
        </div>
      </div>
    )
  }

  // ── Main document view ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Branding header */}
        <div className="text-center">
          <p className="text-2xl font-bold tracking-wide text-gray-900">SOVERN HOUSE</p>
          <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-widest">Document Approval</p>
        </div>

        {/* Document summary card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{doc?.type}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{documentLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(doc?.total, doc?.currency)}
              </p>
              {doc?.currency && doc.currency !== 'USD' && (
                <p className="text-xs text-gray-400">{doc.currency}</p>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="px-6 py-4 grid grid-cols-2 gap-3 text-sm border-b border-gray-100">
            {doc?.customer && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Client</p>
                <p className="font-medium text-gray-900">{doc.customer}</p>
              </div>
            )}
            {doc?.paymentTerms && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Payment Terms</p>
                <p className="font-medium text-gray-900">{doc.paymentTerms}</p>
              </div>
            )}
            {doc?.validUntil && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Valid Until</p>
                <p className="font-medium text-gray-900">{formatDate(doc.validUntil)}</p>
              </div>
            )}
            {doc?.estimatedDelivery && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Est. Delivery</p>
                <p className="font-medium text-gray-900">{formatDate(doc.estimatedDelivery)}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          {doc?.items?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Item</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-600">Qty</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Unit</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-600">Unit Price</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-6 py-3 text-gray-900">{item.description || '-'}</td>
                      <td className="px-6 py-3 text-right text-gray-900">
                        {Number(item.quantity || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-gray-500">{item.unit || '-'}</td>
                      <td className="px-6 py-3 text-right text-gray-900">
                        {formatCurrency(item.unitPrice, doc.currency)}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(item.total, doc.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-6 py-3 text-right font-semibold text-gray-900">
                      Total
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-gray-900">
                      {formatCurrency(doc.total, doc.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Notes from sender */}
        {notes && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">Message from Sovern House:</p>
            <p className="whitespace-pre-wrap">{notes}</p>
          </div>
        )}

        {/* Expiry warning */}
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>This link expires on {formatDate(expiresAt)}</span>
        </div>

        {/* Action form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Your Response</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Your Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. John Smith"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              disabled={isApproving || isRejecting}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50"
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className="flex-1 flex items-center justify-center space-x-2 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {isApproving ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <ThumbsUp className="w-5 h-5" />
              )}
              <span>{isApproving ? 'Confirming...' : 'Approve & Confirm Order'}</span>
            </button>

            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isApproving || isRejecting}
              className="flex items-center justify-center space-x-2 px-5 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm border border-red-200"
            >
              <ThumbsDown className="w-5 h-5" />
              <span>Reject</span>
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            By clicking Approve, you confirm your agreement to this document. Your IP address and
            timestamp will be recorded as proof of confirmation.
          </p>
        </div>
      </div>

      <RejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        isLoading={isRejecting}
      />
    </div>
  )
}
