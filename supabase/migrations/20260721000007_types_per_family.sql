-- =============================================================================
-- Los tipos pasan a ser PROPIOS DE CADA FAMILIA.
--
-- Antes `categories` era una lista global, así que los tipos de perfume
-- (Árabe, Diseñador…) habrían aparecido también dentro de Envases. Ahora cada
-- familia define los suyos: Perfumes tendrá Árabe/Diseñador/…, Envases tendrá
-- Frascos/Atomizadores/…, y así con cualquier familia nueva.
-- =============================================================================

alter table public.categories
  add column family_id uuid references public.product_families (id) on delete cascade;

-- Lo que ya existía eran tipos de perfume.
update public.categories
set family_id = (select id from public.product_families where slug = 'perfumes')
where family_id is null;

-- El slug deja de ser único global y pasa a ser único dentro de la familia,
-- para que dos familias puedan tener un tipo con el mismo nombre.
alter table public.categories drop constraint if exists categories_slug_key;
alter table public.categories
  add constraint categories_family_slug_key unique (family_id, slug);

create index categories_family_idx on public.categories (family_id);
