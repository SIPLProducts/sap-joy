-- =============================================================================
-- HBL MRB – Complete Seed Data for Self-Hosted Supabase
-- Run AFTER setup-db.sh has created all tables/functions
-- This provides all configuration data needed for the application to work
-- Updated: 2026-04-08
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. PLANTS
-- =============================================================================
INSERT INTO public.plants (code, name, location) VALUES
  ('1300', 'HBL Plant 1300', 'Hyderabad')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 2. DEPARTMENTS
-- =============================================================================
INSERT INTO public.departments (name, role_key, description, is_active, is_workflow_enabled, workflow_status) VALUES
  ('Quality',       'quality',       'Quality Assurance & Control',        true, true,  'quality_review'),
  ('Purchase',      'purchase',      'Purchase & Procurement',             true, true,  'purchase_review'),
  ('Engineering',   'engineering',   'Engineering & Design',               true, true,  'engineering_review'),
  ('Shop Floor',    'shop_floor',    'Manufacturing & Production',         true, true,  NULL),
  ('Management',    'executive',     'Senior Management & Executives',     true, true,  'final_approval'),
  ('MRB Committee', 'mrb_committee', 'Material Review Board Committee',    true, true,  'quality_review'),
  ('IT',            NULL,            'Information Technology',              true, false, NULL)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. PLANT WORKFLOW CONFIG (Plant 1300)
