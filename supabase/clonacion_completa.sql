-- =====================================================================================
--  BILLAR MALANDRO 2  ·  SCRIPT DE CLONACIÓN COMPLETA DE BASE DE DATOS
--  Stack: Next.js + PostgreSQL (Supabase) + Vercel
--
--  CÓMO USAR:
--    1. Crea un proyecto NUEVO en Supabase.
--    2. Abre  SQL Editor  ->  New query.
--    3. Pega TODO este archivo y presiona RUN.
--    4. Copia la URL y las API keys del proyecto a tu .env.local / Vercel.
--
--  Es re-ejecutable: limpia estructuras previas antes de crearlas.
--  Reconstruye TABLAS + ENUMS + ÍNDICES + FUNCIONES + TRIGGERS + RLS + STORAGE + DATOS.
-- =====================================================================================

-- =====================================================================================
-- 0. LIMPIEZA (para poder re-ejecutar sin errores)
-- =====================================================================================
DROP TABLE IF EXISTS participantes_torneo    CASCADE;
DROP TABLE IF EXISTS torneos                 CASCADE;
DROP TABLE IF EXISTS inscripciones           CASCADE;
DROP TABLE IF EXISTS campeonatos             CASCADE;
DROP TABLE IF EXISTS novedades               CASCADE;
DROP TABLE IF EXISTS pedido_items            CASCADE;
DROP TABLE IF EXISTS pedidos                 CASCADE;
DROP TABLE IF EXISTS venta_items             CASCADE;
DROP TABLE IF EXISTS ventas                  CASCADE;
DROP TABLE IF EXISTS sesiones_mesa           CASCADE;
DROP TABLE IF EXISTS asistencias             CASCADE;
DROP TABLE IF EXISTS movimientos_caja        CASCADE;
DROP TABLE IF EXISTS arqueos                 CASCADE;
DROP TABLE IF EXISTS cajas                   CASCADE;
DROP TABLE IF EXISTS configuracion           CASCADE;
DROP TABLE IF EXISTS notificaciones          CASCADE;
DROP TABLE IF EXISTS permiso_override         CASCADE;
DROP TABLE IF EXISTS usuario_sucursal        CASCADE;
DROP TABLE IF EXISTS clientes                CASCADE;
DROP TABLE IF EXISTS usuarios                CASCADE;
DROP TABLE IF EXISTS rol_permisos            CASCADE;
DROP TABLE IF EXISTS permisos                CASCADE;
DROP TABLE IF EXISTS roles                   CASCADE;
DROP TABLE IF EXISTS tarifas                 CASCADE;
DROP TABLE IF EXISTS mesas                   CASCADE;
DROP TABLE IF EXISTS movimientos_inventario  CASCADE;
DROP TABLE IF EXISTS inventario              CASCADE;
DROP TABLE IF EXISTS productos               CASCADE;
DROP TABLE IF EXISTS categorias              CASCADE;
DROP TABLE IF EXISTS sucursales              CASCADE;

DROP TYPE IF EXISTS tipo_mesa         CASCADE;
DROP TYPE IF EXISTS tipo_dia_tarifa   CASCADE;
DROP TYPE IF EXISTS estado_sesion     CASCADE;
DROP TYPE IF EXISTS estado_venta      CASCADE;
DROP TYPE IF EXISTS metodo_pago       CASCADE;
DROP TYPE IF EXISTS estado_pedido     CASCADE;
DROP TYPE IF EXISTS tipo_pedido       CASCADE;
DROP TYPE IF EXISTS tipo_novedad      CASCADE;
DROP TYPE IF EXISTS estado_campeonato CASCADE;
DROP TYPE IF EXISTS modalidad_camp    CASCADE;
DROP TYPE IF EXISTS estado_pago_insc  CASCADE;
DROP TYPE IF EXISTS tipo_movimiento   CASCADE;

-- =====================================================================================
-- 1. EXTENSIONES
-- =====================================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================================
-- 2. TIPOS ENUM  (superconjunto de todos los valores usados por la app)
-- =====================================================================================
CREATE TYPE tipo_mesa         AS ENUM ('pool', 'snooker', 'americana', 'carambola', 'cacho');
CREATE TYPE tipo_dia_tarifa   AS ENUM ('todos', 'semana', 'finde', 'feriado', 'lunes_viernes', 'fin_semana');
CREATE TYPE estado_sesion     AS ENUM ('abierta', 'cerrada', 'pausada', 'cancelada');
CREATE TYPE estado_venta      AS ENUM ('completada', 'anulada', 'pendiente');
CREATE TYPE metodo_pago       AS ENUM ('efectivo', 'tarjeta', 'qr', 'fiado', 'mixto', 'transferencia');
CREATE TYPE estado_pedido     AS ENUM ('pendiente', 'confirmado', 'preparacion', 'listo', 'enviado', 'entregado', 'cancelado');
CREATE TYPE tipo_pedido       AS ENUM ('online', 'presencial', 'local');
CREATE TYPE tipo_novedad      AS ENUM ('noticia', 'oferta', 'evento', 'campeonato');
CREATE TYPE estado_campeonato AS ENUM ('proximo', 'en_curso', 'finalizado', 'cancelado');
CREATE TYPE modalidad_camp    AS ENUM ('eliminacion_simple', 'doble_eliminacion', 'round_robin', 'grupos', 'liguilla');
CREATE TYPE estado_pago_insc  AS ENUM ('pendiente', 'pagado', 'devuelto');
CREATE TYPE tipo_movimiento   AS ENUM ('entrada', 'salida', 'ajuste', 'devolucion', 'transferencia');

-- =====================================================================================
-- 3. TABLAS
-- =====================================================================================

