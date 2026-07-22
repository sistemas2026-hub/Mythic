import { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  finishPreparation,
  formatMoney,
  getPreparationPlan,
  listOrders,
  type OrderRow,
} from '@mythic/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { EmptyState, Loading, PrimaryButton } from '../../src/components/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../src/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function Preparation() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const storeId = profile?.store_id ?? null;
  const [selected, setSelected] = useState<OrderRow | null>(null);

  const ordersQuery = useQuery({
    queryKey: ['orders', storeId, 'pendiente'],
    queryFn: () => listOrders(supabase, storeId as string, 'pendiente'),
    enabled: !!storeId,
  });

  const planQuery = useQuery({
    queryKey: ['preparation-plan', selected?.id, storeId],
    queryFn: () => getPreparationPlan(supabase, selected!.id, storeId as string),
    enabled: !!selected && !!storeId,
  });
  const plan = planQuery.data ?? [];
  const missing = plan.some((l) => l.components.some((c) => !c.enough));

  const finish = useMutation({
    mutationFn: () => finishPreparation(supabase, selected!.id),
    onSuccess: () => {
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['orders-pending'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['family-items'] });
      void queryClient.invalidateQueries({ queryKey: ['supplies'] });
      Alert.alert('Preparación finalizada', 'El pedido quedó listo para entregar.');
    },
    onError: (e: unknown) => {
      Alert.alert('No se pudo finalizar', e instanceof Error ? e.message : 'Error desconocido');
    },
  });

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Preparación" />
        <EmptyState title="Sin sucursal asignada" />
      </SafeAreaView>
    );
  }

  const orders = ordersQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Preparación"
        subtitle={orders.length > 0 ? `${orders.length} por preparar` : 'Pedidos pendientes'}
      />

      {ordersQuery.isLoading ? (
        <Loading label="Cargando pedidos…" />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="Nada por preparar"
              subtitle="Cuando se registre un pedido, aparecerá aquí con su guía de preparación."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowInfo}>
                <Text style={styles.rowId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.rowMeta}>{formatDate(item.created_at)}</Text>
              </View>
              <Text style={styles.rowTotal}>{formatMoney(item.total)}</Text>
              <Text style={styles.rowArrow}>→</Text>
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.panel} onPress={() => {}}>
            <Text style={styles.panelTitle}>Pedido #{selected?.id.slice(0, 8).toUpperCase()}</Text>

            {planQuery.isLoading ? (
              <Loading label="Calculando…" />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {plan.map((line) => (
                  <View key={line.product_id} style={styles.lineCard}>
                    <Text style={styles.lineName}>{line.product_name}</Text>
                    <Text style={styles.lineMeta}>
                      {line.quantity} pedidas
                      {line.on_hand > 0 ? ` · ${line.on_hand} ya preparadas` : ''}
                      {line.to_make > 0 ? ` · ${line.to_make} por preparar` : ''}
                    </Text>

                    {line.to_make === 0 ? (
                      <Text style={styles.lineReady}>Se entrega de lo ya preparado</Text>
                    ) : line.components.length === 0 ? (
                      <Text style={styles.lineWarn}>Este perfume no tiene fórmula cargada</Text>
                    ) : (
                      line.components.map((c) => (
                        <View key={c.name} style={styles.compRow}>
                          <Text style={styles.compName} numberOfLines={1}>
                            {c.name}
                          </Text>
                          <Text style={[styles.compQty, !c.enough && styles.compQtyBad]}>
                            {c.required} {c.unit}
                          </Text>
                          <Text style={[styles.compStock, !c.enough && styles.compQtyBad]}>
                            {c.enough ? `de ${c.available}` : `solo ${c.available}`}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                ))}

                {missing ? (
                  <Text style={styles.blocked}>
                    Falta inventario de al menos un insumo. Repón antes de finalizar.
                  </Text>
                ) : null}

                <PrimaryButton
                  label="Finalizar preparación"
                  loading={finish.isPending}
                  disabled={missing || plan.length === 0}
                  onPress={() => finish.mutate()}
                  style={{ marginTop: spacing.lg }}
                />
                <Pressable onPress={() => setSelected(null)} style={styles.cancel}>
                  <Text style={styles.cancelText}>Cerrar</Text>
                </Pressable>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  rowPressed: { backgroundColor: colors.surface2 },
  rowInfo: { flex: 1 },
  rowId: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  rowMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  rowTotal: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  rowArrow: { fontSize: 16, color: colors.muted },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.35)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    maxHeight: '86%',
  },
  panelTitle: {
    fontFamily: fonts.serif,
    fontSize: 21,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  lineCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  lineName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  lineMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted, marginTop: 2 },
  lineReady: { fontSize: 12, color: colors.greenInk, marginTop: spacing.sm },
  lineWarn: { fontSize: 12, color: colors.redInk, marginTop: spacing.sm },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  compName: { flex: 1, fontSize: 13, color: colors.inkSoft },
  compQty: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink },
  compQtyBad: { color: colors.redInk },
  compStock: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted,
    width: 58,
    textAlign: 'right',
  },
  blocked: { color: colors.redInk, fontSize: 13, marginTop: spacing.md, lineHeight: 18 },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { color: colors.muted, fontSize: 13 },
});
