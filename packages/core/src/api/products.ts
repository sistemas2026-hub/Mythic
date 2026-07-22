import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductRow, ProductWithStock } from '../database.types';
import { newArticleSchema, type NewArticleInput, type ProductInput } from '../validation';

const PRODUCT_WITH_STOCK_SELECT =
  '*, brand:brands(id,name), category:categories(id,name,slug), inventory(quantity,min_quantity)';

export interface ProductQueryOptions {
  /** Busca por nombre o SKU. */
  search?: string;
  /** Limita a una familia de artículos (Perfumes, Envases, Esencias…). */
  familyId?: string;
  /** Limita a un tipo (Árabe, Diseñador…). */
  categoryId?: string;
  /** Solo los que aún no tienen tipo asignado. */
  untyped?: boolean;
  /** Solo artículos vendibles en el POS (excluye insumos internos). */
  sellableOnly?: boolean;
}

/** Lista productos con su marca, categoría y stock en una sucursal. */
export async function listProductsWithStock(
  client: SupabaseClient,
  storeId: string,
  options: ProductQueryOptions = {},
): Promise<ProductWithStock[]> {
  let query = client
    .from('products')
    .select(PRODUCT_WITH_STOCK_SELECT)
    .eq('is_active', true)
    .eq('inventory.store_id', storeId)
    .order('name', { ascending: true });

  if (options.familyId) query = query.eq('family_id', options.familyId);
  if (options.categoryId) query = query.eq('category_id', options.categoryId);
  if (options.untyped) query = query.is('category_id', null);
  if (options.sellableOnly) query = query.eq('is_sellable', true);

  const search = options.search?.trim();
  if (search) {
    const term = `%${search}%`;
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

/**
 * Crea un artículo y deja sus existencias iniciales en la sucursal.
 * Registra el movimiento de kardex cuando entra con stock.
 */
export async function createArticleWithStock(
  client: SupabaseClient,
  storeId: string,
  input: NewArticleInput,
): Promise<ProductRow> {
  const { quantity, min_quantity, ...productFields } = newArticleSchema.parse(input);

  const { data, error } = await client.from('products').insert(productFields).select('*').single();
  if (error) throw error;
  const product = data as ProductRow;

  const { error: invError } = await client
    .from('inventory')
    .insert({ store_id: storeId, product_id: product.id, quantity, min_quantity });
  if (invError) throw invError;

  if (quantity > 0) {
    const { error: movError } = await client.from('inventory_movements').insert({
      store_id: storeId,
      product_id: product.id,
      type: 'entrada',
      quantity,
      reason: 'Existencias iniciales',
    });
    if (movError) throw movError;
  }

  return product;
}

/** Actualiza los campos indicados de un artículo. */
export async function updateProduct(
  client: SupabaseClient,
  id: string,
  changes: Partial<ProductInput>,
): Promise<ProductRow> {
  const { data, error } = await client
    .from('products')
    .update(changes)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProductRow;
}

/**
 * Retira un artículo del catálogo. Es un borrado lógico (is_active = false)
 * para no romper el historial de ventas que lo referencia.
 */
export async function deactivateProduct(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('products').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

/**
 * Crea la fila de inventario del artículo si no existe (con cero existencias)
 * y deja fijado su mínimo. Se usa antes de producir, para no pisar el stock.
 */
export async function ensureInventory(
  client: SupabaseClient,
  storeId: string,
  productId: string,
  minQuantity: number,
): Promise<void> {
  const { error } = await client
    .from('inventory')
    .upsert(
      { store_id: storeId, product_id: productId, quantity: 0, min_quantity: minQuantity },
      { onConflict: 'store_id,product_id', ignoreDuplicates: true },
    );
  if (error) throw error;

  const { error: minError } = await client
    .from('inventory')
    .update({ min_quantity: minQuantity })
    .eq('store_id', storeId)
    .eq('product_id', productId);
  if (minError) throw minError;
}

/** Ajusta las existencias y el mínimo de un artículo en una sucursal. */
export async function setStockLevels(
  client: SupabaseClient,
  storeId: string,
  productId: string,
  quantity: number,
  minQuantity: number,
): Promise<void> {
  const { error } = await client
    .from('inventory')
    .upsert(
      { store_id: storeId, product_id: productId, quantity, min_quantity: minQuantity },
      { onConflict: 'store_id,product_id' },
    );
  if (error) throw error;
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
