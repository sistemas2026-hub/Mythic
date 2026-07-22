import { useEffect, useMemo, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createArticleWithStock,
  createCategory,
  deactivateProduct,
  ensureInventory,
  formatMoney,
  getFamily,
  listCategories,
  listFormulaTemplates,
  listProductsWithStock,
  listRecipe,
  listSupplies,
  resolveTemplate,
  listTypesWithStock,
  registerProduction,
  setRecipe,
  setStockLevels,
  stockStatus,
  updateProduct,
  upsertProduct,
  type ProductUnit,
  type ProductWithStock,
} from '@mythic/core';
import { useAuth } from '../../../src/lib/auth';
import { supabase } from '../../../src/lib/supabase';
import { EmptyState, Loading, PrimaryButton, StockBadge } from '../../../src/components/ui';
import { CountCard } from '../../../src/components/CountCard';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../../src/theme';

/** Valor del parámetro `type` para los artículos sin tipo asignado. */
const UNTYPED = 'sin-tipo';

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
  volumeMl: '',
  cost: '',
  price: '',
  quantity: '',
  minQuantity: '',
};

/** Una línea de la fórmula: qué insumo y cuánto lleva UNA unidad. */
interface ComponentLine {
  component_id: string;
  quantity: string;
}

export default function FamilyDetail() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const storeId = profile?.store_id ?? null;

  const [search, setSearch] = useState('');
  /** null = cerrado; 'new' = alta; un producto = edición. */
  const [editing, setEditing] = useState<'new' | ProductWithStock | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newType, setNewType] = useState('');
  const [showNewType, setShowNewType] = useState(false);
  const [components, setComponents] = useState<ComponentLine[]>([]);
  const [showSupplyPicker, setShowSupplyPicker] = useState(false);
  /** null = fórmula personalizada; un id = plantilla estándar aplicada. */
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [essenceId, setEssenceId] = useState<string | null>(null);
  const [showEssencePicker, setShowEssencePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const familyQuery = useQuery({
    queryKey: ['family', id],
    queryFn: () => getFamily(supabase, id),
    enabled: !!id,
  });
  const family = familyQuery.data;

  // Cada familia define sus propios tipos. Si tiene al menos uno, la pantalla
  // muestra los sub-módulos; si no, va directo a la lista de artículos.
  const typesQuery = useQuery({
    queryKey: ['categories', id],
    queryFn: () => listCategories(supabase, id),
    enabled: !!id,
  });
  const types = typesQuery.data ?? [];
  const hasTypes = types.length > 0;
  const showingTypes = hasTypes && !type;

  const itemsQuery = useQuery({
    queryKey: ['family-items', id, storeId, search, type],
    queryFn: () =>
      listProductsWithStock(supabase, storeId as string, {
        familyId: id,
        search,
        categoryId: type && type !== UNTYPED ? type : undefined,
        untyped: type === UNTYPED,
      }),
    enabled: !!storeId && !!id && !showingTypes,
  });

  const breakdownQuery = useQuery({
    queryKey: ['family-types', id, storeId],
    queryFn: () => listTypesWithStock(supabase, storeId as string, id),
    enabled: !!storeId && !!id && showingTypes,
  });

  /** Los productos terminados (perfumes) se arman con una fórmula de insumos. */
  const isFinished = family ? !family.is_supply : false;

  const suppliesQuery = useQuery({
    queryKey: ['supplies', storeId],
    queryFn: () => listSupplies(supabase, storeId as string),
    enabled: !!storeId && isFinished,
  });
  const supplies = suppliesQuery.data ?? [];

  const templatesQuery = useQuery({
    queryKey: ['formula-templates'],
    queryFn: () => listFormulaTemplates(supabase),
    enabled: isFinished,
  });
  const templates = templatesQuery.data ?? [];

  // Las esencias son lo que define el aroma. Si la familia se llamara distinto,
  // se ofrecen todos los insumos para no dejar al usuario sin opciones.
  const essences = useMemo(() => {
    const onlyEssences = supplies.filter((s) => s.family_name === 'Esencias');
    return onlyEssences.length > 0 ? onlyEssences : supplies;
  }, [supplies]);
  const selectedEssence = essences.find((e) => e.id === essenceId);

  /** Aplica una plantilla: rellena la fórmula resolviendo el hueco de esencia. */
  function applyTemplate(template: (typeof templates)[number], essence: string | null) {
    setTemplateId(template.id);
    setComponents(
      resolveTemplate(template, essence).map((c) => ({
        component_id: c.component_id,
        quantity: String(c.quantity),
      })),
    );
    if (template.volume_ml) {
      setForm((f) => ({ ...f, volumeMl: String(template.volume_ml) }));
    }
  }

  // Precarga el formulario al abrir en modo edición.
  useEffect(() => {
    if (editing && editing !== 'new') {
      const inv = editing.inventory?.[0];
      setForm({
        name: editing.name,
        sku: editing.sku ?? '',
        unit: editing.unit,
        categoryId: editing.category_id,
        volumeMl: editing.volume_ml != null ? String(editing.volume_ml) : '',
        cost: editing.cost != null ? String(editing.cost) : '',
        price: String(editing.price ?? 0),
        quantity: String(inv?.quantity ?? 0),
        minQuantity: String(inv?.min_quantity ?? 0),
      });
      setTemplateId(editing.is_custom_formula ? null : editing.formula_template_id);
      setEssenceId(editing.essence_id);
      // Trae la fórmula guardada del artículo.
      void listRecipe(supabase, editing.id).then((recipe) =>
        setComponents(
          recipe.map((r) => ({ component_id: r.component_id, quantity: String(r.quantity) })),
        ),
      );
    } else if (editing === 'new') {
      // Si estamos dentro de un tipo, el artículo nuevo nace con ese tipo.
      const preset = type && type !== UNTYPED ? type : null;
      setForm({ ...EMPTY_FORM, categoryId: preset });
      setComponents([]);
      setTemplateId(null);
      setEssenceId(null);
    }
    setShowEssencePicker(false);
    setError(null);
    setShowNewType(false);
    setNewType('');
    setShowSupplyPicker(false);
  }, [editing, type]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['family-items'] });
    void queryClient.invalidateQueries({ queryKey: ['family-types'] });
    void queryClient.invalidateQueries({ queryKey: ['families'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  const save = useMutation({
    /** Devuelve un motivo cuando el artículo se guardó pero no se pudo preparar. */
    mutationFn: async (): Promise<{ pendingReason?: string }> => {
      const fields = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        unit: form.unit,
        category_id: form.categoryId,
        volume_ml: Number(form.volumeMl) || null,
        price: Number(form.price) || 0,
        cost: Number(form.cost) || null,
        ...(isFinished
          ? {
              formula_template_id: templateId,
              essence_id: essenceId,
              is_custom_formula: templateId === null,
            }
          : {}),
      };
      const qty = Number(form.quantity) || 0;
      const min = Number(form.minQuantity) || 0;
      const recipe = components
        .map((c) => ({ component_id: c.component_id, quantity: Number(c.quantity) || 0 }))
        .filter((c) => c.quantity > 0);

      if (editing === 'new') {
        if (isFinished) {
          // Producto terminado: se crea sin stock, se guarda su fórmula y el
          // stock inicial sale de producir, que consume los insumos.
          const created = await upsertProduct(supabase, {
            ...fields,
            family_id: id,
            is_sellable: true,
          });
          await ensureInventory(supabase, storeId as string, created.id, min);
          await setRecipe(supabase, created.id, recipe);
          if (qty > 0) {
            // Si faltan insumos NO se pierde el artículo: queda creado con su
            // fórmula, listo para prepararlo cuando llegue la materia prima.
            try {
              await registerProduction(supabase, storeId as string, created.id, qty);
            } catch (e) {
              return {
                pendingReason: e instanceof Error ? e.message : 'Faltan insumos para prepararlo.',
              };
            }
          }
        } else {
          await createArticleWithStock(supabase, storeId as string, {
            ...fields,
            family_id: id,
            is_sellable: false,
            quantity: qty,
            min_quantity: min,
          });
        }
      } else if (editing) {
        await updateProduct(supabase, editing.id, fields);
        if (isFinished) await setRecipe(supabase, editing.id, recipe);
        await setStockLevels(supabase, storeId as string, editing.id, qty, min);
      }
      return {};
    },
    onSuccess: (result) => {
      setEditing(null);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['supplies'] });
      if (result.pendingReason) {
        Alert.alert(
          'Guardado, pendiente de preparar',
          `${result.pendingReason}\n\nEl artículo y su fórmula quedaron guardados. Cuando lleguen los insumos podrás prepararlo desde el pedido.`,
        );
      }
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
    mutationFn: () => createCategory(supabase, newType, id),
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
  const breakdown = breakdownQuery.data;
  const selectedType = type && type !== UNTYPED ? types.find((t) => t.id === type) : undefined;
  /** "3 insumos" en Esencias, "3 artículos" en Envases y Perfumes. */
  const noun = (n: number) =>
    family?.kind === 'insumo'
      ? n === 1
        ? 'insumo'
        : 'insumos'
      : n === 1
        ? 'artículo'
        : 'artículos';

  // Sub-módulos por tipo: un recuadro con el nombre y cuántos artículos tiene.
  const typesView = (
    <>
      <ScreenHeader title={family?.name ?? 'Familia'} subtitle="Elige un tipo" />
      {breakdownQuery.isLoading ? (
        <Loading label="Cargando tipos…" />
      ) : (
        <ScrollView contentContainerStyle={styles.typeBody}>
          <View style={styles.typeGrid}>
            {(breakdown?.types ?? []).map((t) => (
              <View key={t.id} style={styles.typeCell}>
                <CountCard
                  label={t.name}
                  count={t.items}
                  noun={noun(t.items)}
                  low={t.low}
                  out={t.out}
                  onPress={() => router.push(`/(app)/inventory/${id}?type=${t.id}`)}
                />
              </View>
            ))}
            {breakdown && breakdown.untyped.items > 0 ? (
              <View style={styles.typeCell}>
                <CountCard
                  label="Sin tipo"
                  count={breakdown.untyped.items}
                  noun={noun(breakdown.untyped.items)}
                  low={breakdown.untyped.low}
                  out={breakdown.untyped.out}
                  onPress={() => router.push(`/(app)/inventory/${id}?type=${UNTYPED}`)}
                />
              </View>
            ) : null}
          </View>

          {/* Las recetas estándar viven aparte, no dentro de cada perfume. */}
          {isFinished ? (
            <Pressable
              onPress={() => router.push('/(app)/inventory/formulas')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.formulasBox, pressed && styles.rowPressed]}
            >
              <View>
                <Text style={styles.formulasLabel}>FÓRMULAS</Text>
                <Text style={styles.formulasHint}>Recetas estándar reutilizables</Text>
              </View>
              <Text style={styles.formulasArrow}>→</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setEditing('new')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addBox, pressed && styles.rowPressed]}
          >
            <Text style={styles.addBoxText}>+ AGREGAR ARTÍCULO</Text>
          </Pressable>

          <Text style={styles.hint}>
            Cada recuadro agrupa los artículos de ese tipo. Los tipos nuevos se crean desde el
            formulario del artículo, con el botón "+ Nuevo".
          </Text>
        </ScrollView>
      )}
    </>
  );

  const listView = (
    <>
      <ScreenHeader
        title={selectedType?.name ?? (type === UNTYPED ? 'Sin tipo' : (family?.name ?? 'Familia'))}
        subtitle={type ? (family?.name ?? '') : family?.kind === 'insumo' ? 'Insumo' : 'Artículo'}
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
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {showingTypes ? typesView : listView}

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

              {/* Cualquier familia puede clasificarse por tipos; los crea el usuario. */}
              <Text style={[styles.fieldLabel, styles.spaced]}>TIPO</Text>
              <View style={styles.chipWrap}>
                {types.map((t) => {
                  const active = form.categoryId === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setForm((f) => ({ ...f, categoryId: active ? null : t.id }))}
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

              {isFinished ? (
                <>
                  <Text style={[styles.fieldLabel, styles.spaced]}>TAMAÑO (ML)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.volumeMl}
                    onChangeText={(v) => setForm((f) => ({ ...f, volumeMl: v }))}
                    placeholder="100"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />

                  <Text style={[styles.fieldLabel, styles.spaced]}>ESENCIA DE ESTE PERFUME</Text>
                  <Pressable
                    onPress={() => setShowEssencePicker((v) => !v)}
                    style={[styles.input, styles.selectRow]}
                  >
                    <Text style={selectedEssence ? styles.selectValue : styles.selectPlaceholder}>
                      {selectedEssence?.name ?? 'Elegir esencia…'}
                    </Text>
                    <Text style={styles.selectCaret}>▾</Text>
                  </Pressable>

                  {showEssencePicker ? (
                    <View style={styles.supplyList}>
                      {essences.map((e) => (
                        <Pressable
                          key={e.id}
                          onPress={() => {
                            setEssenceId(e.id);
                            setShowEssencePicker(false);
                            // Si ya había plantilla elegida, se rellena con esta esencia.
                            const tpl = templates.find((t) => t.id === templateId);
                            if (tpl) applyTemplate(tpl, e.id);
                          }}
                          style={({ pressed }) => [
                            styles.supplyOption,
                            pressed && styles.rowPressed,
                          ]}
                        >
                          <Text style={styles.supplyName}>{e.name}</Text>
                          <Text style={styles.supplyMeta}>
                            {e.stock} {e.unit} disponibles
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  <Text style={[styles.fieldLabel, styles.spaced]}>FÓRMULA</Text>
                  <View style={styles.chipWrap}>
                    {templates.map((t) => {
                      const active = templateId === t.id;
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => applyTemplate(t, essenceId)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {t.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => setTemplateId(null)}
                      style={[styles.chip, templateId === null && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, templateId === null && styles.chipTextActive]}>
                        Personalizada
                      </Text>
                    </Pressable>
                  </View>

                  {templateId && !essenceId ? (
                    <Text style={styles.warnHint}>
                      Elige la esencia para completar la fórmula estándar.
                    </Text>
                  ) : null}

                  {/* Solo lectura: las recetas se editan en el apartado Fórmulas. */}
                  {components.length === 0 ? (
                    <Text style={styles.recipeHint}>
                      Elige una fórmula estándar. Se administran en Perfumes → Fórmulas.
                    </Text>
                  ) : (
                    <View style={styles.recipeBox}>
                      {components.map((c) => {
                        const supply = supplies.find((s) => s.id === c.component_id);
                        return (
                          <View key={c.component_id} style={styles.recipeRow}>
                            <Text style={styles.recipeName} numberOfLines={1}>
                              {supply?.name ?? 'Insumo'}
                            </Text>
                            <Text style={styles.recipeQty}>
                              {c.quantity} {supply?.unit ?? ''}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
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
  typeBody: { padding: spacing.lg, gap: spacing.md },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCell: { flexGrow: 1, flexBasis: '47%' },
  addBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  addBoxText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: colors.inkSoft },
  formulasBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  formulasLabel: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: colors.ink },
  formulasHint: { fontSize: 12, color: colors.muted, marginTop: 3 },
  formulasArrow: { fontSize: 18, color: colors.muted },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18 },
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
  recipeHint: { fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: spacing.sm },
  warnHint: { fontSize: 12, color: colors.amberInk, marginTop: spacing.sm },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { fontSize: 15, color: colors.inkSoft },
  selectPlaceholder: { fontSize: 15, color: colors.muted },
  selectCaret: { fontSize: 12, color: colors.muted },
  recipeBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 5,
  },
  recipeName: { flex: 1, fontSize: 13, color: colors.inkSoft },
  recipeQty: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  supplyList: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  supplyOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  supplyName: { fontSize: 13, color: colors.ink },
  supplyMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted, marginTop: 2 },
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
