import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import DataTable from '../../components/DataTable'
import SearchBar from '../../components/SearchBar'
import LoadingSpinner from '../../components/LoadingSpinner'
import SkeletonLoader from '@shared/components/SkeletonLoader'
import { productsAPI } from '../../services/api'
import { formatCurrency } from '../../utils/formatters'

export default function ProductList() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchProducts()
  }, [searchQuery])

  const fetchProducts = async () => {
    try {
      const res = await productsAPI.getAll({ search: searchQuery })
      setProducts(res.data || [])
    } catch (error) {
      toast.error('Failed to load products')
    } finally {
      setIsLoading(false)
    }
  }

  const columns = [
    { key: 'name', label: 'Product Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'category', label: 'Category' },
    { key: 'factory', label: 'Factory' },
    {
      key: 'price',
      label: 'Price',
      render: (row) => formatCurrency(row.price),
    },
  ]

  if (isLoading && products.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="w-48 h-8 bg-gray-200 rounded animate-pulse" />
          <div className="w-32 h-10 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="w-48 h-10 bg-gray-200 rounded animate-pulse" />
        </div>
        <SkeletonLoader variant="table" rows={8} columns={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Products</h1>
        <button
          onClick={() => navigate('/products/new')}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          <span>New Product</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <SearchBar onSearch={setSearchQuery} placeholder="Search products..." />
      </div>

      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={products}
          isLoading={isLoading}
          onEdit={(product) => navigate(`/products/${product.id}`)}
          onDelete={() => toast.info('Delete functionality')}
        />
      </div>
    </div>
  )
}
