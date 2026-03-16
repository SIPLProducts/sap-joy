CREATE UNIQUE INDEX IF NOT EXISTS idx_inward_inspection_lots_inspection_lot_unique
ON public.inward_inspection_lots (inspection_lot);

CREATE INDEX IF NOT EXISTS idx_mrb_records_source_inspection_lot
ON public.mrb_records (source, inspection_lot);