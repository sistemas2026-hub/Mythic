-- =============================================================================
-- register_sale: registra una venta de mostrador de forma atómica
--   - valida que el usuario sea staff
--   - toma el precio actual de cada producto (integridad)
--   - valida stock disponible en la sucursal
--   - inserta venta + items, descuenta inventario y registra el kardex
-- Devuelve el id de la venta creada.
--
-- p_items: jsonb array -> [{ "product_id": "uuid", "quantity": 2 }, ...]
-- =============================================================================
create or replace function public.register_sale(
  p_store_id       uuid,
  p_payment_method text default 'efectivo',
  p_discount       numeric default 0,
  p_customer_id    uuid default null,
  p_items          jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_sale_id     uuid;
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
    raise exception 'La venta no tiene artículos';
  end if;

  -- Crea la venta (totales se completan al final)
  insert into public.sales (store_id, customer_id, sold_by, payment_method, discount)
  values (p_store_id, p_customer_id, auth.uid(), p_payment_method, coalesce(p_discount, 0))
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::integer;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Cantidad inválida para el producto %', v_product_id;
    end if;

    -- Precio actual del producto
    select price into v_price from public.products where id = v_product_id;
    if v_price is null then
      raise exception 'Producto no encontrado: %', v_product_id;
    end if;

    -- Bloquea la fila de inventario y valida stock
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

    -- Item de venta
    insert into public.sale_items (sale_id, product_id, quantity, unit_price, line_total)
    values (v_sale_id, v_product_id, v_qty, v_price, v_price * v_qty);

    -- Descuenta inventario
    update public.inventory
    set quantity = quantity - v_qty
    where store_id = p_store_id and product_id = v_product_id;

    -- Kardex
    insert into public.inventory_movements
      (store_id, product_id, type, quantity, reason, reference_id, created_by)
    values
      (p_store_id, v_product_id, 'venta', v_qty, 'Venta POS', v_sale_id, auth.uid());

    v_subtotal := v_subtotal + (v_price * v_qty);
  end loop;

  -- Completa totales
  update public.sales
  set subtotal = v_subtotal,
      total = greatest(v_subtotal - coalesce(p_discount, 0), 0)
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

grant execute on function public.register_sale(uuid, text, numeric, uuid, jsonb) to authenticated;