-- =============================================================================
INSERT INTO public.plant_workflow_config (plant, workflow_step, department, step_label, is_required, is_active) VALUES
  ('1300', 1, 'quality',      'Quality Review',          true, true),
  ('1300', 2, 'purchase',     'Purchase Review',         true, true),
  ('1300', 3, 'engineering',  'Engineering Review',      true, true),
  ('1300', 4, 'quality_head', 'Quality Head Approval',   true, true),
  ('1300', 5, 'executive',    'Final Approval',          true, true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 4. PLANT PRINT CONFIG
-- =============================================================================
INSERT INTO public.plant_print_config (plant, company_name, division_name, mrb_doc_number, mrb_revision, mrb_effective_date, ncr_doc_number, ncr_revision, ncr_effective_date) VALUES
  ('1300', 'HBL Power Systems Ltd.', 'Battery Division', 'HBL/QA/MRB/001', '01', '2025-01-01', 'HBL/QA/NCR/001', '01', '2025-01-01')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 5. SAP API CONFIG (4 endpoints)
-- =============================================================================
-- Use deterministic UUIDs so request/response fields can reference them
INSERT INTO public.sap_api_config (id, config_name, api_endpoint, auth_type, connection_mode, http_method, base_url, endpoint_path, description, username, encrypted_password, sap_client, proxy_tunnel_url, proxy_secret, timeout_ms, retry_count, retry_delay_ms, max_records, enable_logging, is_active, sync_frequency, scheduler_enabled) VALUES
  ('a1000001-0001-0001-0001-000000000001', 'MB52_Stock_Report',
   'http://10.10.6.115:8000/sap/api/mb52', 'basic', 'proxy', 'POST',
   'http://10.10.6.115:8000', '/sap/api/mb52',
   'MB52 - Material Stock Report. Returns stock quantities (unrestricted, blocked, QI, transfer) by plant, storage location, material and batch.',
   'wfms_user', 'R@p!d#3126', '234', '', '7d9f2e1b4a5c8e3d6f1g0h2j4k6l8m0n',
   30000, 3, 5000, 1000, true, true, 'manual', false),

  ('a1000001-0001-0001-0001-000000000002', 'SAP_343_Blocked_To_Unrestricted',
   'http://10.10.6.115:8000/sap/api/343', 'basic', 'proxy', 'PUT',
   'http://10.10.6.115:8000', '/sap/api/343',
   '343 Movement - Moves blocked stock quantity to unrestricted stock in SAP.',
   'wfms_user', 'R@p!d#3126', '234', '', '7d9f2e1b4a5c8e3d6f1g0h2j4k6l8m0n',
   30000, 3, 5000, 1000, true, true, 'manual', false),

  ('a1000001-0001-0001-0001-000000000003', 'SAP_344_Unrestricted_To_Blocked',
   'http://10.10.6.115:8000/sap/api/344', 'basic', 'proxy', 'GET',
   'http://10.10.6.115:8000', '/sap/api/344',
   '344 Movement - Moves unrestricted stock quantity to blocked stock in SAP.',
   'wfms_user', 'R@p!d#3126', '234', '', '7d9f2e1b4a5c8e3d6f1g0h2j4k6l8m0n',
   30000, 3, 5000, 1000, true, true, 'manual', false),

  ('a1000001-0001-0001-0001-000000000004', 'ZMRB_Inward_Inspection',
   'http://10.10.6.115:8000/sap/api/zmrb01', 'basic', 'proxy', 'POST',
   'http://10.10.6.115:8000', '/sap/api/zmrb01',
   'ZMRB01/ZMRB04 - Inward Inspection Report. Fetches inspection lots with vendor, PO, batch and quantity details. Use ART=01 for ZMRB01, ART=04 for ZMRB04.',
   'wfms_user', 'R@p!d#3126', '234', '', '7d9f2e1b4a5c8e3d6f1g0h2j4k6l8m0n',
   30000, 3, 5000, 1000, true, true, 'manual', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 6. SAP REQUEST FIELDS
-- =============================================================================

-- MB52 Request Fields
INSERT INTO public.sap_api_request_fields (config_id, field_name, sap_field_name, field_type, is_required, default_value, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000001', 'WERKS',  'WERKS',  'string', true,  '1300', 1, 'Plant (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000001', 'LGORT',  'LGORT',  'string', true,  'S061', 2, 'Storage Location (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000001', 'MATNR',  'MATNR',  'string', true,  NULL,   3, 'Material Number(s) - Comma separated (STRING)'),
  ('a1000001-0001-0001-0001-000000000001', 'MATART', 'MATART', 'string', true,  'ZROH', 4, 'Material Type (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000001', 'CHARG',  'CHARG',  'string', true,  NULL,   5, 'Batch Number - Optional (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000001', 'XMCHB',  'XMCHB',  'string', true,  'X',    6, 'Batch Management Indicator (CHAR 1)')
ON CONFLICT DO NOTHING;

-- SAP 343 Request Fields
INSERT INTO public.sap_api_request_fields (config_id, field_name, sap_field_name, field_type, is_required, default_value, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000002', 'MATNR',     'MATNR',     'string', true, NULL,   1, 'Material Number (CHAR 18)'),
  ('a1000001-0001-0001-0001-000000000002', 'WERKS',     'WERKS',     'string', true, '1300', 2, 'Plant (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000002', 'LGORT',     'LGORT',     'string', true, 'S065', 3, 'Storage Location (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000002', 'CHARG',     'CHARG',     'string', true, NULL,   4, 'Batch Number (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000002', 'ENTRY_QNT', 'ENTRY_QNT', 'number', true, NULL,   5, 'Quantity (QUAN 13.3)'),
  ('a1000001-0001-0001-0001-000000000002', 'ENTRY_UOM', 'ENTRY_UOM', 'string', true, NULL,   6, 'Unit of Measure (UNIT 3)')
ON CONFLICT DO NOTHING;

-- SAP 344 Request Fields
INSERT INTO public.sap_api_request_fields (config_id, field_name, sap_field_name, field_type, is_required, default_value, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000003', 'MATNR',     'MATNR',     'string', true, NULL,   1, 'Material Number (CHAR 18)'),
  ('a1000001-0001-0001-0001-000000000003', 'WERKS',     'WERKS',     'string', true, '1300', 2, 'Plant (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000003', 'LGORT',     'LGORT',     'string', true, 'S061', 3, 'Storage Location (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000003', 'CHARG',     'CHARG',     'string', true, NULL,   4, 'Batch Number (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000003', 'ENTRY_QNT', 'ENTRY_QNT', 'number', true, NULL,   5, 'Quantity (QUAN 13.3)'),
  ('a1000001-0001-0001-0001-000000000003', 'ENTRY_UOM', 'ENTRY_UOM', 'string', true, NULL,   6, 'Unit of Measure (UNIT 3)')
ON CONFLICT DO NOTHING;

-- ZMRB Inward Request Fields
INSERT INTO public.sap_api_request_fields (config_id, field_name, sap_field_name, field_type, is_required, default_value, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000004', 'WERKS',    'WERKS',    'string', true,  '1300', 1, 'Plant (CHAR 4) - Mandatory'),
  ('a1000001-0001-0001-0001-000000000004', 'LGORT',    'LGORT',    'string', false, NULL,   2, 'Storage Location (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000004', 'PRUEFLOS', 'PRUEFLOS', 'string', false, NULL,   3, 'Inspection Lot Number (NUMC 12)'),
  ('a1000001-0001-0001-0001-000000000004', 'MATNR',    'MATNR',    'string', false, NULL,   4, 'Material Number (CHAR 18)'),
  ('a1000001-0001-0001-0001-000000000004', 'LIFNR',    'LIFNR',    'string', false, NULL,   5, 'Vendor / Supplier Number (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000004', 'ART',      'ART',      'string', true,  '01',   6, 'Inspection Type: 01=ZMRB01, 04=ZMRB04 (CHAR 2)')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 7. SAP RESPONSE FIELDS
-- =============================================================================

-- MB52 Response Fields (19 fields → shop_floor_stock)
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, map_to_table, map_to_column, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000001', 'WERKS',   'WERKS',   'string', 'shop_floor_stock', 'plant',                    1,  'Plant (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000001', 'LGORT',   'LGORT',   'string', 'shop_floor_stock', 'storage_location',         2,  'Storage Location (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000001', 'LGOBE',   'LGOBE',   'string', 'shop_floor_stock', 'storage_location_desc',    3,  'Storage Location Description (CHAR 20)'),
  ('a1000001-0001-0001-0001-000000000001', 'MATNR',   'MATNR',   'string', 'shop_floor_stock', 'material_code',            4,  'Material Number (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000001', 'MAKTX',   'MAKTX',   'string', 'shop_floor_stock', 'material_description',     5,  'Material Description (CHAR 40)'),
  ('a1000001-0001-0001-0001-000000000001', 'MEINS',   'MEINS',   'string', 'shop_floor_stock', 'uom',                      6,  'Base Unit of Measure (CHAR 3)'),
  ('a1000001-0001-0001-0001-000000000001', 'LABST',   'LABST',   'number', 'shop_floor_stock', 'available_quantity',        7,  'Unrestricted Stock Quantity (QUAN 13.3)'),
  ('a1000001-0001-0001-0001-000000000001', 'WLABS',   'WLABS',   'number', 'shop_floor_stock', 'unrestricted_value',       8,  'Unrestricted Stock Value (CURR 13.2)'),
  ('a1000001-0001-0001-0001-000000000001', 'INSME',   'INSME',   'number', 'shop_floor_stock', 'quality_inspection_qty',   9,  'Quality Inspection Stock (QUAN 13.3)'),
  ('a1000001-0001-0001-0001-000000000001', 'WINSM',   'WINSM',   'number', 'shop_floor_stock', 'quality_inspection_value', 10, 'Quality Inspection Stock Value (CURR 13.2)'),
  ('a1000001-0001-0001-0001-000000000001', 'SPEME',   'SPEME',   'number', 'shop_floor_stock', 'blocked_quantity',         11, 'Blocked Stock Quantity (QUAN 13.3)'),
  ('a1000001-0001-0001-0001-000000000001', 'WSPEM',   'WSPEM',   'number', 'shop_floor_stock', 'blocked_value',            12, 'Blocked Stock Value (CURR 13.2)'),
  ('a1000001-0001-0001-0001-000000000001', 'TRAME',   'TRAME',   'number', 'shop_floor_stock', 'transfer_qty',             13, 'Stock in Transfer Quantity (QUAN 13.3)'),
  ('a1000001-0001-0001-0001-000000000001', 'WTRAM',   'WTRAM',   'number', 'shop_floor_stock', 'transfer_value',           14, 'Stock in Transfer Value (CURR 13.2)'),
  ('a1000001-0001-0001-0001-000000000001', 'CHARG',   'CHARG',   'string', 'shop_floor_stock', 'batch',                    15, 'Batch Number (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000001', 'ROWNO',   'ROWNO',   'string', 'shop_floor_stock', 'row_number_custom',        16, 'Row Number - Custom (CHAR 5)'),
  ('a1000001-0001-0001-0001-000000000001', 'SHELFNO', 'SHELFNO', 'string', 'shop_floor_stock', 'shelf_number',             17, 'Shelf Number - Custom (CHAR 5)'),
  ('a1000001-0001-0001-0001-000000000001', 'RACKNO',  'RACKNO',  'string', 'shop_floor_stock', 'rack_number',              18, 'Rack Number - Custom (CHAR 5)'),
  ('a1000001-0001-0001-0001-000000000001', 'BINNO',   'BINNO',   'string', 'shop_floor_stock', 'bin_number',               19, 'Bin Number - Custom (CHAR 5)')
ON CONFLICT DO NOTHING;

-- SAP 343 Response Fields
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, map_to_table, map_to_column, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000002', 'CODE',  'CODE',  'string', NULL, NULL, 1, 'Response Code (100 = Success)'),
  ('a1000001-0001-0001-0001-000000000002', 'MSG',   'MSG',   'string', NULL, NULL, 2, 'Response Message'),
  ('a1000001-0001-0001-0001-000000000002', 'MBLNR', 'MBLNR', 'string', NULL, NULL, 3, 'Material Document Number'),
  ('a1000001-0001-0001-0001-000000000002', 'MJAHR', 'MJAHR', 'number', NULL, NULL, 4, 'Material Document Year')
ON CONFLICT DO NOTHING;

-- SAP 344 Response Fields
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, map_to_table, map_to_column, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000003', 'CODE',  'CODE',  'string', NULL, NULL, 1, 'Response Code (100 = Success)'),
  ('a1000001-0001-0001-0001-000000000003', 'MSG',   'MSG',   'string', NULL, NULL, 2, 'Response Message'),
  ('a1000001-0001-0001-0001-000000000003', 'MBLNR', 'MBLNR', 'string', NULL, NULL, 3, 'Material Document Number'),
  ('a1000001-0001-0001-0001-000000000003', 'MJAHR', 'MJAHR', 'number', NULL, NULL, 4, 'Material Document Year')
ON CONFLICT DO NOTHING;

-- ZMRB Inward Response Fields (24 fields → inward_inspection_lots)
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, map_to_table, map_to_column, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000004', 'PRUEFLOS',   'PRUEFLOS',   'string', 'inward_inspection_lots', 'inspection_lot',        1,  'Inspection Lot Number (NUMC 12)'),
  ('a1000001-0001-0001-0001-000000000004', 'WERK',       'WERK',       'string', 'inward_inspection_lots', 'plant',                 2,  'Plant (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000004', 'ENSTEHDAT',  'ENSTEHDAT',  'string', 'inward_inspection_lots', 'inspection_date',       3,  'Inspection Lot Created Date (DATS)'),
  ('a1000001-0001-0001-0001-000000000004', 'AUFNR',      'AUFNR',      'string', NULL,                     NULL,                    4,  'Order Number (CHAR 12)'),
  ('a1000001-0001-0001-0001-000000000004', 'MATNR',      'MATNR',      'string', 'inward_inspection_lots', 'material_code',         5,  'Material Number (CHAR 18)'),
  ('a1000001-0001-0001-0001-000000000004', 'SELLIFNR',   'SELLIFNR',   'string', 'inward_inspection_lots', 'vendor_code',           6,  'Vendor Code (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000004', 'MBLNR',      'MBLNR',      'string', 'inward_inspection_lots', 'grn_number',            7,  'Material Document Number / GRN (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000004', 'CHARG',      'CHARG',      'string', 'inward_inspection_lots', 'batch',                 8,  'Batch Number (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000004', 'LGORT',      'LGORT',      'string', 'inward_inspection_lots', 'storage_location',      9,  'Storage Location (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000004', 'KDAUF',      'KDAUF',      'string', NULL,                     NULL,                    10, 'Sales Order Number (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000004', 'EKORG',      'EKORG',      'string', NULL,                     NULL,                    11, 'Purchasing Organization (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000004', 'EBELN',      'EBELN',      'string', 'inward_inspection_lots', 'po_number',             12, 'Purchase Order Number (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000004', 'EBELP',      'EBELP',      'number', 'inward_inspection_lots', 'po_item_number',        13, 'Purchase Order Item (NUMC 5)'),
  ('a1000001-0001-0001-0001-000000000004', 'BUDAT_MKPF', 'BUDAT_MKPF', 'string', 'inward_inspection_lots', 'posting_date',          14, 'Posting Date (DATS)'),
  ('a1000001-0001-0001-0001-000000000004', 'SGTXT',      'SGTXT',      'string', 'inward_inspection_lots', 'block_reason',          15, 'Block Reason / Item Text (CHAR 50)'),
  ('a1000001-0001-0001-0001-000000000004', 'MENGENEINH', 'MENGENEINH', 'string', 'inward_inspection_lots', 'uom',                   16, 'Unit of Measure (UNIT 3)'),
  ('a1000001-0001-0001-0001-000000000004', 'LMENGE04',   'LMENGE04',   'number', 'inward_inspection_lots', 'blocked_quantity',      17, 'Transaction Quantity (QUAN 13.3)'),
  ('a1000001-0001-0001-0001-000000000004', 'MAKTX',      'MAKTX',      'string', 'inward_inspection_lots', 'material_description',  18, 'Material Description (CHAR 40)'),
  ('a1000001-0001-0001-0001-000000000004', 'GROUP',      'GROUP',      'string', NULL,                     NULL,                    19, 'Purchase Group Code (CHAR 3)'),
  ('a1000001-0001-0001-0001-000000000004', 'GNAME',      'GNAME',      'string', NULL,                     NULL,                    20, 'Purchase Group Name (CHAR 20)'),
  ('a1000001-0001-0001-0001-000000000004', 'LGOBE',      'LGOBE',      'string', NULL,                     NULL,                    21, 'Storage Location Description (CHAR 20)'),
  ('a1000001-0001-0001-0001-000000000004', 'NAME1',      'NAME1',      'string', 'inward_inspection_lots', 'vendor_name',           22, 'Vendor Name (CHAR 35)'),
  ('a1000001-0001-0001-0001-000000000004', 'QTY',        'QTY',        'number', 'inward_inspection_lots', 'transaction_quantity',   23, 'Blocked Quantity (QUAN 13.3)'),
  ('a1000001-0001-0001-0001-000000000004', 'CH',         'CH',         'string', NULL,                     NULL,                    24, 'Batch Indicator / Custom Flag (CHAR 1)')
ON CONFLICT DO NOTHING;

COMMIT;
