
-- Request fields for SAP API configurations
CREATE TABLE public.sap_api_request_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.sap_api_config(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_type text NOT NULL DEFAULT 'string',
  sap_field_name text,
  default_value text,
  is_required boolean DEFAULT false,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Response fields for SAP API configurations
CREATE TABLE public.sap_api_response_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.sap_api_config(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_type text NOT NULL DEFAULT 'string',
  sap_field_name text,
  json_path text,
  map_to_column text,
  map_to_table text,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sap_api_request_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sap_api_response_fields ENABLE ROW LEVEL SECURITY;

-- Admins can manage, authenticated can view
CREATE POLICY "Admins can manage request fields" ON public.sap_api_request_fields
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view request fields" ON public.sap_api_request_fields
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage response fields" ON public.sap_api_response_fields
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view response fields" ON public.sap_api_response_fields
  FOR SELECT TO authenticated USING (true);

-- Add scheduler columns to sap_api_config
ALTER TABLE public.sap_api_config
  ADD COLUMN IF NOT EXISTS cron_expression text,
  ADD COLUMN IF NOT EXISTS scheduler_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS retry_delay_ms integer DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS max_records integer DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS enable_logging boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_headers jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS client_secret text,
  ADD COLUMN IF NOT EXISTS token_url text;
