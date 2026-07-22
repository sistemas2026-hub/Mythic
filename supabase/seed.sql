-- =============================================================================
-- Datos de ejemplo — Mythic Perfumería
-- Catálogo, sucursal e inventario inicial. (No crea usuarios de auth: ver README.)
-- =============================================================================

-- Sucursal principal
insert into public.stores (id, name, code, address, phone)
values ('11111111-1111-1111-1111-111111111111', 'Sucursal Centro', 'centro', 'Calle 10 # 5-40', '3000000000')
on conflict (code) do nothing;

-- ============================================================================
-- Usuario de DESARROLLO (admin@mythic.co / mythic123456)
-- Solo para el entorno local: sobrevive a `pnpm db:reset`. NUNCA usar en la nube.
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated', 'admin@mythic.co',
  crypt('mythic123456', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Administrador Mythic"}',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email),
       'email', now(), now(), now()
from auth.users u
where u.email = 'admin@mythic.co'
on conflict do nothing;

-- El trigger handle_new_user crea el perfil como 'cliente'; lo promovemos.
update public.profiles
set role = 'admin', store_id = '11111111-1111-1111-1111-111111111111'
where id = '22222222-2222-2222-2222-222222222222';

-- Marcas
insert into public.brands (name) values
  ('Dior'), ('Chanel'), ('Carolina Herrera'), ('Paco Rabanne'),
  ('Yves Saint Laurent'), ('Versace'), ('Giorgio Armani'), ('Lancôme')
on conflict (name) do nothing;

-- Tipos por familia (se pueden agregar más desde la app)
insert into public.categories (name, slug, family_id)
select t.name, t.slug, f.id
from (values
  ('Árabe',              'arabe',        'perfumes'),
  ('Diseñador',          'disenador',    'perfumes'),
  ('Nicho',              'nicho',        'perfumes'),
  ('Réplica / Genérico', 'replica',      'perfumes'),
  ('Frascos',            'frascos',      'envases'),
  ('Atomizadores',       'atomizadores', 'envases'),
  ('Tapas',              'tapas',        'envases'),
  ('Cajas',              'cajas',        'envases'),
  ('Diseñador',          'disenador',    'esencias'),
  ('Árabe',              'arabe',        'esencias'),
  ('Nicho',              'nicho',        'esencias'),
  ('Damas',              'damas',        'esencias'),
  ('Caballeros',         'caballeros',   'esencias'),
  ('Unisex',             'unisex',       'esencias')
) as t(name, slug, family_slug)
join public.product_families f on f.slug = t.family_slug
on conflict (family_id, slug) do nothing;

-- La familia Perfumes arranca VACÍA: el catálogo real lo carga la tienda desde
-- la app (Inventario -> Perfumes -> Agregar artículo).

-- Insumos internos: envases, esencias y materia prima (no vendibles en el POS)
insert into public.products (name, family_id, sku, unit, price, cost, is_sellable)
select i.name,
       (select id from public.product_families where slug = i.family_slug),
       i.sku, i.unit, 0, i.cost, false
from (values
  ('Frasco vidrio 100ml',        'envases',       'ENV-FR100',  'unidad',  3500),
  ('Frasco vidrio 50ml',         'envases',       'ENV-FR050',  'unidad',  2600),
  ('Atomizador dorado',          'envases',       'ENV-ATOM-D', 'unidad',  1800),
  ('Tapa acrílica negra',        'envases',       'ENV-TAPA-N', 'unidad',   900),
  ('Esencia amaderada oriental', 'esencias',      'ESE-AMAD',   'ml',        95),
  ('Esencia cítrica fresca',     'esencias',      'ESE-CITR',   'ml',        82),
  ('Esencia floral almizclada',  'esencias',      'ESE-FLOR',   'ml',       110),
  -- El alcohol y el agua se miden en ml aunque se compren por litro: las
  -- fórmulas trabajan en ml y mezclar unidades daría cantidades absurdas.
  ('Alcohol etílico 96%',        'materia-prima', 'MP-ALC96',   'ml',        18),
  ('Fijador cosmético',          'materia-prima', 'MP-FIJA',    'ml',        60),
  ('Agua destilada',             'materia-prima', 'MP-AGUA',    'ml',         4)
) as i(name, family_slug, sku, unit, cost)
on conflict (sku) do nothing;

-- Plantillas de fórmula estándar. El renglón de esencia es un hueco: fija la
-- cantidad, pero cuál esencia se decide en cada perfume.
insert into public.formula_templates (name, volume_ml) values
  ('Estándar 100 ml', 100),
  ('Estándar 50 ml', 50),
  ('Estándar 30 ml', 30)
on conflict (name) do nothing;

-- Hueco de esencia de cada plantilla
insert into public.formula_template_items (template_id, is_essence_slot, quantity)
select t.id, true, v.esencia
from (values ('Estándar 100 ml', 30), ('Estándar 50 ml', 15), ('Estándar 30 ml', 9)) as v(name, esencia)
join public.formula_templates t on t.name = v.name
where not exists (
  select 1 from public.formula_template_items i
  where i.template_id = t.id and i.is_essence_slot
);

-- Alcohol y fijador de cada plantilla
insert into public.formula_template_items (template_id, component_id, quantity)
select t.id, p.id, v.cantidad
from (values
  ('Estándar 100 ml', 'MP-ALC96', 65),
  ('Estándar 100 ml', 'MP-FIJA',   5),
  ('Estándar 50 ml',  'MP-ALC96', 33),
  ('Estándar 50 ml',  'MP-FIJA',   2),
  ('Estándar 30 ml',  'MP-ALC96', 20),
  ('Estándar 30 ml',  'MP-FIJA',   1)
) as v(plantilla, sku, cantidad)
join public.formula_templates t on t.name = v.plantilla
join public.products p on p.sku = v.sku
where not exists (
  select 1 from public.formula_template_items i
  where i.template_id = t.id and i.component_id = p.id
);

-- Clasifica los envases de ejemplo en sus tipos
update public.products p
set category_id = c.id
from public.categories c
join public.product_families f on f.id = c.family_id
where f.slug = 'envases'
  and c.slug = case
    when p.sku in ('ENV-FR100', 'ENV-FR050') then 'frascos'
    when p.sku = 'ENV-ATOM-D' then 'atomizadores'
    when p.sku = 'ENV-TAPA-N' then 'tapas'
  end;

-- Existencias iniciales de los insumos en la sucursal Centro
insert into public.inventory (store_id, product_id, quantity, min_quantity)
select '11111111-1111-1111-1111-111111111111', pr.id, q.quantity, q.min_quantity
from (values
  ('ENV-FR100',  120, 40),
  ('ENV-FR050',   85, 40),
  ('ENV-ATOM-D',  30, 50),
  ('ENV-TAPA-N', 210, 60),
  ('ESE-AMAD',   950, 300),
  ('ESE-CITR',   180, 300),
  ('ESE-FLOR',     0, 250),
  ('MP-ALC96', 24000, 10000),
  ('MP-FIJA',    600, 200),
  ('MP-AGUA',  40000, 15000)
) as q(sku, quantity, min_quantity)
join public.products pr on pr.sku = q.sku
on conflict (store_id, product_id) do nothing;
