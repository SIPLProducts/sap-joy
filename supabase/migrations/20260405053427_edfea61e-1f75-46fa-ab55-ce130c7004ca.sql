
-- Helper to get existing columns for a table
CREATE OR REPLACE FUNCTION public.get_table_columns(_table_name text)
RETURNS TABLE(column_name text, data_type text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.column_name::text, c.data_type::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = _table_name
  ORDER BY c.ordinal_position;
$$;

-- Helper to dynamically add a column if it doesn't exist
CREATE OR REPLACE FUNCTION public.add_dynamic_column(_table_name text, _column_name text, _column_type text DEFAULT 'text')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate table name and column name to prevent SQL injection
  IF _table_name !~ '^[a-z_][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid table name: %', _table_name;
  END IF;
  IF _column_name !~ '^[a-z_][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid column name: %', _column_name;
  END IF;
  IF _column_type NOT IN ('text', 'numeric', 'integer', 'boolean', 'date', 'timestamptz', 'jsonb') THEN
    RAISE EXCEPTION 'Invalid column type: %', _column_type;
  END IF;
  
  -- Only allow adding to known safe tables
  IF _table_name NOT IN ('shop_floor_stock', 'inward_inspection_lots', 'materials', 'vendors') THEN
    RAISE EXCEPTION 'Dynamic columns not allowed on table: %', _table_name;
  END IF;
  
  -- Check if column already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = _table_name AND column_name = _column_name
  ) THEN
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', _table_name, _column_name, _column_type);
  END IF;
END;
$$;
