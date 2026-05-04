## Goal
On the **Inward In-Process Materials** worklist (`/inward-in-process-report`):
1. Rename column headers **Vendor Code → Customer Code** and **Vendor Name → Customer Name**.
2. Populate those columns from the SAP-configured fields (`Kunnr` → `customer_code`, `Name1_cust` → `customer_name`) defined in **SAP API Settings → ZMRB_Inward_Process → Response Fields**.
3. Immediately after Customer Name, display **Sales Order** (`VBELN`) and **Sales Item** (`POSNR`) using the same configured mappings.
4. Remove the **Confirmation Date** column.

## Database changes
The four target columns referenced in `sap_api_response_fields` do not yet exist on `zmrb_inward_report`. Add them so the SAP scheduler can persist values:
- `customer_code text`
- `customer_name text`
- `sales_order text`
- `sales_item text`

Also fix the existing response-field rows for `VBELN` and `POSNR` — currently `map_to_column` is set but `map_to_table` is empty, so the scheduler ignores them. Update both rows to set `map_to_table = 'zmrb_inward_report'`.

No RLS or policy changes needed (existing authenticated policies cover new columns).

## Code changes

**`src/contexts/InwardInProcessMRBContext.tsx`**
- Extend `InspectionLotRecord` with `customerCode`, `customerName`, `salesOrder`, `salesItem` (keep existing `vendorCode`/`vendorName` as aliases for backwards compatibility with `CreateInwardInProcessMRB.tsx`, mapping them to the same source fields so the Create-MRB flow keeps working).
- In `fetchData`, read from new columns: `customer_code`, `customer_name`, `sales_order`, `sales_item` (with `(lot as any)` casts until `types.ts` regenerates).
- Drop `confirmationDate` (or leave the field but stop using it — safer to leave for type stability, just not displayed).

**`src/pages/InwardInProcessReport.tsx`**
- Header row: replace `Vendor Code` → `Customer Code`, `Vendor Name` → `Customer Name`. Insert two new headers `Sales Order` and `Sales Item` immediately after Customer Name. Remove `Confirmation Date` header.
- Body row: render `record.customerCode`, `record.customerName`, `record.salesOrder`, `record.salesItem`. Remove the `confirmationDate` cell.
- Update the empty-state `colSpan` accordingly (currently `19 + extraFields.length` → becomes `20 + extraFields.length`: −1 for Confirmation Date, +2 for Sales Order/Item).

**`CreateInwardInProcessMRB.tsx`** — no UI rename requested for the create form in this task; leave the existing Vendor Code/Name labels there untouched (the user only asked about the In-Process worklist). Will use `customerCode`/`customerName` aliases so it still resolves data.

## Out of scope
- No changes to the Create MRB form labels, the inward MRB detail page, print layouts, or any other inward (non in-process) screen.
- No edge function changes — the existing dynamic mapping engine already writes any field whose `map_to_table`+`map_to_column` are configured.

## Verification
1. Run SAP sync (or wait for scheduler) → confirm `zmrb_inward_report` rows now have `customer_code`, `customer_name`, `sales_order`, `sales_item` populated.
2. Open Inward In-Process Materials → confirm headers read **Customer Code, Customer Name, Sales Order, Sales Item** in that order, Confirmation Date is gone, values render correctly.
3. SAP API Settings → ZMRB_Inward_Process → Response Fields: changing label/order of `Kunnr`, `Name1_cust`, `VBELN`, `POSNR` continues to control what is shown (extra fields beyond the 4 base ones still flow through the existing `useExtraDynamicFields` path).
