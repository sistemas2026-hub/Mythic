-- =============================================================================
-- Permisos a nivel de TABLA (GRANT) para los roles de Supabase.
--
-- Importante: los GRANT y el RLS son dos capas distintas y ambas son necesarias.
--   - GRANT  -> decide si el rol puede tocar la tabla.
--   - RLS    -> decide qué filas puede ver/modificar.
-- Sin estos GRANT, PostgREST devuelve 42501 "permission denied for table ...",
-- aunque las políticas RLS estén bien definidas.
-- Las políticas de 20260721000002_rls.sql siguen siendo las que restringen filas.
-- =============================================================================

grant usage on schema public to anon, authenticated;

-- Usuarios autenticados: acceso a las tablas; el RLS limita las filas.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Anónimos: solo lectura del catálogo (útil para la tienda online pública).
grant select on public.products, public.brands, public.categories, public.stores to anon;

-- Mismos permisos para las tablas/secuencias que se creen más adelante.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
