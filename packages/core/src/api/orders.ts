import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderRow, OrderStatus } from '../database.types';

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
