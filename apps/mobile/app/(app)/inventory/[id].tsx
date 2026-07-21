import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createArticleWithStock,
  formatMoney,
  getFamily,
  listProductsWithStock,
  stockStatus,
  type ProductUnit,
  type ProductWithStock,
} from '@mythic/core';
import { useAuth } from '../../../src/lib/auth';
import { supabase } from '../../../src/lib/supabase';
import { EmptyState, Loading, PrimaryButton, StockBadge } from '../../../src/components/ui';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../../src/theme';

const UNITS: { value: ProductUnit; label: string }[] = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'ml', label: 'ml' },
  { value: 'g', label: 'g' },
  { value: 'l', label: 'L' },
];

export default function FamilyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const storeId = profile?.store_id ?? null;

  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    unit: 'unidad' as ProductUnit,
    cost: '',
    price: '',
    quantity: '',
    minQuantity: '',
  });
  const [error, setError] = useState<string | null>(null);

  const familyQuery = useQuery({
    queryKey: ['family', id],
    queryFn: () => getFamily(supabase, id),
    enabled: !!id,
  });
  const family = familyQuery.data;

  const itemsQuery = useQuery({
    queryKey: ['family-items', id, storeId, search],
    queryFn: () => listProductsWithStock(supabase, storeId as string, { familyId: id, search }),
    enabled: !!storeId && !!id,
  });

  const create = useMutation({
    mutationFn: () =>
      createArticleWithStock(supabase, storeId as string, {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        family_id: id,
        unit: form.unit,
        is_sellable: !(family?.is_supply ?? true),
        price: Number(form.price) || 0,
        cost: Number(form.cost) || null,
        quantity: Number(form.quantity) || 0,
        min_quantity: Number(form.minQuantity) || 0,
      }),
    onSuccess: () => {
      setAdding(false);
      setForm({
        name: '',
        sku: '',
        unit: 'unidad',
        cost: '',
        price: '',
        quantity: '',
        minQuantity: '',
      });
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['family-items'] });
      void queryClient.invalidateQueries({ queryKey: ['families'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el artículo.';
      setError(msg.includes('duplicate') ? 'Ya existe un artículo con ese SKU.' : msg);
    },
  });

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Inventario" />
        <EmptyState title="Sin sucursal asignada" />
      </SafeAreaView>
    );
  }

  const items = itemsQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={family?.name ?? 'Familia'}
        subtitle={family?.is_supply ? 'Insumo interno' : 'Producto terminado'}
      />

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o SKU…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
      </View>

      {itemsQuery.isLoading ? (
        <Loading label="Cargando artículos…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              title="Sin artículos todavía"
              subtitle={`Agrega el primer artículo de ${family?.name ?? 'esta familia'} con el botón de abajo.`}
            />
          }
          renderItem={({ item }: { item: ProductWithStock }) => {
            const inv = item.inventory?.[0] ?? null;
            return (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.sku ?? 'Sin SKU'}
                    {item.is_sellable ? ` · ${formatMoney(item.price)}` : ''}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <StockBadge status={stockStatus(inv)} />
                  <Text style={styles.qty}>
                    {inv?.quantity ?? 0} {item.unit}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <PrimaryButton label="Agregar artículo" onPress={() => setAdding(true)} />
      </View>

      <Modal
        visible={adding}
        transparent
        animationType="fade"
        onRequestClose={() => setAdding(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAdding(false)}>
          <Pressable style={styles.panel} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.panelTitle}>Nuevo en {family?.name ?? 'la familia'}</Text>

              <Text style={styles.fieldLabel}>NOMBRE</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Frasco vidrio 100ml"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.fieldLabel, styles.spaced]}>SKU (OPCIONAL)</Text>
              <TextInput
                style={styles.input}
                value={form.sku}
                onChangeText={(v) => setForm((f) => ({ ...f, sku: v }))}
                placeholder="ENV-FR100"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
              />

              <Text style={[styles.fieldLabel, styles.spaced]}>UNIDAD DE MEDIDA</Text>
              <View style={styles.unitRow}>
                {UNITS.map((u) => {
                  const active = form.unit === u.value;
                  return (
                    <Pressable
                      key={u.value}
                      onPress={() => setForm((f) => ({ ...f, unit: u.value }))}
                      style={[styles.unitChip, active && styles.unitChipActive]}
                    >
                      <Text style={[styles.unitText, active && styles.unitTextActive]}>
                        {u.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.twoCols}>
                <View style={styles.col}>
                  <Text style={[styles.fieldLabel, styles.spaced]}>COSTO</Text>
                  <TextInput
                    style={styles.input}
                    value={form.cost}
                    onChangeText={(v) => setForm((f) => ({ ...f, cost: v }))}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />
                </View>
                {!family?.is_supply ? (
                  <View style={styles.col}>
                    <Text style={[styles.fieldLabel, styles.spaced]}>PRECIO VENTA</Text>
                    <TextInput
                      style={styles.input}
                      value={form.price}
                      onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      keyboardType="numeric"
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.twoCols}>
                <View style={styles.col}>
                  <Text style={[styles.fieldLabel, styles.spaced]}>EXISTENCIAS</Text>
                  <TextInput
                    style={styles.input}
                    value={form.quantity}
                    onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={[styles.fieldLabel, styles.spaced]}>MÍNIMO</Text>
                  <TextInput
                    style={styles.input}
                    value={form.minQuantity}
                    onChangeText={(v) => setForm((f) => ({ ...f, minQuantity: v }))}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <PrimaryButton
                label="Guardar artículo"
                loading={create.isPending}
                disabled={form.name.trim().length < 2}
                onPress={() => create.mutate()}
                style={{ marginTop: spacing.lg }}
              />
              <Pressable onPress={() => setAdding(false)} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  rowRight: { alignItems: 'flex-end', gap: 4 },
  qty: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

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
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.9,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  spaced: { marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.inkSoft,
  },
  unitRow: { flexDirection: 'row', gap: spacing.sm },
  unitChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  unitChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  unitText: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkSoft },
  unitTextActive: { color: '#FFFFFF' },
  twoCols: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  error: { color: colors.redInk, fontSize: 13, marginTop: spacing.md },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { color: colors.muted, fontSize: 13 },
});
