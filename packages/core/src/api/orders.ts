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

/** Renglón de un pedido con lo que hay que preparar. */
export interface OrderLineDetail {
  product_id: string;
  product_name: string;
  quantity: number;
  /** Unidades ya preparadas disponibles en la sucursal. */
  on_hand: number;
}

/** Renglones de un pedido, con cuántas unidades ya están preparadas. */
export async function listOrderLines(
  client: SupabaseClient,
  orderId: string,
  storeId: string,
): Promise<OrderLineDetail[]> {
  const { data, error } = await client
    .from('order_items')
    .select('product_id,quantity,product:products(name,inventory(quantity,store_id))')
    .eq('order_id', orderId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    product_id: string;
    quantity: number;
    product: { name: string; inventory: { quantity: number; store_id: string }[] | null } | null;
  }[];

  return rows.map((r) => ({
    product_id: r.product_id,
    product_name: r.product?.name ?? 'Artículo',
    quantity: r.quantity,
    on_hand: r.product?.inventory?.find((i) => i.store_id === storeId)?.quantity ?? 0,
  }));
}

/**
 * Cierra la preparación de un pedido: entrega lo que ya estaba preparado y
 * fabrica el resto consumiendo la fórmula. Deja el pedido en estado 'listo'.
 */
export async function finishPreparation(client: SupabaseClient, orderId: string): Promise<void> {
  const { error } = await client.rpc('finish_preparation', { p_order_id: orderId });
  if (error) throw error;
}

/** Etiquetas legibles para el estado de un pedido. */
export const orderStatusLabel: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
