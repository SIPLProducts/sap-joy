CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shop_floor_stock'
      AND column_name = 'stock_key'
  ) THEN
    ALTER TABLE public.shop_floor_stock
    ADD COLUMN stock_key text GENERATED ALWAYS AS (
      plant || '|' || material_code || '|' || COALESCE(batch, '') || '|' || COALESCE(storage_location, '')
    ) STORED;
  END IF;
END $$;

WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY plant, material_code, COALESCE(batch, ''), COALESCE(storage_location, '')
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.shop_floor_stock
)
DELETE FROM public.shop_floor_stock s
USING ranked r
WHERE s.ctid = r.ctid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_floor_stock_unique_stock_key
ON public.shop_floor_stock (stock_key);