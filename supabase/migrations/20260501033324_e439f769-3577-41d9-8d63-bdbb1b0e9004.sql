-- Add 'inprocess' value to mrb_source enum
ALTER TYPE public.mrb_source ADD VALUE IF NOT EXISTS 'inprocess';

-- Seed role_permissions for new screen 'inward_inprocess' for plant 1300, all existing roles
INSERT INTO public.role_permissions (role, module_key, module_label, plant, can_view, can_edit)
SELECT DISTINCT rp.role, 'inward_inprocess', 'MRB - Inward InProcess', '1300',
  CASE WHEN rp.role = 'admin' THEN true ELSE false END,
  CASE WHEN rp.role = 'admin' THEN true ELSE false END
FROM public.role_permissions rp
WHERE rp.plant = '1300'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions x
    WHERE x.role = rp.role AND x.module_key = 'inward_inprocess' AND x.plant = '1300'
  );