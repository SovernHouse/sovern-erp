// ─── Products Screen ──────────────────────────────────────────────────────
// Read-only catalog: search, browse SKUs, view specs on tap.
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native';
import { getProducts, getProduct, type Product } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

// ─── Product Row ──────────────────────────────────────────────────────────

function ProductRow({ product, onPress }: { product: Product; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowBody}>
        <Text style={styles.name}>{product.name}</Text>
        {product.sku ? (
          <Text style={styles.sku}>SKU: {product.sku}</Text>
        ) : null}
        {product.category ? (
          <Text style={styles.category}>{product.category}</Text>
        ) : null}
      </View>
      {product.unitPrice != null ? (
        <View style={styles.priceBox}>
          <Text style={styles.price}>
            {product.currency ?? 'USD'} {Number(product.unitPrice).toFixed(2)}
          </Text>
          {product.unit ? (
            <Text style={styles.unit}>/{product.unit}</Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
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

  function row(label: string, value?: string | number | null) {
    if (value == null || value === '') return null;
    return (
      <View style={styles.detailRow} key={label}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{String(value)}</Text>
      </View>
    );
  }

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
            {row('SKU', product.sku)}
            {row('Category', product.category)}
            {row('Unit Price', product.unitPrice != null
              ? `${product.currency ?? 'USD'} ${Number(product.unitPrice).toFixed(2)}${product.unit ? ' / ' + product.unit : ''}`
              : null
            )}
            {row('MOQ', product.moq != null ? `${product.moq} ${product.unit ?? 'units'}` : null)}
            {row('Lead Time', product.leadTime)}
            {row('Status', product.status)}
            {product.description ? (
              <View style={styles.descBox}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.descText}>{product.description}</Text>
              </View>
            ) : null}
            {product.specifications && Object.keys(product.specifications).length > 0 ? (
              <View style={styles.specsSection}>
                <Text style={styles.specsSectionTitle}>Specifications</Text>
                {Object.entries(product.specifications).map(([k, v]) => row(k, v))}
              </View>
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
        ? products.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.sku ?? '').toLowerCase().includes(q) ||
              (p.category ?? '').toLowerCase().includes(q)
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
      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, SKU, or category…"
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      {/* Count */}
      <Text style={styles.count}>
        {filtered.length} product{filtered.length !== 1 ? 's' : ''}
      </Text>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductRow product={item} onPress={() => setSelectedId(item.id)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={COLORS.forest}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products found.</Text>
          </View>
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyFlex : undefined}
      />

      {/* Detail Modal */}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowBody:  { flex: 1 },
  name:     { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  sku:      { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  category: { fontSize: 12, color: COLORS.forest, marginTop: 2 },
  priceBox: { alignItems: 'flex-end', marginLeft: 8 },
  price:    { fontSize: 14, fontWeight: '700', color: COLORS.forest },
  unit:     { fontSize: 11, color: COLORS.muted },
  separator: { height: 1, backgroundColor: COLORS.border },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyFlex: { flex: 1 },
  emptyText: { color: COLORS.muted, fontSize: 14 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.cream },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.forest,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 48,
  },
  modalTitle:   { flex: 1, color: COLORS.white, fontSize: 17, fontWeight: '700' },
  closeBtn:     { marginLeft: 12, padding: 4 },
  closeBtnText: { color: COLORS.white, fontSize: 20 },
  detailScroll: { padding: 16 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: { fontSize: 13, color: COLORS.muted, flex: 1 },
  detailValue: { fontSize: 13, color: COLORS.ink, fontWeight: '500', flex: 2, textAlign: 'right' },
  descBox:   { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  descText:  { fontSize: 13, color: COLORS.ink, marginTop: 4, lineHeight: 20 },
  specsSection:      { marginTop: 16 },
  specsSectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 4 },
});
