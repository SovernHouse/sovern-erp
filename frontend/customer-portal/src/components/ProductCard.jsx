import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, Eye } from 'lucide-react'
import { formatCurrency } from '../utils/formatters'

export default function ProductCard({ product, onAddToInquiry }) {
  const [isHovered, setIsHovered] = useState(false)

  const handleAddClick = (e) => {
    e.preventDefault()
    if (onAddToInquiry) {
      onAddToInquiry(product)
    }
  }

  return (
    <Link
      to={`/products/${product.id}`}
      className="block h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="card-hover h-full flex flex-col">
        {/* Image Container */}
        <div className="relative h-64 bg-gray-100 overflow-hidden flex items-center justify-center">
          <img
            src={product.image || 'https://images.unsplash.com/photo-1633540531156-c000da1c0f70?w=500&h=500&fit=crop'}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-300 ${
              isHovered ? 'scale-110' : 'scale-100'
            }`}
          />

          {/* Overlay Actions */}
          {isHovered && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-3">
              <button className="p-3 bg-white rounded-full text-primary-600 hover:bg-primary-50 transition-colors shadow-lg">
                <Eye size={20} />
              </button>
              <button
                onClick={handleAddClick}
                className="p-3 bg-accent-500 rounded-full text-white hover:bg-accent-600 transition-colors shadow-lg"
              >
                <ShoppingCart size={20} />
              </button>
            </div>
          )}

          {/* Badge */}
          {product.onSale && (
            <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
              Sale
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col">
          <p className="text-xs text-gray-500 font-medium">{product.category}</p>
          <h3 className="text-sm font-semibold text-gray-900 mt-2 line-clamp-2 mb-3">
            {product.name}
          </h3>

          {/* Specs Preview */}
          <div className="text-xs text-gray-600 space-y-1 mb-4">
            {product.specs?.thickness && (
              <p>Thickness: {product.specs.thickness}mm</p>
            )}
            {product.specs?.width && (
              <p>Width: {product.specs.width}mm</p>
            )}
            {product.specs?.finish && (
              <p>Finish: {product.specs.finish}</p>
            )}
          </div>

          {/* Price Section */}
          <div className="mt-auto">
            {product.onSale && product.originalPrice ? (
              <div className="space-y-1">
                <p className="text-xs line-through text-gray-400">
                  {formatCurrency(product.originalPrice)}
                </p>
                <p className="text-lg font-bold text-accent-600">
                  {formatCurrency(product.price)}
                </p>
                <p className="text-xs text-red-600 font-semibold">
                  {Math.round(
                    ((product.originalPrice - product.price) / product.originalPrice) * 100
                  )}
                  % OFF
                </p>
              </div>
            ) : (
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(product.price)}
              </p>
            )}
            {product.moq && (
              <p className="text-xs text-gray-600 mt-2">MOQ: {product.moq} units</p>
            )}
          </div>
        </div>

        {/* Button */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleAddClick}
            className="w-full py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors text-sm"
          >
            Request Quote
          </button>
        </div>
      </div>
    </Link>
  )
}
