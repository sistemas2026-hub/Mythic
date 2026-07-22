-- =============================================================================
-- Fórmula del producto terminado.
--
-- Un perfume se arma con insumos: esencia, alcohol y adicionales (feromona,
-- fijador...). `product_components` guarda cuánto lleva UNA unidad, y
-- register_production descuenta ese consumo al fabricar un lote.
-- =============================================================================

create table public.product_components (
  id            uuid primary key default gen_random_uuid(),
  -- Producto terminado (el perfume).
  product_id    uuid not null references public.products (id) on delete cascade,
  -- Insumo que lo compone (esencia, alcohol, fijador…).
  component_id  uuid not null references public.products (id) on delete restrict,
  -- Cantidad por UNA unidad del producto, en la unidad del insumo.
  quantity      numeric(12, 2) not null check (quantity > 0),
  created_at    timestamptz not null default now(),
  unique (product_id, component_id),
  -- Un producto no puede ser componente de sí mismo.
  check (product_id <> component_id)
);

create index product_components_product_idx on public.product_components (product_id);

alter table public.product_components enable row level security;

create policy product_components_read on public.product_components
  for select using (auth.role() = 'authenticated');
create policy product_components_write on public.product_components
  for all using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.product_components to authenticated;

-- ----------------------------------------------------------------------------
-- register_production: fabrica p_units del producto consumiendo su fórmula.
--
-- Valida existencias de cada insumo, las descuenta, suma el producto terminado
-- y deja kardex de ambos lados. Todo en una transacción.
--
-- Nota: inventory.quantity es entero, así que el consumo se redondea hacia
-- arriba (ceil) para no descontar de menos cuando la fórmula lleva decimales.
-- ----------------------------------------------------------------------------
create or replace function public.register_production(
  p_store_id   uuid,
  p_product_id uuid,
  p_units      integer
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_comp      record;
  v_required  integer;
  v_stock     integer;
  v_name      text;
begin
  if not public.is_staff() then
    raise exception 'No autorizado: se requiere rol de staff';
  end if;
  if p_units is null or p_units <= 0 then
    raise exception 'La cantidad a producir debe ser mayor a cero';
  end if;

  for v_comp in
    select component_id, quantity from public.product_components where product_id = p_product_id
  loop
    v_required := ceil(v_comp.quantity * p_units)::integer;

    select quantity into v_stock
    from public.inventory
    where store_id = p_store_id and product_id = v_comp.component_id
    for update;

    select name into v_name from public.products where id = v_comp.component_id;

    if v_stock is null then
      raise exception 'El insumo "%" no tiene inventario en esta sucursal', v_name;
    end if;
    if v_stock < v_required then
      raise exception 'Insumo insuficiente: "%" (disponible %, se necesitan %)',
        v_name, v_stock, v_required;
    end if;

    update public.inventory
    set quantity = quantity - v_required
    where store_id = p_store_id and product_id = v_comp.component_id;

    insert into public.inventory_movements
      (store_id, product_id, type, quantity, reason, reference_id, created_by)
    values
      (p_store_id, v_comp.component_id, 'salida', v_required, 'Producción', p_product_id, auth.uid());
  end loop;

  -- Suma el producto terminado
  insert into public.inventory (store_id, product_id, quantity, min_quantity)
  values (p_store_id, p_product_id, p_units, 0)
  on conflict (store_id, product_id)
  do update set quantity = public.inventory.quantity + excluded.quantity;

  insert into public.inventory_movements
    (store_id, product_id, type, quantity, reason, created_by)
  values
    (p_store_id, p_product_id, 'entrada', p_units, 'Producción', auth.uid());
end;
$$;

grant execute on function public.register_production(uuid, uuid, integer) to authenticated;
