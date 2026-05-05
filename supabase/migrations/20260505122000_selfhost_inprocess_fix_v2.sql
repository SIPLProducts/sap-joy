-- =============================================================================
-- HBL MRB — Self-Hosted In-Process (ZMRB04) Fix v2
-- Idempotent. Safe to run multiple times.
-- Purpose: Ensure the In-Process screen sees data after manual SAP sync.
--
-- Apply on self-hosted Supabase Postgres:
--   psql "$SUPABASE_DB_URL" -f /opt/MRB_NEW/scripts/selfhost_inprocess_fix_v2.sql
-- =============================================================================
BEGIN;

-- 1. Ensure zmrb_inward_report exists with all required columns -----------------
CREATE TABLE IF NOT EXISTS public.zmrb_inward_report (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_lot text NOT NULL,
  material_code text NOT NULL,
  material_description text,
  plant text NOT NULL,
  storage_location text,
  batch text,
  blocked_quantity numeric NOT NULL DEFAULT 0,
  transaction_quantity numeric NOT NULL DEFAULT 0,
  uom text DEFAULT 'EA',
  inspection_date date,
  posting_date date,
  block_reason text,
  vendor_code text,
  vendor_name text,
  po_number text,
  po_item_number text,
  grn_number text,
  grn_item_no text,
  grn_date text,
  status text NOT NULL DEFAULT 'pending',
  source text DEFAULT 'sap_api',
  upload_batch_id text,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zmrb_inward_report
  ADD COLUMN IF NOT EXISTS production_order_no text,
  ADD COLUMN IF NOT EXISTS work_center        text,
  ADD COLUMN IF NOT EXISTS order_type         text,
  ADD COLUMN IF NOT EXISTS confirmation_no    text,
  ADD COLUMN IF NOT EXISTS customer_code      text,
  ADD COLUMN IF NOT EXISTS customer_name      text,
  ADD COLUMN IF NOT EXISTS sales_order        text,
  ADD COLUMN IF NOT EXISTS sales_item         text;

CREATE UNIQUE INDEX IF NOT EXISTS zmrb_inward_report_inspection_lot_key
  ON public.zmrb_inward_report (inspection_lot);

ALTER TABLE public.zmrb_inward_report ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view zmrb inward report"
    ON public.zmrb_inward_report FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert zmrb inward report"
    ON public.zmrb_inward_report FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can update zmrb inward report"
    ON public.zmrb_inward_report FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can delete zmrb inward report"
    ON public.zmrb_inward_report FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. mrb_source enum has 'inprocess' -------------------------------------------
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname='mrb_source') THEN
    BEGIN
      ALTER TYPE public.mrb_source ADD VALUE IF NOT EXISTS 'inprocess';
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $do$;

-- 3. Ensure the ZMRB_Inward_Process config exists ------------------------------
INSERT INTO public.sap_api_config (
  id, config_name, api_endpoint, auth_type, connection_mode, http_method,
  base_url, endpoint_path, description, sap_client,
  timeout_ms, retry_count, retry_delay_ms,
  max_records, enable_logging, is_active, sync_frequency, scheduler_enabled
)
SELECT
  'f1ac85d4-ca04-497a-bed6-1f509d10b4c2',
  'ZMRB_Inward_Process',
  COALESCE(c.api_endpoint, 'http://10.10.6.115:8000/mrb/inward/report?sap-client=234'),
  COALESCE(c.auth_type, 'basic'),
  COALESCE(c.connection_mode, 'proxy'),
  'POST',
  COALESCE(c.base_url, 'http://10.10.6.115:8000'),
  COALESCE(c.endpoint_path, '/mrb/inward/report?sap-client=234'),
  'ZMRB04 - Inward Inspection Report (in-process). ART=04.',
  COALESCE(c.sap_client, '234'),
  30000, 3, 5000, 1000, true, true, 'manual', false
FROM (
  SELECT api_endpoint, auth_type, connection_mode, base_url, endpoint_path, sap_client
  FROM public.sap_api_config
  WHERE id = 'a1000001-0001-0001-0001-000000000004'
  LIMIT 1
) c
ON CONFLICT (id) DO UPDATE SET
  is_active = true,
  http_method = 'POST',
  config_name = 'ZMRB_Inward_Process';

-- Copy credentials from the existing inward config (handles passwords with special chars)
UPDATE public.sap_api_config dest
SET username = src.username,
    encrypted_password = src.encrypted_password,
    proxy_tunnel_url = COALESCE(src.proxy_tunnel_url, dest.proxy_tunnel_url),
    proxy_secret = COALESCE(src.proxy_secret, dest.proxy_secret),
    sap_client = COALESCE(src.sap_client, dest.sap_client),
    base_url = COALESCE(src.base_url, dest.base_url),
    endpoint_path = COALESCE(src.endpoint_path, dest.endpoint_path),
    api_endpoint = COALESCE(src.api_endpoint, dest.api_endpoint)
