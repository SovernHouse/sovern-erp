// ─── FactoryQuickCreate ──────────────────────────────────────────────────────
//
// Phase 4.22 — Odoo lightning-bolt pattern for the Factory Many2one.
// Opened by clicking "+ New" next to a factory picker on any form. Minimal
// required field set: companyName + brandCode. Everything else accepts
// sensible server-side defaults (email/phone get unknown@unknown.local
// per the existing factoryWriteService).
//
// On save the new Factory is returned to the parent via onCreated(factory).
// The parent appends to its local factories list and auto-selects the
// new id so the user never leaves the form they were filling out.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { factoriesAPI } from '../services/api'
import BrandPicker from './BrandPicker'

export default function FactoryQuickCreate({ open, onClose, onCreated, defaultBrandCode = null }) {
  const [form, setForm] = useState({
    companyName: '',
    brandCode: defaultBrandCode || '',
    country: '',
    contactPerson: '',
    email: '',
    phone: '',
  })
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const name = form.companyName.trim()
    if (!name) {
      toast.error('Company name is required')
      return
    }
    setSaving(true)
    try {
      const res = await factoriesAPI.create({
        companyName:   name,
        brandCode:     form.brandCode || undefined,
        country:       form.country.trim()       || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        email:         form.email.trim()         || undefined,
        phone:         form.phone.trim()         || undefined,
      })
      const created = res.data
      toast.success(`Created supplier: ${created.companyName}`)
      onCreated && onCreated(created)
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Quick create supplier</h3>
            <p className="text-xs text-slate-500 mt-1">
              Just the basics — full details can be filled in later from the Factories list.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company name *</label>
            <input
              autoFocus
              value={form.companyName}
              onChange={f('companyName')}
              placeholder="e.g. Anhui HanHua Building Materials"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>

          <BrandPicker
            value={form.brandCode}
            onChange={(v) => setForm((p) => ({ ...p, brandCode: v }))}
            label="Brand"
            required={false}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
              <input
                value={form.country}
                onChange={f('country')}
                placeholder="China / Malaysia / …"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact person</label>
              <input
                value={form.contactPerson}
                onChange={f('contactPerson')}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={f('email')}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={f('phone')}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.companyName.trim()}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40"
            >
              {saving ? 'Creating…' : 'Create supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
