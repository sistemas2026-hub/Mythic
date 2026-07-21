import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, getTopProducts, listSales } from '@mythic/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { EmptyState, Loading } from '../../src/components/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../src/theme';

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

interface DayBucket {
  label: string;
  total: number;
  isToday: boolean;
}

/** Construye los últimos 7 días (del más antiguo a hoy) con su total vendido. */
function buildWeek(sales: { created_at: string; total: number; status: string }[]): DayBucket[] {
  const days: DayBucket[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);

    const total = sales
      .filter((s) => s.status === 'completada')
      .filter((s) => {
        const t = new Date(s.created_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      })
      .reduce((sum, s) => sum + s.total, 0);

    days.push({ label: DAY_LETTERS[d.getDay()] ?? '', total, isToday: i === 0 });
  }
  return days;
}

export default function Stats() {
  const { profile } = useAuth();
  const storeId = profile?.store_id ?? null;

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const salesQuery = useQuery({
    queryKey: ['sales', storeId],
    queryFn: () => listSales(supabase, storeId as string, 500),
    enabled: !!storeId,
  });
  const topQuery = useQuery({
    queryKey: ['top-products', storeId, since],
    queryFn: () => getTopProducts(supabase, storeId as string, since),
    enabled: !!storeId,
  });

  const week = useMemo(() => buildWeek(salesQuery.data ?? []), [salesQuery.data]);
  const max = Math.max(...week.map((d) => d.total), 1);
  const weekTotal = week.reduce((s, d) => s + d.total, 0);

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Estadísticas" />
        <EmptyState title="Sin sucursal asignada" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Estadísticas" subtitle="Últimos 7 días" />
      {salesQuery.isLoading ? (
        <Loading label="Cargando…" />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardLabel}>VENTAS POR DÍA</Text>
              <Text style={styles.cardTotal}>{formatMoney(weekTotal)}</Text>
            </View>
            <View style={styles.chart}>
              {week.map((d, i) => (
                <View key={i} style={styles.col}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        { height: `${Math.max((d.total / max) * 100, d.total > 0 ? 4 : 1)}%` },
                        d.isToday ? styles.barToday : styles.barPast,
                      ]}
                    />
                  </View>
                  <Text style={styles.colLabel}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>MÁS VENDIDOS</Text>
            {topQuery.isLoading ? (
              <Text style={styles.empty}>Cargando…</Text>
            ) : (topQuery.data ?? []).length === 0 ? (
              <Text style={styles.empty}>Aún no hay ventas en este periodo.</Text>
            ) : (
              (topQuery.data ?? []).map((p) => (
                <View key={p.name} style={styles.topRow}>
                  <Text style={styles.topQty}>{p.quantity} u</Text>
                  <Text style={styles.topName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.topRevenue}>{formatMoney(p.revenue)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  cardLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.9, color: colors.muted },
  cardTotal: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 132 },
  col: { flex: 1, alignItems: 'center', gap: spacing.sm },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barPast: { backgroundColor: '#D9D7D1' },
  barToday: { backgroundColor: colors.ink },
  colLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  topQty: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted, minWidth: 38 },
  topName: { flex: 1, fontSize: 13, color: colors.ink },
  topRevenue: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink },
  empty: { color: colors.muted, fontSize: 13, paddingTop: spacing.sm },
});
