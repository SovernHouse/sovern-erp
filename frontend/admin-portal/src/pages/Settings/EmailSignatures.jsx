import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Star, X, Check } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'

const EMPTY_FORM = {
  name: '',
  displayName: '',
  title: '',
  phone: '',
  website: '',
  signatureImageUrl: '',
  logoUrl: '',
  tagline: '',
  legalText: '',
  isDefault: false,
}

function SignaturePreview({ sig }) {
  if (!sig.displayName) return null
  return (
    <div className="mt-3 border border-slate-100 rounded-lg px-4 py-3 bg-slate-50 text-xs text-slate-500 select-none">
      <div className="text-slate-400 mb-2 text-[10px] uppercase tracking-wider">Preview</div>
      <div style={{ height: 2, backgroundColor: '#1D5A32', marginBottom: 12 }} />
      {sig.signatureImageUrl && (
        <div className="mb-2">
          <img src={sig.signatureImageUrl} alt={sig.displayName} style={{ height: 44, display: 'block' }} />
        </div>
      )}
      <div className="font-medium text-slate-800 text-sm">{sig.displayName}</div>
      {sig.title && <div className="text-slate-500 text-[11px] uppercase tracking-widest mt-0.5">{sig.title}</div>}
      {(sig.website || sig.phone) && (
        <div className="mt-2 flex items-center gap-1.5">
          {sig.website && <span className="text-green-700 font-medium">{sig.website}</span>}
          {sig.website && sig.phone && <span className="text-slate-300">·</span>}
          {sig.phone && <span>{sig.phone}</span>}
        </div>
      )}
      {sig.tagline && <div className="mt-2 italic text-slate-400">{sig.tagline}</div>}
      {sig.legalText && (
        <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-400">{sig.legalText}</div>
      )}
    </div>
  )
}

function SignatureForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim() || !form.displayName.trim()) {
      toast.error('Name and display name are required')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Internal name <span className="text-red-500">*</span></label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="e.g. Alex — Founder"
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Display name <span className="text-red-500">*</span></label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="e.g. Alexander McConnell"
            value={form.displayName}
            onChange={e => set('displayName', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="e.g. Founder"
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="+886 970 781 818"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Website (no https://)</label>
        <input
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="sovernhouse.co"
          value={form.website}
          onChange={e => set('website', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Handwritten signature image URL</label>
        <input
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="https://sovernhouse.co/images/alex-signature@2x.png"
          value={form.signatureImageUrl}
          onChange={e => set('signatureImageUrl', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Logo image URL</label>
        <input
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="https://sovernhouse.co/logos/sovern-wordmark-email-light.png"
          value={form.logoUrl}
          onChange={e => set('logoUrl', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Tagline</label>
        <input
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Your buying office in Asia."
          value={form.tagline}
          onChange={e => set('tagline', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Legal disclaimer</label>
        <input
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Sovern House is a brand of New Route International Exchange Co., Ltd. — Taiwan."
          value={form.legalText}
          onChange={e => set('legalText', e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={e => set('isDefault', e.target.checked)}
          className="w-4 h-4 accent-green-700"
        />
        <span className="text-sm text-slate-700">Set as default signature</span>
      </label>

      <SignaturePreview sig={form} />

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save signature'}
        </button>
      </div>
    </div>
  )
}

export default function EmailSignatures() {
  const [signatures, setSignatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null) // id of row being edited

  const load = async () => {
    try {
      const res = await api.get('/crm/email-signatures')
      // api.js auto-unwraps {success,data} so res.data is the array directly
      setSignatures(Array.isArray(res.data) ? res.data : (res.data?.data || []))
    } catch {
      toast.error('Failed to load signatures')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (form) => {
    try {
      await api.post('/crm/email-signatures', form)
      toast.success('Signature created')
      setShowNew(false)
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create')
    }
  }

  const handleUpdate = async (id, form) => {
    try {
      await api.put(`/crm/email-signatures/${id}`, form)
      toast.success('Signature updated')
      setEditing(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this signature?')) return
    try {
      await api.delete(`/crm/email-signatures/${id}`)
      toast.success('Signature deleted')
      load()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleSetDefault = async (id) => {
    try {
      await api.put(`/crm/email-signatures/${id}`, { isDefault: true })
      toast.success('Default updated')
      load()
    } catch {
      toast.error('Failed to set default')
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Signatures</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage branded signatures for outreach emails. The default signature is used when none is selected.</p>
        </div>
        {!showNew && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700"
          >
            <Plus size={15} /> New signature
          </button>
        )}
      </div>

      {showNew && (
        <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">New signature</h3>
          <SignatureForm onSave={handleCreate} onCancel={() => setShowNew(false)} />
        </div>
      )}

      {signatures.length === 0 && !showNew && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No signatures yet. Create one to get started.</p>
          <p className="text-xs mt-1">Until a signature is created, the default Alex McConnell / Sovern House signature is used for all outreach emails.</p>
        </div>
      )}

      <div className="space-y-3">
        {signatures.map(sig => (
          <div key={sig.id} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            {editing === sig.id ? (
              <div className="p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Edit — {sig.name}</h3>
                <SignatureForm
                  initial={sig}
                  onSave={(form) => handleUpdate(sig.id, form)}
                  onCancel={() => setEditing(null)}
                />
              </div>
            ) : (
              <div className="flex items-start gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{sig.name}</span>
                    {sig.isDefault && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                        <Star size={9} fill="currentColor" /> Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {sig.displayName}{sig.title ? ` · ${sig.title}` : ''}{sig.website ? ` · ${sig.website}` : ''}
                  </div>
                  {sig.tagline && <div className="text-xs text-slate-400 italic mt-0.5">{sig.tagline}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!sig.isDefault && (
                    <button
                      onClick={() => handleSetDefault(sig.id)}
                      title="Set as default"
                      className="p-1.5 text-slate-400 hover:text-green-700 hover:bg-green-50 rounded-lg"
                    >
                      <Star size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(sig.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(sig.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
