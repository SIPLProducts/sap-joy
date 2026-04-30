
-- 1. Create new table mirroring inward_inspection_lots
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

CREATE POLICY "Authenticated users can view zmrb inward report"
  ON public.zmrb_inward_report FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert zmrb inward report"
  ON public.zmrb_inward_report FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update zmrb inward report"
  ON public.zmrb_inward_report FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete zmrb inward report"
  ON public.zmrb_inward_report FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_zmrb_inward_report_updated_at
  BEFORE UPDATE ON public.zmrb_inward_report
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_zmrb_inward_report_plant ON public.zmrb_inward_report(plant);
CREATE INDEX IF NOT EXISTS idx_zmrb_inward_report_material_code ON public.zmrb_inward_report(material_code);

-- 2. Seed response field mappings for the new API config
-- (mirror of config a1000001-...-000000000004 but mapped to zmrb_inward_report)
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

-- 3. Seed request fields for the new API config (so SAP returns data)
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
