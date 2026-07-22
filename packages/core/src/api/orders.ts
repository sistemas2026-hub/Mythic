import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderRow, OrderStatus } from '../database.types';
import { registerOrderSchema, type RegisterOrderInput } from '../validation';

/**
 * Crea un pedido llamando a la función atómica register_order.
 * Valida stock, lo descuenta y deja el movimiento de kardex.
 * Devuelve el id del pedido creado.
 */
export async function registerOrder(
  client: SupabaseClient,
  input: RegisterOrderInput,
): Promise<string> {
  const parsed = registerOrderSchema.parse(input);

  const { data, error } = await client.rpc('register_order', {
    p_store_id: parsed.store_id,
    p_customer_id: parsed.customer_id ?? null,
    p_notes: parsed.notes ?? null,
    p_items: parsed.items,
  });

  if (error) throw error;
  return data as string;
}

/** Pedidos de la tienda online de una sucursal, más recientes primero. */
export async function listOrders(
  client: SupabaseClient,
  storeId: string,
  status?: OrderStatus,
  limit = 50,
): Promise<OrderRow[]> {
  let query = client
    .from('orders')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

/** Etiquetas legibles para el estado de un pedido. */
export const orderStatusLabel: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
