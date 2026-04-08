-- =============================================================================
-- HBL MRB – Complete Seed Data for Self-Hosted Supabase
-- Run AFTER setup-db.sh has created all tables/functions
-- This provides ALL configuration data needed for the application to work
-- Updated: 2026-04-08
-- =============================================================================
-- IMPORTANT: Users (auth.users) must be created SEPARATELY via the create-users.sh
-- script because auth.users is managed by Supabase Auth and requires API calls.
-- This file seeds EVERYTHING ELSE: config, profiles, roles, permissions, SAP, etc.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. PLANTS
-- =============================================================================
INSERT INTO public.plants (code, name, location) VALUES
  ('1300', 'HBL Plant 1300', 'Hyderabad')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 2. DEPARTMENTS (Roles)
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
-- 5. DEFECT CODES
-- =============================================================================
INSERT INTO public.defect_codes (code, description, category, is_active) VALUES
  ('DC001', 'Dimension Out of Tolerance', 'dimensional',    true),
  ('DC002', 'Surface Scratch/Damage',     'surface',        true),
  ('DC003', 'Material Composition Issue', 'material',       true),
  ('DC004', 'Functional Test Failure',    'functional',     true),
  ('DC005', 'Missing Documentation',      'documentation',  true),
  ('DC006', 'Packaging Damage',           'packaging',      true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 6. EMAIL TEMPLATES
-- =============================================================================
INSERT INTO public.email_templates (template_key, subject_template, body_template, is_active) VALUES
  ('mrb_created',   'New MRB Created: {{mrb_number}}',       'A new MRB {{mrb_number}} has been created for material {{material_description}} at plant {{plant}}. Please review.', true),
  ('mrb_forwarded', 'MRB {{mrb_number}} - Action Required',  'MRB {{mrb_number}} has been forwarded to {{pending_with}} for review. Material: {{material_description}}, Plant: {{plant}}.', true),
  ('mrb_approved',  'MRB {{mrb_number}} - Approved',         'MRB {{mrb_number}} for material {{material_description}} has been approved. Final decision: {{final_decision}}.', true),
  ('mrb_rejected',  'MRB {{mrb_number}} - Rejected',         'MRB {{mrb_number}} for material {{material_description}} has been rejected. Please take necessary action.', true),
  ('sla_warning',   'SLA Warning: MRB {{mrb_number}}',       'MRB {{mrb_number}} is approaching SLA deadline. Current pending days: {{pending_days}}. Please expedite review.', true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 7. ROLE PERMISSIONS (Plant 1300 - All 10 roles × 17 modules = 170 rows)
-- =============================================================================
INSERT INTO public.role_permissions (role, module_key, module_label, can_view, can_edit, plant) VALUES
  -- ADMIN (full access)
  ('admin', 'analytics', 'MRB Analytics', true, true, '1300'),
  ('admin', 'email_log', 'Email Log', true, true, '1300'),
  ('admin', 'engineering_dashboard', 'Engineering Dashboard', true, true, '1300'),
  ('admin', 'executive_summary', 'Executive Summary', true, true, '1300'),
  ('admin', 'help_support', 'Help & Support', true, true, '1300'),
  ('admin', 'inward_materials', 'MRB - Inward Materials', true, true, '1300'),
  ('admin', 'kpi_dashboard', 'KPI Dashboard', true, true, '1300'),
  ('admin', 'material_blocking', 'Material Blocking', true, true, '1300'),
  ('admin', 'mrb_print', 'MRB Print', true, true, '1300'),
  ('admin', 'plant_management', 'Plant Management', true, true, '1300'),
  ('admin', 'purchase_dashboard', 'Purchase Dashboard', true, true, '1300'),
  ('admin', 'quality_dashboard', 'Quality Dashboard', true, true, '1300'),
  ('admin', 'sap_api_settings', 'SAP API Settings', true, true, '1300'),
  ('admin', 'sap_sync_monitor', 'SAP Sync Monitor', true, true, '1300'),
  ('admin', 'user_management', 'User & Role Management', true, true, '1300'),
  ('admin', 'user_matrix', 'User Permission Matrix', true, true, '1300'),
  ('admin', 'worklist', 'MRB Worklist', true, true, '1300'),
  -- ENGINEERING
  ('engineering', 'analytics', 'MRB Analytics', true, false, '1300'),
  ('engineering', 'email_log', 'Email Log', true, false, '1300'),
  ('engineering', 'engineering_dashboard', 'Engineering Dashboard', true, false, '1300'),
  ('engineering', 'executive_summary', 'Executive Summary', false, false, '1300'),
  ('engineering', 'help_support', 'Help & Support', true, false, '1300'),
  ('engineering', 'inward_materials', 'MRB - Inward Materials', true, true, '1300'),
  ('engineering', 'kpi_dashboard', 'KPI Dashboard', true, false, '1300'),
  ('engineering', 'material_blocking', 'Material Blocking', false, false, '1300'),
  ('engineering', 'mrb_print', 'MRB Print', true, false, '1300'),
  ('engineering', 'plant_management', 'Plant Management', false, false, '1300'),
  ('engineering', 'purchase_dashboard', 'Purchase Dashboard', false, false, '1300'),
  ('engineering', 'quality_dashboard', 'Quality Dashboard', false, false, '1300'),
  ('engineering', 'sap_api_settings', 'SAP API Settings', false, false, '1300'),
  ('engineering', 'sap_sync_monitor', 'SAP Sync Monitor', false, false, '1300'),
  ('engineering', 'user_management', 'User & Role Management', false, false, '1300'),
  ('engineering', 'user_matrix', 'User Permission Matrix', false, false, '1300'),
  ('engineering', 'worklist', 'MRB Worklist', true, true, '1300'),
  -- ENGINEERING HEAD
  ('engineering_head', 'analytics', 'MRB Analytics', true, false, '1300'),
  ('engineering_head', 'email_log', 'Email Log', true, false, '1300'),
  ('engineering_head', 'engineering_dashboard', 'Engineering Dashboard', true, false, '1300'),
  ('engineering_head', 'executive_summary', 'Executive Summary', true, false, '1300'),
  ('engineering_head', 'help_support', 'Help & Support', true, false, '1300'),
  ('engineering_head', 'inward_materials', 'MRB - Inward Materials', true, true, '1300'),
  ('engineering_head', 'kpi_dashboard', 'KPI Dashboard', true, false, '1300'),
  ('engineering_head', 'material_blocking', 'Material Blocking', false, false, '1300'),
  ('engineering_head', 'mrb_print', 'MRB Print', true, false, '1300'),
  ('engineering_head', 'plant_management', 'Plant Management', false, false, '1300'),
  ('engineering_head', 'purchase_dashboard', 'Purchase Dashboard', false, false, '1300'),
  ('engineering_head', 'quality_dashboard', 'Quality Dashboard', false, false, '1300'),
  ('engineering_head', 'sap_api_settings', 'SAP API Settings', false, false, '1300'),
  ('engineering_head', 'sap_sync_monitor', 'SAP Sync Monitor', false, false, '1300'),
  ('engineering_head', 'user_management', 'User & Role Management', false, false, '1300'),
  ('engineering_head', 'user_matrix', 'User Permission Matrix', false, false, '1300'),
  ('engineering_head', 'worklist', 'MRB Worklist', true, true, '1300'),
  -- EXECUTIVE
  ('executive', 'analytics', 'MRB Analytics', true, false, '1300'),
  ('executive', 'email_log', 'Email Log', true, false, '1300'),
  ('executive', 'engineering_dashboard', 'Engineering Dashboard', true, false, '1300'),
  ('executive', 'executive_summary', 'Executive Summary', true, false, '1300'),
  ('executive', 'help_support', 'Help & Support', true, false, '1300'),
  ('executive', 'inward_materials', 'MRB - Inward Materials', true, true, '1300'),
  ('executive', 'kpi_dashboard', 'KPI Dashboard', true, false, '1300'),
  ('executive', 'material_blocking', 'Material Blocking', false, false, '1300'),
  ('executive', 'mrb_print', 'MRB Print', true, false, '1300'),
  ('executive', 'plant_management', 'Plant Management', false, false, '1300'),
  ('executive', 'purchase_dashboard', 'Purchase Dashboard', true, false, '1300'),
  ('executive', 'quality_dashboard', 'Quality Dashboard', true, false, '1300'),
  ('executive', 'sap_api_settings', 'SAP API Settings', false, false, '1300'),
  ('executive', 'sap_sync_monitor', 'SAP Sync Monitor', false, false, '1300'),
  ('executive', 'user_management', 'User & Role Management', false, false, '1300'),
  ('executive', 'user_matrix', 'User Permission Matrix', false, false, '1300'),
  ('executive', 'worklist', 'MRB Worklist', true, true, '1300'),
  -- MRB COMMITTEE
  ('mrb_committee', 'analytics', 'MRB Analytics', true, false, '1300'),
  ('mrb_committee', 'email_log', 'Email Log', true, false, '1300'),
  ('mrb_committee', 'engineering_dashboard', 'Engineering Dashboard', true, false, '1300'),
  ('mrb_committee', 'executive_summary', 'Executive Summary', true, false, '1300'),
  ('mrb_committee', 'help_support', 'Help & Support', true, false, '1300'),
  ('mrb_committee', 'inward_materials', 'MRB - Inward Materials', true, true, '1300'),
  ('mrb_committee', 'kpi_dashboard', 'KPI Dashboard', true, false, '1300'),
  ('mrb_committee', 'material_blocking', 'Material Blocking', false, false, '1300'),
  ('mrb_committee', 'mrb_print', 'MRB Print', true, false, '1300'),
  ('mrb_committee', 'plant_management', 'Plant Management', false, false, '1300'),
  ('mrb_committee', 'purchase_dashboard', 'Purchase Dashboard', true, false, '1300'),
  ('mrb_committee', 'quality_dashboard', 'Quality Dashboard', true, false, '1300'),
  ('mrb_committee', 'sap_api_settings', 'SAP API Settings', false, false, '1300'),
  ('mrb_committee', 'sap_sync_monitor', 'SAP Sync Monitor', false, false, '1300'),
  ('mrb_committee', 'user_management', 'User & Role Management', false, false, '1300'),
  ('mrb_committee', 'user_matrix', 'User Permission Matrix', false, false, '1300'),
  ('mrb_committee', 'worklist', 'MRB Worklist', true, true, '1300'),
  -- PURCHASE
  ('purchase', 'analytics', 'MRB Analytics', true, false, '1300'),
  ('purchase', 'email_log', 'Email Log', true, false, '1300'),
  ('purchase', 'engineering_dashboard', 'Engineering Dashboard', false, false, '1300'),
  ('purchase', 'executive_summary', 'Executive Summary', false, false, '1300'),
  ('purchase', 'help_support', 'Help & Support', true, false, '1300'),
  ('purchase', 'inward_materials', 'MRB - Inward Materials', true, true, '1300'),
  ('purchase', 'kpi_dashboard', 'KPI Dashboard', true, false, '1300'),
  ('purchase', 'material_blocking', 'Material Blocking', false, false, '1300'),
  ('purchase', 'mrb_print', 'MRB Print', true, false, '1300'),
  ('purchase', 'plant_management', 'Plant Management', false, false, '1300'),
  ('purchase', 'purchase_dashboard', 'Purchase Dashboard', true, false, '1300'),
  ('purchase', 'quality_dashboard', 'Quality Dashboard', false, false, '1300'),
  ('purchase', 'sap_api_settings', 'SAP API Settings', false, false, '1300'),
  ('purchase', 'sap_sync_monitor', 'SAP Sync Monitor', false, false, '1300'),
  ('purchase', 'user_management', 'User & Role Management', false, false, '1300'),
  ('purchase', 'user_matrix', 'User Permission Matrix', false, false, '1300'),
  ('purchase', 'worklist', 'MRB Worklist', true, true, '1300'),
  -- PURCHASE HEAD
  ('purchase_head', 'analytics', 'MRB Analytics', true, false, '1300'),
  ('purchase_head', 'email_log', 'Email Log', true, false, '1300'),
  ('purchase_head', 'engineering_dashboard', 'Engineering Dashboard', false, false, '1300'),
  ('purchase_head', 'executive_summary', 'Executive Summary', true, false, '1300'),
  ('purchase_head', 'help_support', 'Help & Support', true, false, '1300'),
  ('purchase_head', 'inward_materials', 'MRB - Inward Materials', true, true, '1300'),
  ('purchase_head', 'kpi_dashboard', 'KPI Dashboard', true, true, '1300'),
  ('purchase_head', 'material_blocking', 'Material Blocking', false, false, '1300'),
  ('purchase_head', 'mrb_print', 'MRB Print', true, false, '1300'),
  ('purchase_head', 'plant_management', 'Plant Management', false, false, '1300'),
  ('purchase_head', 'purchase_dashboard', 'Purchase Dashboard', true, false, '1300'),
  ('purchase_head', 'quality_dashboard', 'Quality Dashboard', false, false, '1300'),
  ('purchase_head', 'sap_api_settings', 'SAP API Settings', false, false, '1300'),
  ('purchase_head', 'sap_sync_monitor', 'SAP Sync Monitor', false, false, '1300'),
  ('purchase_head', 'user_management', 'User & Role Management', false, false, '1300'),
  ('purchase_head', 'user_matrix', 'User Permission Matrix', false, false, '1300'),
  ('purchase_head', 'worklist', 'MRB Worklist', true, true, '1300'),
  -- QUALITY
  ('quality', 'analytics', 'MRB Analytics', true, false, '1300'),
  ('quality', 'email_log', 'Email Log', false, false, '1300'),
  ('quality', 'engineering_dashboard', 'Engineering Dashboard', false, false, '1300'),
  ('quality', 'executive_summary', 'Executive Summary', false, false, '1300'),
  ('quality', 'help_support', 'Help & Support', false, false, '1300'),
  ('quality', 'inward_materials', 'MRB - Inward Materials', false, false, '1300'),
  ('quality', 'kpi_dashboard', 'KPI Dashboard', true, false, '1300'),
  ('quality', 'material_blocking', 'Material Blocking', false, false, '1300'),
  ('quality', 'mrb_print', 'MRB Print', false, false, '1300'),
  ('quality', 'plant_management', 'Plant Management', false, false, '1300'),
  ('quality', 'purchase_dashboard', 'Purchase Dashboard', false, false, '1300'),
  ('quality', 'quality_dashboard', 'Quality Dashboard', false, false, '1300'),
  ('quality', 'sap_api_settings', 'SAP API Settings', false, false, '1300'),
  ('quality', 'sap_sync_monitor', 'SAP Sync Monitor', false, false, '1300'),
  ('quality', 'user_management', 'User & Role Management', false, false, '1300'),
  ('quality', 'user_matrix', 'User Permission Matrix', false, false, '1300'),
  ('quality', 'worklist', 'MRB Worklist', true, true, '1300'),
  -- QUALITY HEAD
  ('quality_head', 'analytics', 'MRB Analytics', true, false, '1300'),
  ('quality_head', 'email_log', 'Email Log', true, false, '1300'),
  ('quality_head', 'engineering_dashboard', 'Engineering Dashboard', false, false, '1300'),
  ('quality_head', 'executive_summary', 'Executive Summary', true, false, '1300'),
  ('quality_head', 'help_support', 'Help & Support', true, false, '1300'),
  ('quality_head', 'inward_materials', 'MRB - Inward Materials', true, true, '1300'),
  ('quality_head', 'kpi_dashboard', 'KPI Dashboard', true, true, '1300'),
  ('quality_head', 'material_blocking', 'Material Blocking', true, true, '1300'),
  ('quality_head', 'mrb_print', 'MRB Print', true, false, '1300'),
  ('quality_head', 'plant_management', 'Plant Management', false, false, '1300'),
  ('quality_head', 'purchase_dashboard', 'Purchase Dashboard', false, false, '1300'),
  ('quality_head', 'quality_dashboard', 'Quality Dashboard', true, false, '1300'),
  ('quality_head', 'sap_api_settings', 'SAP API Settings', false, false, '1300'),
  ('quality_head', 'sap_sync_monitor', 'SAP Sync Monitor', false, false, '1300'),
  ('quality_head', 'user_management', 'User & Role Management', false, false, '1300'),
  ('quality_head', 'user_matrix', 'User Permission Matrix', false, false, '1300'),
  ('quality_head', 'worklist', 'MRB Worklist', true, true, '1300'),
  -- SHOP FLOOR
  ('shop_floor', 'analytics', 'MRB Analytics', false, false, '1300'),
  ('shop_floor', 'email_log', 'Email Log', false, false, '1300'),
  ('shop_floor', 'engineering_dashboard', 'Engineering Dashboard', false, false, '1300'),
  ('shop_floor', 'executive_summary', 'Executive Summary', false, false, '1300'),
  ('shop_floor', 'help_support', 'Help & Support', true, false, '1300'),
  ('shop_floor', 'inward_materials', 'MRB - Inward Materials', false, false, '1300'),
  ('shop_floor', 'kpi_dashboard', 'KPI Dashboard', false, false, '1300'),
  ('shop_floor', 'material_blocking', 'Material Blocking', true, true, '1300'),
  ('shop_floor', 'mrb_print', 'MRB Print', false, false, '1300'),
  ('shop_floor', 'plant_management', 'Plant Management', false, false, '1300'),
  ('shop_floor', 'purchase_dashboard', 'Purchase Dashboard', false, false, '1300'),
  ('shop_floor', 'quality_dashboard', 'Quality Dashboard', false, false, '1300'),
  ('shop_floor', 'sap_api_settings', 'SAP API Settings', false, false, '1300'),
  ('shop_floor', 'sap_sync_monitor', 'SAP Sync Monitor', false, false, '1300'),
  ('shop_floor', 'user_management', 'User & Role Management', false, false, '1300'),
  ('shop_floor', 'user_matrix', 'User Permission Matrix', false, false, '1300'),
  ('shop_floor', 'worklist', 'MRB Worklist', true, true, '1300')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 8. SAP API CONFIG (4 endpoints)
-- =============================================================================
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
-- 9. SAP REQUEST FIELDS (24 total)
-- =============================================================================

-- MB52 Request Fields (6)
INSERT INTO public.sap_api_request_fields (config_id, field_name, sap_field_name, field_type, is_required, default_value, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000001', 'WERKS',  'WERKS',  'string', true,  '1300', 1, 'Plant (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000001', 'LGORT',  'LGORT',  'string', true,  'S061', 2, 'Storage Location (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000001', 'MATNR',  'MATNR',  'string', true,  NULL,   3, 'Material Number(s) - Comma separated (STRING)'),
  ('a1000001-0001-0001-0001-000000000001', 'MATART', 'MATART', 'string', true,  'ZROH', 4, 'Material Type (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000001', 'CHARG',  'CHARG',  'string', true,  NULL,   5, 'Batch Number - Optional (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000001', 'XMCHB',  'XMCHB',  'string', true,  'X',    6, 'Batch Management Indicator (CHAR 1)')
ON CONFLICT DO NOTHING;

-- SAP 343 Request Fields (6)
INSERT INTO public.sap_api_request_fields (config_id, field_name, sap_field_name, field_type, is_required, default_value, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000002', 'MATNR',     'MATNR',     'string', true, NULL,   1, 'Material Number (CHAR 18)'),
  ('a1000001-0001-0001-0001-000000000002', 'WERKS',     'WERKS',     'string', true, '1300', 2, 'Plant (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000002', 'LGORT',     'LGORT',     'string', true, 'S065', 3, 'Storage Location (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000002', 'CHARG',     'CHARG',     'string', true, NULL,   4, 'Batch Number (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000002', 'ENTRY_QNT', 'ENTRY_QNT', 'number', true, NULL,   5, 'Quantity (QUAN 13.3)'),
  ('a1000001-0001-0001-0001-000000000002', 'ENTRY_UOM', 'ENTRY_UOM', 'string', true, NULL,   6, 'Unit of Measure (UNIT 3)')
ON CONFLICT DO NOTHING;

-- SAP 344 Request Fields (6)
INSERT INTO public.sap_api_request_fields (config_id, field_name, sap_field_name, field_type, is_required, default_value, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000003', 'MATNR',     'MATNR',     'string', true, NULL,   1, 'Material Number (CHAR 18)'),
  ('a1000001-0001-0001-0001-000000000003', 'WERKS',     'WERKS',     'string', true, '1300', 2, 'Plant (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000003', 'LGORT',     'LGORT',     'string', true, 'S061', 3, 'Storage Location (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000003', 'CHARG',     'CHARG',     'string', true, NULL,   4, 'Batch Number (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000003', 'ENTRY_QNT', 'ENTRY_QNT', 'number', true, NULL,   5, 'Quantity (QUAN 13.3)'),
  ('a1000001-0001-0001-0001-000000000003', 'ENTRY_UOM', 'ENTRY_UOM', 'string', true, NULL,   6, 'Unit of Measure (UNIT 3)')
ON CONFLICT DO NOTHING;

-- ZMRB Inward Request Fields (6)
INSERT INTO public.sap_api_request_fields (config_id, field_name, sap_field_name, field_type, is_required, default_value, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000004', 'WERKS',    'WERKS',    'string', true,  '1300', 1, 'Plant (CHAR 4) - Mandatory'),
  ('a1000001-0001-0001-0001-000000000004', 'LGORT',    'LGORT',    'string', false, NULL,   2, 'Storage Location (CHAR 4)'),
  ('a1000001-0001-0001-0001-000000000004', 'PRUEFLOS', 'PRUEFLOS', 'string', false, NULL,   3, 'Inspection Lot Number (NUMC 12)'),
  ('a1000001-0001-0001-0001-000000000004', 'MATNR',    'MATNR',    'string', false, NULL,   4, 'Material Number (CHAR 18)'),
  ('a1000001-0001-0001-0001-000000000004', 'LIFNR',    'LIFNR',    'string', false, NULL,   5, 'Vendor / Supplier Number (CHAR 10)'),
  ('a1000001-0001-0001-0001-000000000004', 'ART',      'ART',      'string', true,  '01',   6, 'Inspection Type: 01=ZMRB01, 04=ZMRB04 (CHAR 2)')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 10. SAP RESPONSE FIELDS (51 total)
-- =============================================================================

-- MB52 Response Fields (19 → shop_floor_stock)
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

-- SAP 343 Response Fields (4)
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, map_to_table, map_to_column, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000002', 'CODE',  'CODE',  'string', NULL, NULL, 1, 'Response Code (100 = Success)'),
  ('a1000001-0001-0001-0001-000000000002', 'MSG',   'MSG',   'string', NULL, NULL, 2, 'Response Message'),
  ('a1000001-0001-0001-0001-000000000002', 'MBLNR', 'MBLNR', 'string', NULL, NULL, 3, 'Material Document Number'),
  ('a1000001-0001-0001-0001-000000000002', 'MJAHR', 'MJAHR', 'number', NULL, NULL, 4, 'Material Document Year')
ON CONFLICT DO NOTHING;

-- SAP 344 Response Fields (4)
INSERT INTO public.sap_api_response_fields (config_id, field_name, sap_field_name, field_type, map_to_table, map_to_column, sort_order, description) VALUES
  ('a1000001-0001-0001-0001-000000000003', 'CODE',  'CODE',  'string', NULL, NULL, 1, 'Response Code (100 = Success)'),
  ('a1000001-0001-0001-0001-000000000003', 'MSG',   'MSG',   'string', NULL, NULL, 2, 'Response Message'),
  ('a1000001-0001-0001-0001-000000000003', 'MBLNR', 'MBLNR', 'string', NULL, NULL, 3, 'Material Document Number'),
  ('a1000001-0001-0001-0001-000000000003', 'MJAHR', 'MJAHR', 'number', NULL, NULL, 4, 'Material Document Year')
ON CONFLICT DO NOTHING;

-- ZMRB Inward Response Fields (24 → inward_inspection_lots)
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

-- =============================================================================
-- NOTE ON USERS:
-- =============================================================================
-- Users CANNOT be created via SQL because auth.users is managed by Supabase Auth.
-- After running this seed, use the create-users.sh script to create users via API:
--
-- Users to create (all with password: 12345678 or as configured):
--
-- | Email                              | Full Name          | Role              |
-- |------------------------------------|--------------------|-------------------|
-- | masteradmin@sharviinfotech.com      | Master Admin       | admin             |
-- | quality.demo@hbl.com               | Quality Inspector  | quality           |
-- | qualityhead.demo@hbl.com           | Quality Head       | quality_head      |
-- | purchase.demo@hbl.com              | Purchase Team      | purchase          |
-- | purchasehead.demo@hbl.com          | Purchase Head      | purchase_head     |
-- | engineering.demo@hbl.com           | Engineering Team   | engineering       |
-- | enghead.demo@hbl.com               | Engineering Head   | engineering_head  |
-- | executive.demo@hbl.com             | Executive Manager  | executive         |
-- | shopfloor.demo@hbl.com             | Shop Floor User    | shop_floor        |
--
-- After users are created via Auth API, run create-users.sh which will:
-- 1. Create auth.users entries
-- 2. Insert profiles (triggered by handle_new_user)
-- 3. Assign user_roles
-- 4. Assign user_plants (plant 1300)
-- 5. Create user_security records
-- =============================================================================
