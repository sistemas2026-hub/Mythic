import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFamily, listFamiliesWithStock, type FamilyWithStock } from '@mythic/core';
import { useAuth } from '../../../src/lib/auth';
import { supabase } from '../../../src/lib/supabase';
import { EmptyState, Loading, PrimaryButton } from '../../../src/components/ui';
import { colors, fonts, radius, spacing } from '../../../src/theme';

/** "4 artículos" para bienes tangibles, "3 insumos" para consumibles. */
function itemNoun(kind: FamilyWithStock['kind'], count: number): string {
  if (kind === 'insumo') return count === 1 ? 'insumo' : 'insumos';
  return count === 1 ? 'artículo' : 'artículos';
}

function FamilyCard({ family, onPress }: { family: FamilyWithStock; onPress: () => void }) {
  const alerts: string[] = [];
  if (family.low > 0) alerts.push(`${family.low} bajo`);
  if (family.out > 0) alerts.push(`${family.out} agotado${family.out === 1 ? '' : 's'}`);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text style={styles.cardLabel}>{family.name.toUpperCase()}</Text>
      <Text style={styles.cardCount}>{family.items}</Text>
      <Text style={styles.cardSub}>{itemNoun(family.kind, family.items)}</Text>
      {alerts.length > 0 ? (
        <View style={[styles.pill, family.out > 0 ? styles.pillRed : styles.pillAmber]}>
          <Text
            style={[styles.pillText, family.out > 0 ? styles.pillTextRed : styles.pillTextAmber]}
          >
            {alerts.join(' · ').toUpperCase()}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function InventoryFamilies() {
  const { profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const storeId = profile?.store_id ?? null;

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'articulo' | 'insumo'>('insumo');
  const [sellable, setSellable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['families', storeId],
    queryFn: () => listFamiliesWithStock(supabase, storeId as string),
    enabled: !!storeId,
  });

  const create = useMutation({
    mutationFn: () => createFamily(supabase, { name, kind, isSupply: !sellable }),
    onSuccess: () => {
      setCreating(false);
      setName('');
      setKind('insumo');
      setSellable(false);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['families'] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'No se pudo crear la familia.';
      setError(msg.includes('duplicate') ? 'Ya existe una familia con ese nombre.' : msg);
    },
  });

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState title="Sin sucursal asignada" />
      </SafeAreaView>
    );
  }

  const families = query.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.appbar}>
        <Text style={styles.title}>Inventario</Text>
        <Text style={styles.sub}>
          {families.length} {families.length === 1 ? 'FAMILIA' : 'FAMILIAS'}
        </Text>
      </View>

      {query.isLoading ? (
        <Loading label="Cargando familias…" />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.grid}>
            {families.map((f) => (
              <View key={f.id} style={styles.cell}>
                <FamilyCard family={f} onPress={() => router.push(`/(app)/inventory/${f.id}`)} />
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => setCreating(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addFamily, pressed && styles.cardPressed]}
          >
            <Text style={styles.addFamilyText}>+ NUEVA FAMILIA</Text>
          </Pressable>

          <Text style={styles.hint}>
            Las familias separan el inventario por tipo de artículo. Las marcadas como insumo no
            aparecen en el Punto de Venta.
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
            <Text style={styles.panelTitle}>Nueva familia</Text>

            <Text style={styles.fieldLabel}>NOMBRE</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Cajas, Etiquetas, Alcoholes…"
              placeholderTextColor={colors.muted}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>NATURALEZA</Text>
            <View style={styles.kindRow}>
              {(['articulo', 'insumo'] as const).map((k) => {
                const active = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    style={[styles.kindChip, active && styles.kindChipActive]}
                  >
                    <Text style={[styles.kindText, active && styles.kindTextActive]}>
                      {k === 'articulo' ? 'Artículo' : 'Insumo'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchTexts}>
                <Text style={styles.switchLabel}>Se vende en el Punto de Venta</Text>
                <Text style={styles.switchHint}>
                  Déjalo apagado para lo que solo se controla por stock
                </Text>
              </View>
              <Switch
                value={sellable}
                onValueChange={setSellable}
                trackColor={{ true: colors.ink, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <PrimaryButton
              label="Crear familia"
              loading={create.isPending}
              disabled={name.trim().length < 2}
              onPress={() => create.mutate()}
              style={{ marginTop: spacing.md }}
            />
            <Pressable onPress={() => setCreating(false)} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  },
  body: { padding: spacing.lg, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: '47%' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    minHeight: 118,
  },
  cardPressed: { backgroundColor: colors.surface2, transform: [{ scale: 0.99 }] },
  cardLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.9, color: colors.muted },
  cardCount: { fontFamily: fonts.serif, fontSize: 28, color: colors.ink, marginTop: spacing.sm },
  cardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  pill: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  pillAmber: { backgroundColor: colors.amberBg },
  pillRed: { backgroundColor: colors.redBg },
  pillText: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.5 },
  pillTextAmber: { color: colors.amberInk },
  pillTextRed: { color: colors.redInk },
  addFamily: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  addFamilyText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: colors.inkSoft },
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
  },
  panelTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
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
  kindRow: { flexDirection: 'row', gap: spacing.sm },
  kindChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  kindChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  kindText: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkSoft },
  kindTextActive: { color: '#FFFFFF' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  switchTexts: { flex: 1 },
  switchLabel: { fontSize: 14, color: colors.ink },
  switchHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  error: { color: colors.redInk, fontSize: 13, marginTop: spacing.md },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { color: colors.muted, fontSize: 13 },
});
