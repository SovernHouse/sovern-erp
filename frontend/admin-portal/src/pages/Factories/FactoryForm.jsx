import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import { factoriesAPI } from '../../services/api'
import { COUNTRIES, FACTORY_STATUS } from '../../utils/constants'
import { TextInput, EmailInput, SelectInput, TextArea } from '../../components/FormFields'

export default function FactoryForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(!!id)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    address: '',
    contactPerson: '',
    status: FACTORY_STATUS.ACTIVE,
    notes: '',
  })

  useEffect(() => {
    if (id) fetchFactory()
  }, [id])

  const fetchFactory = async () => {
    try {
      const res = await factoriesAPI.getById(id)
      setFormData(res.data)
    } catch (error) {
      toast.error('Failed to load factory')
      navigate('/factories')
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.name) newErrors.name = 'Name is required'
    if (!formData.email) newErrors.email = 'Email is required'
    if (!formData.country) newErrors.country = 'Country is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setIsSaving(true)
      if (id) {
        await factoriesAPI.update(id, formData)
        toast.success('Factory updated successfully')
      } else {
        await factoriesAPI.create(formData)
        toast.success('Factory created successfully')
      }
      navigate('/factories')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save factory')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="text-center py-12">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/factories')}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900">
          {id ? 'Edit Factory' : 'New Factory'}
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextInput
              label="Factory Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              required
            />
            <EmailInput
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextInput
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />
            <SelectInput
              label="Country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              error={errors.country}
              options={COUNTRIES.map((c) => ({ value: c, label: c }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextInput
              label="City"
              name="city"
              value={formData.city}
              onChange={handleChange}
            />
            <TextInput
              label="Contact Person"
              name="contactPerson"
              value={formData.contactPerson}
              onChange={handleChange}
            />
          </div>

          <TextInput
            label="Address"
            name="address"
            value={formData.address}
            onChange={handleChange}
          />

          <SelectInput
            label="Status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            options={Object.entries(FACTORY_STATUS).map(([key, val]) => ({
              value: val,
              label: key.replace(/_/g, ' '),
            }))}
          />

          <TextArea
            label="Notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
          />

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
            >
              {isSaving ? 'Saving...' : id ? 'Update Factory' : 'Create Factory'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/factories')}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
