// ProductBrandingModePicker — Phase 3, C12 mobile.
//
// Renders in the customers tab modal when the customer's
// brandRelationships includes 'FW'. Three pills (IronLite / Generic /
// Private Label). Tapping a different pill PATCHes the customer.
//
// Lock UX: when productBrandingModeLockedAt is set, the pills are
// disabled with a small banner: "Locked. Use desktop ERP to override."
// Super-admin override stays desktop-only (the override dialog is
// reason-bound and more naturally lives on a larger screen).
//
// Calls onSaved(updatedCustomer) after each successful change.

import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
import { COLORS } from '../constants/config';
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '../constants/config';
import type { Customer } from '../services/api';

type Mode = 'ironlite' | 'generic' | 'private_label';

const PILLS: { code: Mode; label: string }[] = [
  { code: 'ironlite',      label: 'IronLite' },
  { code: 'generic',       label: 'Generic' },
  { code: 'private_label', label: 'Private Label' },
];

export default function ProductBrandingModePicker({
  customer,
  onSaved,
}: {
  customer: Customer;
  onSaved: (next: Customer) => void;
}) {
  const [mode, setMode] = useState<Mode>(customer.productBrandingMode || 'generic');
  const [labelName, setLabelName] = useState(customer.privateLabelProductName || '');
  const [saving, setSaving] = useState(false);

  const isLocked = !!customer.productBrandingModeLockedAt;

  async function save(nextMode: Mode, nextName: string) {
    if (nextMode === 'private_label' && !nextName.trim()) {
      Alert.alert('Required', 'Private label brand name is required.');
      return;
    }
    setSaving(true);
    try {
      const token = await SecureStore.getItemAsync(CONFIG.TOKEN_KEY);
      const res = await fetch(`${CONFIG.SERVER_URL}/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          productBrandingMode: nextMode,
          privateLabelProductName: nextMode === 'private_label' ? nextName.trim() : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? 'Update failed');
      onSaved(body.data || body);
    } catch (err: any) {
      Alert.alert('Update failed', err.message ?? 'Server error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>FW Branding Mode</Text>
        {isLocked && <Text style={styles.lockBadge}>LOCKED</Text>}
      </View>
      <Text style={styles.subheading}>
        Drives the FlorWay quotation variant. {isLocked ? 'Locked once a quotation has been sent under the current mode. Use desktop ERP to override.' : ''}
      </Text>

      <View style={styles.pillsRow}>
        {PILLS.map((p) => {
          const active = mode === p.code;
          return (
            <TouchableOpacity
              key={p.code}
              disabled={isLocked || saving}
              onPress={() => {
                setMode(p.code);
                if (p.code !== 'private_label') save(p.code, '');
              }}
              activeOpacity={0.7}
              style={[
                styles.pill,
                active && styles.pillActive,
                (isLocked || saving) && styles.pillDisabled,
              ]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {mode === 'private_label' && !isLocked && (
        <View style={{ marginTop: 10 }}>
          <TextInput
            value={labelName}
            onChangeText={setLabelName}
            placeholder="Buyer's brand name (e.g. OakCove Flooring)"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            editable={!saving}
          />
          <TouchableOpacity
            onPress={() => save('private_label', labelName)}
            disabled={saving}
            style={[styles.saveBtn, saving && styles.pillDisabled]}
            activeOpacity={0.7}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save private label name'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card:        { backgroundColor: COLORS.white, borderRadius: 10, padding: 12, marginBottom: 12 },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  heading:     { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  subheading:  { fontSize: 11, color: COLORS.muted, marginBottom: 10, lineHeight: 16 },
  lockBadge:   { fontSize: 10, fontWeight: '800', color: '#92400E', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pillsRow:    { flexDirection: 'row', gap: 6 },
  pill:        { flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center' },
  pillActive:  { backgroundColor: '#1F2933', borderColor: '#1F2933' },
  pillDisabled:{ opacity: 0.5 },
  pillText:    { fontSize: 12, fontWeight: '600', color: COLORS.ink },
  pillTextActive: { color: '#FFFFFF' },
  input:       { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 8, fontSize: 13, color: COLORS.ink, marginBottom: 8 },
  saveBtn:     { backgroundColor: '#1F2933', padding: 10, borderRadius: 6, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
