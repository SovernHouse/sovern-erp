/**
 * Expenses — admin list page.
 *
 * Shows all expense rows with status / paid / office filters. Drawer for
 * create + edit. "Generate report" button triggers the office picker → bundle
 * draft expenses into an ExpenseSubmission and produce the XLSX in Drive.
 *
 * Power-user flows (quick-log, list filters, generate report) are also
 * available via the /expense, /expenses, /expense-report slash commands in
 * the AI Assistant — those don't require this UI to be open.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { expensesAPI, customersAPI, aiAPI } from '../../services/api'
import toast from 'react-hot-toast'
import {
  Loader2, Plus, X, FileText, Filter, Receipt, Download, Trash2, Pencil, Check,
  AlertCircle, Camera, Sparkles,
} from 'lucide-react'

const STATUS_FILTERS = [
  { value: '',              label: 'All statuses' },
  { value: 'draft',         label: 'Draft' },
  { value: 'submitted',     label: 'Submitted' },
  { value: 'paid',          label: 'Paid' },
  { value: 'rejected',      label: 'Rejected' },
  { value: 'not_claimable', label: 'Not claimable' },
]

const PAID_FILTERS = [
  { value: '',      label: 'Any' },
  { value: 'false', label: 'Unpaid only' },
  { value: 'true',  label: 'Paid only' },
]

const CATEGORIES = [
  'Travel', 'Hotel', 'Meal allowance', 'Flight', 'Taxi', 'Visa',
  'Office', 'Bonus', 'Salary', 'Rent', 'Ticket', 'Labour cost', 'Other',
]

const COMMON_CURRENCIES = ['USD', 'TWD', 'CNY', 'RMB', 'THB', 'VND', 'CAD', 'HKD', 'EUR', 'GBP']

const EXPORT_TEMPLATES = [
  { value: '',                    label: '— pick one —' },
  { value: 'expense_to_alex_v2',  label: 'Expense to Alex (multi-currency, single sheet)' },
  { value: 'inspector_travel_v2', label: 'Inspector travel (per-inspector tabs)' },
  { value: 'custom_csv',          label: 'Plain CSV (catch-all)' },
]

function statusColor(s) {
  switch (s) {
    case 'draft':         return { bg: '#f1f5f9', fg: '#475569' }
    case 'submitted':     return { bg: '#eff6ff', fg: '#1d4ed8' }
    case 'paid':          return { bg: '#ecfdf5', fg: '#059669' }
    case 'rejected':      return { bg: '#fee2e2', fg: '#dc2626' }
    case 'not_claimable': return { bg: '#fef3c7', fg: '#92400e' }
    default:              return { bg: '#f1f5f9', fg: '#475569' }
  }
}

function relTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([])
  const [offices, setOffices] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [paidFilter, setPaidFilter] = useState('false')
  const [officeFilter, setOfficeFilter] = useState('')
  const [drawerExpense, setDrawerExpense] = useState(null) // null = closed; {} = new; {id} = edit
  const [reportOfficeOpen, setReportOfficeOpen] = useState(false)
  const [officesModalOpen, setOfficesModalOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const scanInputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [eRes, oRes, cRes] = await Promise.all([
        expensesAPI.list({
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(paidFilter ? { paid: paidFilter } : {}),
          ...(officeFilter ? { officeId: officeFilter } : {}),
          limit: 200,
        }),
        expensesAPI.listOffices(),
        customersAPI.getAll({ limit: 500 }),
      ])
      // api.js interceptor auto-unwraps {success,data} envelopes, so the
      // payload could land at res.data OR res.data.data. Tolerate both.
      setExpenses(eRes.data?.data || eRes.data || [])
      setOffices(oRes.data?.data || oRes.data || [])
      setCustomers(cRes.data?.data || cRes.data?.items || cRes.data || [])
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not load expenses')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, paidFilter, officeFilter])

  useEffect(() => { load() }, [load])

  const customerById = useMemo(() => {
    const m = new Map()
    for (const c of customers) m.set(c.id, c)
    return m
  }, [customers])
  const officeById = useMemo(() => {
    const m = new Map()
    for (const o of offices) m.set(o.id, o)
    return m
  }, [offices])

  // Per-currency totals (matches the source sheet shape).
  const totalsByCurrency = useMemo(() => {
    const t = {}
    for (const e of expenses) {
      const c = e.originalCurrency || 'USD'
      t[c] = (t[c] || 0) + Number(e.originalAmount || 0)
    }
    return t
  }, [expenses])

  async function handleDelete(id) {
    if (!window.confirm('Delete this expense? Submitted/paid rows cannot be deleted.')) return
    try {
      await expensesAPI.remove(id)
      toast.success('Deleted')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not delete')
    }
  }

  // Scan a receipt photo / PDF → upload to Drive → AI extracts fields →
  // open the drawer pre-filled. Same flow whether triggered from the page
  // header or the drawer's "Scan & Fill" button — both feed the file into
  // this handler, which sets `drawerExpense` with the extracted shape.
  async function handleScanReceipt(file) {
    if (!file) return
    setScanning(true)
    const toastId = toast.loading('Uploading receipt to Drive…')
    try {
      const up = await aiAPI.uploadAttachment(file)
      // Tolerate envelope-unwrapped (res.data is the row) vs raw (res.data.data).
      const upBody = up.data?.data ?? up.data ?? {}
      const driveFileId = upBody.driveFileId
      if (!driveFileId) throw new Error('Upload returned no driveFileId')

      toast.loading('Reading receipt with AI…', { id: toastId })
      const ex = await expensesAPI.extractFromReceipt(driveFileId)
      const fields = ex.data?.data || ex.data || {}

      const draft = {
        entryDate:          fields.entryDate          || new Date().toISOString().slice(0, 10),
        category:           fields.suggestedCategory  || 'Other',
        description:        fields.suggestedDescription || (fields.vendor ? `${fields.vendor}${fields.country ? ` (${fields.country})` : ''}` : ''),
        originalCurrency:   fields.originalCurrency   || 'USD',
        originalAmount:     fields.originalAmount     != null ? fields.originalAmount : '',
        notes:              fields.notes              || '',
        receiptDriveFileIds:         fields.receiptDriveFileIds || [driveFileId],
        aiExtractedFromDriveFileId:  fields.aiExtractedFromDriveFileId || driveFileId,
        aiExtractionConfidence:      fields.aiExtractionConfidence != null ? fields.aiExtractionConfidence : (fields.confidence ?? null),
        _receiptWebViewLink:         upBody.webViewLink || null,
      }

      setDrawerExpense(draft)
      toast.success(
        fields.aiExtractionConfidence != null || fields.confidence != null
          ? `Extracted (confidence ${Math.round(((fields.aiExtractionConfidence ?? fields.confidence) * 100))}%)`
          : 'Extracted — review before saving',
        { id: toastId },
      )
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Receipt scan failed', { id: toastId })
    } finally {
      setScanning(false)
      if (scanInputRef.current) scanInputRef.current.value = '' // allow re-picking same file
    }
  }

  async function handleGenerateReport(officeId) {
    setReportOfficeOpen(false)
    try {
      toast.loading('Bundling expenses + generating report…', { id: 'gen' })
      const subRes = await expensesAPI.createSubmission({ officeId })
      const sub = subRes.data?.data ?? subRes.data
      const repRes = await expensesAPI.generateReport(sub.id)
      const repBody = repRes.data?.data ?? repRes.data ?? {}
      const file = repBody.driveFile
      toast.success('Report ready in Drive', { id: 'gen' })
      if (file?.webViewLink) window.open(file.webViewLink, '_blank', 'noopener')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not generate', { id: 'gen' })
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Expenses</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
            Multi-currency expense tracking with per-client P&amp;L attribution. Slash commands{' '}
            <code>/expense</code>, <code>/expenses</code>, <code>/expense-report</code> in the AI Assistant give you the same flows.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setOfficesModalOpen(true)} style={btnGhost}>
            <Filter size={14} /> Offices
          </button>
          <button onClick={() => setReportOfficeOpen(true)} style={btnGhost}>
            <Download size={14} /> Generate report
          </button>
          <button
            onClick={() => scanInputRef.current?.click()}
            disabled={scanning}
            style={btnGhost}
            title="Upload a receipt photo or PDF; AI fills the form"
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}{' '}
            Scan receipt
          </button>
          <button onClick={() => setDrawerExpense({})} style={btnPrimary}>
            <Plus size={14} /> New expense
          </button>
        </div>
        <input
          ref={scanInputRef}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleScanReceipt(f)
          }}
        />
      </header>

      {/* Filters + totals strip */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap',
        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px',
      }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
          {STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={paidFilter} onChange={e => setPaidFilter(e.target.value)} style={selectStyle}>
          {PAID_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={officeFilter} onChange={e => setOfficeFilter(e.target.value)} style={selectStyle}>
          <option value="">All offices</option>
          {offices.map(o => <option key={o.id} value={o.id}>{o.code} — {o.displayName}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 14, fontSize: 13, color: '#475569', flexWrap: 'wrap' }}>
          <span><strong>{expenses.length}</strong> rows</span>
          {Object.entries(totalsByCurrency).map(([c, v]) => (
            <span key={c}><strong>{c}</strong> {Math.round(v * 100) / 100}</span>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Loader2 className="animate-spin" /></div>
      ) : expenses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          No expenses match these filters. Try widening or click <strong>+ New expense</strong>.
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Description</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>USD</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Office</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => {
                const sc = statusColor(e.submissionStatus)
                const cust = e.customerId ? customerById.get(e.customerId) : null
                const off  = e.submittingOfficeId ? officeById.get(e.submittingOfficeId) : null
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={tdStyle}>{relTime(e.entryDate)}</td>
                    <td style={tdStyle}>{e.category}</td>
                    <td style={{ ...tdStyle, maxWidth: 320 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || '—'}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{e.originalCurrency}</strong> {Number(e.originalAmount).toLocaleString()}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>
                      {e.usdAmount != null ? Number(e.usdAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </td>
                    <td style={tdStyle}>{cust?.companyName || '—'}</td>
                    <td style={tdStyle}>{off?.code || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        background: sc.bg, color: sc.fg,
                        padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                      }}>{e.submissionStatus}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => setDrawerExpense(e)} style={iconBtn} title="Edit"><Pencil size={14} /></button>
                      {(e.submissionStatus === 'draft' || e.submissionStatus === 'rejected' || e.submissionStatus === 'not_claimable') && (
                        <button onClick={() => handleDelete(e.id)} style={iconBtn} title="Delete"><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {drawerExpense && (
        <ExpenseDrawer
          expense={drawerExpense}
          customers={customers}
          offices={offices}
          onClose={() => setDrawerExpense(null)}
          onSaved={() => { setDrawerExpense(null); load() }}
        />
      )}

      {reportOfficeOpen && (
        <PickerModal
          title="Generate report — pick an office"
          subtitle="Bundles all draft expenses currently routed to this office, generates the XLSX, uploads to Drive."
          options={offices.filter(o => o.isActive).map(o => ({
            value: o.id,
            label: `${o.code} — ${o.displayName}`,
            disabled: !o.exportTemplateKey,
            badge: o.exportTemplateKey ? null : 'no template set — edit office first',
          }))}
          onClose={() => setReportOfficeOpen(false)}
          onPick={handleGenerateReport}
        />
      )}

      {officesModalOpen && (
        <OfficesModal
          offices={offices}
          onClose={() => setOfficesModalOpen(false)}
          onChanged={() => load()}
        />
      )}
    </div>
  )
}

// ── Drawer: create or edit one expense ──────────────────────────────────────

function ExpenseDrawer({ expense, customers, offices, onClose, onSaved }) {
  const isEdit = !!expense.id
  const [form, setForm] = useState({
    entryDate:          expense.entryDate          || new Date().toISOString().slice(0, 10),
    category:           expense.category           || 'Travel',
    description:        expense.description        || '',
    originalCurrency:   expense.originalCurrency   || 'USD',
    originalAmount:     expense.originalAmount     ?? '',
    customerId:         expense.customerId         || '',
    submittingOfficeId: expense.submittingOfficeId || '',
    paidAt:             expense.paidAt             || '',
    submissionStatus:   expense.submissionStatus   || 'draft',
    notes:              expense.notes              || '',
    // AI provenance — carried into payload on save so the audit trail sticks.
    receiptDriveFileIds:         Array.isArray(expense.receiptDriveFileIds) ? expense.receiptDriveFileIds : [],
    aiExtractedFromDriveFileId:  expense.aiExtractedFromDriveFileId || null,
    aiExtractionConfidence:      expense.aiExtractionConfidence != null ? expense.aiExtractionConfidence : null,
  })
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const drawerScanRef = useRef(null)
  const receiptLink = expense._receiptWebViewLink || null

  function field(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  async function handleDrawerScan(file) {
    if (!file) return
    setScanning(true)
    const toastId = toast.loading('Uploading receipt to Drive…')
    try {
      const up = await aiAPI.uploadAttachment(file)
      const upBody = up.data?.data ?? up.data ?? {}
      const driveFileId = upBody.driveFileId
      if (!driveFileId) throw new Error('Upload returned no driveFileId')

      toast.loading('Reading receipt with AI…', { id: toastId })
      const ex = await expensesAPI.extractFromReceipt(driveFileId)
      const f = ex.data?.data || ex.data || {}

      setForm(prev => ({
        ...prev,
        entryDate:          f.entryDate          || prev.entryDate,
        category:           f.suggestedCategory  || prev.category,
        description:        f.suggestedDescription || prev.description,
        originalCurrency:   f.originalCurrency   || prev.originalCurrency,
        originalAmount:     f.originalAmount     != null ? f.originalAmount : prev.originalAmount,
        notes:              f.notes              || prev.notes,
        receiptDriveFileIds:        f.receiptDriveFileIds || [driveFileId],
        aiExtractedFromDriveFileId: f.aiExtractedFromDriveFileId || driveFileId,
        aiExtractionConfidence:     f.aiExtractionConfidence != null ? f.aiExtractionConfidence : (f.confidence ?? null),
      }))
      const conf = f.aiExtractionConfidence ?? f.confidence
      toast.success(conf != null ? `Extracted (confidence ${Math.round(conf * 100)}%)` : 'Extracted', { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Receipt scan failed', { id: toastId })
    } finally {
      setScanning(false)
      if (drawerScanRef.current) drawerScanRef.current.value = ''
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        ...form,
        originalAmount: Number(form.originalAmount),
        customerId:         form.customerId         || null,
        submittingOfficeId: form.submittingOfficeId || null,
        paidAt:             form.paidAt             || null,
        notes:              form.notes              || null,
      }
      if (isEdit) await expensesAPI.update(expense.id, payload)
      else        await expensesAPI.create(payload)
      toast.success(isEdit ? 'Saved' : 'Expense logged')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={drawerOverlay}>
      <div onClick={e => e.stopPropagation()} style={drawerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{isEdit ? 'Edit expense' : 'New expense'}</h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        {!isEdit && (
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => drawerScanRef.current?.click()}
              disabled={scanning}
              style={{ ...btnGhost, width: '100%', justifyContent: 'center', borderStyle: 'dashed', borderColor: '#94a3b8' }}
              title="Upload a receipt — AI fills the form below"
            >
              {scanning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{' '}
              Scan &amp; fill from receipt
            </button>
            <input
              ref={drawerScanRef}
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleDrawerScan(f)
              }}
            />
          </div>
        )}

        {form.aiExtractedFromDriveFileId && (
          <div style={{
            background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6,
            padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#065f46',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Sparkles size={14} />
            <span style={{ flex: 1 }}>
              AI pre-filled from receipt
              {form.aiExtractionConfidence != null && ` · confidence ${Math.round(form.aiExtractionConfidence * 100)}%`}
              . Review and edit before saving.
            </span>
            {receiptLink && (
              <a href={receiptLink} target="_blank" rel="noopener noreferrer" style={{ color: '#065f46', textDecoration: 'underline' }}>
                View receipt
              </a>
            )}
          </div>
        )}

        <Field label="Date">
          <input type="date" value={form.entryDate} onChange={e => field('entryDate', e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Category">
          <select value={form.category} onChange={e => field('category', e.target.value)} style={inputStyle}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Description">
          <input value={form.description} onChange={e => field('description', e.target.value)} placeholder="Taxi from airport for LAU trip" style={inputStyle} />
        </Field>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Field label="Currency">
              <select value={form.originalCurrency} onChange={e => field('originalCurrency', e.target.value)} style={inputStyle}>
                {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ flex: 2 }}>
            <Field label="Amount">
              <input type="number" step="0.01" value={form.originalAmount} onChange={e => field('originalAmount', e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </div>
        <Field label="Customer (for client P&L attribution)">
          <select value={form.customerId} onChange={e => field('customerId', e.target.value)} style={inputStyle}>
            <option value="">— Unassigned (counts as overhead) —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.companyName} {c.country ? `· ${c.country}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Submit to office">
          <select value={form.submittingOfficeId} onChange={e => field('submittingOfficeId', e.target.value)} style={inputStyle}>
            <option value="">— Pick later —</option>
            {offices.map(o => <option key={o.id} value={o.id}>{o.code} — {o.displayName}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={form.submissionStatus} onChange={e => field('submissionStatus', e.target.value)} style={inputStyle}>
            {STATUS_FILTERS.filter(s => s.value).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Paid on (leave blank if unpaid)">
          <input type="date" value={form.paidAt} onChange={e => field('paidAt', e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={e => field('notes', e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: 'inherit' }} />
        </Field>

        <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, width: '100%', marginTop: 16, justifyContent: 'center' }}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> {isEdit ? 'Save' : 'Create expense'}</>}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  )
}

// ── Picker modal (used for "pick an office to generate report") ─────────────

function PickerModal({ title, subtitle, options, onClose, onPick }) {
  return (
    <div onClick={onClose} style={drawerOverlay}>
      <div onClick={e => e.stopPropagation()} style={{ ...drawerStyle, width: 'min(440px, 100vw)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {options.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 14 }}>No options available.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {options.map(o => (
              <li key={o.value}>
                <button
                  onClick={() => !o.disabled && onPick(o.value)}
                  disabled={o.disabled}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '10px 12px', borderRadius: 6, marginBottom: 4,
                    border: '1px solid #e2e8f0',
                    background: o.disabled ? '#f8fafc' : 'white',
                    color: o.disabled ? '#94a3b8' : '#0f172a',
                    cursor: o.disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ flex: 1 }}>{o.label}</span>
                  {o.badge && <span style={{ fontSize: 11, color: '#92400e', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={12} /> {o.badge}
                  </span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Offices management modal ────────────────────────────────────────────────

function OfficesModal({ offices, onClose, onChanged }) {
  const [editing, setEditing] = useState(null) // null | {} | row

  async function handleSave(form) {
    try {
      if (form.id) {
        await expensesAPI.updateOffice(form.id, form)
      } else {
        await expensesAPI.createOffice(form)
      }
      toast.success('Office saved')
      setEditing(null)
      onChanged()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Save failed')
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this office? Linked expenses will block the delete; set isActive=false instead to retire.')) return
    try {
      await expensesAPI.removeOffice(id)
      toast.success('Office deleted')
      onChanged()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Delete failed')
    }
  }

  return (
    <div onClick={onClose} style={drawerOverlay}>
      <div onClick={e => e.stopPropagation()} style={drawerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Reimbursement offices</h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 0 }}>
          Each office is one entity you claim expenses from. Pick the export template once; later /expense-report runs use it automatically.
        </p>

        {!editing && (
          <>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
              {offices.map(o => (
                <li key={o.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={14} color="#64748b" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{o.code} <span style={{ color: '#64748b', fontWeight: 400 }}>· {o.displayName}</span></div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {o.defaultCurrency} · {o.claimsFrequency}
                      {o.exportTemplateKey ? ` · ${o.exportTemplateKey}` : ' · no template set'}
                    </div>
                  </div>
                  <button onClick={() => setEditing(o)} style={iconBtn}><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(o.id)} style={iconBtn}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
            <button onClick={() => setEditing({})} style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>
              <Plus size={14} /> New office
            </button>
          </>
        )}

        {editing && (
          <OfficeForm office={editing} onCancel={() => setEditing(null)} onSave={handleSave} />
        )}
      </div>
    </div>
  )
}

function OfficeForm({ office, onCancel, onSave }) {
  const [form, setForm] = useState({
    id:                office.id                || undefined,
    code:              office.code              || '',
    displayName:       office.displayName       || '',
    defaultCurrency:   office.defaultCurrency   || 'USD',
    claimsFrequency:   office.claimsFrequency   || 'ad_hoc',
    exportTemplateKey: office.exportTemplateKey || '',
    notes:             office.notes             || '',
    isActive:          office.isActive !== false,
  })
  const [saving, setSaving] = useState(false)

  function field(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  async function submit() {
    setSaving(true)
    try {
      await onSave({
        ...form,
        exportTemplateKey: form.exportTemplateKey || null,
        notes: form.notes || null,
      })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <Field label="Code (short, e.g. SOVERN_TW)">
        <input value={form.code} onChange={e => field('code', e.target.value)} disabled={!!form.id} style={inputStyle} />
      </Field>
      <Field label="Display name">
        <input value={form.displayName} onChange={e => field('displayName', e.target.value)} style={inputStyle} />
      </Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Field label="Currency">
            <select value={form.defaultCurrency} onChange={e => field('defaultCurrency', e.target.value)} style={inputStyle}>
              {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Frequency">
            <select value={form.claimsFrequency} onChange={e => field('claimsFrequency', e.target.value)} style={inputStyle}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="ad_hoc">Ad-hoc</option>
            </select>
          </Field>
        </div>
      </div>
      <Field label="Export template (pick when ready)">
        <select value={form.exportTemplateKey} onChange={e => field('exportTemplateKey', e.target.value)} style={inputStyle}>
          {EXPORT_TEMPLATES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>
      <Field label="Notes">
        <textarea value={form.notes} onChange={e => field('notes', e.target.value)} rows={2} style={{ ...inputStyle, fontFamily: 'inherit' }} />
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 16 }}>
        <input type="checkbox" checked={form.isActive} onChange={e => field('isActive', e.target.checked)} />
        Active (uncheck to retire without deleting)
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={btnGhost}>Cancel</button>
        <button onClick={submit} disabled={saving} style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving</> : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const selectStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, background: 'white' }
const inputStyle  = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, background: 'white', boxSizing: 'border-box' }
const thStyle = { padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#475569', letterSpacing: 0.3, textTransform: 'uppercase' }
const tdStyle = { padding: '10px 12px', fontSize: 14, color: '#0f172a', verticalAlign: 'middle' }
const drawerOverlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }
const drawerStyle = { width: 'min(520px, 100vw)', height: '100vh', background: 'white', padding: 24, overflowY: 'auto', boxShadow: '-4px 0 16px rgba(0,0,0,0.08)' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748b', marginLeft: 4 }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1d5a32', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const btnGhost   = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 500, fontSize: 13, cursor: 'pointer' }
