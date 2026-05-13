/**
 * BrandBadge — Phase 1 Commit 4. Colored pill rendering the brand context
 * for any record. Reads colors from BrandsContext (D-8) so adding a third
 * brand is config-only: insert a Brand row, restart, done.
 *
 * Usage:
 *   <BrandBadge code={lead.brandCode} size="md" />
 *   <BrandBadge code="SH" size="sm" />
 *   <BrandBadge code={customer.brandRelationships?.[0]} size="lg" />  // multi-brand
 *
 * The "Make it visually impossible to miss" requirement (spec) means the
 * default size is bold + chunky. Use size="sm" only for table rows.
 */

import React from 'react'
import { useBrands } from '../contexts/BrandsContext'

const SIZES = {
  sm: { padding: '2px 8px',  fontSize: 11, fontWeight: 600, letterSpacing: 0.5 },
  md: { padding: '4px 12px', fontSize: 13, fontWeight: 700, letterSpacing: 0.6 },
  lg: { padding: '6px 16px', fontSize: 15, fontWeight: 700, letterSpacing: 0.8 },
}

const FALLBACK = {
  primaryColor: '#475569',
  accentColor:  '#FFFFFF',
  displayName:  'Unknown brand',
}

export default function BrandBadge({ code, size = 'md', showLabel = true, style = {} }) {
  const { getBrand } = useBrands()
  if (!code) return null

  const brand = getBrand(code) || FALLBACK
  const sz = SIZES[size] || SIZES.md

  return (
    <span
      title={brand.displayName}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        backgroundColor: brand.primaryColor,
        color: brand.accentColor,
        borderRadius: 4,
        textTransform: 'uppercase',
        ...sz,
        ...style,
      }}
    >
      {code}{showLabel && size !== 'sm' ? ` · ${brand.displayName}` : ''}
    </span>
  )
}

/**
 * BrandBadgeGroup — render multiple badges side-by-side for Customer.brandRelationships.
 */
export function BrandBadgeGroup({ codes, size = 'md', gap = 6, style = {} }) {
  if (!Array.isArray(codes) || codes.length === 0) return null
  return (
    <span style={{ display: 'inline-flex', gap, alignItems: 'center', ...style }}>
      {codes.map((c) => <BrandBadge key={c} code={c} size={size} showLabel={false} />)}
    </span>
  )
}
