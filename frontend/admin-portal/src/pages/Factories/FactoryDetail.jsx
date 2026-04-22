import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit2 } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { factoriesAPI } from '../../services/api'
import { formatDate } from '../../utils/formatters'

export default function FactoryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [factory, setFactory] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [products, setProducts] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])

  useEffect(() => {
    fetchFactory()
  }, [id])

  const fetchFactory = async () => {
    try {
      setIsLoading(true)
      const res = await factoriesAPI.getById(id)
      setFactory(res.data)

      const [productsRes, posRes] = await Promise.all([
        factoriesAPI.getProducts(id),
        factoriesAPI.getPurchaseOrders(id),
      ])

      setProducts(productsRes.data || [])
      setPurchaseOrders(posRes.data || [])
    } catch (error) {
      toast.error('Failed to load factory')
      navigate('/factories')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (!factory) return null

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'products', label: 'Products' },
    { id: 'purchase-orders', label: 'Purchase Orders' },
    { id: 'performance', label: 'Performance' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/factories')}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{factory.name}</h1>
            <p className="text-slate-600 text-sm mt-1">{factory.country}</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/factories/${id}/edit`)}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Edit2 className="w-4 h-4" />
          <span>Edit</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Email</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{factory.email}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Phone</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{factory.phone}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Status</p>
          <div className="mt-2">
            <StatusBadge status={factory.status} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="flex items-center border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600 -mb-px'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-4">
                  Contact Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-slate-600">Contact Person</p>
                    <p className="text-slate-900 font-medium">
                      {factory.contactPerson || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Email</p>
                    <p className="text-slate-900 font-medium">{factory.email}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Phone</p>
                    <p className="text-slate-900 font-medium">{factory.phone}</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-4">
                  Location
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-slate-600">City</p>
                    <p className="text-slate-900 font-medium">{factory.city}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Country</p>
                    <p className="text-slate-900 font-medium">{factory.country}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Address</p>
                    <p className="text-slate-900 font-medium">{factory.address}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <DataTable
              columns={[
                { key: 'name', label: 'Product Name' },
                { key: 'sku', label: 'SKU' },
                { key: 'category', label: 'Category' },
              ]}
              data={products}
              isLoading={false}
              paginated={false}
            />
          )}

          {activeTab === 'purchase-orders' && (
            <DataTable
              columns={[
                { key: 'poNumber', label: 'PO #' },
                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge status={row.status} />,
                },
              ]}
              data={purchaseOrders}
              isLoading={false}
              paginated={false}
            />
          )}

          {activeTab === 'performance' && (
            <div className="text-center py-12">
              <p className="text-slate-600">Performance metrics coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
