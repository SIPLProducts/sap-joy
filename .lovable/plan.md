## Issue

`InwardInProcessReport` reads `customer_code`, `customer_name`, `sales_order`, `sales_item` from `zmrb_inward_report`, but those columns are empty in the database.

## Root Cause

The active SAP config `a1000001-0001-0001-0001-000000000004` (ZMRB_Inward_Inspection) is missing the required response-field mappings:

| SAP Field | Target Column | Status in active config |
|---|---|---|
| KUNNR | customer_code | missing |
| Name1_cust | customer_name | missing |
| KDAUF (or VBELN) | sales_order | row exists but `map_to_table` and `map_to_column` are NULL |
| POSNR | sales_item | missing entirely |

The scheduler skips any field where `map_to_table` or `map_to_column` is NULL, so even when SAP returns these values, they never reach `zmrb_inward_report`. (A second orphan config `f1ac85d4-…` has partial mappings, but the live sync uses `a1000001-…-0004`.)

The remaining columns (vendor, PO, batch, dates, etc.) populate correctly because their mappings exist on the active config.

## Fix Plan

### 1. Database migration (the only change required)

Insert / update mappings on `sap_api_response_fields` for `config_id = a1000001-0001-0001-0001-000000000004`:

```sql
-- Fix the existing KDAUF row (currently has NULL map_to_table/column)
UPDATE public.sap_api_response_fields
SET map_to_table = 'zmrb_inward_report', map_to_column = 'sales_order'
WHERE config_id = 'a1000001-0001-0001-0001-000000000004' AND field_name = 'KDAUF';

-- Add missing rows
INSERT INTO public.sap_api_response_fields
  (config_id, field_name, field_type, sap_field_name, json_path, map_to_table, map_to_column, display_order)
VALUES
  ('a1000001-0001-0001-0001-000000000004','KUNNR','string','KUNNR',NULL,'zmrb_inward_report','customer_code', 30),
  ('a1000001-0001-0001-0001-000000000004','Name1_cust','string','Name1_cust',NULL,'zmrb_inward_report','customer_name', 31),
  ('a1000001-0001-0001-0001-000000000004','POSNR','string','POSNR',NULL,'zmrb_inward_report','sales_item', 32)
ON CONFLICT DO NOTHING;
```

Existing rows that target `inward_inspection_lots` (vendor/PO/etc.) will be left untouched — they continue to feed the legacy table; the manual-sync path already writes the same data into `zmrb_inward_report`.

### 2. Verify

After the migration runs:
- Trigger a sync from "MRB Inward Materials → Refresh data" for the active plant.
- Re-query `zmrb_inward_report` to confirm `customer_code`, `customer_name`, `sales_order`, `sales_item` now populate.
- Reload the In-Process screen — the 4 columns should show values.

### Open Question

The migration assumes SAP actually returns these keys with the names **KUNNR**, **Name1_cust**, **KDAUF**, **POSNR**. If your SAP/ZMRB04 endpoint uses different keys (for example `VBELN` instead of `KDAUF`, or `NAME1_CUST` upper-case), let me know and I'll adjust. The scheduler matches keys case-insensitively, so casing differences are not an issue, but the underlying field name must match.

## Out of Scope

- No frontend changes — `InwardInProcessReport.tsx` and `InwardInProcessMRBContext.tsx` already read these columns.
- No edge function changes — the existing scheduler/manual-sync mapping engines already understand these target columns.
