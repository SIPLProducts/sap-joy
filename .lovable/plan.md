## Goal

Update the **MRB - Inward InProcess** screen (`/inward/inprocess`) so that the table displays the exact column set requested for the ZMRB04 SAP API, including 4 new fields that are currently being fetched from SAP but discarded (Production Order, Work Center, Order Type, Confirmation Date/No).

## Final column list (in order)

Action, Status, Inspection Lot (PRUEFLOS), Material Code (MATNR), Material Description (MAKTX), Plant (WERK), SLoc (LGORT), Batch (CHARG), Blocked Qty (LMENGE04), Trans. Qty (QTY), UoM (MENGENEINH), Inspection Date (ENSTEHDAT), Posting Date (BUDAT_MKPF), Block Reason (SGTXT), Vendor Code (SELLIFNR), Vendor Name (NAME1), **Production Order (AUFNR)**, **Work Center (ARBPL)**, **Order Type (AUART)**, **Confirmation Date (RUECK)**.

Columns to **remove** from the existing screen: PO Number, PO Item Number, GRN Number, GRN Item No, GRN Date.

## Changes required

### 1. Database migration

Add the 4 missing columns to `zmrb_inward_report`:

```sql
ALTER TABLE public.zmrb_inward_report
  ADD COLUMN IF NOT EXISTS production_order_no text,
  ADD COLUMN IF NOT EXISTS work_center        text,
  ADD COLUMN IF NOT EXISTS order_type         text,
  ADD COLUMN IF NOT EXISTS confirmation_no    text;
```

Then patch the existing ZMRB_Inward_Process field config rows so the SAP scheduler actually persists those fields (currently `map_to_table` is NULL for them):

```sql
UPDATE public.sap_api_response_fields
   SET map_to_table = 'zmrb_inward_report'
 WHERE config_id = 'f1ac85d4-ca04-497a-bed6-1f509d10b4c2'
   AND sap_field_name IN ('AUFNR','ARBPL','AUART','RUECK');
```

No change to the inward (ZMRB01) config — it does not use these fields.

### 2. Context: `src/contexts/InwardInProcessMRBContext.tsx`

- Extend `InspectionLotRecord` with: `productionOrderNo`, `workCenter`, `orderType`, `confirmationDate` (all `string`).
- Map them in `fetchData()` from the new DB columns (`production_order_no`, `work_center`, `order_type`, `confirmation_no`) with `''` fallback.

### 3. UI: `src/pages/InwardInProcessReport.tsx`

- Remove `<TableHead>` and `<TableCell>` blocks for: PO Number, PO Item Number, GRN Number, GRN Item No, GRN Date.
- Add 4 new `<TableHead>` / `<TableCell>` blocks after Vendor Name in the requested order: Production Order, Work Center, Order Type, Confirmation Date.
- Confirmation Date is rendered with `formatDate()` if it parses, otherwise raw string (RUECK can come as a counter or YYYYMMDD).
- Update the empty-row `colSpan` (currently `20 + extraFields.length`) to the new visible column count (`19 + extraFields.length`).

### 4. Out of scope

- The Inward Materials screen (`/inward`) keeps Vendor/PO/GRN columns — no change there.
- No changes to MRB creation form, role matrix, or workflow routing.
- Existing rows in `zmrb_inward_report` will simply have NULL values for the 4 new columns until the next SAP sync repopulates them.

## Technical details

- The SAP sync handler reads `map_to_column`/`map_to_table` from `sap_api_response_fields` at runtime (per memory: "Dynamic UI Rendering Engine" / "SAP Scheduler Mapping Logic"), so once the migration runs, the next 5-min ZMRB04 sync (or a manual "Refresh Data") will populate the 4 new columns automatically.
- Real-time channel subscription on `zmrb_inward_report` already exists, so the UI will refresh as soon as new data lands.
- No TypeScript type regeneration step needed from us — `src/integrations/supabase/types.ts` is auto-managed.
