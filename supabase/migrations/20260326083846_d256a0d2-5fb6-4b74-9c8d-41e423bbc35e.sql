
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  module_key text NOT NULL,
  module_label text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  plant text NOT NULL DEFAULT '1300',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, module_key, plant)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage role_permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default permissions for all roles and modules
INSERT INTO public.role_permissions (role, module_key, module_label, can_view, can_edit, plant)
SELECT r.role, m.module_key, m.module_label, m.default_view, m.default_edit, '1300'
FROM (VALUES
  ('admin'), ('quality'), ('quality_head'), ('purchase'), ('purchase_head'),
  ('engineering'), ('engineering_head'), ('shop_floor'), ('executive'), ('mrb_committee')
) AS r(role)
CROSS JOIN (VALUES
  ('kpi_dashboard', 'KPI Dashboard', true, false),
  ('worklist', 'MRB Worklist', true, true),
  ('material_blocking', 'Material Blocking', false, false),
  ('inward_materials', 'MRB - Inward Materials', true, true),
  ('mrb_print', 'MRB Print', true, false),
  ('email_log', 'Email Log', true, false),
  ('analytics', 'MRB Analytics', true, false),
  ('quality_dashboard', 'Quality Dashboard', false, false),
  ('purchase_dashboard', 'Purchase Dashboard', false, false),
  ('engineering_dashboard', 'Engineering Dashboard', false, false),
  ('executive_summary', 'Executive Summary', false, false),
  ('user_management', 'User & Role Management', false, false),
  ('user_matrix', 'User Permission Matrix', false, false),
  ('plant_management', 'Plant Management', false, false),
  ('sap_api_settings', 'SAP API Settings', false, false),
  ('sap_sync_monitor', 'SAP Sync Monitor', false, false),
  ('help_support', 'Help & Support', true, false)
) AS m(module_key, module_label, default_view, default_edit);

-- Enable all modules for admin
UPDATE public.role_permissions SET can_view = true, can_edit = true WHERE role = 'admin';

-- Enable specific modules per role
UPDATE public.role_permissions SET can_view = true WHERE role = 'quality' AND module_key IN ('kpi_dashboard','worklist','inward_materials','mrb_print','email_log','analytics','quality_dashboard','help_support');
UPDATE public.role_permissions SET can_view = true WHERE role = 'quality_head' AND module_key IN ('kpi_dashboard','worklist','inward_materials','mrb_print','email_log','analytics','quality_dashboard','executive_summary','help_support');
UPDATE public.role_permissions SET can_view = true WHERE role = 'purchase' AND module_key IN ('kpi_dashboard','worklist','inward_materials','mrb_print','email_log','analytics','purchase_dashboard','help_support');
UPDATE public.role_permissions SET can_view = true WHERE role = 'purchase_head' AND module_key IN ('kpi_dashboard','worklist','inward_materials','mrb_print','email_log','analytics','purchase_dashboard','executive_summary','help_support');
UPDATE public.role_permissions SET can_view = true WHERE role = 'engineering' AND module_key IN ('kpi_dashboard','worklist','inward_materials','mrb_print','email_log','analytics','engineering_dashboard','help_support');
UPDATE public.role_permissions SET can_view = true WHERE role = 'engineering_head' AND module_key IN ('kpi_dashboard','worklist','inward_materials','mrb_print','email_log','analytics','engineering_dashboard','executive_summary','help_support');
UPDATE public.role_permissions SET can_view = true WHERE role = 'shop_floor' AND module_key IN ('kpi_dashboard','worklist','material_blocking','mrb_print','help_support');
UPDATE public.role_permissions SET can_view = true WHERE role = 'executive' AND module_key IN ('kpi_dashboard','worklist','inward_materials','mrb_print','email_log','analytics','quality_dashboard','purchase_dashboard','engineering_dashboard','executive_summary','help_support');
UPDATE public.role_permissions SET can_view = true WHERE role = 'mrb_committee' AND module_key IN ('kpi_dashboard','worklist','inward_materials','mrb_print','email_log','analytics','quality_dashboard','purchase_dashboard','engineering_dashboard','executive_summary','help_support');
