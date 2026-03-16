
ALTER TABLE public.sap_api_config
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS base_url text,
  ADD COLUMN IF NOT EXISTS endpoint_path text,
  ADD COLUMN IF NOT EXISTS http_method text DEFAULT 'GET',
  ADD COLUMN IF NOT EXISTS sap_client text,
  ADD COLUMN IF NOT EXISTS timeout_ms integer DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS connection_mode text DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS proxy_tunnel_url text,
  ADD COLUMN IF NOT EXISTS proxy_secret text;
