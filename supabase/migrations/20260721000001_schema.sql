-- =============================================================================
-- Mythic Perfumería — Esquema base (multi-sucursal desde el diseño)
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- Utilidad: trigger para mantener updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Sucursales
-- ----------------------------------------------------------------------------
create table public.stores (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  address     text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Perfiles de usuario (extiende auth.users) + roles
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        text not null default 'cliente'
                check (role in ('admin', 'vendedor', 'cliente')),
  store_id    uuid references public.stores (id) on delete set null,
  phone       text,
  created_at  timestamptz not null default now()
);

-- Crea automáticamente un profile al registrarse un usuario en auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'cliente')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Catálogo: marcas, categorías, productos (perfumes)
-- ----------------------------------------------------------------------------
create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  brand_id       uuid references public.brands (id) on delete set null,
  category_id    uuid references public.categories (id) on delete set null,
  description    text,
  gender         text check (gender in ('hombre', 'mujer', 'unisex')),
  concentration  text check (concentration in ('Parfum', 'EDP', 'EDT', 'EDC', 'Otro')),
  volume_ml      integer check (volume_ml is null or volume_ml > 0),
  barcode        text unique,
  sku            text unique,
  price          numeric(12, 2) not null default 0 check (price >= 0),
  cost           numeric(12, 2) check (cost is null or cost >= 0),
  image_url      text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index products_brand_idx on public.products (brand_id);
create index products_category_idx on public.products (category_id);
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- Inventario por sucursal + movimientos (kardex)
-- ----------------------------------------------------------------------------
create table public.inventory (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  quantity      integer not null default 0,
  min_quantity  integer not null default 0 check (min_quantity >= 0),
  updated_at    timestamptz not null default now(),
  unique (store_id, product_id)
);

create trigger inventory_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

create table public.inventory_movements (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  type          text not null
                  check (type in ('entrada', 'salida', 'ajuste',
                                  'traspaso_entrada', 'traspaso_salida', 'venta')),
  quantity      integer not null,
  reason        text,
  reference_id  uuid,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index inv_mov_store_product_idx on public.inventory_movements (store_id, product_id);

-- ----------------------------------------------------------------------------
-- Clientes y proveedores
-- ----------------------------------------------------------------------------
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text,
  phone       text,
  profile_id  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  phone         text,
  email         text,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Ventas de mostrador (POS)
-- ----------------------------------------------------------------------------
create table public.sales (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores (id),
  customer_id     uuid references public.customers (id) on delete set null,
  sold_by         uuid references auth.users (id) on delete set null,
  subtotal        numeric(12, 2) not null default 0,
  discount        numeric(12, 2) not null default 0 check (discount >= 0),
  total           numeric(12, 2) not null default 0,
  payment_method  text not null default 'efectivo'
                    check (payment_method in ('efectivo', 'tarjeta', 'transferencia', 'otro')),
  status          text not null default 'completada'
                    check (status in ('completada', 'anulada')),
  created_at      timestamptz not null default now()
);

create index sales_store_idx on public.sales (store_id, created_at desc);

create table public.sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales (id) on delete cascade,
  product_id  uuid not null references public.products (id),
  quantity    integer not null check (quantity > 0),
  unit_price  numeric(12, 2) not null,
  line_total  numeric(12, 2) not null
);

create index sale_items_sale_idx on public.sale_items (sale_id);

-- ----------------------------------------------------------------------------
-- Pedidos de la tienda online (sin pasarela de pago por ahora)
-- ----------------------------------------------------------------------------
create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id),
  customer_id  uuid references public.customers (id) on delete set null,
  created_by   uuid references auth.users (id) on delete set null,
  status       text not null default 'pendiente'
                 check (status in ('pendiente', 'confirmado', 'listo', 'entregado', 'cancelado')),
  subtotal     numeric(12, 2) not null default 0,
  total        numeric(12, 2) not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index orders_created_by_idx on public.orders (created_by);
create index orders_status_idx on public.orders (status, created_at desc);

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  product_id  uuid not null references public.products (id),
  quantity    integer not null check (quantity > 0),
  unit_price  numeric(12, 2) not null,
  line_total  numeric(12, 2) not null
);

create index order_items_order_idx on public.order_items (order_id);
