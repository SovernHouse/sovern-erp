// ─── CustomerQuickCreate ─────────────────────────────────────────────────────
//
// Phase 4.22 — Odoo lightning-bolt pattern for the Customer Many2one.
// Opened by clicking "+ New" next to a customer picker on Lead / Quotation /
// Inquiry / Deal forms. Required field set per the Customer model:
// companyName + email + phone (allowNull: false).
//
// On save the new Customer is returned to the parent via onCreated(customer).
// The parent appends to its local customers list and auto-selects the new id
// so the user never leaves the form.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { customersAPI } from '../services/api'
import { useBrands } from '../contexts/BrandsContext'

export default function CustomerQuickCreate({ open, onClose, onCreated, defaultBrandCode = null }) {
  const { defaultBrand } = useBrands()
  const [form, setForm] = useState({
    companyName: '',
    email: '',
    phone: '',
    country: '',
    contactPerson: '',
  })
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.companyName.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error('Company name, email, and phone are required')
      return
    }
    setSaving(true)
    try {
      const seedBrand = defaultBrandCode || defaultBrand || 'SH'
      const res = await customersAPI.create({
        companyName:   form.companyName.trim(),
        email:         form.email.trim(),
        phone:         form.phone.trim(),
        country:       form.country.trim() || null,
        contactPerson: form.contactPerson.trim() || null,
        // Customer brand is held via brandRelationships (array) per L-023.
        // Seed with the active form/user brand so the new row is immediately
        // visible to the user creating it.
        brandRelationships: [seedBrand],
      })
      const created = res.data
      toast.success(`Created client: ${created.companyName}`)
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
            <h3 className="text-lg font-bold text-slate-900">Quick create client</h3>
            <p className="text-xs text-slate-500 mt-1">
              Just the basics — full details can be filled in later from the Customers list.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company name *</label>
            <input
              autoFocus
              value={form.companyName}
              onChange={f('companyName')}
              placeholder="e.g. Milliken & Company"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={f('email')}
                placeholder="contact@example.com"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
              <input
                value={form.phone}
                onChange={f('phone')}
                placeholder="+1 555 0100"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
              <input
                value={form.country}
                onChange={f('country')}
                placeholder="US / Canada / …"
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
              disabled={saving || !form.companyName.trim() || !form.email.trim() || !form.phone.trim()}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40"
            >
              {saving ? 'Creating…' : 'Create client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
