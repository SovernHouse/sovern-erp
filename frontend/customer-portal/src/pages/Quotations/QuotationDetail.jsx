import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, ArrowLeft, MessageSquare } from 'lucide-react'
import { quotationsAPI } from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusBadge from '../../components/StatusBadge'
import { formatCurrency, formatDate } from '../../utils/formatters'
import toast from 'react-hot-toast'

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(null)

  useEffect(() => {
    fetchQuotation()
  }, [id])

  const fetchQuotation = async () => {
    setLoading(true)
    try {
      const response = await quotationsAPI.getById(id)
      setQuotation(response.data.quotation)
    } catch (err) {
      console.error('Failed to fetch quotation:', err)
      toast.error('Failed to load quotation')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    setConfirming(true)
    try {
      await quotationsAPI.accept(id)
      toast.success('Quotation accepted! Order created.')
      fetchQuotation()
      navigate('/orders')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept quotation')
    } finally {
      setConfirming(false)
      setShowConfirmDialog(null)
    }
  }

  const handleReject = async () => {
    setConfirming(true)
    try {
      await quotationsAPI.reject(id)
      toast.success('Quotation rejected')
      fetchQuotation()
    } catch (err) {
      toast.error('Failed to reject quotation')
    } finally {
      setConfirming(false)
      setShowConfirmDialog(null)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await quotationsAPI.downloadPDF(id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `quotation-${id}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentElement.removeChild(link)
    } catch (err) {
      toast.error('Failed to download PDF')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner text="Loading quotation..." />
      </div>
    )
  }

  if (!quotation) {
    return (
      <EmptyState
        title="Quotation not found"
        message="The quotation you're looking for doesn't exist."
        actionText="Back to Quotations"
        action={() => navigate('/quotations')}
      />
    )
  }

  const canAccept = quotation.status === 'PENDING' || quotation.status === 'REVISION_REQUESTED'
  const canReject = quotation.status === 'PENDING' || quotation.status === 'REVISION_REQUESTED'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/quotations')}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <ArrowLeft size={20} />
          Back to Quotations
        </button>
        <button
          onClick={handleDownloadPDF}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <Download size={18} />
          Download PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500">Quotation Number</p>
                <h1 className="text-2xl font-bold text-gray-900">QT-{String(id).padStart(6, '0')}</h1>
              </div>
              <StatusBadge status={quotation.status} type="quotation" />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-semibold text-gray-900">{formatDate(quotation.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Valid Until</p>
                <p className="font-semibold text-gray-900">
                  {quotation.expiresAt ? formatDate(quotation.expiresAt) : 'No expiry'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Items</p>
                <p className="font-semibold text-gray-900">{quotation.items?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quoted Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Product</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Qty</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Unit Price</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quotation.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-4 px-4 text-gray-900">{item.productName}</td>
                      <td className="py-4 px-4 text-right text-gray-900">{item.quantity}</td>
                      <td className="py-4 px-4 text-right text-gray-900">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(quotation.subtotal)}
                </span>
              </div>
              {quotation.discount > 0 && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-semibold text-accent-600">
                    -{formatCurrency(quotation.discount)}
                  </span>
                </div>
              )}
              {quotation.tax > 0 && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(quotation.tax)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-primary-600">
                  {formatCurrency(quotation.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="card p-6 bg-blue-50 border border-blue-200">
              <h2 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <MessageSquare size={18} />
                Notes
              </h2>
              <p className="text-blue-800">{quotation.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          {(canAccept || canReject) && (
            <div className="card p-6 space-y-3">
              <h3 className="font-semibold text-gray-900">Actions</h3>
              {canAccept && (
                <button
                  onClick={() => setShowConfirmDialog('accept')}
                  className="w-full btn-primary"
                >
                  Accept Quotation
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => setShowConfirmDialog('reject')}
                  className="w-full btn-outline"
                >
                  Reject Quotation
                </button>
              )}
              {quotation.status === 'PENDING' && (
                <p className="text-xs text-gray-600 pt-2">
                  This quotation is valid until {formatDate(quotation.expiresAt)}
                </p>
              )}
            </div>
          )}

          {/* Status Card */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Status</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Current Status</p>
                <StatusBadge status={quotation.status} type="quotation" className="mt-2" />
              </div>
              {quotation.validUntil && (
                <div>
                  <p className="text-sm text-gray-600">Valid Until</p>
                  <p className="font-semibold text-gray-900">{formatDate(quotation.validUntil)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Company Info */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quote From</h3>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900">{quotation.supplierName || 'Sovern House'}</p>
              <p className="text-gray-600">{quotation.supplierEmail || 'sales@sovernhouse.co'}</p>
              <p className="text-gray-600">{quotation.supplierPhone || '+886 970 781 818'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showConfirmDialog === 'accept'}
        onClose={() => setShowConfirmDialog(null)}
        onConfirm={handleAccept}
        title="Accept Quotation"
        message="Are you sure you want to accept this quotation? This will create a purchase order."
        confirmText="Accept"
        loading={confirming}
      />
      <ConfirmDialog
        isOpen={showConfirmDialog === 'reject'}
        onClose={() => setShowConfirmDialog(null)}
        onConfirm={handleReject}
        title="Reject Quotation"
        message="Are you sure you want to reject this quotation?"
        confirmText="Reject"
        isDangerous
        loading={confirming}
      />
    </div>
  )
}
