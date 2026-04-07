ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS workflow_status text NULL;

-- Set default workflow_status for existing departments based on role_key
UPDATE public.departments SET workflow_status = 'quality_review' WHERE role_key IN ('quality', 'quality_head');
UPDATE public.departments SET workflow_status = 'purchase_review' WHERE role_key IN ('purchase', 'purchase_head');
UPDATE public.departments SET workflow_status = 'engineering_review' WHERE role_key IN ('engineering', 'engineering_head');
UPDATE public.departments SET workflow_status = 'final_approval' WHERE role_key IN ('executive');
UPDATE public.departments SET workflow_status = 'quality_review' WHERE role_key = 'mrb_committee';