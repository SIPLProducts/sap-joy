## Goal
On the **Inward In-Process Materials** worklist, stop rendering the duplicate dynamic columns `Kunnr`, `Name1_cust`, `VBELN`, `POSNR` — they are already shown by the dedicated **Customer Code / Customer Name / Sales Order / Sales Item** columns. Confirm the SAP→DB mapping for those 4 keys is correct so the dedicated columns continue to populate.

## Background (verified)
The 4 SAP response-field rows are already mapped correctly in `sap_api_response_fields`:

| sap_field_name | map_to_table | map_to_column |
|---|---|---|
| Kunnr | zmrb_inward_report | customer_code |
| Name1_cust | zmrb_inward_report | customer_name |
| VBELN | zmrb_inward_report | sales_order |
| POSNR | zmrb_inward_report | sales_item |

(User wrote "VBELLN" — actual SAP key is `VBELN`; existing config is correct, no change needed.)

The duplicate column rendering happens because `useExtraDynamicFields('zmrb_inward_report')` returns any mapped field whose `map_to_column` is **not** listed in `BASE_COLUMNS.zmrb_inward_report` in `src/hooks/useDynamicFields.ts`. The four target columns (`customer_code`, `customer_name`, `sales_order`, `sales_item`) are missing from that set, so they leak through as "extra" columns and render twice in `InwardInProcessReport.tsx`.

## Code change (1 file)

**`src/hooks/useDynamicFields.ts`** — add the 4 columns to `BASE_COLUMNS.zmrb_inward_report`:
- `customer_code`
- `customer_name`
- `sales_order`
- `sales_item`

This single change automatically removes the duplicate `Kunnr / Name1_cust / VBELN / POSNR` columns from the In-Process Materials worklist (and any other screen using `useExtraDynamicFields('zmrb_inward_report')`) without touching the SAP config or the page header layout.

## Out of scope
- No DB / migration changes — all 4 columns and SAP mappings already exist and work.
- No changes to `InwardInProcessReport.tsx` — the dedicated Customer Code / Customer Name / Sales Order / Sales Item headers and cells already render correctly from the previous task.
- No changes to `sap_api_response_fields` rows — keeping the mappings intact ensures the SAP scheduler keeps writing values into `customer_code / customer_name / sales_order / sales_item`.

## Verification
1. Open Inward In-Process Materials → header row should show **Customer Code, Customer Name, Sales Order, Sales Item** exactly once each. The columns previously labeled `Kunnr`, `Name1_cust`, `VBELN`, `POSNR` should be gone.
2. Values in the dedicated columns continue to populate from SAP sync.
3. Any *other* extra response field configured in SAP API Settings (outside the base set) still renders dynamically — only the 4 duplicates are suppressed.
