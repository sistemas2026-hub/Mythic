-- =============================================================================
-- 1) Naturaleza de la familia (artículo vs insumo), separada de si se vende.
--
--    kind        -> cómo se clasifica y se etiqueta (Envases son artículos,
--                   Esencias y Materia prima son insumos).
--    is_supply   -> comportamiento: sus artículos no se venden en el POS.
--
--    Son cosas distintas: un envase es un artículo del inventario, pero
--    igualmente no se vende en el mostrador.
--
-- 2) `categories` pasa a ser la tabla de TIPOS de perfume (Árabe, Diseñador,
--    Nicho, Réplica). El género ya lo cubre products.gender, así que las
--    categorías hombre/mujer/unisex sobraban.
-- =============================================================================

alter table public.product_families
  add column kind text not null default 'insumo'
    check (kind in ('articulo', 'insumo'));

update public.product_families set kind = 'articulo' where slug in ('perfumes', 'envases');
update public.product_families set kind = 'insumo'   where slug in ('esencias', 'materia-prima');

-- ----------------------------------------------------------------------------
-- Tipos de perfume. Se pueden agregar más desde la app.
-- ----------------------------------------------------------------------------
insert into public.categories (name, slug) values
  ('Árabe',             'arabe'),
  ('Diseñador',         'disenador'),
  ('Nicho',             'nicho'),
  ('Réplica / Genérico', 'replica')
on conflict (slug) do nothing;

-- Las antiguas categorías de género quedaban duplicadas con products.gender.
delete from public.categories where slug in ('hombre', 'mujer', 'unisex');
