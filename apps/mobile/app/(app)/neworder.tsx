import { useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ensureInventory,
  formatMoney,
  getFamilyBySlug,
  listCategories,
  listFormulaTemplates,
  listProductsWithStock,
  listRecipe,
  listSupplies,
  registerOrder,
  resolveTemplate,
  setRecipe,
  upsertProduct,
  type ProductWithStock,
} from '@mythic/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { EmptyState, Loading, PrimaryButton } from '../../src/components/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../src/theme';

/** Lo mínimo que el carrito necesita de un perfume. */
interface CartLine {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

const EMPTY_NEW = {
  name: '',
  categoryId: null as string | null,
  volumeMl: '',
  price: '',
  essenceId: null as string | null,
  templateId: null as string | null,
};

export default function NewOrder() {
  const { profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const storeId = profile?.store_id ?? null;

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_NEW);
  /** Fórmula resuelta que se guardará con el perfume nuevo. */
  const [recipe, setRecipeLines] = useState<{ component_id: string; quantity: number }[]>([]);
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const typesQuery = useQuery({
    queryKey: ['categories', familyId],
    queryFn: () => listCategories(supabase, familyId),
    enabled: !!familyId,
  });
  const types = typesQuery.data ?? [];

  const templatesQuery = useQuery({
    queryKey: ['formula-templates'],
    queryFn: () => listFormulaTemplates(supabase),
  });
  const templates = templatesQuery.data ?? [];

  const suppliesQuery = useQuery({
    queryKey: ['supplies', storeId],
    queryFn: () => listSupplies(supabase, storeId as string),
    enabled: !!storeId,
  });
  const supplies = suppliesQuery.data ?? [];
  const essences = useMemo(() => {
    const only = supplies.filter((s) => s.family_name === 'Esencias');
    return only.length > 0 ? only : supplies;
  }, [supplies]);

  // Perfumes que ya existen con un nombre parecido, para reutilizar su fórmula.
  const similarQuery = useQuery({
    queryKey: ['similar-perfumes', familyId, storeId, form.name],
    queryFn: () =>
      listProductsWithStock(supabase, storeId as string, { familyId, search: form.name.trim() }),
    enabled: creating && !!familyId && !!storeId && form.name.trim().length >= 3,
  });
  const similar = similarQuery.data ?? [];

  const lines = useMemo(() => Object.values(cart), [cart]);
  const total = useMemo(() => lines.reduce((s, l) => s + l.price * l.quantity, 0), [lines]);
  const itemCount = useMemo(() => lines.reduce((n, l) => n + l.quantity, 0), [lines]);

  const order = useMutation({
    mutationFn: () =>
      registerOrder(supabase, {
        store_id: storeId as string,
        items: lines.map((l) => ({ product_id: l.id, quantity: l.quantity })),
      }),
    onSuccess: () => {
      setCart({});
      void queryClient.invalidateQueries({ queryKey: ['order-products'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['orders-pending'] });
      Alert.alert('Pedido registrado', `Total: ${formatMoney(total)}`, [
        { text: 'Ir a preparación', onPress: () => router.replace('/(app)/preparation') },
        { text: 'Seguir', style: 'cancel' },
      ]);
    },
    onError: (e: unknown) =>
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo registrar el pedido.'),
  });

  /** Crea el perfume en el catálogo (sin stock) y lo suma al pedido. */
  const createPerfume = useMutation({
    mutationFn: async () => {
      const created = await upsertProduct(supabase, {
        name: form.name.trim(),
        family_id: familyId,
        category_id: form.categoryId,
        volume_ml: Number(form.volumeMl) || null,
        price: Number(form.price) || 0,
        unit: 'unidad',
        is_sellable: true,
        essence_id: form.essenceId,
        formula_template_id: form.templateId,
        is_custom_formula: form.templateId === null,
      });
      // Nace sin existencias: se preparará al finalizar el pedido.
      await ensureInventory(supabase, storeId as string, created.id, 0);
      await setRecipe(supabase, created.id, recipe);
      return created;
    },
    onSuccess: (created) => {
      setCart((prev) => ({
        ...prev,
        [created.id]: { id: created.id, name: created.name, price: created.price, quantity: 1 },
      }));
      setCreating(false);
      setForm(EMPTY_NEW);
      setRecipeLines([]);
      setCopiedFrom(null);
      setCreateError(null);
      void queryClient.invalidateQueries({ queryKey: ['order-products'] });
      void queryClient.invalidateQueries({ queryKey: ['family-items'] });
      void queryClient.invalidateQueries({ queryKey: ['family-types'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el perfume.';
      setCreateError(msg.includes('duplicate') ? 'Ya existe un perfume con ese SKU.' : msg);
    },
  });

  function applyTemplate(templateId: string, essenceId: string | null) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setForm((f) => ({
      ...f,
      templateId,
      volumeMl: tpl.volume_ml ? String(tpl.volume_ml) : f.volumeMl,
    }));
    setRecipeLines(resolveTemplate(tpl, essenceId));
    setCopiedFrom(null);
  }

  /** Copia la fórmula de un perfume que ya existe con nombre parecido. */
  async function copyFormulaFrom(product: ProductWithStock) {
    const existing = await listRecipe(supabase, product.id);
    setRecipeLines(existing.map((r) => ({ component_id: r.component_id, quantity: r.quantity })));
    setForm((f) => ({
      ...f,
      templateId: null,
      essenceId: product.essence_id ?? f.essenceId,
      volumeMl: product.volume_ml ? String(product.volume_ml) : f.volumeMl,
      price: f.price || String(product.price),
    }));
    setCopiedFrom(product.name);
  }

  function addToCart(p: ProductWithStock) {
    setCart((prev) => {
      const current = prev[p.id]?.quantity ?? 0;
      return { ...prev, [p.id]: { id: p.id, name: p.name, price: p.price, quantity: current + 1 } };
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((prev) => {
      const line = prev[id];
      if (!line) return prev;
      const next = line.quantity + delta;
      if (next <= 0) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { ...line, quantity: next } };
    });
  }

  const supplyName = (id: string) => supplies.find((s) => s.id === id)?.name ?? 'Insumo';
  const supplyUnit = (id: string) => supplies.find((s) => s.id === id)?.unit ?? '';

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
        <Pressable
          onPress={() => {
            setForm({ ...EMPTY_NEW, name: search });
            setRecipeLines([]);
            setCopiedFrom(null);
            setCreateError(null);
            setCreating(true);
          }}
          style={({ pressed }) => [styles.newBtn, pressed && styles.rowPressed]}
        >
          <Text style={styles.newBtnText}>+ NUEVO PERFUME</Text>
        </Pressable>
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
              title="Sin perfumes en el catálogo"
              subtitle="Créalo aquí mismo con «+ Nuevo perfume»: queda guardado con su fórmula y sin existencias."
            />
          }
          renderItem={({ item }) => {
            const available = item.inventory?.[0]?.quantity ?? 0;
            return (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.category?.name ?? 'Sin tipo'} ·{' '}
                    {available > 0 ? `${available} preparados` : 'se prepara al pedir'}
                  </Text>
                </View>
                <Text style={styles.rowPrice}>{formatMoney(item.price)}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => addToCart(item)}
                  style={styles.add}
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
            <View key={l.id} style={styles.cartLine}>
              <Text style={styles.cartName} numberOfLines={1}>
                {l.name}
              </Text>
              <View style={styles.stepper}>
                <Pressable onPress={() => changeQty(l.id, -1)} style={styles.stepBtn}>
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.stepQty}>{l.quantity}</Text>
                <Pressable onPress={() => changeQty(l.id, 1)} style={styles.stepBtn}>
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.cartLineTotal}>{formatMoney(l.price * l.quantity)}</Text>
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

      {/* ---------------- Alta rápida de perfume ---------------- */}
      <Modal
        visible={creating}
        transparent
        animationType="fade"
        onRequestClose={() => setCreating(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCreating(false)}>
          <Pressable style={styles.panel} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.panelTitle}>Nuevo perfume</Text>
              <Text style={styles.panelHint}>
                Queda en el catálogo sin existencias, con su fórmula lista para preparar.
              </Text>

              <Text style={styles.fieldLabel}>NOMBRE</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Sauvage árabe 100 ml"
                placeholderTextColor={colors.muted}
              />

              {similar.length > 0 ? (
                <View style={styles.suggestBox}>
                  <Text style={styles.suggestTitle}>Ya existe con ese nombre</Text>
                  {similar.slice(0, 3).map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => void copyFormulaFrom(p)}
                      style={({ pressed }) => [styles.suggestRow, pressed && styles.rowPressed]}
                    >
                      <Text style={styles.suggestName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.suggestAction}>usar su fórmula</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {types.length > 0 ? (
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
                  </View>
                </>
              ) : null}

              <View style={styles.twoCols}>
                <View style={styles.col}>
                  <Text style={[styles.fieldLabel, styles.spaced]}>TAMAÑO (ML)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.volumeMl}
                    onChangeText={(v) => setForm((f) => ({ ...f, volumeMl: v }))}
                    placeholder="100"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={[styles.fieldLabel, styles.spaced]}>PRECIO</Text>
                  <TextInput
                    style={styles.input}
                    value={form.price}
                    onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={[styles.fieldLabel, styles.spaced]}>ESENCIA</Text>
              <View style={styles.chipWrap}>
                {essences.map((e) => {
                  const active = form.essenceId === e.id;
                  return (
                    <Pressable
                      key={e.id}
                      onPress={() => {
                        setForm((f) => ({ ...f, essenceId: e.id }));
                        if (form.templateId) applyTemplate(form.templateId, e.id);
                      }}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {e.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, styles.spaced]}>FÓRMULA</Text>
              <View style={styles.chipWrap}>
                {templates.map((t) => {
                  const active = form.templateId === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => applyTemplate(t.id, form.essenceId)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {t.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {copiedFrom ? (
                <Text style={styles.copiedHint}>Fórmula copiada de «{copiedFrom}»</Text>
              ) : null}

              {recipe.length > 0 ? (
                <View style={styles.recipeBox}>
                  {recipe.map((c) => (
                    <View key={c.component_id} style={styles.recipeRow}>
                      <Text style={styles.recipeName} numberOfLines={1}>
                        {supplyName(c.component_id)}
                      </Text>
                      <Text style={styles.recipeQty}>
                        {c.quantity} {supplyUnit(c.component_id)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.recipeEmpty}>
                  Elige una fórmula estándar, o copia la de un perfume existente.
                </Text>
              )}

              {createError ? <Text style={styles.error}>{createError}</Text> : null}

              <PrimaryButton
                label="Guardar y agregar al pedido"
                loading={createPerfume.isPending}
                disabled={form.name.trim().length < 2}
                onPress={() => createPerfume.mutate()}
                style={{ marginTop: spacing.lg }}
              />
              <Pressable onPress={() => setCreating(false)} style={styles.cancel}>
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
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
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
  newBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  newBtnText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: colors.inkSoft },
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
  rowPressed: { backgroundColor: colors.canvas },
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
    maxHeight: '88%',
  },
  panelTitle: { fontFamily: fonts.serif, fontSize: 21, color: colors.ink },
  panelHint: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: spacing.lg },
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
  suggestBox: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.amberBg,
    padding: spacing.md,
  },
  suggestTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.amberInk,
    marginBottom: spacing.sm,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  suggestName: { flex: 1, fontSize: 13, color: colors.ink },
  suggestAction: { fontSize: 12, color: colors.amberInk },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, color: colors.inkSoft },
  chipTextActive: { color: '#FFFFFF' },
  twoCols: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  copiedHint: { fontSize: 12, color: colors.greenInk, marginTop: spacing.sm },
  recipeBox: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    padding: spacing.md,
  },
  recipeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  recipeName: { flex: 1, fontSize: 13, color: colors.inkSoft },
  recipeQty: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  recipeEmpty: { fontSize: 12, color: colors.muted, marginTop: spacing.sm, lineHeight: 17 },
  error: { color: colors.redInk, fontSize: 13, marginTop: spacing.md },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { color: colors.muted, fontSize: 13 },
});
