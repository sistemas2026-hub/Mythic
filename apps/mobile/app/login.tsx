import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/lib/auth';
import { PrimaryButton } from '../src/components/ui';
import { colors, fonts, radius, spacing } from '../src/theme';

export default function Login() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Redirect href="/(app)/pos" />;

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError('No pudimos iniciar sesión. Revisa el correo y la contraseña.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Text style={styles.markText}>M</Text>
          </View>
          <Text style={styles.word}>MYTHIC</Text>
          <Text style={styles.tag}>PERFUMERÍA</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>CORREO</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="vendedor@mythic.co"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            inputMode="email"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>CONTRASEÑA</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoComplete="password"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label="Ingresar"
          loading={submitting}
          disabled={!email || !password}
          onPress={onSubmit}
          style={styles.submit}
        />

        <Text style={styles.foot}>Acceso por rol: administrador · vendedor</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  mark: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  markText: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  word: { fontFamily: fonts.serif, fontSize: 30, letterSpacing: 2, color: colors.ink },
  tag: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 4,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.inkSoft,
  },
  error: { color: colors.redInk, fontSize: 13 },
  submit: { marginTop: spacing.sm },
  foot: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: spacing.sm },
});
