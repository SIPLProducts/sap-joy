
ALTER TABLE public.shop_floor_stock
  ADD COLUMN IF NOT EXISTS blocked_quantity numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_inspection_qty numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_qty numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unrestricted_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_inspection_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_location_desc text,
  ADD COLUMN IF NOT EXISTS row_number_custom text,
  ADD COLUMN IF NOT EXISTS shelf_number text,
  ADD COLUMN IF NOT EXISTS rack_number text,
  ADD COLUMN IF NOT EXISTS bin_number text;
