import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  countCustomers,
  countPendingOrders,
  formatMoney,
  getInventorySummary,
  getStore,
  listSales,
  summarizeTodaySales,
} from '@mythic/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { ModuleGrid, type ModuleItem } from '../../src/components/ModuleGrid';
import { EmptyState } from '../../src/components/ui';
import { colors, fonts, radius, spacing } from '../../src/theme';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Compacta montos grandes para las tarjetas ($2.5M en vez de $2.558.500). */
function compactMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return formatMoney(amount);
}

/** "1 agotado" / "3 agotados" */
function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** Mensaje de alerta de inventario, o null si no hay nada que avisar. */
function stockAlert(out: number, low: number): string | null {
  const parts: string[] = [];
  if (out > 0) parts.push(plural(out, 'producto agotado', 'productos agotados'));
  if (low > 0) parts.push(`${low} con stock bajo`);
  return parts.length > 0 ? parts.join(' y ') : null;
}

export default function Home() {
  const { profile } = useAuth();
  const router = useRouter();
  const storeId = profile?.store_id ?? null;
  const enabled = !!storeId;

  const salesQuery = useQuery({
    queryKey: ['sales', storeId],
    queryFn: () => listSales(supabase, storeId as string, 200),
    enabled,
  });
  const inventoryQuery = useQuery({
    queryKey: ['inventory-summary', storeId],
    queryFn: () => getInventorySummary(supabase, storeId as string),
    enabled,
  });
  const ordersQuery = useQuery({
    queryKey: ['orders-pending', storeId],
    queryFn: () => countPendingOrders(supabase, storeId as string),
    enabled,
  });
  const storeQuery = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => getStore(supabase, storeId as string),
    enabled,
  });
  const customersQuery = useQuery({
    queryKey: ['customers-count'],
    queryFn: () => countCustomers(supabase),
    enabled,
  });

  const today = useMemo(() => summarizeTodaySales(salesQuery.data ?? []), [salesQuery.data]);
  const inv = inventoryQuery.data;

  const modules = useMemo<ModuleItem[]>(
    () => [
      {
        key: 'dashboard',
        label: 'Dashboard',
        metric: compactMoney(today.revenue),
        subtitle: `${today.count} ventas hoy`,
        href: '/(app)/reports',
        wide: true,
      },
      {
        key: 'inventory',
        label: 'Inventario',
        metric: inv ? String(inv.total) : '—',
        subtitle: inv
          ? `${plural(inv.low, 'bajo', 'bajos')} · ${plural(inv.out, 'agotado', 'agotados')}`
          : 'Referencias',
        href: '/(app)/inventory',
      },
      {
        key: 'stats',
        label: 'Estadísticas',
        metric: compactMoney(today.average),
        subtitle: 'Ticket promedio',
        href: '/(app)/stats',
      },
      {
        key: 'preparation',
        label: 'Preparación',
        metric: ordersQuery.data !== undefined ? String(ordersQuery.data) : '—',
        subtitle: 'Pedidos por preparar',
        href: '/(app)/preparation',
      },
      {
        key: 'orders',
        label: 'Pedidos',
        subtitle: 'Historial de pedidos',
        href: '/(app)/orders',
      },
      {
        key: 'contacts',
        label: 'Clientes',
        metric: customersQuery.data !== undefined ? String(customersQuery.data) : '—',
        subtitle: 'Clientes y proveedores',
        href: '/(app)/contacts',
      },
      {
        key: 'settings',
        label: 'Ajustes',
        subtitle: 'Cuenta, sucursal y cerrar sesión',
        href: '/(app)/settings',
        wide: true,
        compact: true,
      },
    ],
    [today, inv, ordersQuery.data, customersQuery.data],
  );

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState
          title="Sin sucursal asignada"
          subtitle="Tu usuario no tiene una sucursal. Pide a un administrador que te asigne una."
        />
      </SafeAreaView>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Hola';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View>
          <Text style={styles.greeting}>
            {greeting()}, {firstName}
          </Text>
          <Text style={styles.storeLabel}>
            {(storeQuery.data?.name ?? 'Sucursal').toUpperCase()} ·{' '}
            {(profile?.role ?? '').toUpperCase()}
          </Text>
        </View>

        <View style={styles.kpis}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>VENTAS HOY</Text>
            <Text style={styles.kpiValue}>{formatMoney(today.revenue)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>N.º DE VENTAS</Text>
            <Text style={styles.kpiValue}>{today.count}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/(app)/neworder')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.orderCard, pressed && styles.orderCardPressed]}
        >
          <View>
            <Text style={styles.orderLabel}>PEDIDO</Text>
            <Text style={styles.orderTitle}>Nuevo pedido</Text>
          </View>
          <Text style={styles.orderArrow}>→</Text>
        </Pressable>

        {inv && stockAlert(inv.out, inv.low) ? (
          <Pressable
            onPress={() => router.push('/(app)/inventory')}
            style={styles.alert}
            accessibilityRole="button"
          >
            <Text style={styles.alertText}>{stockAlert(inv.out, inv.low)}</Text>
          </Pressable>
        ) : null}

        <View>
          <Text style={styles.sectionLabel}>MÓDULOS</Text>
          <ModuleGrid modules={modules} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  body: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxl },
  greeting: {
    fontFamily: fonts.serif,
    fontSize: 30,
    letterSpacing: -0.4,
    color: colors.ink,
    lineHeight: 34,
  },
  storeLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  kpis: { flexDirection: 'row', gap: spacing.sm },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  kpiLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.8, color: colors.muted },
  kpiValue: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  orderCardPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  orderLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: '#B9B7B2' },
  orderTitle: { fontFamily: fonts.serif, fontSize: 24, color: '#FFFFFF', marginTop: 4 },
  orderArrow: { fontSize: 22, color: '#FFFFFF' },
  alert: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.amberBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  alertText: { color: colors.amberInk, fontSize: 13 },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.muted,
    marginBottom: spacing.md,
  },
});
