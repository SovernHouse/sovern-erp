import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { samplesAPI } from '../../services/api'

const SampleRequestDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sample, setSample] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [feedback, setFeedback] = useState({
    rating: 5,
    comments: '',
  })

  useEffect(() => {
    fetchSampleDetail()
  }, [id])

  const fetchSampleDetail = async () => {
    try {
      setLoading(true)
      const response = await samplesAPI.getById(id)
      setSample(response.data)
    } catch (err) {
      console.error('Error fetching sample:', err)
      toast.error('Failed to load sample request')
      navigate('/samples')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitFeedback = async (e) => {
    e.preventDefault()

    if (!feedback.comments.trim()) {
      toast.error('Please provide feedback comments')
      return
    }

    try {
      setSubmittingFeedback(true)
      await samplesAPI.provideFeedback(id, feedback)
      toast.success('Feedback submitted successfully')
      setShowFeedbackForm(false)
      fetchSampleDetail()
    } catch (err) {
      console.error('Error submitting feedback:', err)
      toast.error(err.response?.data?.message || 'Failed to submit feedback')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const handleApproveFeedback = async () => {
    try {
      setSubmittingFeedback(true)
      await samplesAPI.approveFeedback(id)
      toast.success('Sample approved for order')
      fetchSampleDetail()
    } catch (err) {
      console.error('Error approving sample:', err)
      toast.error(err.response?.data?.message || 'Failed to approve sample')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusBadge = (status) => {
    const labels = {
      pending: 'Pending Approval',
      approved: 'Approved',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    }
    return labels[status] || status
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
            <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600">Loading sample request...</p>
        </div>
      </div>
    )
  }

  if (!sample) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Sample request not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{sample.requestNumber || `SR-${sample.id}`}</h1>
            <p className="text-gray-600 mt-2">View sample request details and provide feedback</p>
          </div>
          <button
            onClick={() => navigate('/samples')}
            className="text-blue-600 hover:text-blue-800 font-semibold"
          >
            Back to List
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Request Status</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{getStatusBadge(sample.status)}</p>
                </div>
                <span className={`px-4 py-2 rounded-full font-semibold ${getStatusColor(sample.status)}`}>
                  {getStatusBadge(sample.status)}
                </span>
              </div>
            </div>

            {/* Products Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Products Requested</h2>
              <div className="space-y-3">
                {sample.items && sample.items.length > 0 ? (
                  sample.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{item.productName || item.name}</p>
                        <p className="text-sm text-gray-600">Product ID: {item.productId}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">Qty: {item.quantity}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600">No products in this request</p>
                )}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h2>
              {sample.shippingAddress ? (
                <div className="text-gray-700 space-y-1">
                  <p className="font-medium">{sample.shippingAddress.recipientName}</p>
                  <p>{sample.shippingAddress.street}</p>
                  <p>
                    {sample.shippingAddress.city}, {sample.shippingAddress.state} {sample.shippingAddress.postalCode}
                  </p>
                  <p>{sample.shippingAddress.country}</p>
                  {sample.shippingAddress.phone && <p className="text-sm text-gray-600">Tel: {sample.shippingAddress.phone}</p>}
                </div>
              ) : (
                <p className="text-gray-600">No shipping address provided</p>
              )}
            </div>

            {/* Shipment Tracking */}
            {sample.status !== 'pending' && sample.shipmentTracking && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipment Tracking</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Tracking Number</p>
                    <p className="font-semibold text-gray-900">{sample.shipmentTracking.trackingNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Carrier</p>
                    <p className="font-semibold text-gray-900">{sample.shipmentTracking.carrier}</p>
                  </div>
                  {sample.shipmentTracking.estimatedDelivery && (
                    <div>
                      <p className="text-sm text-gray-600">Estimated Delivery</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(sample.shipmentTracking.estimatedDelivery).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Feedback Section */}
            {sample.status === 'delivered' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Sample Feedback</h2>

                {sample.feedbackProvided ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Your Rating</p>
                      <div className="flex gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span
                            key={i}
                            className={`text-2xl ${i <= sample.feedback?.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Your Feedback</p>
                      <p className="text-gray-900 mt-2 p-3 bg-gray-50 rounded-lg">{sample.feedback?.comments}</p>
                    </div>
                    {!sample.approvedForOrder && (
                      <button
                        onClick={handleApproveFeedback}
                        disabled={submittingFeedback}
                        className="w-full px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
                      >
                        {submittingFeedback ? 'Processing...' : 'Approve for Order'}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {!showFeedbackForm ? (
                      <button
                        onClick={() => setShowFeedbackForm(true)}
                        className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                      >
                        Provide Feedback
                      </button>
                    ) : (
                      <form onSubmit={handleSubmitFeedback} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">Rating</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setFeedback((prev) => ({ ...prev, rating: i }))}
                                className={`text-4xl transition ${
                                  i <= feedback.rating ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-200'
                                }`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Comments</label>
                          <textarea
                            value={feedback.comments}
                            onChange={(e) => setFeedback((prev) => ({ ...prev, comments: e.target.value }))}
                            placeholder="Share your thoughts about the sample quality, packaging, and overall satisfaction..."
                            rows="4"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => setShowFeedbackForm(false)}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-semibold transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submittingFeedback}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
                          >
                            {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sidebar - Timeline and Details */}
          <div className="space-y-6">
            {/* Key Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Request Date</p>
                  <p className="font-semibold text-gray-900">
                    {sample.createdAt ? new Date(sample.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Feedback Status</p>
                  <p className="font-semibold text-gray-900">
                    {sample.status === 'delivered' ? (
                      sample.feedbackProvided ? (
                        <span className="text-green-600">Submitted</span>
                      ) : (
                        <span className="text-orange-600">Pending</span>
                      )
                    ) : (
                      'N/A'
                    )}
                  </p>
                </div>
                {sample.notes && (
                  <div>
                    <p className="text-sm text-gray-600">Special Instructions</p>
                    <p className="text-gray-900 text-sm mt-1">{sample.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
              <div className="space-y-4">
                {[
                  { label: 'Requested', date: sample.createdAt, done: true },
                  { label: 'Approved', date: sample.approvedDate, done: sample.status !== 'pending' },
                  { label: 'Shipped', date: sample.shippedDate, done: ['shipped', 'delivered'].includes(sample.status) },
                  { label: 'Delivered', date: sample.deliveredDate, done: sample.status === 'delivered' },
                ].map((step, index) => (
                  <div key={index} className="flex gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step.done ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {step.done ? '✓' : index + 1}
                    </div>
                    <div className="pt-1">
                      <p className="font-medium text-gray-900">{step.label}</p>
                      {step.date && <p className="text-sm text-gray-600">{new Date(step.date).toLocaleDateString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SampleRequestDetail
