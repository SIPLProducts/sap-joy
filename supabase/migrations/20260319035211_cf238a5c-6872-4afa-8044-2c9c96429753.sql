
-- ============================================================
-- Performance indexes for frequently queried columns
-- ============================================================

-- mrb_records: status, plant, pending_with, created_at are used in dashboards/worklists
CREATE INDEX IF NOT EXISTS idx_mrb_records_status ON public.mrb_records (status);
CREATE INDEX IF NOT EXISTS idx_mrb_records_plant ON public.mrb_records (plant);
CREATE INDEX IF NOT EXISTS idx_mrb_records_pending_with ON public.mrb_records (pending_with);
CREATE INDEX IF NOT EXISTS idx_mrb_records_created_at ON public.mrb_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mrb_records_created_by ON public.mrb_records (created_by);

-- inward_inspection_lots: plant, status, material_code queried for filtering
CREATE INDEX IF NOT EXISTS idx_inward_lots_plant ON public.inward_inspection_lots (plant);
CREATE INDEX IF NOT EXISTS idx_inward_lots_status ON public.inward_inspection_lots (status);
CREATE INDEX IF NOT EXISTS idx_inward_lots_material_code ON public.inward_inspection_lots (material_code);
CREATE INDEX IF NOT EXISTS idx_inward_lots_created_at ON public.inward_inspection_lots (created_at DESC);

-- email_logs: mrb_id FK lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_mrb_id ON public.email_logs (mrb_id);

-- mrb_approval_history: mrb_id FK lookups
CREATE INDEX IF NOT EXISTS idx_mrb_approval_history_mrb_id ON public.mrb_approval_history (mrb_id);

-- mrb_attachments: mrb_id FK lookups
CREATE INDEX IF NOT EXISTS idx_mrb_attachments_mrb_id ON public.mrb_attachments (mrb_id);

-- ============================================================
-- Enable realtime for inward_inspection_lots (code subscribes to it)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.inward_inspection_lots;
