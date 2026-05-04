ALTER TABLE public.zmrb_inward_report
  ADD COLUMN IF NOT EXISTS customer_code text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS sales_order text,
  ADD COLUMN IF NOT EXISTS sales_item text;