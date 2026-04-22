import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import {
  TextInput,
  SelectInput,
  DateInput,
  TextArea,
  NumberInput,
} from '../../components/FormFields'
import {
  ordersAPI,
  customersAPI,
  factoriesAPI,
  productsAPI,
} from '../../services/api'

const UNITS = [
  { value: 'sqm', label: 'sqm (Square Meter)' },
  { value: 'sqft', label: 'sqft (Square Feet)' },
  { value: 'box', label: 'box' },
  { value: 'pallet', label: 'pallet' },
  { value: 'roll', label: 'roll' },
  { value: 'piece', label: 'piece' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'CNY', label: 'CNY' },
  { value: 'GBP', label: 'GBP' },
]

const SHIPPING_METHODS = [
  { value: 'Air', label: 'Air' },
  { value: 'Sea', label: 'Sea' },
  { value: 'Land', label: 'Land' },
  { value: 'Express', label: 'Express' },
  { value: 'DHL', label: 'DHL' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'UPS', label: 'UPS' },
]

export default function OrderForm() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Loading states
  const [isLoading, setIsLoading] = useState(!!id)
  const [isSaving, setIsSaving] = useState(false)
  const [customers, setCustomers] = useState([])
  const [factories, setFactories] = useState([])
  const [products, setProducts] = useState([])
  const [loadingDropdowns, setLoadingDropdowns] = useState(true)

  // Form data
  const [formData, setFormData] = useState({
    customerId: '',
    factoryId: '',
    items: [{ productId: '', quantity: '', unitPrice: '', unit: 'piece', description: '' }],
    estimatedDelivery: '',
    shippingMethod: '',
    currency: 'USD',
    discount: 0,
    tax: 0,
    notes: '',
  })

  // Errors
  const [errors, setErrors] = useState({})

  // Load dropdowns on mount
  useEffect(() => {
    loadDropdowns()
  }, [])

  // Load order data in edit mode
  useEffect(() => {
    if (id) {
      fetchOrder()
    }
  }, [id])

  const loadDropdowns = async () => {
    try {
      setLoadingDropdowns(true)
      const [customersRes, factoriesRes, productsRes] = await Promise.all([
        customersAPI.getAll({ limit: 1000 }),
        factoriesAPI.getAll({ limit: 1000 }),
        productsAPI.getAll({ limit: 1000 }),
      ])

      setCustomers(customersRes.data || [])
      setFactories(factoriesRes.data || [])
      setProducts(productsRes.data || [])
    } catch (error) {
      console.error('Failed to load dropdowns:', error)
      toast.error('Failed to load form options')
    } finally {
      setLoadingDropdowns(false)
    }
  }

  const fetchOrder = async () => {
    try {
      const res = await ordersAPI.getById(id)
      const order = res.data

      setFormData({
        customerId: order.customerId || '',
        factoryId: order.factoryId || '',
        items: order.items || [{ productId: '', quantity: '', unitPrice: '', unit: 'piece', description: '' }],
        estimatedDelivery: order.estimatedDelivery ? order.estimatedDelivery.split('T')[0] : '',
        shippingMethod: order.shippingMethod || '',
        currency: order.currency || 'USD',
        discount: order.discount || 0,
        tax: order.tax || 0,
        notes: order.notes || '',
      })
    } catch (error) {
      console.error('Failed to fetch order:', error)
      toast.error('Failed to load order')
      navigate('/orders')
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.customerId) newErrors.customerId = 'Customer is required'
    if (!formData.factoryId) newErrors.factoryId = 'Factory is required'

    // Validate items
    if (!formData.items || formData.items.length === 0) {
      newErrors.items = 'At least one item is required'
    } else {
      formData.items.forEach((item, idx) => {
        if (!item.productId) newErrors[`item_${idx}_product`] = 'Product is required'
        if (!item.quantity || item.quantity <= 0) newErrors[`item_${idx}_quantity`] = 'Quantity must be greater than 0'
        if (!item.unitPrice || item.unitPrice <= 0) newErrors[`item_${idx}_price`] = 'Price must be greater than 0'
      })
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }))
    }
  }

  const handleItemChange = (idx, field, value) => {
    const newItems = [...formData.items]
    newItems[idx] = {
      ...newItems[idx],
      [field]: value,
    }
    setFormData((prev) => ({
      ...prev,
      items: newItems,
    }))

    // Clear item-related errors
    if (errors[`item_${idx}_${field}`]) {
      setErrors((prev) => ({
        ...prev,
        [`item_${idx}_${field}`]: '',
      }))
    }
  }

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { productId: '', quantity: '', unitPrice: '', unit: 'piece', description: '' },
      ],
    }))
  }

  const removeLineItem = (idx) => {
    if (formData.items.length === 1) {
      toast.error('At least one line item is required')
      return
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }))
  }

  const calculateLineTotal = (quantity, unitPrice) => {
    if (!quantity || !unitPrice) return 0
    return (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2)
  }

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => {
      return sum + parseFloat(calculateLineTotal(item.quantity, item.unitPrice) || 0)
    }, 0).toFixed(2)
  }

  const subtotal = calculateSubtotal()
  const discount = parseFloat(formData.discount || 0)
  const tax = parseFloat(formData.tax || 0)
  const total = (parseFloat(subtotal) - discount + tax).toFixed(2)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setIsSaving(true)

      const submitData = {
        customerId: formData.customerId,
        factoryId: formData.factoryId,
        items: formData.items.map((item) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          unit: item.unit,
          description: item.description,
        })),
        estimatedDelivery: formData.estimatedDelivery || null,
        shippingMethod: formData.shippingMethod || null,
        currency: formData.currency,
        discount: parseFloat(formData.discount) || 0,
        tax: parseFloat(formData.tax) || 0,
        notes: formData.notes || null,
      }

      if (id) {
        await ordersAPI.update(id, submitData)
        toast.success('Order updated successfully')
      } else {
        await ordersAPI.create(submitData)
        toast.success('Order created successfully')
      }

      navigate('/orders')
    } catch (error) {
      console.error('Failed to save order:', error)
      toast.error(error.response?.data?.message || 'Failed to save order')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || loadingDropdowns) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/orders')}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900">
          {id ? 'Edit Sales Order' : 'New Sales Order'}
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer and Factory Selection */}
          <div className="grid grid-cols-2 gap-4">
            <SelectInput
              label="Customer"
              name="customerId"
              value={formData.customerId}
              onChange={handleChange}
              error={errors.customerId}
              options={customers.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              required
            />
            <SelectInput
              label="Factory"
              name="factoryId"
              value={formData.factoryId}
              onChange={handleChange}
              error={errors.factoryId}
              options={factories.map((f) => ({
                value: f.id,
                label: f.name,
              }))}
              required
            />
          </div>

          {/* Line Items Section */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Items</h2>
            {errors.items && <p className="text-red-500 text-sm mb-4">{errors.items}</p>}

            <div className="space-y-4">
              {formData.items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="grid grid-cols-12 gap-4 mb-4">
                    {/* Product */}
                    <div className="col-span-4">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Product
                        <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={item.productId}
                        onChange={(e) =>
                          handleItemChange(idx, 'productId', e.target.value)
                        }
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          errors[`item_${idx}_product`]
                            ? 'border-red-500'
                            : 'border-slate-300'
                        }`}
                      >
                        <option value="">Select product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                      {errors[`item_${idx}_product`] && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors[`item_${idx}_product`]}
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Quantity
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(idx, 'quantity', e.target.value)
                        }
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          errors[`item_${idx}_quantity`]
                            ? 'border-red-500'
                            : 'border-slate-300'
                        }`}
                        placeholder="0"
                      />
                      {errors[`item_${idx}_quantity`] && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors[`item_${idx}_quantity`]}
                        </p>
                      )}
                    </div>

                    {/* Unit */}
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Unit
                      </label>
                      <select
                        value={item.unit}
                        onChange={(e) =>
                          handleItemChange(idx, 'unit', e.target.value)
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Unit Price */}
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Unit Price
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleItemChange(idx, 'unitPrice', e.target.value)
                        }
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          errors[`item_${idx}_price`]
                            ? 'border-red-500'
                            : 'border-slate-300'
                        }`}
                        placeholder="0.00"
                      />
                      {errors[`item_${idx}_price`] && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors[`item_${idx}_price`]}
                        </p>
                      )}
                    </div>

                    {/* Delete Button */}
                    <div className="col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Line Total and Description */}
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-6">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Description
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(idx, 'description', e.target.value)
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Optional description"
                      />
                    </div>
                    <div className="col-span-6">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Line Total
                      </label>
                      <div className="px-4 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-900 font-semibold">
                        {calculateLineTotal(item.quantity, item.unitPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addLineItem}
              className="mt-4 flex items-center space-x-2 px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Add Line Item</span>
            </button>
          </div>

          {/* Summary Section */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Summary</h2>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-slate-700">
                <span>Subtotal:</span>
                <span className="font-semibold">{subtotal}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Discount:</span>
                <span className="font-semibold">- {discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Tax:</span>
                <span className="font-semibold">+ {tax.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-300 pt-3 flex justify-between text-lg font-bold text-slate-900">
                <span>Total:</span>
                <span>{total}</span>
              </div>
            </div>
          </div>

          {/* Additional Fields */}
          <div className="border-t pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <SelectInput
                label="Currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                options={CURRENCIES}
              />
              <DateInput
                label="Estimated Delivery"
                name="estimatedDelivery"
                value={formData.estimatedDelivery}
                onChange={handleChange}
              />
            </div>

            <SelectInput
              label="Shipping Method"
              name="shippingMethod"
              value={formData.shippingMethod}
              onChange={handleChange}
              options={SHIPPING_METHODS}
            />

            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                label="Discount Amount"
                name="discount"
                value={formData.discount}
                onChange={handleChange}
                step="0.01"
              />
              <NumberInput
                label="Tax Amount"
                name="tax"
                value={formData.tax}
                onChange={handleChange}
                step="0.01"
              />
            </div>

            <TextArea
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 font-medium"
            >
              {isSaving ? 'Saving...' : id ? 'Update Order' : 'Create Order'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
