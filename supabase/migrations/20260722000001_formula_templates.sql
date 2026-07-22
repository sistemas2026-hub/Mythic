-- =============================================================================
-- Plantillas de fórmula (estándar) y preparación bajo pedido.
--
-- Contexto: los perfumes se preparan cuando el cliente los pide. Algunos siguen
-- una fórmula estándar y otros una personalizada. La plantilla fija las
-- CANTIDADES; cuál esencia lleva se decide en cada perfume, porque cada aroma
-- es distinto. Por eso el renglón de esencia es un hueco: dice cuánto, no cuál.
-- =============================================================================

create table public.formula_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  -- Tamaño al que aplica la plantilla (informativo, para elegir la correcta).
  volume_ml   integer check (volume_ml is null or volume_ml > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.formula_template_items (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid not null references public.formula_templates (id) on delete cascade,
  -- Insumo concreto (alcohol, fijador…). Va nulo cuando es el hueco de esencia.
  component_id     uuid references public.products (id) on delete restrict,
  -- true = "la esencia de este perfume", se resuelve al crear cada perfume.
  is_essence_slot  boolean not null default false,
  quantity         numeric(12, 2) not null check (quantity > 0),
  -- O es el hueco de esencia (sin componente), o es un insumo concreto.
  check (
    (is_essence_slot and component_id is null)
    or (not is_essence_slot and component_id is not null)
  )
);

create index formula_template_items_template_idx
  on public.formula_template_items (template_id);

-- ----------------------------------------------------------------------------
-- El perfume recuerda de qué plantilla salió y cuál es su esencia.
-- `product_components` sigue siendo la fórmula efectiva (ya resuelta), para que
-- la preparación no tenga que interpretar plantillas.
-- ----------------------------------------------------------------------------
alter table public.products
  add column formula_template_id uuid references public.formula_templates (id) on delete set null,
  add column essence_id          uuid references public.products (id) on delete set null,
  -- true cuando el usuario cambió las cantidades respecto de la plantilla.
  add column is_custom_formula   boolean not null default false;

-- ----------------------------------------------------------------------------
-- Seguridad
-- ----------------------------------------------------------------------------
alter table public.formula_templates enable row level security;
alter table public.formula_template_items enable row level security;

create policy formula_templates_read on public.formula_templates
  for select using (auth.role() = 'authenticated');
create policy formula_templates_write on public.formula_templates
  for all using (public.is_staff()) with check (public.is_staff());

create policy formula_template_items_read on public.formula_template_items
  for select using (auth.role() = 'authenticated');
create policy formula_template_items_write on public.formula_template_items
  for all using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.formula_templates to authenticated;
grant select, insert, update, delete on public.formula_template_items to authenticated;
