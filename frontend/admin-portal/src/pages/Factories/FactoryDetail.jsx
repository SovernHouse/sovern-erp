import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit2, CalendarClock, Plus, Mail, Phone, User } from 'lucide-react'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { factoriesAPI } from '../../services/api'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import { formatDate } from '../../utils/formatters'
import ScheduleActivityModal from '../../components/ScheduleActivityModal'
import ChatterPanel from '../../components/ChatterPanel'

export default function FactoryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [factory, setFactory] = useState(null)
  useBreadcrumbs(factory?.name)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [products, setProducts] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [contacts, setContacts] = useState([])
  const [showActivityModal, setShowActivityModal] = useState(false)

  useEffect(() => {
    fetchFactory()
  }, [id])

  const fetchFactory = async () => {
    try {
      setIsLoading(true)
      const res = await factoriesAPI.getById(id)
      setFactory(res.data)

      const [productsRes, posRes, contactsRes] = await Promise.all([
        factoriesAPI.getProducts(id),
        factoriesAPI.getPurchaseOrders(id),
        api.get(`/crm/contacts?factoryId=${id}&isActive=true&limit=100`),
      ])

      setProducts(productsRes.data || [])
      setPurchaseOrders(posRes.data || [])
      setContacts(contactsRes.data || [])
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
    { id: 'contacts', label: `Contacts${contacts.length ? ` (${contacts.length})` : ''}` },
    { id: 'products', label: 'Products' },
    { id: 'purchase-orders', label: 'Purchase Orders' },
    { id: 'performance', label: 'Performance' },
    { id: 'chatter', label: 'Chatter' },
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
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowActivityModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Schedule Activity</span>
          </button>
          <button
            onClick={() => navigate(`/factories/${id}/edit`)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </button>
        </div>
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

          {activeTab === 'contacts' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600">
                  People to contact at this factory (sales, owner, QC, logistics).
                </p>
                <button
                  onClick={() => navigate(`/crm/contacts/new?factoryId=${id}`)}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Contact</span>
                </button>
              </div>
              {contacts.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
                  <User className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                  <p className="text-slate-600">No contacts yet for this factory.</p>
                  <p className="text-slate-500 text-sm mt-1">
                    Add the people you correspond with here so they appear under Outreach &gt; Supplier Contacts.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/crm/contacts/${c.id}`)}
                      className="text-left bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md hover:border-primary-300 transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {c.firstName} {c.lastName}
                          </p>
                          {c.jobTitle && (
                            <p className="text-sm text-slate-600">{c.jobTitle}</p>
                          )}
                        </div>
                        {c.isPrimary && (
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        {c.email && (
                          <div className="flex items-center text-slate-600">
                            <Mail size={14} className="mr-2 flex-shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </div>
                        )}
                        {(c.phone || c.mobile) && (
                          <div className="flex items-center text-slate-600">
                            <Phone size={14} className="mr-2 flex-shrink-0" />
                            <span>{c.phone || c.mobile}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
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

          {activeTab === 'chatter' && (
            <ChatterPanel entityType="Factory" entityId={id} />
          )}
        </div>
      </div>
      <ScheduleActivityModal
        open={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onCreated={() => setShowActivityModal(false)}
        entityType="Factory"
        entityId={id}
        entityLabel={factory?.name || 'Factory'}
      />
    </div>
  )
}
