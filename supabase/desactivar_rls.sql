-- =====================================================================================
--  DESACTIVAR TODO EL RLS (Row Level Security) DEL ESQUEMA public
--
--  Que hace:
--   1) Elimina TODAS las politicas de seguridad de las tablas del esquema public.
--   2) Desactiva RLS en TODAS las tablas del esquema public.
--
--  Resultado: la base queda "abierta" para el rol authenticated (que es como esta
--  app espera trabajar en la mayoria de las tablas). Esto destraba el acceso de
--  administradores/staff al dashboard, que estaba siendo bloqueado por RLS al leer
--  la tabla "usuarios".
--
--  NOTA: NO toca las politicas de storage (buckets avatars / public_images), que
--  viven en el esquema storage y deben permanecer para que las imagenes funcionen.
--
--  COMO USAR: pega TODO en el SQL Editor de Supabase y presiona RUN.
--  Despues, cierra sesion y vuelve a iniciar sesion en la app.
-- =====================================================================================

-- (Opcional) Ver que tablas tienen RLS activo ANTES de desactivar:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = true ORDER BY tablename;

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1) Eliminar TODAS las politicas del esquema public
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;

  -- 2) Desactivar RLS en TODAS las tablas del esquema public
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- VERIFICACION: todas las tablas deben mostrar rowsecurity = false
--               y no debe quedar ninguna politica en el esquema public.
SELECT
  t.tablename,
  t.rowsecurity AS rls_activo,
  COUNT(p.policyname) AS politicas
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
