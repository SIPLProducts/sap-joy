CREATE OR REPLACE FUNCTION public.user_has_plant(_user_id uuid, _plant text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _plant IS NULL OR EXISTS (
    SELECT 1 FROM public.user_plants
    WHERE user_id = _user_id AND plant_code = _plant
  );
$$;