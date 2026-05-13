/**
 * BrandPicker — Phase 1 Commit 4 (D-4). Dropdown used in every new-entity
 * form (Lead / Deal / Quotation / etc.) to confirm the brand context the
 * record will be created under.
 *
 * UX rules from the plan:
 *   - Always pre-filled to the user's `defaultBrand` from BrandsContext.
 *   - Always SHOWN even when the user has access to only one brand.
 *     Visible + disabled rather than hidden — confirms brand is locked in.
 *   - Disabled in edit mode (D-5: brand-locked-at-creation).
 *
 * Usage:
 *   <BrandPicker value={form.brandCode} onChange={(v) => setForm({...form, brandCode: v})} />
 *   <BrandPicker value={lead.brandCode} disabled label="Brand" />
 */

import React from 'react'
import { useBrands } from '../contexts/BrandsContext'
import BrandBadge from './BrandBadge'

export default function BrandPicker({
  value,
  onChange,
  disabled = false,
  label = 'Brand',
  required = true,
  helperText = null,
  style = {},
}) {
  const { accessibleBrands, brands, defaultBrand, loading } = useBrands()

  // Pre-fill the field on mount if it's empty and not in edit mode
  React.useEffect(() => {
    if (!value && !disabled && defaultBrand && onChange) {
      onChange(defaultBrand)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultBrand, disabled])

  const visibleOptions = brands.filter((b) => accessibleBrands.includes(b.code))
  const isSingleBrand = visibleOptions.length <= 1
  const effectiveDisabled = disabled || isSingleBrand || loading

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
          {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          value={value || ''}
          onChange={(e) => onChange && onChange(e.target.value)}
          disabled={effectiveDisabled}
          style={{
            padding: '8px 10px',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontSize: 14,
            background: effectiveDisabled ? '#f8fafc' : 'white',
            color: '#0f172a',
            minWidth: 180,
          }}
        >
          {!value && <option value="">Pick a brand…</option>}
          {visibleOptions.map((b) => (
            <option key={b.code} value={b.code}>
              {b.code} — {b.displayName}
            </option>
          ))}
        </select>
        {value && <BrandBadge code={value} size="md" />}
      </div>
      {helperText && (
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{helperText}</div>
      )}
      {disabled && !isSingleBrand && (
        <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
          Brand is locked at creation. Use a brand override (super admin) to change.
        </div>
      )}
    </div>
  )
}
