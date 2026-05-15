// BrandFilterPicker — Phase 3, C11 mobile counterpart.
//
// Pill toggle for narrowing the dashboard to a single brand. Hidden for
// single-brand users (no choice to offer). Multi-brand users see the
// pills; super_admin in cross-brand mode gets an additional "All" pill.
//
// Returns the selected brand code via onChange (or 'all' for aggregate).
// Pass to dashboard API calls as a ?brandCode= query param.
//
// Phase 4.6 part 2: memoized Pill + memoized visible list + stable
// per-pill onPress handlers via a useMemo'd Record<code, fn> so only
// the previously-active and newly-active pills re-render on value
// change. Wrapped in React.memo at the export so parents passing a
// stable onChange (useCallback) get a free skip when their other
// state changes.

import { memo, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useBrands } from '../hooks/useBrands';
import { COLORS } from '../constants/config';

type Props = {
  value: string | null;
  onChange: (next: string) => void;
};

function BrandFilterPicker({ value, onChange }: Props) {
  const { accessibleBrands, brands, defaultBrand, isCrossBrand, loading } = useBrands();
  const visible = useMemo(
    () => brands.filter((b) => accessibleBrands.includes(b.code)),
    [brands, accessibleBrands],
  );
  const showAll = isCrossBrand && visible.length > 1;

  // Stable per-code onPress map so the Pill children see referentially
  // equal handlers across re-renders. onAll is its own callback.
  const onAll = useCallback(() => onChange('all'), [onChange]);
  const codeHandlers = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const b of visible) map[b.code] = () => onChange(b.code);
    return map;
  }, [visible, onChange]);

  useEffect(() => {
    if (value || loading) return;
    if (defaultBrand) onChange(defaultBrand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, defaultBrand]);

  if (visible.length <= 1 || loading) return null;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Brand</Text>
      <View style={styles.pillsRow}>
        {showAll && (
          <Pill label="All" active={value === 'all'} onPress={onAll} />
        )}
        {visible.map((b) => (
          <Pill
            key={b.code}
            label={b.code}
            active={value === b.code}
            onPress={codeHandlers[b.code]}
            color={b.primaryColor}
          />
        ))}
      </View>
    </View>
  );
}

export default memo(BrandFilterPicker);

const Pill = memo(function Pill({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.pill,
        active && {
          backgroundColor: color || COLORS.forest,
          borderColor: color || COLORS.forest,
        },
      ]}
    >
      <Text style={[styles.pillText, active && { color: '#FFFFFF' }]}>{label}</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  label:      { fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' },
  pillsRow:   { flexDirection: 'row', gap: 6 },
  pill:       { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  pillText:   { fontSize: 12, fontWeight: '700', color: COLORS.ink },
});
