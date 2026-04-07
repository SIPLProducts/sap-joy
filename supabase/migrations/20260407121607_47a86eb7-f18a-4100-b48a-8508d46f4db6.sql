ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS is_workflow_enabled boolean NOT NULL DEFAULT false;

-- Enable workflow for roles that already have a role_key
UPDATE public.departments SET is_workflow_enabled = true WHERE role_key IS NOT NULL;