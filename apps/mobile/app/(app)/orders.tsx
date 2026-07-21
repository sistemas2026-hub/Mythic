import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, listOrders, orderStatusLabel, type OrderStatus } from '@mythic/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { EmptyState, Loading } from '../../src/components/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../src/theme';

const statusPalette: Record<OrderStatus, { bg: string; ink: string }> = {
  pendiente: { bg: colors.amberBg, ink: colors.amberInk },
  confirmado: { bg: colors.blueBg, ink: colors.blueInk },
  listo: { bg: colors.blueBg, ink: colors.blueInk },
  entregado: { bg: colors.greenBg, ink: colors.greenInk },
  cancelado: { bg: colors.redBg, ink: colors.redInk },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function Orders() {
  const { profile } = useAuth();
  const storeId = profile?.store_id ?? null;

  const query = useQuery({
    queryKey: ['orders', storeId],
    queryFn: () => listOrders(supabase, storeId as string),
    enabled: !!storeId,
  });

  const orders = query.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Pedidos"
        subtitle={orders.length > 0 ? `${orders.length} pedidos` : 'Tienda online'}
      />
      {query.isLoading ? (
        <Loading label="Cargando pedidos…" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="Todavía no hay pedidos"
              subtitle="Los pedidos de la tienda online aparecerán aquí cuando los clientes empiecen a comprar."
            />
          }
          renderItem={({ item }) => {
            const palette = statusPalette[item.status];
            return (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.rowMeta}>{formatDate(item.created_at)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.badgeText, { color: palette.ink }]}>
                    {orderStatusLabel[item.status].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.rowTotal}>{formatMoney(item.total)}</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  rowInfo: { flex: 1 },
  rowId: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  rowMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.5 },
  rowTotal: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
});
