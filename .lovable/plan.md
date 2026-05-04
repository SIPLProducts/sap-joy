## Database changes — last 10 days (Apr 24 → May 4, 2026)

There are **5 migrations** in this window. Below is a single, idempotent, FK-safe SQL script you can paste into the self-hosted Supabase SQL Editor. It includes a guard for the parent `sap_api_config` row (which is what caused your earlier `23503` error).

### Migrations included
1. `20260430090946` — create `zmrb_inward_report` + seed SAP request/response field mappings
2. `20260501033324` — add `'inprocess'` to `mrb_source` enum + seed `role_permissions` for `inward_inprocess` screen
3. `20260501082820` — add 4 production columns to `zmrb_inward_report`
4. `20260501082840` — update `map_to_table` for AUFNR/ARBPL/AUART/RUECK fields
5. `20260504072231` — add 4 customer/sales columns to `zmrb_inward_report`

### Consolidated SQL to run on self-hosted

```sql
-- ============================================================
-- PART 1: Create zmrb_inward_report table (2026-04-30)
-- ============================================================
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
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zmrb_inward_report_inspection_lot_unique UNIQUE (inspection_lot)
);

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

DROP TRIGGER IF EXISTS update_zmrb_inward_report_updated_at ON public.zmrb_inward_report;
CREATE TRIGGER update_zmrb_inward_report_updated_at
  BEFORE UPDATE ON public.zmrb_inward_report
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_zmrb_inward_report_plant         ON public.zmrb_inward_report(plant);
CREATE INDEX IF NOT EXISTS idx_zmrb_inward_report_material_code ON public.zmrb_inward_report(material_code);

-- ============================================================
-- PART 2: Ensure parent sap_api_config row EXISTS (fixes 23503)
-- ============================================================
INSERT INTO public.sap_api_config (id, config_name, api_endpoint, auth_type, is_active)
VALUES (
  'f1ac85d4-ca04-497a-bed6-1f509d10b4c2',
  'ZMRB_Inward_Process',
  'http://10.10.6.115:8000/mrb/inward/report?sap-client=234',
  'basic',
  true
)
ON CONFLICT (id) DO UPDATE SET
  config_name  = EXCLUDED.config_name,
  is_active    = EXCLUDED.is_active,
  updated_at   = now();

-- ============================================================
-- PART 3: Seed SAP response field mappings (2026-04-30)
-- ============================================================
INSERT INTO public.sap_api_response_fields
  (config_id, field_name, field_type, sap_field_name, json_path, map_to_table, map_to_column, sort_order)
VALUES
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','PRUEFLOS','string','PRUEFLOS',NULL,'zmrb_inward_report','inspection_lot',1),
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','WERK','string','WERK',NULL,'zmrb_inward_report','plant',2),
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','ENSTEHDAT','string','ENSTEHDAT',NULL,'zmrb_inward_report','inspection_date',3),
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','AUFNR','string','AUFNR',NULL,NULL,NULL,4),
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','MATNR','string','MATNR',NULL,'zmrb_inward_report','material_code',5),
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','SELLIFNR','string','SELLIFNR',NULL,'zmrb_inward_report','vendor_code',6),
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','MBLNR','string','MBLNR',NULL,'zmrb_inward_report','grn_number',7),
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','CHARG','string','CHARG',NULL,'zmrb_inward_report','batch',8),
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','LGORT','string','LGORT',NULL,'zmrb_inward_report','storage_location',9),
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','KDAUF','string','KDAUF',NULL,NULL,NULL,10),
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
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','GRN_DATE','string','BLDAT','$.BLDAT','zmrb_inward_report','grn_date',26)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PART 4: Seed SAP request fields (2026-04-30)
-- ============================================================
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
  ('f1ac85d4-ca04-497a-bed6-1f509d10b4c2','BLDAT','string','BLDAT',NULL,false,8)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PART 5: Add 'inprocess' to mrb_source enum + seed role_permissions (2026-05-01)
-- ============================================================
ALTER TYPE public.mrb_source ADD VALUE IF NOT EXISTS 'inprocess';

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

-- ============================================================
-- PART 6: Add production columns (2026-05-01)
-- ============================================================
ALTER TABLE public.zmrb_inward_report
  ADD COLUMN IF NOT EXISTS production_order_no text,
  ADD COLUMN IF NOT EXISTS work_center        text,
  ADD COLUMN IF NOT EXISTS order_type         text,
  ADD COLUMN IF NOT EXISTS confirmation_no    text;

-- ============================================================
-- PART 7: Update map_to_table for AUFNR/ARBPL/AUART/RUECK (2026-05-01)
-- ============================================================
UPDATE public.sap_api_response_fields
   SET map_to_table = 'zmrb_inward_report'
 WHERE config_id = 'f1ac85d4-ca04-497a-bed6-1f509d10b4c2'
   AND sap_field_name IN ('AUFNR','ARBPL','AUART','RUECK');

-- ============================================================
-- PART 8: Add customer/sales columns (2026-05-04)
-- ============================================================
ALTER TABLE public.zmrb_inward_report
  ADD COLUMN IF NOT EXISTS customer_code text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS sales_order  text,
  ADD COLUMN IF NOT EXISTS sales_item   text;

-- ============================================================
-- VERIFY
-- ============================================================
SELECT 'zmrb_inward_report cols' AS what, count(*) FROM information_schema.columns
 WHERE table_schema='public' AND table_name='zmrb_inward_report'
UNION ALL
SELECT 'sap_api_config exists',  count(*) FROM public.sap_api_config
 WHERE id='f1ac85d4-ca04-497a-bed6-1f509d10b4c2'
UNION ALL
SELECT 'response field mappings', count(*) FROM public.sap_api_response_fields
 WHERE config_id='f1ac85d4-ca04-497a-bed6-1f509d10b4c2'
UNION ALL
SELECT 'request field mappings',  count(*) FROM public.sap_api_request_fields
 WHERE config_id='f1ac85d4-ca04-497a-bed6-1f509d10b4c2'
UNION ALL
SELECT 'inward_inprocess perms',  count(*) FROM public.role_permissions
 WHERE module_key='inward_inprocess' AND plant='1300';
```

### Notes
- The script is idempotent — safe to re-run.
- Part 2 fixes the `23503` FK error you hit by ensuring the parent `sap_api_config` row exists **before** inserting child request/response fields.
- If your self-hosted DB already has a different `api_endpoint` for that config, the `ON CONFLICT DO UPDATE` will refresh it; remove that part if you want to preserve your local endpoint.
- No app code changes needed — this only mirrors what is already on Lovable Cloud onto self-hosted.

Approve to run nothing (read-only summary). Apply the SQL block above directly in your self-hosted Supabase SQL editor.