// ─── Login Screen ─────────────────────────────────────────────────────────
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { login } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS, CONFIG } from '../../src/constants/config';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuthStore();
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Required', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { user } = await login(email.trim().toLowerCase(), password);
      setUser(user);
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      Alert.alert('Login failed', err.message ?? 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Wordmark */}
      <View style={styles.wordmark}>
        <Text style={styles.wordmarkTop}>SOVERN</Text>
        <View style={styles.wordmarkRule} />
        <Text style={styles.wordmarkBottom}>{'H O U S E'}</Text>
        <Text style={styles.tagline}>{CONFIG.TAGLINE}</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholderTextColor={COLORS.muted}
          placeholder="you@sovernhouse.co"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor={COLORS.muted}
          placeholder="••••••••"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.buttonText}>Sign in</Text>
          }
        </TouchableOpacity>

        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity style={{ marginTop: 16, alignSelf: 'center' }}>
            <Text style={{ color: COLORS.cream, fontSize: 13, fontWeight: '600', opacity: 0.85 }}>
              Forgot password?
            </Text>
          </TouchableOpacity>
        </Link>
      </View>

      <Text style={styles.footer}>Sovern Ops · Internal access only</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ink,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  wordmark: {
    alignItems: 'center',
    marginBottom: 48,
  },
  wordmarkTop: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 6,
  },
  wordmarkRule: {
    height: 3,
    width: 180,
    backgroundColor: COLORS.forest,
    marginVertical: 6,
  },
  wordmarkBottom: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: 8,
  },
  tagline: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  form: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#3A3A3A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.white,
  },
  button: {
    backgroundColor: COLORS.forest,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  footer: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 32,
  },
});
