import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductUnit } from '../database.types';

/** Un insumo de la fórmula, con lo que aporta a UNA unidad del producto. */
export interface RecipeComponent {
  component_id: string;
  quantity: number;
}

/** Componente con los datos del insumo, para mostrarlo en pantalla. */
export interface RecipeComponentDetail extends RecipeComponent {
  name: string;
  unit: ProductUnit;
}

/** Insumo disponible para armar fórmulas (esencias, alcohol, fijadores…). */
export interface SupplyOption {
  id: string;
  name: string;
  unit: ProductUnit;
  family_name: string;
  stock: number;
}

/**
 * Insumos que se pueden usar en una fórmula: los artículos de las familias
 * marcadas como insumo, con sus existencias en la sucursal.
 */
export async function listSupplies(
  client: SupabaseClient,
  storeId: string,
): Promise<SupplyOption[]> {
  const { data, error } = await client
    .from('products')
    .select('id,name,unit,family:product_families!inner(name,is_supply),inventory(quantity)')
    .eq('is_active', true)
    .eq('family.is_supply', true)
    .eq('inventory.store_id', storeId)
    .order('name', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    unit: ProductUnit;
    family: { name: string } | null;
    inventory: { quantity: number }[] | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    family_name: r.family?.name ?? '',
    stock: r.inventory?.[0]?.quantity ?? 0,
  }));
}

/** Fórmula guardada de un producto. */
export async function listRecipe(
  client: SupabaseClient,
  productId: string,
): Promise<RecipeComponentDetail[]> {
  const { data, error } = await client
    .from('product_components')
    .select(
      'component_id,quantity,component:products!product_components_component_id_fkey(name,unit)',
    )
    .eq('product_id', productId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    component_id: string;
    quantity: number;
    component: { name: string; unit: ProductUnit } | null;
  }[];

  return rows.map((r) => ({
    component_id: r.component_id,
    quantity: r.quantity,
    name: r.component?.name ?? '',
    unit: r.component?.unit ?? 'unidad',
  }));
}

/** Reemplaza la fórmula completa de un producto. */
export async function setRecipe(
  client: SupabaseClient,
  productId: string,
  components: RecipeComponent[],
): Promise<void> {
  const { error: delError } = await client
    .from('product_components')
    .delete()
    .eq('product_id', productId);
  if (delError) throw delError;

  const rows = components
    .filter((c) => c.quantity > 0)
    .map((c) => ({ product_id: productId, component_id: c.component_id, quantity: c.quantity }));
  if (rows.length === 0) return;

  const { error } = await client.from('product_components').insert(rows);
  if (error) throw error;
}

/** Lo que hay que agregar de un insumo para preparar un renglón del pedido. */
export interface PreparationComponent {
  name: string;
  unit: ProductUnit;
  /** Cantidad total a usar (fórmula × unidades a fabricar). */
  required: number;
  available: number;
  enough: boolean;
}

/** Un perfume del pedido con lo que falta preparar y qué lleva. */
export interface PreparationLine {
  product_id: string;
  product_name: string;
  /** Unidades pedidas. */
  quantity: number;
  /** Unidades ya preparadas que se entregan de una. */
  on_hand: number;
  /** Unidades que hay que fabricar. */
  to_make: number;
  components: PreparationComponent[];
}

/**
 * Guía de preparación de un pedido: por cada perfume, cuánto hay que agregar de
 * cada componente. Descuenta primero lo que ya está preparado.
 */
export async function getPreparationPlan(
  client: SupabaseClient,
  orderId: string,
  storeId: string,
): Promise<PreparationLine[]> {
  const { data: itemsData, error: itemsError } = await client
    .from('order_items')
    .select('product_id,quantity,product:products(name)')
    .eq('order_id', orderId);
  if (itemsError) throw itemsError;

  const items = (itemsData ?? []) as unknown as {
    product_id: string;
    quantity: number;
    product: { name: string } | null;
  }[];
  if (items.length === 0) return [];

  const productIds = items.map((i) => i.product_id);

  const [recipesRes, stockRes] = await Promise.all([
    client
      .from('product_components')
      .select(
        'product_id,component_id,quantity,component:products!product_components_component_id_fkey(name,unit)',
      )
      .in('product_id', productIds),
    client.from('inventory').select('product_id,quantity').eq('store_id', storeId),
  ]);
  if (recipesRes.error) throw recipesRes.error;
  if (stockRes.error) throw stockRes.error;

  const recipes = (recipesRes.data ?? []) as unknown as {
    product_id: string;
    component_id: string;
    quantity: number;
    component: { name: string; unit: ProductUnit } | null;
  }[];
  const stock = new Map(
    ((stockRes.data ?? []) as { product_id: string; quantity: number }[]).map((s) => [
      s.product_id,
      s.quantity,
    ]),
  );

  return items.map((item) => {
    const onHand = Math.min(stock.get(item.product_id) ?? 0, item.quantity);
    const toMake = item.quantity - onHand;

    const components = recipes
      .filter((r) => r.product_id === item.product_id)
      .map((r) => {
        const required = Math.ceil(r.quantity * toMake);
        const available = stock.get(r.component_id) ?? 0;
        return {
          name: r.component?.name ?? 'Insumo',
          unit: r.component?.unit ?? ('unidad' as ProductUnit),
          required,
          available,
          enough: available >= required,
        };
      });

    return {
      product_id: item.product_id,
      product_name: item.product?.name ?? 'Perfume',
      quantity: item.quantity,
      on_hand: onHand,
      to_make: toMake,
      components,
    };
  });
}

/**
 * Fabrica `units` del producto: descuenta su fórmula del inventario de insumos
 * y suma el producto terminado, dejando kardex de ambos lados.
 */
export async function registerProduction(
  client: SupabaseClient,
  storeId: string,
  productId: string,
  units: number,
): Promise<void> {
  const { error } = await client.rpc('register_production', {
    p_store_id: storeId,
    p_product_id: productId,
    p_units: units,
  });
  if (error) throw error;
}
