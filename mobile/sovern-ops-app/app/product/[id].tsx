// ─── Product detail screen — Phase 4.28q mobile parity ────────────────────
//
// Minimum viable Odoo-style read-only detail page for a Product. Mirrors
// the structure of the existing mobile PriceList detail screen:
//   - Header: name + SKU + brand badge
//   - Meta block: brand / origin / category / unit / lead time
//   - Pricing block: baseFobPrice + originVariants table
//   - Certifications list (if any)
//   - Description / sales description / purchase description blocks
//   - Chatter at bottom (mobile ChatterSection)
//
// CRUD lives on the desktop ERP or via the AI assistant. The mobile
// surface is read-only for now. This screen unlocks the
// PriceList → Product navigation flow Alex flagged on 2026-05-19.

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import {
  getProduct,
  type Product, type ProductOriginVariant,
} from '../../src/services/api';
import ChatterSection from '../../src/components/ChatterSection';
import { COLORS } from '../../src/constants/config';

function fmtMoney(value: any, currency = 'USD') {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${currency} ${n.toFixed(2)}`;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { navigation.setOptions({ title: 'Product' }); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProduct(String(id));
      setProduct(data);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.forest} /></View>;
  }
  if (!product) {
    return <View style={styles.loading}><Text style={{ color: COLORS.muted }}>Product not found.</Text></View>;
  }

  const certs = Array.isArray(product.certifications) ? product.certifications : [];
  const variants: ProductOriginVariant[] = Array.isArray(product.originVariants) ? product.originVariants : [];
  const categoryLabel = typeof product.category === 'string'
    ? product.category
    : product.category?.name || '—';
  const currency = product.currency || 'USD';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      {/* Header */}
      <Text style={styles.h1}>{product.name || '(unnamed)'}</Text>
      <View style={styles.headerSubRow}>
        {product.sku ? <Text style={styles.sku}>{product.sku}</Text> : null}
        {product.brandCode ? <View style={styles.brandBadge}><Text style={styles.brandBadgeText}>{product.brandCode}</Text></View> : null}
        {product.isActive === false ? <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>INACTIVE</Text></View> : null}
      </View>

      {/* Meta block */}
      <View style={styles.metaBlock}>
        <MetaCell label="Category"   value={categoryLabel} />
        <MetaCell label="Brand"      value={product.brandCode || '—'} />
        <MetaCell label="Origin"     value={product.originCountry || '—'} />
        <MetaCell label="Unit"       value={product.unit || '—'} />
        <MetaCell label="MOQ"        value={product.minOrderQty != null ? String(product.minOrderQty) : '—'} />
        <MetaCell label="Lead time"  value={product.leadTimeDays != null ? `${product.leadTimeDays}d` : '—'} />
        <MetaCell label="HS Code"    value={product.hsCode || '—'} />
        <MetaCell label="Base FOB"   value={fmtMoney(product.baseFobPrice, currency)} />
      </View>

      {/* Origin variants table — primary pricing surface for multi-origin SKUs */}
      {variants.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Origin variants</Text>
          <View style={styles.variantsBlock}>
            <View style={styles.variantHeaderRow}>
              <Text style={[styles.variantHeader, { flex: 1 }]}>Origin</Text>
              <Text style={[styles.variantHeader, { width: 80, textAlign: 'right' }]}>FOB</Text>
              <Text style={[styles.variantHeader, { width: 60, textAlign: 'right' }]}>Unit</Text>
              <Text style={[styles.variantHeader, { width: 60, textAlign: 'right' }]}>Lead</Text>
            </View>
            {variants.map((v, idx) => (
              <View key={`${v.originCountry || idx}-${idx}`} style={styles.variantRow}>
                <Text style={[styles.variantCell, { flex: 1 }]}>{v.originCountry || '—'}</Text>
                <Text style={[styles.variantCell, { width: 80, textAlign: 'right' }]}>
                  {v.fobPriceUsd != null ? fmtMoney(v.fobPriceUsd, currency) : '—'}
                </Text>
                <Text style={[styles.variantCell, { width: 60, textAlign: 'right' }]}>{(v as any).priceUnit || '—'}</Text>
                <Text style={[styles.variantCell, { width: 60, textAlign: 'right' }]}>
                  {(v as any).leadTimeOverride != null ? `${(v as any).leadTimeOverride}d` : '—'}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Certifications */}
      {certs.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Certifications</Text>
          <View style={styles.certBlock}>
            {certs.map((c, i) => (
              <View key={`${c.name}-${i}`} style={styles.certPill}>
                <Text style={styles.certText}>{c.name}{c.issuer ? ` · ${c.issuer}` : ''}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Descriptions — sales-facing and purchase-facing kept separate */}
      {product.salesDescription ? (
        <>
          <Text style={styles.sectionTitle}>Sales description</Text>
          <Text style={styles.descText}>{product.salesDescription}</Text>
        </>
      ) : null}
      {product.purchaseDescription ? (
        <>
          <Text style={styles.sectionTitle}>Purchase description</Text>
          <Text style={styles.descText}>{product.purchaseDescription}</Text>
        </>
      ) : null}
      {!product.salesDescription && !product.purchaseDescription && product.description ? (
        <>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descText}>{product.description}</Text>
        </>
      ) : null}

      {/* Chatter */}
      <Text style={styles.sectionTitle}>Chatter</Text>
      <ChatterSection entityType="Product" entityId={String(id)} />
    </ScrollView>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  h1: { fontSize: 22, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  sku: { fontSize: 13, color: COLORS.muted, fontFamily: 'Courier' },
  brandBadge: { backgroundColor: COLORS.forest, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  brandBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
  inactiveBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  inactiveBadgeText: { color: '#b91c1c', fontSize: 11, fontWeight: '700' },
  metaBlock: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  metaCell: { width: '50%', paddingVertical: 6 },
  metaLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  metaValue: { fontSize: 14, color: COLORS.ink, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginBottom: 8, marginTop: 8 },
  variantsBlock: { backgroundColor: 'white', borderRadius: 8, padding: 8, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  variantHeaderRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  variantHeader: { fontSize: 11, color: COLORS.muted, fontWeight: '600', textTransform: 'uppercase' },
  variantRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  variantCell: { fontSize: 13, color: COLORS.ink },
  certBlock: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  certPill: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  certText: { fontSize: 12, color: COLORS.ink },
  descText: { fontSize: 14, color: COLORS.ink, lineHeight: 20, marginBottom: 12 },
});
