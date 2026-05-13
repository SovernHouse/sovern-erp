// ─── Brands Screen (read-only) ────────────────────────────────────────────
// Shows active brand configuration: identity, sender email, colors.
// Edit capability lives on desktop (Settings > Brands) — HTML signature
// editing on mobile is intentionally not supported.

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { useBrands } from '../src/hooks/useBrands';
import { BrandBadge } from '../src/components/BrandBadge';
import { COLORS } from '../src/constants/config';

function ColorSwatch({ color, label }: { color?: string; label: string }) {
  if (!color) return null;
  return (
    <View style={styles.swatchRow}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.swatchLabel}>{label}</Text>
      <Text style={styles.swatchValue}>{color}</Text>
    </View>
  );
}

function BrandCard({ code }: { code: string }) {
  const { getBrand } = useBrands();
  const brand = getBrand(code);
  if (!brand) return null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <BrandBadge code={code} size="md" />
        {!brand.active && (
          <View style={styles.inactivePill}>
            <Text style={styles.inactivePillText}>Inactive</Text>
          </View>
        )}
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Display Name</Text>
        <Text style={styles.fieldValue}>{brand.displayName}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Sender Email</Text>
        <Text style={styles.fieldValue}>{brand.senderEmail}</Text>
      </View>
      <View style={styles.divider} />

      <View style={styles.colorsBlock}>
        <Text style={styles.colorsTitle}>Colors</Text>
        <ColorSwatch color={brand.primaryColor} label="Primary" />
        <ColorSwatch color={brand.accentColor} label="Accent" />
      </View>

      {brand.footerLegalText ? (
        <>
          <View style={styles.divider} />
          <View style={styles.legalBlock}>
            <Text style={styles.fieldLabel}>Footer Legal</Text>
            <Text style={styles.legalText}>{brand.footerLegalText}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function BrandsScreen() {
  const navigation = useNavigation();
  const { brands, loading } = useBrands();

  useEffect(() => {
    navigation.setOptions({ title: 'Brands' });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Brands control sender identity and colors. Edit brand config in Settings on desktop.
      </Text>
      {brands.map(brand => (
        <BrandCard key={brand.code} code={brand.code} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },

  hint: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 16,
    lineHeight: 18,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  inactivePill: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  inactivePillText: { fontSize: 11, color: '#B91C1C', fontWeight: '600' },

  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  fieldLabel: { fontSize: 13, color: COLORS.muted },
  fieldValue: { fontSize: 13, color: COLORS.ink, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  divider: { height: 1, backgroundColor: COLORS.border },

  colorsBlock: { paddingTop: 10 },
  colorsTitle: { fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  swatch: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  swatchLabel: { fontSize: 13, color: COLORS.muted, flex: 1 },
  swatchValue: { fontSize: 12, color: COLORS.ink, fontFamily: 'monospace' },

  legalBlock: { paddingTop: 10 },
  legalText: { fontSize: 12, color: COLORS.muted, lineHeight: 18, marginTop: 4 },
});
