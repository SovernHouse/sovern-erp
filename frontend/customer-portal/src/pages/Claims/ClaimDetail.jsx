import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageSquare, FileIcon } from 'lucide-react'
import { claimsAPI } from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import StatusBadge from '../../components/StatusBadge'
import { formatDate, formatCurrency } from '../../utils/formatters'
import toast from 'react-hot-toast'

export default function ClaimDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [claim, setClaim] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [commenting, setCommenting] = useState(false)

  useEffect(() => {
    fetchClaim()
  }, [id])

  const fetchClaim = async () => {
    setLoading(true)
    try {
      const response = await claimsAPI.getById(id)
      setClaim(response.data.claim)
    } catch (err) {
      console.error('Failed to fetch claim:', err)
      toast.error('Failed to load claim')
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment')
      return
    }

    setCommenting(true)
    try {
      await claimsAPI.addComment(id, newComment)
      setNewComment('')
      toast.success('Comment added')
      fetchClaim()
    } catch (err) {
      console.error('Failed to add comment:', err)
      toast.error('Failed to add comment')
    } finally {
      setCommenting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner text="Loading claim..." />
      </div>
    )
  }

  if (!claim) {
    return (
      <EmptyState
        title="Claim not found"
        message="The claim you're looking for doesn't exist."
        actionText="Back to Claims"
        action={() => navigate('/claims')}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/claims')}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <ArrowLeft size={20} />
          Back to Claims
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Claim Header */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm text-gray-500">Claim Number</p>
                <h1 className="text-2xl font-bold text-gray-900">
                  CLM-{String(claim.id).padStart(6, '0')}
                </h1>
              </div>
              <StatusBadge status={claim.status} type="claim" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-600">Date Filed</p>
                <p className="font-semibold text-gray-900">{formatDate(claim.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="font-semibold text-gray-900">{claim.type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Priority</p>
                <span
                  className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${
                    claim.priority === 'CRITICAL'
                      ? 'bg-red-100 text-red-800'
                      : claim.priority === 'HIGH'
                      ? 'bg-orange-100 text-orange-800'
                      : claim.priority === 'MEDIUM'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {claim.priority}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Related Order</p>
                <p className="font-semibold text-gray-900">
                  ORD-{String(claim.orderId).padStart(6, '0')}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Claim Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{claim.description}</p>
          </div>

          {/* Claimed Amount */}
          {claim.claimAmount && (
            <div className="card p-6 bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-600">Claimed Amount</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">
                {formatCurrency(claim.claimAmount)}
              </p>
            </div>
          )}

          {/* Attachments */}
          {claim.attachments && claim.attachments.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Evidence & Attachments
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {claim.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <FileIcon size={20} className="text-primary-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {formatDate(attachment.createdAt)}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Updates Timeline */}
          {claim.updates && claim.updates.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Updates</h2>
              <div className="space-y-4">
                {claim.updates.map((update, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100">
                        <div className="w-3 h-3 bg-primary-600 rounded-full"></div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{update.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{update.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {formatDate(update.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare size={20} />
              Comments & Notes
            </h2>

            {/* Add Comment */}
            {!['RESOLVED', 'REJECTED'].includes(claim.status) && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                  className="input-base"
                />
                <button
                  onClick={handleAddComment}
                  disabled={commenting}
                  className="mt-3 btn-primary disabled:opacity-50"
                >
                  {commenting ? 'Adding...' : 'Add Comment'}
                </button>
              </div>
            )}

            {/* Comments List */}
            {claim.comments && claim.comments.length > 0 ? (
              <div className="space-y-4">
                {claim.comments.map((comment) => (
                  <div key={comment.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-gray-900">
                        {comment.authorName || 'Support Team'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(comment.createdAt)}
                      </p>
                    </div>
                    <p className="text-gray-700">{comment.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No comments yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Current Status</h3>
            <StatusBadge status={claim.status} type="claim" className="mb-4" />
            {claim.status === 'UNDER_INVESTIGATION' && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  Our team is investigating your claim. You'll be notified of any updates.
                </p>
              </div>
            )}
            {claim.status === 'RESOLVED' && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">
                  {claim.resolution}
                </p>
              </div>
            )}
            {claim.status === 'REJECTED' && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  {claim.rejectionReason}
                </p>
              </div>
            )}
          </div>

          {/* Resolution Card */}
          {claim.status === 'RESOLVED' && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Resolution</h3>
              <div className="space-y-3">
                {claim.compensationAmount && (
                  <div>
                    <p className="text-sm text-gray-600">Compensation Offered</p>
                    <p className="text-2xl font-bold text-accent-600">
                      {formatCurrency(claim.compensationAmount)}
                    </p>
                  </div>
                )}
                {claim.resolutionDate && (
                  <div>
                    <p className="text-sm text-gray-600">Resolution Date</p>
                    <p className="font-semibold text-gray-900">
                      {formatDate(claim.resolutionDate)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Info */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Related Order</h3>
            <div className="text-sm space-y-2">
              <p className="text-gray-600">
                Order: <span className="font-semibold text-gray-900">
                  ORD-{String(claim.orderId).padStart(6, '0')}
                </span>
              </p>
              {claim.orderedDate && (
                <p className="text-gray-600">
                  Date: <span className="font-semibold text-gray-900">
                    {formatDate(claim.orderedDate)}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
