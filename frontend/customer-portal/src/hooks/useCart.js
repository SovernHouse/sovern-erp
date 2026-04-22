import { useState, useCallback } from 'react'

export const useCart = () => {
  const [items, setItems] = useState([])

  const addItem = useCallback((product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, { product, quantity, specs: {} }]
    })
  }, [])

  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    )
  }, [])

  const removeItem = useCallback((productId) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId))
  }, [])

  const updateItemSpecs = useCallback((productId, specs) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, specs } : item
      )
    )
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const getTotalItems = useCallback(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }, [items])

  const getTotalPrice = useCallback(() => {
    return items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    )
  }, [items])

  const getCartSummary = useCallback(() => {
    return {
      items: items.length,
      units: getTotalItems(),
      subtotal: getTotalPrice(),
      tax: getTotalPrice() * 0.08,
      total: getTotalPrice() * 1.08,
    }
  }, [items, getTotalItems, getTotalPrice])

  return {
    items,
    addItem,
    updateQuantity,
    removeItem,
    updateItemSpecs,
    clearCart,
    getTotalItems,
    getTotalPrice,
    getCartSummary,
  }
}
