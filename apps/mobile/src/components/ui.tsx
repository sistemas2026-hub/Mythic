import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { stockStatusLabel, type StockStatus } from '@mythic/core';
import { colors, fonts, radius, spacing } from '../theme';

export function StockBadge({ status }: { status: StockStatus }) {
  const palette = {
    ok: { bg: colors.greenBg, ink: colors.greenInk },
    low: { bg: colors.amberBg, ink: colors.amberInk },
    out: { bg: colors.redBg, ink: colors.redInk },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.ink }]}>
        {stockStatusLabel[status].toUpperCase()}
      </Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  loading,
  disabled,
  style,
  ...props
}: PressableProps & { label: string; loading?: boolean; style?: ViewStyle }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        isDisabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.ink} />
      {label ? <Text style={styles.loadingText}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.canvas,
  },
  loadingText: { color: colors.muted, fontFamily: fonts.mono, fontSize: 12 },
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink },
  emptySubtitle: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
