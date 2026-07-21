import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { listCustomers, listSuppliers } from '@mythic/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { Loading } from '../../src/components/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../src/theme';

interface Entry {
  id: string;
  title: string;
  detail: string;
}

function Section({ label, entries, empty }: { label: string; entries: Entry[]; empty: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>
        {label} · {entries.length}
      </Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        entries.map((e) => (
          <View key={e.id} style={styles.row}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {e.title}
            </Text>
            <Text style={styles.rowDetail} numberOfLines={1}>
              {e.detail}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

export default function Contacts() {
  const { profile } = useAuth();
  const enabled = !!profile?.store_id;

  const customersQuery = useQuery({
    queryKey: ['customers'],
    queryFn: () => listCustomers(supabase),
    enabled,
  });
  const suppliersQuery = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => listSuppliers(supabase),
    enabled,
  });

  const loading = customersQuery.isLoading || suppliersQuery.isLoading;

  const customers: Entry[] = (customersQuery.data ?? []).map((c) => ({
    id: c.id,
    title: c.full_name,
    detail: c.phone ?? c.email ?? 'Sin contacto',
  }));
  const suppliers: Entry[] = (suppliersQuery.data ?? []).map((s) => ({
    id: s.id,
    title: s.name,
    detail: s.contact_name ?? s.phone ?? s.email ?? 'Sin contacto',
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Directorio" subtitle="Clientes y proveedores" />
      {loading ? (
        <Loading label="Cargando directorio…" />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Section
            label="CLIENTES"
            entries={customers}
            empty="Aún no hay clientes registrados. Se crean al asociarlos a una venta o pedido."
          />
          <Section
            label="PROVEEDORES"
            entries={suppliers}
            empty="Aún no hay proveedores registrados."
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  cardLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.9,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowTitle: { fontSize: 13, color: colors.ink, flex: 1 },
  rowDetail: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingTop: spacing.xs },
});
