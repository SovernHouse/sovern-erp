import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { claimsAPI, ordersAPI } from '../../services/api'
import FileUpload from '../../components/FileUpload'
import LoadingSpinner from '../../components/LoadingSpinner'
import { CLAIM_TYPES } from '../../utils/constants'
import toast from 'react-hot-toast'

const STEPS = [
  { id: 1, label: 'Select Order' },
  { id: 2, label: 'Claim Details' },
  { id: 3, label: 'Upload Evidence' },
  { id: 4, label: 'Review & Submit' },
]

export default function ClaimForm() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [attachments, setAttachments] = useState([])

  const [formData, setFormData] = useState({
    orderId: '',
    type: '',
    items: [],
    description: '',
    amount: '',
  })

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const response = await ordersAPI.list({ limit: 100 })
      setOrders(response.data.orders || [])
    } catch (err) {
      console.error('Failed to fetch orders:', err)
      toast.error('Failed to load orders')
    } finally {
      setOrdersLoading(false)
    }
  }

  const selectedOrder = orders.find((o) => o.id === parseInt(formData.orderId))

  const handleSubmit = async () => {
    if (!formData.orderId || !formData.type || !formData.description) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const claimData = {
        orderId: parseInt(formData.orderId),
        type: formData.type,
        items: selectedOrder?.items || [],
        description: formData.description,
        claimAmount: formData.amount ? parseFloat(formData.amount) : undefined,
      }

      const response = await claimsAPI.create(claimData)
      const claimId = response.data.claim.id

      // Upload attachments
      if (attachments.length > 0) {
        for (const file of attachments) {
          try {
            await claimsAPI.uploadAttachment(claimId, file)
          } catch (err) {
            console.error('Failed to upload attachment:', err)
          }
        }
      }

      toast.success('Claim submitted successfully!')
      navigate(`/claims/${claimId}`)
    } catch (err) {
      console.error('Failed to submit claim:', err)
      toast.error(err.response?.data?.message || 'Failed to submit claim')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 1) {
    return (
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">File a Claim</h1>
          <p className="text-gray-600 mt-1">Step {step} of {STEPS.length}</p>
        </div>

        {/* Steps */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3 flex-shrink-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold whitespace-nowrap ${
                  s.id <= step
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s.id}
              </div>
              <span className="hidden sm:inline text-sm font-medium">
                {s.label}
              </span>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="text-gray-300 hidden lg:block" size={20} />
              )}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="card p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Select Order <span className="text-red-600">*</span>
            </label>
            {ordersLoading ? (
              <LoadingSpinner size="sm" text="Loading orders..." />
            ) : (
              <select
                value={formData.orderId}
                onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                className="input-base"
              >
                <option value="">Select an order...</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    ORD-{String(order.id).padStart(6, '0')} - {order.items?.length} items -
                    {order.status}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedOrder && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Order Details:</strong>
              </p>
              <p className="text-sm text-blue-800 mt-2">
                {selectedOrder.items?.length || 0} items • Status: {selectedOrder.status}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              onClick={() => navigate('/claims')}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!formData.orderId}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
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
          <h1 className="text-3xl font-bold text-gray-900">File a Claim</h1>
          <p className="text-gray-600 mt-1">Step {step} of {STEPS.length}</p>
        </div>

        {/* Steps */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3 flex-shrink-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold whitespace-nowrap ${
                  s.id <= step
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s.id}
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="card p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Claim Type <span className="text-red-600">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="input-base"
            >
              <option value="">Select claim type...</option>
              {CLAIM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Description <span className="text-red-600">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the issue in detail..."
              rows={6}
              className="input-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Claimed Amount (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">$</span>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="input-base pl-8"
              />
            </div>
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
              disabled={!formData.type || !formData.description}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 3) {
    return (
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">File a Claim</h1>
          <p className="text-gray-600 mt-1">Step {step} of {STEPS.length}</p>
        </div>

        {/* Form */}
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Upload Evidence
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Upload photos or documents that support your claim
            </p>
            <FileUpload
              onFilesSelected={setAttachments}
              maxSize={25}
              maxFiles={10}
              multiple
            />
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              onClick={() => setStep(2)}
              className="flex-1 btn-secondary"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
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
        <h1 className="text-3xl font-bold text-gray-900">File a Claim</h1>
        <p className="text-gray-600 mt-1">Step {step} of {STEPS.length}</p>
      </div>

      {/* Review */}
      <div className="card p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Review Your Claim</h2>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Order</p>
            <p className="font-semibold text-gray-900">
              ORD-{String(selectedOrder?.id).padStart(6, '0')}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Claim Type</p>
            <p className="font-semibold text-gray-900">{formData.type}</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Description</p>
            <p className="text-gray-900 mt-2">{formData.description}</p>
          </div>

          {formData.amount && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Claimed Amount</p>
              <p className="font-semibold text-gray-900">${formData.amount}</p>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Evidence</p>
              <p className="font-semibold text-gray-900">
                {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-6 border-t border-gray-200">
          <button
            onClick={() => setStep(3)}
            className="flex-1 btn-secondary"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 btn-primary disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Claim'}
          </button>
        </div>
      </div>
    </div>
  )
}
