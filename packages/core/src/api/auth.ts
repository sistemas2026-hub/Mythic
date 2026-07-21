import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileRow } from '../database.types';

/** Inicia sesión con correo y contraseña. */
export async function signIn(client: SupabaseClient, email: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

/** Devuelve el perfil (con rol y sucursal) del usuario autenticado, o null. */
export async function getCurrentProfile(client: SupabaseClient): Promise<ProfileRow | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return (data as ProfileRow | null) ?? null;
}
