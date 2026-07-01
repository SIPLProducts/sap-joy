
ALTER TABLE public.quality_info ADD COLUMN IF NOT EXISTS release_until date;

INSERT INTO public.sap_api_config (
  config_name, description, base_url, endpoint_path, api_endpoint,
  http_method, auth_type, sap_client, connection_mode, is_active, timeout_ms
)
SELECT
  'Q-Info Creation',
  'Create Quality Info record in SAP (QI01)',
  'https://10.10.47.144:44300',
  '/mrb/qinfo/create',
  'https://10.10.47.144:44300/mrb/qinfo/create?sap-client=234',
  'POST', 'basic', '234', 'direct', true, 60000
WHERE NOT EXISTS (
  SELECT 1 FROM public.sap_api_config WHERE config_name = 'Q-Info Creation'
);

INSERT INTO public.sap_api_request_fields (config_id, field_name, field_type, sap_field_name, is_required, description, sort_order)
SELECT c.id, f.field_name, 'CHAR', f.field_name, true, f.descr, f.ord
FROM public.sap_api_config c
CROSS JOIN (VALUES
  ('MATNR', 'Material Code', 1),
  ('LIFNR', 'Supplier/Vendor Code', 2),
  ('WERKS', 'Plant', 3),
  ('REL_UDT', 'Release Until', 4)
) AS f(field_name, descr, ord)
WHERE c.config_name = 'Q-Info Creation'
  AND NOT EXISTS (
    SELECT 1 FROM public.sap_api_request_fields r
    WHERE r.config_id = c.id AND r.field_name = f.field_name
  );
