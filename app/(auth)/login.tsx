import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { ValidationErrors } from '../../api/sanitize';
import { colors } from '../../lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const { signIn } = useAuthStore();

  const handleLogin = async () => {
    setLoading(true);
    setFieldErrors({});
    const { error, validationErrors } = await signIn(email, password);
    setLoading(false);
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
    } else if (error) {
      Alert.alert('Login failed', error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>🔥</Text>
        <Text style={styles.title}>HabitTracker</Text>
        <Text style={styles.subtitle}>Build streaks. Build yourself.</Text>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, fieldErrors.email ? styles.inputError : null]}
            placeholder="Email"
            placeholderTextColor={colors.dark.text.tertiary}
            value={email}
            onChangeText={(v) => { setEmail(v); setFieldErrors((e) => ({ ...e, email: '' })); }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
          <TextInput
            style={[styles.input, fieldErrors.password ? styles.inputError : null]}
            placeholder="Password"
            placeholderTextColor={colors.dark.text.tertiary}
            value={password}
            onChangeText={(v) => { setPassword(v); setFieldErrors((e) => ({ ...e, password: '' })); }}
            secureTextEntry
            autoComplete="password"
          />
          {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity style={styles.link}>
              <Text style={styles.linkText}>Don't have an account? Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark.bg.primary },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: colors.dark.text.primary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.dark.text.secondary, textAlign: 'center', marginBottom: 40, marginTop: 4 },
  form: { gap: 12 },
  input: {
    backgroundColor: colors.dark.input,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.dark.text.primary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  inputError: { borderColor: colors.error },
  fieldError: { fontSize: 12, color: colors.error, marginTop: -6 },
  link: { paddingVertical: 12, alignItems: 'center' },
  linkText: { color: colors.primary, fontSize: 14 },
});
