import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit2, Trash2 } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import { grnAPI } from '../../services/api'
import { formatDate, formatNumber } from '../../utils/formatters'

export default function GRNDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [grn, setGRN] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    fetchGRN()
  }, [id])

  const fetchGRN = async () => {
    try {
      setIsLoading(true)
      const res = await grnAPI.getById(id)
      setGRN(res.data)
    } catch (error) {
      console.error('Failed to fetch GRN:', error)
      toast.error('Failed to load GRN')
      navigate('/grns')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await grnAPI.delete(id)
      toast.success('GRN deleted successfully')
      navigate('/grns')
    } catch (error) {
      console.error('Failed to delete GRN:', error)
      toast.error('Failed to delete GRN')
    }
  }

  const handleAccept = async () => {
    try {
      setIsProcessing(true)
      await grnAPI.accept(id)
      toast.success('GRN accepted successfully')
      fetchGRN()
    } catch (error) {
      console.error('Failed to accept GRN:', error)
      toast.error('Failed to accept GRN')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    try {
      setIsProcessing(true)
      await grnAPI.reject(id, { reason: rejectReason })
      toast.success('GRN rejected successfully')
      setShowRejectModal(false)
      setRejectReason('')
      fetchGRN()
    } catch (error) {
      console.error('Failed to reject GRN:', error)
      toast.error('Failed to reject GRN')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (!grn) return null

  const canAccept = grn.status === 'pending'
  const canReject = grn.status === 'pending'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/grns')}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              GRN #{grn.grnNumber || grn.id}
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              PO: {grn.poNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {canAccept && (
            <button
              onClick={handleAccept}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <span>{isProcessing ? 'Processing...' : 'Accept'}</span>
            </button>
          )}
          {canReject && (
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              <span>Reject</span>
            </button>
          )}
          <button
            onClick={() => navigate(`/grns/${id}/edit`)}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Status</p>
          <div className="mt-2">
            <StatusBadge status={grn.status} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Date</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {formatDate(grn.date)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Items Count</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {grn.items?.length || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Received By</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {grn.receivedBy || 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Location</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {grn.location || 'N/A'}
          </p>
        </div>
      </div>

      {/* GRN Items */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Received Items
        </h2>
        {grn.items && grn.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Product
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    PO Qty
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Received Qty
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Unit
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Quality Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {grn.items.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-3 px-4 text-slate-900">
                      {item.productName || item.product}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {formatNumber(item.poQuantity)}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {formatNumber(item.receivedQuantity)}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {item.unit || 'PCS'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.qualityStatus === 'acceptable'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {item.qualityStatus || 'pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-600 text-sm">No items in this GRN</p>
        )}
      </div>

      {/* Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          GRN Details
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Information</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-600">GRN #</p>
                <p className="text-slate-900 font-medium">
                  {grn.grnNumber || grn.id}
                </p>
              </div>
              <div>
                <p className="text-slate-600">PO #</p>
                <p className="text-slate-900 font-medium">{grn.poNumber}</p>
              </div>
              <div>
                <p className="text-slate-600">Date</p>
                <p className="text-slate-900 font-medium">
                  {formatDate(grn.date)}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Status</p>
                <div className="mt-1">
                  <StatusBadge status={grn.status} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Warehouse</h3>
            <div className="space-y-3 text-sm bg-slate-50 p-4 rounded-lg">
              <div>
                <p className="text-slate-600">Received By</p>
                <p className="text-slate-900 font-medium">
                  {grn.receivedBy || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Location</p>
                <p className="text-slate-900 font-medium">
                  {grn.location || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Total Items Received</p>
                <p className="text-slate-900 font-medium">
                  {grn.items?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {grn.notes && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">Notes</h3>
            <p className="text-slate-700 text-sm">{grn.notes}</p>
          </div>
        )}

        {grn.rejectionReason && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">Rejection Reason</h3>
            <p className="text-red-700 text-sm">{grn.rejectionReason}</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        title="Delete GRN"
        message="Are you sure you want to delete this Goods Received Note? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
      />

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Reject GRN
              </h2>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
              />
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? 'Processing...' : 'Reject'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setRejectReason('')
                  }}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