-- ---- BLOQUE 1: Infraestructura base -------------------------------------------------
CREATE TABLE sucursales (
  id_sucursal   UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        VARCHAR(100) NOT NULL,
  direccion     VARCHAR(255),
  telefono      VARCHAR(20),
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE categorias (
  id_categoria  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        VARCHAR(80)  NOT NULL UNIQUE,
  descripcion   TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE productos (
  id_producto   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_categoria  UUID          NOT NULL REFERENCES categorias(id_categoria) ON DELETE RESTRICT,
  nombre        VARCHAR(150)  NOT NULL,
  codigo        VARCHAR(50)   UNIQUE,
  precio_venta  NUMERIC(10,2) NOT NULL CHECK (precio_venta >= 0),
  precio_costo  NUMERIC(10,2)          CHECK (precio_costo >= 0),
  imagen_url    TEXT,
  activo        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID,
  updated_by    UUID,
  descripcion   TEXT
);

CREATE TABLE inventario (
  id_inventario UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_sucursal   UUID          NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
  id_producto   UUID          NOT NULL REFERENCES productos(id_producto)  ON DELETE RESTRICT,
  stock         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo  NUMERIC(10,2) NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (id_sucursal, id_producto)
);

CREATE TABLE movimientos_inventario (
  id_movimiento UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_inventario UUID            NOT NULL REFERENCES inventario(id_inventario) ON DELETE RESTRICT,
  id_sucursal   UUID            NOT NULL REFERENCES sucursales(id_sucursal)   ON DELETE RESTRICT,
  id_producto   UUID            NOT NULL REFERENCES productos(id_producto)    ON DELETE RESTRICT,
  tipo          tipo_movimiento NOT NULL,
  cantidad      NUMERIC(10,2)   NOT NULL CHECK (cantidad > 0),
  stock_antes   NUMERIC(10,2)   NOT NULL CHECK (stock_antes >= 0),
  stock_despues NUMERIC(10,2)   NOT NULL CHECK (stock_despues >= 0),
  motivo        TEXT,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by    UUID
);

CREATE TABLE mesas (
  id_mesa       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_sucursal   UUID        NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
  numero        SMALLINT    NOT NULL CHECK (numero > 0),
  nombre        VARCHAR(60),
  tipo          tipo_mesa   NOT NULL DEFAULT 'pool',
  activo        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (id_sucursal, numero)
);

CREATE TABLE tarifas (
  id_tarifa            UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_sucursal          UUID            NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
  nombre               VARCHAR(80)     NOT NULL,
  precio_hora          NUMERIC(10,2)   NOT NULL CHECK (precio_hora >= 0),
  tipo_dia             tipo_dia_tarifa NOT NULL DEFAULT 'todos',
  hora_inicio          TIME,
  hora_fin             TIME,
  horas_pagadas        INT             NOT NULL DEFAULT 0,
  horas_regalo         INT             NOT NULL DEFAULT 0,
  activo               BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  descripcion          TEXT,
  es_promocion         BOOLEAN         NOT NULL DEFAULT FALSE,
  dias_semana          INTEGER[]       DEFAULT '{}'::integer[],
  fecha_inicio         DATE,
  fecha_fin            DATE,
  precio_fijo          NUMERIC(10,2),
  personas             INTEGER         NOT NULL DEFAULT 1,
  productos_incluidos  JSONB           DEFAULT '[]'::jsonb
);

-- ---- BLOQUE 2: Acceso interno / roles -----------------------------------------------
CREATE TABLE roles (
  id_rol        UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        VARCHAR(50)  NOT NULL UNIQUE,
  descripcion   TEXT,
  nivel         SMALLINT     NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 5),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE permisos (
  id_permiso    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo        VARCHAR(80)  NOT NULL UNIQUE,
  descripcion   TEXT,
  modulo        VARCHAR(50)  NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE rol_permisos (
  id_rol_permiso UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_rol         UUID NOT NULL REFERENCES roles(id_rol)        ON DELETE CASCADE,
  id_permiso     UUID NOT NULL REFERENCES permisos(id_permiso) ON DELETE CASCADE,
  UNIQUE (id_rol, id_permiso)
);

CREATE TABLE usuarios (
  id_usuario    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id       UUID         UNIQUE,      -- Referencia a auth.users(id) de Supabase
  id_rol        UUID         REFERENCES roles(id_rol) ON DELETE SET NULL,
  nombre        VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  avatar_url    TEXT,
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID
);

-- FKs de auditoría que apuntan a usuarios (se agregan luego de crear usuarios)
ALTER TABLE productos              ADD CONSTRAINT fk_productos_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE productos              ADD CONSTRAINT fk_productos_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE movimientos_inventario ADD CONSTRAINT fk_movinv_created_by    FOREIGN KEY (created_by) REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

CREATE TABLE usuario_sucursal (
  id_usuario_sucursal UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_usuario          UUID    NOT NULL REFERENCES usuarios(id_usuario)   ON DELETE CASCADE,
  id_sucursal         UUID             REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
  id_rol              UUID    NOT NULL REFERENCES roles(id_rol)           ON DELETE RESTRICT,
  es_flotante         BOOLEAN NOT NULL DEFAULT FALSE,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_inicio        DATE    NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin           DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_us_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE UNIQUE INDEX uq_usuario_sucursal_activo_idx
  ON usuario_sucursal (id_usuario, id_sucursal)
  WHERE activo = TRUE;

CREATE TABLE permiso_override (
  id_permiso_override UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_usuario          UUID    NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  id_permiso          UUID    NOT NULL REFERENCES permisos(id_permiso) ON DELETE CASCADE,
  concedido           BOOLEAN NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID             REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  UNIQUE (id_usuario, id_permiso)
);

-- ---- BLOQUE 3: Caja -----------------------------------------------------------------
CREATE TABLE cajas (
  id_caja       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_sucursal   UUID        NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
  nombre        VARCHAR(60) NOT NULL,
  activo        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE arqueos (
  id_arqueo     UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_caja       UUID          NOT NULL REFERENCES cajas(id_caja)         ON DELETE RESTRICT,
  id_sucursal   UUID          NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
  id_usuario    UUID          NOT NULL REFERENCES usuarios(id_usuario)   ON DELETE RESTRICT,
  tipo          VARCHAR(20)   NOT NULL,
  monto_inicial NUMERIC(10,2)          CHECK (monto_inicial >= 0),
  monto_final   NUMERIC(10,2)          CHECK (monto_final >= 0),
  diferencia    NUMERIC(10,2) GENERATED ALWAYS AS (COALESCE(monto_final, 0) - COALESCE(monto_inicial, 0)) STORED,
  observacion   TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE movimientos_caja (
  id_mov_caja   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_caja       UUID          NOT NULL REFERENCES cajas(id_caja)          ON DELETE RESTRICT,
  id_sucursal   UUID          NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
  id_usuario    UUID          NOT NULL REFERENCES usuarios(id_usuario)    ON DELETE RESTRICT,
  tipo          VARCHAR(20)   NOT NULL,
  monto         NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  descripcion   TEXT,
  referencia_id UUID,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---- BLOQUE 4: Operación (mesas, ventas) --------------------------------------------
CREATE TABLE sesiones_mesa (
  id_sesion           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_mesa             UUID          NOT NULL REFERENCES mesas(id_mesa)          ON DELETE RESTRICT,
  id_tarifa           UUID          NOT NULL REFERENCES tarifas(id_tarifa)      ON DELETE RESTRICT,
  id_usuario          UUID          NOT NULL REFERENCES usuarios(id_usuario)    ON DELETE RESTRICT,
  id_sucursal         UUID          NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
  inicio              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  fin                 TIMESTAMPTZ,
  total_tiempo        NUMERIC(6,2)           CHECK (total_tiempo >= 0),
  estado              estado_sesion NOT NULL DEFAULT 'abierta',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  modalidad           VARCHAR(20)            DEFAULT 'abierto',
  tiempo_fijo_minutos INTEGER                DEFAULT 0,
  costo_partida       NUMERIC(10,2)          DEFAULT 0,
  CONSTRAINT chk_sesion_fin CHECK (fin IS NULL OR fin > inicio)
);

CREATE UNIQUE INDEX uq_mesa_una_sesion_abierta
  ON sesiones_mesa (id_mesa)
  WHERE estado = 'abierta';

CREATE TABLE clientes (
  id_cliente       UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id          UUID         UNIQUE,      -- Referencia a auth.users(id) de Supabase
  nombre           VARCHAR(120) NOT NULL,
  email            VARCHAR(255),
  telefono         VARCHAR(20),
  direccion        TEXT,
  puntos_fidelidad INT          NOT NULL DEFAULT 0 CHECK (puntos_fidelidad >= 0),
  activo           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  avatar_url       TEXT
);

CREATE UNIQUE INDEX uq_cliente_email
  ON clientes (email)
  WHERE email IS NOT NULL;

CREATE TABLE pedidos (
  id_pedido     UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_cliente    UUID          NOT NULL REFERENCES clientes(id_cliente)    ON DELETE RESTRICT,
  id_sucursal   UUID          NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
  total         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  estado        estado_pedido NOT NULL DEFAULT 'pendiente',
  tipo          tipo_pedido   NOT NULL DEFAULT 'online',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  numero_mesa   VARCHAR(20)
);

CREATE TABLE ventas (
  id_venta      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_sucursal   UUID          NOT NULL REFERENCES sucursales(id_sucursal)   ON DELETE RESTRICT,
  id_sesion     UUID                   REFERENCES sesiones_mesa(id_sesion)  ON DELETE RESTRICT,
  id_usuario    UUID          NOT NULL REFERENCES usuarios(id_usuario)      ON DELETE RESTRICT,
  id_cliente    UUID                   REFERENCES clientes(id_cliente)      ON DELETE SET NULL,
  id_pedido     UUID                   REFERENCES pedidos(id_pedido)        ON DELETE SET NULL,
  total         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  metodo_pago   metodo_pago   NOT NULL DEFAULT 'efectivo',
  estado        estado_venta  NOT NULL DEFAULT 'completada',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID                   REFERENCES usuarios(id_usuario)      ON DELETE SET NULL
);

CREATE TABLE venta_items (
  id_venta_item   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_venta        UUID          NOT NULL REFERENCES ventas(id_venta)       ON DELETE CASCADE,
  id_producto     UUID          NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,
  cantidad        NUMERIC(8,2)  NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal        NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE TABLE pedido_items (
  id_pedido_item  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_pedido       UUID          NOT NULL REFERENCES pedidos(id_pedido)     ON DELETE CASCADE,
  id_producto     UUID          NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,
  cantidad        NUMERIC(8,2)  NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal        NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- ---- BLOQUE 5: Portal público (novedades, campeonatos) ------------------------------
CREATE TABLE novedades (
  id_novedad    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_sucursal   UUID                   REFERENCES sucursales(id_sucursal) ON DELETE SET NULL,
  titulo        VARCHAR(200)  NOT NULL,
  contenido     TEXT,
  tipo          tipo_novedad  NOT NULL DEFAULT 'noticia',
  imagen_url    TEXT,
  activo        BOOLEAN       NOT NULL DEFAULT TRUE,
  publicado_en  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID                   REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

CREATE TABLE campeonatos (
  id_campeonato      UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_sucursal        UUID              NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
  nombre             VARCHAR(150)      NOT NULL,
  descripcion        TEXT,
  fecha_inicio       DATE              NOT NULL,
  fecha_fin          DATE,
  cupo_maximo        SMALLINT                   CHECK (cupo_maximo > 0),
  precio_inscripcion NUMERIC(10,2)     NOT NULL DEFAULT 0 CHECK (precio_inscripcion >= 0),
  premio             TEXT,
  modalidad          modalidad_camp    NOT NULL DEFAULT 'eliminacion_simple',
  estado             estado_campeonato NOT NULL DEFAULT 'proximo',
  created_at         TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ,
  created_by         UUID                       REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  imagen_url         TEXT,
  CONSTRAINT chk_camp_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE inscripciones (
  id_inscripcion UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_campeonato  UUID             NOT NULL REFERENCES campeonatos(id_campeonato) ON DELETE CASCADE,
  id_cliente     UUID             NOT NULL REFERENCES clientes(id_cliente)       ON DELETE RESTRICT,
  estado_pago    estado_pago_insc NOT NULL DEFAULT 'pendiente',
  created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  UNIQUE (id_campeonato, id_cliente)
);

-- ---- BLOQUE 6: Personal, configuración, notificaciones, torneos ---------------------
CREATE TABLE asistencias (
  id_asistencia    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_usuario       UUID        NOT NULL REFERENCES usuarios(id_usuario)   ON DELETE CASCADE,
  id_sucursal      UUID        NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
  fecha            DATE        NOT NULL DEFAULT CURRENT_DATE,
  hora_entrada     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hora_salida      TIMESTAMPTZ,
  horas_trabajadas NUMERIC(6,2),
  observaciones    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE configuracion (
  id_configuracion     UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_usuario           UUID                   REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  nombre_negocio       VARCHAR(120)  NOT NULL DEFAULT 'Billar El Malandro',
  moneda               VARCHAR(10)   NOT NULL DEFAULT 'Bs.',
  tarifa_hora_mesa     NUMERIC(10,2) NOT NULL DEFAULT 30.00,
  sonidos_activados    BOOLEAN       NOT NULL DEFAULT TRUE,
  impresion_automatica BOOLEAN       NOT NULL DEFAULT FALSE,
  modo_nocturno        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE notificaciones (
  id_notificacion UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo          VARCHAR(200) NOT NULL,
  mensaje         TEXT        NOT NULL,
  tipo            VARCHAR(20)  DEFAULT 'info',
  leida           BOOLEAN      DEFAULT FALSE,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE torneos (
  id_torneo         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre            TEXT        NOT NULL,
  descripcion       TEXT,
  fecha_inicio      TIMESTAMPTZ NOT NULL,
  fecha_fin         TIMESTAMPTZ,
  costo_inscripcion NUMERIC(10,2) DEFAULT 0,
  premio_estimado   NUMERIC(10,2) DEFAULT 0,
  estado            TEXT        DEFAULT 'proximo' CHECK (estado IN ('proximo', 'en_curso', 'finalizado', 'cancelado')),
  puntos_recompensa INTEGER     DEFAULT 0,
  creado_por        UUID                 REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE participantes_torneo (
  id_participante UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_torneo       UUID        NOT NULL REFERENCES torneos(id_torneo)   ON DELETE CASCADE,
  id_cliente      UUID        NOT NULL REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
  estado_pago     TEXT        DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagado')),
  posicion_final  INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_torneo, id_cliente)
);

-- =====================================================================================
-- 4. ÍNDICES
-- =====================================================================================
CREATE INDEX idx_productos_categoria       ON productos(id_categoria);
CREATE INDEX idx_inventario_sucursal       ON inventario(id_sucursal);
CREATE INDEX idx_inventario_producto       ON inventario(id_producto);
CREATE INDEX idx_movinv_inventario         ON movimientos_inventario(id_inventario);
CREATE INDEX idx_movinv_sucursal           ON movimientos_inventario(id_sucursal);
CREATE INDEX idx_movinv_created_at         ON movimientos_inventario(created_at);
CREATE INDEX idx_mesas_sucursal            ON mesas(id_sucursal);
CREATE INDEX idx_tarifas_sucursal          ON tarifas(id_sucursal);
CREATE INDEX idx_usuario_sucursal_usuario  ON usuario_sucursal(id_usuario);
CREATE INDEX idx_usuario_sucursal_sucursal ON usuario_sucursal(id_sucursal);
CREATE INDEX idx_sesiones_mesa             ON sesiones_mesa(id_mesa);
CREATE INDEX idx_sesiones_estado           ON sesiones_mesa(estado);
CREATE INDEX idx_sesiones_sucursal         ON sesiones_mesa(id_sucursal);
CREATE INDEX idx_ventas_sucursal           ON ventas(id_sucursal);
CREATE INDEX idx_ventas_sesion             ON ventas(id_sesion);
CREATE INDEX idx_ventas_created_at         ON ventas(created_at);
CREATE INDEX idx_ventas_cliente            ON ventas(id_cliente);
CREATE INDEX idx_ventas_pedido             ON ventas(id_pedido);
CREATE INDEX idx_venta_items_venta         ON venta_items(id_venta);
CREATE INDEX idx_cajas_sucursal            ON cajas(id_sucursal);
CREATE INDEX idx_arqueos_caja              ON arqueos(id_caja);
CREATE INDEX idx_movcaja_caja              ON movimientos_caja(id_caja);
CREATE INDEX idx_movcaja_created_at        ON movimientos_caja(created_at);
CREATE INDEX idx_pedidos_cliente           ON pedidos(id_cliente);
CREATE INDEX idx_pedidos_estado            ON pedidos(estado);
CREATE INDEX idx_pedidos_sucursal          ON pedidos(id_sucursal);
CREATE INDEX idx_pedido_items_pedido       ON pedido_items(id_pedido);
CREATE INDEX idx_novedades_tipo            ON novedades(tipo);
CREATE INDEX idx_novedades_sucursal        ON novedades(id_sucursal);
CREATE INDEX idx_novedades_activo          ON novedades(activo);
CREATE INDEX idx_campeonatos_sucursal      ON campeonatos(id_sucursal);
CREATE INDEX idx_campeonatos_estado        ON campeonatos(estado);
CREATE INDEX idx_inscripciones_campeonato  ON inscripciones(id_campeonato);
CREATE INDEX idx_inscripciones_cliente     ON inscripciones(id_cliente);
CREATE INDEX idx_asistencias_usuario       ON asistencias(id_usuario);
CREATE INDEX idx_asistencias_sucursal      ON asistencias(id_sucursal);
CREATE INDEX idx_participantes_torneo      ON participantes_torneo(id_torneo);
CREATE INDEX idx_participantes_cliente     ON participantes_torneo(id_cliente);
CREATE INDEX idx_usuarios_auth_id          ON usuarios(auth_id);
CREATE INDEX idx_clientes_auth_id          ON clientes(auth_id);

-- =====================================================================================
-- 5. FUNCIONES Y TRIGGERS
-- =====================================================================================

-- 5.1 Al registrarse un usuario en Supabase Auth: si su email ya existe como staff,
--     se enlaza; si no, se crea como cliente.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE lower(email) = lower(NEW.email)) THEN
    UPDATE public.usuarios
    SET auth_id = NEW.id,
        nombre  = COALESCE(NEW.raw_user_meta_data ->> 'nombre', nombre)
    WHERE lower(email) = lower(NEW.email);
  ELSE
    INSERT INTO public.clientes (auth_id, nombre, email, telefono)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'nombre', 'Sin nombre'),
      NEW.email,
      NEW.raw_user_meta_data ->> 'telefono'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5.1b Al crear/editar un usuario staff, enlazar automaticamente con su cuenta de
--      Auth si ya existe (por email, sin distinguir mayusculas). Cubre el caso de
--      crear el admin DESPUES de que la persona ya se registro en la web.
CREATE OR REPLACE FUNCTION public.link_usuario_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.auth_id IS NULL THEN
    SELECT id INTO NEW.auth_id
    FROM auth.users
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_link_usuario_auth ON public.usuarios;
CREATE TRIGGER tg_link_usuario_auth
  BEFORE INSERT OR UPDATE OF email ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.link_usuario_auth();

-- 5.2 Verifica si el usuario logueado es empleado activo (para políticas RLS)
CREATE OR REPLACE FUNCTION public.es_empleado()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE auth_id = auth.uid() AND activo = true
  );
END;
$$;

-- 5.3 Suma puntos de fidelidad a un cliente (llamado vía supabase.rpc)
CREATE OR REPLACE FUNCTION public.increment_puntos(x_cliente uuid, x_puntos integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.clientes
  SET puntos_fidelidad = puntos_fidelidad + COALESCE(x_puntos, 0)
  WHERE id_cliente = x_cliente;
END;
$$;

-- 5.4 Descuenta stock automáticamente al insertar un ítem de venta
CREATE OR REPLACE FUNCTION public.decrementar_stock_venta()
RETURNS TRIGGER AS $$
DECLARE
  v_id_sucursal   UUID;
  v_id_inventario UUID;
  v_stock_antes   NUMERIC(10,2);
  v_stock_despues NUMERIC(10,2);
  v_id_usuario    UUID;
BEGIN
  SELECT id_sucursal, id_usuario INTO v_id_sucursal, v_id_usuario
  FROM public.ventas WHERE id_venta = NEW.id_venta;

  IF v_id_sucursal IS NULL THEN
    RAISE EXCEPTION 'No se encontró la sucursal para la venta %', NEW.id_venta;
  END IF;

  SELECT id_inventario, stock INTO v_id_inventario, v_stock_antes
  FROM public.inventario
  WHERE id_sucursal = v_id_sucursal AND id_producto = NEW.id_producto;

  IF v_id_inventario IS NULL THEN
    INSERT INTO public.inventario (id_sucursal, id_producto, stock, stock_minimo)
    VALUES (v_id_sucursal, NEW.id_producto, 0, 5)
    RETURNING id_inventario, stock INTO v_id_inventario, v_stock_antes;
  END IF;

  v_stock_despues := GREATEST(0, v_stock_antes - NEW.cantidad);

  UPDATE public.inventario
  SET stock = v_stock_despues, updated_at = NOW()
  WHERE id_inventario = v_id_inventario;

  INSERT INTO public.movimientos_inventario (
    id_inventario, id_sucursal, id_producto, tipo, cantidad,
    stock_antes, stock_despues, motivo, created_by
  ) VALUES (
    v_id_inventario, v_id_sucursal, NEW.id_producto, 'salida', NEW.cantidad,
    v_stock_antes, v_stock_despues,
    'Descuento automático por Venta: ' || NEW.id_venta, v_id_usuario
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_descontar_stock_venta ON public.venta_items;
CREATE TRIGGER tg_descontar_stock_venta
  AFTER INSERT ON public.venta_items
  FOR EACH ROW EXECUTE FUNCTION public.decrementar_stock_venta();

-- 5.5 Repone stock automáticamente al anular una venta
CREATE OR REPLACE FUNCTION public.restaurar_stock_anulacion()
RETURNS TRIGGER AS $$
DECLARE
  item            RECORD;
  v_id_inventario UUID;
  v_stock_antes   NUMERIC(10,2);
  v_stock_despues NUMERIC(10,2);
BEGIN
  IF NEW.estado = 'anulada' AND OLD.estado <> 'anulada' THEN
    FOR item IN
      SELECT id_producto, cantidad FROM public.venta_items WHERE id_venta = NEW.id_venta
    LOOP
      SELECT id_inventario, stock INTO v_id_inventario, v_stock_antes
      FROM public.inventario
      WHERE id_sucursal = NEW.id_sucursal AND id_producto = item.id_producto;

      IF v_id_inventario IS NOT NULL THEN
        v_stock_despues := v_stock_antes + item.cantidad;

        UPDATE public.inventario
        SET stock = v_stock_despues, updated_at = NOW()
        WHERE id_inventario = v_id_inventario;

        INSERT INTO public.movimientos_inventario (
          id_inventario, id_sucursal, id_producto, tipo, cantidad,
          stock_antes, stock_despues, motivo, created_by
        ) VALUES (
          v_id_inventario, NEW.id_sucursal, item.id_producto, 'devolucion', item.cantidad,
          v_stock_antes, v_stock_despues,
          'Reposición automática por Venta Anulada: ' || NEW.id_venta, NEW.id_usuario
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_restaurar_stock_anulacion ON public.ventas;
CREATE TRIGGER tg_restaurar_stock_anulacion
  AFTER UPDATE OF estado ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION public.restaurar_stock_anulacion();

-- =====================================================================================
-- 6. RLS (Row Level Security) sobre las tablas de cara al público
-- =====================================================================================
ALTER TABLE clientes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;

-- Clientes: cada quien ve/edita su propio perfil; los empleados ven/gestionan todos
DROP POLICY IF EXISTS "Clientes ven su propio perfil"     ON clientes;
CREATE POLICY "Clientes ven su propio perfil"     ON clientes FOR SELECT USING (auth.uid() = auth_id);
DROP POLICY IF EXISTS "Clientes editan su propio perfil"  ON clientes;
CREATE POLICY "Clientes editan su propio perfil"  ON clientes FOR UPDATE USING (auth.uid() = auth_id);
DROP POLICY IF EXISTS "Empleados ven todos los clientes"  ON clientes;
CREATE POLICY "Empleados ven todos los clientes"  ON clientes FOR SELECT USING (public.es_empleado());
DROP POLICY IF EXISTS "Empleados insertan clientes"       ON clientes;
CREATE POLICY "Empleados insertan clientes"       ON clientes FOR INSERT WITH CHECK (public.es_empleado());
DROP POLICY IF EXISTS "Empleados editan todos los clientes" ON clientes;
CREATE POLICY "Empleados editan todos los clientes" ON clientes FOR UPDATE USING (public.es_empleado()) WITH CHECK (public.es_empleado());

-- Productos: catálogo visible para todos; empleados gestionan
DROP POLICY IF EXISTS "Productos visibles para todos" ON productos;
CREATE POLICY "Productos visibles para todos" ON productos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Empleados gestionan productos" ON productos;
CREATE POLICY "Empleados gestionan productos" ON productos FOR ALL USING (public.es_empleado()) WITH CHECK (public.es_empleado());

-- Categorías: visibles para todos; empleados gestionan
DROP POLICY IF EXISTS "Categorias visibles para todos" ON categorias;
CREATE POLICY "Categorias visibles para todos" ON categorias FOR SELECT USING (true);
DROP POLICY IF EXISTS "Empleados gestionan categorias" ON categorias;
CREATE POLICY "Empleados gestionan categorias" ON categorias FOR ALL USING (public.es_empleado()) WITH CHECK (public.es_empleado());

-- Sucursales: visibles para todos; empleados gestionan
DROP POLICY IF EXISTS "Sucursales visibles para todos" ON sucursales;
CREATE POLICY "Sucursales visibles para todos" ON sucursales FOR SELECT USING (true);
DROP POLICY IF EXISTS "Empleados gestionan sucursales" ON sucursales;
CREATE POLICY "Empleados gestionan sucursales" ON sucursales FOR ALL USING (public.es_empleado()) WITH CHECK (public.es_empleado());

-- =====================================================================================
-- 7. STORAGE (buckets para imágenes)
--    avatars       -> fotos de perfil de usuarios/clientes
--    public_images -> imágenes de productos, novedades, campeonatos
-- =====================================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('public_images', 'public_images', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  -- avatars
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatares visibles publicamente') THEN
    CREATE POLICY "Avatares visibles publicamente" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Subir avatares autenticados') THEN
    CREATE POLICY "Subir avatares autenticados" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Actualizar avatares autenticados') THEN
    CREATE POLICY "Actualizar avatares autenticados" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Eliminar avatares autenticados') THEN
    CREATE POLICY "Eliminar avatares autenticados" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');
  END IF;

  -- public_images
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Imagenes publicas visibles') THEN
    CREATE POLICY "Imagenes publicas visibles" ON storage.objects FOR SELECT USING (bucket_id = 'public_images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Subir imagenes publicas autenticados') THEN
    CREATE POLICY "Subir imagenes publicas autenticados" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'public_images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Actualizar imagenes publicas autenticados') THEN
    CREATE POLICY "Actualizar imagenes publicas autenticados" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'public_images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Eliminar imagenes publicas autenticados') THEN
    CREATE POLICY "Eliminar imagenes publicas autenticados" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'public_images');
  END IF;
END $$;

-- =====================================================================================
-- 8. DATOS SEMILLA
-- =====================================================================================

-- 8.1 Roles
INSERT INTO roles (nombre, descripcion, nivel) VALUES
  ('superadmin', 'Acceso total, todas las sucursales', 5),
  ('admin',      'Administrador de su sucursal',       4),
  ('supervisor', 'Supervisa operaciones y personal',   3),
  ('cajero',     'Gestiona ventas y caja',             2),
  ('mesero',     'Atiende mesas y toma pedidos',       1)
ON CONFLICT (nombre) DO NOTHING;

-- 8.2 Permisos
INSERT INTO permisos (codigo, descripcion, modulo) VALUES
  ('sucursales.ver',        'Ver sucursales',             'sucursales'),
  ('sucursales.gestionar',  'Crear y editar sucursales',  'sucursales'),
  ('mesas.ver',             'Ver estado de mesas',        'mesas'),
  ('mesas.gestionar',       'Abrir y cerrar sesiones',    'mesas'),
  ('mesas.configurar',      'Crear y editar mesas',       'mesas'),
  ('ventas.crear',          'Registrar ventas',           'ventas'),
  ('ventas.ver',            'Ver historial de ventas',    'ventas'),
  ('ventas.anular',         'Anular una venta',           'ventas'),
  ('inventario.ver',        'Ver inventario',             'inventario'),
  ('inventario.gestionar',  'Editar stock y productos',   'inventario'),
  ('empleados.ver',         'Ver lista de empleados',     'empleados'),
  ('empleados.gestionar',   'Crear y editar empleados',   'empleados'),
  ('campeonatos.ver',       'Ver campeonatos',            'campeonatos'),
  ('campeonatos.gestionar', 'Crear y editar campeonatos', 'campeonatos'),
  ('reportes.ver',          'Ver reportes básicos',       'reportes'),
  ('reportes.avanzados',    'Ver reportes avanzados',     'reportes'),
  ('caja.abrir',            'Abrir y cerrar caja',        'caja'),
  ('caja.ver',              'Ver movimientos de caja',    'caja'),
  ('novedades.gestionar',   'Publicar novedades',         'novedades'),
  ('pedidos.gestionar',     'Gestionar pedidos online',   'pedidos')
ON CONFLICT (codigo) DO NOTHING;

-- 8.3 Asignar TODOS los permisos al rol superadmin
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r, permisos p
WHERE r.nombre = 'superadmin'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

-- 8.4 Sucursal de ejemplo
INSERT INTO sucursales (nombre, direccion, telefono)
VALUES ('Billar Malandro - Sede Principal', 'Dirección Principal', '0412-1234567')
ON CONFLICT DO NOTHING;

-- 8.5 Categorías
INSERT INTO categorias (nombre, descripcion) VALUES
  ('Cervezas',          'Cervezas nacionales e importadas'),
  ('Refrescos y Jugos', 'Gaseosas, aguas y jugos'),
  ('Snacks',            'Papas fritas, maní, pipocas'),
  ('Licores y Tragos',  'Ron, fernet, singani y combinados'),
  ('Alquiler de Mesas', 'Servicios de tiempo en mesas de billar'),
  ('Cigarros',          'Cigarros y tabaco'),
  ('Tragos',            'Tragos y bebidas preparadas')
ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- 8.6 Productos (catálogo)
INSERT INTO productos (nombre, id_categoria, precio_venta, precio_costo, activo, codigo, descripcion)
VALUES
  ('Burguesa',          (SELECT id_categoria FROM categorias WHERE nombre = 'Cervezas'), 25.00, 0.00, true, 'BUR-001', 'Cerveza Burguesa'),
  ('Corona 355ml',      (SELECT id_categoria FROM categorias WHERE nombre = 'Cervezas'), 30.00, 0.00, true, 'COR-355', 'Cerveza Corona 355ml'),
  ('Conti',             (SELECT id_categoria FROM categorias WHERE nombre = 'Cervezas'), 20.00, 0.00, true, 'CON-001', 'Cerveza Continental'),
  ('combo conti',       (SELECT id_categoria FROM categorias WHERE nombre = 'Cervezas'), 55.00, 0.00, true, 'CMB-CON', 'Combo de Cerveza Continental'),
  ('Combo Paceña',      (SELECT id_categoria FROM categorias WHERE nombre = 'Cervezas'), 100.00, 0.00, true, 'CMB-PAC', 'Combo de Cerveza Paceña'),
  ('Huari',             (SELECT id_categoria FROM categorias WHERE nombre = 'Cervezas'), 30.00, 0.00, true, 'HUA-001', 'Cerveza Huari'),
  ('Paceña 710ml',      (SELECT id_categoria FROM categorias WHERE nombre = 'Cervezas'), 25.00, 0.00, true, 'PAC-710', 'Cerveza Paceña 710ml'),
  ('Paceña Botellín',   (SELECT id_categoria FROM categorias WHERE nombre = 'Cervezas'), 10.00, 0.00, true, 'PAC-BOT', 'Cerveza Paceña Botellín'),
  ('Coca Cola 2L',      (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 20.00, 0.00, true, 'COC-2L', 'Gaseosa Coca Cola 2 Litros'),
  ('Coca Cola Popular', (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 10.00, 0.00, true, 'COC-POP', 'Gaseosa Coca Cola Popular'),
  ('coca cola 3 lt',    (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 30.00, 0.00, true, 'COC-3L', 'Gaseosa Coca Cola 3 Litros'),
  ('agua de 2 lt',      (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 15.00, 0.00, true, 'AGU-2L', 'Agua de 2 Litros'),
  ('Ciclon',            (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 10.00, 0.00, true, 'CIC-001', 'Bebida Energizante Ciclón'),
  ('Power azul',        (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 12.00, 0.00, true, 'POW-AZU', 'Powerade Azul'),
  ('Coca Cola, sprite, fanta Popular', (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 10.00, 0.00, true, 'GAS-POP', 'Gaseosas Populares (Coca Cola, Sprite, Fanta)'),
  ('Red Bull Pequeño',  (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 30.00, 0.00, true, 'REB-PEQ', 'Bebida Energizante Red Bull Pequeño'),
  ('Power Rojo',        (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 12.00, 0.00, true, 'POW-ROJ', 'Powerade Rojo'),
  ('Monster',           (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 30.00, 0.00, true, 'MON-001', 'Bebida Energizante Monster'),
  ('Agua personal',     (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 8.00, 0.00, true, 'AGU-PER', 'Agua Mineral Personal'),
  ('Agua con gas',      (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 10.00, 0.00, true, 'AGU-GAS', 'Agua con Gas'),
  ('Sprite Personal',   (SELECT id_categoria FROM categorias WHERE nombre = 'Refrescos y Jugos'), 10.00, 0.00, true, 'SPR-PER', 'Gaseosa Sprite Personal'),
  ('Papas sabor churrasco', (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 5.00, 0.00, true, 'PAP-CHU', 'Papas Fritas sabor Churrasco'),
  ('papas picantes',    (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 5.00, 0.00, true, 'PAP-PIC', 'Papas Fritas Picantes'),
  ('Push',              (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 1.00, 0.00, true, 'PSH-001', 'Caramelo Push'),
  ('Nikolo',            (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 5.00, 0.00, true, 'NIK-001', 'Chocolate Nikolo'),
  ('coca cuartilla',    (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 50.00, 0.00, true, 'COC-CUA', 'Hojas de Coca Cuartilla'),
  ('coca 1,2 cuartilla',(SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 30.00, 0.00, true, 'COC-12C', 'Hojas de Coca Media Cuartilla'),
  ('Grosso',            (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 1.00, 0.00, true, 'GRO-001', 'Chicle Grosso'),
  ('Baton',             (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 5.00, 0.00, true, 'BAT-001', 'Chocolate Baton'),
  ('Clorets',           (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 1.00, 0.00, true, 'CLO-001', 'Chicles Clorets'),
  ('Beldent negro o verde', (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 10.00, 0.00, true, 'BEL-NV', 'Chicle Beldent Negro o Verde'),
  ('Nachos verdes',     (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 5.00, 0.00, true, 'NAC-VER', 'Nachos bolsa verde'),
  ('Chupete',           (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 2.00, 0.00, true, 'CHU-001', 'Chupete dulce'),
  ('bom bon',           (SELECT id_categoria FROM categorias WHERE nombre = 'Snacks'), 5.00, 0.00, true, 'BON-BON', 'Chocolate Bon o Bon'),
  ('combo flor de caña 1lt', (SELECT id_categoria FROM categorias WHERE nombre = 'Licores y Tragos'), 180.00, 0.00, true, 'CMB-FDC', 'Combo de Ron Flor de Caña 1 Litro'),
  ('combo fernet',      (SELECT id_categoria FROM categorias WHERE nombre = 'Licores y Tragos'), 200.00, 0.00, true, 'CMB-FER', 'Combo de Fernet Branca'),
  ('four loko',         (SELECT id_categoria FROM categorias WHERE nombre = 'Licores y Tragos'), 50.00, 0.00, true, 'FOU-LOK', 'Bebida Four Loko'),
  ('Combo Singani Casa Real', (SELECT id_categoria FROM categorias WHERE nombre = 'Licores y Tragos'), 150.00, 0.00, true, 'CMB-SCR', 'Combo de Singani Casa Real'),
  ('Ice 51',            (SELECT id_categoria FROM categorias WHERE nombre = 'Licores y Tragos'), 25.00, 0.00, true, 'ICE-51', 'Bebida 51 Ice'),
  ('vaso roto',         (SELECT id_categoria FROM categorias WHERE nombre = 'Tragos'), 10.00, 0.00, true, 'VAS-ROT', 'Shot Vaso Roto'),
  ('Vaso de flor de caña y fernet', (SELECT id_categoria FROM categorias WHERE nombre = 'Tragos'), 30.00, 0.00, true, 'VAS-FDF', 'Vaso servido de Flor de Caña o Fernet'),
  ('Encendedor',        (SELECT id_categoria FROM categorias WHERE nombre = 'Cigarros'), 5.00, 0.00, true, 'ENC-001', 'Encendedor para cigarros'),
  ('Cigarro Unidad',    (SELECT id_categoria FROM categorias WHERE nombre = 'Cigarros'), 2.00, 0.00, true, 'CIG-UNI', 'Cigarro suelto por unidad'),
  ('camel active chico (caja)', (SELECT id_categoria FROM categorias WHERE nombre = 'Cigarros'), 15.00, 0.00, true, 'CAM-ACT', 'Caja de cigarros Camel Active chico'),
  ('Black',             (SELECT id_categoria FROM categorias WHERE nombre = 'Cigarros'), 10.00, 0.00, true, 'BLK-001', 'Cigarros Black'),
  ('Cigarro doble active sandia', (SELECT id_categoria FROM categorias WHERE nombre = 'Cigarros'), 30.00, 0.00, true, 'CIG-DAS', 'Cigarros doble active sandía'),
  ('Hora de Billar (Normal)', (SELECT id_categoria FROM categorias WHERE nombre = 'Alquiler de Mesas'), 30.00, 0.00, true, 'HOR-BIL', 'Servicio de alquiler por hora de billar')
ON CONFLICT (codigo) DO UPDATE SET
  nombre       = EXCLUDED.nombre,
  precio_venta = EXCLUDED.precio_venta,
  precio_costo = EXCLUDED.precio_costo,
  id_categoria = EXCLUDED.id_categoria,
  descripcion  = EXCLUDED.descripcion;

-- =====================================================================================
--  FIN DEL SCRIPT  ·  La base de datos quedó lista para conectar la app.
-- =====================================================================================
