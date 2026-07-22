import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFormulaTemplate, listFormulaTemplates, listSupplies } from '@mythic/core';
import { useAuth } from '../../../src/lib/auth';
import { supabase } from '../../../src/lib/supabase';
import { EmptyState, Loading, PrimaryButton } from '../../../src/components/ui';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../../src/theme';

interface ComponentLine {
  component_id: string;
  quantity: string;
}

const EMPTY = { name: '', volumeMl: '', essenceQty: '' };

export default function Formulas() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const storeId = profile?.store_id ?? null;

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [components, setComponents] = useState<ComponentLine[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const create = useMutation({
    mutationFn: () =>
      createFormulaTemplate(supabase, {
        name: form.name.trim(),
        volumeMl: Number(form.volumeMl) || null,
        essenceQuantity: Number(form.essenceQty) || 0,
        components: components
          .map((c) => ({ component_id: c.component_id, quantity: Number(c.quantity) || 0 }))
          .filter((c) => c.quantity > 0),
      }),
    onSuccess: () => {
      setCreating(false);
      setForm(EMPTY);
      setComponents([]);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['formula-templates'] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'No se pudo crear la fórmula.';
      setError(msg.includes('duplicate') ? 'Ya existe una fórmula con ese nombre.' : msg);
    },
  });

  function openCreate() {
    setForm(EMPTY);
    setComponents([]);
    setShowPicker(false);
    setError(null);
    setCreating(true);
  }

  const supplyName = (id: string) => supplies.find((s) => s.id === id)?.name ?? 'Insumo';
  const supplyUnit = (id: string) => supplies.find((s) => s.id === id)?.unit ?? '';

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Fórmulas" />
        <EmptyState title="Sin sucursal asignada" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Fórmulas"
        subtitle={templates.length > 0 ? `${templates.length} estándar` : 'Recetas estándar'}
      />

      {templatesQuery.isLoading ? (
        <Loading label="Cargando fórmulas…" />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {templates.length === 0 ? (
            <EmptyState
              title="Sin fórmulas todavía"
              subtitle="Crea la primera receta estándar para reutilizarla en tus perfumes."
            />
          ) : (
            templates.map((t) => (
              <View key={t.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardName}>{t.name}</Text>
                  {t.volume_ml ? <Text style={styles.cardVolume}>{t.volume_ml} ml</Text> : null}
                </View>
                {t.items.map((i, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text
                      style={[styles.itemName, i.is_essence_slot && styles.itemEssence]}
                      numberOfLines={1}
                    >
                      {i.is_essence_slot ? 'Esencia del perfume' : (i.name ?? 'Insumo')}
                    </Text>
                    <Text style={styles.itemQty}>
                      {i.quantity} {i.is_essence_slot ? 'ml' : (i.unit ?? '')}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}

          <Pressable
            onPress={openCreate}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addBox, pressed && styles.pressed]}
          >
            <Text style={styles.addBoxText}>+ NUEVA FÓRMULA</Text>
          </Pressable>

          <Text style={styles.hint}>
            La esencia es un hueco: la fórmula fija cuánto lleva, y cuál se elige en cada perfume.
            Así una misma receta sirve para todos los aromas de ese tamaño.
          </Text>
        </ScrollView>
      )}

      <Modal
        visible={creating}
        transparent
        animationType="fade"
        onRequestClose={() => setCreating(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCreating(false)}>
          <Pressable style={styles.panel} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.panelTitle}>Nueva fórmula</Text>

              <Text style={styles.fieldLabel}>NOMBRE</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Estándar 75 ml"
                placeholderTextColor={colors.muted}
              />

              <View style={styles.twoCols}>
                <View style={styles.col}>
                  <Text style={[styles.fieldLabel, styles.spaced]}>TAMAÑO (ML)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.volumeMl}
                    onChangeText={(v) => setForm((f) => ({ ...f, volumeMl: v }))}
                    placeholder="75"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={[styles.fieldLabel, styles.spaced]}>ESENCIA (ML)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.essenceQty}
                    onChangeText={(v) => setForm((f) => ({ ...f, essenceQty: v }))}
                    placeholder="22"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Text style={styles.miniHint}>
                La cantidad de esencia es fija; cuál esencia se elige en cada perfume.
              </Text>

              <Text style={[styles.fieldLabel, styles.spaced]}>DEMÁS COMPONENTES</Text>
              {components.map((c, index) => (
                <View key={c.component_id} style={styles.compRow}>
                  <Text style={styles.compName} numberOfLines={1}>
                    {supplyName(c.component_id)}
                  </Text>
                  <TextInput
                    style={styles.compQty}
                    value={c.quantity}
                    onChangeText={(v) =>
                      setComponents((prev) =>
                        prev.map((p, i) => (i === index ? { ...p, quantity: v } : p)),
                      )
                    }
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />
                  <Text style={styles.compUnit}>{supplyUnit(c.component_id)}</Text>
                  <Pressable
                    onPress={() => setComponents((prev) => prev.filter((_, i) => i !== index))}
                    hitSlop={8}
                  >
                    <Text style={styles.compRemove}>✕</Text>
                  </Pressable>
                </View>
              ))}

              <Pressable
                onPress={() => setShowPicker((v) => !v)}
                style={[styles.chip, styles.chipDashed]}
              >
                <Text style={styles.chipText}>+ Agregar insumo</Text>
              </Pressable>

              {showPicker ? (
                <View style={styles.supplyList}>
                  {supplies
                    .filter((s) => !components.some((c) => c.component_id === s.id))
                    .map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() => {
                          setComponents((prev) => [...prev, { component_id: s.id, quantity: '' }]);
                          setShowPicker(false);
                        }}
                        style={({ pressed }) => [styles.supplyOption, pressed && styles.pressed]}
                      >
                        <Text style={styles.supplyName}>{s.name}</Text>
                        <Text style={styles.supplyMeta}>
                          {s.family_name} · {s.stock} {s.unit}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <PrimaryButton
                label="Guardar fórmula"
                loading={create.isPending}
                disabled={form.name.trim().length < 2 || !(Number(form.essenceQty) > 0)}
                onPress={() => create.mutate()}
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
  body: { padding: spacing.lg, gap: spacing.md },
  pressed: { backgroundColor: colors.canvas },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  cardName: { fontFamily: fonts.serif, fontSize: 19, color: colors.ink },
  cardVolume: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemName: { flex: 1, fontSize: 13, color: colors.inkSoft },
  itemEssence: { color: colors.amberInk },
  itemQty: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
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
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18 },

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
  miniHint: { fontSize: 11, color: colors.muted, marginTop: spacing.xs, lineHeight: 15 },
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
  twoCols: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  compName: { flex: 1, fontSize: 13, color: colors.ink },
  compQty: {
    width: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'right',
    color: colors.inkSoft,
  },
  compUnit: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted, width: 30 },
  compRemove: { fontSize: 14, color: colors.muted },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipDashed: { borderStyle: 'dashed', backgroundColor: colors.surface2 },
  chipText: { fontSize: 13, color: colors.inkSoft },
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
  error: { color: colors.redInk, fontSize: 13, marginTop: spacing.md },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { color: colors.muted, fontSize: 13 },
});
