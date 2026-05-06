import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  ChevronDown,
  Loader,
  Package,
  CalendarClock,
} from 'lucide-react'
import { ordersAPI } from '../../services/api'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import ScheduleActivityModal from '../../components/ScheduleActivityModal'
import Chatter from '../../components/Chatter'
import WorkflowStatusBar, { SALES_ORDER_STAGES } from '../../components/WorkflowStatusBar'
import StatusBadge from '../../components/StatusBadge'
import DocumentGenerateButton from '../../components/DocumentGenerateButton'
import ConfirmDialog from '../../components/ConfirmDialog'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters'
import { ORDER_STATUS } from '../../utils/constants'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [order, setOrder] = useState(null)
  useBreadcrumbs(order?.orderNumber)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [isCreatingPackingList, setIsCreatingPackingList] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await ordersAPI.getById(id)
        setOrder(res.data || res)
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.message || 'Failed to load order'
        setError(errorMsg)
        toast.error(errorMsg)
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchOrder()
    }
  }, [id])

  const handleChangeStatus = async (newStatus) => {
    if (!order || newStatus === order.status) {
      setShowStatusDropdown(false)
      return
    }

    try {
      setIsChangingStatus(true)
      await ordersAPI.changeStatus(id, newStatus)
      setOrder({ ...order, status: newStatus })
      toast.success('Status updated successfully')
      setShowStatusDropdown(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change status')
    } finally {
      setIsChangingStatus(false)
    }
  }

  const handleCreatePackingList = async () => {
    try {
      setIsCreatingPackingList(true)
      const res = await ordersAPI.createPackingList(id)
      toast.success('Packing List created')
      const plId = res.data?.id || res.id
      if (plId) navigate(`/packing-lists/${plId}`)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create Packing List'
      // If one already exists, offer to navigate there
      const existingId = err.response?.data?.data?.packingListId
      if (existingId) {
        toast.error('A Packing List already exists for this order')
        navigate(`/packing-lists/${existingId}`)
      } else {
        toast.error(msg)
      }
    } finally {
      setIsCreatingPackingList(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await ordersAPI.delete(id)
      toast.success('Order deleted successfully')
      navigate('/orders')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete order')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Orders</span>
        </button>
        <LoadingSpinner message="Loading order details..." />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Orders</span>
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error || 'Order not found'}</p>
        </div>
      </div>
    )
  }

  const statusOptions = Object.values(ORDER_STATUS).filter((s) => s !== order.status)
  const lineItems = order.lineItems || []
  const subtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0)
  const discountAmount = order.discountAmount || (order.discount || 0)
  const taxAmount = order.taxAmount || (order.tax || 0)
  const total = order.total || subtotal - discountAmount + taxAmount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/orders')}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{order.orderNumber || 'Order'}</h1>
            <div className="flex items-center space-x-2 mt-2">
              <StatusBadge status={order.status} />
              <span className="text-sm text-slate-500">•</span>
              <span className="text-sm text-slate-600">{formatDate(order.createdAt)}</span>
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
          <DocumentGenerateButton
            documentType="sales_order"
            entityId={id}
            entityData={order}
            label="Generate PDF"
          />
          <button
            onClick={() => navigate(`/orders/${id}/edit`)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </button>
          {order.status !== 'cancelled' && (
            <button
              onClick={handleCreatePackingList}
              disabled={isCreatingPackingList}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isCreatingPackingList ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              <span>Create Packing List</span>
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors"
              disabled={isChangingStatus}
            >
              <span className="text-sm font-medium">Change Status</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {showStatusDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleChangeStatus(status)}
                    disabled={isChangingStatus}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors text-sm text-slate-700 border-b border-slate-100 last:border-b-0 disabled:opacity-50"
                  >
                    {status.replace(/_/g, ' ').toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
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
      <WorkflowStatusBar stages={SALES_ORDER_STAGES} currentStatus={order.status} />

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Order Details */}
        <div className="col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Customer Information</h2>
            {order.customer ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Customer Name</p>
                  <p className="text-slate-900 font-medium">{order.customer.name || order.customerName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email</p>
                  <p className="text-slate-900">{order.customer.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Phone</p>
                  <p className="text-slate-900">{order.customer.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Country</p>
                  <p className="text-slate-900">{order.customer.country || '-'}</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No customer information available</p>
            )}
          </div>

          {/* Factory Info */}
          {order.factory && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Factory Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Factory Name</p>
                  <p className="text-slate-900 font-medium">{order.factory.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Location</p>
                  <p className="text-slate-900">{order.factory.location || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Contact Person</p>
                  <p className="text-slate-900">{order.factory.contactPerson || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email</p>
                  <p className="text-slate-900">{order.factory.email || '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Line Items */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Order Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Product</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Quantity</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Unit</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Unit Price</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length > 0 ? (
                    lineItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-900">
                          <div>
                            <p className="font-medium">{item.productName || item.product?.name || '-'}</p>
                            {item.productCode && (
                              <p className="text-sm text-slate-500">{item.productCode}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-900">
                          {formatNumber(item.quantity || 0, 2)}
                        </td>
                        <td className="px-6 py-4 text-slate-900">{item.unit || '-'}</td>
                        <td className="px-6 py-4 text-right text-slate-900">
                          {formatCurrency(item.unitPrice || 0)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                          {formatCurrency(item.total || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                        No items in this order
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shipping & Delivery */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Shipping & Delivery</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">Shipping Method</p>
                <p className="text-slate-900">{order.shippingMethod || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Estimated Delivery</p>
                <p className="text-slate-900">
                  {order.estimatedDelivery ? formatDate(order.estimatedDelivery) : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Notes</h2>
              <p className="text-slate-700 whitespace-pre-wrap">{order.notes}</p>
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

              {order.paymentStatus && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 text-sm">Payment Status</span>
                    <StatusBadge status={order.paymentStatus} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Metadata */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500 mb-1">Order Date</p>
                <p className="text-slate-900">{formatDate(order.createdAt)}</p>
              </div>
              {order.dueDate && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Due Date</p>
                  <p className="text-slate-900">{formatDate(order.dueDate)}</p>
                </div>
              )}
              {order.paymentTerms && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Payment Terms</p>
                  <p className="text-slate-900">{order.paymentTerms}</p>
                </div>
              )}
              {order.incoterms && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Incoterms</p>
                  <p className="text-slate-900">{order.incoterms}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chatter */}
      <Chatter entityType="SalesOrder" entityId={id} className="mt-6" />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Order"
        message="Are you sure you want to delete this order? This action cannot be undone."
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
        entityType="SalesOrder"
        entityId={id}
        entityLabel={`${order?.orderNumber || 'Order'}${order?.customer?.name ? ' — ' + order.customer.name : ''}`}
      />
    </div>
  )
}
