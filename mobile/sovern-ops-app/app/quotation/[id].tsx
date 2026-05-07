// ─── Quotation Detail Screen ──────────────────────────────────────────────
// Route: /quotation/:id  (Expo Router dynamic segment)
// Shows full quotation: header, sourcing trail (factory + lead), line items,
// financials, and terms. Read-only on mobile.

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Alert, RefreshControl, TouchableOpacity, Linking,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { getQuotation, type Quotation, type QuotationItem } from '../../src/services/api';
import ChatterSection from '../../src/components/ChatterSection';
import { COLORS } from '../../src/constants/config';

// ─── Constants ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: COLORS.muted },
  sent:     { label: 'Sent',     color: COLORS.statusProposal },
  accepted: { label: 'Accepted', color: COLORS.success },
  rejected: { label: 'Rejected', color: COLORS.error },
  expired:  { label: 'Expired',  color: COLORS.statusClosed },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatCurrency(value?: number, currency = 'USD') {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} at ${time}`;
}

function isExpiringSoon(iso?: string): boolean {
  if (!iso) return false;
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000; // within 7 days
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function InfoRow({ label, value, onPress, highlight }: {
  label: string;
  value?: string;
  onPress?: () => void;
  highlight?: string; // optional color for value
}) {
  if (!value) return null;
  return (
    <TouchableOpacity
      style={styles.infoRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, onPress && styles.infoValueLink, highlight ? { color: highlight } : null]}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

function LineItemRow({ item, currency }: { item: QuotationItem; currency?: string }) {
  return (
    <View style={styles.lineItem}>
      <View style={styles.lineItemTop}>
        <Text style={styles.lineItemDesc} numberOfLines={2}>
          {item.description ?? item.product?.name ?? '—'}
        </Text>
        <Text style={styles.lineItemTotal}>
          {formatCurrency(item.total, currency)}
        </Text>
      </View>
      <Text style={styles.lineItemMeta}>
        {item.quantity} {item.unit ?? 'unit'} × {formatCurrency(item.unitPrice, currency)}
        {item.discount ? `  (−${item.discount}%)` : ''}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────

export default function QuotationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const data = await getQuotation(id);
      setQuotation(data);
      navigation.setOptions({ title: data.quotationNumber });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  if (!quotation) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Quotation not found.</Text>
      </View>
    );
  }

  const cfg = STATUS_CONFIG[quotation.status] ?? { label: quotation.status, color: COLORS.muted };
  const expiringSoon = isExpiringSoon(quotation.validUntil);
  const items = quotation.items ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forest} />
      }
    >
      {/* ── Header card ──────────────────────────────────────────────── */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.docIcon}>
            <Text style={styles.docIconText}>📄</Text>
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.quotationNumber}>{quotation.quotationNumber}</Text>
            {quotation.customer?.companyName
              ? <Text style={styles.customerName}>{quotation.customer.companyName}</Text>
              : null}
          </View>
        </View>

        {/* Status + valid until */}
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: cfg.color + '18', borderColor: cfg.color }]}>
            <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
            <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          {quotation.validUntil ? (
            <Text style={[styles.validUntil, expiringSoon && styles.validUntilWarning]}>
              {expiringSoon ? '⚠️ ' : ''}Valid until {formatDate(quotation.validUntil)}
            </Text>
          ) : null}
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>
            {formatCurrency(quotation.total, quotation.currency)}
          </Text>
        </View>
      </View>

      {/* ── Sourcing Trail ───────────────────────────────────────────── */}
      {(quotation.factory || quotation.lead) ? (
        <>
          <SectionHeader title="Sourcing Trail" />
          <View style={styles.card}>
            {quotation.factory ? (
              <TouchableOpacity
                style={styles.sourcingRow}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/factories',
                    params: { openId: quotation.factory!.id },
                  })
                }
                activeOpacity={0.6}
              >
                <View style={styles.sourcingIcon}>
                  <Text style={styles.sourcingIconText}>🏭</Text>
                </View>
                <View style={styles.sourcingBody}>
                  <Text style={styles.sourcingLabel}>Supplier / Factory</Text>
                  <Text style={[styles.sourcingName, styles.sourcingNameLink]}>
                    {quotation.factory.companyName}
                  </Text>
                  {quotation.factory.country
                    ? <Text style={styles.sourcingMeta}>{quotation.factory.country}</Text>
                    : null}
                </View>
                <Text style={styles.sourcingChevron}>›</Text>
              </TouchableOpacity>
            ) : null}

            {quotation.factory && quotation.lead ? (
              <View style={styles.sourcingDivider} />
            ) : null}

            {quotation.lead ? (
              <View style={styles.sourcingRow}>
                <View style={styles.sourcingIcon}>
                  <Text style={styles.sourcingIconText}>👥</Text>
                </View>
                <View style={styles.sourcingBody}>
                  <Text style={styles.sourcingLabel}>Originated from Lead</Text>
                  <Text style={styles.sourcingName}>{quotation.lead.companyName}</Text>
                  {quotation.lead.contactName
                    ? <Text style={styles.sourcingMeta}>{quotation.lead.contactName}</Text>
                    : null}
                </View>
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {/* ── Customer ────────────────────────────────────────────────── */}
      {quotation.customer ? (
        <>
          <SectionHeader title="Customer" />
          <View style={styles.card}>
            <InfoRow label="Company" value={quotation.customer.companyName} />
            <InfoRow
              label="Email"
              value={quotation.customer.email}
              onPress={() => quotation.customer?.email ? Linking.openURL(`mailto:${quotation.customer.email}`) : undefined}
            />
            <InfoRow label="Country" value={quotation.customer.country} />
          </View>
        </>
      ) : null}

      {/* ── Line Items ───────────────────────────────────────────────── */}
      {items.length > 0 ? (
        <>
          <SectionHeader title={`Line Items (${items.length})`} />
          <View style={styles.card}>
            {items.map((item, i) => (
              <View key={item.id}>
                <LineItemRow item={item} currency={quotation.currency} />
                {i < items.length - 1 && <View style={styles.itemDivider} />}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* ── Financials ───────────────────────────────────────────────── */}
      <SectionHeader title="Financials" />
      <View style={styles.card}>
        <InfoRow label="Subtotal"  value={formatCurrency(quotation.subtotal, quotation.currency)} />
        {quotation.discount ? (
          <InfoRow
            label={`Discount${quotation.discountType === 'percentage' ? ` (${quotation.taxRate}%)` : ''}`}
            value={`−${formatCurrency(quotation.discount, quotation.currency)}`}
            highlight={COLORS.error}
          />
        ) : null}
        {quotation.tax ? (
          <InfoRow label={`Tax${quotation.taxRate ? ` (${quotation.taxRate}%)` : ''}`}
            value={formatCurrency(quotation.tax, quotation.currency)} />
        ) : null}
        <View style={styles.totalSummaryRow}>
          <Text style={styles.totalSummaryLabel}>Total</Text>
          <Text style={styles.totalSummaryValue}>
            {formatCurrency(quotation.total, quotation.currency)}
          </Text>
        </View>
      </View>

      {/* ── E-signature (only shown when client has signed) ──────────── */}
      {quotation.signedAt && quotation.signedByClient ? (
        <>
          <SectionHeader title="Customer Acceptance" />
          <View style={styles.signedCard}>
            <View style={styles.signedIcon}>
              <Text style={styles.signedIconText}>✓</Text>
            </View>
            <View style={styles.signedBody}>
              <Text style={styles.signedHeadline}>
                Accepted by {quotation.signedByClient}
              </Text>
              <Text style={styles.signedMeta}>
                {formatDateTime(quotation.signedAt)}
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {/* ── Details ──────────────────────────────────────────────────── */}
      <SectionHeader title="Details" />
      <View style={styles.card}>
        <InfoRow label="Created"      value={formatDate(quotation.createdAt)} />
        <InfoRow label="Valid Until"  value={formatDate(quotation.validUntil)} />
        <InfoRow label="Inquiry Ref"  value={quotation.inquiry?.inquiryNumber} />
        {quotation.salesPerson ? (
          <InfoRow
            label="Sales Rep"
            value={`${quotation.salesPerson.firstName} ${quotation.salesPerson.lastName}`}
          />
        ) : null}
      </View>

      {/* ── Terms ────────────────────────────────────────────────────── */}
      {quotation.terms ? (
        <>
          <SectionHeader title="Terms & Conditions" />
          <View style={styles.card}>
            <Text style={styles.termsBody}>{quotation.terms}</Text>
          </View>
        </>
      ) : null}

      {/* ── Chatter ──────────────────────────────────────────────────── */}
      <SectionHeader title="Notes & Activity" />
      <ChatterSection entityType="Quotation" entityId={String(quotation.id)} />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content:   { padding: 16 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },
  emptyText: { color: COLORS.muted, fontSize: 14 },

  // Header card
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 18,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  docIcon:      { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.forest + '18', justifyContent: 'center', alignItems: 'center' },
  docIconText:  { fontSize: 24 },
  headerMeta:   { flex: 1 },
  quotationNumber: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  customerName:    { fontSize: 14, color: COLORS.muted, marginTop: 2 },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13, fontWeight: '600' },
  validUntil:        { fontSize: 12, color: COLORS.muted },
  validUntilWarning: { color: COLORS.warning, fontWeight: '600' },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel:  { fontSize: 13, color: COLORS.muted },
  totalAmount: { fontSize: 22, fontWeight: '800', color: COLORS.forest },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
    gap: 10,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionLine:  { flex: 1, height: 1, backgroundColor: COLORS.border },

  // Cards
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel:     { fontSize: 13, color: COLORS.muted },
  infoValue:     { fontSize: 13, color: COLORS.ink, fontWeight: '500', textAlign: 'right', flex: 1, marginLeft: 12 },
  infoValueLink: { color: COLORS.forest, textDecorationLine: 'underline' },

  // Sourcing trail
  sourcingRow:     { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  sourcingIcon:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.forest + '15', justifyContent: 'center', alignItems: 'center' },
  sourcingIconText: { fontSize: 18 },
  sourcingBody:    { flex: 1 },
  sourcingLabel:   { fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  sourcingName:    { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  sourcingNameLink: { color: COLORS.forest, textDecorationLine: 'underline' },
  sourcingMeta:    { fontSize: 13, color: COLORS.muted, marginTop: 1 },
  sourcingDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },
  sourcingChevron: { fontSize: 24, color: COLORS.muted, alignSelf: 'center', paddingLeft: 4 },

  // Line items
  lineItem:    { paddingHorizontal: 16, paddingVertical: 12 },
  lineItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 },
  lineItemDesc:  { flex: 1, fontSize: 14, color: COLORS.ink, fontWeight: '600' },
  lineItemTotal: { fontSize: 14, fontWeight: '700', color: COLORS.forest },
  lineItemMeta:  { fontSize: 12, color: COLORS.muted },
  itemDivider:   { height: 1, backgroundColor: COLORS.border },

  // Financials summary
  totalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 2,
    borderTopColor: COLORS.forest,
    marginTop: 2,
  },
  totalSummaryLabel: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  totalSummaryValue: { fontSize: 18, fontWeight: '800', color: COLORS.forest },

  termsBody: { padding: 16, fontSize: 13, color: COLORS.ink, lineHeight: 20 },

  // E-signature card
  signedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.success + '12',
    borderWidth: 1,
    borderColor: COLORS.success + '40',
    borderRadius: 12,
    padding: 14,
  },
  signedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signedIconText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  signedBody:     { flex: 1 },
  signedHeadline: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  signedMeta:     { fontSize: 12, color: COLORS.muted, marginTop: 2 },
});
