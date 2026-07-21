import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { Loading } from '../src/components/ui';

export default function Index() {
  const { loading, session } = useAuth();

  if (loading) return <Loading label="Cargando…" />;
  return <Redirect href={session ? '/(app)' : '/login'} />;
}
