import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader, Trash2, Plus } from 'lucide-react'
import { TextInput, SelectInput, DateInput, NumberInput, TextArea } from '../../components/FormFields'
import { customersAPI, productsAPI, inquiriesAPI } from '../../services/api'

export default function InquiryForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id

  const [loading, setLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  const [formData, setFormData] = useState({
    customerId: '',
    source: 'email',
    priority: 'medium',
    followUpDate: '',
    estimatedValue: 0,
    notes: '',
    items: [
      {
        id: Date.now(),
        productId: '',
        quantity: 1,
        unit: 'pcs',
        targetPrice: 0,
        notes: '',
      },
    ],
  })

  const [errors, setErrors] = useState({})

  // Load customers and products on mount
  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        setLoadingData(true)
        const [customersRes, productsRes] = await Promise.all([
          customersAPI.getAll(),
          productsAPI.getAll(),
        ])
        setCustomers(customersRes.data || [])
        setProducts(productsRes.data || [])
      } catch (error) {
        toast.error('Failed to load customers or products')
        console.error(error)
      } finally {
        setLoadingData(false)
      }
    }

    loadDropdownData()
  }, [])

  // Load inquiry data if editing
  useEffect(() => {
    if (!isEditMode) {
      setLoading(false)
      return
    }

    const loadInquiry = async () => {
      try {
        const res = await inquiriesAPI.getById(id)
        const inquiry = res.data

        setFormData({
          customerId: inquiry.customerId || '',
          source: inquiry.source || 'email',
          priority: inquiry.priority || 'medium',
          followUpDate: inquiry.followUpDate ? inquiry.followUpDate.split('T')[0] : '',
          estimatedValue: inquiry.estimatedValue || 0,
          notes: inquiry.notes || '',
          items: (inquiry.items || []).map((item) => ({
            id: item.id || Date.now(),
            productId: item.productId || '',
            quantity: item.quantity || 1,
            unit: item.unit || 'pcs',
            targetPrice: item.targetPrice || 0,
            notes: item.notes || '',
          })),
        })
      } catch (error) {
        toast.error('Failed to load inquiry')
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadInquiry()
  }, [id, isEditMode])

  const validateForm = () => {
    const newErrors = {}

    if (!formData.customerId) newErrors.customerId = 'Customer is required'
    if (formData.items.length === 0) newErrors.items = 'At least one line item is required'
    else {
      formData.items.forEach((item, idx) => {
        if (!item.productId) {
          newErrors[`item_${idx}_product`] = 'Product is required'
        }
        if (item.quantity <= 0) {
          newErrors[`item_${idx}_quantity`] = 'Quantity must be greater than 0'
        }
      })
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'estimatedValue' ? parseFloat(value) || 0 : value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleItemChange = (idx, field, value) => {
    const newItems = [...formData.items]
    newItems[idx] = {
      ...newItems[idx],
      [field]: field === 'quantity' || field === 'targetPrice' ? parseFloat(value) || 0 : value,
    }
    setFormData((prev) => ({ ...prev, items: newItems }))

    const errorKey = `item_${idx}_${field}`
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: '' }))
    }
  }

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: Date.now(),
          productId: '',
          quantity: 1,
          unit: 'pcs',
          targetPrice: 0,
          notes: '',
        },
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

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    setSubmitting(true)
    try {
      const payload = {
        customerId: formData.customerId,
        items: formData.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit || undefined,
          targetPrice: item.targetPrice || undefined,
          notes: item.notes || undefined,
        })),
        source: formData.source || undefined,
        priority: formData.priority || undefined,
        followUpDate: formData.followUpDate || undefined,
        estimatedValue: formData.estimatedValue || undefined,
        notes: formData.notes || undefined,
      }

      if (isEditMode) {
        await inquiriesAPI.update(id, payload)
        toast.success('Inquiry updated successfully')
      } else {
        await inquiriesAPI.create(payload)
        toast.success('Inquiry created successfully')
      }

      navigate('/inquiries')
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Failed to save inquiry')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/inquiries')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900">
          {isEditMode ? 'Edit Inquiry' : 'New Inquiry'}
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-6xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-3 gap-6">
              <SelectInput
                label="Customer"
                name="customerId"
                value={formData.customerId}
                onChange={handleChange}
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
                error={errors.customerId}
                required
                disabled={loadingData}
              />

              <SelectInput
                label="Source"
                name="source"
                value={formData.source}
                onChange={handleChange}
                options={[
                  { value: 'web', label: 'Web' },
                  { value: 'email', label: 'Email' },
                  { value: 'phone', label: 'Phone' },
                  { value: 'portal', label: 'Portal' },
                ]}
              />

              <SelectInput
                label="Priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
              />
            </div>
          </div>

          {/* Timeline & Value */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Timeline & Value</h2>
            <div className="grid grid-cols-2 gap-6">
              <DateInput
                label="Follow-up Date"
                name="followUpDate"
                value={formData.followUpDate}
                onChange={handleChange}
              />

              <NumberInput
                label="Estimated Value (USD)"
                name="estimatedValue"
                value={formData.estimatedValue}
                onChange={handleChange}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Line Items</h2>
              <button
                type="button"
                onClick={addLineItem}
                className="inline-flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
            </div>

            {errors.items && <p className="text-red-500 text-sm mb-4">{errors.items}</p>}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Product</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Quantity</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Unit</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Target Price</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Notes</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <select
                          value={item.productId}
                          onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${
                            errors[`item_${idx}_product`] ? 'border-red-500' : 'border-slate-300'
                          }`}
                          disabled={loadingData}
                        >
                          <option value="">Select product</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        {errors[`item_${idx}_product`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`item_${idx}_product`]}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${
                            errors[`item_${idx}_quantity`] ? 'border-red-500' : 'border-slate-300'
                          }`}
                          min="1"
                          step="1"
                        />
                        {errors[`item_${idx}_quantity`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`item_${idx}_quantity`]}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        >
                          <option value="pcs">pcs</option>
                          <option value="kg">kg</option>
                          <option value="m">m</option>
                          <option value="box">box</option>
                          <option value="lot">lot</option>
                          <option value="other">other</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.targetPrice}
                          onChange={(e) => handleItemChange(idx, 'targetPrice', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder="Notes..."
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Additional Information</h2>
            <TextArea
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Add any additional notes or comments about this inquiry..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex space-x-3 pt-6 border-t border-slate-200">
            <button
              type="submit"
              disabled={submitting || loadingData}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {submitting ? 'Saving...' : isEditMode ? 'Update Inquiry' : 'Create Inquiry'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/inquiries')}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
