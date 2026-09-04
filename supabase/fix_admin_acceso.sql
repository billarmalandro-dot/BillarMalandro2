-- =====================================================================================
--  FIX: ACCESO DE ADMINISTRADORES / STAFF AL DASHBOARD
--
--  Problema: una cuenta con rol admin es tratada como cliente y no puede entrar al
--  panel, porque su fila en la tabla "usuarios" NO tiene el auth_id enlazado a su
--  cuenta de inicio de sesion (auth.users). El login y el dashboard identifican al
--  staff unicamente por:  usuarios.auth_id = <id del usuario logueado>.
--
--  Causa tipica: la persona se registro en la web ANTES de que existiera su fila en
--  "usuarios" (el trigger la creo como cliente), o hubo diferencia de mayusculas en
--  el correo.
--
--  COMO USAR: pega TODO este script en el SQL Editor de tu proyecto Supabase y RUN.
--  Luego CIERRA SESION y vuelve a INICIAR SESION en la app.
-- =====================================================================================

-- 1) MEJORA DURABLE ---------------------------------------------------------------
--    Al crear o editar el email de un usuario staff, se enlaza automaticamente con
--    su cuenta de Auth si esta ya existe (comparando por email, sin distinguir
--    mayusculas). Asi, aunque crees el admin DESPUES de que la persona ya se
--    registro, queda vinculado solo.
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

-- 2) MEJORA DURABLE ---------------------------------------------------------------
--    El enlace al registrarse en la web ahora es sin distinguir mayusculas.
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

-- 3) ARREGLO INMEDIATO ------------------------------------------------------------
--    Enlaza AHORA toda cuenta de staff que aun no tenga auth_id, con su usuario de
--    Auth correspondiente (por email).
UPDATE public.usuarios u
SET auth_id = au.id
FROM auth.users au
WHERE lower(au.email) = lower(u.email)
  AND u.auth_id IS NULL;

-- 4) VERIFICACION -----------------------------------------------------------------
--    Todas las filas de staff deberian mostrar un auth_id (no nulo) y su rol.
--    Si tu admin sigue con auth_id NULL, significa que aun NO te has registrado en
--    la web con ese mismo correo: registrate primero y vuelve a correr el paso 3.
SELECT
  u.email,
  u.auth_id,
  r.nombre AS rol,
  r.nivel,
  CASE WHEN u.auth_id IS NULL THEN '❌ SIN ENLAZAR' ELSE '✅ OK' END AS estado
FROM public.usuarios u
LEFT JOIN public.roles r ON r.id_rol = u.id_rol
ORDER BY r.nivel DESC NULLS LAST;