FROM public.sap_api_config src
WHERE dest.id = 'f1ac85d4-ca04-497a-bed6-1f509d10b4c2'
  AND src.id  = 'a1000001-0001-0001-0001-000000000004';

-- 4. Request fields for ZMRB_Inward_Process (ART=04) ---------------------------
DELETE FROM public.sap_api_request_fields
 WHERE config_id = 'f1ac85d4-ca04-497a-bed6-1f509d10b4c2';
INSERT INTO public.sap_api_request_fields
  (config_id, field_name, field_type, sap_field_name, default_value, is_required, sort_order)
VALUES
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','WERKS','string','WERKS','1300',true,1),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','LGORT','string','LGORT',NULL,false,2),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','PRUEFLOS','string','PRUEFLOS',NULL,false,3),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','MATNR','string','MATNR',NULL,false,4),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','LIFNR','string','LIFNR',NULL,false,5),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','ART','string','ART','04',true,6),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','ZEILE','string','ZEILE',NULL,false,7),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','BLDAT','string','BLDAT',NULL,false,8);

-- 5. Response fields for ZMRB_Inward_Process (mapped to zmrb_inward_report) ----
DELETE FROM public.sap_api_response_fields
 WHERE config_id = 'f1ac85d4-ca04-497a-bed6-1f509d10b4c2';
INSERT INTO public.sap_api_response_fields
  (config_id, field_name, field_type, sap_field_name, json_path, map_to_table, map_to_column, sort_order)
VALUES
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','PRUEFLOS','string','PRUEFLOS',NULL,'zmrb_inward_report','inspection_lot',1),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','WERK','string','WERK',NULL,'zmrb_inward_report','plant',2),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','ENSTEHDAT','string','ENSTEHDAT',NULL,'zmrb_inward_report','inspection_date',3),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','AUFNR','string','AUFNR',NULL,'zmrb_inward_report','production_order_no',4),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','MATNR','string','MATNR',NULL,'zmrb_inward_report','material_code',5),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','SELLIFNR','string','SELLIFNR',NULL,'zmrb_inward_report','vendor_code',6),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','MBLNR','string','MBLNR',NULL,'zmrb_inward_report','grn_number',7),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','CHARG','string','CHARG',NULL,'zmrb_inward_report','batch',8),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','LGORT','string','LGORT',NULL,'zmrb_inward_report','storage_location',9),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','KDAUF','string','KDAUF',NULL,'zmrb_inward_report','sales_order',10),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','EBELN','string','EBELN',NULL,'zmrb_inward_report','po_number',12),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','EBELP','number','EBELP',NULL,'zmrb_inward_report','po_item_number',13),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','BUDAT_MKPF','string','BUDAT_MKPF',NULL,'zmrb_inward_report','posting_date',14),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','SGTXT','string','SGTXT',NULL,'zmrb_inward_report','block_reason',15),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','MENGENEINH','string','MENGENEINH',NULL,'zmrb_inward_report','uom',16),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','LMENGE04','number','LMENGE04',NULL,'zmrb_inward_report','blocked_quantity',17),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','MAKTX','string','MAKTX',NULL,'zmrb_inward_report','material_description',18),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','NAME1','string','NAME1',NULL,'zmrb_inward_report','vendor_name',22),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','QTY','number','QTY',NULL,'zmrb_inward_report','transaction_quantity',23),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','GRN_ITEM_NO','string','ZEILE','$.ZEILE','zmrb_inward_report','grn_item_no',25),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','GRN_DATE','string','BLDAT','$.BLDAT','zmrb_inward_report','grn_date',26),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','ARBPL','string','ARBPL',NULL,'zmrb_inward_report','work_center',27),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','AUART','string','AUART',NULL,'zmrb_inward_report','order_type',28),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','RUECK','string','RUECK',NULL,'zmrb_inward_report','confirmation_no',29),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','KUNNR','string','KUNNR',NULL,'zmrb_inward_report','customer_code',30);

-- 6. role_permissions for the In-Process screen (plant 1300) -------------------
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

COMMIT;

-- =============================================================================
-- Verification
-- =============================================================================
SELECT c.config_name, c.is_active,
       (SELECT count(*) FROM public.sap_api_request_fields  WHERE config_id=c.id) AS req_count,
       (SELECT count(*) FROM public.sap_api_response_fields WHERE config_id=c.id
         AND map_to_table='zmrb_inward_report' AND map_to_column IS NOT NULL) AS zmrb_mapped
FROM public.sap_api_config c
WHERE c.id IN ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2',
               'a1000001-0001-0001-0001-000000000004');

SELECT count(*) AS rows_in_zmrb_inward_report FROM public.zmrb_inward_report;
