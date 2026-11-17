CREATE OR REPLACE FUNCTION public.add_dynamic_column(_table_name text, _column_name text, _column_type text DEFAULT 'text'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _safe_type text;
BEGIN
  -- Caller authorization: signed-in callers must be SAP settings admins.
  -- Server-side callers (service role, no auth.uid()) are allowed.
  IF auth.uid() IS NOT NULL AND NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_screen_access(auth.uid(), 'sap_api_settings')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.email = 'masteradmin@sharviinfotech.com')
  ) THEN
    RAISE EXCEPTION 'Not authorized to add columns';
  END IF;

  IF _table_name IS NULL OR _table_name NOT IN ('shop_floor_stock', 'inward_inspection_lots', 'materials', 'vendors') THEN
    RAISE EXCEPTION 'Dynamic columns not allowed on table: %', _table_name;
  END IF;
  IF _column_name IS NULL OR _column_name !~ '^[a-z_][a-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'Invalid column name: %', _column_name;
  END IF;

  -- Map type to a fixed literal; never interpolate caller text as a type
  _safe_type := CASE COALESCE(_column_type, 'text')
    WHEN 'text' THEN 'text'
    WHEN 'numeric' THEN 'numeric'
    WHEN 'integer' THEN 'integer'
    WHEN 'boolean' THEN 'boolean'
    WHEN 'date' THEN 'date'
    WHEN 'timestamptz' THEN 'timestamptz'
    WHEN 'jsonb' THEN 'jsonb'
    ELSE NULL
  END;
  IF _safe_type IS NULL THEN
    RAISE EXCEPTION 'Invalid column type: %', _column_type;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _table_name AND column_name = _column_name
  ) THEN
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I ' || _safe_type, _table_name, _column_name);
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.add_dynamic_column(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_dynamic_column(text, text, text) TO authenticated, service_role;