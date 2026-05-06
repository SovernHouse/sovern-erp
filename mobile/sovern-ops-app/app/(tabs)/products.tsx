// ─── Products Screen ──────────────────────────────────────────────────────
// Catalog with pricing breakdown, commercial specs, and supplier/client split.
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native';
import { getProducts, getProduct, type Product, type ProductPrice } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

// ─── Helpers ─────────────────────────────────────────────────────────────

function getActivePrice(prices?: ProductPrice[]): ProductPrice | null {
  if (!prices || prices.length === 0) return null;
  return prices.find(p => p.isActive) ?? prices[0];
}

function categoryName(cat: Product['category']): string {
  if (!cat) return '';
  if (typeof cat === 'string') return cat;
  return cat.name;
}

// ─── Product Row ──────────────────────────────────────────────────────────

function ProductRow({ product, onPress }: { product: Product; onPress: () => void }) {
  const activePrice = getActivePrice(product.prices);
  const factory = product.factory?.companyName;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowBody}>
        <Text style={styles.name}>{product.name}</Text>
        {product.sku ? <Text style={styles.meta}>SKU: {product.sku}</Text> : null}
        {factory ? <Text style={styles.factory}>{factory}</Text> : null}
        {categoryName(product.category) ? <Text style={styles.category}>{categoryName(product.category)}</Text> : null}
      </View>
      {activePrice ? (
        <View style={styles.priceBox}>
          <Text style={styles.priceLabel}>{activePrice.priceType} buy</Text>
          <Text style={styles.fobPrice}>
            {activePrice.currency} {Number(activePrice.costPrice).toFixed(2)}
          </Text>
          <Text style={styles.sellPrice}>
            Sell: {Number(activePrice.sellingPrice).toFixed(2)}
          </Text>
          {product.unit ? <Text style={styles.unitText}>/{product.unit}</Text> : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Detail Row ───────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value?: string | number | null | boolean }) {
  if (value == null || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{display}</Text>
    </View>
  );
}

// ─── Product Detail Modal ─────────────────────────────────────────────────

function ProductDetailModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProduct(productId)
      .then(setProduct)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [productId]);

  const prices = product?.prices ?? [];
  const activePrices = prices.filter(p => p.isActive);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={2}>
            {loading ? 'Loading…' : (product?.name ?? 'Product')}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.forest} />
        ) : product ? (
          <ScrollView contentContainerStyle={styles.detailScroll}>

            {/* Basic Info */}
            <Text style={styles.sectionTitle}>Product Info</Text>
            <DetailRow label="SKU" value={product.sku} />
            <DetailRow label="Category" value={categoryName(product.category)} />
            <DetailRow label="Primary Supplier" value={product.factory?.companyName} />
            <DetailRow label="Unit" value={product.unit} />
            <DetailRow label="HS Code" value={product.hsCode} />
            <DetailRow label="Min Order Qty" value={product.minOrderQty != null ? `${product.minOrderQty} ${product.unit ?? ''}`.trim() : null} />

            {/* Pricing */}
            {prices.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Pricing</Text>
                {prices.map(p => (
                  <View key={p.id} style={[styles.priceCard, !p.isActive && styles.priceCardInactive]}>
                    <View style={styles.priceCardHeader}>
                      <Text style={styles.priceCardSupplier}>
                        {p.factory?.companyName ?? 'Supplier'}
                      </Text>
                      <View style={[styles.badge, p.isActive ? styles.badgeActive : styles.badgeInactive]}>
                        <Text style={[styles.badgeText, p.isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.priceCardRows}>
                      <View style={styles.priceCardCell}>
                        <Text style={styles.priceCardLabel}>{p.priceType} (Buy)</Text>
                        <Text style={styles.priceCardFob}>{p.currency} {Number(p.costPrice).toFixed(2)}</Text>
                      </View>
                      {p.exwPrice ? (
                        <View style={styles.priceCardCell}>
                          <Text style={styles.priceCardLabel}>EXW</Text>
                          <Text style={styles.priceCardVal}>{p.currency} {Number(p.exwPrice).toFixed(2)}</Text>
                        </View>
                      ) : null}
                      <View style={styles.priceCardCell}>
                        <Text style={styles.priceCardLabel}>Margin</Text>
                        <Text style={styles.priceCardVal}>{p.markup}%</Text>
                      </View>
                      <View style={styles.priceCardCell}>
                        <Text style={styles.priceCardLabel}>Sell Price</Text>
                        <Text style={styles.priceCardSell}>{p.currency} {Number(p.sellingPrice).toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Sales Description (client-facing) */}
            {product.salesDescription ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Sales Description</Text>
                <View style={styles.descBox}>
                  <Text style={styles.descBadge}>Client-facing · shown on quotations</Text>
                  <Text style={styles.descText}>{product.salesDescription}</Text>
                </View>
              </>
            ) : null}

            {/* Internal description */}
            {product.description ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Internal Notes</Text>
                <View style={styles.descBox}>
                  <Text style={styles.descText}>{product.description}</Text>
                </View>
              </>
            ) : null}

          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>Product not found.</Text>
        )}
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await getProducts({ page: 1, limit: 100 });
      setProducts(res.data);
      setFiltered(res.data);
    } catch (err: any) {
      console.error('Products load error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.sku ?? '').toLowerCase().includes(q) ||
            categoryName(p.category).toLowerCase().includes(q) ||
            (p.factory?.companyName ?? '').toLowerCase().includes(q)
          )
        : products
    );
  }, [search, products]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, SKU, supplier, category…"
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      <Text style={styles.count}>
        {filtered.length} product{filtered.length !== 1 ? 's' : ''}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductRow product={item} onPress={() => setSelectedId(item.id)} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forest} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products found.</Text>
          </View>
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyFlex : undefined}
      />

      {selectedId ? (
        <ProductDetailModal productId={selectedId} onClose={() => setSelectedId(null)} />
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.cream },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },
  searchBar:   { margin: 12, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12 },
  searchInput: { height: 40, color: COLORS.ink, fontSize: 14 },
  count:       { paddingHorizontal: 16, paddingBottom: 4, fontSize: 12, color: COLORS.muted },

  row:      { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 12 },
  rowBody:  { flex: 1 },
  name:     { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  meta:     { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  factory:  { fontSize: 12, color: COLORS.ink, marginTop: 2, fontWeight: '500' },
  category: { fontSize: 12, color: COLORS.forest, marginTop: 2 },

  priceBox:      { alignItems: 'flex-end', marginLeft: 12, minWidth: 90 },
  priceLabel:    { fontSize: 10, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  fobPrice:      { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginTop: 2 },
  sellPrice:     { fontSize: 12, color: COLORS.forest, fontWeight: '600', marginTop: 1 },
  unitText:      { fontSize: 11, color: COLORS.muted },

  separator: { height: 1, backgroundColor: COLORS.border },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyFlex: { flex: 1 },
  emptyText: { color: COLORS.muted, fontSize: 14 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.cream },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.forest,
    paddingHorizontal: 16, paddingVertical: 14, paddingTop: 52,
  },
  modalTitle:   { flex: 1, color: COLORS.white, fontSize: 17, fontWeight: '700' },
  closeBtn:     { marginLeft: 12, padding: 4 },
  closeBtnText: { color: COLORS.white, fontSize: 20 },
  detailScroll: { padding: 16, paddingBottom: 40 },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailLabel: { fontSize: 13, color: COLORS.muted, flex: 1 },
  detailValue: { fontSize: 13, color: COLORS.ink, fontWeight: '500', flex: 2, textAlign: 'right' },

  // Price cards
  priceCard: {
    backgroundColor: COLORS.white, borderRadius: 10, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  priceCardInactive: { opacity: 0.55 },
  priceCardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  priceCardSupplier: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  priceCardRows:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceCardCell:     { minWidth: '45%', flex: 1 },
  priceCardLabel:    { fontSize: 11, color: COLORS.muted, marginBottom: 2 },
  priceCardFob:      { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  priceCardSell:     { fontSize: 15, fontWeight: '700', color: COLORS.forest },
  priceCardVal:      { fontSize: 14, fontWeight: '500', color: COLORS.ink },

  badge:            { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeActive:      { backgroundColor: '#dcfce7' },
  badgeInactive:    { backgroundColor: '#f1f5f9' },
  badgeText:        { fontSize: 11, fontWeight: '600' },
  badgeTextActive:  { color: '#16a34a' },
  badgeTextInactive:{ color: '#64748b' },

  descBox:   { backgroundColor: COLORS.white, borderRadius: 8, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border },
  descBadge: { fontSize: 11, color: COLORS.forest, marginBottom: 6, fontWeight: '500' },
  descText:  { fontSize: 13, color: COLORS.ink, lineHeight: 20 },
});
