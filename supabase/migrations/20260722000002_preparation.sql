-- =============================================================================
-- Preparación bajo pedido.
--
-- Cambia el momento en que se gasta el inventario:
--   ANTES  el pedido exigía stock del perfume terminado y lo descontaba.
--   AHORA  el pedido solo se registra. Al FINALIZAR LA PREPARACIÓN se toma de
--          las unidades ya preparadas (si las hay) y el resto se fabrica,
--          consumiendo la fórmula.
--
-- Así nunca se gasta esencia dos veces por el mismo frasco.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- register_order sin descuento: preparar bajo pedido significa que se puede
-- pedir un perfume aunque no haya unidades hechas todavía.
-- ----------------------------------------------------------------------------
create or replace function public.register_order(
  p_store_id     uuid,
  p_customer_id  uuid default null,
  p_notes        text default null,
  p_items        jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_order_id    uuid;
  v_item        jsonb;
  v_product_id  uuid;
  v_qty         integer;
  v_price       numeric(12, 2);
  v_subtotal    numeric(12, 2) := 0;
begin
  if not public.is_staff() then
    raise exception 'No autorizado: se requiere rol de staff';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene artículos';
  end if;

  insert into public.orders (store_id, customer_id, created_by, status, notes)
  values (p_store_id, p_customer_id, auth.uid(), 'pendiente', p_notes)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::integer;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Cantidad inválida para el producto %', v_product_id;
    end if;

    select price into v_price from public.products where id = v_product_id;
    if v_price is null then
      raise exception 'Producto no encontrado: %', v_product_id;
    end if;

    insert into public.order_items (order_id, product_id, quantity, unit_price, line_total)
    values (v_order_id, v_product_id, v_qty, v_price, v_price * v_qty);

    v_subtotal := v_subtotal + (v_price * v_qty);
  end loop;

  update public.orders
  set subtotal = v_subtotal, total = v_subtotal
  where id = v_order_id;

  return v_order_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- finish_preparation: cierra la preparación de un pedido.
--
-- Por cada renglón: toma primero de las unidades ya preparadas y fabrica solo
-- el faltante, consumiendo la fórmula del perfume. Valida TODO antes de
-- descontar: si falta un insumo, el pedido queda intacto.
-- ----------------------------------------------------------------------------
create or replace function public.finish_preparation(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_store_id    uuid;
  v_status      text;
  v_line        record;
  v_on_hand     integer;
  v_from_stock  integer;
  v_to_make     integer;
  v_comp        record;
  v_required    integer;
  v_available   integer;
  v_name        text;
begin
  if not public.is_staff() then
    raise exception 'No autorizado: se requiere rol de staff';
  end if;

  select store_id, status into v_store_id, v_status
  from public.orders where id = p_order_id for update;

  if v_store_id is null then
    raise exception 'Pedido no encontrado';
  end if;
  if v_status not in ('pendiente', 'confirmado') then
    raise exception 'El pedido ya no está en preparación (estado: %)', v_status;
  end if;

  for v_line in
    select oi.product_id, oi.quantity, p.name
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
  loop
    select coalesce(quantity, 0) into v_on_hand
    from public.inventory
    where store_id = v_store_id and product_id = v_line.product_id
    for update;

    v_from_stock := least(coalesce(v_on_hand, 0), v_line.quantity);
    v_to_make := v_line.quantity - v_from_stock;

    -- Entrega desde lo ya preparado
    if v_from_stock > 0 then
      update public.inventory
      set quantity = quantity - v_from_stock
      where store_id = v_store_id and product_id = v_line.product_id;

      insert into public.inventory_movements
        (store_id, product_id, type, quantity, reason, reference_id, created_by)
      values
        (v_store_id, v_line.product_id, 'salida', v_from_stock,
         'Pedido (ya preparado)', p_order_id, auth.uid());
    end if;

    -- Fabrica el faltante consumiendo la fórmula
    if v_to_make > 0 then
      if not exists (select 1 from public.product_components where product_id = v_line.product_id) then
        raise exception 'El perfume "%" no tiene fórmula y no hay unidades preparadas', v_line.name;
      end if;

      for v_comp in
        select component_id, quantity from public.product_components
        where product_id = v_line.product_id
      loop
        v_required := ceil(v_comp.quantity * v_to_make)::integer;

        select quantity into v_available
        from public.inventory
        where store_id = v_store_id and product_id = v_comp.component_id
        for update;

        select name into v_name from public.products where id = v_comp.component_id;

        if v_available is null then
          raise exception 'El insumo "%" no tiene inventario en esta sucursal', v_name;
        end if;
        if v_available < v_required then
          raise exception 'Insumo insuficiente para "%": % (disponible %, se necesitan %)',
            v_line.name, v_name, v_available, v_required;
        end if;

        update public.inventory
        set quantity = quantity - v_required
        where store_id = v_store_id and product_id = v_comp.component_id;

        insert into public.inventory_movements
          (store_id, product_id, type, quantity, reason, reference_id, created_by)
        values
          (v_store_id, v_comp.component_id, 'salida', v_required,
           'Preparación', p_order_id, auth.uid());
      end loop;
    end if;
  end loop;

  update public.orders set status = 'listo' where id = p_order_id;
end;
$$;

grant execute on function public.finish_preparation(uuid) to authenticated;
