import { useState, useEffect } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Eye,
  X,
  ChevronDown,
  Save,
  AlertCircle,
  Check
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

const PriceListManager = () => {
  // State management
  const [priceLists, setPriceLists] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedPriceList, setSelectedPriceList] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showItemsView, setShowItemsView] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importMode, setImportMode] = useState('append')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    currencyCode: 'USD',
    validFrom: '',
    validTo: '',
    customerId: '',
    factoryId: '',
    isActive: true,
    items: []
  })

  const [items, setItems] = useState([])

  // Load price lists on mount
  useEffect(() => {
    loadPriceLists()
  }, [])

  const loadPriceLists = async () => {
    try {
      setIsLoading(true)
      const response = await api.get('/personalization/price-lists')
      setPriceLists(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      console.error('Failed to load price lists:', error)
      toast.error('Failed to load price lists')
    } finally {
      setIsLoading(false)
    }
  }

  const loadPriceListDetails = async (id) => {
    try {
      const response = await api.get(`/personalization/price-lists/${id}`)
      const priceList = response.data
      setSelectedPriceList(priceList)
      setFormData({
        name: priceList.name || '',
        description: priceList.description || '',
        currencyCode: priceList.currencyCode || 'USD',
        validFrom: priceList.validFrom || '',
        validTo: priceList.validTo || '',
        customerId: priceList.customerId || '',
        factoryId: priceList.factoryId || '',
        isActive: priceList.isActive !== false,
        items: []
      })
      setItems(priceList.items || [])
    } catch (error) {
      console.error('Failed to load price list details:', error)
      toast.error('Failed to load price list details')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      currencyCode: 'USD',
      validFrom: '',
      validTo: '',
      customerId: '',
      factoryId: '',
      isActive: true,
      items: []
    })
    setItems([])
    setSelectedPriceList(null)
  }

  const handleOpenCreateModal = () => {
    resetForm()
    setShowModal(true)
    setShowItemsView(false)
  }

  const handleEditPriceList = async (priceList) => {
    await loadPriceListDetails(priceList.id)
    setShowModal(true)
    setShowItemsView(false)
  }

  const handleViewItems = async (priceList) => {
    await loadPriceListDetails(priceList.id)
    setShowItemsView(true)
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleAddItem = () => {
    setItems(prev => [...prev, {
      id: Date.now(),
      sku: '',
      productName: '',
      sellingPrice: '',
      costPrice: '',
      minimumOrder: '',
      leadTimeDays: '',
      unit: '',
      notes: ''
    }])
  }

  const handleRemoveItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const handleItemChange = (id, field, value) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('Price list name is required')
      return false
    }
    if (!formData.currencyCode.trim()) {
      toast.error('Currency code is required')
      return false
    }
    if (items.length === 0) {
      toast.error('At least one item is required')
      return false
    }
    // Validate items
    for (let item of items) {
      if (!item.sku.trim()) {
        toast.error('All items must have a SKU')
        return false
      }
      if (!item.productName.trim()) {
        toast.error('All items must have a product name')
        return false
      }
      if (!item.sellingPrice) {
        toast.error('All items must have a selling price')
        return false
      }
    }
    return true
  }

  const handleSavePriceList = async () => {
    if (!validateForm()) return

    try {
      setIsSaving(true)
      const payload = {
        ...formData,
        items: items.map(({ id, ...rest }) => rest)
      }

      if (selectedPriceList) {
        await api.put(`/personalization/price-lists/${selectedPriceList.id}`, payload)
        toast.success('Price list updated successfully')
      } else {
        await api.post('/personalization/price-lists', payload)
        toast.success('Price list created successfully')
      }

      setShowModal(false)
      setShowItemsView(false)
      loadPriceLists()
    } catch (error) {
      console.error('Failed to save price list:', error)
      toast.error(error.response?.data?.message || 'Failed to save price list')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePriceList = async (id) => {
    if (!window.confirm('Are you sure you want to delete this price list?')) return

    try {
      await api.delete(`/personalization/price-lists/${id}`)
      toast.success('Price list deleted successfully')
      loadPriceLists()
    } catch (error) {
      console.error('Failed to delete price list:', error)
      toast.error('Failed to delete price list')
    }
  }

  const handleExport = async (id) => {
    try {
      const response = await api.get(`/personalization/price-lists/${id}/export`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `price-list-${id}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Price list exported successfully')
    } catch (error) {
      console.error('Failed to export price list:', error)
      toast.error('Failed to export price list')
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['xlsx', 'xls', 'csv'].some(ext => file.name.toLowerCase().endsWith(ext))) {
      toast.error('Please upload a .xlsx, .xls, or .csv file')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', importMode)

      if (selectedPriceList) {
        await api.post(`/personalization/price-lists/${selectedPriceList.id}/import`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        toast.success(`Items ${importMode === 'append' ? 'added' : 'replaced'} successfully`)
        await loadPriceListDetails(selectedPriceList.id)
      }

      setShowImportModal(false)
      e.target.value = ''
    } catch (error) {
      console.error('Failed to import price list:', error)
      toast.error(error.response?.data?.message || 'Failed to import price list')
    }
  }

  if (isLoading) return <LoadingSpinner message="Loading price lists..." />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Price List Manager</h1>
        <p className="text-slate-600 mt-1">Manage price lists and their items</p>
      </div>

      {/* Main View: Price Lists Table */}
      {!showItemsView ? (
        <div className="bg-white rounded-lg border border-slate-200">
          {/* Toolbar */}
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Price Lists</h2>
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Price List</span>
            </button>
          </div>

          {/* Empty State */}
          {priceLists.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-600 mb-4">No price lists found</p>
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create your first price list
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Currency</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Items</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Customer/Factory</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Valid Period</th>
                    <th className="px-6 py-3 text-center font-semibold text-slate-900">Status</th>
                    <th className="px-6 py-3 text-center font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {priceLists.map((priceList) => (
                    <tr key={priceList.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{priceList.name}</td>
                      <td className="px-6 py-4 text-slate-600">{priceList.currencyCode}</td>
                      <td className="px-6 py-4 text-slate-600">{priceList.itemCount || 0}</td>
                      <td className="px-6 py-4 text-slate-600">
                        <span className="text-sm">
                          {priceList.customerName || priceList.customerId || '—'}
                          {priceList.factoryName && ` / ${priceList.factoryName}`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm">
                        {priceList.validFrom && priceList.validTo
                          ? `${new Date(priceList.validFrom).toLocaleDateString()} - ${new Date(priceList.validTo).toLocaleDateString()}`
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${
                          priceList.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {priceList.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          <span>{priceList.isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewItems(priceList)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View items"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditPriceList(priceList)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExport(priceList.id)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Export"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePriceList(priceList.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* Items View Modal */}
      {showItemsView && selectedPriceList && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Items - {selectedPriceList.name}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Import</span>
              </button>
              <button
                onClick={() => setShowItemsView(false)}
                className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Back
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="p-6 overflow-x-auto">
            {items.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                <p className="text-slate-600">No items in this price list</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">SKU</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">Product Name</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">Selling Price</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">Cost Price</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">Min Order</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">Lead Time (days)</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">Unit</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{item.sku}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.productName}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {parseFloat(item.sellingPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {item.costPrice ? parseFloat(item.costPrice).toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.minimumOrder || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.leadTimeDays || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{item.unit || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm max-w-xs truncate">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && !showItemsView && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-slate-900">
                {selectedPriceList ? 'Edit Price List' : 'New Price List'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Standard Price List Q1 2026"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Currency Code *
                    </label>
                    <input
                      type="text"
                      name="currencyCode"
                      value={formData.currencyCode}
                      onChange={handleFormChange}
                      maxLength="3"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                      placeholder="USD"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleFormChange}
                      rows="2"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional description"
                    />
                  </div>
                </div>
              </div>

              {/* Dates and Scope */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Validity & Scope</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Valid From
                    </label>
                    <input
                      type="date"
                      name="validFrom"
                      value={formData.validFrom}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Valid To
                    </label>
                    <input
                      type="date"
                      name="validTo"
                      value={formData.validTo}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Customer ID
                    </label>
                    <input
                      type="text"
                      name="customerId"
                      value={formData.customerId}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Factory ID
                    </label>
                    <input
                      type="text"
                      name="factoryId"
                      value={formData.factoryId}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Items *</h3>
                  <button
                    onClick={handleAddItem}
                    className="flex items-center space-x-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item</span>
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-300 rounded-lg">
                    <AlertCircle className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                    <p className="text-slate-600 mb-4">No items added yet</p>
                    <button
                      onClick={handleAddItem}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add First Item
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">SKU</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">Product Name</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">Selling Price</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">Cost Price</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">Min Order</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-900 text-sm">Lead Time</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">Unit</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-900 text-sm">Notes</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-900 text-sm">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.sku}
                                onChange={(e) => handleItemChange(item.id, 'sku', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="SKU"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.productName}
                                onChange={(e) => handleItemChange(item.id, 'productName', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Product name"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={item.sellingPrice}
                                onChange={(e) => handleItemChange(item.id, 'sellingPrice', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right"
                                placeholder="0.00"
                                step="0.01"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={item.costPrice}
                                onChange={(e) => handleItemChange(item.id, 'costPrice', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right"
                                placeholder="0.00"
                                step="0.01"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={item.minimumOrder}
                                onChange={(e) => handleItemChange(item.id, 'minimumOrder', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right"
                                placeholder="1"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={item.leadTimeDays}
                                onChange={(e) => handleItemChange(item.id, 'leadTimeDays', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Unit"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Notes"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleFormChange}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-slate-900">Active</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="px-6 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePriceList}
                disabled={isSaving}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Price List'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && selectedPriceList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Import Items</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Import Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="w-4 h-4 border-slate-300 text-blue-600 cursor-pointer"
                    />
                    <span className="text-sm text-slate-700">Append items (keep existing)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="w-4 h-4 border-slate-300 text-blue-600 cursor-pointer"
                    />
                    <span className="text-sm text-slate-700">Replace all items</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  File (Excel or CSV)
                </label>
                <label className="flex items-center justify-center px-4 py-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-900">Choose file or drag here</p>
                    <p className="text-xs text-slate-600 mt-1">.xlsx, .xls, or .csv</p>
                  </div>
                  <input
                    type="file"
                    onChange={handleImportFile}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                </label>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-900">
                  <strong>Note:</strong> Ensure your file contains columns: SKU, Product Name, Selling Price, and optionally Cost Price, Min Order, Lead Time Days, Unit, Notes.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-6 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Tips:</strong> Create price lists to manage different pricing strategies. Each list can be tied to specific customers or factories and has validity dates. Import/export items in bulk using Excel or CSV files.
        </p>
      </div>
    </div>
  )
}

export default PriceListManager
