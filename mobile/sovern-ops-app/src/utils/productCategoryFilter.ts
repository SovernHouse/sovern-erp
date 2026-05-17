/**
 * Phase 4.5, C21 — flooring-first product category filter (mobile).
 *
 * Mirrors `frontend/admin-portal/src/utils/productCategoryFilter.js`.
 * When this list changes, update both files.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const FLOORING_PRODUCT_TYPES = [
  'lvt',
  'spc',
  'wpc',
  'engineered_spc',
  'hardwood',
  'laminate',
  'ceramic',
  'tile',
  'vinyl',
];

const SHOW_ALL_KEY = 'sovern.productCatalog.showAllCategories';

export function isFlooringProduct(product: { productType?: string | null }): boolean {
  if (!product) return false;
  const t = (product.productType || '').toLowerCase();
  return FLOORING_PRODUCT_TYPES.includes(t);
}

export function filterByFlooring<T extends { productType?: string | null }>(
  products: T[] | undefined,
  showAll: boolean,
): T[] {
  if (showAll) return products || [];
  return (products || []).filter(isFlooringProduct);
}

// React hook. Returns [showAll, setShowAll]. Persists to AsyncStorage.
// Super-admin only; gate the UI on role at the call site.
export function useShowAllCategories(): [boolean, (next: boolean) => void] {
  const [showAll, setShowAllState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SHOW_ALL_KEY)
      .then(v => setShowAllState(v === 'true'))
      .catch(() => { /* first run, no value, default false */ });
  }, []);

  const setShowAll = useCallback((next: boolean) => {
    setShowAllState(next);
    AsyncStorage.setItem(SHOW_ALL_KEY, next ? 'true' : 'false').catch(() => {});
  }, []);

  return [showAll, setShowAll];
}
