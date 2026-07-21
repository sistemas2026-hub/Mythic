import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

interface Props {
  label: string;
  count: number;
  /** Palabra bajo el número: "artículos", "insumos", "perfumes"… */
  noun: string;
  low?: number;
  out?: number;
  onPress: () => void;
}

/** Tarjeta de conteo usada para familias y para tipos dentro de una familia. */
export function CountCard({ label, count, noun, low = 0, out = 0, onPress }: Props) {
  const alerts: string[] = [];
  if (low > 0) alerts.push(`${low} bajo`);
  if (out > 0) alerts.push(`${out} agotado${out === 1 ? '' : 's'}`);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.noun}>{noun}</Text>
      {alerts.length > 0 ? (
        <View style={[styles.pill, out > 0 ? styles.pillRed : styles.pillAmber]}>
          <Text style={[styles.pillText, out > 0 ? styles.pillTextRed : styles.pillTextAmber]}>
            {alerts.join(' · ').toUpperCase()}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    minHeight: 118,
  },
  cardPressed: { backgroundColor: colors.surface2, transform: [{ scale: 0.99 }] },
  label: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.9, color: colors.muted },
  count: { fontFamily: fonts.serif, fontSize: 28, color: colors.ink, marginTop: spacing.sm },
  noun: { fontSize: 12, color: colors.muted, marginTop: 2 },
  pill: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  pillAmber: { backgroundColor: colors.amberBg },
  pillRed: { backgroundColor: colors.redBg },
  pillText: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.5 },
  pillTextAmber: { color: colors.amberInk },
  pillTextRed: { color: colors.redInk },
});
