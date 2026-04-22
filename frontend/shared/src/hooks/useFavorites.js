/**
 * useFavorites Hook - Manage favorite entities
 */

const FAVORITES_STORAGE_KEY = 'appFavorites'
const MAX_FAVORITES = 20

/**
 * Get all favorites from localStorage
 */
export const getFavorites = () => {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to get favorites:', error)
    return []
  }
}

/**
 * Add a favorite
 * @param {string} type - Entity type (order, customer, product, invoice, etc.)
 * @param {string|number} id - Entity ID
 * @param {string} name - Entity name for display
 * @param {string} icon - Optional icon name from lucide-react
 * @returns {boolean} Success status
 */
export const addFavorite = (type, id, name, icon = 'Star') => {
  try {
    const favorites = getFavorites()

    // Check if already favorited
    if (favorites.some(fav => fav.type === type && fav.id === id)) {
      return false
    }

    // Check max limit
    if (favorites.length >= MAX_FAVORITES) {
      console.warn(`Maximum favorites (${MAX_FAVORITES}) reached`)
      return false
    }

    const newFavorite = {
      type,
      id,
      name,
      icon,
      addedAt: new Date().toISOString()
    }

    favorites.push(newFavorite)
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
    return true
  } catch (error) {
    console.error('Failed to add favorite:', error)
    return false
  }
}

/**
 * Remove a favorite
 * @param {string} type - Entity type
 * @param {string|number} id - Entity ID
 * @returns {boolean} Success status
 */
export const removeFavorite = (type, id) => {
  try {
    const favorites = getFavorites()
    const filtered = favorites.filter(fav => !(fav.type === type && fav.id === id))

    if (filtered.length === favorites.length) {
      return false // Not found
    }

    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(filtered))
    return true
  } catch (error) {
    console.error('Failed to remove favorite:', error)
    return false
  }
}

/**
 * Check if entity is favorited
 * @param {string} type - Entity type
 * @param {string|number} id - Entity ID
 * @returns {boolean} Is favorited
 */
export const isFavorite = (type, id) => {
  const favorites = getFavorites()
  return favorites.some(fav => fav.type === type && fav.id === id)
}

/**
 * Get favorites of a specific type
 * @param {string} type - Entity type
 * @returns {array} Favorites of that type
 */
export const getFavoritesByType = (type) => {
  const favorites = getFavorites()
  return favorites.filter(fav => fav.type === type)
}

/**
 * Clear all favorites
 */
export const clearAllFavorites = () => {
  try {
    localStorage.removeItem(FAVORITES_STORAGE_KEY)
    return true
  } catch (error) {
    console.error('Failed to clear favorites:', error)
    return false
  }
}
