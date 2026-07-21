import type { SupabaseClient } from '@supabase/supabase-js';
import type { SaleRow } from '../database.types';
import { registerSaleSchema, type RegisterSaleInput } from '../validation';

/**
 * Registra una venta de mostrador llamando a la función atómica register_sale.
 * Valida stock, descuenta inventario y registra el kardex en una sola transacción.
 * Devuelve el id de la venta creada.
 */
export async function registerSale(
  client: SupabaseClient,
  input: RegisterSaleInput,
): Promise<string> {
  const parsed = registerSaleSchema.parse(input);

  const { data, error } = await client.rpc('register_sale', {
    p_store_id: parsed.store_id,
    p_payment_method: parsed.payment_method,
    p_discount: parsed.discount,
    p_customer_id: parsed.customer_id ?? null,
    p_items: parsed.items,
  });

  if (error) throw error;
  return data as string;
}

/** Lista las ventas de una sucursal, más recientes primero. */
export async function listSales(
  client: SupabaseClient,
  storeId: string,
  limit = 50,
): Promise<SaleRow[]> {
  const { data, error } = await client
    .from('sales')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SaleRow[];
}
