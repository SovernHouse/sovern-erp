import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Star, Truck, Shield, RotateCcw } from 'lucide-react'
import { productsAPI } from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import toast from 'react-hot-toast'
import { formatCurrency } from '../../utils/formatters'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  useEffect(() => {
    fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    setLoading(true)
    try {
      const response = await productsAPI.getById(id)
      setProduct(response.data.product)
    } catch (err) {
      console.error('Failed to fetch product:', err)
      toast.error('Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner text="Loading product..." />
      </div>
    )
  }

  if (!product) {
    return (
      <EmptyState
        title="Product not found"
        message="The product you're looking for doesn't exist."
        actionText="Back to Products"
        action={() => navigate('/products')}
      />
    )
  }

  const images = product.images || [
    'https://images.unsplash.com/photo-1633540531156-c000da1c0f70?w=800&h=800&fit=crop',
  ]

  const nextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleAddToQuote = () => {
    navigate('/quotations/request', {
      state: { preSelectedProduct: product, preSelectedQuantity: quantity },
    })
    toast.success('Product added to quotation request')
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <button
          onClick={() => navigate('/products')}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          Products
        </button>
        <span>/</span>
        <span className="text-gray-900 font-medium">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image Gallery */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="relative">
            {/* Main Image */}
            <div className="aspect-square bg-gray-100 relative overflow-hidden">
              <img
                src={images[activeImageIndex]}
                alt={product.name}
                className="w-full h-full object-cover"
              />

              {/* Sale Badge */}
              {product.onSale && (
                <div className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-full font-semibold">
                  Sale
                </div>
              )}

              {/* Navigation */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 p-4 bg-gray-50 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      activeImageIndex === idx
                        ? 'border-primary-600'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Features */}
          <div className="p-6 border-t border-gray-200 grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center text-center">
              <Truck className="text-primary-600 mb-2" size={24} />
              <p className="text-sm font-medium text-gray-900">Free Shipping</p>
              <p className="text-xs text-gray-600">On orders over $500</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <Shield className="text-accent-600 mb-2" size={24} />
              <p className="text-sm font-medium text-gray-900">Warranty</p>
              <p className="text-xs text-gray-600">{product.warranty || '5 years'}</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <RotateCcw className="text-orange-600 mb-2" size={24} />
              <p className="text-sm font-medium text-gray-900">Returns</p>
              <p className="text-xs text-gray-600">30-day money back</p>
            </div>
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="card p-6">
            <p className="text-sm text-primary-600 font-medium">{product.category}</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">{product.name}</h1>

            {/* Rating */}
            <div className="flex items-center gap-2 mt-4">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={i < 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600">(128 reviews)</span>
            </div>

            {/* Description */}
            <p className="text-gray-600 text-sm mt-4">{product.description}</p>

            {/* Pricing */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              {product.onSale && product.originalPrice ? (
                <div className="space-y-2">
                  <p className="text-sm line-through text-gray-400">
                    {formatCurrency(product.originalPrice)}
                  </p>
                  <p className="text-3xl font-bold text-accent-600">
                    {formatCurrency(product.price)}
                  </p>
                  <p className="text-sm font-semibold text-red-600">
                    Save{' '}
                    {formatCurrency(product.originalPrice - product.price)} (
                    {Math.round(
                      ((product.originalPrice - product.price) / product.originalPrice) * 100
                    )}
                    %)
                  </p>
                </div>
              ) : (
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(product.price)}
                </p>
              )}
            </div>

            {/* MOQ */}
            {product.moq && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <p className="font-semibold">Minimum Order Quantity: {product.moq} units</p>
              </div>
            )}
          </div>

          {/* Order Section */}
          <div className="card p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(product.moq || 1, quantity - 1))}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  −
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(product.moq || 1, +e.target.value))}
                  className="flex-1 input-base text-center"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  +
                </button>
              </div>
              {product.moq && quantity < product.moq && (
                <p className="text-xs text-red-600 mt-2">
                  Minimum order is {product.moq} units
                </p>
              )}
            </div>

            <button
              onClick={handleAddToQuote}
              disabled={product.moq && quantity < product.moq}
              className="w-full btn-primary py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Request Quote
            </button>
          </div>

          {/* Lead Time */}
          {product.leadTime && (
            <div className="card p-6 bg-yellow-50 border border-yellow-200">
              <p className="text-sm font-medium text-yellow-900">
                Lead Time: <span className="font-bold">{product.leadTime}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Specifications */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Specifications</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {product.specs &&
              Object.entries(product.specs).map(([key, value]) => (
                <div key={key}>
                  <p className="text-sm font-medium text-gray-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </p>
                  <p className="text-gray-900 font-semibold mt-1">{value}</p>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
