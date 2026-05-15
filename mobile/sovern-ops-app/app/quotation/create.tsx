// ─── Create Quotation Screen ──────────────────────────────────────────────
// Phase 4.9 Pre-flight — L-035 mobile parity catch-up.
//
// Mirrors desktop QuotationForm.jsx feature set:
// brand picker, customer/factory/lead pickers, multi-line items
// (product + qty + unit + price + per-line discount + notes), validity
// date, currency, overall discount/discountType, tax rate, terms,
// notes. Submit posts to /api/quotations via createQuotation.
//
// Mobile-native shape: line items render as stacked cards (vs desktop
// table). Pickers open as searchable modals. Super-admin below-floor
// price warning + reason field is preserved per Phase 4 C14.

import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, FlatList, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useBrands } from '../../src/hooks/useBrands';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS } from '../../src/constants/config';
import { BrandBadge } from '../../src/components/BrandBadge';
import {
  getCustomers, getFactories, getProducts, createQuotation,
  listTariffRates,
  type Customer, type Factory, type Product, type QuotationItemPayload,
  type TariffRate,
} from '../../src/services/api';

const UNITS = ['sqm', 'sqft', 'box', 'pallet', 'roll', 'piece'] as const;
const CURRENCIES = ['USD', 'EUR', 'CNY', 'GBP'] as const;

// Phase 4.9 C-3: countries we compute landed-cost / tariff for.
const TARIFF_TRACKED_DESTINATIONS = new Set(['US', 'USA']);

type LineItem = {
  uid: string; // local id for state
  productId: string;
  productName: string;
  productSku: string;
  description: string;
  quantity: string; // string to allow empty input
  unit: typeof UNITS[number];
  unitPrice: string;
  baseFobPrice: number | null; // for below-floor detection
  discount: string;
  notes: string;
  belowFloorReason: string;
  // Phase 4.9 C-3: origin country picker — cycles through product.originVariants.
  originCountry: string;
  originVariants: Array<{ originCountry: string; fobPriceUsd: number; priceUnit?: string }>;
};

// ─── Searchable Picker Modal ──────────────────────────────────────────────

function PickerModal<T extends { id: string }>({
  visible, title, items, renderRow, onPick, onClose, placeholder,
}: {
  visible: boolean;
  title: string;
  items: T[];
  renderRow: (item: T) => { primary: string; secondary?: string };
  onPick: (item: T) => void;
  onClose: () => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  useEffect(() => { if (!visible) setQ(''); }, [visible]);
  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      const r = renderRow(it);
      return r.primary.toLowerCase().includes(needle) || (r.secondary ?? '').toLowerCase().includes(needle);
    });
  }, [q, items, renderRow]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalBack}><Text style={styles.modalBackText}>‹ Back</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={{ width: 60 }} />
        </View>
        <TextInput
          style={styles.modalSearch}
          placeholder={placeholder || 'Search…'}
          placeholderTextColor={COLORS.muted}
          value={q}
          onChangeText={setQ}
          autoFocus
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const r = renderRow(item);
            return (
              <TouchableOpacity style={styles.modalRow} onPress={() => onPick(item)}>
                <Text style={styles.modalRowPrimary}>{r.primary}</Text>
                {r.secondary ? <Text style={styles.modalRowSecondary}>{r.secondary}</Text> : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.modalEmpty}>No matches</Text>}
        />
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────

