-- =============================================================================
-- Familias de artículos: separa el inventario en Perfumes, Envases, Esencias y
-- cualquier otra materia prima que la tienda quiera crear.
--
-- Los insumos (envases, esencias, materia prima) NO se venden en el POS: se
-- controlan solo por stock. Eso lo decide products.is_sellable, cuyo valor por
-- defecto al crear se toma de la familia (is_supply).
-- =============================================================================

create table public.product_families (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  -- true = insumo interno (no vendible por defecto)
  is_supply    boolean not null default false,
  -- las familias base no se pueden eliminar desde la app
  is_system    boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.products
  add column family_id uuid references public.product_families (id) on delete set null,
  add column unit text not null default 'unidad'
    check (unit in ('unidad', 'ml', 'g', 'l')),
  add column is_sellable boolean not null default true;

create index products_family_idx on public.products (family_id);

-- ----------------------------------------------------------------------------
-- Familias base
-- ----------------------------------------------------------------------------
insert into public.product_families (name, slug, description, is_supply, is_system) values
  ('Perfumes',      'perfumes',      'Producto terminado listo para la venta', false, true),
  ('Envases',       'envases',       'Frascos, tapas, atomizadores y empaques', true,  true),
  ('Esencias',      'esencias',      'Concentrados y aceites aromáticos',       true,  true),
  ('Materia prima', 'materia-prima', 'Alcohol, fijadores y otros insumos',      true,  true)
on conflict (slug) do nothing;

-- Los productos que ya existían son perfumes terminados y vendibles.
update public.products
set family_id = (select id from public.product_families where slug = 'perfumes'),
    is_sellable = true
where family_id is null;

-- ----------------------------------------------------------------------------
-- Seguridad: lectura para autenticados, escritura solo staff
-- ----------------------------------------------------------------------------
alter table public.product_families enable row level security;

create policy product_families_read on public.product_families
  for select using (auth.role() = 'authenticated');
create policy product_families_write on public.product_families
  for all using (public.is_staff()) with check (public.is_staff());

-- Los GRANT de tabla los cubre el `alter default privileges` de la migración
-- 20260721000004_grants.sql, pero se explicitan por claridad.
grant select, insert, update, delete on public.product_families to authenticated;
grant select on public.product_families to anon;
