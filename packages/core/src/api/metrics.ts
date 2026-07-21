import type { SupabaseClient } from '@supabase/supabase-js';

export interface InventorySummary {
  /** Referencias con registro de inventario en la sucursal. */
  total: number;
  /** Con existencias por debajo (o igual) del mínimo, pero aún con stock. */
  low: number;
  /** Sin existencias. */
  out: number;
}

/** Resumen de inventario de una sucursal, para las tarjetas del hub. */
export async function getInventorySummary(
  client: SupabaseClient,
  storeId: string,
): Promise<InventorySummary> {
  const { data, error } = await client
    .from('inventory')
    .select('quantity,min_quantity')
    .eq('store_id', storeId);
  if (error) throw error;

  const rows = (data ?? []) as { quantity: number; min_quantity: number }[];
  return rows.reduce<InventorySummary>(
    (acc, row) => {
      if (row.quantity <= 0) acc.out += 1;
      else if (row.quantity <= row.min_quantity) acc.low += 1;
      return acc;
    },
    { total: rows.length, low: 0, out: 0 },
  );
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

/**
 * Productos más vendidos de una sucursal desde una fecha dada.
 * Agrega las líneas de venta completadas por producto.
 */
export async function getTopProducts(
  client: SupabaseClient,
  storeId: string,
  sinceIso: string,
  limit = 5,
): Promise<TopProduct[]> {
  const { data, error } = await client
    .from('sale_items')
    .select(
      'quantity,line_total,product:products(name),sale:sales!inner(store_id,created_at,status)',
    )
    .eq('sale.store_id', storeId)
    .eq('sale.status', 'completada')
    .gte('sale.created_at', sinceIso);
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    quantity: number;
    line_total: number;
    product: { name: string } | null;
  }[];

  const totals = new Map<string, TopProduct>();
  for (const row of rows) {
    const name = row.product?.name ?? 'Sin nombre';
    const current = totals.get(name) ?? { name, quantity: 0, revenue: 0 };
    current.quantity += row.quantity;
    current.revenue += row.line_total;
    totals.set(name, current);
  }

  return [...totals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}

/** Cantidad de pedidos online pendientes de atender en la sucursal. */
export async function countPendingOrders(client: SupabaseClient, storeId: string): Promise<number> {
  const { count, error } = await client
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('status', 'pendiente');
  if (error) throw error;
  return count ?? 0;
}
