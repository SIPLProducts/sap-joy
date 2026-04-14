
ALTER TABLE public.inward_inspection_lots ADD COLUMN IF NOT EXISTS grn_item_no TEXT;
ALTER TABLE public.inward_inspection_lots ADD COLUMN IF NOT EXISTS grn_date TEXT;

ALTER TABLE public.mrb_records ADD COLUMN IF NOT EXISTS grn_item_number TEXT;
ALTER TABLE public.mrb_records ADD COLUMN IF NOT EXISTS grn_date DATE;
