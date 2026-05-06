import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit2 } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import ProductSpecEditor from '../../components/ProductSpecEditor'
import { productsAPI } from '../../services/api'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  useBreadcrumbs(product?.name)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    try {
      const res = await productsAPI.getById(id)
      setProduct(res.data)
    } catch (error) {
      toast.error('Failed to load product')
      navigate('/products')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (!product) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/products')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
        </div>
        <button onClick={() => navigate(`/products/${id}/edit`)} className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Edit2 className="w-4 h-4" />
          <span>Edit</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">SKU</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{product.sku}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Price</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{formatCurrency(product.price)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-600">Category</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">{product.category}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Product Details</h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-slate-600">Description</p>
            <p className="text-slate-900 font-medium">{product.description}</p>
          </div>
          <div>
            <p className="text-slate-600">Factory</p>
            <p className="text-slate-900 font-medium">{product.factory}</p>
          </div>
        </div>
      </div>

      {/* Product Specifications - editable per product */}
      <ProductSpecEditor productId={id} />
    </div>
  )
}
