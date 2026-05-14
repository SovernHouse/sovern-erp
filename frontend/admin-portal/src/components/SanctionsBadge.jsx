/**
 * SanctionsBadge — Phase 4, C18. Visual indicator of a customer's (or
 * lead's) sanctions screening state. Five variants:
 *
 *   - cleared           : green, "Cleared"
 *   - pending           : gray,  "Not screened"
 *   - requires_review   : amber, "Requires review"
 *   - flagged           : red,   "Sanctions hit"   (paired with override button)
 *   - override          : orange,"Override on file" (super-admin attestation)
 *
 * Designed for compact placement next to BrandBadge on detail headers.
 * Pass `size="sm"` for table rows.
 */

import React from 'react';

const SIZES = {
  sm: { padding: '2px 8px',  fontSize: 11, fontWeight: 600, letterSpacing: 0.5 },
  md: { padding: '4px 12px', fontSize: 12, fontWeight: 700, letterSpacing: 0.6 },
};

const VARIANTS = {
  cleared:         { bg: '#DCFCE7', fg: '#166534', label: 'Cleared',         dot: '#10B981' },
  pending:         { bg: '#F3F4F6', fg: '#4B5563', label: 'Not screened',    dot: '#9CA3AF' },
  requires_review: { bg: '#FEF3C7', fg: '#92400E', label: 'Requires review', dot: '#F59E0B' },
  flagged:         { bg: '#FEE2E2', fg: '#991B1B', label: 'Sanctions hit',   dot: '#DC2626' },
  override:        { bg: '#FFEDD5', fg: '#9A3412', label: 'Override on file',dot: '#EA580C' },
};

export default function SanctionsBadge({ status, size = 'md', title, style = {} }) {
  if (!status) return null;
  const variant = VARIANTS[status] || VARIANTS.pending;
  const sz = SIZES[size] || SIZES.md;
  return (
    <span
      title={title || variant.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: variant.bg,
        color: variant.fg,
        padding: sz.padding,
        fontSize: sz.fontSize,
        fontWeight: sz.fontWeight,
        letterSpacing: sz.letterSpacing,
        borderRadius: 4,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: variant.dot, flexShrink: 0,
      }} />
      {variant.label}
    </span>
  );
}
