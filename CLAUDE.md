# CLAUDE.md — Mythic App

Contexto para agentes que trabajen en este repositorio.

## Qué es

Sistema de gestión para una tienda de perfumería: **app móvil nativa** (iOS/Android) +
**web** (dashboard admin + tienda online), con lógica de negocio compartida en TypeScript
y backend en **Supabase**.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo.
- **Móvil:** Expo (React Native) + expo-router. NO es PWA — es nativo (dev client / EAS Build).
- **Web:** Next.js (App Router).
- **Compartido:** `packages/core` (cliente Supabase, tipos generados de la BD, hooks de datos
  con TanStack Query, validaciones Zod) y `packages/ui` (design system).
- **Backend:** Supabase (Postgres relacional, Auth, Storage, Row Level Security).

## Decisiones de producto

- Alcance: gestión interna (POS, inventario, ventas, clientes, proveedores) + tienda online.
- Modelo de datos **preparado para multi-sucursal** (`store_id`), aunque se arranca con una sola tienda.
- Tienda online: por ahora solo **pedidos/reservas** (sin pasarela de pago). Diseñar dejando el punto de extensión para pagos.
- **MVP actual:** Punto de Venta (POS) + Inventario en la app móvil.

## Convenciones

- TypeScript estricto (ver `packages/config/tsconfig/base.json`).
- Prettier compartido (`@mythic/config/prettier`): comillas simples, `trailingComma: all`, ancho 100.
- Idioma de la UI y contenidos: **español**.

## Diseño (skills)

- Estética: usar la skill **`minimalist-ui`** (minimalismo premium/editorial: monocromo cálido,
  contraste tipográfico, bento grids, sin gradientes ni sombras pesadas, sin emojis) junto a `impeccable`.

## Comandos

- `pnpm install` — instalar dependencias.
- `pnpm dev` — levantar apps (Turborepo).
- `pnpm lint` / `pnpm typecheck` / `pnpm format:check` — calidad (lo que corre en CI).
