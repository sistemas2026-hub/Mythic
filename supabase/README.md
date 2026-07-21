# Backend Supabase — Mythic Perfumería

Esquema, políticas de seguridad (RLS), función de venta y datos de ejemplo.

## Contenido

- `migrations/20260721000001_schema.sql` — tablas (multi-sucursal), índices y triggers.
- `migrations/20260721000002_rls.sql` — Row Level Security y helpers de rol.
- `migrations/20260721000003_register_sale.sql` — función atómica de venta (POS).
- `seed.sql` — sucursal, catálogo de perfumes e inventario inicial.
- `config.toml` — configuración local del stack de Supabase.

## Modelo de datos (resumen)

`stores` · `profiles` (roles: admin/vendedor/cliente) · `brands` · `categories` ·
`products` · `inventory` (stock por sucursal) · `inventory_movements` (kardex) ·
`customers` · `suppliers` · `sales` + `sale_items` (POS) · `orders` + `order_items` (tienda online).

## Cómo aplicarlo

### Opción A — Local (requiere Docker Desktop corriendo)

```bash
pnpm db:start     # levanta Postgres, Auth, Storage, Studio (descarga imágenes la 1ª vez)
pnpm db:reset     # aplica migraciones + seed.sql desde cero
pnpm db:types     # genera packages/core/src/database.types.ts
```

Studio local: http://localhost:54323

### Opción B — Proyecto en la nube de Supabase

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref TU_PROJECT_REF
pnpm db:push                                   # aplica las migraciones
pnpm exec supabase db execute --file supabase/seed.sql   # carga el seed (opcional)
```

Copia la URL y las claves del proyecto a `.env` (ver `.env.example`).

## Crear el primer administrador

El registro por Auth crea el usuario con rol `cliente` por defecto (trigger
`handle_new_user`). Para promover a un usuario a administrador y asignarle sucursal,
tras registrarlo ejecuta en el SQL editor:

```sql
update public.profiles
set role = 'admin',
    store_id = '11111111-1111-1111-1111-111111111111'  -- Sucursal Centro (del seed)
where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
```

## Registrar una venta (desde la app o SQL)

```sql
select public.register_sale(
  p_store_id       => '11111111-1111-1111-1111-111111111111',
  p_payment_method => 'efectivo',
  p_discount       => 0,
  p_customer_id    => null,
  p_items          => '[{"product_id":"<UUID>","quantity":2}]'::jsonb
);
```

La función valida stock, descuenta inventario, registra el kardex y calcula el total,
todo en una sola transacción.
