# Mythic App — Sistema de gestión para perfumería

Sistema integral (móvil nativo + web) para el control operativo, comercial y de
inventario de una tienda de perfumería.

- **Móvil nativo (iOS/Android):** Expo + React Native (staff: POS e inventario; cliente: catálogo y pedidos).
- **Web:** Next.js (dashboard administrativo + tienda online).
- **Lógica compartida:** TypeScript en `packages/core`.
- **Backend:** Supabase (Postgres, Auth, Storage, RLS).

## Estructura del monorepo

```
apps/
  mobile/     # Expo + expo-router
  web/        # Next.js (App Router)
packages/
  core/       # Cliente Supabase, tipos, hooks de datos, validaciones
  ui/         # Design system compartido
  config/     # tsconfig, prettier, eslint compartidos
supabase/     # Migraciones SQL, políticas RLS, seed
```

## Requisitos

- Node.js >= 20
- pnpm 11 (`npm install -g pnpm`)

## Puesta en marcha

```bash
pnpm install
cp .env.example .env   # y completa las claves de Supabase
pnpm dev               # levanta las apps con Turborepo
```

## Estado del proyecto

MVP en construcción: **Punto de Venta (POS) + Inventario**. Ver el plan completo y
las fases en `docs/` / el archivo de plan del proyecto.
