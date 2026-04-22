import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Download, ArrowLeft, FileText, AlertCircle } from 'lucide-react'
import { ordersAPI } from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import OrderTracker from '../../components/OrderTracker'
import ShipmentTimeline from '../../components/ShipmentTimeline'
import StatusBadge from '../../components/StatusBadge'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { PAYMENT_STATUS_COLORS } from '../../utils/constants'
import toast from 'react-hot-toast'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [documents, setDocuments] = useState([])
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrderData()
  }, [id])

  const fetchOrderData = async () => {
    setLoading(true)
    try {
      const [orderRes, docsRes, shipsRes] = await Promise.all([
        ordersAPI.getById(id),
        ordersAPI.getDocuments(id),
        ordersAPI.getShipments(id),
      ])

      setOrder(orderRes.data.order)
      setDocuments(docsRes.data.documents || [])
      setShipments(shipsRes.data.shipments || [])
    } catch (err) {
      console.error('Failed to fetch order data:', err)
      toast.error('Failed to load order')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadDocument = async (docId) => {
    try {
      const response = await ordersAPI.downloadDocument(id, docId)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `document-${docId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentElement.removeChild(link)
      toast.success('Document downloaded')
    } catch (err) {
      toast.error('Failed to download document')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner text="Loading order..." />
      </div>
    )
  }

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        message="The order you're looking for doesn't exist."
        actionText="Back to Orders"
        action={() => navigate('/orders')}
      />
    )
  }

  const estimatedDates = {
    CONFIRMED: order.confirmedAt,
    IN_PRODUCTION: order.productionStartDate,
    READY: order.readyDate,
    SHIPPED: order.shippedDate,
    IN_TRANSIT: order.inTransitDate,
    DELIVERED: order.deliveredDate,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <ArrowLeft size={20} />
          Back to Orders
        </button>
      </div>

      {/* Order Info Card */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm text-gray-500">Order Number</p>
            <h1 className="text-2xl font-bold text-gray-900">ORD-{String(id).padStart(6, '0')}</h1>
          </div>
          <StatusBadge status={order.status} type="order" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200">
          <div>
            <p className="text-sm text-gray-600">Order Date</p>
            <p className="font-semibold text-gray-900">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="font-semibold text-gray-900">{formatCurrency(order.total)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Items</p>
            <p className="font-semibold text-gray-900">{order.items?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Payment Status</p>
            <StatusBadge status={order.paymentStatus} type="payment" size="sm" className="mt-1" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Tracker */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Progress</h2>
            <OrderTracker status={order.status} estimatedDates={estimatedDates} />
          </div>

          {/* Items */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h2>
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
                  {order.items?.map((item, idx) => (
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

          {/* Documents */}
          {documents.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText size={20} />
                Documents
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleDownloadDocument(doc.id)}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-600">
                        {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <Download size={18} className="text-primary-600" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Shipments */}
          {shipments.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipment Tracking</h2>
              <div className="space-y-6">
                {shipments.map((shipment) => (
                  <Link
                    key={shipment.id}
                    to="/shipments"
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-semibold text-gray-900">{shipment.containerNumber}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {shipment.originPort} → {shipment.destinationPort}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      ETA: {formatDate(shipment.eta)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Info */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Payment Details</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Subtotal</p>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(order.subtotal)}
                </p>
              </div>
              {order.tax > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Tax</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(order.tax)}
                  </p>
                </div>
              )}
              {order.shipping > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Shipping</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(order.shipping)}
                  </p>
                </div>
              )}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-primary-600">
                  {formatCurrency(order.total)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Payment Status</p>
                <StatusBadge status={order.paymentStatus} type="payment" />
              </div>
            </div>
          </div>

          {/* Shipping Info */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Shipping Address</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-900">{order.shippingAddress?.name}</p>
              <p>{order.shippingAddress?.street}</p>
              <p>{order.shippingAddress?.city}, {order.shippingAddress?.state}</p>
              <p>{order.shippingAddress?.zip}</p>
              <p>{order.shippingAddress?.country}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="card p-6 space-y-3">
            <button className="w-full btn-secondary text-sm">
              Request Cancellation
            </button>
            <Link
              to="/claims/new"
              className="w-full btn-outline text-sm text-center flex items-center justify-center gap-2"
            >
              <AlertCircle size={16} />
              File a Claim
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
