/**
 * BrandBadge (mobile) — Phase 1 Commit 5. Colored pill rendering the brand
 * context for any record. Reads colors from useBrands cache so adding a third
 * brand is config-only.
 *
 *   <BrandBadge code={lead.brandCode} size="md" />
 *   <BrandBadge code="FW" size="sm" />
 *
 * BrandBadgeGroup renders multiple codes side-by-side for the Customer
 * brandRelationships array.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useBrands } from '../hooks/useBrands';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { padH: number; padV: number; fontSize: number }> = {
  sm: { padH: 6, padV: 2, fontSize: 10 },
  md: { padH: 10, padV: 4, fontSize: 12 },
  lg: { padH: 14, padV: 6, fontSize: 14 },
};

const FALLBACK = { primaryColor: '#475569', accentColor: '#FFFFFF', displayName: 'Unknown' };

export function BrandBadge({
  code,
  size = 'md',
  showLabel = true,
}: {
  code: string | null | undefined;
  size?: Size;
  showLabel?: boolean;
}) {
  const { getBrand } = useBrands();
  if (!code) return null;

  const brand = getBrand(code) || FALLBACK;
  const sz = SIZES[size];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: brand.primaryColor,
        paddingHorizontal: sz.padH,
        paddingVertical: sz.padV,
        borderRadius: 4,
      }}
    >
      <Text
        style={{
          color: brand.accentColor,
          fontSize: sz.fontSize,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {code}
        {showLabel && size !== 'sm' ? ` · ${brand.displayName}` : ''}
      </Text>
    </View>
  );
}

export function BrandBadgeGroup({
  codes,
  size = 'md',
  gap = 6,
}: {
  codes: string[] | null | undefined;
  size?: Size;
  gap?: number;
}) {
  if (!Array.isArray(codes) || codes.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', gap, alignItems: 'center', flexWrap: 'wrap' }}>
      {codes.map((c) => (
        <BrandBadge key={c} code={c} size={size} showLabel={false} />
      ))}
    </View>
  );
}
