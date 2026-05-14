// BrandFilterPicker — Phase 3, C11 mobile counterpart.
//
// Pill toggle for narrowing the dashboard to a single brand. Hidden for
// single-brand users (no choice to offer). Multi-brand users see the
// pills; super_admin in cross-brand mode gets an additional "All" pill.
//
// Returns the selected brand code via onChange (or 'all' for aggregate).
// Pass to dashboard API calls as a ?brandCode= query param.

import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useBrands } from '../hooks/useBrands';
import { COLORS } from '../constants/config';

type Props = {
  value: string | null;
  onChange: (next: string) => void;
};

export default function BrandFilterPicker({ value, onChange }: Props) {
  const { accessibleBrands, brands, defaultBrand, isCrossBrand, loading } = useBrands();
  const visible = brands.filter((b) => accessibleBrands.includes(b.code));
  const showAll = isCrossBrand && visible.length > 1;

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
          <Pill label="All" active={value === 'all'} onPress={() => onChange('all')} />
        )}
        {visible.map((b) => (
          <Pill
            key={b.code}
            label={b.code}
            active={value === b.code}
            onPress={() => onChange(b.code)}
            color={b.primaryColor}
          />
        ))}
      </View>
    </View>
  );
}

function Pill({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
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
}

const styles = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  label:      { fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' },
  pillsRow:   { flexDirection: 'row', gap: 6 },
  pill:       { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  pillText:   { fontSize: 12, fontWeight: '700', color: COLORS.ink },
});
