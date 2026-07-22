import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatMoney,
  getFamilyBySlug,
  listProductsWithStock,
  registerOrder,
  type ProductWithStock,
} from '@mythic/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { EmptyState, Loading, PrimaryButton } from '../../src/components/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../src/theme';

interface OrderLine {
  product: ProductWithStock;
  quantity: number;
}

function stockOf(p: ProductWithStock): number {
  return p.inventory?.[0]?.quantity ?? 0;
}

export default function NewOrder() {
  const { profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const storeId = profile?.store_id ?? null;

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, OrderLine>>({});

  // Solo perfumes: los insumos no se piden.
  const familyQuery = useQuery({
    queryKey: ['family-slug', 'perfumes'],
    queryFn: () => getFamilyBySlug(supabase, 'perfumes'),
  });
  const familyId = familyQuery.data?.id;

  const productsQuery = useQuery({
    queryKey: ['order-products', storeId, familyId, search],
    queryFn: () =>
      listProductsWithStock(supabase, storeId as string, { familyId, search, sellableOnly: true }),
    enabled: !!storeId && !!familyId,
  });

  const lines = useMemo(() => Object.values(cart), [cart]);
  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0),
    [lines],
  );
  const itemCount = useMemo(() => lines.reduce((n, l) => n + l.quantity, 0), [lines]);

  const order = useMutation({
    mutationFn: () =>
      registerOrder(supabase, {
        store_id: storeId as string,
        items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      }),
    onSuccess: () => {
      setCart({});
      void queryClient.invalidateQueries({ queryKey: ['order-products'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['orders-pending'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      Alert.alert('Pedido registrado', `Total: ${formatMoney(total)}`, [
        { text: 'Ver pedidos', onPress: () => router.replace('/(app)/orders') },
        { text: 'Seguir', style: 'cancel' },
      ]);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'No se pudo registrar el pedido.';
      Alert.alert('Error', msg);
    },
  });

  function addToCart(product: ProductWithStock) {
    const available = stockOf(product);
    setCart((prev) => {
      const current = prev[product.id]?.quantity ?? 0;
      if (current >= available) return prev;
      return { ...prev, [product.id]: { product, quantity: current + 1 } };
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) => {
      const line = prev[productId];
      if (!line) return prev;
      const next = line.quantity + delta;
      if (next <= 0) {
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      }
      if (next > stockOf(line.product)) return prev;
      return { ...prev, [productId]: { ...line, quantity: next } };
    });
  }

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Pedido" />
        <EmptyState title="Sin sucursal asignada" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Nuevo pedido" subtitle="Perfumes" />

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar perfume o SKU…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
      </View>

      {productsQuery.isLoading ? (
        <Loading label="Cargando perfumes…" />
      ) : (
        <FlatList
          data={productsQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              title="Sin perfumes"
              subtitle="Agrega perfumes desde Inventario para poder tomar pedidos."
            />
          }
          renderItem={({ item }) => {
            const available = stockOf(item);
            const disabled = available <= 0;
            return (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.brand?.name ?? item.category?.name ?? 'Sin marca'} · {available} en stock
                  </Text>
                </View>
                <Text style={styles.rowPrice}>{formatMoney(item.price)}</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => addToCart(item)}
                  style={[styles.add, disabled && styles.addDisabled]}
                >
                  <Text style={styles.addText}>+</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {lines.length > 0 ? (
        <View style={styles.cart}>
          {lines.map((l) => (
            <View key={l.product.id} style={styles.cartLine}>
              <Text style={styles.cartName} numberOfLines={1}>
                {l.product.name}
              </Text>
              <View style={styles.stepper}>
                <Pressable onPress={() => changeQty(l.product.id, -1)} style={styles.stepBtn}>
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.stepQty}>{l.quantity}</Text>
                <Pressable onPress={() => changeQty(l.product.id, 1)} style={styles.stepBtn}>
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.cartLineTotal}>{formatMoney(l.product.price * l.quantity)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL · {itemCount} art.</Text>
            <Text style={styles.totalAmount}>{formatMoney(total)}</Text>
          </View>
          <PrimaryButton
            label="Registrar pedido"
            loading={order.isPending}
            onPress={() => order.mutate()}
            style={{ marginTop: spacing.md }}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.inkSoft,
  },
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
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  rowMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted, marginTop: 2 },
  rowPrice: { fontSize: 14, fontWeight: '600', color: colors.ink },
  add: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDisabled: { opacity: 0.25 },
  addText: { color: '#fff', fontSize: 20, lineHeight: 22 },
  cart: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cartLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  cartName: { flex: 1, fontSize: 13, color: colors.inkSoft },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 16, color: colors.ink, lineHeight: 18 },
  stepQty: { fontFamily: fonts.mono, fontSize: 13, minWidth: 18, textAlign: 'center' },
  cartLineTotal: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
    minWidth: 74,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  totalLabel: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8, color: colors.muted },
  totalAmount: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
});
