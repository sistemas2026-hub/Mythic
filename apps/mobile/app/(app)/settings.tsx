import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getStore } from '@mythic/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { PrimaryButton } from '../../src/components/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../src/theme';

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  cliente: 'Cliente',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function Settings() {
  const { profile, session, signOut } = useAuth();
  const storeId = profile?.store_id ?? null;

  const storeQuery = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => getStore(supabase, storeId as string),
    enabled: !!storeId,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Ajustes" subtitle="Cuenta y sesión" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>CUENTA</Text>
          <Row label="Nombre" value={profile?.full_name ?? '—'} />
          <Row label="Correo" value={session?.user.email ?? '—'} />
          <Row label="Rol" value={roleLabel[profile?.role ?? ''] ?? '—'} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>SUCURSAL</Text>
          <Row label="Nombre" value={storeQuery.data?.name ?? '—'} />
          <Row label="Código" value={storeQuery.data?.code ?? '—'} />
          <Row label="Dirección" value={storeQuery.data?.address ?? '—'} />
        </View>

        <PrimaryButton label="Cerrar sesión" onPress={() => void signOut()} />
      </ScrollView>
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
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLabel: { fontSize: 13, color: colors.muted },
  rowValue: { fontSize: 13, color: colors.ink, flexShrink: 1, textAlign: 'right' },
});
