import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  formatMoney,
  listProductsWithStock,
  stockStatus,
  type ProductWithStock,
} from '@mythic/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { EmptyState, Loading, StockBadge } from '../../src/components/ui';
import { colors, fonts, radius, spacing } from '../../src/theme';

export default function Inventory() {
  const { profile } = useAuth();
  const storeId = profile?.store_id ?? null;
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['inventory', storeId, search],
    queryFn: () => listProductsWithStock(supabase, storeId as string, search),
    enabled: !!storeId,
  });

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState title="Sin sucursal asignada" />
      </SafeAreaView>
    );
  }

  const products = query.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appbar}>
        <Text style={styles.title}>Inventario</Text>
        <Text style={styles.sub}>{products.length} referencias</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Filtrar por nombre, marca o SKU…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
      </View>

      {query.isLoading ? (
        <Loading label="Cargando inventario…" />
      ) : query.isError ? (
        <EmptyState title="No se pudo cargar el inventario" subtitle="Revisa tu conexión." />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState title="Sin resultados" />}
          renderItem={({ item }: { item: ProductWithStock }) => {
            const inv = item.inventory?.[0] ?? null;
            const qty = inv?.quantity ?? 0;
            return (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.brand?.name ?? 'Sin marca'} · {formatMoney(item.price)}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <StockBadge status={stockStatus(inv)} />
                  <Text style={styles.qty}>{qty} u</Text>
                </View>
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
    textTransform: 'uppercase',
  },
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
  list: { padding: spacing.lg, gap: spacing.sm },
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
  rowRight: { alignItems: 'flex-end', gap: 4 },
  qty: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
});
