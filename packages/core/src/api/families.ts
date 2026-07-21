import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductFamilyRow } from '../database.types';

/** Familia con el resumen de stock de sus artículos en una sucursal. */
export interface FamilyWithStock extends ProductFamilyRow {
  /** Artículos activos de la familia. */
  items: number;
  /** Artículos con existencias en o por debajo del mínimo (aún con stock). */
  low: number;
  /** Artículos sin existencias. */
  out: number;
}

/**
 * Lista las familias con cuántos artículos tiene cada una y su estado de stock
 * en la sucursal indicada. Es la pantalla de entrada del inventario.
 */
export async function listFamiliesWithStock(
  client: SupabaseClient,
  storeId: string,
): Promise<FamilyWithStock[]> {
  const [familiesRes, productsRes] = await Promise.all([
    client.from('product_families').select('*').order('is_supply').order('name'),
    client
      .from('products')
      .select('family_id,inventory(quantity,min_quantity)')
      .eq('is_active', true)
      .eq('inventory.store_id', storeId),
  ]);

  if (familiesRes.error) throw familiesRes.error;
  if (productsRes.error) throw productsRes.error;

  const families = (familiesRes.data ?? []) as ProductFamilyRow[];
  const products = (productsRes.data ?? []) as unknown as {
    family_id: string | null;
    inventory: { quantity: number; min_quantity: number }[] | null;
  }[];

  const summary = new Map<string, { items: number; low: number; out: number }>();
  for (const p of products) {
    if (!p.family_id) continue;
    const acc = summary.get(p.family_id) ?? { items: 0, low: 0, out: 0 };
    acc.items += 1;
    const inv = p.inventory?.[0];
    const qty = inv?.quantity ?? 0;
    const min = inv?.min_quantity ?? 0;
    if (qty <= 0) acc.out += 1;
    else if (qty <= min) acc.low += 1;
    summary.set(p.family_id, acc);
  }

  return families.map((f) => ({
    ...f,
    ...(summary.get(f.id) ?? { items: 0, low: 0, out: 0 }),
  }));
}

/** Crea una familia nueva (por ejemplo "Cajas" o "Etiquetas"). */
export async function createFamily(
  client: SupabaseClient,
  input: { name: string; description?: string; isSupply?: boolean },
): Promise<ProductFamilyRow> {
  const slug = input.name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const { data, error } = await client
    .from('product_families')
    .insert({
      name: input.name.trim(),
      slug,
      description: input.description ?? null,
      is_supply: input.isSupply ?? true,
      is_system: false,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProductFamilyRow;
}

/** Una familia por su id. */
export async function getFamily(
  client: SupabaseClient,
  familyId: string,
): Promise<ProductFamilyRow | null> {
  const { data, error } = await client
    .from('product_families')
    .select('*')
    .eq('id', familyId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProductFamilyRow | null) ?? null;
}
