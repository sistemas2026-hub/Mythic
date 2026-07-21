import type { SupabaseClient } from '@supabase/supabase-js';
import type { CategoryRow } from '../database.types';

/**
 * Tipos de clasificación de los perfumes (Árabe, Diseñador, Nicho, Réplica…).
 * La tienda puede agregar los que necesite.
 */
export async function listCategories(
  client: SupabaseClient,
  familyId?: string,
): Promise<CategoryRow[]> {
  let query = client.from('categories').select('*').order('name', { ascending: true });
  if (familyId) query = query.eq('family_id', familyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

/** Tipo con cuántos artículos tiene y su estado de stock en la sucursal. */
export interface TypeWithStock extends CategoryRow {
  items: number;
  low: number;
  out: number;
}

export interface TypesBreakdown {
  types: TypeWithStock[];
  /** Artículos de la familia que aún no tienen tipo asignado. */
  untyped: { items: number; low: number; out: number };
}

/**
 * Tipos con el conteo de artículos de una familia, para mostrarlos como
 * sub-módulos (Árabe 12, Diseñador 30…).
 */
export async function listTypesWithStock(
  client: SupabaseClient,
  storeId: string,
  familyId: string,
): Promise<TypesBreakdown> {
  const [catsRes, prodRes] = await Promise.all([
    client
      .from('categories')
      .select('*')
      .eq('family_id', familyId)
      .order('name', { ascending: true }),
    client
      .from('products')
      .select('category_id,inventory(quantity,min_quantity)')
      .eq('is_active', true)
      .eq('family_id', familyId)
      .eq('inventory.store_id', storeId),
  ]);
  if (catsRes.error) throw catsRes.error;
  if (prodRes.error) throw prodRes.error;

  const cats = (catsRes.data ?? []) as CategoryRow[];
  const products = (prodRes.data ?? []) as unknown as {
    category_id: string | null;
    inventory: { quantity: number; min_quantity: number }[] | null;
  }[];

  const blank = () => ({ items: 0, low: 0, out: 0 });
  const byType = new Map<string, ReturnType<typeof blank>>();
  const untyped = blank();

  for (const p of products) {
    const bucket = p.category_id ? (byType.get(p.category_id) ?? blank()) : untyped;
    bucket.items += 1;
    const inv = p.inventory?.[0];
    const qty = inv?.quantity ?? 0;
    const min = inv?.min_quantity ?? 0;
    if (qty <= 0) bucket.out += 1;
    else if (qty <= min) bucket.low += 1;
    if (p.category_id) byType.set(p.category_id, bucket);
  }

  return {
    types: cats.map((c) => ({ ...c, ...(byType.get(c.id) ?? blank()) })),
    untyped,
  };
}

/** Crea un tipo nuevo dentro de una familia. */
export async function createCategory(
  client: SupabaseClient,
  name: string,
  familyId: string,
): Promise<CategoryRow> {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const { data, error } = await client
    .from('categories')
    .insert({ name: name.trim(), slug, family_id: familyId })
    .select('*')
    .single();
  if (error) throw error;
  return data as CategoryRow;
}
