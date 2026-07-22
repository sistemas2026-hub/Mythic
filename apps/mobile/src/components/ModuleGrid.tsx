import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';

export interface ModuleItem {
  key: string;
  /** Etiqueta del módulo, en mayúsculas dentro de la tarjeta. */
  label: string;
  /** Dato principal en vivo (ej. "$2.5M", "248"). */
  metric?: string;
  /** Aclaración bajo la métrica (ej. "3 con stock bajo"). */
  subtitle?: string;
  /** Ruta a la que navega. Si falta, la tarjeta se muestra deshabilitada. */
  href?: string;
  /** Ocupa el ancho completo del bento. */
  wide?: boolean;
  /** Tarjeta de menor altura, para módulos sin métrica. */
  compact?: boolean;
}

/**
 * Rejilla bento de módulos del sistema. Las tarjetas entran en cascada,
 * respetando la preferencia de "reducir movimiento".
 */
export function ModuleGrid({ modules }: { modules: ModuleItem[] }) {
  const router = useRouter();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduceMotion(v);
    });
    return () => {
      active = false;
    };
  }, []);

  const anims = useMemo(
    () => modules.map(() => new Animated.Value(0)),
    // Se recrean solo si cambia la cantidad de tarjetas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modules.length],
  );

  useEffect(() => {
    if (reduceMotion) {
      anims.forEach((a) => a.setValue(1));
      return;
    }
    Animated.stagger(
      70,
      anims.map((a) => Animated.timing(a, { toValue: 1, duration: 420, useNativeDriver: true })),
    ).start();
  }, [anims, reduceMotion]);

  return (
    <View style={styles.grid}>
      {modules.map((m, i) => {
        const disabled = !m.href;
        const anim = anims[i];
        return (
          <Animated.View
            key={m.key}
            style={[
              styles.cardWrap,
              m.wide && styles.cardWide,
              anim && {
                opacity: anim,
                transform: [
                  { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                ],
              },
            ]}
          >
            <Pressable
              onPress={() => m.href && router.push(m.href)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              style={({ pressed }) => [
                styles.card,
                m.compact && styles.cardCompact,
                pressed && !disabled && styles.cardPressed,
                disabled && styles.cardDisabled,
              ]}
            >
              <Text style={styles.cardLabel}>{m.label.toUpperCase()}</Text>
              {m.metric ? <Text style={styles.cardMetric}>{m.metric}</Text> : null}
              {m.subtitle ? <Text style={styles.cardSubtitle}>{m.subtitle}</Text> : null}
              {disabled ? (
                <View style={styles.soonBadge}>
                  <Text style={styles.soonText}>PRÓXIMAMENTE</Text>
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', gap: spacing.sm },
  cardWrap: { flexGrow: 1, flexBasis: '47%' },
  cardWide: { flexBasis: '100%' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    minHeight: 104,
  },
  cardCompact: { minHeight: 0, paddingVertical: spacing.md },
  cardPressed: { transform: [{ scale: 0.985 }], backgroundColor: colors.surface2 },
  cardDisabled: { opacity: 0.5 },
  cardLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.9, color: colors.muted },
  cardMetric: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  cardSubtitle: { fontSize: 12, color: colors.muted, marginTop: 3, lineHeight: 16 },
  soonBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: colors.amberBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  soonText: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.6, color: colors.amberInk },
});
