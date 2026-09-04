-- =====================================================================================
--  ACTIVAR RLS SELECTIVO EN LAS TABLAS IMPORTANTES  (BillarMalandro2)
--
--  Reactiva Row Level Security SOLO donde importa, con politicas pensadas para NO
--  romper la app. Modelo de acceso:
--    * STAFF (fila en "usuarios" con auth_id enlazado) -> gestiona todo.
--    * CLIENTE (fila en "clientes" con auth_id) -> ve/crea solo LO SUYO.
--    * PUBLICO (anonimo) -> solo lee el catalogo y el estado de mesas.
--
--  IMPORTANTE: se dejan A PROPOSITO SIN RLS las tablas de acceso/config
--  (usuarios, roles, permisos, rol_permisos, usuario_sucursal, permiso_override,
--   configuracion, notificaciones) para NO volver a bloquear el login/dashboard.
--
--  Requisito: ejecutar DESPUES de desactivar_rls.sql (o sobre una base sin
--  politicas viejas). Es idempotente: se puede re-ejecutar sin error.
--
--  COMO USAR: pega TODO en el SQL Editor de Supabase y presiona RUN.
-- =====================================================================================

-- =====================================================================================
-- 0. FUNCIONES AUXILIARES (SECURITY DEFINER => omiten RLS y evitan recursion)
-- =====================================================================================

-- ¿El usuario logueado es un empleado/staff activo?
CREATE OR REPLACE FUNCTION public.es_empleado()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE auth_id = auth.uid() AND activo = true
  );
$$;

-- id_cliente del usuario logueado (para que un cliente vea solo lo suyo)
CREATE OR REPLACE FUNCTION public.mi_id_cliente()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id_cliente FROM public.clientes
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

-- =====================================================================================
-- 1. CATALOGO PUBLICO  (lo lee cualquiera; solo el staff escribe)
--    productos, categorias, novedades, sucursales, mesas, tarifas, campeonatos,
--    torneos, sesiones_mesa
-- =====================================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'productos','categorias','novedades','sucursales','mesas','tarifas',
    'campeonatos','torneos','sesiones_mesa'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_lectura_publica', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true);', t||'_lectura_publica', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_escritura_staff', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (public.es_empleado()) WITH CHECK (public.es_empleado());', t||'_escritura_staff', t);
  END LOOP;
END $$;

-- =====================================================================================
-- 2. SOLO STAFF  (back-office; el publico/cliente nunca las toca)
--    ventas, venta_items, arqueos, movimientos_caja, cajas, inventario,
--    movimientos_inventario, asistencias, inscripciones
-- =====================================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ventas','venta_items','arqueos','movimientos_caja','cajas',
    'inventario','movimientos_inventario','asistencias','inscripciones'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_solo_staff', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (public.es_empleado()) WITH CHECK (public.es_empleado());', t||'_solo_staff', t);
  END LOOP;
END $$;

-- =====================================================================================
-- 3. CLIENTES  (cada quien ve/edita su perfil; el staff gestiona todos)
-- =====================================================================================
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_sel ON public.clientes;
CREATE POLICY clientes_sel ON public.clientes
  FOR SELECT USING (auth.uid() = auth_id OR public.es_empleado());

DROP POLICY IF EXISTS clientes_ins ON public.clientes;
CREATE POLICY clientes_ins ON public.clientes
  FOR INSERT WITH CHECK (public.es_empleado());
--  (El auto-registro de clientes NO pasa por aqui: lo hace el trigger
--   handle_new_user y la API register-client, ambos con privilegios elevados.)

DROP POLICY IF EXISTS clientes_upd ON public.clientes;
CREATE POLICY clientes_upd ON public.clientes
  FOR UPDATE USING (auth.uid() = auth_id OR public.es_empleado())
             WITH CHECK (auth.uid() = auth_id OR public.es_empleado());

