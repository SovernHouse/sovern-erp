// ─── Quotation Detail Screen ──────────────────────────────────────────────
// Route: /quotation/:id  (Expo Router dynamic segment)
// Shows full quotation: header, sourcing trail (factory + lead), line items,
// financials, and terms. Read-only on mobile.

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Alert, RefreshControl, TouchableOpacity, Linking, Share,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { getQuotation, generateApprovalLink, sendQuotation, downloadQuotationPDF, createSalesOrderFromQuotation, type Quotation, type QuotationItem } from '../../src/services/api';
import ChatterSection from '../../src/components/ChatterSection';
import { BrandBadge } from '../../src/components/BrandBadge';
import { useBrands } from '../../src/hooks/useBrands';
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Taipei' });
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Taipei' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Taipei' });
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
  const { getBrand, accessibleBrands } = useBrands();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [sendingViaERP, setSendingViaERP] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'preview' | 'download' | null>(null);
  const [convertingToSO, setConvertingToSO] = useState(false);

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

  // Generate a public sign-back link the customer can open without logging
  // in. Backend creates a DocumentApproval row with a UUID token, returns
  // the URL, and emails it (if email is configured). Mobile shows the
  // link via the native share sheet so the user can paste/forward it.
  async function handleSendForSignature() {
    if (!quotation || generatingLink) return;
    setGeneratingLink(true);
    try {
      const link = await generateApprovalLink('Quotation', quotation.id);
      Alert.alert(
        'Signature link ready',
        `${link.documentLabel}\n\nThe link expires on ${new Date(link.expiresAt).toLocaleDateString('en-US', { timeZone: 'Asia/Taipei' })}. Tap Share to send it to the customer.`,
        [
          { text: 'Done', style: 'cancel' },
          {
            text: 'Open',
            onPress: () => Linking.openURL(link.approvalUrl),
          },
          {
            text: 'Share',
            onPress: () =>
              Share.share({
                message: `Please review and approve quotation ${link.documentLabel}: ${link.approvalUrl}`,
                url: link.approvalUrl,
              }),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('Could not generate link', err.message ?? 'Server error');
    } finally {
      setGeneratingLink(false);
    }
  }

  // Phase 3, C9: brand-aware PDF preview + download.
  // Fetches the binary PDF (the backend renders FW/IronLite/Generic/PrivateLabel
  // or SH classic depending on quotation.brandCode + customer.productBrandingMode),
  // saves to the device cache, then either opens or shares it.
  async function handlePdfAction(mode: 'preview' | 'download') {
    if (!quotation || pdfBusy) return;
    setPdfBusy(mode);
    try {
      const uri = await downloadQuotationPDF(quotation.id, { inline: mode === 'preview' });
      if (mode === 'preview') {
        // Try expo-sharing first (renders preview UI), fall back to Linking.
        try {
          const Sharing = require('expo-sharing');
          const available = await Sharing.isAvailableAsync();
          if (available) {
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
          } else {
            await Linking.openURL(uri);
          }
        } catch (_) {
          await Linking.openURL(uri);
        }
      } else {
        // Download mode: share-sheet so user can save to Files / Drive.
        try {
          const Sharing = require('expo-sharing');
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
        } catch (_) {
          Alert.alert('PDF saved', `Saved to ${uri}`);
        }
      }
    } catch (err: any) {
      Alert.alert('PDF unavailable', err.message ?? 'Could not generate PDF');
    } finally {
      setPdfBusy(null);
    }
  }

  // Phase 4, C16: Convert an accepted quotation into a Sales Order.
  // Mobile flow keeps it light — confirms before posting, uses the
  // quotation's source factory, and navigates to the new SO (desktop
  // for full SO management). Server re-validates brand access and
  // returns 403 if the user can't write to the quotation's brand.
  async function handleConvertToSO() {
    if (!quotation || convertingToSO) return;
    if (!quotation.factoryId) {
      Alert.alert(
        'Factory required',
        'This quotation has no source factory on file. Set a factory on the quotation in the desktop ERP before converting.',
      );
      return;
    }
    Alert.alert(
      'Create Sales Order',
      `Convert ${quotation.quotationNumber} into a Sales Order? The source factory and line items carry over.${
        quotation.brandCode === 'FW' ? '\n\nFlorWay Sales Orders are ERP-internal records. The factory sends the document to the buyer.' : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create SO',
          onPress: async () => {
            setConvertingToSO(true);
            try {
              const so = await createSalesOrderFromQuotation({
                quotationId: quotation.id,
                factoryId: quotation.factoryId!,
              });
              Alert.alert('Sales Order created', so.orderNumber ? `Order ${so.orderNumber} created.` : 'Sales Order created.');
              router.replace('/(tabs)/sales-orders');
            } catch (err: any) {
              Alert.alert('Convert failed', err.message ?? 'Server error');
            } finally {
              setConvertingToSO(false);
            }
          },
        },
      ],
    );
  }

  async function handleSendViaERP() {
    if (!quotation || sendingViaERP) return;
    const brand = getBrand(quotation.brandCode || 'SH');
    const fromAddress = brand?.senderEmail || 'alex@sovernhouse.co';
    const brandName = brand?.displayName || 'Sovern House';
    const toAddress = quotation.customer?.email || '(no email on file)';
    Alert.alert(
      'Send Quotation via ERP',
      `Send ${quotation.quotationNumber} from ${fromAddress} (${brandName}) to ${quotation.customer?.companyName || 'customer'} at ${toAddress}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSendingViaERP(true);
            try {
              await sendQuotation(quotation.id);
              setQuotation({ ...quotation, status: 'sent' });
              Alert.alert('Sent', 'Quotation sent successfully.');
            } catch (err: any) {
              Alert.alert('Send failed', err.message ?? 'Server error');
            } finally {
              setSendingViaERP(false);
            }
          },
        },
      ],
    );
  }

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.quotationNumber}>{quotation.quotationNumber}</Text>
              <BrandBadge code={quotation.brandCode || 'SH'} size="sm" showLabel={false} />
            </View>
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

      {/* ── Phase 3, C9: FW variant hint banner ─────────────────────── */}
      {quotation.brandCode === 'FW' ? (() => {
        const mode = quotation.customer?.productBrandingMode;
        const variants: Record<string, { title: string; detail: string; tone: 'dark' | 'light' | 'warn' }> = {
          ironlite: {
            tone: 'dark',
            title: 'IronLite Core branding',
            detail: 'PDF renders with the IronLite I-Beam wordmark and OEM badge. WPC products get a construction diagram addendum page.',
          },
          generic: {
            tone: 'light',
            title: 'FlorWay generic',
            detail: 'PDF renders under the FlorWay Sdn. Bhd. wordmark. No IronLite imagery or OEM badge.',
          },
          private_label: {
            tone: 'warn',
            title: 'Private Label template in development',
            detail: `PDF will render with the FlorWay generic layout. The full private-label template ships once the first OEM private-label buyer signs${quotation.customer?.privateLabelProductName ? ` (planned brand: ${quotation.customer.privateLabelProductName})` : ''}.`,
          },
        };
        const fallback = {
          tone: 'light' as const,
          title: 'FlorWay generic (no productBrandingMode set)',
          detail: 'Set the customer\'s product branding mode on their detail page to render an IronLite or Private Label quotation.',
        };
        const info = (mode && variants[mode]) || fallback;
        const bgColor = info.tone === 'dark' ? COLORS.ink : info.tone === 'warn' ? '#FEF3C7' : COLORS.white;
        const textColor = info.tone === 'dark' ? COLORS.cream : info.tone === 'warn' ? '#78350F' : COLORS.ink;
        const subColor = info.tone === 'dark' ? COLORS.cream : info.tone === 'warn' ? '#92400E' : COLORS.muted;
        return (
          <View style={[styles.variantBanner, { backgroundColor: bgColor }]}>
            <Text style={[styles.variantBannerTitle, { color: textColor }]}>
              FlorWay quotation document  ·  {info.title}
            </Text>
            <Text style={[styles.variantBannerDetail, { color: subColor }]}>
              {info.detail}
            </Text>
          </View>
        );
      })() : null}

      {/* ── Phase 4, C16: FW internal-record banner ─────────────────── */}
      {quotation.brandCode === 'FW' ? (
        <View style={styles.fwInternalBanner}>
          <Text style={styles.fwInternalBannerTitle}>FACTORY WILL SEND TO BUYER. INTERNAL RECORD</Text>
          <Text style={styles.fwInternalBannerDetail}>
            FlorWay Sales Orders, Proforma Invoices, and Invoices are ERP-internal records. The factory sends the document to the buyer directly.
          </Text>
        </View>
      ) : null}

      {/* ── Phase 3, C9: PDF preview + download buttons ─────────────── */}
      <View style={styles.pdfButtonRow}>
        <TouchableOpacity
          style={[styles.pdfButton, pdfBusy === 'preview' && styles.signActionBtnDisabled]}
          onPress={() => handlePdfAction('preview')}
          disabled={!!pdfBusy}
          activeOpacity={0.7}
        >
          <Text style={styles.pdfButtonIcon}>👁️</Text>
          <Text style={styles.pdfButtonLabel}>{pdfBusy === 'preview' ? 'Loading…' : 'Preview PDF'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pdfButton, pdfBusy === 'download' && styles.signActionBtnDisabled]}
          onPress={() => handlePdfAction('download')}
          disabled={!!pdfBusy}
          activeOpacity={0.7}
        >
          <Text style={styles.pdfButtonIcon}>⬇️</Text>
          <Text style={styles.pdfButtonLabel}>{pdfBusy === 'download' ? 'Saving…' : 'Download PDF'}</Text>
        </TouchableOpacity>
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

      {/* ── Phase 4, C16: Convert to Sales Order (accepted + brand access) ── */}
      {quotation.status === 'accepted'
        && (!accessibleBrands || accessibleBrands.length === 0 || accessibleBrands.includes(quotation.brandCode || 'SH')) ? (
        <TouchableOpacity
          style={[styles.signActionBtn, { borderColor: COLORS.success }, convertingToSO && styles.signActionBtnDisabled]}
          onPress={handleConvertToSO}
          disabled={convertingToSO}
          activeOpacity={0.7}
        >
          <Text style={styles.signActionIcon}>🚚</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.signActionLabel, { color: COLORS.success }]}>
              {convertingToSO ? 'Creating Sales Order…' : 'Convert to Sales Order'}
            </Text>
            <Text style={styles.signActionMeta}>
              Creates a confirmed SO from this accepted quotation. Line items and factory carry over.
            </Text>
          </View>
          <Text style={styles.signActionChevron}>›</Text>
        </TouchableOpacity>
      ) : null}

      {/* ── Send via ERP (draft only) ────────────────────────────────── */}
      {quotation.status === 'draft' ? (
        <TouchableOpacity
          style={[styles.signActionBtn, { borderColor: COLORS.forest }, sendingViaERP && styles.signActionBtnDisabled]}
          onPress={handleSendViaERP}
          disabled={sendingViaERP}
          activeOpacity={0.7}
        >
          <Text style={styles.signActionIcon}>📤</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.signActionLabel}>
              {sendingViaERP ? 'Sending…' : 'Send via ERP'}
            </Text>
            <Text style={styles.signActionMeta}>
              Emails this quotation to the customer from your brand address
            </Text>
          </View>
          <Text style={styles.signActionChevron}>›</Text>
        </TouchableOpacity>
      ) : null}

      {/* ── Send for signature (hidden once already signed/terminal) ─── */}
      {!quotation.signedAt
        && quotation.status !== 'cancelled'
        && quotation.status !== 'rejected'
        && quotation.status !== 'expired' ? (
        <TouchableOpacity
          style={[styles.signActionBtn, generatingLink && styles.signActionBtnDisabled]}
          onPress={handleSendForSignature}
          disabled={generatingLink}
          activeOpacity={0.7}
        >
          <Text style={styles.signActionIcon}>✉️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.signActionLabel}>
              {generatingLink ? 'Generating link…' : 'Send for customer signature'}
            </Text>
            <Text style={styles.signActionMeta}>
              Generates a public approve link the customer can sign without logging in
            </Text>
          </View>
          <Text style={styles.signActionChevron}>›</Text>
        </TouchableOpacity>
      ) : null}

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

  // Send-for-signature CTA
  signActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.forest + '50',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  signActionBtnDisabled: { opacity: 0.5 },
  signActionIcon:     { fontSize: 20 },
  signActionLabel:    { fontSize: 14, fontWeight: '700', color: COLORS.forest },
  signActionMeta:     { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  signActionChevron:  { fontSize: 22, color: COLORS.muted, alignSelf: 'center' },

  // Phase 3, C9: FW variant hint banner
  variantBanner: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  variantBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  variantBannerDetail: {
    fontSize: 12,
    lineHeight: 18,
  },

  // Phase 3, C9: Preview/Download PDF buttons row
  pdfButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  pdfButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  pdfButtonIcon: { fontSize: 18 },
  pdfButtonLabel: { fontSize: 14, fontWeight: '600', color: COLORS.ink },

  // Phase 4, C16: FW internal-record banner (iron-deep)
  fwInternalBanner: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1F2933',
    borderWidth: 1,
    borderColor: '#1F2933',
  },
  fwInternalBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F1EEE7',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  fwInternalBannerDetail: {
    fontSize: 12,
    lineHeight: 18,
    color: '#F1EEE7',
    opacity: 0.8,
  },
});
