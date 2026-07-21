import type { SupabaseClient } from '@supabase/supabase-js';
import type { InventoryMovementRow } from '../database.types';
import { stockAdjustmentSchema, type StockAdjustmentInput } from '../validation';

/**
 * Ajusta el stock de un producto en una sucursal y registra el movimiento (kardex).
 * 'entrada' suma, 'salida' resta, 'ajuste' fija el delta indicado como entrada.
 *
 * Nota: usa upsert + insert de movimiento. Para operaciones concurrentes intensas
 * conviene mover esta lógica a una función SQL (como register_sale).
 */
export async function adjustStock(
  client: SupabaseClient,
  input: StockAdjustmentInput,
): Promise<void> {
  const { store_id, product_id, type, quantity, reason } = stockAdjustmentSchema.parse(input);
  const delta = type === 'salida' ? -quantity : quantity;

  const { data: current, error: readErr } = await client
    .from('inventory')
    .select('quantity')
    .eq('store_id', store_id)
    .eq('product_id', product_id)
    .maybeSingle();
  if (readErr) throw readErr;

  const nextQty = Math.max((current?.quantity ?? 0) + delta, 0);

  const { error: upsertErr } = await client
    .from('inventory')
    .upsert({ store_id, product_id, quantity: nextQty }, { onConflict: 'store_id,product_id' });
  if (upsertErr) throw upsertErr;

  const { error: movErr } = await client
    .from('inventory_movements')
    .insert({ store_id, product_id, type, quantity, reason: reason ?? null });
  if (movErr) throw movErr;
}

/** Movimientos de kardex de un producto en una sucursal. */
export async function listMovements(
  client: SupabaseClient,
  storeId: string,
  productId: string,
  limit = 50,
): Promise<InventoryMovementRow[]> {
  const { data, error } = await client
    .from('inventory_movements')
    .select('*')
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InventoryMovementRow[];
}