export default function CreateQuotation() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { defaultBrand, accessibleBrands } = useBrands();
  const isSuperAdmin = user?.role === 'super_admin';

  // Pickers data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingPickers, setLoadingPickers] = useState(true);

  // Form state — names align with the desktop submit shape
  const [brandCode, setBrandCode] = useState<string>(defaultBrand || 'SH');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [factory, setFactory] = useState<Factory | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [validUntil, setValidUntil] = useState<string>(''); // YYYY-MM-DD
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>('USD');
  const [discount, setDiscount] = useState<string>('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [taxRate, setTaxRate] = useState<string>('');
  const [terms, setTerms] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  // Phase 4.9 C-3: display-unit preference (locks at send).
  const [displayAreaUnit, setDisplayAreaUnit] = useState<'sqm' | 'sqft'>('sqm');
  const [displayDimensionUnit, setDisplayDimensionUnit] = useState<'mm' | 'inch'>('mm');
  // Phase 4.9 C-3: live USA landed-cost preview needs the tariff table.
  const [tariffRates, setTariffRates] = useState<TariffRate[]>([]);

  useEffect(() => {
    listTariffRates().then(r => setTariffRates(Array.isArray(r.data) ? r.data : [])).catch(() => setTariffRates([]));
  }, []);

  const destinationCountry = (customer?.country || '').toUpperCase();
  const isUSDestination = TARIFF_TRACKED_DESTINATIONS.has(destinationCountry);

  function lookupTariff(origin: string, destination: string, brand: string): TariffRate | null {
    if (!origin || !destination) return null;
    const today = new Date().toISOString().slice(0, 10);
    const candidates = tariffRates.filter(r =>
      (r.originCountry || '').toUpperCase() === origin.toUpperCase() &&
      (r.destinationCountry || '').toUpperCase() === destination.toUpperCase() &&
      r.effectiveFrom <= today &&
      r.effectiveUntil >= today
    );
    if (!candidates.length) return null;
    return candidates.find(r => r.brandCode === brand) || candidates.find(r => !r.brandCode) || candidates[0];
  }

  // UI modal state
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showFactoryPicker, setShowFactoryPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null); // when adding new, null and we append
  const [submitting, setSubmitting] = useState(false);

  // Refetch products when brand changes (per Phase 4 C14: brand-filtered catalog)
  useEffect(() => {
    let cancelled = false;
    setLoadingPickers(true);
    Promise.all([
      getCustomers({ page: 1 }).then((r) => r.data ?? []),
      getFactories({ page: 1, limit: 100 }).then((r) => r.data ?? []),
      getProducts({ page: 1, limit: 200, brandCode, status: 'active' }).then((r) => r.data ?? []),
    ])
      .then(([c, f, p]) => {
        if (cancelled) return;
        setCustomers(c);
        setFactories(f);
        setProducts(p);
      })
      .catch((err) => Alert.alert('Load failed', err.message))
      .finally(() => { if (!cancelled) setLoadingPickers(false); });
    return () => { cancelled = true; };
  }, [brandCode]);

  // Derived totals — match desktop math exactly
  const subtotal = items.reduce((sum, it) => {
    const q = parseFloat(it.quantity) || 0;
    const p = parseFloat(it.unitPrice) || 0;
    const d = parseFloat(it.discount) || 0;
    return sum + (q * p - d);
  }, 0);
  const discountAmount = discountType === 'percentage' ? (subtotal * (parseFloat(discount) || 0)) / 100 : (parseFloat(discount) || 0);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxAmount = (subtotalAfterDiscount * (parseFloat(taxRate) || 0)) / 100;
  const total = subtotalAfterDiscount + taxAmount;

  // ── Line item handlers ──
  const openAddItem = () => { setEditingLineIndex(items.length); setShowProductPicker(true); };
  const openEditItem = (idx: number) => { setEditingLineIndex(idx); setShowProductPicker(true); };
  const pickProduct = (product: Product) => {
    const idx = editingLineIndex ?? items.length;
    const newItem: LineItem = {
      uid: items[idx]?.uid || `${Date.now()}-${Math.random()}`,
      productId: product.id,
      productName: product.name,
      productSku: product.sku || '',
      description: product.salesDescription || product.description || product.name,
      quantity: items[idx]?.quantity || '1',
      unit: ((product as any).moqUnit || product.unit || 'sqm') as LineItem['unit'],
      unitPrice: items[idx]?.unitPrice || ((product as any).baseFobPrice != null ? String((product as any).baseFobPrice) : '0'),
      baseFobPrice: (product as any).baseFobPrice != null ? Number((product as any).baseFobPrice) : null,
      discount: items[idx]?.discount || '',
      notes: items[idx]?.notes || '',
      belowFloorReason: items[idx]?.belowFloorReason || '',
      originCountry: items[idx]?.originCountry || ((product as any).originCountry || '').toUpperCase(),
      originVariants: Array.isArray((product as any).originVariants)
        ? (product as any).originVariants.map((v: any) => ({
            originCountry: (v.originCountry || '').toUpperCase(),
            fobPriceUsd: Number(v.fobPriceUsd || 0),
            priceUnit: v.priceUnit || 'sqm',
          }))
        : [],
    };
    const next = [...items];
    next[idx] = newItem;
    setItems(next);
    setShowProductPicker(false);
    setEditingLineIndex(null);
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!customer) { Alert.alert('Customer required', 'Pick a customer before saving.'); return; }
    if (items.length === 0) { Alert.alert('Line items required', 'Add at least one product before saving.'); return; }
    for (const it of items) {
      const q = parseFloat(it.quantity);
      const p = parseFloat(it.unitPrice);
      if (!Number.isFinite(q) || q <= 0) { Alert.alert('Invalid quantity', `Quantity for ${it.productName} must be > 0`); return; }
      if (!Number.isFinite(p) || p < 0) { Alert.alert('Invalid price', `Unit price for ${it.productName} must be >= 0`); return; }
      if (it.baseFobPrice != null && p < it.baseFobPrice) {
        if (!isSuperAdmin) {
          Alert.alert('Below floor price', `${it.productName}: $${p.toFixed(2)} is below the floor $${it.baseFobPrice.toFixed(2)}. Super-admin only.`);
          return;
        }
        if (!it.belowFloorReason || it.belowFloorReason.trim().length < 5) {
          Alert.alert('Reason required', `Enter a reason (>= 5 chars) for the below-floor price on ${it.productName}.`);
          return;
        }
      }
    }

    const payload: Parameters<typeof createQuotation>[0] = {
      customerId: customer.id,
      ...(factory?.id ? { factoryId: factory.id } : {}),
      brandCode,
      items: items.map<QuotationItemPayload>((it) => ({
        productId: it.productId,
        description: it.description,
        quantity: parseFloat(it.quantity),
        unit: it.unit,
        unitPrice: parseFloat(it.unitPrice),
        ...(it.discount ? { discount: parseFloat(it.discount) } : {}),
        ...(it.notes ? { notes: it.notes } : {}),
        ...(it.belowFloorReason ? { belowFloorReason: it.belowFloorReason } : {}),
        ...(it.originCountry ? { originCountry: it.originCountry } : {}),
      })),
      ...(validUntil ? { validUntil } : {}),
      currency,
      ...(discount ? { discount: parseFloat(discount) } : {}),
      discountType,
      ...(taxRate ? { taxRate: parseFloat(taxRate) } : {}),
      ...(terms ? { terms } : {}),
      ...(notes ? { notes } : {}),
      displayAreaUnit,
      displayDimensionUnit,
    };

    setSubmitting(true);
    try {
      const res = await createQuotation(payload);
      if (res.autoAddedBrand) {
        Alert.alert('Quotation created', `${res.data.quotationNumber ?? 'New quotation'} saved. Customer is now also a ${res.autoAddedBrand} relationship.`);
      } else {
        Alert.alert('Quotation created', res.data.quotationNumber ?? 'New quotation saved.');
      }
      router.replace(`/quotation/${res.data.id}`);
    } catch (err: any) {
      Alert.alert('Save failed', err.message || 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPickers) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>New Quotation</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Brand picker — single-select pills (hidden for single-brand users) */}
        {accessibleBrands.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.label}>Brand</Text>
            <View style={styles.pillRow}>
              {accessibleBrands.map((code) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.brandPill, brandCode === code && styles.brandPillActive]}
                  onPress={() => { setBrandCode(code); setItems([]); /* drop items so brand mismatch can't happen */ }}
                >
                  <BrandBadge code={code} size="sm" showLabel={false} />
                  <Text style={[styles.brandPillText, brandCode === code && styles.brandPillTextActive]}>{code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Customer */}
        <View style={styles.section}>
          <Text style={styles.label}>Customer *</Text>
          <TouchableOpacity style={styles.pickerField} onPress={() => setShowCustomerPicker(true)}>
            <Text style={customer ? styles.pickerValue : styles.pickerPlaceholder}>
              {customer ? (customer.companyName ?? customer.name ?? customer.id) : 'Select customer…'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Phase 4.9 C-3: display-unit toggles. Locks at send. */}
        <View style={styles.section}>
          <Text style={styles.label}>Units (locks on send)</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Area</Text>
              <View style={styles.unitToggleRow}>
                {(['sqm', 'sqft'] as const).map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitToggle, displayAreaUnit === u && styles.unitToggleActive]}
                    onPress={() => setDisplayAreaUnit(u)}
                  >
                    <Text style={[styles.unitToggleText, displayAreaUnit === u && styles.unitToggleTextActive]}>
                      {u === 'sqm' ? 'm²' : 'ft²'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Dimension</Text>
              <View style={styles.unitToggleRow}>
                {(['mm', 'inch'] as const).map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitToggle, displayDimensionUnit === u && styles.unitToggleActive]}
                    onPress={() => setDisplayDimensionUnit(u)}
                  >
                    <Text style={[styles.unitToggleText, displayDimensionUnit === u && styles.unitToggleTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Factory (optional) */}
        <View style={styles.section}>
          <Text style={styles.label}>Factory (optional)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.pickerField, { flex: 1 }]} onPress={() => setShowFactoryPicker(true)}>
              <Text style={factory ? styles.pickerValue : styles.pickerPlaceholder}>
                {factory ? factory.companyName : 'Select factory…'}
              </Text>
            </TouchableOpacity>
            {factory ? (
              <TouchableOpacity style={styles.clearBtn} onPress={() => setFactory(null)}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Line items */}
        <View style={styles.section}>
          <View style={styles.itemsHeader}>
            <Text style={styles.label}>Line items *</Text>
            <TouchableOpacity style={styles.addItemBtn} onPress={openAddItem}>
              <Text style={styles.addItemBtnText}>+ Add product</Text>
            </TouchableOpacity>
          </View>
          {items.length === 0 ? (
            <Text style={styles.emptyHint}>No items yet. Tap "+ Add product" to start.</Text>
          ) : items.map((it, idx) => {
            const q = parseFloat(it.quantity) || 0;
            const p = parseFloat(it.unitPrice) || 0;
            const d = parseFloat(it.discount) || 0;
            const lineTotal = q * p - d;
            const belowFloor = it.baseFobPrice != null && p > 0 && p < it.baseFobPrice;
            return (
              <View key={it.uid} style={styles.lineItem}>
                <View style={styles.lineHeader}>
                  <Text style={styles.lineProductName} numberOfLines={1}>{it.productName}</Text>
                  <TouchableOpacity onPress={() => removeItem(idx)}><Text style={styles.removeBtn}>✕</Text></TouchableOpacity>
                </View>
                {it.productSku ? <Text style={styles.lineSku}>{it.productSku}</Text> : null}

                <View style={styles.lineGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Qty</Text>
                    <TextInput
                      style={styles.numInput}
                      keyboardType="decimal-pad"
                      value={it.quantity}
                      onChangeText={(v) => updateItem(idx, { quantity: v })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Unit</Text>
                    <TouchableOpacity style={styles.unitPill} onPress={() => {
                      const next = UNITS[(UNITS.indexOf(it.unit) + 1) % UNITS.length];
                      updateItem(idx, { unit: next });
                    }}>
                      <Text style={styles.unitPillText}>{it.unit}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.fieldLabel}>Price USD</Text>
                    <TextInput
                      style={[styles.numInput, belowFloor && styles.numInputWarn]}
                      keyboardType="decimal-pad"
                      value={it.unitPrice}
                      onChangeText={(v) => updateItem(idx, { unitPrice: v })}
                    />
                  </View>
                </View>

                {/* Phase 4.9 C-3: origin picker. Only when product has variants. */}
                {it.originVariants.length > 0 && (
                  <View style={styles.originBlock}>
                    <Text style={styles.fieldLabel}>Origin</Text>
                    <View style={styles.originPillRow}>
                      {it.originVariants.map(v => (
                        <TouchableOpacity
                          key={v.originCountry}
                          style={[styles.originPill, it.originCountry === v.originCountry && styles.originPillActive]}
                          onPress={() => {
                            updateItem(idx, {
                              originCountry: v.originCountry,
                              unitPrice: String(v.fobPriceUsd),
                            });
                          }}
                        >
                          <Text style={[styles.originPillText, it.originCountry === v.originCountry && styles.originPillTextActive]}>
                            {v.originCountry} · {v.fobPriceUsd.toFixed(2)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {belowFloor && (
                  <View style={styles.belowFloorBox}>
                    <Text style={styles.belowFloorText}>
                      Below floor (${it.baseFobPrice?.toFixed(2)}). {isSuperAdmin ? 'Reason required (>= 5 chars).' : 'Super-admin only.'}
                    </Text>
                    {isSuperAdmin && (
                      <TextInput
                        style={styles.reasonInput}
                        placeholder="Reason for below-floor price…"
                        placeholderTextColor={COLORS.muted}
                        value={it.belowFloorReason}
                        onChangeText={(v) => updateItem(idx, { belowFloorReason: v })}
                        multiline
                      />
                    )}
                  </View>
                )}

                <View style={styles.lineGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Line discount USD</Text>
                    <TextInput
                      style={styles.numInput}
                      keyboardType="decimal-pad"
                      value={it.discount}
                      onChangeText={(v) => updateItem(idx, { discount: v })}
                    />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.fieldLabel}>Notes</Text>
                    <TextInput
                      style={styles.textInput}
                      value={it.notes}
                      onChangeText={(v) => updateItem(idx, { notes: v })}
                      placeholder="(optional)"
                      placeholderTextColor={COLORS.muted}
                    />
                  </View>
                </View>

                <Text style={styles.lineTotal}>Line total: ${lineTotal.toFixed(2)}</Text>

                {/* Phase 4.9 C-3: USA landed-cost preview per line. */}
                {(() => {
                  if (!isUSDestination || !it.originCountry) return null;
                  const tariff = lookupTariff(it.originCountry, destinationCountry, brandCode);
                  if (!tariff) {
                    return (
                      <Text style={styles.tariffMissing}>
                        No active tariff for {it.originCountry} → {destinationCountry}. Add it on desktop before sending.
                      </Text>
                    );
                  }
                  const ratePct = Number(tariff.ratePercent);
                  const fob = parseFloat(it.unitPrice || '0');
                  const landedUnit = fob * (1 + ratePct / 100);
                  const landedTotal = landedUnit * q;
                  const expires = new Date(tariff.effectiveUntil);
                  const expiresSoon = (expires.getTime() - Date.now()) / 86400000 <= 7;
                  return (
                    <View style={[styles.tariffBox, expiresSoon && styles.tariffBoxWarn]}>
                      <Text style={styles.tariffHeader}>
                        USA landed ({it.originCountry} → {destinationCountry}, {ratePct.toFixed(4)}%)
                      </Text>
                      <Text style={styles.tariffLine}>
                        Landed/unit: ${landedUnit.toFixed(2)} · Total: ${landedTotal.toFixed(2)}
                      </Text>
                      <Text style={[styles.tariffMeta, expiresSoon && styles.tariffMetaWarn]}>
                        Source expires {tariff.effectiveUntil}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            );
          })}
        </View>

        {/* Validity + currency */}
        <View style={[styles.section, { flexDirection: 'row', gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Valid until</Text>
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.muted}
              value={validUntil}
              onChangeText={setValidUntil}
              autoCapitalize="none"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Currency</Text>
            <TouchableOpacity style={styles.pickerField} onPress={() => setShowCurrencyPicker(true)}>
              <Text style={styles.pickerValue}>{currency}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Discount + tax */}
        <View style={[styles.section, { flexDirection: 'row', gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Overall discount</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TextInput
                style={[styles.numInput, { flex: 1 }]}
                keyboardType="decimal-pad"
                value={discount}
                onChangeText={setDiscount}
                placeholder="0"
                placeholderTextColor={COLORS.muted}
              />
              <TouchableOpacity
                style={styles.discountTypeToggle}
                onPress={() => setDiscountType(discountType === 'fixed' ? 'percentage' : 'fixed')}
              >
                <Text style={styles.discountTypeText}>{discountType === 'fixed' ? '$' : '%'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Tax rate %</Text>
            <TextInput
              style={styles.numInput}
              keyboardType="decimal-pad"
              value={taxRate}
              onChangeText={setTaxRate}
              placeholder="0"
              placeholderTextColor={COLORS.muted}
            />
          </View>
        </View>

        {/* Terms + notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Terms</Text>
          <TextInput
            style={[styles.textInput, styles.multiline]}
            value={terms}
            onChangeText={setTerms}
            multiline
            placeholder="Payment terms, delivery, warranty…"
            placeholderTextColor={COLORS.muted}
            spellCheck
            autoCorrect
            autoCapitalize="sentences"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Internal notes</Text>
          <TextInput
            style={[styles.textInput, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Not shown to customer."
            placeholderTextColor={COLORS.muted}
            spellCheck
            autoCorrect
            autoCapitalize="sentences"
          />
        </View>

        {/* Totals */}
        <View style={styles.totalsCard}>
          <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Subtotal</Text><Text style={styles.totalsValue}>${subtotal.toFixed(2)}</Text></View>
          {discountAmount > 0 ? <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Discount</Text><Text style={styles.totalsValue}>-${discountAmount.toFixed(2)}</Text></View> : null}
          {taxAmount > 0 ? <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Tax</Text><Text style={styles.totalsValue}>${taxAmount.toFixed(2)}</Text></View> : null}
          <View style={[styles.totalsRow, styles.totalsRowFinal]}>
            <Text style={styles.totalsLabelFinal}>Total {currency}</Text>
            <Text style={styles.totalsValueFinal}>${total.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, submitting && styles.saveBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>Save as draft</Text>}
        </TouchableOpacity>
        <Text style={styles.afterSaveHint}>You can review + Send via ERP from the quotation detail page after save.</Text>
      </ScrollView>

      {/* Picker modals */}
      <PickerModal
        visible={showCustomerPicker}
        title="Customer"
        items={customers}
        renderRow={(c) => ({ primary: (c.companyName ?? c.name ?? c.id), secondary: c.country || c.email || '' })}
        onPick={(c) => { setCustomer(c); setShowCustomerPicker(false); }}
        onClose={() => setShowCustomerPicker(false)}
        placeholder="Search customers…"
      />
      <PickerModal
        visible={showFactoryPicker}
        title="Factory"
        items={factories}
        renderRow={(f) => ({ primary: f.companyName, secondary: f.country || '' })}
        onPick={(f) => { setFactory(f); setShowFactoryPicker(false); }}
        onClose={() => setShowFactoryPicker(false)}
        placeholder="Search factories…"
      />
      <PickerModal
        visible={showProductPicker}
        title="Product"
        items={products}
        renderRow={(p) => ({ primary: p.name, secondary: `${p.sku || ''}${(p as any).baseFobPrice != null ? ` · floor $${(p as any).baseFobPrice}` : ''}` })}
        onPick={(p) => pickProduct(p)}
        onClose={() => { setShowProductPicker(false); setEditingLineIndex(null); }}
        placeholder="Search products…"
      />
      <Modal visible={showCurrencyPicker} transparent animationType="fade" onRequestClose={() => setShowCurrencyPicker(false)}>
        <TouchableOpacity style={styles.currencyOverlay} activeOpacity={1} onPress={() => setShowCurrencyPicker(false)}>
          <View style={styles.currencySheet}>
            {CURRENCIES.map((c) => (
              <TouchableOpacity key={c} style={styles.currencyOption} onPress={() => { setCurrency(c); setShowCurrencyPicker(false); }}>
                <Text style={[styles.currencyOptionText, currency === c && { color: COLORS.forest, fontWeight: '700' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.forest, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
  },
  backBtn:    { padding: 4 },
  backText:   { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  title:      { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  scroll:     { padding: 16, paddingBottom: 60 },
  section:    { marginBottom: 16 },
  label:      { fontSize: 12, fontWeight: '700', color: COLORS.steel, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },

  pickerField: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.muted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  pickerValue: { fontSize: 14, color: COLORS.ink, fontWeight: '500' },
  pickerPlaceholder: { fontSize: 14, color: COLORS.muted },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 12, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.muted },
  clearBtnText: { fontSize: 12, color: COLORS.steel, fontWeight: '600' },

  pillRow: { flexDirection: 'row', gap: 8 },
  brandPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.muted, backgroundColor: COLORS.white },
  brandPillActive: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  brandPillText: { fontSize: 12, color: COLORS.steel, fontWeight: '700' },
  brandPillTextActive: { color: COLORS.white },

  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  addItemBtn: { backgroundColor: COLORS.forest, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addItemBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  emptyHint: { color: COLORS.muted, fontStyle: 'italic', fontSize: 13, paddingVertical: 16, textAlign: 'center' },

  lineItem: { backgroundColor: COLORS.white, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineProductName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.ink },
  lineSku: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: COLORS.muted, marginTop: 2, marginBottom: 8 },
  removeBtn: { color: COLORS.error, fontSize: 18, padding: 4 },
  lineGrid: { flexDirection: 'row', gap: 8, marginTop: 6 },
  numInput: { backgroundColor: COLORS.cream, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8, fontSize: 13, color: COLORS.ink },
  numInputWarn: { borderColor: COLORS.warning, backgroundColor: '#FEF3C7' },
  textInput: { backgroundColor: COLORS.cream, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8, fontSize: 13, color: COLORS.ink },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  unitPill: { backgroundColor: COLORS.cream, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
  unitPillText: { fontSize: 13, color: COLORS.ink, fontWeight: '600' },
  belowFloorBox: { backgroundColor: '#FEF3C7', borderRadius: 6, padding: 8, marginTop: 8, borderWidth: 1, borderColor: COLORS.warning },
  belowFloorText: { fontSize: 12, color: '#92400E', marginBottom: 6 },
  reasonInput: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.warning, borderRadius: 6, padding: 8, fontSize: 13, minHeight: 48, textAlignVertical: 'top' },
  lineTotal: { fontSize: 13, fontWeight: '700', color: COLORS.forest, textAlign: 'right', marginTop: 8 },

  discountTypeToggle: { backgroundColor: COLORS.forest, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  discountTypeText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },

  totalsCard: { backgroundColor: COLORS.white, borderRadius: 10, padding: 14, marginVertical: 12, borderWidth: 1, borderColor: COLORS.border },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalsLabel: { fontSize: 13, color: COLORS.muted },
  totalsValue: { fontSize: 13, color: COLORS.ink, fontWeight: '500' },
  totalsRowFinal: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 6, paddingTop: 8 },
  totalsLabelFinal: { fontSize: 15, color: COLORS.ink, fontWeight: '700' },
  totalsValueFinal: { fontSize: 18, color: COLORS.forest, fontWeight: '800' },

  saveBtn: { backgroundColor: COLORS.forest, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  afterSaveHint: { color: COLORS.muted, fontSize: 11, textAlign: 'center', marginTop: 8 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.cream },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.forest, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14 },
  modalBack: { padding: 4 },
  modalBackText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  modalTitle: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  modalSearch: { backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: 16, marginBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.muted, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink },
  modalRow: { backgroundColor: COLORS.white, marginHorizontal: 16, marginVertical: 4, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  modalRowPrimary: { fontSize: 14, color: COLORS.ink, fontWeight: '600' },
  modalRowSecondary: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  modalEmpty: { textAlign: 'center', color: COLORS.muted, padding: 40, fontStyle: 'italic' },

  // Currency picker (bottom sheet)
  currencyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  currencySheet: { backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  currencyOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  currencyOptionText: { fontSize: 16, color: COLORS.ink, textAlign: 'center', fontWeight: '500' },

  // Phase 4.9 C-3: unit toggles
  unitToggleRow:  { flexDirection: 'row', borderWidth: 1, borderColor: COLORS.muted, borderRadius: 6, overflow: 'hidden', marginTop: 4 },
  unitToggle:     { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: COLORS.white },
  unitToggleActive: { backgroundColor: COLORS.forest },
  unitToggleText: { fontSize: 13, color: COLORS.steel, fontWeight: '600' },
  unitToggleTextActive: { color: COLORS.white },

  // Phase 4.9 C-3: per-line origin pills
  originBlock:    { marginTop: 8 },
  originPillRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  originPill:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.muted, backgroundColor: COLORS.white },
  originPillActive: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  originPillText: { fontSize: 12, color: COLORS.steel, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  originPillTextActive: { color: COLORS.white },

  // Phase 4.9 C-3: USA landed-cost preview
  tariffBox:     { marginTop: 8, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#F7F5F2' },
  tariffBoxWarn: { borderColor: '#FCD34D', backgroundColor: '#FEF3C7' },
  tariffHeader:  { fontSize: 11, fontWeight: '700', color: COLORS.ink },
  tariffLine:    { fontSize: 13, fontWeight: '700', color: COLORS.forest, marginTop: 3 },
  tariffMeta:    { fontSize: 10, color: COLORS.muted, marginTop: 3 },
  tariffMetaWarn:{ color: '#92400E', fontWeight: '600' },
  tariffMissing: { marginTop: 8, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEE2E2', fontSize: 11, color: '#991B1B' },
});
