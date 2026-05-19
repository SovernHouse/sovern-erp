// ─── PriceListDetail — Phase 4.28b ──────────────────────────────────────────
//
// Odoo 5-pillar detail page for a PriceList:
//   1. Breadcrumb header (useBreadcrumbs)
//   2. Smart-button strip (Items count, Pending approvals count)
//   3. Form view (name + dates + currency + parent client/supplier)
//   4. Items table tab (line-item read view; CRUD lives on the assistant
//      + the existing Manager page for now)
//   5. Chatter at bottom (entityType='PriceList' — added to whitelist in
//      Phase 4.28b backend)
//
// Top-bar action buttons:
//   - Edit (sends to the existing Manager modal flow)
//   - Export PDF (opens /api/personalization/price-lists/:id/pdf inline)
//   - Print (window.print() — uses the existing page styles)
//   - Send by Email (modal: pick lead/customer/free-form recipients)
//   - Request Approval (modal: pick assignee + optional due date / note)

import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit2, Download, Printer, Mail, UserCheck } from 'lucide-react'
import api from '../../services/api'
import { customersAPI, factoriesAPI } from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import Chatter from '../../components/Chatter'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function PriceListDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [priceList, setPriceList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState([])

  useBreadcrumbs(priceList?.name)

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/personalization/price-lists/${id}`)
      const pl = res.data?.data || res.data
      setPriceList(pl)
      // Fetch any pending approval activities for this PriceList.
      try {
        const aRes = await api.get('/scheduled-activities', {
          params: { entityType: 'PriceList', entityId: id, status: 'pending', limit: 10 },
        })
        setPendingApprovals(aRes.data?.data || aRes.data || [])
      } catch (_) { setPendingApprovals([]) }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load price list')
      navigate('/price-lists')
    } finally {
      setLoading(false)
    }
  }

  // Phase 4.28d follow-up: sort items by SKU asc so the on-screen order
  // matches the PDF (which orders by SKU on the include level). Otherwise
  // the row order differs between detail page (DB insertion order) and
  // PDF, leading to apparent "prices don't match" confusion.
  const items = useMemo(() => {
    const list = priceList?.items || []
    return [...list].sort((a, b) => String(a.sku || '').localeCompare(String(b.sku || '')))
  }, [priceList])
  const currency = priceList?.currencyCode || 'USD'

  if (loading) return <LoadingSpinner />
  if (!priceList) return null

  const handleExportPdf = () => {
    // The PDF endpoint streams inline; the auth token sits on the axios
    // instance but the browser needs to open the URL directly to view/
    // download. The route requires requireAuth, so we fetch as blob and
    // create a download trigger.
    api.get(`/personalization/price-lists/${id}/pdf`, { responseType: 'blob' })
      .then((res) => {
        const blob = new Blob([res.data], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
      })
      .catch((err) => toast.error(err.response?.data?.message || 'PDF export failed'))
  }

  const handlePrint = () => window.print()

  const parentLabel = priceList.Customer
    ? `Client: ${priceList.Customer.companyName}`
    : priceList.Factory
      ? `Supplier: ${priceList.Factory.companyName}`
      : 'Template (no parent)'

  const smartButtons = [
    { key: 'items',      label: 'Items',             count: items.length },
    { key: 'approvals',  label: 'Pending Approvals', count: pendingApprovals.length },
  ]

  const tabs = [
    { id: 'overview',  label: 'Overview' },
    { id: 'items',     label: `Items${items.length ? ` (${items.length})` : ''}` },
    { id: 'approvals', label: `Approvals${pendingApprovals.length ? ` (${pendingApprovals.length})` : ''}` },
    { id: 'chatter',   label: 'Chatter' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/price-lists')}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{priceList.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">{parentLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/price-lists?edit=${id}`)}
            className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1"
          >
            <Edit2 className="w-4 h-4" /> Edit
          </button>
          <button
            onClick={handleExportPdf}
            className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center gap-1"
          >
            <Mail className="w-4 h-4" /> Email
          </button>
          <button
            onClick={() => setShowApprovalModal(true)}
            className="px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-1"
          >
            <UserCheck className="w-4 h-4" /> Request Approval
          </button>
        </div>
      </div>

      {/* Smart-button strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 print:hidden">
        {smartButtons.map((sb) => (
          <button
            key={sb.key}
            onClick={() => setActiveTab(sb.key === 'items' ? 'items' : 'approvals')}
            className={`text-left px-4 py-3 rounded-lg shadow border transition-colors ${
              activeTab === sb.key || (sb.key === 'approvals' && activeTab === 'approvals')
                ? 'bg-primary-50 border-primary-200'
                : 'bg-white border-transparent hover:bg-slate-50'
            }`}
          >
            <p className="text-xs text-slate-500 font-medium">{sb.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{sb.count}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-slate-200 px-4 overflow-x-auto print:hidden">
          <nav className="flex gap-1" aria-label="Price list tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === t.id
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {(activeTab === 'overview' || activeTab === 'items' || activeTab === 'approvals') && (
            <>
              {activeTab === 'overview' && (
                <OverviewTab pl={priceList} parentLabel={parentLabel} />
              )}
              {activeTab === 'items' && (
                <ItemsTab items={items} currency={currency} />
              )}
              {activeTab === 'approvals' && (
                <ApprovalsTab approvals={pendingApprovals} onChanged={fetchAll} />
              )}
            </>
          )}
          {activeTab === 'chatter' && (
            <Chatter entityType="PriceList" entityId={id} />
          )}
        </div>
      </div>

      {showEmailModal && (
        <EmailModal
          priceList={priceList}
          onClose={() => setShowEmailModal(false)}
          onSent={() => { setShowEmailModal(false); toast.success('Email sent') }}
        />
      )}
      {showApprovalModal && (
        <ApprovalModal
          priceList={priceList}
          onClose={() => setShowApprovalModal(false)}
          onCreated={() => { setShowApprovalModal(false); fetchAll() }}
        />
      )}
    </div>
  )
}

// ── Tab components ──────────────────────────────────────────────────────────

function OverviewTab({ pl, parentLabel }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <InfoRow label="Status" value={pl.isActive ? 'Active' : 'Inactive'} />
      <InfoRow label="Currency" value={pl.currencyCode || 'USD'} />
      <InfoRow label="Valid From" value={pl.validFrom ? formatDate(pl.validFrom) : '—'} />
      <InfoRow label="Valid To" value={pl.validTo ? formatDate(pl.validTo) : '—'} />
      <InfoRow label="Parent" value={parentLabel} />
      <InfoRow label="Created" value={pl.createdAt ? formatDate(pl.createdAt) : '—'} />
      {pl.description && (
        <div className="col-span-2 md:col-span-4">
          <p className="text-xs text-slate-500 mb-1">Description</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{pl.description}</p>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value || '—'}</p>
    </div>
  )
}

function ItemsTab({ items, currency }) {
  if (!items.length) {
    return <p className="text-sm text-slate-400 py-6">No items in this price list yet.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-slate-700">SKU</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-700">Product</th>
            <th className="px-3 py-2 text-center font-semibold text-slate-700">Unit</th>
            <th className="px-3 py-2 text-right font-semibold text-slate-700">MOQ</th>
            <th className="px-3 py-2 text-right font-semibold text-slate-700">Lead (d)</th>
            <th className="px-3 py-2 text-right font-semibold text-slate-700">FOB</th>
            <th className="px-3 py-2 text-right font-semibold text-slate-700">Selling</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-slate-100">
              <td className="px-3 py-2 font-mono text-xs">{it.sku || '—'}</td>
              <td className="px-3 py-2">{it.productName || it.Product?.name || '—'}</td>
              <td className="px-3 py-2 text-center text-slate-600">{it.unit || 'sqm'}</td>
              <td className="px-3 py-2 text-right">{it.minimumOrder ?? '—'}</td>
              <td className="px-3 py-2 text-right">{it.leadTimeDays ?? '—'}</td>
              <td className="px-3 py-2 text-right text-slate-600">
                {it.costPrice ? formatCurrency(it.costPrice, currency) : '—'}
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {it.sellingPrice ? formatCurrency(it.sellingPrice, currency) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ApprovalsTab({ approvals, onChanged }) {
  if (!approvals.length) {
    return <p className="text-sm text-slate-400 py-6">No pending approval requests.</p>
  }
  return (
    <div className="space-y-2">
      {approvals.map((a) => (
        <div key={a.id} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">{a.entityLabel || a.note}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Assigned: {a.assignedTo?.firstName} {a.assignedTo?.lastName} · Due {a.dueDate ? formatDate(a.dueDate) : '—'}
            </p>
          </div>
          <StatusBadge status={a.status} />
        </div>
      ))}
    </div>
  )
}

// ── Modals ─────────────────────────────────────────────────────────────────

function EmailModal({ priceList, onClose, onSent }) {
  const [recipients, setRecipients] = useState('')
  const [subject, setSubject] = useState(`Price List · ${priceList.name}`)
  const [message, setMessage] = useState('')
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    customersAPI.getAll({ limit: 200 }).then((r) => setCustomers(r.data || [])).catch(() => {})
  }, [])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!recipients.trim() && !customerId) {
      toast.error('Provide at least one recipient (email or client).')
      return
    }
    setSending(true)
    try {
      await api.post(`/personalization/price-lists/${priceList.id}/send-email`, {
        to: recipients.trim() ? recipients.split(',').map((x) => x.trim()).filter(Boolean) : undefined,
        customerId: customerId || undefined,
        subject,
        message,
      })
      onSent && onSent()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-lg">
        <form onSubmit={handleSend} className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Email this price list</h3>
            <p className="text-xs text-slate-500 mt-1">Generates a PDF attachment and sends via the configured SMTP / email service. Audit-logged.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pick a client (optional)</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
            >
              <option value="">— None —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.companyName} · {c.email || 'no email'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Or enter recipient emails (comma-separated)</label>
            <input
              type="text"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="buyer@example.com, alt@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message (HTML allowed)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="(Optional — default copy explains it's the attached PDF.)"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={sending} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40">
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ApprovalModal({ priceList, onClose, onCreated }) {
  const [users, setUsers] = useState([])
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState(() => {
    const t = new Date(); t.setDate(t.getDate() + 1)
    return t.toISOString().slice(0, 10)
  })
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/users', { params: { isActive: true, limit: 100 } })
      .then((r) => setUsers(r.data?.data || r.data || []))
      .catch(() => setUsers([]))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!assigneeId) { toast.error('Pick an assignee'); return }
    setSaving(true)
    try {
      await api.post(`/personalization/price-lists/${priceList.id}/request-approval`, {
        assigneeId, dueDate, note,
      })
      toast.success('Approval request created')
      onCreated && onCreated()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Request approval</h3>
            <p className="text-xs text-slate-500 mt-1">Creates a ScheduledActivity (type=approve, entityType=PriceList) on the assignee's pending list.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assignee *</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
            >
              <option value="">— Pick user —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="(Optional context for the approver.)"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving || !assigneeId} className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40">
              {saving ? 'Creating…' : 'Send request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
