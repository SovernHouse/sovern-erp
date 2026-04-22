import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronRight, Trash2, Plus } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { quotationsAPI, productsAPI } from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { formatCurrency } from '../../utils/formatters'

const STEPS = [
  { id: 1, label: 'Select Products' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Review & Submit' },
]

export default function QuotationRequest() {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [special, setSpecial] = useState('')

  const { items, addItem, updateQuantity, removeItem, getTotalPrice } = useCart()

  useEffect(() => {
    fetchProducts()
    if (location.state?.preSelectedProduct) {
      const qty = location.state.preSelectedQuantity || 1
      addItem(location.state.preSelectedProduct, qty)
    }
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await productsAPI.list({ limit: 50 })
      setProducts(response.data.products || [])
    } catch (err) {
      console.error('Failed to fetch products:', err)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleAddProduct = (product) => {
    const existingItem = items.find((item) => item.product.id === product.id)
    if (existingItem) {
      updateQuantity(product.id, existingItem.quantity + 1)
    } else {
      addItem(product, 1)
    }
    toast.success(`${product.name} added`)
  }

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    setSubmitting(true)
    try {
      const quotationData = {
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          specs: item.specs,
        })),
        notes,
        specialRequirements: special,
      }

      const response = await quotationsAPI.create(quotationData)
      toast.success('Quotation request submitted successfully!')
      navigate(`/quotations/${response.data.quotation.id}`)
    } catch (err) {
      console.error('Failed to submit quotation:', err)
      toast.error(err.response?.data?.message || 'Failed to submit quotation')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 1) {
    return (
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Request a Quotation</h1>
          <p className="text-gray-600 mt-1">Step {step} of {STEPS.length}</p>
        </div>

        {/* Steps */}
        <div className="flex gap-4">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  s.id <= step
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s.id}
              </div>
              <span className={s.id <= step ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                {s.label}
              </span>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="text-gray-300 mx-2" size={20} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Products List */}
          <div className="col-span-2 space-y-4">
            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className="space-y-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <img
                        src={product.image || 'https://via.placeholder.com/80'}
                        alt={product.name}
                        className="w-20 h-20 object-cover rounded-lg bg-gray-100"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.category}</p>
                        <p className="text-accent-600 font-semibold mt-1">
                          {formatCurrency(product.price)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddProduct(product)}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      <Plus size={18} />
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Summary */}
          <div className="card p-6 h-fit sticky top-6">
            <h3 className="font-semibold text-gray-900 mb-4">Selected Items</h3>
            {items.length === 0 ? (
              <p className="text-gray-500 text-sm">No items selected</p>
            ) : (
              <>
                <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {item.product.name}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(item.product.id, Math.max(1, +e.target.value))
                            }
                            className="w-12 input-base text-center text-sm"
                          />
                          <span className="text-xs text-gray-600">
                            @ {formatCurrency(item.product.price)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600">Subtotal</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(getTotalPrice())}
                  </p>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={items.length === 0}
                  className="w-full mt-4 btn-primary"
                >
                  Continue
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Request a Quotation</h1>
          <p className="text-gray-600 mt-1">Step {step} of {STEPS.length}</p>
        </div>

        {/* Steps */}
        <div className="flex gap-4">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  s.id <= step
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s.id}
              </div>
              <span className={s.id <= step ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                {s.label}
              </span>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="text-gray-300 mx-2" size={20} />
              )}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="card p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes or preferences?"
              rows={5}
              className="input-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Special Requirements
            </label>
            <textarea
              value={special}
              onChange={(e) => setSpecial(e.target.value)}
              placeholder="Any special requirements or customizations?"
              rows={5}
              className="input-base"
            />
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              onClick={() => setStep(1)}
              className="flex-1 btn-secondary"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 btn-primary"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Request a Quotation</h1>
        <p className="text-gray-600 mt-1">Step {step} of {STEPS.length}</p>
      </div>

      {/* Steps */}
      <div className="flex gap-4">
        {STEPS.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                s.id <= step
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {s.id}
            </div>
            <span className={s.id <= step ? 'text-gray-900 font-medium' : 'text-gray-500'}>
              {s.label}
            </span>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="text-gray-300 mx-2" size={20} />
            )}
          </div>
        ))}
      </div>

      {/* Review */}
      <div className="card p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Review Your Request</h2>

        {/* Items */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Items</h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.product.id} className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.product.name}</p>
                  <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                </div>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(item.product.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-700 font-medium">Estimated Total</p>
            <p className="text-2xl font-bold text-primary-600">
              {formatCurrency(getTotalPrice())}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Final price will be determined based on bulk pricing and market conditions.
          </p>
        </div>

        {notes && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900">Notes</p>
            <p className="text-sm text-blue-800 mt-2">{notes}</p>
          </div>
        )}

        {special && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm font-medium text-orange-900">Special Requirements</p>
            <p className="text-sm text-orange-800 mt-2">{special}</p>
          </div>
        )}

        <div className="flex gap-3 pt-6 border-t border-gray-200">
          <button
            onClick={() => setStep(2)}
            className="flex-1 btn-secondary"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 btn-primary disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
