-- =============================================================================
-- Self-Hosted Patch: ZMRB In-Process + Result Recording + zmrb_inward_report
-- Idempotent. Safe to apply multiple times.
-- =============================================================================
BEGIN;

-- 1. Ensure zmrb_inward_report has the 8 newer columns (no-op if already there)
ALTER TABLE public.zmrb_inward_report
  ADD COLUMN IF NOT EXISTS production_order_no text,
  ADD COLUMN IF NOT EXISTS work_center        text,
  ADD COLUMN IF NOT EXISTS order_type         text,
  ADD COLUMN IF NOT EXISTS confirmation_no    text,
  ADD COLUMN IF NOT EXISTS customer_code      text,
  ADD COLUMN IF NOT EXISTS customer_name      text,
  ADD COLUMN IF NOT EXISTS sales_order        text,
  ADD COLUMN IF NOT EXISTS sales_item         text;

-- 2. Ensure unique key for upsert(... onConflict: 'inspection_lot')
CREATE UNIQUE INDEX IF NOT EXISTS zmrb_inward_report_inspection_lot_key
  ON public.zmrb_inward_report (inspection_lot);

-- 3. Ensure mrb_source enum includes 'inprocess'
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname='mrb_source') THEN
    BEGIN
      ALTER TYPE public.mrb_source ADD VALUE IF NOT EXISTS 'inprocess';
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $do$;

-- 4. role_permissions for new screen 'inward_inprocess' (plant 1300)
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

-- 5. ZMRB_Inward_Process API config
INSERT INTO public.sap_api_config (
  id, config_name, api_endpoint, auth_type, connection_mode, http_method,
  base_url, endpoint_path, description, username, encrypted_password, sap_client,
  proxy_tunnel_url, proxy_secret, timeout_ms, retry_count, retry_delay_ms,
  max_records, enable_logging, is_active, sync_frequency, scheduler_enabled
) VALUES (
  'f1ac85d4-ca04-497a-bed6-1f509d10b4c2', 'ZMRB_Inward_Process',
  'http://10.10.6.115:8000/mrb/inward/report?sap-client=234', 'basic', 'proxy', 'POST',
  'http://10.10.6.115:8000', '/mrb/inward/report?sap-client=234',
  'ZMRB04 - Inward Inspection Report (in-process). ART=04.',
  'WFMS_USER', 'R@p!d#3126', '234', '', '7d9f2e1b4a5c8e3d6f1g0h2j4k6l8m0n',
  30000, 3, 5000, 1000, true, true, 'manual', false
) ON CONFLICT (id) DO UPDATE SET
  config_name=EXCLUDED.config_name, http_method=EXCLUDED.http_method,
  base_url=EXCLUDED.base_url, endpoint_path=EXCLUDED.endpoint_path,
  api_endpoint=EXCLUDED.api_endpoint, connection_mode=EXCLUDED.connection_mode,
  is_active=true;

-- 5a. Result_Recording_View API config
INSERT INTO public.sap_api_config (
  id, config_name, api_endpoint, auth_type, connection_mode, http_method,
  base_url, endpoint_path, description, username, encrypted_password, sap_client,
  proxy_tunnel_url, proxy_secret, timeout_ms, retry_count, retry_delay_ms,
  max_records, enable_logging, is_active, sync_frequency, scheduler_enabled
) VALUES (
  '4a60825e-2f0b-4633-9978-47214480f80a', 'Result_Recording_View',
  'http://10.10.6.115:8000/mrb/inward/report?sap-client=234', 'basic', 'proxy', 'GET',
  'http://10.10.6.115:8000', '/mrb/inward/report?sap-client=234',
  'Result Recording (read-only) per inspection lot/operation.',
  'WFMS_USER', 'R@p!d#3126', '234', '', '7d9f2e1b4a5c8e3d6f1g0h2j4k6l8m0n',
  30000, 3, 5000, 1000, true, true, 'manual', false
) ON CONFLICT (id) DO UPDATE SET
  config_name=EXCLUDED.config_name, http_method=EXCLUDED.http_method,
  base_url=EXCLUDED.base_url, endpoint_path=EXCLUDED.endpoint_path,
  api_endpoint=EXCLUDED.api_endpoint, connection_mode=EXCLUDED.connection_mode,
  is_active=true;

