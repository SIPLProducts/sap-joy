-- Master Admin bypass for plant access
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
      SELECT 1 FROM public.user_plants up
      WHERE up.user_id = _user_id AND up.plant_code = _plant
    );
$function$;