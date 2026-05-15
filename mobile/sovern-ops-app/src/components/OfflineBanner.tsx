// ─── OfflineBanner (mobile) — Phase 5a ───────────────────────────────────
//
// Floating pill at the top of every screen when server is unreachable.
// Self-hides when online so single-render mobile screens stay clean.

import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useConnectivity, forcePingNow } from '../hooks/useConnectivity';

export default function OfflineBanner() {
  const { isOnline, lastError, lastChecked } = useConnectivity();
  if (isOnline) return null;

  const lastCheckedLabel = lastChecked
    ? new Date(lastChecked).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '--';

  return (
    <View style={styles.bar}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Offline</Text>
        <Text style={styles.detail} numberOfLines={2}>
          Server unreachable{lastError ? ` (${lastError})` : ''}. Last check {lastCheckedLabel}.
        </Text>
      </View>
      <TouchableOpacity onPress={() => forcePingNow()} style={styles.retry}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderBottomColor: '#FCA5A5',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingTop: Platform.OS === 'ios' ? 48 : 12,
  },
  title:  { color: '#991B1B', fontSize: 13, fontWeight: '700' },
  detail: { color: '#991B1B', fontSize: 11, marginTop: 1 },
  retry:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: '#991B1B', backgroundColor: '#FFFFFF' },
  retryText: { color: '#991B1B', fontSize: 12, fontWeight: '600' },
});
