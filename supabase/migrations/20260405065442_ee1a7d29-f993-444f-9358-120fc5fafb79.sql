
-- Add role_key column to departments table for mapping to app_role enum
ALTER TABLE public.departments ADD COLUMN role_key text;

-- Update existing departments with their role mappings
UPDATE public.departments SET role_key = 'engineering' WHERE name = 'Engineering';
UPDATE public.departments SET role_key = 'purchase' WHERE name = 'Purchase';
UPDATE public.departments SET role_key = 'quality' WHERE name = 'Quality';
UPDATE public.departments SET role_key = 'shop_floor' WHERE name = 'Shop Floor';
UPDATE public.departments SET role_key = 'mrb_committee' WHERE name = 'MRB Committee';
UPDATE public.departments SET role_key = 'executive' WHERE name = 'Management';
