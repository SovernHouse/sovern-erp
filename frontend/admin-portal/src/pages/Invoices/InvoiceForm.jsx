import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader } from 'lucide-react'
import { TextInput, SelectInput, DateInput, NumberInput, TextArea, CurrencyInput } from '../../components/FormFields'
import { customersAPI, ordersAPI, invoicesAPI } from '../../services/api'

export default function InvoiceForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id

  const [loading, setLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  const [formData, setFormData] = useState({
    customerId: '',
    salesOrderId: '',
    type: 'sales',
    dueDate: '',
    paymentTerms: 'Net 30',
    currency: 'USD',
    subtotal: 0,
    discount: 0,
    tax: 0,
    notes: '',
  })

  const [errors, setErrors] = useState({})

  // Load customers and orders on mount
  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        setLoadingData(true)
        const [customersRes, ordersRes] = await Promise.all([
          customersAPI.getAll(),
          ordersAPI.getAll(),
        ])
        setCustomers(customersRes.data || [])
        setOrders(ordersRes.data || [])
      } catch (error) {
        toast.error('Failed to load customers or orders')
        console.error(error)
      } finally {
        setLoadingData(false)
      }
    }

    loadDropdownData()
  }, [])

  // Load invoice data if editing
  useEffect(() => {
    if (!isEditMode) {
      setLoading(false)
      return
    }

    const loadInvoice = async () => {
      try {
        const res = await invoicesAPI.getById(id)
        const invoice = res.data

        setFormData({
          customerId: invoice.customerId || '',
          salesOrderId: invoice.salesOrderId || '',
          type: invoice.type || 'sales',
          dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
          paymentTerms: invoice.paymentTerms || 'Net 30',
          currency: invoice.currency || 'USD',
          subtotal: invoice.subtotal || 0,
          discount: invoice.discount || 0,
          tax: invoice.tax || 0,
          notes: invoice.notes || '',
        })
      } catch (error) {
        toast.error('Failed to load invoice')
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadInvoice()
  }, [id, isEditMode])

  const validateForm = () => {
    const newErrors = {}

    if (!formData.customerId) newErrors.customerId = 'Customer is required'
    if (!formData.dueDate) newErrors.dueDate = 'Due date is required'
    if (formData.subtotal <= 0) newErrors.subtotal = 'Subtotal must be greater than 0'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'subtotal' || name === 'discount' || name === 'tax' ? parseFloat(value) || 0 : value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    setSubmitting(true)
    try {
      const payload = {
        customerId: formData.customerId,
        subtotal: formData.subtotal,
        dueDate: formData.dueDate,
        salesOrderId: formData.salesOrderId || undefined,
        type: formData.type || undefined,
        discount: formData.discount || undefined,
        tax: formData.tax || undefined,
        paymentTerms: formData.paymentTerms || undefined,
        notes: formData.notes || undefined,
      }

      if (isEditMode) {
        await invoicesAPI.update(id, payload)
        toast.success('Invoice updated successfully')
      } else {
        await invoicesAPI.create(payload)
        toast.success('Invoice created successfully')
      }

      navigate('/invoices')
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Failed to save invoice')
    } finally {
      setSubmitting(false)
    }
  }

  const total = formData.subtotal - formData.discount + formData.tax
  const balance = total

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
        <button onClick={() => navigate('/invoices')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900">
          {isEditMode ? 'Edit Invoice' : 'New Invoice'}
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-6">
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
                label="Sales Order (Optional)"
                name="salesOrderId"
                value={formData.salesOrderId}
                onChange={handleChange}
                options={orders.map((o) => ({ value: o.id, label: o.number || o.id }))}
                disabled={loadingData}
              />

              <SelectInput
                label="Type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                options={[
                  { value: 'sales', label: 'Sales Invoice' },
                  { value: 'purchase', label: 'Purchase Invoice' },
                  { value: 'credit_note', label: 'Credit Note' },
                  { value: 'debit_note', label: 'Debit Note' },
                ]}
              />

              <DateInput
                label="Due Date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                error={errors.dueDate}
                required
              />
            </div>
          </div>

          {/* Payment Terms */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment Terms</h2>
            <div className="grid grid-cols-2 gap-6">
              <SelectInput
                label="Payment Terms"
                name="paymentTerms"
                value={formData.paymentTerms}
                onChange={handleChange}
                options={[
                  { value: 'Due on Receipt', label: 'Due on Receipt' },
                  { value: 'Net 15', label: 'Net 15' },
                  { value: 'Net 30', label: 'Net 30' },
                  { value: 'Net 45', label: 'Net 45' },
                  { value: 'Net 60', label: 'Net 60' },
                ]}
              />

              <SelectInput
                label="Currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'EUR', label: 'EUR' },
                  { value: 'GBP', label: 'GBP' },
                  { value: 'CNY', label: 'CNY' },
                  { value: 'JPY', label: 'JPY' },
                ]}
              />
            </div>
          </div>

          {/* Financial Details */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Financial Details</h2>
            <div className="grid grid-cols-2 gap-6">
              <CurrencyInput
                label="Subtotal"
                name="subtotal"
                value={formData.subtotal}
                onChange={handleChange}
                currency={formData.currency}
                error={errors.subtotal}
                required
              />

              <CurrencyInput
                label="Discount"
                name="discount"
                value={formData.discount}
                onChange={handleChange}
                currency={formData.currency}
              />

              <CurrencyInput
                label="Tax"
                name="tax"
                value={formData.tax}
                onChange={handleChange}
                currency={formData.currency}
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Total</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg text-slate-700 font-medium">
                    {formData.currency}
                  </span>
                  <input
                    type="number"
                    disabled
                    value={total.toFixed(2)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-r-lg bg-slate-50 text-slate-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Balance Due</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg text-slate-700 font-medium">
                    {formData.currency}
                  </span>
                  <input
                    type="number"
                    disabled
                    value={balance.toFixed(2)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-r-lg bg-slate-50 text-slate-600 font-medium"
                  />
                </div>
              </div>
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
              placeholder="Add any additional notes or comments about this invoice..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex space-x-3 pt-6 border-t border-slate-200">
            <button
              type="submit"
              disabled={submitting || loadingData}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {submitting ? 'Saving...' : isEditMode ? 'Update Invoice' : 'Create Invoice'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/invoices')}
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
