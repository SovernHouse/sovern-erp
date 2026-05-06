import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit2, Trash2 } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import { paymentsAPI, invoicesAPI } from '../../services/api'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function PaymentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [payment, setPayment] = useState(null)
  useBreadcrumbs(payment?.paymentNumber)
  const [invoice, setInvoice] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    fetchPayment()
  }, [id])

  const fetchPayment = async () => {
    try {
      setIsLoading(true)
      const res = await paymentsAPI.getById(id)
      setPayment(res.data)

      // Fetch associated invoice if available
      if (res.data.invoiceId) {
        try {
          const invoiceRes = await invoicesAPI.getById(res.data.invoiceId)
          setInvoice(invoiceRes.data)
        } catch (e) {
          console.error('Failed to fetch invoice:', e)
        }
      }
    } catch (error) {
      console.error('Failed to fetch payment:', error)
      toast.error('Failed to load payment')
      navigate('/payments')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await paymentsAPI.delete(id)
      toast.success('Payment deleted successfully')
      navigate('/payments')
    } catch (error) {
      console.error('Failed to delete payment:', error)
      toast.error('Failed to delete payment')
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (!payment) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/payments')}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Payment #{payment.paymentNumber || payment.id}
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              {formatDate(payment.date)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate(`/payments/${id}/edit`)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Payment Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Status</p>
          <div className="mt-2">
            <StatusBadge status={payment.status} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Amount</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {formatCurrency(payment.amount)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Payment Method</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {payment.paymentMethod || 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Payment Date</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {formatDate(payment.date)}
          </p>
        </div>
      </div>

      {/* Main Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Payment Details
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Information</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-600">Reference Number</p>
                <p className="text-slate-900 font-medium">
                  {payment.referenceNumber || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Payment Method</p>
                <p className="text-slate-900 font-medium">
                  {payment.paymentMethod || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Amount</p>
                <p className="text-slate-900 font-medium">
                  {formatCurrency(payment.amount)}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Payment Date</p>
                <p className="text-slate-900 font-medium">
                  {formatDate(payment.date)}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Associated Invoice</h3>
            {invoice ? (
              <div className="space-y-3 text-sm bg-slate-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-slate-600">Invoice</p>
                  <button
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {invoice.invoiceNumber || invoice.id}
                  </button>
                </div>
                <div>
                  <p className="text-slate-600">Invoice Amount</p>
                  <p className="text-slate-900 font-medium">
                    {formatCurrency(invoice.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">Invoice Date</p>
                  <p className="text-slate-900 font-medium">
                    {formatDate(invoice.date)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-slate-600 text-sm">
                No invoice associated with this payment
              </p>
            )}
          </div>
        </div>

        {payment.notes && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">Notes</h3>
            <p className="text-slate-700 text-sm">{payment.notes}</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        title="Delete Payment"
        message="Are you sure you want to delete this payment? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  )
}
