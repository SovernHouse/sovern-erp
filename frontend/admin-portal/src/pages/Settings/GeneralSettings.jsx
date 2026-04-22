import { useState } from 'react'
import toast from 'react-hot-toast'
import { TextInput, TextArea } from '../../components/FormFields'

export default function GeneralSettings() {
  const [formData, setFormData] = useState({
    companyName: 'Trading Company',
    email: 'info@trading.com',
    phone: '+1-234-567-8900',
    address: '123 Business Ave, City, Country',
    logo: '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    toast.success('Settings updated')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">General Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput label="Company Name" name="companyName" value={formData.companyName} onChange={handleChange} />
          <TextInput label="Email" name="email" value={formData.email} onChange={handleChange} type="email" />
          <TextInput label="Phone" name="phone" value={formData.phone} onChange={handleChange} />
          <TextArea label="Address" name="address" value={formData.address} onChange={handleChange} rows={3} />

          <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
            Save Settings
          </button>
        </form>
      </div>
    </div>
  )
}
