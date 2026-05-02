/**
 * ApprovalPanel — internal manager approval widget for any record detail page.
 *
 * Usage:
 *   <ApprovalPanel entityType="Quotation" entityId={id} approvalType="send_quotation" />
 *
 * Props:
 *   entityType    — matches backend whitelist
 *   entityId      — record PK
 *   approvalType  — one of the InternalApproval.approvalType ENUM values
 *   onApproved    — optional callback called after manager approves
 *   className     — optional wrapper class
 */
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'

const PRIORITY_COLORS = {
  low:    'text-slate-500 bg-slate-100',
  normal: 'text-blue-600 bg-blue-50',
  high:   'text-amber-600 bg-amber-50',
  urgent: 'text-red-600 bg-red-50',
}

const STATUS_META = {
  pending:   { icon: Clock,        color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-200', label: 'Pending Review' },
  approved:  { icon: CheckCircle,  color: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-200', label: 'Approved' },
  rejected:  { icon: XCircle,      color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-200',   label: 'Rejected' },
  cancelled: { icon: AlertCircle,  color: 'text-slate-500', bg: 'bg-slate-50',  border: 'border-slate-200', label: 'Cancelled' },
}

function useCurrentUser() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user')
      if (raw) setUser(JSON.parse(raw))
    } catch {}
  }, [])
  return user
}

export default function ApprovalPanel({
  entityType,
  entityId,
  approvalType = 'general',
  onApproved,
  className = '',
}) {
  const [approvals, setApprovals]           = useState([])
  const [loading, setLoading]               = useState(true)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestNote, setRequestNote]       = useState('')
  const [rejectNote, setRejectNote]         = useState('')
  const [showRejectInput, setShowRejectInput] = useState(null)
  const [submitting, setSubmitting]         = useState(false)
  const [expanded, setExpanded]             = useState(true)
  const currentUser = useCurrentUser()

  const isManager = ['admin', 'manager'].includes(currentUser?.role)
  const pending = approvals.find(a => a.status === 'pending')
  const latest  = approvals[0]

  const load = useCallback(async () => {
    if (!entityType || !entityId) return
    try {
      const res = await api.get(`/internal-approvals/entity/${entityType}/${entityId}`)
      setApprovals(res.data?.data || res.data || [])
    } catch (err) {
      console.error('[ApprovalPanel] load', err)
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  const handleRequestApproval = async () => {
    setSubmitting(true)
    try {
      await api.post('/internal-approvals', {
        entityType, entityId, approvalType, requestNote: requestNote.trim() || undefined,
      })
      toast.success('Submitted for manager review')
      setShowRequestForm(false)
      setRequestNote('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit for approval')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (approvalId) => {
    setSubmitting(true)
    try {
      await api.post(`/internal-approvals/${approvalId}/approve`)
      toast.success('Approved')
      onApproved?.()
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async (approvalId) => {
    if (!rejectNote.trim()) {
      toast.error('A rejection note is required')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/internal-approvals/${approvalId}/reject`, { note: rejectNote.trim() })
      toast.success('Rejected')
      setShowRejectInput(null)
      setRejectNote('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (approvalId) => {
    try {
      await api.post(`/internal-approvals/${approvalId}/cancel`)
      toast.success('Approval request cancelled')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel')
    }
  }

  const latestMeta = latest ? STATUS_META[latest.status] : null

  return (
    <div className={`rounded-xl border ${latestMeta?.border || 'border-slate-200'} overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center justify-between px-4 py-3 ${latestMeta?.bg || 'bg-slate-50'}`}
      >
        <div className="flex items-center gap-2">
          <UserCheck className={`w-4 h-4 ${latestMeta?.color || 'text-slate-500'}`} />
          <span className={`text-sm font-semibold ${latestMeta?.color || 'text-slate-700'}`}>
            {latestMeta ? `${latestMeta.label}` : 'Internal Approval'}
          </span>
          {pending && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Action required
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="bg-white px-4 py-4 space-y-4">
          {loading ? (
            <div className="text-sm text-slate-400 text-center py-3">Loading...</div>
          ) : (
            <>
              {/* No approval requested yet */}
              {approvals.length === 0 && (
                <div className="text-center py-2">
                  <p className="text-sm text-slate-500 mb-3">No approval has been requested for this record.</p>
                  {!isManager && (
                    <button
                      onClick={() => setShowRequestForm(true)}
                      className="text-sm px-4 py-2 bg-forest-700 text-white rounded-lg hover:bg-forest-800 transition-colors"
                      style={{ backgroundColor: '#2D5A27' }}
                    >
                      Submit for Review
                    </button>
                  )}
                </div>
              )}

              {/* Pending approval — manager actions */}
              {pending && isManager && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800">
                      Requested by {pending.requester
                        ? `${pending.requester.firstName} ${pending.requester.lastName}`
                        : 'Unknown'}
                    </p>
                    {pending.requestNote && (
                      <p className="text-sm text-amber-700 mt-1">"{pending.requestNote}"</p>
                    )}
                  </div>

                  {showRejectInput === pending.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={rejectNote}
                        onChange={e => setRejectNote(e.target.value)}
                        placeholder="Rejection reason (required)…"
                        rows={3}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(pending.id)}
                          disabled={submitting}
                          className="flex-1 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirm Rejection
                        </button>
                        <button
                          onClick={() => { setShowRejectInput(null); setRejectNote('') }}
                          className="flex-1 py-2 border border-slate-200 text-sm rounded-lg hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(pending.id)}
                        disabled={submitting}
                        className="flex-1 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
                        style={{ backgroundColor: '#2D5A27' }}
                      >
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        Approve
                      </button>
                      <button
                        onClick={() => setShowRejectInput(pending.id)}
                        disabled={submitting}
                        className="flex-1 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4 inline mr-1" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Pending — requester sees status */}
              {pending && !isManager && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-amber-700">Awaiting manager review</span>
                  </div>
                  <button
                    onClick={() => handleCancel(pending.id)}
                    className="text-xs text-slate-500 hover:text-red-600 underline"
                  >
                    Recall
                  </button>
                </div>
              )}

              {/* Latest decision displayed */}
              {latest && latest.status !== 'pending' && (
                <div className={`rounded-lg border p-3 ${STATUS_META[latest.status]?.bg} ${STATUS_META[latest.status]?.border}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {(() => { const Icon = STATUS_META[latest.status]?.icon; return Icon ? <Icon className={`w-4 h-4 ${STATUS_META[latest.status]?.color}`} /> : null })()}
                    <span className={`text-sm font-semibold ${STATUS_META[latest.status]?.color}`}>
                      {STATUS_META[latest.status]?.label}
                    </span>
                    {latest.decidedBy && (
                      <span className="text-xs text-slate-500">
                        by {latest.decidedBy.firstName} {latest.decidedBy.lastName}
                      </span>
                    )}
                  </div>
                  {latest.decisionNote && (
                    <p className="text-sm text-slate-600 mt-1">"{latest.decisionNote}"</p>
                  )}
                </div>
              )}

              {/* Request form */}
              {showRequestForm && (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <textarea
                    value={requestNote}
                    onChange={e => setRequestNote(e.target.value)}
                    placeholder="Optional context for the reviewer…"
                    rows={3}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRequestApproval}
                      disabled={submitting}
                      className="flex-1 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                      style={{ backgroundColor: '#2D5A27' }}
                    >
                      Submit for Review
                    </button>
                    <button
                      onClick={() => setShowRequestForm(false)}
                      className="flex-1 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Re-submit after rejection */}
              {latest?.status === 'rejected' && !isManager && (
                <button
                  onClick={() => setShowRequ