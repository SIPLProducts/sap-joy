ALTER TABLE public.zmrb_inward_report
  ADD COLUMN IF NOT EXISTS production_order_no text,
  ADD COLUMN IF NOT EXISTS work_center        text,
  ADD COLUMN IF NOT EXISTS order_type         text,
  ADD COLUMN IF NOT EXISTS confirmation_no    text;