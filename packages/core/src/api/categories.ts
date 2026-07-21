import type { SupabaseClient } from '@supabase/supabase-js';
import type { CategoryRow } from '../database.types';

/**
 * Tipos de clasificación de los perfumes (Árabe, Diseñador, Nicho, Réplica…).
 * La tienda puede agregar los que necesite.
 */
export async function listCategories(client: SupabaseClient): Promise<CategoryRow[]> {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

/** Crea un tipo nuevo. */
export async function createCategory(client: SupabaseClient, name: string): Promise<CategoryRow> {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const { data, error } = await client
    .from('categories')
    .insert({ name: name.trim(), slug })
    .select('*')
    .single();
  if (error) throw error;
  return data as CategoryRow;
}
