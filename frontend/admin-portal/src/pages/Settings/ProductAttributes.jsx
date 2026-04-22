import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

const ATTRIBUTE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'select', label: 'Select' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
]

const initialFormState = {
  id: null,
  attributeName: '',
  displayName: '',
  attributeType: 'text',
  unit: '',
  isRequired: false,
  defaultValue: '',
  allowedValues: '',
  minValue: '',
  maxValue: '',
  helpText: '',
}

export default function ProductAttributes() {
  const [attributes, setAttributes] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(initialFormState)
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, attributeId: null })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      loadAttributes()
    }
  }, [selectedCategory])

  const loadCategories = async () => {
    try {
      const response = await api.get('/products/categories')
      const categoryList = Array.isArray(response.data) ? response.data : (response.data?.data || [])
      setCategories(categoryList)
      if (categoryList.length > 0) {
        setSelectedCategory(categoryList[0].id || categoryList[0])
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
      toast.error('Failed to load product categories')
    }
  }

  const loadAttributes = async () => {
    try {
      setIsLoading(true)
      const response = await api.get('/personalization/product-attributes', {
        params: { categoryId: selectedCategory }
      })
      const attributeList = Array.isArray(response.data) ? response.data : (response.data?.data || [])
      setAttributes(attributeList)
    } catch (error) {
      console.error('Failed to load attributes:', error)
      toast.error('Failed to load product attributes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenModal = (attribute = null) => {
    if (attribute) {
      setFormData({
        id: attribute.id,
        attributeName: attribute.attributeName || '',
        displayName: attribute.displayName || '',
        attributeType: attribute.attributeType || 'text',
        unit: attribute.unit || '',
        isRequired: attribute.isRequired || false,
        defaultValue: attribute.defaultValue || '',
        allowedValues: attribute.allowedValues ? attribute.allowedValues.join(', ') : '',
        minValue: attribute.minValue ?? '',
        maxValue: attribute.maxValue ?? '',
        helpText: attribute.helpText || '',
      })
    } else {
      setFormData(initialFormState)
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setFormData(initialFormState)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = () => {
    if (!formData.attributeName.trim()) {
      toast.error('Attribute name is required')
      return false
    }
    if (!formData.displayName.trim()) {
      toast.error('Display name is required')
      return false
    }
    if ((formData.attributeType === 'select' || formData.attributeType === 'multiselect') && !formData.allowedValues.trim()) {
      toast.error('Allowed values are required for select/multiselect types')
      return false
    }
    if (formData.minValue && formData.maxValue && parseFloat(formData.minValue) > parseFloat(formData.maxValue)) {
      toast.error('Min value cannot be greater than max value')
      return false
    }
    return true
  }

  const handleSaveAttribute = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setIsSaving(true)
      const submitData = {
        categoryId: selectedCategory,
        attributeName: formData.attributeName,
        displayName: formData.displayName,
        attributeType: formData.attributeType,
        unit: formData.unit || null,
        isRequired: formData.isRequired,
        defaultValue: formData.defaultValue || null,
        allowedValues: formData.attributeType === 'select' || formData.attributeType === 'multiselect'
          ? formData.allowedValues.split(',').map(v => v.trim()).filter(v => v)
          : null,
        minValue: formData.minValue ? parseFloat(formData.minValue) : null,
        maxValue: formData.maxValue ? parseFloat(formData.maxValue) : null,
        helpText: formData.helpText || null,
      }

      if (formData.id) {
        await api.put(`/personalization/product-attributes/${formData.id}`, submitData)
        toast.success('Attribute updated successfully')
      } else {
        await api.post('/personalization/product-attributes', submitData)
        toast.success('Attribute created successfully')
      }

      handleCloseModal()
      loadAttributes()
    } catch (error) {
      console.error('Failed to save attribute:', error)
      toast.error(error.response?.data?.message || 'Failed to save attribute')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAttribute = async () => {
    try {
      setIsDeleting(true)
      await api.delete(`/personalization/product-attributes/${deleteConfirm.attributeId}`)
      toast.success('Attribute deleted successfully')
      setAttributes(attributes.filter(a => a.id !== deleteConfirm.attributeId))
      setDeleteConfirm({ isOpen: false, attributeId: null })
    } catch (error) {
      console.error('Failed to delete attribute:', error)
      toast.error('Failed to delete attribute')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMoveAttribute = async (attributeId, direction) => {
    const index = attributes.findIndex(a => a.id === attributeId)
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === attributes.length - 1) return

    const newAttributes = [...attributes]
    if (direction === 'up') {
      [newAttributes[index], newAttributes[index - 1]] = [newAttributes[index - 1], newAttributes[index]]
    } else {
      [newAttributes[index], newAttributes[index + 1]] = [newAttributes[index + 1], newAttributes[index]]
    }

    const orderedIds = newAttributes.map(a => a.id)

    try {
      await api.put('/personalization/product-attributes/reorder', { orderedIds })
      setAttributes(newAttributes)
      toast.success('Sequence updated')
    } catch (error) {
      console.error('Failed to reorder attributes:', error)
      toast.error('Failed to update sequence')
    }
  }

  if (isLoading && !attributes.length) {
    return <LoadingSpinner message="Loading product attributes..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Product Attributes</h1>
          <p className="text-slate-600 mt-1">Manage custom product specifications and characteristics</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Attribute</span>
        </button>
      </div>

      {/* Category Filter */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <label className="block text-sm font-medium text-slate-900 mb-2">
          Product Category
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select Category --</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name || cat}
            </option>
          ))}
        </select>
      </div>

      {/* Attributes Table */}
      {selectedCategory ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {attributes.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              No attributes found for this category. Create your first attribute to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Attribute Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Display Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Type</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Unit</th>
                    <th className="px-6 py-3 text-center font-semibold text-slate-900">Required</th>
                    <th className="px-6 py-3 text-center font-semibold text-slate-900">Sequence</th>
                    <th className="px-6 py-3 text-center font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attributes.map((attr, index) => (
                    <tr key={attr.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{attr.attributeName}</td>
                      <td className="px-6 py-4 text-slate-700">{attr.displayName}</td>
                      <td className="px-6 py-4 text-slate-700">
                        <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-md text-sm">
                          {attr.attributeType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{attr.unit || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm ${
                          attr.isRequired ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {attr.isRequired ? '✓' : '−'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleMoveAttribute(attr.id, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <span className="text-sm text-slate-600 w-4 text-center">{index + 1}</span>
                          <button
                            onClick={() => handleMoveAttribute(attr.id, 'down')}
                            disabled={index === attributes.length - 1}
                            className="p-1 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleOpenModal(attr)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ isOpen: true, attributeId: attr.id })}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
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
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-600">
          Please select a category to view and manage attributes
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {formData.id ? 'Edit Attribute' : 'Create New Attribute'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1 hover:bg-slate-200 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveAttribute} className="p-6 space-y-4">
              {/* Attribute Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Attribute Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="attributeName"
                    value={formData.attributeName}
                    onChange={handleInputChange}
                    placeholder="e.g., weight, color_code"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    placeholder="e.g., Weight, Color Code"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Type and Unit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Attribute Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="attributeType"
                    value={formData.attributeType}
                    onChange={(e) => handleSelectChange('attributeType', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ATTRIBUTE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Unit (Optional)
                  </label>
                  <input
                    type="text"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    placeholder="e.g., kg, cm, piece"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Required Checkbox */}
              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isRequired"
                    checked={formData.isRequired}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-900">This attribute is required</span>
                </label>
              </div>

              {/* Default Value */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Default Value (Optional)
                </label>
                <input
                  type="text"
                  name="defaultValue"
                  value={formData.defaultValue}
                  onChange={handleInputChange}
                  placeholder="Default value for this attribute"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Allowed Values (for select/multiselect) */}
              {(formData.attributeType === 'select' || formData.attributeType === 'multiselect') && (
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Allowed Values <span className="text-red-500">*</span>
                    <span className="text-xs text-slate-500 font-normal">(comma-separated)</span>
                  </label>
                  <textarea
                    name="allowedValues"
                    value={formData.allowedValues}
                    onChange={handleInputChange}
                    placeholder="e.g., Red, Blue, Green"
                    rows="3"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Min/Max Values (for number/decimal) */}
              {(formData.attributeType === 'number' || formData.attributeType === 'decimal') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Minimum Value (Optional)
                    </label>
                    <input
                      type="number"
                      name="minValue"
                      value={formData.minValue}
                      onChange={handleInputChange}
                      placeholder="e.g., 0"
                      step={formData.attributeType === 'decimal' ? '0.01' : '1'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">
                      Maximum Value (Optional)
                    </label>
                    <input
                      type="number"
                      name="maxValue"
                      value={formData.maxValue}
                      onChange={handleInputChange}
                      placeholder="e.g., 100"
                      step={formData.attributeType === 'decimal' ? '0.01' : '1'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Help Text */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Help Text (Optional)
                </label>
                <textarea
                  name="helpText"
                  value={formData.helpText}
                  onChange={handleInputChange}
                  placeholder="Helpful instruction for users entering this attribute"
                  rows="2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : (formData.id ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Attribute</h3>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this attribute? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteConfirm({ isOpen: false, attributeId: null })}
                  className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAttribute}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
