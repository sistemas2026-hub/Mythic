-- =============================================================================
-- Row Level Security (RLS) — acceso por rol
--   admin / vendedor  -> operan la tienda (staff)
--   cliente           -> solo catálogo y sus propios pedidos
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Helpers de rol (SECURITY DEFINER para poder leer profiles sin recursión RLS)
-- ----------------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'vendedor') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- Habilitar RLS en todas las tablas
-- ----------------------------------------------------------------------------
alter table public.stores               enable row level security;
alter table public.profiles             enable row level security;
alter table public.brands               enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.inventory            enable row level security;
alter table public.inventory_movements  enable row level security;
alter table public.customers            enable row level security;
alter table public.suppliers            enable row level security;
alter table public.sales                enable row level security;
alter table public.sale_items           enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;

-- ----------------------------------------------------------------------------
-- profiles: cada quien ve/edita el suyo; admin ve todos
-- ----------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Catálogo (stores, brands, categories, products):
--   lectura para cualquier usuario autenticado (incluye clientes)
--   escritura solo staff
-- ----------------------------------------------------------------------------
create policy stores_read on public.stores
  for select using (auth.role() = 'authenticated');
create policy stores_write on public.stores
  for all using (public.is_admin()) with check (public.is_admin());

create policy brands_read on public.brands
  for select using (auth.role() = 'authenticated');
create policy brands_write on public.brands
  for all using (public.is_staff()) with check (public.is_staff());

create policy categories_read on public.categories
  for select using (auth.role() = 'authenticated');
create policy categories_write on public.categories
  for all using (public.is_staff()) with check (public.is_staff());

create policy products_read on public.products
  for select using (auth.role() = 'authenticated');
create policy products_write on public.products
  for all using (public.is_staff()) with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- Inventario y movimientos: solo staff
-- ----------------------------------------------------------------------------
create policy inventory_staff on public.inventory
  for all using (public.is_staff()) with check (public.is_staff());
create policy inventory_movements_staff on public.inventory_movements
  for all using (public.is_staff()) with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- Clientes y proveedores: solo staff
-- ----------------------------------------------------------------------------
create policy customers_staff on public.customers
  for all using (public.is_staff()) with check (public.is_staff());
create policy suppliers_staff on public.suppliers
  for all using (public.is_staff()) with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- Ventas (POS): solo staff
-- ----------------------------------------------------------------------------
create policy sales_staff on public.sales
  for all using (public.is_staff()) with check (public.is_staff());
create policy sale_items_staff on public.sale_items
  for all using (public.is_staff()) with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- Pedidos online:
--   cliente crea y ve los suyos; staff ve/gestiona todos
-- ----------------------------------------------------------------------------
create policy orders_client_insert on public.orders
  for insert with check (created_by = auth.uid());
create policy orders_client_select on public.orders
  for select using (created_by = auth.uid() or public.is_staff());
create policy orders_staff_update on public.orders
  for update using (public.is_staff()) with check (public.is_staff());
create policy orders_staff_delete on public.orders
  for delete using (public.is_staff());

create policy order_items_client_insert on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.created_by = auth.uid()
    )
  );
create policy order_items_select on public.order_items
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.created_by = auth.uid()
    )
  );
create policy order_items_staff_write on public.order_items
  for update using (public.is_staff()) with check (public.is_staff());
