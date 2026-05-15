-- Superadmin: full access across all roles, screens, and plants
-- Idempotent and safe to re-run.

-- 1) Seed Super Administrator department row
INSERT INTO public.departments
  (name, role_key, description, is_active, is_workflow_enabled, workflow_status)
SELECT 'Super Administrator', 'superadmin',
       'Full system access with all-plant visibility',
       true, false, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.departments WHERE role_key = 'superadmin'
);

-- 2) has_role: superadmin satisfies any role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'superadmin'
    )
$function$;

-- 3) has_screen_access: superadmin gets all screens except SAP API settings & sync monitor
CREATE OR REPLACE FUNCTION public.has_screen_access(_user_id uuid, _screen_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = 'superadmin'
      )
      AND _screen_key NOT IN ('sap_api_settings', 'sap_sync_monitor')
    )
    OR EXISTS (
      SELECT 1 FROM public.role_permissions rp
      JOIN public.user_roles ur ON ur.role = rp.role
      WHERE ur.user_id = _user_id
        AND rp.module_key = _screen_key
        AND rp.can_view = true
    )
$function$;

-- 4) user_has_plant: superadmin sees every plant
CREATE OR REPLACE FUNCTION public.user_has_plant(_user_id uuid, _plant text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    _plant IS NULL
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = _user_id
        AND p.email = 'masteradmin@sharviinfotech.com'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id AND ur.role = 'superadmin'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_plants up
      WHERE up.user_id = _user_id AND up.plant_code = _plant
    );
$function$;