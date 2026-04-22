import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit2, Trash2, Download } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import { packingListsAPI } from '../../services/api'
import { formatDate, formatWeight, formatVolume, formatNumber } from '../../utils/formatters'

export default function PackingListDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [packingList, setPackingList] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    fetchPackingList()
  }, [id])

  const fetchPackingList = async () => {
    try {
      setIsLoading(true)
      const res = await packingListsAPI.getById(id)
      setPackingList(res.data)
    } catch (error) {
      console.error('Failed to fetch packing list:', error)
      toast.error('Failed to load packing list')
      navigate('/packing-lists')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      await packingListsAPI.delete(id)
      toast.success('Packing list deleted successfully')
      navigate('/packing-lists')
    } catch (error) {
      console.error('Failed to delete packing list:', error)
      toast.error('Failed to delete packing list')
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (!packingList) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/packing-lists')}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Packing List #{packingList.packingListNumber || packingList.id}
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Order: {packingList.orderNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate(`/packing-lists/${id}/edit`)}
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
            <StatusBadge status={packingList.status} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Date</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {formatDate(packingList.date)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Items Count</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {packingList.items?.length || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Total Weight</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {formatWeight(packingList.totalWeight)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600 font-medium">Total Volume</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {formatVolume(packingList.totalVolume)}
          </p>
        </div>
      </div>

      {/* Packing List Items */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Packed Items
        </h2>
        {packingList.items && packingList.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Product
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Quantity
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Unit
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Weight (kg)
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Volume (CBM)
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Length (cm)
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Width (cm)
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Height (cm)
                  </th>
                </tr>
              </thead>
              <tbody>
                {packingList.items.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-3 px-4 text-slate-900">
                      {item.productName || item.product}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {formatNumber(item.quantity)}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {item.unit || 'PCS'}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {formatNumber(item.weight, 2)}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {formatNumber(item.volume, 2)}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {formatNumber(item.length, 1)}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {formatNumber(item.width, 1)}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {formatNumber(item.height, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-600 text-sm">No items in this packing list</p>
        )}
      </div>

      {/* Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Packing Details
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Information</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-600">Packing List #</p>
                <p className="text-slate-900 font-medium">
                  {packingList.packingListNumber || packingList.id}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Order #</p>
                <p className="text-slate-900 font-medium">
                  {packingList.orderNumber}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Date Created</p>
                <p className="text-slate-900 font-medium">
                  {formatDate(packingList.date)}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Status</p>
                <div className="mt-1">
                  <StatusBadge status={packingList.status} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Dimensions & Weight</h3>
            <div className="space-y-3 text-sm bg-slate-50 p-4 rounded-lg">
              <div>
                <p className="text-slate-600">Total Weight</p>
                <p className="text-slate-900 font-medium">
                  {formatWeight(packingList.totalWeight)}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Total Volume</p>
                <p className="text-slate-900 font-medium">
                  {formatVolume(packingList.totalVolume)}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Total Items</p>
                <p className="text-slate-900 font-medium">
                  {packingList.items?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {packingList.notes && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">Notes</h3>
            <p className="text-slate-700 text-sm">{packingList.notes}</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        title="Delete Packing List"
        message="Are you sure you want to delete this packing list? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  )
}
