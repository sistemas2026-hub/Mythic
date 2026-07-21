import type { SupabaseClient } from '@supabase/supabase-js';
import type { CustomerRow, SupplierRow } from '../database.types';

/** Clientes registrados, alfabéticamente. */
export async function listCustomers(client: SupabaseClient, limit = 100): Promise<CustomerRow[]> {
  const { data, error } = await client
    .from('customers')
    .select('*')
    .order('full_name', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CustomerRow[];
}

/** Número de clientes registrados (sin traer las filas). */
export async function countCustomers(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from('customers')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Proveedores registrados, alfabéticamente. */
export async function listSuppliers(client: SupabaseClient, limit = 100): Promise<SupplierRow[]> {
  const { data, error } = await client
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SupplierRow[];
}
