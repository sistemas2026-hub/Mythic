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

-- Tipos de perfume (se pueden agregar más desde la app)
insert into public.categories (name, slug) values
  ('Árabe', 'arabe'),
  ('Diseñador', 'disenador'),
  ('Nicho', 'nicho'),
  ('Réplica / Genérico', 'replica')
on conflict (slug) do nothing;

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
  ('Alcohol etílico 96%',        'materia-prima', 'MP-ALC96',   'l',      18000),
  ('Fijador cosmético',          'materia-prima', 'MP-FIJA',    'ml',        60),
  ('Agua destilada',             'materia-prima', 'MP-AGUA',    'l',       4200)
) as i(name, family_slug, sku, unit, cost)
on conflict (sku) do nothing;

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
  ('MP-ALC96',    24, 10),
  ('MP-FIJA',    600, 200),
  ('MP-AGUA',     40, 15)
) as q(sku, quantity, min_quantity)
join public.products pr on pr.sku = q.sku
on conflict (store_id, product_id) do nothing;
