/**
 * BrandsContext — Phase 1 Commit 4 (D-8).
 *
 * Loaded once at app boot via BrandsProvider mounted inside AuthProvider.
 * Fetches /api/brands (org-wide config) and /api/brands/me (this user's
 * brand scope) and exposes:
 *
 *   useBrands() → {
 *     brands,           // [{ code, displayName, primaryColor, accentColor, ... }]
 *     byCode,           // Map<code, brand>
 *     loading,          // boolean
 *     error,            // Error | null
 *
 *     // From /api/brands/me — current user's scope
 *     accessibleBrands, // string[]  what brands this user can see
 *     defaultBrand,     // string    pre-fills BrandPicker
 *     viewMode,         // 'single' | 'cross-brand'
 *     isCrossBrand,     // boolean   only true for super_admin in All Brands tab
 *
 *     // Helpers
 *     getBrand(code),   // brand row or null
 *     refresh(),        // re-pull both endpoints (e.g. after super_admin
 *                       // edits a brand row)
 *   }
 *
 * Skipped when there is no authenticated user yet (login screens etc.).
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

const BrandsContext = createContext(null)

export function BrandsProvider({ children }) {
  const { isAuthenticated } = useAuth()

  const [brands, setBrands] = useState([])
  const [byCode, setByCode] = useState(new Map())
  const [accessibleBrands, setAccessibleBrands] = useState(['SH'])
  const [defaultBrand, setDefaultBrand] = useState('SH')
  const [viewMode, setViewMode] = useState('single')
  const [isCrossBrand, setIsCrossBrand] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setError(null)
    try {
      const [listRes, meRes] = await Promise.all([
        api.get('/brands'),
        api.get('/brands/me'),
      ])
      // api.js interceptor auto-unwraps { success, data } envelopes, so
      // res.data is the payload directly. Tolerate both unwrapped and
      // raw shapes (2026-05-18 bugfix — the .data?.data read was always
      // returning undefined, which left brands=[] and forced every
      // BrandPicker into the disabled "single-brand" state + every
      // BrandBadge into the "UNKNOWN BRAND" fallback).
      const rawList = listRes.data
      const list = Array.isArray(rawList)
        ? rawList
        : (Array.isArray(rawList?.data) ? rawList.data : [])
      setBrands(list)
      const map = new Map()
      for (const b of list) map.set(b.code, b)
      setByCode(map)

      const rawMe = meRes.data
      const me = (rawMe && typeof rawMe === 'object' && rawMe.data && typeof rawMe.data === 'object')
        ? rawMe.data
        : (rawMe || {})
      if (Array.isArray(me.accessibleBrands) && me.accessibleBrands.length) {
        setAccessibleBrands(me.accessibleBrands)
      }
      if (me.defaultBrand) setDefaultBrand(me.defaultBrand)
      if (me.viewMode) setViewMode(me.viewMode)
      setIsCrossBrand(!!me.isCrossBrand)
    } catch (err) {
      setError(err)
      // Fail soft: keep [SH] defaults so app is usable even if /api/brands is down.
      // eslint-disable-next-line no-console
      console.warn('BrandsContext load failed:', err.message)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { load() }, [load])

  const getBrand = useCallback((code) => byCode.get(code) || null, [byCode])

  const value = {
    brands,
    byCode,
    accessibleBrands,
    defaultBrand,
    viewMode,
    isCrossBrand,
    loading,
    error,
    getBrand,
    refresh: load,
  }

  return <BrandsContext.Provider value={value}>{children}</BrandsContext.Provider>
}

export function useBrands() {
  const ctx = useContext(BrandsContext)
  if (!ctx) {
    // Outside provider — safe defaults so pre-auth pages don't crash.
    return {
      brands: [],
      byCode: new Map(),
      accessibleBrands: ['SH'],
      defaultBrand: 'SH',
      viewMode: 'single',
      isCrossBrand: false,
      loading: false,
      error: null,
      getBrand: () => null,
      refresh: () => {},
    }
  }
  return ctx
}
