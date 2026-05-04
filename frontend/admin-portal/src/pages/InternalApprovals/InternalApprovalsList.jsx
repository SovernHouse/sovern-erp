// ─── Internal Approvals (desktop) ────────────────────────────────────────
// Manager-side queue of pending Quotations / PIs / Sales Orders / POs that
// coordinators have submitted for sign-off. Mirrors the mobile Approvals tab.
// Hits /api/internal-approvals (NOT /api/approvals — that's the client-facing
// e-signature flow with the public /approve/:token URL).

import { useEffect, useState } from 'react'
import { Check, X, FileText, Clock } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'

const ENTITY_META = {
  Quotation:       { label: 'Quotation',        icon: '📄' },
  ProformaInvoice: { label: 'Proforma Invoice',  icon: '🧾' },
  SalesOrder:      { label: 'Sales Order',       icon: '📋' },
  PurchaseOrder:   { label: 'Purchase Order',    icon: '🏭' },
  PackingList:     { label: 'Packing List',      icon: '📦' },
}
const DEFAULT_META = { label: 'Document', icon: '📄' }

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function requesterName(req) {
  if (!req) return 'Unknown'
  return `${req.firstName ?? ''} ${req.lastName ?? ''}`.trim() || req.email || 'User'
}

export default function InternalApprovalsList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  async function load() {
    try {
      setLoading(true)
      const res = await api.get('/internal-approvals?status=pending')
      // api.js auto-unwraps {success,data} so res.data is the array directly
      setItems(Array.isArray(res.data) ? res.data : (res.data?.data || []))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleApprove(id) {
    if (!window.confirm('Approve this document? The coordinator will be notified.')) return
    setBusyId(id)
    try {
      await api.post(`/internal-approvals/${id}/approve`, {})
      setItems((prev) => prev.filter((i) => i.id !== id))
      toast.success('Approved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approve failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRejectSubmit() {
    if (!rejectNote.trim()) {
      toast.error('Add a note explaining why this is rejected.')
      return
    }
    setBusyId(rejectingId)
    try {
      await api.post(`/internal-approvals/${rejectingId}/reject`, { note: rejectNote.trim() })
      setItems((prev) => prev.filter((i) => i.id !== rejectingId))
      setRejectingId(null)
      setRejectNote('')
      toast.success('Rejected — sent back for revision')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reject failed')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Internal Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pending sign-offs on Quotations, PIs, Sales Orders, POs raised by coordinators.
          </p>
        </div>
        {items.length > 0 ? (
          <div className="text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {items.length} awaiting decision
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">All clear</h2>
          <p className="text-sm text-slate-500 mt-1">No pending approvals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const meta = ENTITY_META[item.entityType] ?? DEFAULT_META
            const isBusy = busyId === item.id
            return (
              <div key={item.id} className="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="text-3xl flex-shrink-0">{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {meta.label} #{item.entityId}
                      </h3>
                      {item.approvalType ? (
                        <span className="text-xs uppercase tracking-wider text-slate-500 bg-slate-100 rounded px-2 py-0.5">
                          {item.approvalType.replace(/_/g, ' ')}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Submitted by <span className="font-medium text-slate-700">{requesterName(item.requester)}</span>
                    </p>
                    {item.requestNote ? (
                      <div className="mt-3 bg-slate-50 border-l-4 border-green-700 rounded px-3 py-2 text-sm italic text-slate-700">
                        "{item.requestNote}"
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-3">
                      <Clock className="w-3 h-3" />
                      <span>Received {fmtDate(item.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(item.id)}
                      disabled={isBusy}
                      className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => { setRejectingId(item.id); setRejectNote('') }}
                      disabled={isBusy}
                      className="px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-100 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {rejectingId ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setRejectingId(null)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Reject & send back</h2>
            <p className="text-sm text-slate-500 mb-4">
              Describe what needs to change before resubmission:
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={4}
              autoFocus
              className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="e.g. Unit price does not match agreed rate..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setRejectingId(null); setRejectNote('') }}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={busyId === rejectingId || !rejectNote.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {busyId === rejectingId ? 'Sending…' : 'Send rejection'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
