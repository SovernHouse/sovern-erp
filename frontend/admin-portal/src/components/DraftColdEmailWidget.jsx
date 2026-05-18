import { useState, useEffect, useMemo, useRef } from 'react'
import { Mail, Send, Save, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'
import Modal from './Modal'

/**
 * DraftColdEmailWidget — Phase 4.17.
 *
 * Inline-editable Draft Cold Email card on the Lead detail page. Single
 * source of truth: OutreachEmail rows (status='draft'). The page-level
 * Edit toggle no longer gates this widget — Subject and Body are
 * always editable.
 *
 * Props:
 *   - lead: { id, email, contactName, companyName, country, brandCode }
 *   - initialOutreach: { draft, sent, latest } (from GET /crm/leads/:id)
 *   - brand: optional preloaded Brand { code, displayName, senderEmail,
 *            signatureText, signatureHtml }
 *   - onChanged: callback fired after any successful Save/Send/Discard
 *                so the parent can refetch lead-level state (status,
 *                createdBySource, chatter)
 */
export default function DraftColdEmailWidget({ lead, initialOutreach, brand, onChanged }) {
  const initialLatest = initialOutreach?.latest || null
  const initialDraft = initialOutreach?.draft || null
  const initialSent = initialOutreach?.sent || null

  const [loading, setLoading] = useState(!initialOutreach)
  const [latest, setLatest] = useState(initialLatest)
  const [draft, setDraft] = useState(initialDraft)
  const [sent, setSent] = useState(initialSent)
  const [subject, setSubject] = useState(initialDraft?.subject || '')
  const [body, setBody] = useState(initialDraft?.bodyText || '')
  const [savedSubject, setSavedSubject] = useState(initialDraft?.subject || '')
  const [savedBody, setSavedBody] = useState(initialDraft?.bodyText || '')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [sendError, setSendError] = useState(null)
  const fetchedOnce = useRef(!!initialOutreach)

  const sentState = latest && latest.status === 'sent'
  const dirty = (subject !== savedSubject) || (body !== savedBody)
  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !sentState

  // Initial fetch only if parent didn't preload.
  useEffect(() => {
    if (fetchedOnce.current || !lead?.id) return
    fetchedOnce.current = true
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await api.get(`/crm/leads/${lead.id}/outreach-draft`)
        if (cancelled) return
        const data = res.data?.data || {}
        applyOutreachState(data, { resetEditor: true })
      } catch (e) {
        // Non-fatal — leave widget empty + editable so user can author.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [lead?.id])

  function applyOutreachState({ draft: d, sent: s, latest: l }, { resetEditor }) {
    setDraft(d || null)
    setSent(s || null)
    setLatest(l || null)
    if (resetEditor) {
      // When loading initial state: prefill from draft if present, else
      // from the most recent sent row (so a sent-state widget shows the
      // body that went out), else leave empty.
      const seedFrom = d || (l && l.status === 'sent' ? l : null)
      setSubject(seedFrom?.subject || '')
      setBody(seedFrom?.bodyText || '')
      setSavedSubject(seedFrom?.subject || '')
      setSavedBody(seedFrom?.bodyText || '')
    }
  }

  async function handleSaveDraft() {
    if (!canSubmit || saving) return
    setSaving(true)
    try {
      const res = await api.put(`/crm/leads/${lead.id}/outreach-draft`, {
        subject: subject.trim(),
        bodyText: body.trim(),
      })
      const saved = res.data?.data
      if (saved) {
        setDraft(saved)
        setLatest(saved)
        setSavedSubject(saved.subject || '')
        setSavedBody(saved.bodyText || '')
        toast.success('Draft saved')
        if (typeof onChanged === 'function') onChanged()
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Failed to save draft'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmSend() {
    if (!canSubmit || sending) return
    setSending(true)
    setSendError(null)
    try {
      const res = await api.post(`/crm/leads/${lead.id}/outreach-emails`, {
        toAddress: lead.email,
        toName: lead.contactName || null,
        subject: subject.trim(),
        bodyText: body.trim(),
        touchNumber: (draft?.touchNumber || latest?.touchNumber || 1),
      })
      const sentRow = res.data?.data || null
      if (sentRow) {
        setSent(sentRow)
        setDraft(null)
        setLatest(sentRow)
        setSubject(sentRow.subject || '')
        setBody(sentRow.bodyText || '')
        setSavedSubject(sentRow.subject || '')
        setSavedBody(sentRow.bodyText || '')
      }
      toast.success(`Email sent to ${lead.email}`)
      setConfirmSend(false)
      if (typeof onChanged === 'function') onChanged()
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Failed to send'
      setSendError(msg)
    } finally {
      setSending(false)
    }
  }

  async function handleConfirmDiscard() {
    setSaving(true)
    try {
      await api.delete(`/crm/leads/${lead.id}/outreach-draft`)
      setDraft(null)
      // Latest collapses back to sent row if there was one, else null.
      setLatest(sent || null)
      setSubject('')
      setBody('')
      setSavedSubject('')
      setSavedBody('')
      toast.success('Draft discarded')
      setConfirmDiscard(false)
      if (typeof onChanged === 'function') onChanged()
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Failed to discard'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  function handleStartFollowUp() {
    if (!sent) return
    const nextTouch = (sent.touchNumber || 1) + 1
    // Seed the editor with the sent row's content so the user can edit
    // forward without retyping; the new row will land as a draft on next
    // Save / Send (the Send path auto-creates if no draft exists).
    setSubject(sent.subject || '')
    setBody(sent.bodyText || '')
    setSavedSubject('')
    setSavedBody('')
    setLatest({ ...sent, status: 'draft', touchNumber: nextTouch })
    setDraft(null)
  }

  // Brand info for the confirm modal preview. Falls back to lead.brandCode
  // when the parent didn't preload a Brand row.
  const fromLabel = useMemo(() => {
    if (brand?.senderEmail) return brand.senderEmail
    return lead?.brandCode ? `(${lead.brandCode} sender)` : '(brand sender)'
  }, [brand?.senderEmail, lead?.brandCode])

  const egyptBcc = lead?.brandCode === 'SH' && /egypt/i.test(lead?.country || '')

  return (
    <div className="border-2 border-emerald-200 bg-emerald-50/50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-emerald-700" />
          <h2 className="text-xl font-semibold text-gray-900">Draft Cold Email</h2>
          {dirty && !sentState && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium border border-amber-200">
              <AlertCircle size={12} />
              Unsaved changes
            </span>
          )}
          {sentState && sent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium border border-emerald-200">
              <CheckCircle2 size={12} />
              Sent {sent.sentAt ? new Date(sent.sentAt).toLocaleString() : ''} · touch {sent.touchNumber || 1}
              {sent.sentBy ? ` · by ${[sent.sentBy.firstName, sent.sentBy.lastName].filter(Boolean).join(' ') || sent.sentBy.email}` : ''}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">OutreachEmail is the source of truth.</span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
          {loading ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded" />
          ) : (
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sentState}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-gray-50 disabled:text-gray-700"
              placeholder="Subject line (3-6 words for cold outreach)"
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Body</label>
          {loading ? (
            <div className="h-[50px] bg-gray-100 animate-pulse rounded" />
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={sentState}
              rows={12}
              style={{ resize: 'vertical' }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono text-sm disabled:bg-gray-50 disabled:text-gray-700"
              placeholder="Plain text body. The brand signature is appended automatically on send."
            />
          )}
        </div>

        {!sentState && (
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!canSubmit || saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmSend(true)}
              disabled={!canSubmit || sending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
              Send
            </button>
            {draft && (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                disabled={saving || sending}
                className="inline-flex items-center gap-2 px-3 py-2 text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
              >
                <Trash2 size={14} />
                Discard Draft
              </button>
            )}
          </div>
        )}

        {sentState && (
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={handleStartFollowUp}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              <Send size={16} />
              Send follow-up
            </button>
            <span className="text-xs text-gray-500">
              Creates a fresh draft as touch {(sent?.touchNumber || 1) + 1}.
            </span>
          </div>
        )}
      </div>

      {/* Send confirmation modal */}
      <Modal isOpen={confirmSend} onClose={() => { if (!sending) { setConfirmSend(false); setSendError(null) } }} title="Send outreach email?" size="lg">
        <div className="space-y-3 text-sm text-slate-800">
          <div><span className="text-slate-500 font-medium">From:</span> {fromLabel}{brand?.displayName ? ` (${brand.displayName})` : ''}</div>
          <div><span className="text-slate-500 font-medium">To:</span> {lead?.email}{lead?.contactName ? ` (${lead.contactName})` : ''}</div>
          <div><span className="text-slate-500 font-medium">Subject:</span> {subject}</div>
          {egyptBcc && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Egypt BCC notice: Sovern House outreach to Egypt is BCC'd to the team distribution list per the standing rule.
            </div>
          )}
          <div>
            <div className="text-slate-500 font-medium mb-1">Body preview</div>
            <pre className="whitespace-pre-wrap font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded p-3 max-h-[400px] overflow-y-auto">
              {body}
              {brand?.signatureText ? `\n\n${brand.signatureText}` : '\n\n[brand signature appended on send]'}
            </pre>
          </div>
          {sendError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>{sendError}</div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleConfirmSend}
              disabled={sending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send Now'}
            </button>
            <button
              type="button"
              onClick={() => { setConfirmSend(false); setSendError(null) }}
              disabled={sending}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Discard confirmation modal */}
      <Modal isOpen={confirmDiscard} onClose={() => { if (!saving) setConfirmDiscard(false) }} title="Discard draft?" size="sm">
        <div className="space-y-3 text-sm text-slate-800">
          <p>Discard draft for <strong>{lead?.companyName || 'this lead'}</strong>? This cannot be undone.</p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleConfirmDiscard}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Keep editing
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
