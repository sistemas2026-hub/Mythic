import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoreRow } from '../database.types';

/** Datos de una sucursal (nombre, código, dirección). */
export async function getStore(client: SupabaseClient, storeId: string): Promise<StoreRow | null> {
  const { data, error } = await client.from('stores').select('*').eq('id', storeId).maybeSingle();
  if (error) throw error;
  return (data as StoreRow | null) ?? null;
}
