import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, listSales, summarizeTodaySales } from '@mythic/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { EmptyState, Loading } from '../../src/components/ui';
import { colors, fonts, radius, spacing } from '../../src/theme';

export default function Reports() {
  const { profile } = useAuth();
  const storeId = profile?.store_id ?? null;

  const query = useQuery({
    queryKey: ['sales', storeId],
    queryFn: () => listSales(supabase, storeId as string, 200),
    enabled: !!storeId,
  });

  const stats = useMemo(() => summarizeTodaySales(query.data ?? []), [query.data]);

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState title="Sin sucursal asignada" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appbar}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.sub}>HOY</Text>
      </View>

      {query.isLoading ? (
        <Loading label="Cargando ventas…" />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.kpis}>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>VENTAS HOY</Text>
              <Text style={styles.kpiValue}>{formatMoney(stats.revenue)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>N.º DE VENTAS</Text>
              <Text style={styles.kpiValue}>{stats.count}</Text>
            </View>
            <View style={[styles.kpi, styles.kpiWide]}>
              <Text style={styles.kpiLabel}>TICKET PROMEDIO</Text>
              <Text style={styles.kpiValue}>{formatMoney(stats.average)}</Text>
            </View>
          </View>
          <Text style={styles.note}>
            Para ver la evolución de las ventas y los productos más vendidos, abre Estadísticas
            desde el panel de módulos.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  appbar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
  sub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
    marginTop: 2,
  },
  body: { padding: spacing.lg, gap: spacing.lg },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  kpiWide: { flexBasis: '100%' },
  kpiLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.8, color: colors.muted },
  kpiValue: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, marginTop: spacing.sm },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
