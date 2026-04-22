import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react'
import {
  TextInput,
  NumberInput,
  SelectInput,
  DateInput,
  TextArea,
} from '../../components/FormFields'
import {
  purchaseOrdersAPI,
  factoriesAPI,
  ordersAPI,
  productsAPI,
} from '../../services/api'

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'CNY', label: 'CNY' },
  { value: 'GBP', label: 'GBP' },
]

const UNITS = [
  { value: 'sqm', label: 'sqm' },
  { value: 'sqft', label: 'sqft' },
  { value: 'box', label: 'box' },
  { value: 'pallet', label: 'pallet' },
  { value: 'roll', label: 'roll' },
  { value: 'piece', label: 'piece' },
]

export default function PurchaseOrderForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id

  const [loading, setLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const [factories, setFactories] = useState([])
  const [salesOrders, setSalesOrders] = useState([])
  const [products, setProducts] = useState([])

  const [formData, setFormData] = useState({
    factoryId: '',
    salesOrderId: '',
    expectedDelivery: '',
    currency: 'USD',
    notes: '',
    items: [{ productId: '', description: '', quantity: '', unit: 'piece', unitPrice: '' }],
  })

  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [factRes, ordRes, prodRes] = await Promise.all([
          factoriesAPI.getAll({ limit: 100 }),
          ordersAPI.getAll({ limit: 100 }),
          productsAPI.getAll({ limit: 100 }),
        ])

        setFactories(factRes.data || [])
        setSalesOrders(ordRes.data || [])
        setProducts(prodRes.data || [])

        if (isEditMode) {
          await fetchPO()
        }
      } catch (err) {
        console.error('Failed to load form data:', err)
        setError('Failed to load form data')
        toast.error('Failed to load form data')
      }
    }

    fetchData()
  }, [isEditMode, id])

  const fetchPO = async () => {
    try {
      setLoading(true)
      const response = await purchaseOrdersAPI.getById(id)
      const po = response.data

      setFormData({
        factoryId: po.factoryId || '',
        salesOrderId: po.salesOrderId || '',
        expectedDelivery: po.expectedDelivery
          ? po.expectedDelivery.split('T')[0]
          : '',
        currency: po.currency || 'USD',
        notes: po.notes || '',
        items: po.items && po.items.length > 0
          ? po.items.map(item => ({
              productId: item.productId || '',
              description: item.description || '',
              quantity: item.quantity || '',
              unit: item.unit || 'piece',
              unitPrice: item.unitPrice || '',
            }))
          : [{ productId: '', description: '', quantity: '', unit: 'piece', unitPrice: '' }],
      })
    } catch (err) {
      console.error('Failed to load purchase order:', err)
      setError('Failed to load purchase order')
      toast.error('Failed to load purchase order')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const errors = {}

    if (!formData.factoryId) errors.factoryId = 'Factory is required'
    if (!formData.items || formData.items.length === 0) {
      errors.items = 'At least one line item is required'
    } else {
      formData.items.forEach((item, idx) => {
        if (!item.productId) errors[`item_${idx}_productId`] = 'Product is required'
        if (!item.quantity || parseFloat(item.quantity) <= 0) {
          errors[`item_${idx}_quantity`] = 'Quantity must be greater than 0'
        }
        if (!item.unitPrice || parseFloat(item.unitPrice) < 0) {
          errors[`item_${idx}_unitPrice`] = 'Unit price is required'
        }
      })
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFieldChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleItemChange = (idx, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items]
      newItems[idx] = { ...newItems[idx], [field]: value }
      return { ...prev, items: newItems }
    })
    const errorKey = `item_${idx}_${field}`
    if (fieldErrors[errorKey]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[errorKey]
        return newErrors
      })
    }
  }

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { productId: '', description: '', quantity: '', unit: 'piece', unitPrice: '' },
      ],
    }))
  }

  const removeLineItem = (idx) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== idx),
      }))
    }
  }

  const calculateLineTotal = (idx) => {
    const item = formData.items[idx]
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unitPrice) || 0
    return (qty * price).toFixed(2)
  }

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0
      const price = parseFloat(item.unitPrice) || 0
      return sum + qty * price
    }, 0).toFixed(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      toast.error('Please fix form errors')
      return
    }

    try {
      setSubmitting(true)

      const submitData = {
        factoryId: formData.factoryId,
        items: formData.items.map(item => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          description: item.description || undefined,
          unit: item.unit,
        })),
        currency: formData.currency,
        expectedDelivery: formData.expectedDelivery || undefined,
        notes: formData.notes || undefined,
      }

      if (formData.salesOrderId) {
        submitData.salesOrderId = formData.salesOrderId
      }

      if (isEditMode) {
        await purchaseOrdersAPI.update(id, submitData)
        toast.success('Purchase order updated successfully')
      } else {
        await purchaseOrdersAPI.create(submitData)
        toast.success('Purchase order created successfully')
      }

      navigate('/purchase-orders')
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to save purchase order'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-primary-600 animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading purchase order...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/purchase-orders')}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold">
          {isEditMode ? 'Edit Purchase Order' : 'New Purchase Order'}
        </h1>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Factory Section */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Purchase Order Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Factory
                  <span className="text-red-500">*</span>
                </label>
                <select
                  name="factoryId"
                  value={formData.factoryId}
                  onChange={handleFieldChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.factoryId
                      ? 'border-red-500'
                      : 'border-slate-300'
                  }`}
                >
                  <option value="">Select factory</option>
                  {factories.map(factory => (
                    <option key={factory.id} value={factory.id}>
                      {factory.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.factoryId && (
                  <p className="text-red-500 text-sm mt-1">
                    {fieldErrors.factoryId}
                  </p>
                )}
              </div>

              <SelectInput
                label="Sales Order (Optional)"
                name="salesOrderId"
                value={formData.salesOrderId}
                onChange={handleFieldChange}
                options={[
                  { value: '', label: 'None' },
                  ...salesOrders.map(order => ({
                    value: order.id,
                    label: `${order.orderNumber || order.id}`,
                  })),
                ]}
              />

              <DateInput
                label="Expected Delivery Date"
                name="expectedDelivery"
                value={formData.expectedDelivery}
                onChange={handleFieldChange}
              />

              <SelectInput
                label="Currency"
                name="currency"
                value={formData.currency}
                onChange={handleFieldChange}
                options={CURRENCIES}
              />
            </div>

            <TextArea
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleFieldChange}
              rows={3}
              placeholder="Add any notes or special instructions..."
            />
          </div>

          {/* Line Items Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Line Items
              </h2>
              <button
                type="button"
                onClick={addLineItem}
                className="flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
            </div>

            {fieldErrors.items && (
              <p className="text-red-500 text-sm mb-4">{fieldErrors.items}</p>
            )}

            <div className="space-y-4">
              {formData.items.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                    {/* Product */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Product
                        <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={item.productId}
                        onChange={e => handleItemChange(idx, 'productId', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${
                          fieldErrors[`item_${idx}_productId`]
                            ? 'border-red-500'
                            : 'border-slate-300'
                        }`}
                      >
                        <option value="">Select product</option>
                        {products.map(prod => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name}
                          </option>
                        ))}
                      </select>
                      {fieldErrors[`item_${idx}_productId`] && (
                        <p className="text-red-500 text-xs mt-1">
                          {fieldErrors[`item_${idx}_productId`]}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={e =>
                          handleItemChange(idx, 'description', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        placeholder="Additional description"
                      />
                    </div>

                    {/* Unit */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Unit
                      </label>
                      <select
                        value={item.unit}
                        onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      >
                        {UNITS.map(unit => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Delete */}
                    <div className="flex items-end">
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="w-full px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm flex items-center justify-center space-x-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quantity and Price Row */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Quantity
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={e =>
                          handleItemChange(idx, 'quantity', e.target.value)
                        }
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${
                          fieldErrors[`item_${idx}_quantity`]
                            ? 'border-red-500'
                            : 'border-slate-300'
                        }`}
                        placeholder="0"
                      />
                      {fieldErrors[`item_${idx}_quantity`] && (
                        <p className="text-red-500 text-xs mt-1">
                          {fieldErrors[`item_${idx}_quantity`]}
                        </p>
                      )}
                    </div>

                    {/* Unit Price */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Unit Price
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={e =>
                          handleItemChange(idx, 'unitPrice', e.target.value)
                        }
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${
                          fieldErrors[`item_${idx}_unitPrice`]
                            ? 'border-red-500'
                            : 'border-slate-300'
                        }`}
                        placeholder="0.00"
                      />
                      {fieldErrors[`item_${idx}_unitPrice`] && (
                        <p className="text-red-500 text-xs mt-1">
                          {fieldErrors[`item_${idx}_unitPrice`]}
                        </p>
                      )}
                    </div>

                    {/* Line Total */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Line Total
                      </label>
                      <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-medium text-slate-900">
                        {formData.currency} {calculateLineTotal(idx)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Section */}
          <div className="border-t border-slate-200 pt-6">
            <div className="flex justify-end">
              <div className="w-full md:w-64">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Subtotal:</span>
                    <span className="font-medium">
                      {formData.currency} {calculateSubtotal()}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-lg font-semibold text-slate-900">
                    <span>Total:</span>
                    <span>
                      {formData.currency} {calculateSubtotal()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center space-x-4 border-t border-slate-200 pt-6">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-slate-400 transition font-medium"
            >
              {submitting
                ? 'Saving...'
                : isEditMode
                  ? 'Update Purchase Order'
                  : 'Create Purchase Order'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/purchase-orders')}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
