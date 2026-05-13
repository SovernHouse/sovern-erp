/**
 * useBrands — Phase 1 Commit 5 (mobile parity for desktop BrandsContext).
 *
 * Loads /api/brands + /api/brands/me on first call and caches in-module so
 * every screen importing the hook hits one shared cache. Refresh by calling
 * `refreshBrands()` after a brand admin edit.
 *
 * Read-only consumers should just `const { brands, getBrand, ... } = useBrands();`
 * and forget about loading state — the hook returns a `loading` flag so the
 * caller can opt into a spinner if needed.
 */

import { useEffect, useState, useCallback } from 'react';
import { listBrands, getMyBrandScope, type Brand, type BrandScope } from '../services/api';

let cache: {
  brands: Brand[];
  byCode: Map<string, Brand>;
  scope: BrandScope;
  loaded: boolean;
  loading: Promise<void> | null;
} = {
  brands: [],
  byCode: new Map(),
  scope: {
    accessibleBrands: ['SH'],
    defaultBrand: 'SH',
    viewMode: 'single',
    isCrossBrand: false,
  },
  loaded: false,
  loading: null,
};

async function loadOnce(): Promise<void> {
  if (cache.loaded) return;
  if (cache.loading) return cache.loading;
  cache.loading = (async () => {
    try {
      const [listRes, meRes] = await Promise.all([listBrands(), getMyBrandScope()]);
      cache.brands = listRes.data ?? [];
      cache.byCode = new Map(cache.brands.map((b) => [b.code, b]));
      cache.scope = meRes.data ?? cache.scope;
      cache.loaded = true;
    } catch (err) {
      console.warn('useBrands load failed:', (err as Error).message);
    } finally {
      cache.loading = null;
    }
  })();
  return cache.loading;
}

export function refreshBrands() {
  cache.loaded = false;
  cache.loading = null;
  return loadOnce();
}

export function useBrands() {
  const [, force] = useState({});
  const [loading, setLoading] = useState(!cache.loaded);

  const reload = useCallback(async () => {
    setLoading(true);
    await refreshBrands();
    setLoading(false);
    force({});
  }, []);

  useEffect(() => {
    if (!cache.loaded) {
      loadOnce().then(() => {
        setLoading(false);
        force({});
      });
    }
  }, []);

  return {
    brands: cache.brands,
    byCode: cache.byCode,
    accessibleBrands: cache.scope.accessibleBrands,
    defaultBrand: cache.scope.defaultBrand,
    viewMode: cache.scope.viewMode,
    isCrossBrand: cache.scope.isCrossBrand,
    loading,
    getBrand: (code: string | null | undefined): Brand | null =>
      (code && cache.byCode.get(code)) || null,
    refresh: reload,
  };
}
