import { Star, Folder, Package, FileText, DollarSign, User, Truck, X } from 'lucide-react'
import { useState } from 'react'
import { getFavorites, removeFavorite } from '../hooks/useFavorites'

/**
 * Favorites - Star/pin icon component and favorites sidebar
 */
export default function Favorites() {
  const [showDropdown, setShowDropdown] = useState(false)
  const [favorites, setFavorites] = useState(getFavorites())

  const handleRemove = (type, id) => {
    if (removeFavorite(type, id)) {
      setFavorites(getFavorites())
    }
  }

  // Get icon for entity type
  const getEntityIcon = (type) => {
    const iconMap = {
      order: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
      customer: { icon: User, color: 'text-purple-600', bg: 'bg-purple-50' },
      product: { icon: Package, color: 'text-green-600', bg: 'bg-green-50' },
      invoice: { icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      shipment: { icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50' },
      quote: { icon: Folder, color: 'text-indigo-600', bg: 'bg-indigo-50' }
    }

    return iconMap[type] || { icon: Folder, color: 'text-slate-600', bg: 'bg-slate-50' }
  }

  return (
    <div className="relative">
      {/* Favorites Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        title="Favorites"
      >
        <Star className="w-5 h-5 text-slate-600 hover:text-amber-500" />
        {favorites.length > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
            {Math.min(favorites.length, 9)}
          </span>
        )}
      </button>

      {/* Favorites Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg border border-slate-200 shadow-lg z-50">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-lg">
            <h3 className="font-semibold text-slate-900">Favorites</h3>
            <p className="text-xs text-slate-600 mt-1">{favorites.length}/{20} items</p>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {favorites.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {favorites.map((fav) => {
                  const entityIcon = getEntityIcon(fav.type)
                  const Icon = entityIcon.icon

                  return (
                    <div
                      key={`${fav.type}-${fav.id}`}
                      className={`p-3 hover:bg-slate-50 transition-colors flex items-start space-x-3 ${entityIcon.bg}`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${entityIcon.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{fav.name}</p>
                        <p className="text-xs text-slate-600 capitalize">{fav.type}</p>
                      </div>
                      <button
                        onClick={() => handleRemove(fav.type, fav.id)}
                        className="p-1 hover:bg-white rounded transition-colors flex-shrink-0"
                        title="Remove from favorites"
                      >
                        <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Star className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-600">No favorites yet</p>
                <p className="text-xs text-slate-500 mt-1">Star items to save them here</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {favorites.length > 0 && (
            <div className="p-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                View All Favorites →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * FavoriteButton - Small button to add/remove from favorites
 */
export function FavoriteButton({ type, id, name, size = 'sm', isStarred = false, onToggle }) {
  const [starred, setStarred] = useState(isStarred)

  const handleClick = () => {
    setStarred(!starred)
    onToggle?.(!starred)
  }

  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  return (
    <button
      onClick={handleClick}
      className={`transition-colors ${
        starred
          ? 'text-amber-500 hover:text-amber-600'
          : 'text-slate-400 hover:text-amber-500'
      }`}
      title={starred ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star
        className={sizes[size]}
        fill={starred ? 'currentColor' : 'none'}
      />
    </button>
  )
}
