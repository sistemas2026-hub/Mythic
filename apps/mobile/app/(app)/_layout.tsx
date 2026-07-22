import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { Loading } from '../../src/components/ui';
import { colors, fonts } from '../../src/theme';

export default function AppLayout() {
  const { session, loading } = useAuth();

  if (loading) return <Loading label="Cargando…" />;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: {
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          marginTop: 6,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="pos" options={{ title: 'Venta' }} />
      <Tabs.Screen name="inventory" options={{ title: 'Stock' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reportes' }} />

      {/* Módulos accesibles desde el panel flotante, fuera de la barra de pestañas */}
      <Tabs.Screen name="stats" options={{ href: null }} />
      <Tabs.Screen name="orders" options={{ href: null }} />
      <Tabs.Screen name="neworder" options={{ href: null }} />
      <Tabs.Screen name="contacts" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
