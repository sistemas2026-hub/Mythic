-- =============================================================================
-- Datos de ejemplo — Mythic Perfumería
-- Catálogo, sucursal e inventario inicial. (No crea usuarios de auth: ver README.)
-- =============================================================================

-- Sucursal principal
insert into public.stores (id, name, code, address, phone)
values ('11111111-1111-1111-1111-111111111111', 'Sucursal Centro', 'centro', 'Calle 10 # 5-40', '3000000000')
on conflict (code) do nothing;

-- Marcas
insert into public.brands (name) values
  ('Dior'), ('Chanel'), ('Carolina Herrera'), ('Paco Rabanne'),
  ('Yves Saint Laurent'), ('Versace'), ('Giorgio Armani'), ('Lancôme')
on conflict (name) do nothing;

-- Categorías (taxonomía de tienda)
insert into public.categories (name, slug) values
  ('Perfume Hombre', 'hombre'),
  ('Perfume Mujer', 'mujer'),
  ('Unisex', 'unisex')
on conflict (slug) do nothing;

-- Productos (perfumes)
insert into public.products (name, brand_id, category_id, gender, concentration, volume_ml, barcode, sku, price, cost)
select p.name, b.id, c.id, p.gender, p.concentration, p.volume_ml, p.barcode, p.sku, p.price, p.cost
from (values
  ('Sauvage EDP 100ml',        'Dior',               'hombre', 'hombre', 'EDP', 100, '7501234000017', 'DIO-SAU-100', 459900, 300000),
  ('Bleu de Chanel EDP 100ml', 'Chanel',             'hombre', 'hombre', 'EDP', 100, '3145891074604', 'CHA-BLE-100', 519000, 340000),
  ('Good Girl EDP 80ml',       'Carolina Herrera',   'mujer',  'mujer',  'EDP',  80, '8411061000021', 'CH-GG-080',   389000, 250000),
  ('1 Million EDT 100ml',      'Paco Rabanne',       'hombre', 'hombre', 'EDT', 100, '3349668000038', 'PR-1M-100',   329900, 210000),
  ('Libre EDP 90ml',           'Yves Saint Laurent', 'mujer',  'mujer',  'EDP',  90, '3614272648333', 'YSL-LIB-090', 429000, 280000),
  ('Eros EDT 100ml',           'Versace',            'hombre', 'hombre', 'EDT', 100, '8011003809219', 'VER-ERO-100', 319900, 200000),
  ('Acqua di Giò EDP 100ml',   'Giorgio Armani',     'hombre', 'hombre', 'EDP', 100, '3614273255486', 'GA-ADG-100',  469000, 300000),
  ('La Vie Est Belle EDP 75ml','Lancôme',            'mujer',  'mujer',  'EDP',  75, '3605532612782', 'LAN-LVB-075', 415000, 270000)
) as p(name, brand, category_slug, gender, concentration, volume_ml, barcode, sku, price, cost)
join public.brands b on b.name = p.brand
join public.categories c on c.slug = p.category_slug
on conflict (sku) do nothing;

-- Inventario inicial en la sucursal Centro (cantidades del mockup)
insert into public.inventory (store_id, product_id, quantity, min_quantity)
select '11111111-1111-1111-1111-111111111111', pr.id, q.quantity, q.min_quantity
from (values
  ('DIO-SAU-100', 31, 5),
  ('CHA-BLE-100', 18, 5),
  ('CH-GG-080',    6, 8),
  ('PR-1M-100',   22, 5),
  ('YSL-LIB-090', 12, 5),
  ('VER-ERO-100', 24, 5),
  ('GA-ADG-100',   4, 6),
  ('LAN-LVB-075',  0, 4)
) as q(sku, quantity, min_quantity)
join public.products pr on pr.sku = q.sku
on conflict (store_id, product_id) do nothing;
