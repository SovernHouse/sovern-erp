/**
 * BrandFilterPicker — Phase 3, C11.
 *
 * Top-of-page filter for dashboards / reports. Different from BrandPicker:
 *   - Used to NARROW reporting data, not to lock the brand on a new entity.
 *   - Allows an "All Brands" option for super_admin in cross-brand viewMode.
 *   - Hidden entirely when the user has access to only one brand (no choice
 *     to offer; the backend will scope automatically).
 *   - Persists selection to localStorage so the user's last choice survives
 *     page reload.
 *
 * Returns the selected brand code via onChange (or 'all' for the aggregate
 * super_admin view). Pass the returned value into the dashboard's API
 * requests as a `?brandCode=` query param. The backend dropFilter ignores
 * `?brandCode=all`.
 *
 * Usage:
 *   const [brandCode, setBrandCode] = useState(null)
 *   <BrandFilterPicker value={brandCode} onChange={setBrandCode} />
 *   useEffect(() => { fetchDashboard({brandCode: brandCode === 'all' ? undefined : brandCode}) }, [brandCode])
 */

import React, { useEffect } from 'react'
import { useBrands } from '../contexts/BrandsContext'
import BrandBadge from './BrandBadge'

const LS_KEY = 'sovern.brandFilterPicker.value'

export default function BrandFilterPicker({ value, onChange, label = 'Brand' }) {
  const { accessibleBrands, brands, defaultBrand, isCrossBrand, loading } = useBrands()

  const visibleOptions = brands.filter((b) => accessibleBrands.includes(b.code))
  const isSingleBrand = visibleOptions.length <= 1
  // Phase 4.20: surface the "All Brands" option for any user with multi-brand access,
  // not just super_admin in explicit cross-brand viewMode. Selecting "all" sends no
  // ?brandCode= to the backend; brandWhere() then falls through to scope.where which
  // is the user's accessibleBrands IN-clause — so a non-super-admin multi-brand user
  // is still scoped to their accessible brands, just unioned across them.
  const allBrandsOption = visibleOptions.length > 1

  // Initialize from localStorage or defaultBrand, ONCE on mount.
  useEffect(() => {
    if (value || loading) return
    const persisted = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null
    if (persisted && (persisted === 'all' || visibleOptions.some((b) => b.code === persisted))) {
      onChange && onChange(persisted)
    } else if (defaultBrand) {
      onChange && onChange(defaultBrand)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, defaultBrand])

  const handleChange = (next) => {
    if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, next)
    onChange && onChange(next)
  }

  // Single-brand user: don't render anything. Backend scopes server-side.
  if (isSingleBrand) return null
  if (loading) return null

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {label && (
        <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</span>
      )}
      <select
        value={value || ''}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          padding: '6px 10px',
          border: '1px solid #cbd5e1',
          borderRadius: 6,
          fontSize: 13,
          background: 'white',
          color: '#0f172a',
          minWidth: 170,
        }}
      >
        {allBrandsOption && <option value="all">All Brands  ·  aggregate</option>}
        {visibleOptions.map((b) => (
          <option key={b.code} value={b.code}>
            {b.code}  {b.displayName}
          </option>
        ))}
      </select>
      {value && value !== 'all' && <BrandBadge code={value} size="sm" />}
    </div>
  )
}
