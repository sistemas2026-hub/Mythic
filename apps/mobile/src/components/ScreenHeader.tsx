import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  /** Muestra el botón de volver (por defecto sí). */
  showBack?: boolean;
}

/** Encabezado editorial para las pantallas de módulo abiertas desde el panel. */
export function ScreenHeader({ title, subtitle, showBack = true }: Props) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      {showBack && router.canGoBack() ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
      ) : null}
      <View style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle.toUpperCase()}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { backgroundColor: colors.canvas },
  backText: { fontSize: 18, color: colors.inkSoft, lineHeight: 20 },
  titles: { flex: 1 },
  title: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
    marginTop: 2,
  },
});
