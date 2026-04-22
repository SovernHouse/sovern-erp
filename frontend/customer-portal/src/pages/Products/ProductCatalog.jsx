import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, X } from 'lucide-react'
import { productsAPI } from '../../services/api'
import ProductCard from '../../components/ProductCard'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import toast from 'react-hot-toast'
import { PRODUCT_CATEGORIES } from '../../utils/constants'

export default function ProductCatalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [priceRange, setPriceRange] = useState([0, 10000])
  const [showFilters, setShowFilters] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchProducts()
  }, [selectedCategory, priceRange])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params = {
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        minPrice: priceRange[0],
        maxPrice: priceRange[1],
      }
      const response = await productsAPI.list(params)
      setProducts(response.data.products || [])
    } catch (err) {
      console.error('Failed to fetch products:', err)
      toast.error('Failed to load products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (term) => {
    setSearchTerm(term)
    if (term.length > 0) {
      setLoading(true)
      try {
        const response = await productsAPI.search(term)
        setProducts(response.data.products || [])
      } catch (err) {
        console.error('Search failed:', err)
        toast.error('Search failed')
      } finally {
        setLoading(false)
      }
    } else {
      fetchProducts()
    }
  }

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1]
    return matchesSearch && matchesCategory && matchesPrice
  })

  const handleAddToInquiry = (product) => {
    toast.success(`${product.name} added to quotation request`)
    navigate('/quotations/request', { state: { preSelectedProduct: product } })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-gray-600 mt-1">
            Browse our flooring products and request quotes
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="lg:hidden btn-secondary inline-flex items-center gap-2"
        >
          <Filter size={18} />
          Filters
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        {/* Search Bar */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="input-base pl-10 w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        <div
          className={`lg:block ${
            showFilters ? 'block' : 'hidden'
          } space-y-6 p-4 lg:p-0 lg:col-span-1`}
        >
          {/* Category Filter */}
          <div className="card p-4 lg:p-0 lg:bg-transparent lg:border-0 lg:shadow-none">
            <div className="flex items-center justify-between mb-4 lg:mb-0">
              <h3 className="font-semibold text-gray-900">Categories</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="lg:hidden p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2 mt-4 lg:mt-0">
              {['All', ...PRODUCT_CATEGORIES].map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`block w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    selectedCategory === category
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Price Filter */}
          <div className="card p-4 lg:p-0 lg:bg-transparent lg:border-0 lg:shadow-none">
            <h3 className="font-semibold text-gray-900 mb-4">Price Range</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min: ${priceRange[0]}
                </label>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={priceRange[0]}
                  onChange={(e) =>
                    setPriceRange([Math.min(+e.target.value, priceRange[1]), priceRange[1]])
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max: ${priceRange[1]}
                </label>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={priceRange[1]}
                  onChange={(e) =>
                    setPriceRange([priceRange[0], Math.max(+e.target.value, priceRange[0])])
                  }
                  className="w-full"
                />
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedCategory('All')
                setPriceRange([0, 10000])
                setSearchTerm('')
              }}
              className="w-full mt-4 btn-secondary text-sm"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex items-center justify-center min-h-96">
              <LoadingSpinner text="Loading products..." />
            </div>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              title="No products found"
              message="Try adjusting your search or filters to find products."
              actionText="View All"
              action={() => {
                setSearchTerm('')
                setSelectedCategory('All')
                setPriceRange([0, 10000])
              }}
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  Showing {filteredProducts.length} product
                  {filteredProducts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToInquiry={handleAddToInquiry}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
