import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2, Loader } from 'lucide-react'
import {
  TextInput,
  NumberInput,
  SelectInput,
  DateInput,
  TextArea,
} from '../../components/FormFields'
import { quotationsAPI, customersAPI, productsAPI, factoriesAPI, leadsAPI } from '../../services/api'
import BrandPicker from '../../components/BrandPicker'
import { filterByFlooring, useShowAllCategories } from '../../utils/productCategoryFilter'
import { useAuth } from '../../hooks/useAuth'

const UNITS = [
  { value: 'sqm', label: 'Square Meter (sqm)' },
  { value: 'sqft', label: 'Square Foot (sqft)' },
  { value: 'box', label: 'Box' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'roll', label: 'Roll' },
  { value: 'piece', label: 'Piece' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'GBP', label: 'GBP - British Pound' },
]

export default function QuotationForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)

  // State
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const [loading, setLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [factories, setFactories] = useState([])
  const [leads, setLeads] = useState([])
  const [errors, setErrors] = useState({})
  // Phase 4.5, C21: line-item product picker is flooring-only by default.
  // Super-admin can flip the toggle on (shared with the catalog page).
  const [showAllCategories, setShowAllCategories] = useShowAllCategories()
  const visibleProducts = filterByFlooring(products, showAllCategories)

  const [formData, setFormData] = useState({
    // Phase 3, C13: brand context. BrandPicker auto-fills from
    // useBrands().defaultBrand on mount; disabled in edit mode.
    brandCode: '',
    customerId: '',
    factoryId: '',
    leadId: '',
    items: [
      {
        id: Date.now(),
        productId: '',
        description: '',
        quantity: 1,
        unit: 'piece',
        unitPrice: 0,
        discount: 0,
        notes: '',
      },
    ],
    validUntil: '',
    currency: 'USD',
    discount: 0,
    discountType: 'fixed',
    taxRate: 0,
    terms: '',
    notes: '',
  })

  // Load customers and products on mount.
  // Phase 4, C14: products are filtered by current brand context so the
  // catalog picker only shows quotable items.
  useEffect(() => {
    const loadData = async () => {
      try {
        const [customersRes, factoriesRes, leadsRes] = await Promise.all([
          customersAPI.getAll(),
          factoriesAPI.getAll({ limit: 200 }),
          leadsAPI.getAll({ limit: 200 }),
        ])
        setCustomers(customersRes.data || [])
        setFactories(factoriesRes.data || [])
        setLeads(leadsRes.data || [])
      } catch (error) {
        toast.error('Failed to load form data (customers, factories, leads)')
        console.error(error)
      }
    }
    loadData()
  }, [])

  // Phase 4, C14: re-fetch products when brand context changes so the
  // dropdown is always brand-filtered. status=active is the typical
  // catalog filter.
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const params = { limit: 200, status: 'active' }
        if (formData.brandCode) params.brandCode = formData.brandCode
        const res = await productsAPI.getAll(params)
        setProducts(Array.isArray(res.data) ? res.data : (res.data?.data || []))
      } catch (error) {
        console.error('Failed to load products', error)
      }
    }
    loadProducts()
  }, [formData.brandCode])

  // Load quotation data in edit mode
  useEffect(() => {
    if (isEditMode) {
      const loadQuotation = async () => {
        try {
          const response = await quotationsAPI.getById(id)
          const quotation = response.data
          setFormData({
            customerId: quotation.customerId || '',
            factoryId: quotation.factoryId || '',
            leadId: quotation.leadId || '',
            items: (quotation.items || []).map((item) => ({
              id: item.id || Date.now(),
              productId: item.productId || '',
              description: item.description || '',
              quantity: item.quantity || 1,
              unit: item.unit || 'piece',
              unitPrice: item.unitPrice || 0,
              discount: item.discount || 0,
              notes: item.notes || '',
            })),
            validUntil: quotation.validUntil
              ? quotation.validUntil.split('T')[0]
              : '',
            currency: quotation.currency || 'USD',
            discount: quotation.discount || 0,
            discountType: quotation.discountType || 'fixed',
            taxRate: quotation.taxRate || 0,
            terms: quotation.terms || '',
            notes: quotation.notes || '',
          })
        } catch (error) {
          toast.error('Failed to load quotation')
          console.error(error)
          navigate('/quotations')
        } finally {
          setLoading(false)
        }
      }
      loadQuotation()
    }
  }, [id, isEditMode, navigate])

  // Calculate line total for a specific item
  const calculateLineTotal = (item) => {
    const subtotal = item.quantity * item.unitPrice
    const lineDiscount = item.discount || 0
    return Math.max(0, subtotal - lineDiscount)
  }

  // Calculate subtotal (sum of all line items)
  const subtotal = formData.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  )

  // Calculate discount amount
  const discountAmount =
    formData.discountType === 'percentage'
      ? (subtotal * formData.discount) / 100
      : formData.discount

  // Calculate subtotal after discount
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount)

  // Calculate tax
  const taxAmount = (subtotalAfterDiscount * formData.taxRate) / 100

  // Calculate total
  const total = subtotalAfterDiscount + taxAmount

  // Handlers
  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'quantity' || name === 'unitPrice' || name === 'discount'
          ? parseFloat(value) || 0
          : value,
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleItemChange = (itemId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]:
                field === 'quantity' ||
                field === 'unitPrice' ||
                field === 'discount'
                  ? parseFloat(value) || 0
                  : value,
            }
          : item
      ),
    }))
  }

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: Date.now(),
          productId: '',
          description: '',
          quantity: 1,
          unit: 'piece',
          unitPrice: 0,
          discount: 0,
          notes: '',
        },
      ],
    }))
  }

  const removeLineItem = (itemId) => {
    if (formData.items.length === 1) {
      toast.error('At least one line item is required')
      return
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }))
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.customerId) {
      newErrors.customerId = 'Customer is required'
    }

    if (formData.items.length === 0) {
      newErrors.items = 'At least one line item is required'
    }

    formData.items.forEach((item, index) => {
      if (!item.productId) {
        newErrors[`item_${index}_product`] = 'Product is required'
      }
      if (!item.quantity || item.quantity <= 0) {
        newErrors[`item_${index}_quantity`] = 'Quantity must be greater than 0'
      }
      if (!item.unit) {
        newErrors[`item_${index}_unit`] = 'Unit is required'
      }
      if (!item.unitPrice || item.unitPrice <= 0) {
        newErrors[`item_${index}_price`] = 'Unit price must be greater than 0'
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error('Please fix the errors in the form')
      return
    }

    setSubmitting(true)

    try {
      const submitData = {
        customerId: formData.customerId,
        ...(formData.factoryId && { factoryId: formData.factoryId }),
        ...(formData.leadId && { leadId: formData.leadId }),
        items: formData.items.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          ...(item.discount && { discount: item.discount }),
          ...(item.notes && { notes: item.notes }),
          // Phase 4, C14: super-admin below-floor override reason. Server
          // ignores the field when unitPrice is at or above floor.
          ...(item.belowFloorReason && { belowFloorReason: item.belowFloorReason }),
        })),
        ...(formData.validUntil && { validUntil: formData.validUntil }),
        currency: formData.currency,
        ...(formData.discount && { discount: formData.discount }),
        discountType: formData.discountType,
        ...(formData.taxRate && { taxRate: formData.taxRate }),
        ...(formData.terms && { terms: formData.terms }),
        ...(formData.notes && { notes: formData.notes }),
        // Phase 3, C13: send brandCode on create (D-5 brand-locked-at-creation
        // so the backend ignores it on edit anyway).
        ...(formData.brandCode && { brandCode: formData.brandCode }),
      }

      if (isEditMode) {
        await quotationsAPI.update(id, submitData)
        toast.success('Quotation updated successfully')
      } else {
        const res = await quotationsAPI.create(submitData)
        toast.success('Quotation created successfully')
        // Phase 3, C13: cross-brand auto-add toast. Backend returns
        // autoAddedBrand when the create extended customer.brandRelationships.
        const autoAdded = res?.data?.autoAddedBrand
        if (autoAdded) {
          toast(
            `Customer is now also a ${autoAdded} relationship.`,
            { icon: '🔁', duration: 5000 },
          )
        }
      }

      navigate('/quotations')
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to save quotation'
      toast.error(message)
      console.error(error)
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
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/quotations')}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900">
          {isEditMode ? 'Edit Quotation' : 'New Quotation'}
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Phase 3, C13: brand picker — top of form so it's the first
            decision. Disabled in edit mode (D-5 brand-locked-at-creation). */}
        <div className="bg-white rounded-lg shadow p-6">
          <BrandPicker
            value={formData.brandCode}
            onChange={(v) => setFormData((prev) => ({ ...prev, brandCode: v }))}
            disabled={isEditMode}
          />
        </div>

        {/* Customer Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Customer Information
          </h2>
          <SelectInput
            label="Customer"
            name="customerId"
            value={formData.customerId}
            onChange={handleFormChange}
            options={customers.map((c) => ({
              value: c.id,
              label: c.name || c.companyName,
            }))}
            error={errors.customerId}
            required
          />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput
              label="Source factory (optional)"
              name="factoryId"
              value={formData.factoryId}
              onChange={handleFormChange}
              options={[
                { value: '', label: '— None —' },
                ...factories.map((f) => ({
                  value: f.id,
                  label: f.companyName,
                })),
              ]}
              error={errors.factoryId}
            />
            <SelectInput
              label="Originating lead (optional)"
              name="leadId"
              value={formData.leadId}
              onChange={handleFormChange}
              options={[
                { value: '', label: '— None —' },
                ...leads.map((l) => ({
                  value: l.id,
                  label: `${l.companyName}${l.contactName ? ' — ' + l.contactName : ''}`,
                })),
              ]}
              error={errors.leadId}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Source factory carries the price provenance through to PI / Sales Order / Invoice. Originating lead links the quote back to its outbound prospect (set when the lead becomes a customer).
          </p>
        </div>

        {/* Line Items Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Line Items</h2>
            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
            </button>
          </div>

          {errors.items && (
            <p className="text-red-500 text-sm mb-4">{errors.items}</p>
          )}

          <div className="space-y-4">
            {formData.items.map((item, index) => (
              <div
                key={item.id}
                className="border border-slate-200 rounded-lg p-4 bg-slate-50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-slate-900">Item {index + 1}</h3>
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectInput
                    label="Product"
                    value={item.productId}
                    onChange={(e) => {
                      // Phase 4, C14: when the user picks a product from the
                      // brand-filtered catalog, auto-populate unitPrice from
                      // baseFobPrice (the floor). User can edit upward freely;
                      // below floor needs super-admin + reason (server-enforced).
                      const newProductId = e.target.value
                      const selected = products.find((p) => p.id === newProductId)
                      setFormData((prev) => ({
                        ...prev,
                        items: prev.items.map((it) =>
                          it.id === item.id
                            ? {
                                ...it,
                                productId: newProductId,
                                unit: selected?.moqUnit || selected?.unit || it.unit,
                                unitPrice: selected?.baseFobPrice != null
                                  ? parseFloat(selected.baseFobPrice)
                                  : it.unitPrice,
                                belowFloorReason: '',
                              }
                            : it
                        ),
                      }))
                    }}
                    options={visibleProducts.map((p) => ({
                      value: p.id,
                      label: `${p.sku ? p.sku + ' · ' : ''}${p.name}`,
                    }))}
                    error={errors[`item_${index}_product`]}
                    required
                  />

                  <TextInput
                    label="Description (Optional)"
                    value={item.description}
                    onChange={(e) =>
                      handleItemChange(item.id, 'description', e.target.value)
                    }
                  />

                  <NumberInput
                    label="Quantity"
                    value={item.quantity}
                    onChange={(e) =>
                      handleItemChange(item.id, 'quantity', e.target.value)
                    }
                    min="0.01"
                    step="0.01"
                    error={errors[`item_${index}_quantity`]}
                    required
                  />

                  <SelectInput
                    label="Unit"
                    value={item.unit}
                    onChange={(e) =>
                      handleItemChange(item.id, 'unit', e.target.value)
                    }
                    options={UNITS}
                    error={errors[`item_${index}_unit`]}
                    required
                  />

                  <div>
                    <NumberInput
                      label="Unit Price"
                      value={item.unitPrice}
                      onChange={(e) =>
                        handleItemChange(item.id, 'unitPrice', e.target.value)
                      }
                      min="0"
                      step="0.01"
                      error={errors[`item_${index}_price`]}
                      required
                    />
                    {/* Phase 4, C14: floor hint + below-floor warning */}
                    {(() => {
                      const product = products.find((p) => p.id === item.productId)
                      if (!product || product.baseFobPrice == null) return null
                      const floor = parseFloat(product.baseFobPrice)
                      const isBelow = parseFloat(item.unitPrice || 0) < floor
                      return (
                        <div className={`mt-1 text-xs ${isBelow ? 'text-amber-700' : 'text-slate-500'}`}>
                          {isBelow ? (
                            <>
                              <strong>Below floor</strong> ({floor.toFixed(2)} {product.currency || 'USD'}).
                              Super-admin can quote below with a written reason; otherwise raise to floor.
                            </>
                          ) : (
                            <>Floor: {floor.toFixed(2)} {product.currency || 'USD'}. Editable upward without approval.</>
                          )}
                        </div>
                      )
                    })()}
                    {/* Below-floor reason input — only shows when actually below */}
                    {(() => {
                      const product = products.find((p) => p.id === item.productId)
                      if (!product || product.baseFobPrice == null) return null
                      const floor = parseFloat(product.baseFobPrice)
                      const isBelow = parseFloat(item.unitPrice || 0) < floor
                      if (!isBelow) return null
                      return (
                        <input
                          type="text"
                          placeholder="Reason for quoting below floor (super-admin required, min 5 chars)"
                          value={item.belowFloorReason || ''}
                          onChange={(e) => handleItemChange(item.id, 'belowFloorReason', e.target.value)}
                          className="mt-2 w-full px-3 py-2 border border-amber-300 rounded text-xs bg-amber-50"
                        />
                      )
                    })()}
                  </div>

                  <NumberInput
                    label="Line Discount (Amount)"
                    value={item.discount}
                    onChange={(e) =>
                      handleItemChange(item.id, 'discount', e.target.value)
                    }
                    min="0"
                    step="0.01"
                  />

                  <TextInput
                    label="Notes (Optional)"
                    value={item.notes}
                    onChange={(e) =>
                      handleItemChange(item.id, 'notes', e.target.value)
                    }
                  />

                  {/* Line Total Display */}
                  <div className="bg-white rounded border border-slate-200 p-3">
                    <p className="text-xs font-medium text-slate-600">
                      Line Total
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formData.currency}{' '}
                      {calculateLineTotal(item).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Terms Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Quotation Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <DateInput
              label="Valid Until"
              name="validUntil"
              value={formData.validUntil}
              onChange={handleFormChange}
            />

            <SelectInput
              label="Currency"
              name="currency"
              value={formData.currency}
              onChange={handleFormChange}
              options={CURRENCIES}
              required
            />

            <NumberInput
              label={
                formData.discountType === 'percentage'
                  ? 'Discount (%)'
                  : 'Discount Amount'
              }
              name="discount"
              value={formData.discount}
              onChange={handleFormChange}
              min="0"
              step="0.01"
            />

            <SelectInput
              label="Discount Type"
              name="discountType"
              value={formData.discountType}
              onChange={handleFormChange}
              options={[
                { value: 'fixed', label: 'Fixed Amount' },
                { value: 'percentage', label: 'Percentage' },
              ]}
            />

            <NumberInput
              label="Tax Rate (%)"
              name="taxRate"
              value={formData.taxRate}
              onChange={handleFormChange}
              min="0"
              max="100"
              step="0.01"
            />
          </div>

          <TextArea
            label="Terms (Optional)"
            name="terms"
            value={formData.terms}
            onChange={handleFormChange}
            rows={3}
          />

          <TextArea
            label="Notes (Optional)"
            name="notes"
            value={formData.notes}
            onChange={handleFormChange}
            rows={3}
          />
        </div>

        {/* Summary Section */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg shadow p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Summary
          </h2>

          <div className="space-y-3">
            <div className="flex justify-between text-slate-700">
              <span>Subtotal:</span>
              <span className="font-medium">
                {formData.currency} {subtotal.toFixed(2)}
              </span>
            </div>

            {formData.discount > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>
                  Discount
                  {formData.discountType === 'percentage'
                    ? ` (${formData.discount}%)`
                    : ''}
                  :
                </span>
                <span className="font-medium text-red-600">
                  -{formData.currency} {discountAmount.toFixed(2)}
                </span>
              </div>
            )}

            <div className="border-t border-slate-300 pt-3 flex justify-between text-slate-700">
              <span>Subtotal after Discount:</span>
              <span className="font-medium">
                {formData.currency} {subtotalAfterDiscount.toFixed(2)}
              </span>
            </div>

            {formData.taxRate > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>Tax ({formData.taxRate}%):</span>
                <span className="font-medium">
                  {formData.currency} {taxAmount.toFixed(2)}
                </span>
              </div>
            )}

            <div className="border-t border-slate-300 pt-3 flex justify-between text-lg">
              <span className="font-semibold text-slate-900">Total:</span>
              <span className="font-bold text-primary-600">
                {formData.currency} {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-medium transition flex items-center justify-center space-x-2"
          >
            {submitting && <Loader className="w-4 h-4 animate-spin" />}
            <span>
              {submitting
                ? 'Saving...'
                : isEditMode
                  ? 'Update Quotation'
                  : 'Create Quotation'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/quotations')}
            className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
