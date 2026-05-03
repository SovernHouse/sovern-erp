// ─── Settings Screen ──────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { logout } from '../../src/services/api';
import { COLORS, CONFIG } from '../../src/constants/config';

function SettingRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ?? '—'}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { user, clearUser } = useAuthStore();
  const router = useRouter();

  function handleLogout() {
    Alert.alert(
      'Sign out',
      'You will be signed out of Sovern Ops.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            clearUser();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      {/* Profile */}
      <View style={styles.profileBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0)?.toUpperCase() ?? 'A'}
          </Text>
        </View>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileRole}>{user?.role?.toUpperCase()}</Text>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <SettingRow label="Email" value={user?.email} />
        <SettingRow label="Role" value={user?.role} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <SettingRow label="Server" value={CONFIG.SERVER_URL} />
        <SettingRow label="Version" value="1.0.0" />
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    padding: 20,
  },
  profileBlock: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.forest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.ink,
  },
  profileRole: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: 1.5,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rowLabel: { fontSize: 14, color: COLORS.ink },
  rowValue: { fontSize: 14, color: COLORS.muted, maxWidth: '60%', textAlign: 'right' },
  logoutBtn: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginTop: 8,
  },
  logoutText: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: 16,
  },
});
