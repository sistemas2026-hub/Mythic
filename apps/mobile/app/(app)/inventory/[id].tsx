import { useEffect, useState } from 'react';
import {
  Alert,
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
  createCategory,
  deactivateProduct,
  formatMoney,
  getFamily,
  listCategories,
  listProductsWithStock,
  setStockLevels,
  stockStatus,
  updateProduct,
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

const EMPTY_FORM = {
  name: '',
  sku: '',
  unit: 'unidad' as ProductUnit,
  categoryId: null as string | null,
  cost: '',
  price: '',
  quantity: '',
  minQuantity: '',
};

export default function FamilyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const storeId = profile?.store_id ?? null;

  const [search, setSearch] = useState('');
  /** null = cerrado; 'new' = alta; un producto = edición. */
  const [editing, setEditing] = useState<'new' | ProductWithStock | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newType, setNewType] = useState('');
  const [showNewType, setShowNewType] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const familyQuery = useQuery({
    queryKey: ['family', id],
    queryFn: () => getFamily(supabase, id),
    enabled: !!id,
  });
  const family = familyQuery.data;
  /** Los tipos solo aplican a lo que se vende (perfumes). */
  const usesTypes = family ? !family.is_supply : false;

  const itemsQuery = useQuery({
    queryKey: ['family-items', id, storeId, search],
    queryFn: () => listProductsWithStock(supabase, storeId as string, { familyId: id, search }),
    enabled: !!storeId && !!id,
  });

  const typesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => listCategories(supabase),
    enabled: usesTypes,
  });

  // Precarga el formulario al abrir en modo edición.
  useEffect(() => {
    if (editing && editing !== 'new') {
      const inv = editing.inventory?.[0];
      setForm({
        name: editing.name,
        sku: editing.sku ?? '',
        unit: editing.unit,
        categoryId: editing.category_id,
        cost: editing.cost != null ? String(editing.cost) : '',
        price: String(editing.price ?? 0),
        quantity: String(inv?.quantity ?? 0),
        minQuantity: String(inv?.min_quantity ?? 0),
      });
    } else if (editing === 'new') {
      setForm(EMPTY_FORM);
    }
    setError(null);
    setShowNewType(false);
    setNewType('');
  }, [editing]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['family-items'] });
    void queryClient.invalidateQueries({ queryKey: ['families'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  const save = useMutation({
    mutationFn: async () => {
      const fields = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        unit: form.unit,
        category_id: usesTypes ? form.categoryId : null,
        price: Number(form.price) || 0,
        cost: Number(form.cost) || null,
      };
      const qty = Number(form.quantity) || 0;
      const min = Number(form.minQuantity) || 0;

      if (editing === 'new') {
        await createArticleWithStock(supabase, storeId as string, {
          ...fields,
          family_id: id,
          is_sellable: !(family?.is_supply ?? true),
          quantity: qty,
          min_quantity: min,
        });
      } else if (editing) {
        await updateProduct(supabase, editing.id, fields);
        await setStockLevels(supabase, storeId as string, editing.id, qty, min);
      }
    },
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar.';
      setError(msg.includes('duplicate') ? 'Ya existe un artículo con ese SKU.' : msg);
    },
  });

  const remove = useMutation({
    mutationFn: (productId: string) => deactivateProduct(supabase, productId),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: () => Alert.alert('Error', 'No se pudo eliminar el artículo.'),
  });

  const addType = useMutation({
    mutationFn: () => createCategory(supabase, newType),
    onSuccess: (created) => {
      setForm((f) => ({ ...f, categoryId: created.id }));
      setNewType('');
      setShowNewType(false);
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => setError('No se pudo crear el tipo.'),
  });

  function confirmRemove() {
    if (!editing || editing === 'new') return;
    const product = editing;
    Alert.alert(
      'Eliminar artículo',
      `¿Quitar "${product.name}" del inventario? El historial de ventas se conserva.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(product.id) },
      ],
    );
  }

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Inventario" />
        <EmptyState title="Sin sucursal asignada" />
      </SafeAreaView>
    );
  }

  const items = itemsQuery.data ?? [];
  const types = typesQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={family?.name ?? 'Familia'}
        subtitle={family?.kind === 'insumo' ? 'Insumo' : 'Artículo'}
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
              subtitle={`Agrega el primero de ${family?.name ?? 'esta familia'} con el botón de abajo.`}
            />
          }
          renderItem={({ item }: { item: ProductWithStock }) => {
            const inv = item.inventory?.[0] ?? null;
            return (
              <Pressable
                onPress={() => setEditing(item)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.sku ?? 'Sin SKU'}
                    {item.category ? ` · ${item.category.name}` : ''}
                    {item.is_sellable ? ` · ${formatMoney(item.price)}` : ''}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <StockBadge status={stockStatus(inv)} />
                  <Text style={styles.qty}>
                    {inv?.quantity ?? 0} {item.unit}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <PrimaryButton label="Agregar artículo" onPress={() => setEditing('new')} />
      </View>

      <Modal
        visible={editing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.panel} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.panelTitle}>
                {editing === 'new' ? `Nuevo en ${family?.name ?? ''}` : 'Editar artículo'}
              </Text>

              <Text style={styles.fieldLabel}>NOMBRE</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Nombre del artículo"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.fieldLabel, styles.spaced]}>SKU (OPCIONAL)</Text>
              <TextInput
                style={styles.input}
                value={form.sku}
                onChangeText={(v) => setForm((f) => ({ ...f, sku: v }))}
                placeholder="DIO-SAU-100"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
              />

              {usesTypes ? (
                <>
                  <Text style={[styles.fieldLabel, styles.spaced]}>TIPO</Text>
                  <View style={styles.chipWrap}>
                    {types.map((t) => {
                      const active = form.categoryId === t.id;
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() =>
                            setForm((f) => ({ ...f, categoryId: active ? null : t.id }))
                          }
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {t.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => setShowNewType((v) => !v)}
                      style={[styles.chip, styles.chipDashed]}
                    >
                      <Text style={styles.chipText}>+ Nuevo</Text>
                    </Pressable>
                  </View>

                  {showNewType ? (
                    <View style={styles.newTypeRow}>
                      <TextInput
                        style={[styles.input, styles.newTypeInput]}
                        value={newType}
                        onChangeText={setNewType}
                        placeholder="Nombre del tipo"
                        placeholderTextColor={colors.muted}
                        autoFocus
                      />
                      <Pressable
                        onPress={() => addType.mutate()}
                        disabled={newType.trim().length < 2 || addType.isPending}
                        style={[
                          styles.newTypeBtn,
                          newType.trim().length < 2 && styles.newTypeBtnDisabled,
                        ]}
                      >
                        <Text style={styles.newTypeBtnText}>Agregar</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </>
              ) : null}

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
                label={editing === 'new' ? 'Guardar artículo' : 'Guardar cambios'}
                loading={save.isPending}
                disabled={form.name.trim().length < 2}
                onPress={() => save.mutate()}
                style={{ marginTop: spacing.lg }}
              />

              {editing !== 'new' ? (
                <Pressable onPress={confirmRemove} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>Eliminar artículo</Text>
                </Pressable>
              ) : null}

              <Pressable onPress={() => setEditing(null)} style={styles.cancel}>
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
  rowPressed: { backgroundColor: colors.surface2 },
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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipDashed: { borderStyle: 'dashed', backgroundColor: colors.surface2 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, color: colors.inkSoft },
  chipTextActive: { color: '#FFFFFF' },
  newTypeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  newTypeInput: { flex: 1 },
  newTypeBtn: {
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.md,
  },
  newTypeBtnDisabled: { opacity: 0.4 },
  newTypeBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
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
  deleteBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  deleteText: { color: colors.redInk, fontSize: 14 },
  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { color: colors.muted, fontSize: 13 },
});
