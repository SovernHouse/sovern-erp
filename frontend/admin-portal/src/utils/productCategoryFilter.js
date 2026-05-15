/**
 * Phase 4.5, C21 — flooring-first product category filter.
 *
 * Sovern House's core trade is flooring. The Product schema supports other
 * verticals (auto parts, garments, services, consulting) but the operating
 * catalog defaults to flooring types only. A super-admin toggle reveals
 * the long tail.
 *
 * Used by both the admin catalog (`Settings/ProductCatalog`) and the
 * quotation line-item picker. The mobile app has a parallel helper at
 * `mobile/sovern-ops-app/src/utils/productCategoryFilter.ts`.
 */

import { useEffect, useState } from 'react'

// productType enum values considered flooring. Mirror to the mobile helper
// when this list changes.
export const FLOORING_PRODUCT_TYPES = [
  'lvt',
  'spc',
  'wpc',
  'hardwood',
  'laminate',
  'ceramic',
  'tile',
  'vinyl',
]

// localStorage key for the "show all categories" toggle (super-admin only).
// Lives on a per-browser basis, no server round-trip.
const SHOW_ALL_KEY = 'sovern.productCatalog.showAllCategories'

export function isFlooringProduct(product) {
  if (!product) return false
  const t = (product.productType || '').toLowerCase()
  return FLOORING_PRODUCT_TYPES.includes(t)
}

// Filter helper used by both the catalog table and the quotation picker.
// When showAll=true (the toggle is on, super-admin), passes everything
// through. When false, keeps only rows whose productType matches the
// flooring list. Null or unknown productType rows are HIDDEN by default
// since Sovern's operating catalog is flooring; seeded rows with NULL
// productType only resurface when "Show all categories" is on.
export function filterByFlooring(products, showAll) {
  if (showAll) return products || []
  return (products || []).filter(isFlooringProduct)
}

// React hook for the toggle. Returns [showAll, setShowAll]. Persists to
// localStorage so the choice survives reloads. Super-admin only; callers
// gate the UI on role.
export function useShowAllCategories() {
  const [showAll, setShowAll] = useState(() => {
    try {
      return localStorage.getItem(SHOW_ALL_KEY) === 'true'
    } catch (_) {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_ALL_KEY, showAll ? 'true' : 'false')
    } catch (_) { /* private mode etc.; non-fatal */ }
  }, [showAll])

  return [showAll, setShowAll]
}