-- 6. Request fields for ZMRB_Inward_Process
DELETE FROM public.sap_api_request_fields WHERE config_id='f1ac85d4-ca04-497a-bed6-1f509d10b4c2';
INSERT INTO public.sap_api_request_fields (config_id, field_name, field_type, sap_field_name, default_value, is_required, sort_order) VALUES
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','WERKS','string','WERKS','1300',true,1),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','LGORT','string','LGORT',NULL,false,2),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','PRUEFLOS','string','PRUEFLOS',NULL,false,3),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','MATNR','string','MATNR',NULL,false,4),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','LIFNR','string','LIFNR',NULL,false,5),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','ART','string','ART','04',true,6),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','ZEILE','string','ZEILE',NULL,false,7),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','BLDAT','string','BLDAT',NULL,false,8);

-- 7. Response fields for ZMRB_Inward_Process (mapped to zmrb_inward_report)
DELETE FROM public.sap_api_response_fields WHERE config_id='f1ac85d4-ca04-497a-bed6-1f509d10b4c2';
INSERT INTO public.sap_api_response_fields (config_id, field_name, field_type, sap_field_name, json_path, map_to_table, map_to_column, sort_order) VALUES
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
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','EKORG','string','EKORG',NULL,NULL,NULL,11),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','EBELN','string','EBELN',NULL,'zmrb_inward_report','po_number',12),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','EBELP','number','EBELP',NULL,'zmrb_inward_report','po_item_number',13),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','BUDAT_MKPF','string','BUDAT_MKPF',NULL,'zmrb_inward_report','posting_date',14),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','SGTXT','string','SGTXT',NULL,'zmrb_inward_report','block_reason',15),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','MENGENEINH','string','MENGENEINH',NULL,'zmrb_inward_report','uom',16),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','LMENGE04','number','LMENGE04',NULL,'zmrb_inward_report','blocked_quantity',17),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','MAKTX','string','MAKTX',NULL,'zmrb_inward_report','material_description',18),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','GROUP','string','GROUP',NULL,NULL,NULL,19),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','GNAME','string','GNAME',NULL,NULL,NULL,20),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','LGOBE','string','LGOBE',NULL,NULL,NULL,21),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','NAME1','string','NAME1',NULL,'zmrb_inward_report','vendor_name',22),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','QTY','number','QTY',NULL,'zmrb_inward_report','transaction_quantity',23),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','CH','string','CH',NULL,NULL,NULL,24),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','GRN_ITEM_NO','string','ZEILE','$.ZEILE','zmrb_inward_report','grn_item_no',25),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','GRN_DATE','string','BLDAT','$.BLDAT','zmrb_inward_report','grn_date',26),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','ARBPL','string','ARBPL',NULL,'zmrb_inward_report','work_center',27),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','AUART','string','AUART',NULL,'zmrb_inward_report','order_type',28),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','RUECK','string','RUECK',NULL,'zmrb_inward_report','confirmation_no',29),
 ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','KUNNR','string','KUNNR',NULL,'zmrb_inward_report','customer_code',30);

-- 8. Result_Recording_View request fields
DELETE FROM public.sap_api_request_fields WHERE config_id='4a60825e-2f0b-4633-9978-47214480f80a';
INSERT INTO public.sap_api_request_fields (config_id, field_name, field_type, sap_field_name, default_value, is_required, sort_order) VALUES
 ('4a60825e-2f0b-4633-9978-47214480f80a','INSPLOT','string','INSPLOT',NULL,false,0),
 ('4a60825e-2f0b-4633-9978-47214480f80a','INSPOPER','string','INSPOPER',NULL,false,1);

