// ─── Forgot Password ─────────────────────────────────────────────────────
// One-step screen: enter email, hit endpoint, show confirmation. Backend
// sends the reset link by email (POST /api/auth/forgot-password).
import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { requestPasswordReset } from '../../src/services/api'
import { COLORS, CONFIG } from '../../src/constants/config'

export default function ForgotPasswordScreen() {
  const [email, setEmail]   = useState('')
  const [loading, setLoad]  = useState(false)
  const [sent, setSent]     = useState(false)
  const router              = useRouter()

  async function handleSubmit() {
    if (!email.trim()) {
      Alert.alert('Required', 'Enter the email on your account.')
      return
    }
    setLoad(true)
    try {
      await requestPasswordReset(email.trim().toLowerCase())
      // Backend always returns 200 even if email isn't found (anti-enum) so
      // we just show the same confirmation either way.
      setSent(true)
    } catch (err: any) {
      Alert.alert('Could not send', err.message ?? 'Please try again in a moment.')
    } finally {
      setLoad(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brand}>
        <Text style={styles.brandText}>{CONFIG.BRAND_NAME}</Text>
      </View>

      <View style={styles.card}>
        {sent ? (
          <>
            <Text style={styles.icon}>✉️</Text>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              If an account exists for {email.trim()}, we've sent a reset link.
              The link expires in 1 hour.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
              <Text style={styles.btnText}>Back to login</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.subtitle}>
              Enter the email on your Sovern Ops account. We'll send you a
              link to set a new password.
            </Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="alex@sovernhouse.co"
              placeholderTextColor={COLORS.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.btnText}>Send reset link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, alignSelf: 'center' }}>
              <Text style={styles.linkText}>Back to login</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream, justifyContent: 'center', padding: 20 },
  brand:     { alignItems: 'center', marginBottom: 28 },
  brandText: { fontSize: 22, fontWeight: '800', color: COLORS.forest, letterSpacing: 1 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  icon:     { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title:    { fontSize: 22, fontWeight: '700', color: COLORS.ink, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  label:    { fontSize: 12, color: COLORS.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14,
    fontSize: 15, color: COLORS.ink, backgroundColor: COLORS.cream,
    marginBottom: 18,
  },
  btn: {
    backgroundColor: COLORS.forest, paddingVertical: 14, borderRadius: 10,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText:    { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  linkText:   { color: COLORS.forest, fontSize: 13, fontWeight: '600' },
})
