
-- 1. Add missing plants (1300 used in mrb_records data)
INSERT INTO public.plants (code, name, location) 
VALUES ('1300', 'HBL Plant 1300', 'Hyderabad')
ON CONFLICT DO NOTHING;

-- 2. Create get_user_plant function
CREATE OR REPLACE FUNCTION public.get_user_plant(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plant FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- 3. Dashboard config table
CREATE TABLE public.dashboard_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_key text NOT NULL,
  plant text NOT NULL,
  role public.app_role NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dashboard_key, plant, role)
);

ALTER TABLE public.dashboard_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dashboard config"
  ON public.dashboard_config FOR SELECT USING (true);

CREATE POLICY "Admins can manage dashboard config"
  ON public.dashboard_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Plant print config table
CREATE TABLE public.plant_print_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant text NOT NULL,
  company_name text NOT NULL DEFAULT 'HBL Power Systems Ltd.',
  division_name text NOT NULL DEFAULT 'Electronics Group',
  logo_url text,
  ncr_doc_number text DEFAULT 'HBL/QA/NCR/001',
  ncr_revision text DEFAULT '01',
  ncr_effective_date text DEFAULT '2025-01-01',
  mrb_doc_number text DEFAULT 'HBL/QA/MRB/001',
  mrb_revision text DEFAULT '01',
  mrb_effective_date text DEFAULT '2025-01-01',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plant)
);

ALTER TABLE public.plant_print_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view print config"
  ON public.plant_print_config FOR SELECT USING (true);

CREATE POLICY "Admins can manage print config"
  ON public.plant_print_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default print configs
INSERT INTO public.plant_print_config (plant, company_name, division_name) VALUES
  ('1300', 'HBL Power Systems Ltd.', 'Battery Division'),
  ('Plant-1000', 'HBL Power Systems Ltd.', 'Electronics Group'),
  ('Plant-2000', 'HBL Power Systems Ltd.', 'Power Systems Division'),
  ('Plant-3000', 'HBL Power Systems Ltd.', 'Industrial Division');

-- 5. Plant workflow config table
CREATE TABLE public.plant_workflow_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant text NOT NULL,
  workflow_step integer NOT NULL,
  department public.app_role NOT NULL,
  step_label text NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plant, workflow_step)
);

ALTER TABLE public.plant_workflow_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflow config"
  ON public.plant_workflow_config FOR SELECT USING (true);

CREATE POLICY "Admins can manage workflow config"
  ON public.plant_workflow_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default workflow for all plants
INSERT INTO public.plant_workflow_config (plant, workflow_step, department, step_label) VALUES
  ('1300', 1, 'quality', 'Quality Review'),
  ('1300', 2, 'purchase', 'Purchase Review'),
  ('1300', 3, 'engineering', 'Engineering Review'),
  ('1300', 4, 'executive', 'Final Approval'),
  ('Plant-1000', 1, 'quality', 'Quality Review'),
  ('Plant-1000', 2, 'purchase', 'Purchase Review'),
  ('Plant-1000', 3, 'engineering', 'Engineering Review'),
  ('Plant-1000', 4, 'executive', 'Final Approval'),
  ('Plant-2000', 1, 'quality', 'Quality Review'),
  ('Plant-2000', 2, 'purchase', 'Purchase Review'),
  ('Plant-2000', 3, 'engineering', 'Engineering Review'),
  ('Plant-2000', 4, 'executive', 'Final Approval'),
  ('Plant-3000', 1, 'quality', 'Quality Review'),
  ('Plant-3000', 2, 'purchase', 'Purchase Review'),
  ('Plant-3000', 3, 'engineering', 'Engineering Review'),
  ('Plant-3000', 4, 'executive', 'Final Approval');

-- 6. Email templates table
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  plant text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_key, plant)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view email templates"
  ON public.email_templates FOR SELECT USING (true);

CREATE POLICY "Admins can manage email templates"
  ON public.email_templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default email templates (plant = NULL means applies to all)
INSERT INTO public.email_templates (template_key, subject_template, body_template) VALUES
  ('mrb_created', 'New MRB Created: {{mrb_number}}', 'A new MRB {{mrb_number}} has been created for material {{material_description}} at plant {{plant}}. Please review.'),
  ('mrb_forwarded', 'MRB {{mrb_number}} - Action Required', 'MRB {{mrb_number}} has been forwarded to {{pending_with}} for review. Material: {{material_description}}, Plant: {{plant}}.'),
  ('mrb_approved', 'MRB {{mrb_number}} - Approved', 'MRB {{mrb_number}} for material {{material_description}} has been approved. Final decision: {{final_decision}}.'),
  ('mrb_rejected', 'MRB {{mrb_number}} - Rejected', 'MRB {{mrb_number}} for material {{material_description}} has been rejected. Please take necessary action.'),
  ('sla_warning', 'SLA Warning: MRB {{mrb_number}}', 'MRB {{mrb_number}} is approaching SLA deadline. Current pending days: {{pending_days}}. Please expedite review.');

-- Add trigger for updated_at on new tables
CREATE TRIGGER update_plant_print_config_updated_at
  BEFORE UPDATE ON public.plant_print_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
