-- =============================================================================
-- register_order: crea un pedido de forma atómica.
--
-- Se comporta como register_sale en cuanto al inventario (valida existencias,
-- descuenta y deja kardex), pero el resultado es un PEDIDO en estado
-- 'pendiente', no una venta cobrada. El stock se reserva al crearlo.
--
-- p_items: jsonb array -> [{ "product_id": "uuid", "quantity": 2 }, ...]
-- =============================================================================
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
  v_stock       integer;
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

    select quantity into v_stock
    from public.inventory
    where store_id = p_store_id and product_id = v_product_id
    for update;

    if v_stock is null then
      raise exception 'Sin registro de inventario para el producto % en la sucursal', v_product_id;
    end if;
    if v_stock < v_qty then
      raise exception 'Stock insuficiente para el producto % (disponible %, solicitado %)',
        v_product_id, v_stock, v_qty;
    end if;

    insert into public.order_items (order_id, product_id, quantity, unit_price, line_total)
    values (v_order_id, v_product_id, v_qty, v_price, v_price * v_qty);

    update public.inventory
    set quantity = quantity - v_qty
    where store_id = p_store_id and product_id = v_product_id;

    insert into public.inventory_movements
      (store_id, product_id, type, quantity, reason, reference_id, created_by)
    values
      (p_store_id, v_product_id, 'salida', v_qty, 'Pedido', v_order_id, auth.uid());

    v_subtotal := v_subtotal + (v_price * v_qty);
  end loop;

  update public.orders
  set subtotal = v_subtotal,
      total = v_subtotal
  where id = v_order_id;

  return v_order_id;
end;
$$;

grant execute on function public.register_order(uuid, uuid, text, jsonb) to authenticated;
