DELETE FROM public.mrb_approval_history WHERE mrb_id IN (SELECT id FROM public.mrb_records WHERE plant NOT IN ('1300'));
DELETE FROM public.mrb_attachments WHERE mrb_id IN (SELECT id FROM public.mrb_records WHERE plant NOT IN ('1300'));
DELETE FROM public.email_logs WHERE mrb_id IN (SELECT id FROM public.mrb_records WHERE plant NOT IN ('1300'));
DELETE FROM public.sap_sync_history WHERE mrb_id IN (SELECT id FROM public.mrb_records WHERE plant NOT IN ('1300'));
DELETE FROM public.mrb_records WHERE plant NOT IN ('1300');
DELETE FROM public.plants WHERE code NOT IN ('1300');
INSERT INTO public.plants (code, name, location) VALUES ('1300', 'Plant 1300 - CLW', 'Chittoor') ON CONFLICT (code) DO NOTHING;