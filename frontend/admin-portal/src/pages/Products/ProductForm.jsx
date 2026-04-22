import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import { productsAPI } from '../../services/api'
import { TextInput, SelectInput, CurrencyInput, TextArea, FileInput } from '../../components/FormFields'

export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(!!id)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    factory: '',
    price: 0,
    description: '',
  })

  useEffect(() => {
    if (id) fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    try {
      const res = await productsAPI.getById(id)
      setFormData(res.data)
    } catch (error) {
      toast.error('Failed to load product')
      navigate('/products')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      if (id) {
        await productsAPI.update(id, formData)
        toast.success('Product updated')
      } else {
        await productsAPI.create(formData)
        toast.success('Product created')
      }
      navigate('/products')
    } catch (error) {
      toast.error('Failed to save product')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="text-center py-12">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/products')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900">{id ? 'Edit Product' : 'New Product'}</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Product Name" name="name" value={formData.name} onChange={handleChange} required />
            <TextInput label="SKU" name="sku" value={formData.sku} onChange={handleChange} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Category" name="category" value={formData.category} onChange={handleChange} />
            <TextInput label="Factory" name="factory" value={formData.factory} onChange={handleChange} />
          </div>

          <CurrencyInput label="Price" name="price" value={formData.price} onChange={handleChange} />
          <TextArea label="Description" name="description" value={formData.description} onChange={handleChange} rows={4} />

          <div className="flex space-x-3 pt-4">
            <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium">
              {isSaving ? 'Saving...' : id ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => navigate('/products')} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