DROP POLICY IF EXISTS clientes_del ON public.clientes;
CREATE POLICY clientes_del ON public.clientes
  FOR DELETE USING (public.es_empleado());

-- =====================================================================================
-- 4. PEDIDOS  (el cliente crea/ve los suyos; el staff gestiona todos)
-- =====================================================================================
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_sel ON public.pedidos;
CREATE POLICY pedidos_sel ON public.pedidos
  FOR SELECT USING (id_cliente = public.mi_id_cliente() OR public.es_empleado());

DROP POLICY IF EXISTS pedidos_ins ON public.pedidos;
CREATE POLICY pedidos_ins ON public.pedidos
  FOR INSERT WITH CHECK (id_cliente = public.mi_id_cliente() OR public.es_empleado());

DROP POLICY IF EXISTS pedidos_upd ON public.pedidos;
CREATE POLICY pedidos_upd ON public.pedidos
  FOR UPDATE USING (public.es_empleado()) WITH CHECK (public.es_empleado());

DROP POLICY IF EXISTS pedidos_del ON public.pedidos;
CREATE POLICY pedidos_del ON public.pedidos
  FOR DELETE USING (public.es_empleado());

-- Items del pedido: visibles/creables por el dueño del pedido o el staff
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedido_items_sel ON public.pedido_items;
CREATE POLICY pedido_items_sel ON public.pedido_items
  FOR SELECT USING (
    public.es_empleado() OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id_pedido = pedido_items.id_pedido
        AND p.id_cliente = public.mi_id_cliente()
    )
  );

DROP POLICY IF EXISTS pedido_items_ins ON public.pedido_items;
CREATE POLICY pedido_items_ins ON public.pedido_items
  FOR INSERT WITH CHECK (
    public.es_empleado() OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id_pedido = pedido_items.id_pedido
        AND p.id_cliente = public.mi_id_cliente()
    )
  );

DROP POLICY IF EXISTS pedido_items_upd ON public.pedido_items;
CREATE POLICY pedido_items_upd ON public.pedido_items
  FOR UPDATE USING (public.es_empleado()) WITH CHECK (public.es_empleado());

DROP POLICY IF EXISTS pedido_items_del ON public.pedido_items;
CREATE POLICY pedido_items_del ON public.pedido_items
  FOR DELETE USING (public.es_empleado());

-- =====================================================================================
-- 5. PARTICIPANTES DE TORNEO  (el cliente se inscribe/ve lo suyo; staff gestiona)
-- =====================================================================================
ALTER TABLE public.participantes_torneo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parttorneo_sel ON public.participantes_torneo;
CREATE POLICY parttorneo_sel ON public.participantes_torneo
  FOR SELECT USING (id_cliente = public.mi_id_cliente() OR public.es_empleado());

DROP POLICY IF EXISTS parttorneo_ins ON public.participantes_torneo;
CREATE POLICY parttorneo_ins ON public.participantes_torneo
  FOR INSERT WITH CHECK (id_cliente = public.mi_id_cliente() OR public.es_empleado());

DROP POLICY IF EXISTS parttorneo_upd ON public.participantes_torneo;
CREATE POLICY parttorneo_upd ON public.participantes_torneo
  FOR UPDATE USING (public.es_empleado()) WITH CHECK (public.es_empleado());

DROP POLICY IF EXISTS parttorneo_del ON public.participantes_torneo;
CREATE POLICY parttorneo_del ON public.participantes_torneo
  FOR DELETE USING (id_cliente = public.mi_id_cliente() OR public.es_empleado());

-- =====================================================================================
-- 6. VERIFICACION
--    - Las tablas protegidas deben mostrar rls_activo = true con >=1 politica.
--    - usuarios / roles / etc. deben seguir en false (por diseno).
-- =====================================================================================
SELECT
  t.tablename,
  t.rowsecurity AS rls_activo,
  COUNT(p.policyname) AS politicas
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.rowsecurity DESC, t.tablename;
