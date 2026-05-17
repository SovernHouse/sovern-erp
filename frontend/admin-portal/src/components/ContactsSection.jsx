// ─── ContactsSection — Phase 4.23 embed pattern ─────────────────────────────
//
// Reusable contact-card list for Client (Customer) and Supplier (Factory)
// detail pages. Renders:
//
//   - Section header with a "+ Add contact" button
//   - List of existing contacts (name, email, phone, job title, primary flag)
//   - Inline add / edit form per row (modal-free)
//   - Delete with confirmation
//
// Auto-tags newly-created contacts with the parent's customerId or factoryId
// so the backend's /api/contacts surface persists the relationship via the
// existing flat customer_id / factory_id FKs (no new tables).
//
// Usage:
//   <ContactsSection parentType="Customer" parentId={customer.id} />
//   <ContactsSection parentType="Factory"  parentId={factory.id} />
//
// parentType drives the field name on POST: 'Customer' → customerId,
// 'Factory' → factoryId. The list query uses the same param.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Check, X, User, Star } from 'lucide-react'
import { contactsAPI } from '../services/api'

const PARENT_KEYS = {
  Customer: 'customerId',
  Factory:  'factoryId',
}

const EMPTY = {
  firstName: '',
  lastName:  '',
  email:     '',
  phone:     '',
  mobile:    '',
  jobTitle:  '',
  department:'',
  isPrimary: false,
  notes:     '',
}

export default function ContactsSection({ parentType, parentId }) {
  const parentKey = PARENT_KEYS[parentType]
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(null)   // contact id being edited, or 'new'
  const [draft, setDraft]       = useState(EMPTY)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    contactsAPI.list({ [parentKey]: parentId, limit: 100 })
      .then((res) => {
        if (cancelled) return
        const rows = res.data || []
        setContacts(rows)
      })
      .catch((err) => {
        if (cancelled) return
        toast.error(err.response?.data?.message || 'Failed to load contacts')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [parentType, parentId])

  const startAdd = () => {
    setEditing('new')
    setDraft({ ...EMPTY })
  }
  const startEdit = (c) => {
    setEditing(c.id)
    setDraft({
      firstName:  c.firstName  || '',
      lastName:   c.lastName   || '',
      email:      c.email      || '',
      phone:      c.phone      || '',
      mobile:     c.mobile     || '',
      jobTitle:   c.jobTitle   || '',
      department: c.department || '',
      isPrimary:  !!c.isPrimary,
      notes:      c.notes      || '',
    })
  }
  const cancelEdit = () => {
    setEditing(null)
    setDraft(EMPTY)
  }

  const handleSave = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.email.trim()) {
      toast.error('First name, last name, and email are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...draft,
        firstName:  draft.firstName.trim(),
        lastName:   draft.lastName.trim(),
        email:      draft.email.trim(),
        phone:      draft.phone.trim() || null,
        mobile:     draft.mobile.trim() || null,
        jobTitle:   draft.jobTitle.trim() || null,
        department: draft.department.trim() || null,
        notes:      draft.notes.trim() || null,
        [parentKey]: parentId,
      }
      if (editing === 'new') {
        const res = await contactsAPI.create(payload)
        setContacts((prev) => [...prev, res.data])
        toast.success(`Added ${res.data.firstName} ${res.data.lastName}`)
      } else {
        const res = await contactsAPI.update(editing, payload)
        setContacts((prev) => prev.map(c => c.id === editing ? res.data : c))
        toast.success(`Updated ${res.data.firstName} ${res.data.lastName}`)
      }
      cancelEdit()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete contact "${c.firstName} ${c.lastName}"?`)) return
    try {
      await contactsAPI.delete(c.id)
      setContacts((prev) => prev.filter(x => x.id !== c.id))
      toast.success('Contact deleted')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  const f = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <User className="w-4 h-4" /> Contacts
          {contacts.length > 0 && (
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {contacts.length}
            </span>
          )}
        </h2>
        {editing !== 'new' && (
          <button
            onClick={startAdd}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50 rounded-lg border border-primary-200"
          >
            <Plus className="w-4 h-4" /> Add contact
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 py-4">Loading…</p>
      ) : (
        <div className="space-y-2">
          {contacts.length === 0 && editing !== 'new' && (
            <p className="text-sm text-slate-400 py-4">
              No contacts yet. Click <strong>Add contact</strong> to create one.
            </p>
          )}

          {contacts.map((c) => (
            editing === c.id
              ? <ContactForm key={c.id} draft={draft} setDraft={setDraft} f={f} onSave={handleSave} onCancel={cancelEdit} saving={saving} />
              : <ContactRow  key={c.id} contact={c} onEdit={() => startEdit(c)} onDelete={() => handleDelete(c)} />
          ))}

          {editing === 'new' && (
            <ContactForm draft={draft} setDraft={setDraft} f={f} onSave={handleSave} onCancel={cancelEdit} saving={saving} isNew />
          )}
        </div>
      )}
    </div>
  )
}

function ContactRow({ contact, onEdit, onDelete }) {
  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '—'
  return (
    <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{fullName}</span>
            {contact.isPrimary && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                <Star className="w-3 h-3" /> Primary
              </span>
            )}
            {contact.jobTitle && (
              <span className="text-xs text-slate-500">· {contact.jobTitle}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="hover:text-primary-700">
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <span>{contact.phone}</span>
            )}
            {contact.mobile && (
              <span>m: {contact.mobile}</span>
            )}
            {contact.department && (
              <span className="text-slate-400">{contact.department}</span>
            )}
          </div>
          {contact.notes && (
            <p className="mt-2 text-xs text-slate-500 italic">{contact.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ContactForm({ draft, setDraft, f, onSave, onCancel, saving, isNew }) {
  return (
    <div className="border-2 border-primary-300 rounded-lg p-4 bg-primary-50/30 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">
        {isNew ? 'New contact' : 'Edit contact'}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name *" value={draft.firstName} onChange={f('firstName')} autoFocus />
        <Field label="Last name *"  value={draft.lastName}  onChange={f('lastName')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email *"      value={draft.email}     onChange={f('email')} type="email" />
        <Field label="Phone"        value={draft.phone}     onChange={f('phone')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mobile"       value={draft.mobile}    onChange={f('mobile')} />
        <Field label="Job title"    value={draft.jobTitle}  onChange={f('jobTitle')} />
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <Field label="Department"   value={draft.department} onChange={f('department')} />
        <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
          <input
            type="checkbox"
            checked={draft.isPrimary}
            onChange={(e) => setDraft((d) => ({ ...d, isPrimary: e.target.checked }))}
            className="w-4 h-4 rounded border-slate-300"
          />
          Primary contact
        </label>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
        <textarea
          value={draft.notes}
          onChange={f('notes')}
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-primary-100">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-1"
        >
          <X className="w-4 h-4" /> Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1"
        >
          <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', autoFocus }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
      />
    </div>
  )
}
