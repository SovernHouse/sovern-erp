// ─── Offline Queue Inspector (mobile) — Phase 5g ────────────────────────
//
// Mirror of /settings/offline-queue. List of pending + recent writes
// with dismiss. Drains on offline->online edge automatically (5f); this
// screen exposes a manual "Drain now" button for the impatient.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { queueListMobile, type QueuedWrite } from '../src/services/offlineCache';
import { drainQueueMobile, dismissQueuedMobile, subscribeQueueEvents } from '../src/services/offlineWriteQueue';
import { useConnectivity } from '../src/hooks/useConnectivity';
import { COLORS } from '../src/constants/config';

const STATUS_COLOR: Record<QueuedWrite['status'], { bg: string; fg: string; label: string }> = {
  queued:           { bg: '#F1F5F9', fg: '#475569', label: 'Queued' },
  in_progress:      { bg: '#DBEAFE', fg: '#1E40AF', label: 'In flight' },
  replayed:         { bg: '#DCFCE7', fg: '#166534', label: 'Replayed' },
  failed_retryable: { bg: '#FEF3C7', fg: '#92400E', label: 'Will retry' },
  failed_permanent: { bg: '#FEE2E2', fg: '#991B1B', label: 'Failed' },
};

function fmtTime(ms: number | null) {
  if (!ms) return '--';
  return new Date(ms).toLocaleString('en-GB', { hour12: false });
}

export default function OfflineQueueScreen() {
  const router = useRouter();
  const conn = useConnectivity();
  const [rows, setRows] = useState<QueuedWrite[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const all = await queueListMobile();
    setRows(all.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    refresh();
    const unsub = subscribeQueueEvents(() => refresh());
    const t = setInterval(refresh, 5000);
    return () => { unsub(); clearInterval(t); };
  }, [refresh]);

  const onDrain = async () => {
    const out = await drainQueueMobile();
    if (out?.skipped) Alert.alert('Skipped', out.skipped);
    else Alert.alert('Drained', `Replayed ${out?.processed ?? 0}`);
    refresh();
  };

  const onDismiss = (id: string) => {
    Alert.alert('Dismiss?', 'This queued write will not be sent.', [
      { text: 'Cancel' },
      { text: 'Dismiss', style: 'destructive', onPress: async () => { await dismissQueuedMobile(id); refresh(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Offline queue</Text>
        <TouchableOpacity onPress={onDrain} disabled={!conn.isOnline} style={[styles.drainBtn, !conn.isOnline && styles.drainBtnDisabled]}>
          <Text style={styles.drainText}>Drain</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        {conn.isOnline ? 'Online. Pending writes replay automatically.' : 'Offline. Writes queue locally until reconnection.'}
      </Text>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} tintColor={COLORS.forest} />}
        contentContainerStyle={rows.length === 0 ? { flex: 1, justifyContent: 'center' } : { padding: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>Queue is empty.</Text>}
        renderItem={({ item }) => {
          const pill = STATUS_COLOR[item.status];
          return (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                  <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
                </View>
                <Text style={styles.method}>{item.method}</Text>
              </View>
              <Text style={styles.path} numberOfLines={1}>{item.path}</Text>
              <Text style={styles.meta}>created {fmtTime(item.createdAt)} · attempts {item.attempts}{item.replayedAt ? ` · replayed ${fmtTime(item.replayedAt)}` : ''}</Text>
              {item.lastError ? <Text style={styles.err} numberOfLines={2}>{item.lastError}</Text> : null}
              {(item.status === 'queued' || item.status === 'failed_permanent' || item.status === 'failed_retryable') && (
                <TouchableOpacity onPress={() => onDismiss(item.id)} style={styles.dismiss}>
                  <Text style={styles.dismissText}>Dismiss</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.forest, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14 },
  backBtn:   { padding: 4 },
  backText:  { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  title:     { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  drainBtn:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: COLORS.white },
  drainBtnDisabled: { opacity: 0.4 },
  drainText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  subtitle:  { fontSize: 12, color: COLORS.muted, padding: 12 },
  empty:     { textAlign: 'center', color: COLORS.muted, fontStyle: 'italic' },
  row:       { backgroundColor: COLORS.white, borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  rowTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  pill:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillText:  { fontSize: 11, fontWeight: '700' },
  method:    { fontSize: 11, fontWeight: '700', color: COLORS.muted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  path:      { fontSize: 12, color: COLORS.ink, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 4 },
  meta:      { fontSize: 10, color: COLORS.muted },
  err:       { fontSize: 11, color: '#991B1B', marginTop: 4 },
  dismiss:   { marginTop: 8, alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#991B1B', borderRadius: 4 },
  dismissText: { color: '#991B1B', fontSize: 11, fontWeight: '600' },
});
