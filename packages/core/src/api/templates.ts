import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductUnit } from '../database.types';
import type { RecipeComponent } from './recipes';

export interface FormulaTemplateItem {
  /** Insumo concreto. Null cuando es el hueco de esencia. */
  component_id: string | null;
  /** true = "la esencia de este perfume": la cantidad es fija, el insumo no. */
  is_essence_slot: boolean;
  quantity: number;
  /** Nombre del insumo, o null en el hueco de esencia. */
  name: string | null;
  unit: ProductUnit | null;
}

export interface FormulaTemplate {
  id: string;
  name: string;
  volume_ml: number | null;
  items: FormulaTemplateItem[];
}

/** Plantillas de fórmula estándar con sus componentes. */
export async function listFormulaTemplates(client: SupabaseClient): Promise<FormulaTemplate[]> {
  const { data, error } = await client
    .from('formula_templates')
    .select(
      'id,name,volume_ml,items:formula_template_items(component_id,is_essence_slot,quantity,component:products(name,unit))',
    )
    .eq('is_active', true)
    .order('volume_ml', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    volume_ml: number | null;
    items: {
      component_id: string | null;
      is_essence_slot: boolean;
      quantity: number;
      component: { name: string; unit: ProductUnit } | null;
    }[];
  }[];

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    volume_ml: t.volume_ml,
    items: (t.items ?? [])
      // La esencia primero: es lo que define al perfume.
      .sort((a, b) => Number(b.is_essence_slot) - Number(a.is_essence_slot))
      .map((i) => ({
        component_id: i.component_id,
        is_essence_slot: i.is_essence_slot,
        quantity: i.quantity,
        name: i.component?.name ?? null,
        unit: i.component?.unit ?? null,
      })),
  }));
}

/**
 * Convierte una plantilla en la fórmula concreta de un perfume, reemplazando el
 * hueco de esencia por la esencia elegida.
 */
export function resolveTemplate(
  template: FormulaTemplate,
  essenceId: string | null,
): RecipeComponent[] {
  return template.items
    .map((i) => ({
      component_id: i.is_essence_slot ? essenceId : i.component_id,
      quantity: i.quantity,
    }))
    .filter((c): c is RecipeComponent => !!c.component_id);
}

/** Crea una plantilla nueva con sus componentes. */
export async function createFormulaTemplate(
  client: SupabaseClient,
  input: {
    name: string;
    volumeMl?: number | null;
    /** Cantidad de esencia por unidad (el hueco). */
    essenceQuantity: number;
    /** Insumos fijos: alcohol, fijador… */
    components: RecipeComponent[];
  },
): Promise<string> {
  const { data, error } = await client
    .from('formula_templates')
    .insert({ name: input.name.trim(), volume_ml: input.volumeMl ?? null })
    .select('id')
    .single();
  if (error) throw error;
  const templateId = (data as { id: string }).id;

  const items = [
    { template_id: templateId, is_essence_slot: true, quantity: input.essenceQuantity },
    ...input.components.map((c) => ({
      template_id: templateId,
      component_id: c.component_id,
      quantity: c.quantity,
    })),
  ];

  const { error: itemsError } = await client.from('formula_template_items').insert(items);
  if (itemsError) throw itemsError;
  return templateId;
}
