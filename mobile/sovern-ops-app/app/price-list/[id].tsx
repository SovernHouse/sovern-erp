// ─── PriceList detail screen — Phase 4.28b mobile parity ───────────────────
//
// Compact 5-pillar Odoo view for a PriceList:
//   - Header with parent label + currency / dates
//   - Smart-count chips: Items + Pending Approvals
//   - Items list (read-only on mobile; CRUD happens via AI assistant or
//     the desktop ERP)
//   - Chatter at bottom (uses the existing ChatterSection component)
//
// Actions:
//   - Send email (modal)
//   - Request approval (modal)
//   - PDF: deferred — mobile WebView for the PDF endpoint is a follow-up;
//     for now the action button surfaces the URL so the user can hit the
//     desktop equivalent. Print is a desktop concern.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import {
  getPriceList, sendPriceListEmail, requestPriceListApproval,
  priceListPdfUrl,
  type PriceListDetail, type PriceListItemRow,
} from '../../src/services/api';
import ChatterSection from '../../src/components/ChatterSection';
import { COLORS, CONFIG } from '../../src/constants/config';
import * as Linking from 'expo-linking';

function fmt(date?: string | null) {
  if (!date) return '—';
  try { return new Date(date).toLocaleDateString('en-GB'); } catch (_) { return String(date); }
}

