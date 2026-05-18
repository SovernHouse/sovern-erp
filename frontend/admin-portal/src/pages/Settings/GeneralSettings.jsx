/**
 * GeneralSettings — Phase 4.8 Commit 1 backend persistence wired up
 * 2026-05-18. The previous version of this file was a hardcoded
 * placeholder: initial state was a static literal ("Trading Company" /
 * "info@trading.com" / etc.), the submit handler showed a toast but
 * NEVER called the API, and on reload the form re-initialised to the
 * same literal — making every "save" silently revert.
 *
 * Backend has had GET / PUT /api/settings/company persisting to
 * SystemSetting since Phase 4.8. This wires the frontend to it.
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { TextInput, TextArea } from '../../components/FormFields'
import api from '../../services/api'

const EMPTY_FORM = {
  companyName: '',
  companyEmail: '',
  companyPhone: '',
  companyAddress: '',
  companyCity: '',
  companyCountry: '',
  companyLogo: '',
  currency: 'USD',
  timezone: 'Asia/Taipei',
  language: 'en',
  taxRate: 0,
  defaultPaymentTerms: '',
}

export default function GeneralSettings() {
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/settings/company')
      // api.js interceptor unwraps { success, data } envelopes — tolerate both.
      const body = (res.data && typeof res.data === 'object' && res.data.data) ? res.data.data : res.data
      setFormData((prev) => ({ ...prev, ...(body || {}) }))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load company settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const res = await api.put('/settings/company', formData)
      const body = (res.data && typeof res.data === 'object' && res.data.data) ? res.data.data : res.data
      // Re-seed the form from the persisted row so the user sees exactly
      // what the server saved (including any server-side normalisation
      // like trimmed whitespace).
      if (body && typeof body === 'object') setFormData((prev) => ({ ...prev, ...body }))
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">General Settings</h1>
        <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <p className="text-slate-500">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">General Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            label="Company Name"
            name="companyName"
            value={formData.companyName || ''}
            onChange={handleChange}
          />
          <TextInput
            label="Company Email"
            name="companyEmail"
            value={formData.companyEmail || ''}
            onChange={handleChange}
            type="email"
          />
          <TextInput
            label="Phone"
            name="companyPhone"
            value={formData.companyPhone || ''}
            onChange={handleChange}
          />
          <TextArea
            label="Address"
            name="companyAddress"
            value={formData.companyAddress || ''}
            onChange={handleChange}
            rows={3}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="City"
              name="companyCity"
              value={formData.companyCity || ''}
              onChange={handleChange}
            />
            <TextInput
              label="Country"
              name="companyCountry"
              value={formData.companyCountry || ''}
              onChange={handleChange}
            />
          </div>
          <TextInput
            label="Logo URL"
            name="companyLogo"
            value={formData.companyLogo || ''}
            onChange={handleChange}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextInput
              label="Currency"
              name="currency"
              value={formData.currency || 'USD'}
              onChange={handleChange}
            />
            <TextInput
              label="Timezone"
              name="timezone"
              value={formData.timezone || 'Asia/Taipei'}
              onChange={handleChange}
            />
            <TextInput
              label="Language"
              name="language"
              value={formData.language || 'en'}
              onChange={handleChange}
            />
          </div>
          <TextInput
            label="Default Payment Terms"
            name="defaultPaymentTerms"
            value={formData.defaultPaymentTerms || ''}
            onChange={handleChange}
          />
          <TextInput
            label="Default Tax Rate (%)"
            name="taxRate"
            value={String(formData.taxRate ?? 0)}
            onChange={(e) => setFormData((prev) => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
            type="number"
          />

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            <button
              type="button"
              onClick={load}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Reload
            </button>
            <span className="text-xs text-slate-500 ml-auto">
              Saves to SystemSetting on the server. Audit-logged.
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
