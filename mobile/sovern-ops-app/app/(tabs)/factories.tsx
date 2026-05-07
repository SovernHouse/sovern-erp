// ─── Factories Screen ─────────────────────────────────────────────────────
// Supplier directory: search, browse, tap for details, delete via modal
// header (server blocks deletion when open POs exist).
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, ScrollView, Linking, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getFactories, getFactory, deleteFactory, type Factory } from '../../src/services/api';
import { COLORS } from '../../src/constants/config';

// ─── Factory Row ──────────────────────────────────────────────────────────

function FactoryRow({ factory, onPress }: { factory: Factory; onPress: () => void }) {
  const initials = (factory.companyName ?? '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials || '🏭'}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>{factory.companyName}</Text>
        {factory.contactPerson ? (
          <Text style={styles.sub}>{factory.contactPerson}</Text>
        ) : null}
        {factory.country ? (
          <Text style={styles.country}>
            {factory.city ? `${factory.city}, ` : ''}{factory.country}
          </Text>
        ) : null}
      </View>
      <View style={styles.metaRight}>
        {factory.isConfidential ? (
          <Text style={styles.confidentialTag}>🔒</Text>
        ) : null}
        <View style={[
          styles.statusChip,
          { backgroundColor: factory.isActive !== false ? COLORS.success + '22' : COLORS.muted + '22' },
        ]}>
          <Text style={[
            styles.statusText,
            { color: factory.isActive !== false ? COLORS.success : COLORS.muted },
          ]}>
            {factory.isActive !== false ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Factory Detail Modal ─────────────────────────────────────────────────

function FactoryDetailModal({
  factoryId,
  onClose,
  onDeleted,
}: {
  factoryId: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [factory, setFactory] = useState<Factory | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getFactory(factoryId)
      .then(setFactory)
      .catch((err) => console.error('[Factory/detail]', err.message))
      .finally(() => setLoading(false));
  }, [factoryId]);

  function confirmDelete() {
    if (!factory) return;
    Alert.alert(
      'Delete factory',
      `Delete ${factory.companyName}? Server will block this if there are any open POs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteFactory(factoryId);
              onDeleted(factoryId);
              onClose();
            } catch (err: any) {
              // Server returns "Cannot delete factory with N open purchase
              // order(s). Close them first." — surface that to the user.
              Alert.alert('Could not delete', err.message ?? 'Server error');
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  function row(label: string, value?: string | number | null, isLink?: 'email' | 'phone') {
    if (value == null || value === '') return null;
    return (
      <View style={styles.detailRow} key={label}>
        <Text style={styles.detailLabel}>{label}</Text>
        {isLink ? (
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(isLink === 'email' ? `mailto:${value}` : `tel:${value}`)
            }
          >
            <Text style={[styles.detailValue, styles.link]}>{String(value)}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.detailValue}>{String(value)}</Text>
        )}
      </View>
    );
  }

  const initials = (factory?.companyName ?? '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={1}>
            {loading ? 'Loading…' : (factory?.companyName ?? 'Factory')}
          </Text>
          {factory && !loading ? (
            <TouchableOpacity
              onPress={confirmDelete}
              style={styles.headerIconBtn}
              disabled={deleting}
              hitSlop={8}
            >
              <Text style={styles.headerIconText}>{deleting ? '…' : '🗑'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.forest} />
        ) : factory ? (
          <ScrollView contentContainerStyle={styles.detailScroll}>

            {/* Avatar + status badges */}
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{initials}</Text>
            </View>

            {factory.isConfidential ? (
              <View style={styles.confidentialBanner}>
                <Text style={styles.confidentialBannerText}>
                  🔒 Confidential — restricted access
                </Text>
              </View>
            ) : null}

            {row('Contact', factory.contactPerson)}
            {row('Email', factory.email, 'email')}
            {row('Phone', factory.phone, 'phone')}
            {row('Country', factory.country)}
            {row('City', factory.city)}
            {row('Address', factory.address)}
            {row('Currency', factory.currency)}
            {row('Payment Terms', factory.paymentTerms)}
            {factory.leadTimeDays != null
              ? row('Lead Time', `${factory.leadTimeDays} days`)
              : null}
            {factory.rating != null ? row('Rating', `${factory.rating} / 5`) : null}

            {factory.specializations && factory.specializations.length > 0 ? (
              <View style={styles.tagBox}>
                <Text style={styles.detailLabel}>Specializations</Text>
                <View style={styles.tagRow}>
                  {factory.specializations.map((s) => (
                    <View key={s} style={styles.tag}>
                      <Text style={styles.tagText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {factory.certifications && factory.certifications.length > 0 ? (
              <View style={styles.tagBox}>
                <Text style={styles.detailLabel}>Certifications</Text>
                <View style={styles.tagRow}>
                  {factory.certifications.map((c) => (
                    <View key={c} style={[styles.tag, styles.certTag]}>
                      <Text style={[styles.tagText, styles.certTagText]}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {factory.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.notesText}>{factory.notes}</Text>
              </View>
            ) : null}

          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>Factory not found.</Text>
        )}
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function FactoriesScreen() {
  // `openId` is set when this tab is navigated to from elsewhere (e.g. the
  // Quotation Sourcing Trail) to deep-link directly into a factory's detail.
  const { openId } = useLocalSearchParams<{ openId?: string }>();

  const [factories, setFactories] = useState<Factory[]>([]);
  const [filtered, setFiltered]   = useState<Factory[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load(isRefresh = false) {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await getFactories({ page: 1, limit: 100 });
      setFactories(res.data ?? []);
      setFiltered(res.data ?? []);
    } catch (err: any) {
      console.error('[Factories]', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Deep-link: open the factory detail modal when navigated to with openId.
  useEffect(() => {
    if (openId && typeof openId === 'string') {
      setSelectedId(openId);
    }
  }, [openId]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? factories.filter(
            (f) =>
              f.companyName.toLowerCase().includes(q) ||
              (f.contactPerson ?? '').toLowerCase().includes(q) ||
              (f.country ?? '').toLowerCase().includes(q) ||
              (f.email ?? '').toLowerCase().includes(q) ||
              (f.specializations ?? []).join(' ').toLowerCase().includes(q),
          )
        : factories,
    );
  }, [search, factories]);

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
          placeholder="Search factory, contact, country, or specialization…"
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      {/* Count */}
      <Text style={styles.count}>
        {filtered.length} {filtered.length === 1 ? 'factory' : 'factories'}
      </Text>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FactoryRow factory={item} onPress={() => setSelectedId(item.id)} />
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
            <Text style={styles.emptyIcon}>🏭</Text>
            <Text style={styles.emptyTitle}>No factories</Text>
            <Text style={styles.emptyText}>
              {search ? 'Try clearing the search.' : 'Suppliers added in the desktop ERP appear here.'}
            </Text>
          </View>
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyFlex : undefined}
      />

      {/* Detail modal */}
      {selectedId ? (
        <FactoryDetailModal
          factoryId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeleted={(id) => setFactories((prev) => prev.filter((f) => f.id !== id))}
        />
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.cream },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },
  searchBar:    { margin: 12, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12 },
  searchInput:  { height: 40, color: COLORS.ink, fontSize: 14 },
  count:        { paddingHorizontal: 16, paddingBottom: 4, fontSize: 12, color: COLORS.muted },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.forest + '22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: COLORS.forest },
  rowBody:    { flex: 1 },
  name:       { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  sub:        { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  country:    { fontSize: 12, color: COLORS.forest, marginTop: 1 },

  metaRight:        { alignItems: 'flex-end', gap: 4 },
  confidentialTag:  { fontSize: 12 },
  statusChip:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText:       { fontSize: 11, fontWeight: '600' },
  separator:        { height: 1, backgroundColor: COLORS.border },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyFlex:      { flex: 1 },
  emptyIcon:      { fontSize: 48 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  emptyText:      { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },

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
  modalTitle:    { flex: 1, color: COLORS.white, fontSize: 17, fontWeight: '700' },
  headerIconBtn: { marginLeft: 8, padding: 4 },
  headerIconText:{ color: COLORS.white, fontSize: 18 },
  closeBtn:      { marginLeft: 12, padding: 4 },
  closeBtnText:  { color: COLORS.white, fontSize: 20 },

  detailScroll:  { padding: 16 },
  avatarLarge: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.forest + '22',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  avatarLargeText: { fontSize: 28, fontWeight: '700', color: COLORS.forest },

  confidentialBanner: {
    backgroundColor: COLORS.warning + '18',
    borderWidth: 1,
    borderColor: COLORS.warning + '40',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  confidentialBannerText: { fontSize: 12, color: COLORS.warning, fontWeight: '600', textAlign: 'center' },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: { fontSize: 13, color: COLORS.muted, flex: 1 },
  detailValue: { fontSize: 13, color: COLORS.ink, fontWeight: '500', flex: 2, textAlign: 'right' },
  link:        { color: COLORS.forest, textDecorationLine: 'underline' },

  // Tags (specializations + certifications)
  tagBox:    { paddingVertical: 10 },
  tagRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: {
    backgroundColor: COLORS.forest + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagText:     { fontSize: 12, color: COLORS.forest, fontWeight: '500' },
  certTag:     { backgroundColor: COLORS.warning + '18' },
  certTagText: { color: COLORS.warning, fontWeight: '600' },

  notesBox:  { paddingVertical: 10 },
  notesText: { fontSize: 13, color: COLORS.ink, marginTop: 4, lineHeight: 20 },
});