function fmtMoney(value: any, currency = 'USD') {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${currency} ${n.toFixed(2)}`;
}

export default function PriceListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [pl, setPl] = useState<PriceListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailOpen, setEmailOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

  useEffect(() => { navigation.setOptions({ title: 'Price List' }); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPriceList(String(id));
      setPl(data);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const items = useMemo<PriceListItemRow[]>(() => (pl?.items as any) || [], [pl]);
  const currency = pl?.currencyCode || 'USD';
  const parentLabel = pl?.Customer
    ? `Client · ${pl.Customer.companyName}`
    : pl?.Factory
      ? `Supplier · ${pl.Factory.companyName}`
      : 'Template';

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.forest} /></View>;
  }
  if (!pl) {
    return <View style={styles.loading}><Text style={{ color: COLORS.muted }}>Price list not found.</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      {/* Header */}
      <Text style={styles.h1}>{pl.name || '(unnamed)'}</Text>
      <Text style={styles.subtitle}>{parentLabel}</Text>

      {/* Meta */}
      <View style={styles.metaBlock}>
        <MetaCell label="Currency" value={currency} />
        <MetaCell label="Valid from" value={fmt(pl.validFrom)} />
        <MetaCell label="Valid to" value={fmt(pl.validTo)} />
        <MetaCell label="Status" value={pl.isActive ? 'Active' : 'Inactive'} />
      </View>
      {pl.description ? (
        <Text style={styles.description}>{pl.description}</Text>
      ) : null}

      {/* Smart counts */}
      <View style={styles.smartRow}>
        <View style={styles.chip}>
          <Text style={styles.chipCount}>{items.length}</Text>
          <Text style={styles.chipLabel}>Items</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <ActionButton
          label="Email"
          variant="primary"
          onPress={() => setEmailOpen(true)}
        />
        <ActionButton
          label="Request approval"
          variant="amber"
          onPress={() => setApprovalOpen(true)}
        />
        <ActionButton
          label="PDF"
          variant="ghost"
          onPress={() => {
            const full = `${CONFIG.SERVER_URL}${priceListPdfUrl(pl.id)}`;
            Linking.openURL(full).catch(() => {
              Alert.alert('Could not open PDF', 'Try opening from the desktop ERP.');
            });
          }}
        />
      </View>

      {/* Items list */}
      <Text style={styles.sectionTitle}>Items</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>No items in this price list yet.</Text>
      ) : (
        <View style={styles.itemsBlock}>
          {items.map((it) => (
            <View key={it.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemSku}>{it.sku || '—'}</Text>
                <Text style={styles.itemPrice}>{fmtMoney(it.sellingPrice, currency)}</Text>
              </View>
              <Text style={styles.itemName} numberOfLines={2}>{it.productName || it.sku || '(item)'}</Text>
              <View style={styles.itemMetaRow}>
                <Text style={styles.itemMeta}>{it.unit || 'sqm'}</Text>
                {it.minimumOrder != null ? <Text style={styles.itemMeta}>· MOQ {it.minimumOrder}</Text> : null}
                {it.leadTimeDays != null ? <Text style={styles.itemMeta}>· {it.leadTimeDays}d lead</Text> : null}
                {it.costPrice != null ? <Text style={styles.itemMeta}>· cost {fmtMoney(it.costPrice, currency)}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Chatter */}
      <Text style={styles.sectionTitle}>Chatter</Text>
      <ChatterSection entityType="PriceList" entityId={pl.id} />

      <EmailModal
        open={emailOpen}
        priceListId={pl.id}
        defaultSubject={`Price List · ${pl.name || ''}`}
        defaultCustomerId={pl.customerId || null}
        onClose={() => setEmailOpen(false)}
        onSent={() => { setEmailOpen(false); Alert.alert('Email sent'); }}
      />
      <ApprovalModal
        open={approvalOpen}
        priceListId={pl.id}
        priceListName={pl.name || ''}
        onClose={() => setApprovalOpen(false)}
        onCreated={() => { setApprovalOpen(false); load(); Alert.alert('Approval request created'); }}
      />
    </ScrollView>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, variant = 'ghost' }: { label: string; onPress: () => void; variant?: 'primary' | 'amber' | 'ghost' }) {
  const map = {
    primary: { bg: COLORS.forest, fg: COLORS.white, border: COLORS.forest },
    amber:   { bg: '#FEF3C7', fg: '#92400E', border: '#FDE68A' },
    ghost:   { bg: COLORS.white, fg: COLORS.ink, border: COLORS.border },
  } as const;
  const t = map[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.actionBtn, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      <Text style={[styles.actionBtnText, { color: t.fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmailModal({ open, onClose, onSent, priceListId, defaultSubject, defaultCustomerId }: any) {
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject]       = useState(defaultSubject || '');
  const [message, setMessage]       = useState('');
  const [customerId, setCustomerId] = useState(defaultCustomerId || '');
  const [sending, setSending]       = useState(false);

  useEffect(() => { setSubject(defaultSubject || ''); }, [defaultSubject, open]);

  const submit = async () => {
    if (!recipients.trim() && !customerId) {
      Alert.alert('Pick at least one recipient (email or client id).');
      return;
    }
    setSending(true);
    try {
      await sendPriceListEmail(priceListId, {
        to: recipients.trim() ? recipients.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        customerId: customerId || undefined,
        subject,
        message,
      });
      onSent && onSent();
    } catch (err: any) {
      Alert.alert('Send failed', err?.message || 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Email price list</Text>
          <Text style={styles.modalHint}>Generates a PDF attachment. Audit-logged.</Text>

          <Text style={styles.fieldLabel}>Recipient emails (comma-separated)</Text>
          <TextInput
            style={styles.input}
            placeholder="buyer@example.com, alt@example.com"
            value={recipients}
            onChangeText={setRecipients}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.fieldLabel}>Or client UUID (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Customer.id"
            value={customerId}
            onChangeText={setCustomerId}
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Subject</Text>
          <TextInput style={styles.input} value={subject} onChangeText={setSubject} />

          <Text style={styles.fieldLabel}>Message (HTML allowed)</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            value={message}
            onChangeText={setMessage}
            multiline
          />

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={[styles.modalBtn, styles.modalBtnGhost]}>
              <Text style={styles.modalBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} disabled={sending} style={[styles.modalBtn, styles.modalBtnPrimary, sending && { opacity: 0.5 }]}>
              <Text style={styles.modalBtnPrimaryText}>{sending ? 'Sending…' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ApprovalModal({ open, onClose, onCreated, priceListId, priceListName }: any) {
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return t.toISOString().slice(0, 10);
  });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!assigneeId.trim()) {
      Alert.alert('Assignee user UUID is required.');
      return;
    }
    setSaving(true);
    try {
      await requestPriceListApproval(priceListId, {
        assigneeId: assigneeId.trim(),
        dueDate,
        note,
      });
      onCreated && onCreated();
    } catch (err: any) {
      Alert.alert('Request failed', err?.message || 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Request approval</Text>
          <Text style={styles.modalHint}>
            Creates a pending ScheduledActivity for the assignee on "{priceListName}".
          </Text>

          <Text style={styles.fieldLabel}>Assignee user UUID *</Text>
          <TextInput
            style={styles.input}
            placeholder="User.id"
            value={assigneeId}
            onChangeText={setAssigneeId}
            autoCapitalize="none"
          />
          <Text style={styles.fieldHint}>
            Tip: ask the assistant `list_users` or check the desktop ERP user list.
          </Text>

          <Text style={styles.fieldLabel}>Due date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={dueDate}
            onChangeText={setDueDate}
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Note</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            value={note}
            onChangeText={setNote}
            multiline
          />

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={[styles.modalBtn, styles.modalBtnGhost]}>
              <Text style={styles.modalBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} disabled={saving || !assigneeId} style={[styles.modalBtn, styles.modalBtnPrimary, (saving || !assigneeId) && { opacity: 0.5 }]}>
              <Text style={styles.modalBtnPrimaryText}>{saving ? 'Sending…' : 'Send request'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },

  h1: { fontSize: 22, fontWeight: '800', color: COLORS.ink },
  subtitle: { fontSize: 13, color: COLORS.muted, marginTop: 4 },

  metaBlock: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 8 },
  metaCell: { flexBasis: '47%', backgroundColor: COLORS.white, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  metaLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.5 },
  metaValue: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginTop: 4 },

  description: { marginTop: 12, fontSize: 13, color: COLORS.ink, lineHeight: 18 },

  smartRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  chipCount: { fontSize: 22, fontWeight: '800', color: COLORS.ink },
  chipLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, marginTop: 2, letterSpacing: 0.5 },

  actionRow: { flexDirection: 'row', gap: 6, marginTop: 14, flexWrap: 'wrap' },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, flexGrow: 1, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '700' },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.muted, marginTop: 22, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  empty: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic' },

  itemsBlock: { gap: 8 },
  itemCard: { backgroundColor: COLORS.white, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemSku: { fontSize: 12, fontFamily: 'Courier', color: COLORS.muted },
  itemPrice: { fontSize: 15, fontWeight: '800', color: COLORS.forest },
  itemName: { fontSize: 14, color: COLORS.ink, marginTop: 4 },
  itemMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 },
  itemMeta: { fontSize: 11, color: COLORS.muted },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.white, padding: 18, borderTopLeftRadius: 14, borderTopRightRadius: 14, maxHeight: '90%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  modalHint: { fontSize: 12, color: COLORS.muted, marginTop: 4, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.muted, marginTop: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldHint: { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 13, color: COLORS.ink },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  modalBtnGhost: { backgroundColor: 'transparent' },
  modalBtnGhostText: { color: COLORS.muted, fontWeight: '700' },
  modalBtnPrimary: { backgroundColor: COLORS.ink },
  modalBtnPrimaryText: { color: COLORS.white, fontWeight: '700' },
});
