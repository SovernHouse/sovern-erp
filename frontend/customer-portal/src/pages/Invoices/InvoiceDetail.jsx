import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, AlertCircle } from 'lucide-react'
import { invoicesAPI } from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { formatCurrency, formatDate } from '../../utils/formatters'
import toast from 'react-hot-toast'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInvoice()
  }, [id])

  const fetchInvoice = async () => {
    setLoading(true)
    try {
      const response = await invoicesAPI.getById(id)
      setInvoice(response.data)
    } catch (err) {
      console.error('Failed to fetch invoice:', err)
      toast.error('Failed to load invoice')
      navigate('/invoices')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await invoicesAPI.downloadPDF(id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `invoice-${invoice.invoiceNumber}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      toast.success('Invoice downloaded')
    } catch (err) {
      console.error('Failed to download invoice:', err)
      toast.error('Failed to download invoice')
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (!invoice) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Invoice not found</p>
      </div>
    )
  }

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'paid':
        return 'success'
      case 'partial':
        return 'warning'
      case 'overdue':
        return 'danger'
      case 'pending':
        return 'default'
      default:
        return 'default'
    }
  }

  const isOverdue = invoice.status === 'overdue' || invoice.status === 'partial'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/invoices')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Invoice INV-{invoice.invoiceNumber}
          </h1>
          <p className="text-gray-600 mt-1">Issued on {formatDate(invoice.createdAt)}</p>
        </div>
      </div>

      {/* Alert for Overdue Invoices */}
      {isOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-900">Invoice Overdue</p>
            <p className="text-red-800 text-sm">
              This invoice is overdue. Please settle the payment as soon as possible.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Header Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Invoice Number</p>
                <p className="text-lg font-semibold text-gray-900">
                  INV-{invoice.invoiceNumber}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Status</p>
                <div className="mt-1">
                  <StatusBadge
                    status={invoice.status}
                    type="invoice"
                    variant={getStatusBadgeVariant(invoice.status)}
                  />
                </div>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Date Issued</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDate(invoice.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Due Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDate(invoice.dueDate)}
                </p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2 px-3 font-semibold text-gray-900">
                      Description
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-900">
                      Qty
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-900">
                      Unit Price
                    </th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-900">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems && invoice.lineItems.length > 0 ? (
                    invoice.lineItems.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3 text-gray-900">{item.description}</td>
                        <td className="text-right py-3 px-3 text-gray-900">{item.quantity}</td>
                        <td className="text-right py-3 px-3 text-gray-900">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="text-right py-3 px-3 font-semibold text-gray-900">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-4 text-center text-gray-500">
                        No line items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h2>
              <div className="space-y-3">
                {invoice.payments.map((payment, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{payment.method}</p>
                      <p className="text-sm text-gray-600">
                        {formatDate(payment.date)} - Ref: {payment.reference}
                      </p>
                    </div>
                    <p className="font-semibold text-green-600">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Totals */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">SUMMARY</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700">Subtotal</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Tax ({invoice.taxRate}%)</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(invoice.taxAmount)}
                  </span>
                </div>
              )}
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span className="font-medium">-{formatCurrency(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="font-semibold text-gray-900">Total Amount</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(invoice.totalAmount)}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg flex justify-between">
                <span className="font-semibold text-gray-900">Balance Due</span>
                <span
                  className={`text-lg font-bold ${
                    invoice.balanceDue > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {formatCurrency(invoice.balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-3">
            <button
              onClick={handleDownloadPDF}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Download size={18} />
              Download PDF
            </button>
            {invoice.balanceDue > 0 && (
              <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                Pay Now
              </button>
            )}
          </div>

          {/* Invoice Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">DETAILS</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">Reference</p>
                <p className="font-medium text-gray-900">{invoice.reference || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600">PO Number</p>
                <p className="font-medium text-gray-900">{invoice.poNumber || 'N/A'}</p>
              </div>
              {invoice.notes && (
                <div>
                  <p className="text-gray-600">Notes</p>
                  <p className="font-medium text-gray-900">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
