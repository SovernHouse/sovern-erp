/**
 * ProductBrandingModePicker — Phase 3, C12.
 *
 * Renders on CustomerDetail when the customer's brandRelationships
 * includes 'FW'. Three radios (IronLite / Generic / Private Label) +
 * a required text input for `privateLabelProductName` when mode is
 * 'private_label'.
 *
 * Lock semantics:
 *   - If customer.productBrandingModeLockedAt is set, the radios are
 *     disabled for non-super-admin and a lock badge shows the lock
 *     timestamp (in Asia/Taipei).
 *   - Super-admin sees an "Override lock" CTA that opens a small
 *     dialog: { new mode, new private-label name (if applicable),
 *     reason (min 3 chars) } → POSTs to
 *     /customers/:id/override-branding-mode-lock.
 *
 * The picker calls `onSaved(updatedCustomer)` after each successful
 * change so the parent can re-render badges and downstream UI.
 */

import React, { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { formatDateTimeTaipei } from '../utils/formatters'

const MODES = [
  {
    code: 'ironlite',
    title: 'IronLite Core',
    detail: 'Full IronLite I-Beam wordmark, OEM badge, construction diagram (WPC products).',
  },
  {
    code: 'generic',
    title: 'Generic FlorWay',
    detail: 'FlorWay Sdn. Bhd. wordmark. No IronLite imagery. Default for new FW customers.',
  },
  {
    code: 'private_label',
    title: 'Private Label',
    detail: 'Buyer\'s brand name on the document. "Manufactured exclusively for [Buyer]" framing.',
  },
]

export default function ProductBrandingModePicker({ customer, currentUserRole, onSaved }) {
  const [mode, setMode] = useState(customer?.productBrandingMode || 'generic')
  const [labelName, setLabelName] = useState(customer?.privateLabelProductName || '')
  const [saving, setSaving] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)

  const isLocked = !!customer?.productBrandingModeLockedAt
  const isSuperAdmin = currentUserRole === 'super_admin'
  const effectiveDisabled = isLocked && !isSuperAdmin

  const dirty =
    mode !== (customer?.productBrandingMode || 'generic') ||
    (mode === 'private_label' && (labelName || '') !== (customer?.privateLabelProductName || ''))

  const handleSave = async () => {
    if (mode === 'private_label' && !labelName.trim()) {
      toast.error('Private label brand name is required')
      return
    }
    setSaving(true)
    try {
      const res = await api.put(`/customers/${customer.id}`, {
        productBrandingMode: mode,
        privateLabelProductName: mode === 'private_label' ? labelName.trim() : null,
      })
      toast.success('Product branding mode updated')
      onSaved && onSaved(res.data?.data || res.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update branding mode')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      padding: 20,
      border: '1px solid #e2e8f0',
      marginTop: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
            FlorWay Product Branding Mode
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            Picks the FW quotation variant. Locks on first FW quotation sent under that mode.
          </div>
        </div>
        {isLocked && (
          <div style={{
            background: '#FEF3C7',
            color: '#92400E',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
          }}>
            LOCKED  ·  {formatDateTimeTaipei(customer.productBrandingModeLockedAt)}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {MODES.map((m) => (
          <label
            key={m.code}
            style={{
              border: `1px solid ${mode === m.code ? '#1F2933' : '#e2e8f0'}`,
              background: mode === m.code ? '#FAFAF7' : 'white',
              borderRadius: 8,
              padding: 12,
              cursor: effectiveDisabled ? 'not-allowed' : 'pointer',
              opacity: effectiveDisabled ? 0.6 : 1,
            }}
          >
            <input
              type="radio"
              name="productBrandingMode"
              value={m.code}
              checked={mode === m.code}
              onChange={() => setMode(m.code)}
              disabled={effectiveDisabled}
              style={{ marginRight: 6 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0E0D0C' }}>{m.title}</span>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
              {m.detail}
            </div>
          </label>
        ))}
      </div>

      {mode === 'private_label' && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
            Private label brand name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="text"
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            disabled={effectiveDisabled}
            placeholder="e.g. OakCove Flooring"
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: 13,
              background: effectiveDisabled ? '#f8fafc' : 'white',
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {isLocked && isSuperAdmin && (
          <button
            type="button"
            onClick={() => setOverrideOpen(true)}
            style={{
              padding: '8px 14px',
              border: '1px solid #92400E',
              background: 'white',
              color: '#92400E',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Override lock
          </button>
        )}
        {!effectiveDisabled && dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 14px',
              border: 'none',
              background: '#1F2933',
              color: 'white',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>

      {overrideOpen && (
        <OverrideDialog
          customer={customer}
          onClose={() => setOverrideOpen(false)}
          onDone={(updated) => { setOverrideOpen(false); onSaved && onSaved(updated) }}
        />
      )}
    </div>
  )
}

function OverrideDialog({ customer, onClose, onDone }) {
  const [newMode, setNewMode] = useState(customer.productBrandingMode || 'generic')
  const [newName, setNewName] = useState(customer.privateLabelProductName || '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (reason.trim().length < 3) {
      toast.error('Reason must be at least 3 characters')
      return
    }
    if (newMode === 'private_label' && !newName.trim()) {
      toast.error('Private label brand name is required')
      return
    }
    setSaving(true)
    try {
      const res = await api.post(`/customers/${customer.id}/override-branding-mode-lock`, {
        newMode,
        newPrivateLabelProductName: newMode === 'private_label' ? newName.trim() : null,
        reason: reason.trim(),
      })
      toast.success('Lock cleared. Mode updated.')
      onDone(res.data?.data || res.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Override failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 20, width: 480, maxWidth: '90%',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0E0D0C', marginBottom: 4 }}>
          Override product branding mode lock
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          Super-admin only. The override is logged with your name and reason.
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>New mode</label>
        <select
          value={newMode}
          onChange={(e) => setNewMode(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, marginBottom: 12 }}
        >
          <option value="ironlite">IronLite Core</option>
          <option value="generic">Generic FlorWay</option>
          <option value="private_label">Private Label</option>
        </select>

        {newMode === 'private_label' && (
          <>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Private label name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. OakCove Flooring"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, marginBottom: 12 }}
            />
          </>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
          Reason <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Why the lock is being cleared (audit trail)"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, marginBottom: 16, fontFamily: 'inherit' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 14px', border: '1px solid #cbd5e1', background: 'white', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            style={{ padding: '8px 14px', border: 'none', background: '#92400E', color: 'white', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'Apply override'}
          </button>
        </div>
      </div>
    </div>
  )
}