-- 9. Result_Recording_View response fields (auto-generated from cloud)
DELETE FROM public.sap_api_response_fields WHERE config_id='4a60825e-2f0b-4633-9978-47214480f80a';
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Inspection Lot','INSPLOT','number','INSPLOT',NULL,NULL,1,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Material','MATNR','string','MATNR',NULL,NULL,2,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Material Description','MAKTX','string','MAKTX',NULL,NULL,3,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Batch','CHARG','string','CHARG',NULL,NULL,4,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Lot Qty','LOSMENGE','number','LOSMENGE',NULL,NULL,5,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','UoM','MENGENEINH','string','MENGENEINH',NULL,NULL,6,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Inspection Operation','INSPOPER','string','INSPOPER',NULL,NULL,7,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','GRN','ZZGRN','string','ZZGRN',NULL,NULL,8,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Vendor','ZZSUPL','string','ZZSUPL',NULL,NULL,9,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Result Saved By','ZUSER_RESSAVE_NAME','string','ZUSER_RESSAVE_NAME',NULL,NULL,10,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Result Submitted By','ZUSER_RESSUB_NAME','string','ZUSER_RESSUB_NAME',NULL,NULL,11,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Result Remarks','ZRESREMARKS','string','ZRESREMARKS',NULL,NULL,12,'header') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Char No','INSPCHAR','number','CHAR[].INSPCHAR',NULL,NULL,101,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Code Group','CODEGRUPPE_DESP','string','CHAR[].CODEGRUPPE_DESP',NULL,NULL,103,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Selected Set','AUSWAHLMGE_DESP','string','CHAR[].AUSWAHLMGE_DESP',NULL,NULL,104,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Result','CODE_DESP','string','CHAR[].CODE_DESP',NULL,NULL,105,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Valuation','BEWERTUNG','string','CHAR[].BEWERTUNG',NULL,NULL,106,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Required Samples','SOLLSTPUMF','number','CHAR[].SOLLSTPUMF',NULL,NULL,107,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','UoM','MENGENEINH','string','CHAR[].MENGENEINH',NULL,NULL,108,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Tolerance','TOLGRENZE','string','CHAR[].TOLGRENZE',NULL,NULL,109,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Plant','AUSWMGWRK1','string','CHAR[].AUSWMGWRK1',NULL,NULL,110,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Plant Desc','WERKS_DESPS','string','CHAR[].WERKS_DESPS',NULL,NULL,111,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Closed','CLOSED','string','CHAR[].CLOSED',NULL,NULL,112,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Evaluated','EVALUATED','string','CHAR[].EVALUATED',NULL,NULL,113,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Inspection Lot','INSPLOT','string','CHAR[].INSPLOT',NULL,NULL,114,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Inspection Operation','INSPOPER','string','CHAR[].INSPOPER',NULL,NULL,115,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Catalog Active','KATAB1','string','CHAR[].KATAB1',NULL,NULL,136,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Catalog Type','KATALGART1','string','CHAR[].KATALGART1',NULL,NULL,137,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Selection Set Code','AUSWMENGE1','string','CHAR[].AUSWMENGE1',NULL,NULL,138,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Selection Set','AUSWAHLMGE','string','CHAR[].AUSWAHLMGE',NULL,NULL,139,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Code Group ID','CODEGRUPPE','string','CHAR[].CODEGRUPPE',NULL,NULL,140,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Code ID','CODE','string','CHAR[].CODE',NULL,NULL,141,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Defect Class','FEHLKLASSE','string','CHAR[].FEHLKLASSE',NULL,NULL,144,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Alt Code 1','CODE_1','string','CHAR[].CODE_1',NULL,NULL,145,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Alt Code 1 Desc','CODE_DESP_1','string','CHAR[].CODE_DESP_1',NULL,NULL,146,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Alt Valuation 1','BEWERTUNG_1','string','CHAR[].BEWERTUNG_1',NULL,NULL,147,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Alt Defect Class 1','FEHLKLASSE_1','string','CHAR[].FEHLKLASSE_1',NULL,NULL,148,'char') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Char #','INSPCHAR','number','RESVAL[].INSPCHAR',NULL,NULL,201,'resval') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Res #','RES_NO','number','RESVAL[].RES_NO',NULL,NULL,202,'resval') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Value','RES_VALUE','string','RESVAL[].RES_VALUE',NULL,NULL,203,'resval') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Valuation','RES_VALUAT','string','RESVAL[].RES_VALUAT',NULL,NULL,204,'resval') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Inspector','INSPECTOR','string','RESVAL[].INSPECTOR',NULL,NULL,205,'resval') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Code','CODE1','string','RESVAL[].CODE1',NULL,NULL,206,'resval') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Code Group','CODE_GRP1','string','RESVAL[].CODE_GRP1',NULL,NULL,207,'resval') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Original Input','ORIGINAL_INPUT','string','RESVAL[].ORIGINAL_INPUT',NULL,NULL,208,'resval') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Remark','REMARK','string','RESVAL[].REMARK',NULL,NULL,209,'resval') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Batch','BATCH','string','RESVAL[].BATCH',NULL,NULL,210,'resval') ON CONFLICT DO NOTHING;
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, json_path, map_to_table, map_to_column, sort_order, description) VALUES ('4a60825e-2f0b-4633-9978-47214480f80a','Formula','FORMULA','string','RESVAL[].FORMULA',NULL,NULL,211,'resval') ON CONFLICT DO NOTHING;

COMMIT;
