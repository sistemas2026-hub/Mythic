import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';

/**
 * Crea un cliente de Supabase.
 *
 * Cada app pasa su propia URL/clave (Expo usa EXPO_PUBLIC_*, Next usa NEXT_PUBLIC_*)
 * y, si aplica, su almacenamiento de sesión (AsyncStorage en móvil, localStorage en web).
 */
export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: SupabaseClientOptions<'public'>,
): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Faltan las credenciales de Supabase (URL y anon key). Revisa tu archivo .env.',
    );
  }

  return createClient(url, anonKey, {
    ...options,
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      ...options?.auth,
    },
  });
}

export type { SupabaseClient };
