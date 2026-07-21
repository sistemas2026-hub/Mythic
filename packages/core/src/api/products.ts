import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductRow, ProductWithStock } from '../database.types';
import type { ProductInput } from '../validation';

const PRODUCT_WITH_STOCK_SELECT =
  '*, brand:brands(id,name), category:categories(id,name,slug), inventory(quantity,min_quantity)';

/** Lista productos con su marca, categoría y stock en una sucursal. Búsqueda opcional por nombre/SKU. */
export async function listProductsWithStock(
  client: SupabaseClient,
  storeId: string,
  search?: string,
): Promise<ProductWithStock[]> {
  let query = client
    .from('products')
    .select(PRODUCT_WITH_STOCK_SELECT)
    .eq('is_active', true)
    .eq('inventory.store_id', storeId)
    .order('name', { ascending: true });

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    query = query.or(`name.ilike.${term},sku.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ProductWithStock[];
}

/** Busca un producto por código de barras (para el escáner del POS). */
export async function getProductByBarcode(
  client: SupabaseClient,
  barcode: string,
): Promise<ProductRow | null> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();
  if (error) throw error;
  return (data as ProductRow | null) ?? null;
}

/** Crea o actualiza un producto. */
export async function upsertProduct(
  client: SupabaseClient,
  input: ProductInput,
  id?: string,
): Promise<ProductRow> {
  const query = id
    ? client.from('products').update(input).eq('id', id).select('*').single()
    : client.from('products').insert(input).select('*').single();

  const { data, error } = await query;
  if (error) throw error;
  return data as ProductRow;
}
